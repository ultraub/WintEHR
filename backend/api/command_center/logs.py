"""Backend log reader for the Command Center (slice 6).

Reads the per-worker files logging_setup.py writes (backend.<pid>.log and
their rotated .1/.2 siblings), merges them by timestamp, and filters by
level, text, and time window. Lines that do not match the record shape are
continuations (tracebacks) and attach to the previous record.

Everything is read from disk at request time; the files are on the
./logs bind mount, so every worker sees the same set.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional

LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
_LEVEL_RANK = {name: i for i, name in enumerate(LEVELS)}
_RECORD = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})Z (?P<level>[A-Z]+) (?P<pid>\d+) (?P<logger>\S+): (?P<msg>.*)$"
)
MAX_LINES = 5000
MAX_EXPORT_BYTES = 50 * 1024 * 1024


@dataclass
class LogRecord:
    ts: datetime
    level: str
    pid: int
    logger: str
    message: str
    file: str

    def as_line(self) -> str:
        return f"{self.ts.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]}Z {self.level} {self.pid} {self.logger}: {self.message}"


def log_files(directory: Path) -> List[Path]:
    """Every backend log file, oldest rotation first per worker."""
    files = sorted(directory.glob("backend.*.log*"), key=lambda p: (p.name.split(".log")[0], -_rotation_index(p)))
    return files


def _rotation_index(path: Path) -> int:
    tail = path.name.split(".log", 1)[1]  # "" or ".1"
    return int(tail[1:]) if tail.startswith(".") and tail[1:].isdigit() else 0


def parse_file(path: Path) -> Iterable[LogRecord]:
    current: Optional[LogRecord] = None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for raw in fh:
                line = raw.rstrip("\n")
                m = _RECORD.match(line)
                if m:
                    if current is not None:
                        yield current
                    current = LogRecord(
                        ts=datetime.strptime(m.group("ts"), "%Y-%m-%dT%H:%M:%S.%f").replace(tzinfo=timezone.utc),
                        level=m.group("level"), pid=int(m.group("pid")), logger=m.group("logger"),
                        message=m.group("msg"), file=path.name,
                    )
                elif current is not None:
                    current.message += "\n" + line
    except OSError:
        return
    if current is not None:
        yield current


def read_logs(
    directory: Path,
    level: Optional[str] = None,
    query: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = 500,
) -> tuple[List[LogRecord], int, List[str]]:
    """(matching records, newest last, capped at `limit`), total matched, files consulted."""
    min_rank = _LEVEL_RANK.get((level or "DEBUG").upper(), 0)
    needle = (query or "").lower()
    files = log_files(directory)
    records: List[LogRecord] = []
    for path in files:
        for rec in parse_file(path):
            if _LEVEL_RANK.get(rec.level, 0) < min_rank:
                continue
            if since and rec.ts < since:
                continue
            if until and rec.ts > until:
                continue
            if needle and needle not in rec.message.lower() and needle not in rec.logger.lower():
                continue
            records.append(rec)
    records.sort(key=lambda r: (r.ts, r.pid))
    total = len(records)
    limit = max(1, min(limit, MAX_LINES))
    return records[-limit:], total, [p.name for p in files]


def export_logs(directory: Path, since: Optional[datetime], until: Optional[datetime], level: Optional[str] = None) -> str:
    records, _, _ = read_logs(directory, level=level, since=since, until=until, limit=MAX_LINES * 100)
    out: List[str] = []
    size = 0
    for rec in records:
        line = rec.as_line()
        size += len(line) + 1
        if size > MAX_EXPORT_BYTES:
            out.append(f"... export truncated at {MAX_EXPORT_BYTES // (1024 * 1024)} MB; narrow the time window")
            break
        out.append(line)
    return "\n".join(out) + ("\n" if out else "")
