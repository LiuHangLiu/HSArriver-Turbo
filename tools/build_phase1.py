"""Build the portable Phase-1 launcher with PyInstaller.

Usage from the repository root:
    python tools/build_phase1.py

Output: ``dist/HSArriverTurbo-Phase1.zip``.  It is a portable onedir bundle;
there is no installer and no registry setup.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
import zipfile


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
BUILD = ROOT / "build"
NAME = "HSArriverTurbo-Phase1"


def main() -> int:
    command = [
        sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
        "--onedir", "--windowed", "--name", NAME,
        "--paths", str(ROOT),
        "--add-data", f"{ROOT / 'cards.json'};." if (ROOT / "cards.json").exists() else ".",
        "--add-data", f"{ROOT / 'web'};web" if (ROOT / "web").is_dir() else ".",
        "--hidden-import", "web_ui",
        "--hidden-import", "FSM_action",
        "--hidden-import", "get_screen",
        "--hidden-import", "manual_controller",
        "--hidden-import", "log_state",
        "--hidden-import", "power_log",
        "--hidden-import", "paddleocr",
        "--hidden-import", "paddle",
        str(ROOT / "phase1_launcher.py"),
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    package = DIST / NAME
    if not package.is_dir():
        raise RuntimeError(f"PyInstaller output missing: {package}")
    archive = DIST / f"{NAME}.zip"
    if archive.exists():
        archive.unlink()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as handle:
        for path in package.rglob("*"):
            if path.is_file():
                handle.write(path, path.relative_to(DIST))
    print(archive)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
