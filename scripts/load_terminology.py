#!/usr/bin/env python3
"""Shim: the real script moved to backend/scripts/terminology/load_terminology.py so the
backend image carries it and the Command Center can run it as a job
(docs/COMMAND_CENTER.md, slice 4). This keeps the documented host command
`python3 scripts/load_terminology.py ...` working unchanged."""
import runpy
from pathlib import Path

runpy.run_path(
    str(Path(__file__).resolve().parent.parent / "backend" / "scripts" / "terminology" / "load_terminology.py"),
    run_name="__main__",
)
