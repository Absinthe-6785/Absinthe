"""K-97G — Lightweight server memory sampling and warning thresholds."""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Callable

logger = logging.getLogger("absinthe.memory")

# Render 512 MB limit — warn before OOM kill.
DEFAULT_HEAP_WARN_BYTES = 350 * 1024 * 1024
DEFAULT_RSS_WARN_BYTES = 450 * 1024 * 1024
DEFAULT_SAMPLE_INTERVAL_SEC = 1.0


@dataclass(frozen=True)
class MemorySample:
    rss: int
    heap_used: int
    external: int
    array_buffers: int
    sampled_at: float

    def as_dict(self) -> dict[str, int | float]:
        return {
            "rss": self.rss,
            "heapUsed": self.heap_used,
            "external": self.external,
            "arrayBuffers": self.array_buffers,
            "sampledAt": self.sampled_at,
        }


def _read_linux_rss_bytes() -> int | None:
    status_path = "/proc/self/status"
    if not os.path.exists(status_path):
        return None
    try:
        with open(status_path, encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("VmRSS:"):
                    parts = line.split()
                    if len(parts) >= 2:
                        return int(parts[1]) * 1024
    except OSError:
        return None
    return None


def sample_process_memory(now: float | None = None) -> MemorySample:
    """Best-effort memory sample — RSS from /proc on Linux, heap from tracemalloc if enabled."""
    sampled_at = now if now is not None else time.time()
    rss = _read_linux_rss_bytes() or 0

    heap_used = 0
    external = 0
    array_buffers = 0
    try:
        import tracemalloc

        current, peak = tracemalloc.get_traced_memory()
        heap_used = current
        external = max(0, peak - current)
    except Exception:
        pass

    if rss == 0:
        rss = heap_used

    return MemorySample(
        rss=rss,
        heap_used=heap_used,
        external=external,
        array_buffers=array_buffers,
        sampled_at=sampled_at,
    )


def format_memory_warning(
    sample: MemorySample,
    *,
    heap_threshold: int = DEFAULT_HEAP_WARN_BYTES,
    rss_threshold: int = DEFAULT_RSS_WARN_BYTES,
    context: str = "",
) -> str | None:
    over_heap = sample.heap_used > heap_threshold if sample.heap_used > 0 else False
    over_rss = sample.rss > rss_threshold
    if not over_heap and not over_rss:
        return None
    ctx = f" context={context}" if context else ""
    return (
        f"[memory-watchdog] high memory{ctx} "
        f"rss={sample.rss} heapUsed={sample.heap_used} "
        f"external={sample.external} arrayBuffers={sample.array_buffers} "
        f"thresholds(rss={rss_threshold},heap={heap_threshold})"
    )


def maybe_warn_memory(
    sample: MemorySample,
    *,
    heap_threshold: int = DEFAULT_HEAP_WARN_BYTES,
    rss_threshold: int = DEFAULT_RSS_WARN_BYTES,
    context: str = "",
    emit: Callable[[str], None] | None = None,
) -> str | None:
    message = format_memory_warning(
        sample,
        heap_threshold=heap_threshold,
        rss_threshold=rss_threshold,
        context=context,
    )
    if message:
        (emit or logger.warning)(message)
    return message


class MemoryWatchdog:
    """Rate-limited memory sampler — never raises or terminates the process."""

    def __init__(
        self,
        *,
        heap_threshold: int = DEFAULT_HEAP_WARN_BYTES,
        rss_threshold: int = DEFAULT_RSS_WARN_BYTES,
        min_interval_sec: float = DEFAULT_SAMPLE_INTERVAL_SEC,
        emit: Callable[[str], None] | None = None,
    ) -> None:
        self.heap_threshold = heap_threshold
        self.rss_threshold = rss_threshold
        self.min_interval_sec = min_interval_sec
        self.emit = emit or logger.warning
        self._last_sample_at = 0.0

    def sample_if_due(self, context: str = "") -> MemorySample | None:
        now = time.time()
        if now - self._last_sample_at < self.min_interval_sec:
            return None
        self._last_sample_at = now
        sample = sample_process_memory(now)
        maybe_warn_memory(
            sample,
            heap_threshold=self.heap_threshold,
            rss_threshold=self.rss_threshold,
            context=context,
            emit=self.emit,
        )
        return sample
