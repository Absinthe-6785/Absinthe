"""Host coordinator only. Real driver cases run INSIDE the no-network DB image.

No Docker socket, host volume, published port or production DSN enters the image.
The ordinary Notes fixtures still own setup, synthetic roles and labelled cleanup.
"""
import json
from pathlib import Path

import pytest

from test_notes_identity_guard_candidate_postgres import model_db, candidate, ready, proof_db
from test_notes_identity_postgres import PAYLOAD
from test_notes_identity_private_gateway_postgres import private_db, private_ready
from test_remote_mutation_v2_postgres import _run

ROOT = Path(__file__).parent
IMAGE = ROOT / "test_fixtures" / "notes_private_gateway_driver"

# The synthetic key is sent on stdin, never placed in arguments or test logs.
ENTRY = """
import json, sys, pytest, psycopg, driver_cases
data = json.load(sys.stdin)
driver_cases.SIGNING_KEY = bytes.fromhex(data['signing_key'])
driver_cases.PAYLOAD = data['payload']
class Results:
    def __init__(self): self.passed = self.failed = self.skipped = 0
    def pytest_runtest_logreport(self, report):
        if report.failed: self.failed += 1
        if report.skipped: self.skipped += 1
        if report.when == 'call' and report.passed: self.passed += 1
    def pytest_sessionfinish(self, session): self.collected = session.testscollected
r = Results()
code = pytest.main(['-q', '-rA', '-p', 'no:cacheprovider', 'driver_cases.py'], plugins=[r])
print('DRIVER_PROOF_RESULT=' + json.dumps(dict(collected=r.collected, passed=r.passed,
      failed=r.failed, skipped=r.skipped, psycopg=psycopg.__version__)))
sys.exit(int(code))
"""


def driver_command(db):
    return [db.docker, "exec", "-i", "--user", "postgres", "--workdir", "/proof",
            db.name, "/opt/driver/bin/python", "-B", "-c", ENTRY]


def assert_isolated(info):
    host = info["HostConfig"]
    assert host["NetworkMode"] == "none"
    assert not host["PortBindings"] and not host["PublishAllPorts"]
    assert not host["Privileged"]
    assert not host["Binds"]
    assert "/var/lib/postgresql/data" in host["Tmpfs"]
    assert all(m["Type"] == "tmpfs" for m in info["Mounts"])
    assert all(not bindings for bindings in info["NetworkSettings"]["Ports"].values())
    assert info["Config"]["Labels"]["absinthe.test"] == "notes-identity-proof"


def test_driver_image_is_pinned_and_build_context_is_allowlisted():
    dockerfile = (IMAGE / "Dockerfile").read_text(encoding="utf-8")
    assert "postgres:15.19-alpine3.23@sha256:" in dockerfile
    assert "python3=3.12.16-r0 py3-pip=25.1.1-r1" in dockerfile
    assert "--require-hashes" in dockerfile and "--only-binary=:all:" in dockerfile
    assert "COPY . " not in dockerfile and "notes_private_gateway.py" in dockerfile
    ignore = (IMAGE / "Dockerfile.dockerignore").read_text(encoding="utf-8").splitlines()
    assert ignore[0] == "**" and "!auth.py" in ignore
    assert not any(".env" in line or "main.py" in line for line in ignore)
    requirements = (IMAGE / "requirements.txt").read_text(encoding="utf-8").splitlines()
    assert all("==" in line and "--hash=sha256:" in line for line in requirements if not line.startswith("#"))
    assert not any("pool" in line for line in requirements if not line.startswith("#"))


def test_runtime_command_and_fixture_preserve_the_isolation_boundary():
    from types import SimpleNamespace
    cmd = driver_command(SimpleNamespace(docker="docker", name="synthetic"))
    assert cmd[:2] == ["docker", "exec"]
    assert cmd[cmd.index("--user")+1] == "postgres"
    assert not any(x in cmd for x in ("-v", "--volume", "-p", "--publish", "--network", "-e"))
    source = (ROOT / "test_notes_identity_postgres.py").read_text(encoding="utf-8")
    assert '"--network", "none"' in source
    assert '"--tmpfs", "/var/lib/postgresql/data"' in source
    assert "test_notes_private_gateway_driver_harness" in source
    assert "absinthe-notes-private-driver:test" in source


@pytest.mark.parametrize("violation", ["network", "published_port", "privileged", "bind", "volume", "missing_tmpfs"])
def test_inspection_rejects_relaxed_runtime_isolation(violation):
    info = dict(HostConfig=dict(NetworkMode="none", PortBindings={}, PublishAllPorts=False,
                               Privileged=False, Binds=None, Tmpfs={"/var/lib/postgresql/data":""}),
                Mounts=[dict(Type="tmpfs")], NetworkSettings=dict(Ports={"5432/tcp":None}),
                Config=dict(Labels={"absinthe.test":"notes-identity-proof"}))
    if violation == "network": info["HostConfig"]["NetworkMode"] = "bridge"
    if violation == "published_port": info["HostConfig"]["PortBindings"] = {"5432/tcp":[{"HostPort":"5432"}]}
    if violation == "privileged": info["HostConfig"]["Privileged"] = True
    if violation == "bind": info["HostConfig"]["Binds"] = ["/host:/proof"]
    if violation == "volume": info["Mounts"] = [dict(Type="volume")]
    if violation == "missing_tmpfs": info["HostConfig"]["Tmpfs"] = {}
    with pytest.raises(AssertionError):
        assert_isolated(info)


def test_real_driver_inside_existing_disposable_fixture(private_ready):
    db = private_ready
    inspected = _run([db.docker, "container", "inspect", "--format", "{{json .}}", db.name], timeout=20)
    assert inspected.returncode == 0, "isolated test container inspection failed"
    info = json.loads(inspected.stdout)
    assert_isolated(info)
    result = _run(driver_command(db), input=json.dumps({"signing_key": db.signing_key.hex(), "payload": PAYLOAD}),
                  timeout=120, encoding="utf-8")
    # Test output contains synthetic IDs only, never tokens/key/DSN. No automatic retry.
    assert result.returncode == 0, result.stdout + result.stderr
    lines = [x for x in result.stdout.splitlines() if x.startswith("DRIVER_PROOF_RESULT=")]
    assert len(lines) == 1, "missing real-driver terminal result"
    proof = json.loads(lines[0].split("=", 1)[1])
    assert proof == dict(collected=19, passed=19, failed=0, skipped=0, psycopg="3.2.13")
    print("ISOLATED_DRIVER_IMAGE=" + info["Image"])
    print(result.stdout)
