"""Portable Phase-1 launcher: card activation, HSBox start and automation start.

This is intentionally a single-file Tkinter entry point.  It does not install
anything and does not replace the existing FSM.  The launcher writes only
machine-local settings, starts the configured HSBox process, then delegates
the actual game automation to the existing ``web_ui``/``FSM_action`` chain.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import version
from config import CONFIG_PATH
from src.license.client import LicenseClient, LicenseError


ROOT = (Path(sys.executable).resolve().parent
        if getattr(os.sys, "frozen", False)
        else Path(__file__).resolve().parent)
DEFAULT_CDP_PORT = 9222


def _data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(ROOT / "log")
    return Path(base) / "HSArriverTurbo" / "license"


def _load_config() -> dict:
    try:
        value = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def _save_config(value: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp = CONFIG_PATH.with_suffix(CONFIG_PATH.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, CONFIG_PATH)


def find_hsbox_executable(folder: str) -> Path:
    root = Path(folder).expanduser()
    if root.is_file() and root.suffix.lower() == ".exe":
        return root
    if not root.is_dir():
        raise FileNotFoundError("盒子目录不存在")
    preferred = root / "HSAng.exe"
    if preferred.is_file():
        return preferred
    matches = sorted(root.rglob("HSAng.exe"), key=lambda p: len(str(p)))
    if matches:
        return matches[0]
    raise FileNotFoundError("目录内没有找到 HSAng.exe")


def start_hsbox(folder: str, port: int = DEFAULT_CDP_PORT) -> subprocess.Popen:
    executable = find_hsbox_executable(folder)
    arguments = [
        str(executable),
        f"--remote-debugging-port={int(port)}",
        "--remote-debugging-address=127.0.0.1",
    ]
    return subprocess.Popen(arguments, cwd=str(executable.parent))


class Launcher(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"HSArriver Turbo {version.version_label()}")
        self.geometry("720x460")
        self.resizable(False, False)
        self.license_client: LicenseClient | None = None
        self.hsbox_process: subprocess.Popen | None = None
        self.web_ui = None
        self._build_ui()
        self._load_saved_values()
        self._initialize_license()

    def _build_ui(self) -> None:
        frame = ttk.Frame(self, padding=16)
        frame.pack(fill="both", expand=True)
        frame.columnconfigure(1, weight=1)

        self.box_dir = tk.StringVar()
        self.card_code = tk.StringVar()
        self.cdp_port = tk.StringVar(value=str(DEFAULT_CDP_PORT))
        self.license_status = tk.StringVar(value="授权状态：检查中")
        self.output = tk.Text(frame, height=14, width=82, state="disabled")

        ttk.Label(frame, text="炉石盒子目录 / exe").grid(row=0, column=0, sticky="w", pady=5)
        ttk.Entry(frame, textvariable=self.box_dir, width=58).grid(row=0, column=1, sticky="ew", pady=5)
        ttk.Button(frame, text="选择", command=self._choose_box).grid(row=0, column=2, padx=(8, 0))
        ttk.Label(frame, text="CDP 端口").grid(row=1, column=0, sticky="w", pady=5)
        ttk.Entry(frame, textvariable=self.cdp_port, width=12).grid(row=1, column=1, sticky="w", pady=5)
        ttk.Label(frame, text="卡密（必须填写；试用也使用 1 天卡密）").grid(row=2, column=0, sticky="w", pady=5)
        ttk.Entry(frame, textvariable=self.card_code, width=58, show="*").grid(row=2, column=1, sticky="ew", pady=5)
        ttk.Label(frame, textvariable=self.license_status).grid(row=3, column=0, columnspan=3, sticky="w", pady=8)

        buttons = ttk.Frame(frame)
        buttons.grid(row=4, column=0, columnspan=3, sticky="w", pady=(2, 12))
        ttk.Button(buttons, text="激活 / 续期", command=self._activate).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="启动盒子", command=self._start_box).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="开始挂机", command=self._start_automation).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="立即停止", command=self._stop_automation).pack(side="left")

        self.output.grid(row=5, column=0, columnspan=3, sticky="nsew")
        frame.rowconfigure(5, weight=1)

    def _load_saved_values(self) -> None:
        cfg = _load_config()
        recommendation = cfg.get("recommendation") or {}
        self.box_dir.set(str(cfg.get("hsbox_dir") or ""))
        self.cdp_port.set(str(recommendation.get("cdp_port") or DEFAULT_CDP_PORT))

    def _initialize_license(self) -> None:
        try:
            self.license_client = LicenseClient(
                data_dir=_data_dir(), app_version=version.VERSION)
            state = self.license_client.status()
            if state.usable:
                self.license_status.set(
                    f"授权状态：有效（{state.plan or 'active'}，到期时间戳 {state.entitlement_expires_at or '永久'}）")
            else:
                self.license_status.set("授权状态：未激活或已过期")
        except Exception as exc:
            self.license_status.set("授权状态：不可用")
            self._log(f"授权初始化失败：{exc}")

    def _log(self, message: str) -> None:
        if threading.current_thread() is not threading.main_thread():
            self.after(0, self._log, message)
            return
        self.output.configure(state="normal")
        self.output.insert("end", str(message) + "\n")
        self.output.see("end")
        self.output.configure(state="disabled")

    def _choose_box(self) -> None:
        folder = filedialog.askdirectory(title="选择炉石盒子目录")
        if folder:
            self.box_dir.set(folder)

    def _activate(self) -> None:
        if self.license_client is None:
            messagebox.showerror("授权失败", "授权组件未初始化")
            return
        code = self.card_code.get().strip()
        if not code:
            messagebox.showwarning("需要卡密", "必须输入卡密；本项目不提供自动试用。")
            return
        try:
            state = self.license_client.activate(code)
            self.license_status.set(f"授权状态：有效（{state.plan}）")
            self._log("卡密激活成功。")
        except LicenseError as exc:
            self._log(f"卡密激活失败：{exc}")
            messagebox.showerror("授权失败", str(exc))

    def _persist_runtime_config(self) -> None:
        port = int(self.cdp_port.get().strip())
        if not 1 <= port <= 65535:
            raise ValueError("CDP 端口必须在 1-65535 之间")
        cfg = _load_config()
        cfg["hsbox_dir"] = self.box_dir.get().strip()
        recommendation = dict(cfg.get("recommendation") or {})
        recommendation.update({
            "source": "cdp",
            "host": "127.0.0.1",
            "port": port,
            "wait_timeout_seconds": 5.0,
            "target_url_contains": ["hs-web-embed.lushi.163.com/client-jipaiqi"],
        })
        cfg["recommendation"] = recommendation
        _save_config(cfg)
        return port

    def _start_box(self) -> None:
        try:
            port = self._persist_runtime_config()
            if self.hsbox_process is not None and self.hsbox_process.poll() is None:
                self._log("盒子进程已经在运行。")
                return
            self.hsbox_process = start_hsbox(self.box_dir.get().strip(), port)
            self._log(f"已启动盒子：{self.hsbox_process.args[0]}")
        except Exception as exc:
            self._log(f"启动盒子失败：{exc}")
            if threading.current_thread() is threading.main_thread():
                messagebox.showerror("启动失败", str(exc))
            else:
                self.after(0, messagebox.showerror, "启动失败", str(exc))

    def _start_automation(self) -> None:
        def worker() -> None:
            try:
                if self.license_client is None or not self.license_client.status().usable:
                    raise LicenseError("请先使用卡密激活，授权有效后才能挂机。")
                self._persist_runtime_config()
                if self.hsbox_process is None or self.hsbox_process.poll() is not None:
                    self._start_box()
                import web_ui
                self.web_ui = web_ui
                ok, message = web_ui._start_automation(reset_stats=True)
                self._log(message)
                if not ok:
                    raise RuntimeError(message)
            except Exception as exc:
                self._log(f"开始挂机失败：{exc}")
                self.after(0, messagebox.showerror, "开始失败", str(exc))
        threading.Thread(target=worker, daemon=True).start()

    def _stop_automation(self) -> None:
        try:
            if self.web_ui is None:
                self._log("当前没有已启动的自动化控制台。")
                return
            result = self.web_ui.api_stop({})
            self._log(result.get("message") or result.get("error") or str(result))
        except Exception as exc:
            self._log(f"停止失败：{exc}")


def main() -> None:
    Launcher().mainloop()


if __name__ == "__main__":
    main()
