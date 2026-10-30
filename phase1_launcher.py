"""Portable EXE entry point.

The runtime UI is the native single-window console in ``native_console``.
This small entry point is kept stable for PyInstaller and existing shortcuts.
"""

from native_console import (
    NativeConsole,
    find_hsbox_executable,
    load_local_config,
    main,
    save_local_config,
    start_hsbox,
)

__all__ = [
    "NativeConsole",
    "find_hsbox_executable",
    "load_local_config",
    "main",
    "save_local_config",
    "start_hsbox",
]


if __name__ == "__main__":
    main()
