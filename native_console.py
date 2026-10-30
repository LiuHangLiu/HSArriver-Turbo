"""Native single-window control console for the portable EXE.

The legacy web console remains a functional reference, but this module is the
runtime UI for the portable client.  It calls the existing ``web_ui`` service
functions directly, so FSM/Power.log/click/CDP behavior is not duplicated in
the UI layer and no browser is required.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import threading
import time
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from typing import Any, Callable

import version
from config import CONFIG_PATH
from src.license.client import LicenseClient, LicenseError


ROOT = (Path(os.sys.executable).resolve().parent
        if getattr(os.sys, "frozen", False)
        else Path(__file__).resolve().parent)
DEFAULT_CDP_PORT = 9222


def _data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(ROOT / "log")
    return Path(base) / "HSArriverTurbo" / "license"


def load_local_config() -> dict:
    try:
        value = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def save_local_config(value: dict) -> None:
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


class WebUiBridge:
    """Lazy bridge to the existing control functions.

    Keeping the import lazy makes the client open even when an optional OCR
    dependency is missing; the status panel then reports the exact import
    error instead of crashing before the user can inspect configuration.
    """

    def __init__(self) -> None:
        self.module = None
        self.error: str | None = None
        self._lock = threading.Lock()

    def load(self):
        with self._lock:
            if self.module is not None:
                return self.module
            if self.error:
                raise RuntimeError(self.error)
            try:
                import web_ui

                self.module = web_ui
                return web_ui
            except Exception as exc:
                self.error = f"控制引擎加载失败：{type(exc).__name__}: {exc}"
                raise RuntimeError(self.error) from exc

    def call(self, name: str, *args, **kwargs):
        module = self.load()
        function = getattr(module, name)
        return function(*args, **kwargs)

    def status(self) -> dict:
        try:
            return self.call("status_snapshot")
        except Exception as exc:
            return {"ok": False, "error": str(exc), "running": False}

    def logs_after(self, seq: int) -> tuple[list[dict], int]:
        try:
            lines, max_seq = self.call("take_logs_after", seq)
            return list(lines), int(max_seq)
        except Exception:
            return [], seq


class LogFilterModel:
    """Classify engine entries for user-selectable display filters."""

    DEFAULTS = {
        "operation": True,
        "recommendation": True,
        "cdp": False,
        "power": False,
        "debug": False,
    }

    def __init__(self, enabled: dict[str, bool] | None = None) -> None:
        self.enabled = dict(self.DEFAULTS)
        if enabled:
            self.enabled.update({key: bool(value) for key, value in enabled.items()})

    @staticmethod
    def category(entry: dict) -> str:
        text = str(entry.get("msg") or "")
        level = str(entry.get("level") or "").upper()
        lowered = text.lower()
        if any(token in lowered for token in (
            "cdp", "raw_args", "onupdateladder", "onupdatearena", "原始 json",
        )):
            return "cdp"
        if "power.log" in lowered or "power log" in lowered:
            return "power"
        if level == "DEBUG" or "[ocr]" in lowered or "调试" in text:
            return "debug"
        if any(token in lowered for token in (
            "[推荐]", "推荐", "recommend", "actionname", "play_minion",
            "play_special", "end_turn", "replace", "hero_skill",
        )):
            return "recommendation"
        return "operation"

    def accepts(self, entry: dict) -> bool:
        return bool(self.enabled.get(self.category(entry), False))


class NativeConsole(tk.Tk):
    """The complete native client window used by the portable EXE."""

    NAV_ITEMS = (
        ("overview", "概览"),
        ("control", "挂机控制"),
        ("surrender", "投降规则"),
        ("rank", "段位目标"),
        ("human", "人性化"),
        ("delays", "延迟设置"),
        ("calibration", "校准"),
        ("logs", "日志与自检"),
    )

    COLORS = {
        "bg": "#171a21",
        "panel": "#202735",
        "panel2": "#283142",
        "text": "#eef1f6",
        "muted": "#aeb8c7",
        "gold": "#d8a84e",
        "green": "#39b979",
        "red": "#d95c5c",
        "blue": "#5b9bd5",
    }

    def __init__(self) -> None:
        super().__init__()
        self.title(f"HSArriver Turbo {version.version_label()}")
        self.geometry("1280x820")
        self.minsize(1080, 700)
        self.configure(bg=self.COLORS["bg"])
        self.bridge = WebUiBridge()
        self.license_client: LicenseClient | None = None
        self.hsbox_process: subprocess.Popen | None = None
        self.vars: dict[str, tk.Variable] = {}
        self.pages: dict[str, tk.Frame] = {}
        self.log_model = LogFilterModel()
        self.log_seq = 0
        self._polling = True
        self._build_styles()
        self._build_shell()
        self._build_pages()
        self._load_saved_values()
        self._initialize_license()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(700, self._poll_status)
        self.after(500, self._poll_logs)

    def _build_styles(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TFrame", background=self.COLORS["bg"])
        style.configure("Panel.TFrame", background=self.COLORS["panel"])
        style.configure("TLabel", background=self.COLORS["bg"], foreground=self.COLORS["text"])
        style.configure("Muted.TLabel", background=self.COLORS["bg"], foreground=self.COLORS["muted"])
        style.configure("Panel.TLabel", background=self.COLORS["panel"], foreground=self.COLORS["text"])
        style.configure("Title.TLabel", background=self.COLORS["bg"], foreground=self.COLORS["text"], font=("Microsoft YaHei UI", 18, "bold"))
        style.configure("Card.TLabel", background=self.COLORS["panel2"], foreground=self.COLORS["text"], padding=10)
        style.configure("TButton", padding=(10, 6))
        style.configure("Gold.TButton", background=self.COLORS["gold"], foreground="#161616")
        style.configure("Danger.TButton", background=self.COLORS["red"], foreground="#ffffff")
        style.configure("Success.TButton", background=self.COLORS["green"], foreground="#ffffff")
        style.configure("TCheckbutton", background=self.COLORS["bg"], foreground=self.COLORS["text"])
        style.configure("Panel.TCheckbutton", background=self.COLORS["panel"], foreground=self.COLORS["text"])
        style.configure("TNotebook", background=self.COLORS["bg"])
        style.configure("TEntry", fieldbackground="#11151c", foreground=self.COLORS["text"])
        style.configure("TCombobox", fieldbackground="#11151c", foreground=self.COLORS["text"])

    def _build_shell(self) -> None:
        header = ttk.Frame(self, padding=(18, 12))
        header.pack(fill="x")
        ttk.Label(header, text="HSArriver Turbo", style="Title.TLabel").pack(side="left")
        self.vars["header_status"] = tk.StringVar(value="未连接")
        ttk.Label(header, textvariable=self.vars["header_status"], style="Muted.TLabel").pack(side="left", padx=20)
        ttk.Button(header, text="启动盒子", command=self._start_box).pack(side="right", padx=4)
        ttk.Button(header, text="开始挂机", style="Success.TButton", command=self._start_automation).pack(side="right", padx=4)
        ttk.Button(header, text="立即停止", style="Danger.TButton", command=self._stop_automation).pack(side="right", padx=4)

        body = ttk.Frame(self)
        body.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        body.columnconfigure(1, weight=1)
        body.columnconfigure(2, weight=0)
        body.rowconfigure(0, weight=1)

        self.nav = tk.Listbox(body, width=16, exportselection=False, bg=self.COLORS["panel"], fg=self.COLORS["text"], selectbackground=self.COLORS["gold"], selectforeground="#161616", highlightthickness=0, relief="flat", activestyle="none", font=("Microsoft YaHei UI", 11))
        self.nav.grid(row=0, column=0, sticky="nsw", padx=(0, 12))
        for _, label in self.NAV_ITEMS:
            self.nav.insert("end", label)
        self.nav.bind("<<ListboxSelect>>", self._select_page)
        self.nav.selection_set(0)

        self.content = ttk.Frame(body)
        self.content.grid(row=0, column=1, sticky="nsew")
        self.content.columnconfigure(0, weight=1)
        self.content.rowconfigure(0, weight=1)

        log_panel = ttk.Frame(body, style="Panel.TFrame", padding=10)
        log_panel.grid(row=0, column=2, sticky="nsew", padx=(12, 0))
        log_panel.configure(width=355)
        ttk.Label(log_panel, text="实时日志", style="Panel.TLabel", font=("Microsoft YaHei UI", 13, "bold")).pack(anchor="w")
        filter_frame = ttk.Frame(log_panel, style="Panel.TFrame")
        filter_frame.pack(fill="x", pady=(8, 4))
        labels = (("operation", "操作日志"), ("recommendation", "推荐日志"), ("cdp", "CDP 原始 JSON"), ("power", "Power.log"), ("debug", "调试日志"))
        for key, label in labels:
            var = tk.BooleanVar(value=self.log_model.enabled[key])
            self.vars[f"log_{key}"] = var
            ttk.Checkbutton(filter_frame, text=label, variable=var, style="Panel.TCheckbutton", command=lambda k=key, v=var: self._set_log_filter(k, v)).pack(anchor="w")
        self.log_text = tk.Text(log_panel, width=42, height=30, bg="#10141b", fg=self.COLORS["text"], insertbackground=self.COLORS["text"], relief="flat", wrap="word", state="disabled")
        self.log_text.pack(fill="both", expand=True, pady=(4, 0))

        self.status_bar = ttk.Label(self, text="就绪", style="Muted.TLabel", anchor="w", padding=(14, 5))
        self.status_bar.pack(fill="x")

    def _build_pages(self) -> None:
        for key, _ in self.NAV_ITEMS:
            page = ttk.Frame(self.content, padding=8)
            page.grid(row=0, column=0, sticky="nsew")
            self.pages[key] = page
        self._build_overview(self.pages["overview"])
        self._build_control(self.pages["control"])
        self._build_surrender(self.pages["surrender"])
        self._build_rank(self.pages["rank"])
        self._build_human(self.pages["human"])
        self._build_delays(self.pages["delays"])
        self._build_calibration(self.pages["calibration"])
        self._build_logs(self.pages["logs"])
        self.pages["overview"].tkraise()

    def _panel(self, parent, title: str) -> ttk.Frame:
        frame = ttk.Frame(parent, style="Panel.TFrame", padding=14)
        frame.pack(fill="x", pady=(0, 12))
        ttk.Label(frame, text=title, style="Panel.TLabel", font=("Microsoft YaHei UI", 12, "bold")).pack(anchor="w", pady=(0, 10))
        return frame

    def _entry(self, parent, key: str, label: str, default="", width=28, show=None) -> tk.Entry:
        row = ttk.Frame(parent, style="Panel.TFrame")
        row.pack(fill="x", pady=3)
        ttk.Label(row, text=label, style="Panel.TLabel", width=22).pack(side="left")
        var = tk.StringVar(value=str(default))
        self.vars[key] = var
        entry = ttk.Entry(row, textvariable=var, width=width, show=show)
        entry.pack(side="left", fill="x", expand=True)
        return entry

    def _check(self, parent, key: str, label: str, default=False, command=None) -> tk.BooleanVar:
        var = tk.BooleanVar(value=default)
        self.vars[key] = var
        ttk.Checkbutton(parent, text=label, variable=var, style="Panel.TCheckbutton", command=command).pack(anchor="w", pady=3)
        return var

    def _build_overview(self, page) -> None:
        ttk.Label(page, text="运行概览", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        cards = ttk.Frame(page)
        cards.pack(fill="x")
        for index, (key, label) in enumerate((("license", "授权状态"), ("box", "盒子状态"), ("cdp", "CDP 状态"), ("hearthstone", "炉石状态"))):
            cards.columnconfigure(index, weight=1)
            var = tk.StringVar(value=label + "\n检查中")
            self.vars[f"card_{key}"] = var
            ttk.Label(cards, textvariable=var, style="Card.TLabel", justify="left").grid(row=0, column=index, sticky="ew", padx=4)
        panel = self._panel(page, "快速配置")
        self._entry(panel, "box_dir", "炉石盒子目录 / exe")
        ttk.Button(panel, text="选择", command=self._choose_box).pack(anchor="e", pady=(0, 4))
        self._entry(panel, "cdp_port", "CDP 端口", DEFAULT_CDP_PORT, width=12)
        self._entry(panel, "card_code", "卡密", "", show="*")
        buttons = ttk.Frame(panel, style="Panel.TFrame")
        buttons.pack(fill="x", pady=(8, 0))
        ttk.Button(buttons, text="激活 / 续期", command=self._activate).pack(side="left", padx=(0, 6))
        ttk.Button(buttons, text="保存配置", command=self._save_runtime_config).pack(side="left")
        stats = self._panel(page, "本轮统计")
        for key, label in (("games", "对局"), ("wins", "胜利"), ("concedes", "投降"), ("win_rate", "胜率"), ("state", "当前阶段")):
            var = tk.StringVar(value="-")
            self.vars[f"stat_{key}"] = var
            ttk.Label(stats, text=f"{label}：", style="Panel.TLabel").pack(side="left", padx=(0, 4))
            ttk.Label(stats, textvariable=var, style="Panel.TLabel").pack(side="left", padx=(0, 18))

    def _build_control(self, page) -> None:
        ttk.Label(page, text="挂机控制", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        base = self._panel(page, "基础配置")
        self._entry(base, "name", "战网用户 ID")
        self._entry(base, "log_root", "炉石日志目录")
        base_buttons = ttk.Frame(base, style="Panel.TFrame")
        base_buttons.pack(fill="x")
        ttk.Button(base_buttons, text="选择日志目录", command=self._choose_log_root).pack(side="left")
        ttk.Button(base_buttons, text="检测日志目录", command=self._check_log).pack(side="left", padx=6)
        actions = self._panel(page, "运行操作")
        for label, command in (("准备游戏", self._prepare), ("开始挂机", self._start_automation), ("本局结束后停止", self._stop_after_game), ("立即停止", self._stop_automation), ("急停当前动作", self._cancel)):
            ttk.Button(actions, text=label, command=command).pack(side="left", padx=(0, 6))
        self._check(actions, "overlay_enabled", "显示日志浮窗")
        ttk.Button(actions, text="切换浮窗", command=self._toggle_overlay).pack(side="left", padx=(10, 0))
        health = self._panel(page, "存活检测与看门狗")
        self._check(health, "liveness_enabled", "启用炉石存活检测", True)
        self._entry(health, "liveness_warn", "Power.log 告警秒数", 120)
        self._entry(health, "liveness_stop", "Power.log 停止秒数", 300)
        self._check(health, "watchdog_enabled", "启用中断重启看门狗", False)
        self._entry(health, "watchdog_stale", "看门狗停滞秒数", 300)
        self._entry(health, "watchdog_restarts", "窗口内最大重启次数", 3)
        ttk.Button(health, text="保存监控设置", command=self._save_health).pack(anchor="e", pady=(6, 0))
        schedule = self._panel(page, "定时任务")
        self._entry(schedule, "schedule_start", "开始时间（ISO）", "")
        self._entry(schedule, "schedule_end", "结束时间（可选）", "")
        schedule_buttons = ttk.Frame(schedule, style="Panel.TFrame")
        schedule_buttons.pack(fill="x", pady=(6, 0))
        ttk.Button(schedule_buttons, text="保存定时任务", command=self._save_schedule).pack(side="left")
        ttk.Button(schedule_buttons, text="取消计划", command=self._cancel_schedule).pack(side="left", padx=6)
        manual = self._panel(page, "手动进入对战与辅助操作")
        self._entry(manual, "deck_index", "卡组编号（1-9，可空）", "")
        self._entry(manual, "enter_timeout", "进入对战超时（秒）", 180)
        self._check(manual, "click_start", "进入对战后点击开始", False)
        manual_buttons = ttk.Frame(manual, style="Panel.TFrame")
        manual_buttons.pack(fill="x", pady=4)
        ttk.Button(manual_buttons, text="进入对战", command=self._enter_battle).pack(side="left")
        ttk.Button(manual_buttons, text="快速选卡组", command=self._deck_click).pack(side="left", padx=6)
        ttk.Button(manual_buttons, text="手动投降", command=self._concede_now).pack(side="left", padx=6)
        ttk.Button(manual_buttons, text="确认后重启炉石", command=self._restart_hearthstone).pack(side="left", padx=6)
        mode_row = ttk.Frame(manual, style="Panel.TFrame")
        mode_row.pack(fill="x", pady=4)
        ttk.Label(mode_row, text="对战模式", style="Panel.TLabel", width=22).pack(side="left")
        self.vars["mode"] = tk.StringVar(value="standard")
        ttk.Combobox(mode_row, textvariable=self.vars["mode"], values=("standard", "wild", "casual"), state="readonly", width=20).pack(side="left")
        ttk.Button(mode_row, text="切换模式", command=self._mode_click).pack(side="left", padx=6)

    def _build_surrender(self, page) -> None:
        ttk.Label(page, text="投降规则", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        ai = self._panel(page, "AI 胜率自动投降")
        self._check(ai, "concede_enabled", "启用自动投降")
        self._entry(ai, "concede_threshold", "胜率阈值（%）", 10)
        self._entry(ai, "concede_rounds", "连续低胜率回合数", 3)
        ttk.Button(ai, text="保存自动投降", command=self._save_concede).pack(anchor="e")
        decks = self._panel(page, "卡组识别投降")
        self._check(decks, "surrender_enabled", "启用卡组识别投降")
        ttk.Label(decks, text="配置 JSON（与原有 auto_surrender 结构一致）", style="Panel.TLabel").pack(anchor="w")
        search_row = ttk.Frame(decks, style="Panel.TFrame")
        search_row.pack(fill="x", pady=(4, 2))
        self.vars["card_search"] = tk.StringVar()
        ttk.Entry(search_row, textvariable=self.vars["card_search"], width=30).pack(side="left")
        ttk.Button(search_row, text="搜索卡牌", command=self._search_card).pack(side="left", padx=6)
        self.vars["card_search_result"] = tk.StringVar(value="输入中文卡名后搜索候选 ID")
        ttk.Label(decks, textvariable=self.vars["card_search_result"], style="Panel.TLabel", wraplength=760).pack(anchor="w")
        self.surrender_json = tk.Text(decks, height=16, bg="#10141b", fg=self.COLORS["text"], insertbackground=self.COLORS["text"], relief="flat")
        self.surrender_json.pack(fill="both", expand=True, pady=6)
        ttk.Button(decks, text="保存卡组投降规则", command=self._save_surrender).pack(anchor="e")

    def _build_rank(self, page) -> None:
        ttk.Label(page, text="段位目标", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        panel = self._panel(page, "段位目标设置")
        self._check(panel, "rank_enabled", "启用段位目标")
        self._entry(panel, "rank_number", "目标传说名次", 1)
        row = ttk.Frame(panel, style="Panel.TFrame")
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="达到条件后的处理", style="Panel.TLabel", width=22).pack(side="left")
        self.vars["rank_action"] = tk.StringVar(value="stop")
        ttk.Combobox(row, textvariable=self.vars["rank_action"], values=("stop", "keep"), state="readonly", width=22).pack(side="left")
        row2 = ttk.Frame(panel, style="Panel.TFrame")
        row2.pack(fill="x", pady=4)
        ttk.Label(row2, text="停止方式", style="Panel.TLabel", width=22).pack(side="left")
        self.vars["rank_mode"] = tk.StringVar(value="legend")
        ttk.Combobox(row2, textvariable=self.vars["rank_mode"], values=("legend", "legend_number"), state="readonly", width=22).pack(side="left")
        ttk.Button(panel, text="保存段位目标", command=self._save_rank).pack(anchor="e", pady=(8, 0))
        self.vars["rank_state"] = tk.StringVar(value="当前段位状态：等待自检")
        ttk.Label(page, textvariable=self.vars["rank_state"], style="Muted.TLabel").pack(anchor="w")

    def _build_human(self, page) -> None:
        ttk.Label(page, text="人性化设置", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        panel = self._panel(page, "人性化操作")
        self._check(panel, "human_enabled", "启用人性化操作")
        self._check(panel, "hand_hover", "看卡牌 / 随机操作后延时", True)
        self._check(panel, "minion_hover", "看对手随从", True)
        for key, label, default in (("post_min", "操作后延时最小值", .5), ("post_max", "操作后延时最大值", 3.0), ("hover_min", "手牌悬停最小值", .2), ("hover_max", "手牌悬停最大值", 1.0), ("minion_min", "随从悬停最小值", .2), ("minion_max", "随从悬停最大值", 1.5)):
            self._entry(panel, key, label + "（秒）", default)
        ttk.Button(panel, text="保存人性化设置", command=self._save_human).pack(anchor="e", pady=(8, 0))

    def _build_delays(self, page) -> None:
        ttk.Label(page, text="延迟设置", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        panel = self._panel(page, "推荐与操作时序")
        self.delay_fields = (
            ("mulligan_ready_delay_seconds", "换牌界面准备"),
            ("mulligan_post_ocr_delay_seconds", "换牌识别后"),
            ("mulligan_retry_delay_seconds", "换牌重试"),
            ("first_turn_per_card_delay_seconds", "首回合每张牌"),
            ("pre_action_delay_seconds", "动作前"),
            ("post_action_delay_seconds", "动作后"),
            ("draw_extra_delay_per_card_seconds", "抽牌额外"),
            ("discover_target_delay_seconds", "发现 / 抉择目标"),
            ("ocr_preprocess_scale", "OCR 预处理缩放"),
        )
        for key, label in self.delay_fields:
            self._entry(panel, key, label, "")
        ttk.Button(panel, text="保存延迟设置", command=self._save_delays).pack(anchor="e", pady=(8, 0))

    def _build_calibration(self, page) -> None:
        ttk.Label(page, text="校准", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        panel = self._panel(page, "校准与界面识别")
        ttk.Label(panel, text="校准窗口会操作当前炉石界面；开始前请确认炉石在前台。", style="Panel.TLabel").pack(anchor="w", pady=(0, 8))
        targets = ("", "recommendation_roi", "mulligan_recommendation_roi", "mulligan_confirm_roi", "ai_win_rate_roi", "ai_win_rate_wide_roi", "post_game_start_roi", "post_game_rank_roi", "main_menu_battle_roi", "deck_select_title_roi", "deck_grid_roi", "mode_menu_open", "mode_wild", "mode_standard", "mode_casual")
        self.vars["calibration_target"] = tk.StringVar(value="")
        ttk.Combobox(panel, textvariable=self.vars["calibration_target"], values=targets, state="readonly", width=30).pack(side="left")
        ttk.Button(panel, text="打开校准窗口", command=self._calibrate).pack(side="left", padx=6)
        ttk.Button(panel, text="区域预览", command=self._regions).pack(side="left", padx=6)
        ttk.Button(panel, text="识别当前界面", command=self._ui_state).pack(side="left", padx=6)
        learn = self._panel(page, "模板学习")
        self.vars["learn_kind"] = tk.StringVar(value="all")
        ttk.Combobox(learn, textvariable=self.vars["learn_kind"], values=("all", "main_menu", "deck_select", "start"), state="readonly", width=20).pack(side="left")
        ttk.Button(learn, text="从当前画面重学模板", command=self._learn_template).pack(side="left", padx=6)
        self.vars["calibration_result"] = tk.StringVar(value="尚未执行校准操作")
        ttk.Label(page, textvariable=self.vars["calibration_result"], style="Muted.TLabel", wraplength=760).pack(anchor="w")

    def _build_logs(self, page) -> None:
        ttk.Label(page, text="日志与自检", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        panel = self._panel(page, "诊断操作")
        ttk.Button(panel, text="重新自检", command=self._selfcheck).pack(side="left", padx=(0, 6))
        ttk.Button(panel, text="导出本次诊断包", command=self._export_feedback).pack(side="left", padx=6)
        ttk.Button(panel, text="清空显示", command=self._clear_logs).pack(side="left", padx=6)
        self.vars["selfcheck_result"] = tk.StringVar(value="尚未执行自检")
        ttk.Label(page, textvariable=self.vars["selfcheck_result"], style="Muted.TLabel", wraplength=800).pack(anchor="w", pady=10)
        info = self._panel(page, "日志说明")
        ttk.Label(info, text="右侧日志面板支持按类别勾选显示；关闭某类显示不会停止写入本地结构化日志。", style="Panel.TLabel", wraplength=800).pack(anchor="w")

    def _load_saved_values(self) -> None:
        cfg = load_local_config()
        recommendation = cfg.get("recommendation") or {}
        for key, value in (("box_dir", cfg.get("hsbox_dir") or ""), ("cdp_port", recommendation.get("port") or DEFAULT_CDP_PORT), ("name", cfg.get("name") or ""), ("log_root", cfg.get("log_root") or "")):
            if key in self.vars:
                self.vars[key].set(str(value))
        self._load_config_to_controls(cfg)

    def _load_config_to_controls(self, cfg: dict) -> None:
        ac = cfg.get("auto_concede") or {}
        for key, value in (("concede_enabled", ac.get("enabled", False)), ("concede_threshold", ac.get("threshold", 10)), ("concede_rounds", ac.get("rounds", 3))):
            if key in self.vars:
                self.vars[key].set(value)
        rank = cfg.get("rank_stop") or {}
        for key, value in (("rank_enabled", rank.get("enabled", False)), ("rank_number", rank.get("legend_number", 1)), ("rank_action", rank.get("action", "stop")), ("rank_mode", rank.get("mode", "legend"))):
            if key in self.vars:
                self.vars[key].set(value)
        human = cfg.get("human_like") or {}
        for key, value in (("human_enabled", human.get("enabled", False)), ("hand_hover", human.get("hand_hover_enabled", True)), ("minion_hover", human.get("minion_hover_enabled", True)), ("post_min", human.get("post_delay_min", .5)), ("post_max", human.get("post_delay_max", 3.0)), ("hover_min", human.get("hover_min", .2)), ("hover_max", human.get("hover_max", 1.0)), ("minion_min", human.get("minion_hover_min", .2)), ("minion_max", human.get("minion_hover_max", 1.5))):
            if key in self.vars:
                self.vars[key].set(value)
        liveness = cfg.get("liveness") or {}
        for key, value in (("liveness_enabled", liveness.get("enabled", True)), ("liveness_warn", liveness.get("log_stale_warn_seconds", 120)), ("liveness_stop", liveness.get("log_stale_stop_seconds", 300))):
            if key in self.vars:
                self.vars[key].set(value)
        watchdog = cfg.get("watchdog") or {}
        for key, value in (("watchdog_enabled", watchdog.get("enabled", False)), ("watchdog_stale", watchdog.get("stale_seconds", 300)), ("watchdog_restarts", watchdog.get("max_restarts", 3))):
            if key in self.vars:
                self.vars[key].set(value)
        surrender = cfg.get("auto_surrender") or {"enabled": False, "aliases": {}, "decks": []}
        if hasattr(self, "surrender_json"):
            self.vars["surrender_enabled"].set(bool(surrender.get("enabled")))
            self.surrender_json.delete("1.0", "end")
            self.surrender_json.insert("1.0", json.dumps(surrender, ensure_ascii=False, indent=2))
        delays = cfg.get("delays") or {}
        for key, value in delays.items():
            if key in self.vars:
                self.vars[key].set(value)

    def _initialize_license(self) -> None:
        try:
            self.license_client = LicenseClient(data_dir=_data_dir(), app_version=version.VERSION)
            self._refresh_license()
        except Exception as exc:
            self._set_license_text(f"授权初始化失败：{exc}")

    def _refresh_license(self) -> None:
        if not self.license_client:
            return
        try:
            state = self.license_client.status()
            if state.usable:
                text = f"有效（{state.plan or 'active'}，到期 {state.entitlement_expires_at or '永久'}）"
            else:
                text = "未激活或已过期"
        except Exception as exc:
            text = f"不可用：{exc}"
        self._set_license_text(text)

    def _set_license_text(self, text: str) -> None:
        if "card_license" in self.vars:
            self.vars["card_license"].set(f"授权状态\n{text}")

    def _log(self, message: str) -> None:
        self._append_log({"t": time.strftime("%H:%M:%S"), "level": "SYS", "msg": str(message)})

    def _append_log(self, entry: dict) -> None:
        if not self.log_model.accepts(entry):
            return
        line = f"[{entry.get('t', '--:--:--')}] [{entry.get('level', 'INFO')}] {entry.get('msg', '')}\n"
        self.log_text.configure(state="normal")
        self.log_text.insert("end", line)
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _set_log_filter(self, key: str, variable: tk.BooleanVar) -> None:
        self.log_model.enabled[key] = bool(variable.get())

    def _select_page(self, _event=None) -> None:
        selected = self.nav.curselection()
        if selected:
            self.pages[self.NAV_ITEMS[selected[0]][0]].tkraise()

    def _choose_box(self) -> None:
        selected = filedialog.askdirectory(title="选择炉石盒子目录")
        if selected:
            self.vars["box_dir"].set(selected)

    def _choose_log_root(self) -> None:
        selected = filedialog.askdirectory(title="选择炉石 Logs 目录")
        if selected:
            self.vars["log_root"].set(selected)

    def _check_log(self) -> None:
        try:
            result = self.bridge.call("check_log_dir", self.vars["log_root"].get())
            self._show_result(result)
        except Exception as exc:
            self._show_error("日志目录检测失败", exc)

    def _persist_runtime_config(self) -> int:
        port = int(str(self.vars["cdp_port"].get()).strip())
        if not 1 <= port <= 65535:
            raise ValueError("CDP 端口必须在 1-65535 之间")
        cfg = load_local_config()
        cfg["hsbox_dir"] = str(self.vars["box_dir"].get()).strip()
        recommendation = dict(cfg.get("recommendation") or {})
        recommendation.update({"source": "cdp", "host": "127.0.0.1", "port": port, "wait_timeout_seconds": 5.0, "target_url_contains": ["hs-web-embed.lushi.163.com/client-jipaiqi"]})
        cfg["recommendation"] = recommendation
        save_local_config(cfg)
        return port

    def _save_runtime_config(self) -> None:
        try:
            self._persist_runtime_config()
            result = self.bridge.call("api_save_config", {"name": self.vars["name"].get(), "log_root": self.vars["log_root"].get()})
            self._show_result(result)
        except Exception as exc:
            self._show_error("保存配置失败", exc)

    def _activate(self) -> None:
        code = str(self.vars.get("card_code", tk.StringVar()).get()).strip()
        if not self.license_client:
            self._show_error("授权失败", "授权组件未初始化")
            return
        if not code:
            self._show_error("授权失败", "必须输入卡密；试用也使用卡密激活。")
            return
        try:
            state = self.license_client.activate(code)
            self._set_license_text(f"有效（{state.plan}）")
            self._log("卡密激活成功。")
        except LicenseError as exc:
            self._show_error("授权失败", exc)

    def _start_box(self) -> bool:
        try:
            port = self._persist_runtime_config()
            if self.hsbox_process is not None and self.hsbox_process.poll() is None:
                self._log("盒子进程已经在运行。")
                return
            self.hsbox_process = start_hsbox(self.vars["box_dir"].get().strip(), port)
            self._log(f"已启动盒子：{self.hsbox_process.args[0]}")
            return True
        except Exception as exc:
            self._show_error("启动盒子失败", exc)
            return False

    def _start_automation(self) -> None:
        try:
            if not self.license_client or not self.license_client.status().usable:
                raise LicenseError("请先使用卡密激活，授权有效后才能挂机。")
            self._persist_runtime_config()
            if self.hsbox_process is None or self.hsbox_process.poll() is not None:
                if not self._start_box():
                    return
        except Exception as exc:
            self._show_error("开始挂机失败", exc)
            return

        def worker():
            try:
                result = self.bridge.call("api_start", {})
                self.after(0, self._show_result, result)
            except Exception as exc:
                self.after(0, self._show_error, "开始挂机失败", exc)
        threading.Thread(target=worker, daemon=True).start()

    def _prepare(self) -> None:
        self._run_api("api_prepare", {})

    def _stop_after_game(self) -> None:
        self._run_api("api_stop", {"mode": "after_game"})

    def _stop_automation(self) -> None:
        self._run_api("api_stop", {"mode": "now"})

    def _cancel(self) -> None:
        self._run_api("api_cancel", {"source": "desktop"})

    def _save_schedule(self) -> None:
        self._run_api("api_schedule", {"start": self.vars["schedule_start"].get(), "end": self.vars["schedule_end"].get()})

    def _cancel_schedule(self) -> None:
        self._run_api("api_cancel_schedule")

    def _enter_battle(self) -> None:
        body = {"deck_index": self.vars["deck_index"].get(), "timeout": self.vars["enter_timeout"].get(), "click_start": self.vars["click_start"].get()}
        self._run_api("api_enter_battle", body)

    def _deck_click(self) -> None:
        self._run_api("api_deck_click", {"index": self.vars["deck_index"].get()})

    def _mode_click(self) -> None:
        self._run_api("api_mode_click", {"mode": self.vars["mode"].get()})

    def _concede_now(self) -> None:
        self._run_api("api_concede_now", {})

    def _restart_hearthstone(self) -> None:
        if not messagebox.askyesno("确认重启炉石", "此操作会结束炉石进程并清理日志目录，确定继续吗？", parent=self):
            return
        self._run_api("api_restart_hearthstone", {"confirm": True})

    def _toggle_overlay(self) -> None:
        self._run_api("api_toggle_overlay", {})

    def _save_concede(self) -> None:
        self._run_api("api_save_concede", {"enabled": self.vars["concede_enabled"].get(), "threshold": self.vars["concede_threshold"].get(), "rounds": self.vars["concede_rounds"].get()})

    def _save_surrender(self) -> None:
        try:
            raw = json.loads(self.surrender_json.get("1.0", "end"))
            raw["enabled"] = bool(self.vars["surrender_enabled"].get())
        except Exception as exc:
            self._show_error("规则 JSON 无效", exc)
            return
        self._run_api("api_save_surrender_rules", {"config": raw, "confirm": True})

    def _search_card(self) -> None:
        try:
            result = self.bridge.call("api_card_search", self.vars["card_search"].get(), 8)
            cards = result.get("cards") or []
            if cards:
                text = "；".join(f"{card.get('name') or card.get('cardName')} ({','.join(card.get('ids') or [card.get('id', '')])})" for card in cards)
            else:
                text = "没有找到匹配卡牌"
            self.vars["card_search_result"].set(text)
        except Exception as exc:
            self._show_error("卡牌搜索失败", exc)

    def _save_rank(self) -> None:
        self._run_api("api_save_rank_stop", {"enabled": self.vars["rank_enabled"].get(), "legend_number": self.vars["rank_number"].get(), "action": self.vars["rank_action"].get(), "mode": self.vars["rank_mode"].get()})

    def _save_human(self) -> None:
        self._run_api("api_save_human_like", {"enabled": self.vars["human_enabled"].get(), "hand_hover_enabled": self.vars["hand_hover"].get(), "minion_hover_enabled": self.vars["minion_hover"].get(), "post_delay_min": self.vars["post_min"].get(), "post_delay_max": self.vars["post_max"].get(), "hover_min": self.vars["hover_min"].get(), "hover_max": self.vars["hover_max"].get(), "minion_hover_min": self.vars["minion_min"].get(), "minion_hover_max": self.vars["minion_max"].get()})

    def _save_delays(self) -> None:
        body = {key: self.vars[key].get() for key, _ in self.delay_fields}
        self._run_api("api_save_delays", body)

    def _save_health(self) -> None:
        self._run_api("api_save_liveness", {"enabled": self.vars["liveness_enabled"].get(), "log_stale_warn_seconds": self.vars["liveness_warn"].get(), "log_stale_stop_seconds": self.vars["liveness_stop"].get()})
        self._run_api("api_watchdog", {"enabled": self.vars["watchdog_enabled"].get(), "stale_seconds": self.vars["watchdog_stale"].get(), "max_restarts": self.vars["watchdog_restarts"].get()})

    def _calibrate(self) -> None:
        result = self._call_api("api_calibrate", {"target": self.vars["calibration_target"].get()})
        if result:
            self.vars["calibration_result"].set(result.get("message") or result.get("error") or str(result))

    def _regions(self) -> None:
        result = self._call_api("api_regions")
        if result:
            self.vars["calibration_result"].set(result.get("message") or result.get("error") or "区域预览已生成")

    def _ui_state(self) -> None:
        result = self._call_api("api_ui_state")
        if result:
            self.vars["calibration_result"].set(result.get("state_label") or result.get("error") or str(result))

    def _learn_template(self) -> None:
        result = self._call_api("api_ui_learn", {"kind": self.vars["learn_kind"].get()})
        if result:
            self.vars["calibration_result"].set(result.get("message") or result.get("error") or str(result))

    def _selfcheck(self) -> None:
        result = self._call_api("api_selfcheck", True)
        if result:
            check = result.get("result") or result
            self.vars["selfcheck_result"].set(check.get("summary") or check.get("error") or str(check))

    def _export_feedback(self) -> None:
        self._run_api("api_feedback_export", {})

    def _clear_logs(self) -> None:
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")

    def _call_api(self, name: str, *args) -> dict | None:
        try:
            return self.bridge.call(name, *args)
        except Exception as exc:
            if threading.current_thread() is threading.main_thread():
                self._show_error("操作失败", exc)
                return None
            raise

    def _run_api(self, name: str, *args) -> None:
        def worker():
            try:
                result = self.bridge.call(name, *args)
            except Exception as exc:
                self.after(0, self._show_error, "操作失败", exc)
                return
            self.after(0, self._show_result, result)
        threading.Thread(target=worker, daemon=True).start()

    def _show_result(self, result: Any) -> None:
        if isinstance(result, dict):
            message = result.get("message") or result.get("error") or ("操作成功" if result.get("ok") else str(result))
        else:
            message = str(result)
        self.status_bar.configure(text=message)
        self._log(message)

    def _show_error(self, title: str, error: Any) -> None:
        message = str(error)
        self.status_bar.configure(text=message)
        self._log(message)
        if self.winfo_exists():
            messagebox.showerror(title, message, parent=self)

    def _poll_status(self) -> None:
        if not self._polling:
            return
        status = self.bridge.status()
        if status.get("error"):
            self.vars["header_status"].set("控制引擎未连接")
            self.vars["card_hearthstone"].set("炉石状态\n未连接")
        else:
            running = bool(status.get("running"))
            phase = status.get("state_label") or status.get("phase") or "待机"
            self.vars["header_status"].set("运行中" if running else "待机")
            self.vars["card_hearthstone"].set(f"炉石状态\n{phase}")
            self.vars["card_cdp"].set("CDP 状态\n已启用" if load_local_config().get("recommendation", {}).get("source") == "cdp" else "CDP 状态\n未启用")
            self.vars["stat_games"].set(str(status.get("games", 0)))
            self.vars["stat_wins"].set(str(status.get("wins", 0)))
            self.vars["stat_concedes"].set(str(status.get("concede_count", 0)))
            self.vars["stat_win_rate"].set(f"{status.get('win_rate', 0)}%")
            self.vars["stat_state"].set(str(status.get("state_label") or "待机"))
            self.vars["rank_state"].set(f"当前段位状态：{status.get('rank_stop', {}).get('stop_reason') or '未触发'}")
        if "box_dir" in self.vars:
            running = self.hsbox_process is not None and self.hsbox_process.poll() is None
            self.vars["card_box"].set("盒子状态\n运行中" if running else "盒子状态\n未启动")
        self.after(1200, self._poll_status)

    def _poll_logs(self) -> None:
        if not self._polling:
            return
        lines, seq = self.bridge.logs_after(self.log_seq)
        self.log_seq = seq
        for entry in lines:
            self._append_log(entry)
        self.after(500, self._poll_logs)

    def _on_close(self) -> None:
        self._polling = False
        self.destroy()


def main() -> None:
    NativeConsole().mainloop()


if __name__ == "__main__":
    main()
