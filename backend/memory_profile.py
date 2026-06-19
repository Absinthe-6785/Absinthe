"""K-114 — Request-scoped memory profiling helpers."""
from __future__ import annotations

import time
from dataclasses import dataclass

from memory_watchdog import MemorySample, sample_process_memory


@dataclass(frozen=True)
class MemoryDelta:
    before: MemorySample
    after: MemorySample
    duration_ms: float

    @property
    def rss_delta(self) -> int:
        return self.after.rss - self.before.rss

    @property
    def heap_delta(self) -> int:
        return self.after.heap_used - self.before.heap_used

    def as_dict(self) -> dict[str, int | float]:
        return {
            "rssBefore": self.before.rss,
            "rssAfter": self.after.rss,
            "rssDelta": self.rss_delta,
            "heapBefore": self.before.heap_used,
            "heapAfter": self.after.heap_used,
            "heapDelta": self.heap_delta,
            "durationMs": self.duration_ms,
        }


class MemoryProfiler:
    """Capture before/after RSS for a single request handler."""

    def __init__(self) -> None:
        self._started_at = 0.0
        self.before: MemorySample | None = None
        self.after: MemorySample | None = None

    def mark_before(self) -> MemorySample:
        self._started_at = time.time()
        self.before = sample_process_memory(self._started_at)
        return self.before

    def mark_after(self) -> MemoryDelta:
        ended = time.time()
        self.after = sample_process_memory(ended)
        if self.before is None:
            self.before = self.after
        return MemoryDelta(
            before=self.before,
            after=self.after,
            duration_ms=max(0.0, (ended - self._started_at) * 1000),
        )
