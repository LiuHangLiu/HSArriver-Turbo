"""Portable EXE entry point for the native Qt desktop client."""

from qt_console import QtConsole, main

from native_console import (
    find_hsbox_executable,
    load_local_config,
    save_local_config,
    start_hsbox,
)

__all__ = [
    "QtConsole",
    "find_hsbox_executable",
    "load_local_config",
    "main",
    "save_local_config",
    "start_hsbox",
]


if __name__ == "__main__":
    main()
