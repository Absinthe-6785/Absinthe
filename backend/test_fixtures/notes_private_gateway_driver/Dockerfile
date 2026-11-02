# TEST ONLY. Build may retrieve dependencies; the test runtime has no network.
FROM postgres:15.19-alpine3.23@sha256:e4c48893f7771538194643b602387deb2fa6b5e2e751f1b923d04766c5f0b394
LABEL absinthe.test="notes-private-driver-image"
RUN apk add --no-cache python3=3.12.16-r0 py3-pip=25.1.1-r1 \
    && python3 -m venv --without-pip /opt/driver
COPY test_fixtures/notes_private_gateway_driver/requirements.txt /tmp/driver-requirements.txt
RUN python3 -m pip --python /opt/driver install --no-cache-dir --only-binary=:all: \
    --require-hashes -r /tmp/driver-requirements.txt \
    && python3 -m pip --python /opt/driver check
# Explicit allowlist: never copy .env, credentials, live routes or the repository.
COPY auth.py notes_identity_guard_candidate.py test_notes_identity_private_gateway.py /proof/
COPY identity_candidates/notes_private_gateway.py /proof/identity_candidates/
COPY test_fixtures/notes_private_gateway_driver/driver_cases.py /proof/
WORKDIR /proof
ENV PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
