"""Backend logging: a root logger that actually emits, plus per-worker files.

Before this, nothing configured the root logger: `logging.getLogger(__name__)`
calls across the app went to Python's last-resort stderr handler at WARNING
and above, so every `logger.info` (session store choice, catalog scans,
Command Center probes) was silently dropped. Uvicorn's own loggers were the
only INFO lines anyone saw.

Now:
  - root level from LOG_LEVEL (default INFO), one line per record:
        2026-11-20T17:30:12.345Z INFO 17 api.auth.session_store: message
    (UTC, millisecond, process id, logger name) — the Command Center log
    viewer parses exactly this shape (api/command_center/logs.py)
  - a StreamHandler to stderr (docker logs keeps working)
  - a RotatingFileHandler per worker at <WINTEHR_LOG_DIR>/backend.<pid>.log
    (10 MB × 3). Per-process files because several uvicorn workers rotating
    one shared file would race; the viewer merges them by timestamp.
  - files older than LOG_RETENTION_DAYS (7) are removed at startup

Called once, first thing in main.py.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
import time
from pathlib import Path

LOG_FORMAT = "%(asctime)s.%(msecs)03dZ %(levelname)s %(process)d %(name)s: %(message)s"
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"
FILE_PREFIX = "backend."
MAX_BYTES = 10 * 1024 * 1024
BACKUP_COUNT = 3


def log_dir() -> Path:
    return Path(os.getenv("WINTEHR_LOG_DIR", "/app/logs"))


def _formatter() -> logging.Formatter:
    fmt = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
    fmt.converter = time.gmtime
    return fmt


def _prune_old_files(directory: Path, retention_days: int) -> int:
    cutoff = time.time() - retention_days * 86400
    removed = 0
    for path in directory.glob(f"{FILE_PREFIX}*.log*"):
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError:
            pass
    return removed


def configure_logging() -> logging.Logger:
    root = logging.getLogger()
    if getattr(root, "_wintehr_configured", False):
        return root
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    root.setLevel(getattr(logging, level_name, logging.INFO))
    formatter = _formatter()

    stream = logging.StreamHandler(sys.stderr)
    stream.setFormatter(formatter)
    root.addHandler(stream)

    directory = log_dir()
    try:
        directory.mkdir(parents=True, exist_ok=True)
        _prune_old_files(directory, int(os.getenv("LOG_RETENTION_DAYS", "7")))
        handler = logging.handlers.RotatingFileHandler(
            directory / f"{FILE_PREFIX}{os.getpid()}.log", maxBytes=MAX_BYTES, backupCount=BACKUP_COUNT, encoding="utf-8"
        )
        handler.setFormatter(formatter)
        root.addHandler(handler)
    except OSError as exc:
        root.warning("Log directory %s not writable (%s); file logging disabled", directory, exc)

    # Quiet the chattiest loggers at INFO; warnings and errors still surface.
    # security_middleware logs a Request and a Response line per call, which
    # duplicates uvicorn's access log and would dominate the Logs tab.
    for noisy in ("httpx", "httpcore", "asyncio", "api.middleware.security_middleware"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    root._wintehr_configured = True  # type: ignore[attr-defined]
    root.info("Logging configured: level=%s dir=%s", level_name, directory)
    return root
