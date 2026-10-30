# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

ROOT = Path(SPECPATH).resolve()

a = Analysis(
    [str(ROOT / "desktop_engine.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        (str(ROOT / "cards.json"), "."),
        (str(ROOT / "web"), "web"),
        (str(ROOT / "assets"), "assets"),
        (str(ROOT / "constants"), "constants"),
    ],
    hiddenimports=[
        "web_ui", "FSM_action", "get_screen", "manual_controller", "log_state",
        "power_log", "paddleocr", "paddle", "src.cdp.cdp_client",
        "src.cdp.recommendation_adapter", "src.license.client",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="HSArriverTurboEngine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="HSArriverTurboEngine",
)
