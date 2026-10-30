"""Electron sidecar entry point for the portable client.

The Electron renderer never imports this module.  It starts the existing
web_ui control engine as a local-only service so FSM, Power.log, CDP and
foreground input remain in the Python implementation.
"""

from __future__ import annotations

import sys

import web_ui


if __name__ == "__main__":
    if "--no-browser" not in sys.argv:
        sys.argv.append("--no-browser")
    web_ui.main()
