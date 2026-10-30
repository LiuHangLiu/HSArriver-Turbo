"""Read-only tailer for HSArriver records written through HSAng print_log.

The page-side observer writes records containing ``source=hsarriver-readonly``
through the Box's existing ``print_log`` host method. This utility only reads
text log files; it never opens a process, named pipe, WebView, or game API.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Iterable

MARKER = "hsarriver-readonly"
TEXT_SUFFIXES = {".log", ".txt", ".json", ".out", ".err"}
SKIP_DIRS = {".cefcache", "node_modules", "cache", "code cache"}
SKIP_FILES = {"power.log"}


def _default_roots() -> tuple[str, ...]:
    user_profile = os.environ.get("USERPROFILE", "")
    app_data = os.environ.get("APPDATA", "")
    return (
        r"D:\炉石传说盒子",
        os.path.join(app_data, "HSAng") if app_data else "",
        os.path.join(user_profile, "Documents", "HSAng") if user_profile else "",
        os.environ.get("TEMP", ""),
    )


DEFAULT_ROOTS = _default_roots()


def _iter_log_files(roots: Iterable[Path]) -> list[Path]:
    result: list[Path] = []
    for root in roots:
        if not root.is_dir():
            continue
        try:
            for path in root.rglob("*"):
                if (not path.is_file() or path.name.lower() in SKIP_FILES or
                        path.suffix.lower() not in TEXT_SUFFIXES):
                    continue
                if any(part.lower() in SKIP_DIRS for part in path.parts):
                    continue
                try:
                    if path.stat().st_size > 64 * 1024 * 1024:
                        continue
                except OSError:
                    continue
                result.append(path)
        except OSError:
            continue
    return sorted(set(result))


def _extract(line: str) -> dict | None:
    if MARKER not in line:
        return None
    match = re.search(r'\{"source"\s*:\s*"' + re.escape(MARKER) + r'"', line)
    if not match:
        return None
    try:
        value, _ = json.JSONDecoder().raw_decode(line[match.start():])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def _read_new(path: Path, offset: int) -> tuple[int, list[dict]]:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            handle.seek(offset)
            text = handle.read()
            new_offset = handle.tell()
    except (OSError, UnicodeError):
        return offset, []
    records = []
    for line in text.splitlines():
        record = _extract(line)
        if record is not None:
            record["_log_file"] = str(path)
            records.append(record)
    return new_offset, records


def main() -> int:
    parser = argparse.ArgumentParser(description="Read HSArriver records from Box log files")
    parser.add_argument("--root", action="append", type=Path, default=[])
    parser.add_argument("--interval", type=float, default=0.5)
    parser.add_argument("--once", action="store_true", help="scan once and exit")
    parser.add_argument("--from-start", action="store_true")
    args = parser.parse_args()

    roots = args.root or [Path(root) for root in DEFAULT_ROOTS if root]
    offsets: dict[Path, int] = {}
    while True:
        for path in _iter_log_files(roots):
            if path not in offsets:
                try:
                    offsets[path] = 0 if args.from_start else path.stat().st_size
                except OSError:
                    continue
            offsets[path], records = _read_new(path, offsets[path])
            for record in records:
                print(json.dumps(record, ensure_ascii=False, separators=(",", ":")), flush=True)
        if args.once:
            return 0
        try:
            time.sleep(max(0.05, args.interval))
        except KeyboardInterrupt:
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
