"""Fail when a source file grows past the project's line limit.

The code base is organised as orchestrator files over small modules. This check
keeps that true instead of leaving it as a claim in the README. It locates the
repository from its own path, so it can be run from any directory:

    python scripts/check_file_length.py
"""

from __future__ import annotations

import sys
from pathlib import Path

MAX_LINES = 200
SOURCE_ROOTS = ("backend/app", "backend/tests", "frontend/src", "scripts")
SOURCE_SUFFIXES = {".py", ".ts", ".tsx", ".css"}


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    too_long: list[tuple[int, str]] = []
    checked = 0
    for source_root in SOURCE_ROOTS:
        if not (root / source_root).is_dir():
            # A renamed folder must not make the check pass by finding nothing.
            print(f"Source folder not found: {source_root}. Update SOURCE_ROOTS.")
            return 1
        for path in sorted((root / source_root).rglob("*")):
            if not path.is_file() or path.suffix not in SOURCE_SUFFIXES:
                continue
            checked += 1
            lines = len(path.read_text(encoding="utf-8").splitlines())
            if lines > MAX_LINES:
                too_long.append((lines, path.relative_to(root).as_posix()))

    if too_long:
        print(f"Files over the {MAX_LINES}-line limit:")
        for lines, name in sorted(too_long, reverse=True):
            print(f"  {lines:4d}  {name}")
        print("Split them into an orchestrator plus smaller modules.")
        return 1
    print(f"{checked} source files checked; none exceeds {MAX_LINES} lines.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
