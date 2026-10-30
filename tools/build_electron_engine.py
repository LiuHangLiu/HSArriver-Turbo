"""Build the Python control sidecar used by the Electron portable client."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "desktop" / "engine-build"


def main() -> int:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        str(ROOT / "desktop_engine.spec"),
        "--distpath",
        str(OUTPUT),
        "--workpath",
        str(ROOT / "build" / "electron-engine"),
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    result = OUTPUT / "HSArriverTurboEngine" / "HSArriverTurboEngine.exe"
    if not result.is_file():
        raise RuntimeError(f"Electron sidecar build missing: {result}")
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
