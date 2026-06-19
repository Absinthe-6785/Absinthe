"""K-114 — Per-request memory watchdog with request id and delta logging."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from memory_profile import MemoryDelta, MemoryProfiler
from memory_watchdog import DEFAULT_RSS_WARN_BYTES, maybe_warn_memory

logger = logging.getLogger("absinthe.request-memory")

PROFILED_PREFIXES = (
    "/api/notes",
    "/api/note_folders",
    "/api/backup",
)


@dataclass(frozen=True)
class RequestMemoryRecord:
    request_id: str
    method: str
    path: str
    delta: MemoryDelta

    def format_log(self) -> str:
        d = self.delta.as_dict()
        return (
            f"[request-memory] id={self.request_id} {self.method} {self.path} "
            f"rss_before={d['rssBefore']} rss_after={d['rssAfter']} "
            f"delta={d['rssDelta']} duration_ms={d['durationMs']:.1f}"
        )


def should_profile_path(path: str) -> bool:
    return any(path.startswith(prefix) for prefix in PROFILED_PREFIXES)


class RequestMemoryWatchdog:
    def __init__(self, *, rss_threshold: int = DEFAULT_RSS_WARN_BYTES) -> None:
        self.rss_threshold = rss_threshold

    def new_request_id(self) -> str:
        return uuid.uuid4().hex[:12]

    def finalize(self, request_id: str, method: str, path: str, profiler: MemoryProfiler) -> RequestMemoryRecord | None:
        if profiler.before is None:
            return None
        delta = profiler.mark_after()
        record = RequestMemoryRecord(request_id=request_id, method=method, path=path, delta=delta)
        logger.info(record.format_log())
        maybe_warn_memory(
            delta.after,
            rss_threshold=self.rss_threshold,
            context=f"{method} {path} id={request_id} delta={delta.rss_delta}",
        )
        return record
