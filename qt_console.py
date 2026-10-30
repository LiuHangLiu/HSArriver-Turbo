"""Qt desktop console for HSArriver Turbo.

The legacy ``web/index.html`` remains the functional reference.  This module
implements the same workflow as a real desktop window: launcher, configuration,
automation controls and logs live in one native Qt client.  The UI only calls
the existing ``web_ui`` service functions; it does not duplicate FSM, Power.log,
CDP or mouse/keyboard logic.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import time
from typing import Any, Callable

from PySide6.QtCore import QObject, QRunnable, QThreadPool, QTimer, Qt, Signal, QTime
from PySide6.QtGui import QCloseEvent, QFont
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDateTimeEdit,
    QDialog,
    QFileDialog,
    QFormLayout,
    QFrame,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QDoubleSpinBox,
    QSplitter,
    QStackedWidget,
    QTabWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

import version
from config import CONFIG_PATH
from native_console import (
    LogFilterModel,
    WebUiBridge,
    find_hsbox_executable,
    load_local_config,
    save_local_config,
    start_hsbox,
    _data_dir,
)
from src.license.client import LicenseClient, LicenseError


ROOT = (Path(sys.executable).resolve().parent
        if getattr(sys, "frozen", False) else Path(__file__).resolve().parent)


class TaskSignals(QObject):
    result = Signal(object)
    error = Signal(str)


_ACTIVE_SIGNALS: set[TaskSignals] = set()


class Task(QRunnable):
    def __init__(self, fn: Callable[[], Any], signals: TaskSignals):
        super().__init__()
        self.fn = fn
        self.signals = signals

    def run(self) -> None:
        try:
            self.signals.result.emit(self.fn())
        except Exception as exc:
            self.signals.error.emit(f"{type(exc).__name__}: {exc}")


def run_task(fn: Callable[[], Any], on_result: Callable[[Any], None],
             on_error: Callable[[str], None]) -> None:
    signals = TaskSignals()
    _ACTIVE_SIGNALS.add(signals)

    def result(value: Any) -> None:
        _ACTIVE_SIGNALS.discard(signals)
        on_result(value)

    def error(message: str) -> None:
        _ACTIVE_SIGNALS.discard(signals)
        on_error(message)

    signals.result.connect(result)
    signals.error.connect(error)
    QThreadPool.globalInstance().start(Task(fn, signals))


class QtConsole(QMainWindow):
    """Single-window native client matching the original web feature order."""

    NAV = (
        ("overview", "概览", "▦"),
        ("config", "基础配置", "⚙"),
        ("schedule", "定时任务", "◷"),
        ("control", "对战控制", "⚔"),
        ("liveness", "存活检测", "♥"),
        ("watchdog", "中断重启", "↻"),
        ("concede", "自动投降", "⚑"),
        ("surrender", "投降规则", "⌘"),
        ("rank", "段位目标", "♜"),
        ("human", "活人感", "◌"),
        ("delays", "延时设置", "◒"),
        ("calibration", "校准区域", "⌖"),
        ("logs", "日志与自检", "☷"),
    )

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(f"HSArriver Turbo · {version.version_label()}")
        self.resize(1540, 940)
        self.setMinimumSize(1200, 760)
        self.bridge = WebUiBridge()
        self.license_client: LicenseClient | None = None
        self.hsbox_process: subprocess.Popen | None = None
        self.local = load_local_config()
        self.status_data: dict[str, Any] = {}
        self.log_seq = 0
        self.log_model = LogFilterModel()
        self.widgets: dict[str, QWidget] = {}
        self.pages: dict[str, QWidget] = {}
        self.deck_rows: list[dict[str, QLineEdit]] = []
        self.thread_pool = QThreadPool.globalInstance()

        self._set_theme()
        self._build_shell()
        self._build_pages()
        self._load_saved_values()
        self._initialize_license()
        self._status_timer = QTimer(self)
        self._status_timer.timeout.connect(self._refresh_status_async)
        self._status_timer.start(1000)
        self._log_timer = QTimer(self)
        self._log_timer.timeout.connect(self._refresh_logs_async)
        self._log_timer.start(700)
        self._refresh_status_async()

    # ---------- shell ----------
    def _set_theme(self) -> None:
        self.setStyleSheet("""
        QWidget { color:#e9edf4; font-family:'Microsoft YaHei UI'; font-size:13px; }
        QMainWindow, QWidget#root { background:#101722; }
        QFrame#topbar { background:#162131; border-bottom:1px solid #26344a; }
        QLabel#brand { color:#f0c45c; font-size:20px; font-weight:700; }
        QLabel#muted { color:#8795a9; }
        QLabel#status { background:#203a32; color:#76ddb1; border-radius:11px; padding:5px 12px; font-weight:600; }
        QLabel#status.warn { background:#3b3020; color:#efc36a; }
        QLabel#status.error { background:#43272b; color:#ff9292; }
        QListWidget#nav { background:#121c2a; border:0; padding:12px 8px; outline:0; }
        QListWidget#nav::item { height:40px; padding:0 13px; margin:2px 0; border-radius:7px; color:#9aa8bb; }
        QListWidget#nav::item:selected { background:#293d59; color:#f5c968; font-weight:700; }
        QScrollArea { border:0; background:#101722; }
        QGroupBox { background:#172333; border:1px solid #26364d; border-radius:10px; margin-top:13px; padding:18px 14px 14px; font-weight:700; }
        QGroupBox::title { subcontrol-origin:margin; left:14px; padding:0 7px; color:#f0c45c; }
        QLabel#pageTitle { color:#f1f4f8; font-size:24px; font-weight:700; }
        QLabel#pageHint { color:#8493a8; font-size:13px; }
        QLabel#metric { color:#f0c45c; font-size:25px; font-weight:700; }
        QLabel#metricLabel { color:#91a0b2; font-size:12px; }
        QLineEdit, QPlainTextEdit, QTextEdit, QComboBox, QSpinBox, QDoubleSpinBox, QDateTimeEdit { background:#0e1621; border:1px solid #34465e; border-radius:6px; padding:7px 9px; color:#e9edf4; selection-background-color:#38618d; }
        QLineEdit:focus, QPlainTextEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus, QDateTimeEdit:focus { border:1px solid #d9aa4d; }
        QCheckBox { spacing:8px; color:#d7deea; }
        QPushButton { background:#26364c; border:1px solid #3b506a; border-radius:6px; padding:8px 15px; color:#e9edf4; }
        QPushButton:hover { background:#304968; }
        QPushButton#primary { background:#c99c42; color:#151a21; border:0; font-weight:700; }
        QPushButton#primary:hover { background:#e0b85b; }
        QPushButton#danger { background:#7d3840; border:0; color:white; }
        QPushButton#warn { background:#6a4d27; border:0; color:#ffe7a5; }
        QPushButton#flat { background:transparent; border:1px solid #3a4a61; }
        QPlainTextEdit#log { background:#0b121c; border:0; color:#a9d7bb; font-family:Consolas; font-size:12px; }
        QFrame#logPanel { background:#0d1622; border-left:1px solid #26364d; }
        QProgressBar { background:#0e1621; border:0; border-radius:4px; height:8px; text-visible:false; }
        QProgressBar::chunk { background:#c99c42; border-radius:4px; }
        QTabWidget::pane { border:1px solid #2a3b53; border-radius:6px; }
        QTabBar::tab { background:#172333; padding:8px 15px; color:#98a7ba; }
        QTabBar::tab:selected { color:#f0c45c; border-bottom:2px solid #c99c42; }
        """)

    def _build_shell(self) -> None:
        root = QWidget(objectName="root")
        self.setCentralWidget(root)
        outer = QVBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        top = QFrame(objectName="topbar")
        top.setFixedHeight(70)
        top_layout = QHBoxLayout(top)
        top_layout.setContentsMargins(24, 10, 22, 10)
        brand = QLabel("HSArriver Turbo", objectName="brand")
        top_layout.addWidget(brand)
        top_layout.addWidget(QLabel("原生桌面控制台 · CDP 推荐 / Power.log 状态 / 前台操作", objectName="muted"))
        top_layout.addStretch()
        self.status_label = QLabel("未连接", objectName="status")
        top_layout.addWidget(self.status_label)
        self.version_label = QLabel(version.version_label(), objectName="muted")
        top_layout.addWidget(self.version_label)
        self.box_button = self._button("启动盒子", self._start_box, "primary")
        self.start_button = self._button("开始挂机", self._start_automation, "primary")
        self.stop_button = self._button("立即停止", self._stop_now, "danger")
        top_layout.addWidget(self.box_button)
        top_layout.addWidget(self.start_button)
        top_layout.addWidget(self.stop_button)
        outer.addWidget(top)

        body = QSplitter(Qt.Orientation.Horizontal)
        body.setHandleWidth(1)
        outer.addWidget(body, 1)

        self.nav = QListWidget(objectName="nav")
        self.nav.setFixedWidth(190)
        for key, text, icon in self.NAV:
            item = QListWidgetItem(f"{icon}   {text}")
            item.setData(Qt.ItemDataRole.UserRole, key)
            self.nav.addItem(item)
        self.nav.currentRowChanged.connect(self._select_page)
        body.addWidget(self.nav)

        self.stack = QStackedWidget()
        body.addWidget(self.stack)
        body.setStretchFactor(1, 1)

        self.log_panel = self._build_log_panel()
        self.log_panel.setMinimumWidth(315)
        self.log_panel.setMaximumWidth(430)
        body.addWidget(self.log_panel)
        body.setStretchFactor(2, 0)
        self.nav.setCurrentRow(0)

    def _build_log_panel(self) -> QFrame:
        panel = QFrame(objectName="logPanel")
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(14, 18, 14, 14)
        title = QHBoxLayout()
        title.addWidget(QLabel("实时日志"))
        title.addStretch()
        clear = self._button("清空", self._clear_log, "flat")
        title.addWidget(clear)
        layout.addLayout(title)
        self.log_filters: dict[str, QCheckBox] = {}
        filters = QHBoxLayout()
        for key, text in (("operation", "操作"), ("recommendation", "推荐"), ("cdp", "CDP"), ("power", "Power"), ("debug", "调试")):
            box = QCheckBox(text)
            box.setChecked(self.log_model.enabled[key])
            box.stateChanged.connect(lambda state, k=key: self._set_log_filter(k, state))
            self.log_filters[key] = box
            filters.addWidget(box)
        layout.addLayout(filters)
        self.autoscroll = QCheckBox("自动滚动")
        self.autoscroll.setChecked(True)
        layout.addWidget(self.autoscroll)
        self.log_text = QPlainTextEdit(objectName="log")
        self.log_text.setReadOnly(True)
        layout.addWidget(self.log_text, 1)
        return panel

    # ---------- common widgets ----------
    def _button(self, text: str, fn: Callable[[], None], role: str = "") -> QPushButton:
        button = QPushButton(text)
        if role:
            button.setObjectName(role)
        button.clicked.connect(fn)
        return button

    def _page(self, key: str, title: str, hint: str) -> tuple[QWidget, QVBoxLayout]:
        page = QWidget()
        page_layout = QVBoxLayout(page)
        page_layout.setContentsMargins(28, 22, 28, 28)
        page_layout.setSpacing(14)
        head = QVBoxLayout()
        label = QLabel(title, objectName="pageTitle")
        head.addWidget(label)
        head.addWidget(QLabel(hint, objectName="pageHint"))
        page_layout.addLayout(head)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        inner = QWidget()
        content = QVBoxLayout(inner)
        content.setContentsMargins(2, 2, 10, 2)
        content.setSpacing(12)
        scroll.setWidget(inner)
        page_layout.addWidget(scroll, 1)
        self.pages[key] = page
        self.stack.addWidget(page)
        return inner, content

    def _group(self, title: str, layout: QVBoxLayout | QFormLayout | QGridLayout) -> QGroupBox:
        box = QGroupBox(title)
        box.setLayout(layout)
        return box

    def _form(self) -> QFormLayout:
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)
        form.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.AllNonFixedFieldsGrow)
        form.setHorizontalSpacing(18)
        form.setVerticalSpacing(10)
        return form

    def _line(self, key: str, value: str = "", placeholder: str = "") -> QLineEdit:
        w = QLineEdit(value)
        w.setPlaceholderText(placeholder)
        self.widgets[key] = w
        return w

    def _check(self, key: str, value: bool = False, text: str = "启用") -> QCheckBox:
        w = QCheckBox(text)
        w.setChecked(value)
        self.widgets[key] = w
        return w

    def _spin(self, key: str, value: float, lo: float, hi: float, step: float = 1.0) -> QDoubleSpinBox:
        w = QDoubleSpinBox()
        w.setRange(lo, hi)
        w.setSingleStep(step)
        w.setValue(value)
        self.widgets[key] = w
        return w

    def _int_spin(self, key: str, value: int, lo: int, hi: int, step: int = 1) -> QSpinBox:
        w = QSpinBox()
        w.setRange(lo, hi)
        w.setSingleStep(step)
        w.setValue(value)
        self.widgets[key] = w
        return w

    def _save_button(self, text: str, fn: Callable[[], None], role: str = "") -> QPushButton:
        return self._button(text, fn, role)

    # ---------- pages, same order as web/index.html ----------
    def _build_pages(self) -> None:
        self._build_overview()
        self._build_config()
        self._build_schedule()
        self._build_control()
        self._build_liveness()
        self._build_watchdog()
        self._build_concede()
        self._build_surrender()
        self._build_rank()
        self._build_human()
        self._build_delays()
        self._build_calibration()
        self._build_logs()

    def _build_overview(self) -> None:
        inner, layout = self._page("overview", "运行概览", "启动盒子、校验授权、查看当前状态和本次挂机统计。")
        metrics = QGridLayout()
        for index, (key, title) in enumerate((("state", "当前状态"), ("games", "已完成对局"), ("wins", "胜场"), ("concede", "自动认输"), ("rate", "胜率"))):
            card = QFrame()
            card.setStyleSheet("QFrame{background:#1c2b3e;border:1px solid #2c405b;border-radius:8px;}")
            v = QVBoxLayout(card)
            v.setContentsMargins(13, 11, 13, 11)
            value = QLabel("待机", objectName="metric")
            label = QLabel(title, objectName="metricLabel")
            self.widgets[f"metric_{key}"] = value
            v.addWidget(value)
            v.addWidget(label)
            metrics.addWidget(card, 0, index)
        layout.addLayout(metrics)

        quick = QHBoxLayout()
        quick.addWidget(self._button("启动盒子", self._start_box, "primary"))
        quick.addWidget(self._button("开始准备", self._prepare, "primary"))
        quick.addWidget(self._button("打开投降规则", lambda: self._show_page("surrender")))
        quick.addWidget(self._button("进入日志与自检", lambda: self._show_page("logs")))
        quick.addStretch()
        layout.addLayout(quick)

        license_box = QVBoxLayout()
        self.license_status = QLabel("授权状态：初始化中…")
        license_box.addWidget(self.license_status)
        row = QHBoxLayout()
        self.card_code = QLineEdit()
        self.card_code.setPlaceholderText("输入卡密（试用也必须使用卡密）")
        row.addWidget(self.card_code, 1)
        row.addWidget(self._button("激活 / 续期", self._activate_license, "primary"))
        row.addWidget(self._button("刷新授权", self._refresh_license))
        license_box.addLayout(row)
        layout.addWidget(self._group("授权与设备", license_box))

        self.overview_hint = QLabel("正在读取控制引擎状态…", objectName="pageHint")
        layout.addWidget(self.overview_hint)
        layout.addStretch()

    def _build_config(self) -> None:
        inner, layout = self._page("config", "基础配置", "对应原页面的用户、日志目录与盒子目录配置；保存后再开始挂机。")
        form = self._form()
        form.addRow("用户 ID（战网完整昵称）", self._line("name", placeholder="例如：为所欲为#54321"))
        log_row = QHBoxLayout()
        log_row.addWidget(self._line("log_root", placeholder="炉石 Logs 文件夹"), 1)
        log_row.addWidget(self._button("检测", self._check_log))
        form.addRow("炉石日志目录", log_row)
        box_row = QHBoxLayout()
        box_row.addWidget(self._line("box_path", placeholder="炉石盒子目录，或直接选择 HSAng.exe"), 1)
        box_row.addWidget(self._button("浏览", self._browse_box))
        form.addRow("炉石盒子目录", box_row)
        self.config_hint = QLabel("账号校验：等待读到对局日志中的玩家名…", objectName="pageHint")
        layout.addWidget(self._group("运行身份与目录", form))
        layout.addWidget(self.config_hint)
        buttons = QHBoxLayout()
        buttons.addWidget(self._save_button("保存配置", self._save_config, "primary"))
        buttons.addWidget(self._button("启动盒子", self._start_box))
        buttons.addStretch()
        layout.addLayout(buttons)
        layout.addStretch()

    def _build_schedule(self) -> None:
        inner, layout = self._page("schedule", "定时任务", "按原页面顺序设置开始与结束时间；结束时默认等待本局完成后停止。")
        form = self._form()
        self.start_dt = QDateTimeEdit()
        self.start_dt.setCalendarPopup(True)
        self.start_dt.setDisplayFormat("yyyy-MM-dd HH:mm")
        self.start_dt.setDateTime(self.start_dt.dateTime().addSecs(60))
        self.end_dt = QDateTimeEdit()
        self.end_dt.setCalendarPopup(True)
        self.end_dt.setDisplayFormat("yyyy-MM-dd HH:mm")
        self.end_enabled = QCheckBox("启用结束时间")
        self.end_enabled.toggled.connect(self.end_dt.setEnabled)
        self.end_enabled.setChecked(False)
        self.end_dt.setEnabled(False)
        form.addRow("开始时间", self.start_dt)
        end_row = QHBoxLayout()
        end_row.addWidget(self.end_enabled)
        end_row.addWidget(self.end_dt, 1)
        form.addRow("结束时间（可选）", end_row)
        layout.addWidget(self._group("计划窗口", form))
        row = QHBoxLayout()
        row.addWidget(self._button("保存定时任务", self._save_schedule, "primary"))
        row.addWidget(self._button("取消计划", self._cancel_schedule))
        row.addStretch()
        layout.addLayout(row)
        self.schedule_hint = QLabel("当前没有定时计划。", objectName="pageHint")
        layout.addWidget(self.schedule_hint)
        layout.addStretch()

    def _build_control(self) -> None:
        inner, layout = self._page("control", "对战控制", "保持原页面的准备 → 开始对战二次确认 → 本局后停止 / 立即停止交互。")
        box = QVBoxLayout()
        row = QHBoxLayout()
        self.prepare_button = self._button("开始运行（准备）", self._prepare, "primary")
        self.overlay_button = self._button("日志浮窗（关）", self._toggle_overlay)
        self.after_button = self._button("本局结束后停止", self._stop_after, "warn")
        self.now_button = self._button("立即停止", self._stop_now, "danger")
        for button in (self.prepare_button, self.overlay_button, self.after_button, self.now_button):
            row.addWidget(button)
        row.addStretch()
        box.addLayout(row)
        self.control_state = QLabel("状态：待机", objectName="pageHint")
        box.addWidget(self.control_state)
        layout.addWidget(self._group("自动化生命周期", box))
        manual = QGridLayout()
        for text, fn in (("手动进入对战", lambda: self._post("/api/enter_battle", {}, self._show_result)),
                         ("保存当前卡组", lambda: self._post("/api/deck", {}, self._show_result)),
                         ("选择模式", lambda: self._post("/api/mode", {}, self._show_result)),
                         ("立即投降", lambda: self._post("/api/concede_now", {}, self._show_result)),
                         ("重启炉石", lambda: self._post("/api/restart_hearthstone", {}, self._show_result))):
            manual.addWidget(self._button(text, fn), manual.count() // 3, manual.count() % 3)
        layout.addWidget(self._group("手动辅助操作", manual))
        layout.addStretch()

    def _build_liveness(self) -> None:
        inner, layout = self._page("liveness", "存活检测", "Power.log 停滞告警和自动停止，避免炉石闪退后空转。")
        form = self._form()
        form.addRow("启用", self._check("liveness_enabled", True))
        form.addRow("日志停滞告警（秒）", self._spin("liveness_warn", 120, 1, 3600, 10))
        form.addRow("日志停滞自动停止（秒）", self._spin("liveness_stop", 300, 1, 7200, 10))
        layout.addWidget(self._group("存活检测配置", form))
        self.liveness_state = QLabel("存活状态：等待检测…", objectName="pageHint")
        layout.addWidget(self.liveness_state)
        layout.addWidget(self._button("保存存活检测", self._save_liveness, "primary"))
        layout.addStretch()

    def _build_watchdog(self) -> None:
        inner, layout = self._page("watchdog", "中断重启", "日志长期停滞时自动重启炉石并重新进入对战；与存活检测互斥生效。")
        form = self._form()
        form.addRow("启用", self._check("watchdog_enabled", False))
        form.addRow("日志停滞多久算卡住（秒）", self._spin("watchdog_stale", 300, 30, 3600, 30))
        form.addRow("最多重启次数", self._int_spin("watchdog_max", 3, 1, 20))
        layout.addWidget(self._group("中断重启配置", form))
        self.watchdog_state = QLabel("中断重启：等待检测…", objectName="pageHint")
        layout.addWidget(self.watchdog_state)
        layout.addWidget(self._button("保存中断重启", self._save_watchdog, "primary"))
        layout.addStretch()

    def _build_concede(self) -> None:
        inner, layout = self._page("concede", "自动投降", "按 AI 胜率阈值和连续回合数决定是否自动认输。")
        form = self._form()
        form.addRow("启用", self._check("concede_enabled", False))
        form.addRow("AI 胜率阈值（%）", self._spin("concede_threshold", 10, 0, 100, 0.5))
        form.addRow("连续回合数", self._int_spin("concede_rounds", 3, 1, 50))
        layout.addWidget(self._group("自动投降策略", form))
        self.concede_state = QLabel("检测状态：等待自动化运行…", objectName="pageHint")
        layout.addWidget(self.concede_state)
        layout.addWidget(self._button("保存自动投降", self._save_concede, "warn"))
        layout.addStretch()

    def _build_surrender(self) -> None:
        inner, layout = self._page("surrender", "投降规则", "按原网页的卡组识别规则工作：可编辑卡组、职业、条件，并保留高级 JSON。")
        top = QHBoxLayout()
        top.addWidget(self._check("surrender_enabled", False))
        top.addStretch()
        top.addWidget(self._button("添加卡组", self._add_deck))
        top.addWidget(self._button("保存卡组识别", self._save_surrender, "warn"))
        layout.addLayout(top)
        self.deck_list = QVBoxLayout()
        layout.addLayout(self.deck_list)
        tabs = QTabWidget()
        self.surrender_json = QPlainTextEdit()
        self.surrender_json.setPlaceholderText("高级 JSON：表单无法表达的 turn/card_type/at_least 等字段可在这里原样编辑。")
        tabs.addTab(self.surrender_json, "高级 JSON")
        help_text = QLabel("规则树支持 且 / 或 / 非；每条叶子规则可搜索本地卡牌库。保存时后端会进行卡名校验，不通过则保留上一份配置。")
        help_text.setWordWrap(True)
        tabs.addTab(help_text, "规则说明")
        layout.addWidget(tabs, 1)
        self.surrender_state = QLabel("状态：暂无启用的卡组规则。", objectName="pageHint")
        layout.addWidget(self.surrender_state)

    def _build_rank(self) -> None:
        inner, layout = self._page("rank", "段位目标", "上传说即停、上到指定名次后停，或使用控分模式。")
        form = self._form()
        form.addRow("启用", self._check("rank_enabled", False))
        mode = QComboBox()
        mode.addItem("上传说", "legend")
        mode.addItem("上到传说某个名次", "legend_number")
        self.widgets["rank_mode"] = mode
        form.addRow("判定方式", mode)
        form.addRow("传说名次", self._int_spin("rank_number", 1, 1, 100000))
        action = QComboBox()
        action.addItem("达到后停止", "stop")
        action.addItem("控分（不超过该名次）", "keep")
        self.widgets["rank_action"] = action
        form.addRow("到该名次后", action)
        layout.addWidget(self._group("段位目标配置", form))
        self.rank_state = QLabel("段位目标：等待自动化运行…", objectName="pageHint")
        layout.addWidget(self.rank_state)
        layout.addWidget(self._button("保存段位目标", self._save_rank, "warn"))
        layout.addStretch()

    def _build_human(self) -> None:
        inner, layout = self._page("human", "活人感", "对应原页面的随机延时、看卡牌、看随从和悬停时长。")
        form = self._form()
        form.addRow("启用", self._check("human_enabled", False))
        form.addRow("看卡牌", self._check("human_hand", True))
        form.addRow("随机延时下限（秒）", self._spin("human_min", .5, 0, 60, .1))
        form.addRow("随机延时上限（秒）", self._spin("human_max", 3, 0, 60, .1))
        form.addRow("看随从", self._check("human_minion", True))
        form.addRow("随从悬停下限（秒）", self._spin("human_minion_min", .2, .05, 30, .05))
        form.addRow("随从悬停上限（秒）", self._spin("human_minion_max", 1.5, .05, 30, .05))
        form.addRow("卡牌悬停下限（秒）", self._spin("human_hover_min", .2, .05, 30, .05))
        form.addRow("卡牌悬停上限（秒）", self._spin("human_hover_max", 1, .05, 30, .05))
        layout.addWidget(self._group("人性化动作", form))
        layout.addWidget(self._button("保存活人感", self._save_human, "primary"))
        layout.addStretch()

    def _build_delays(self) -> None:
        inner, layout = self._page("delays", "延时设置", "逐项对应原网页字段，并显示字段保存后的生效时机。")
        form = self._form()
        fields = (("delay_ready", "换牌前等待（秒）", 18, 0, 120, .5), ("delay_ocr", "识别后缓冲（秒）", 1, 0, 30, .5), ("delay_retry", "换牌重试间隔（秒）", 5, 0, 60, .5), ("delay_first", "每张开局卡延时（秒）", 3.5, 0, 20, .5), ("delay_pre", "每回合前延时（秒）", 7, 0, 60, .5), ("delay_post", "操作后延时（秒）", .5, 0, 10, .25), ("delay_draw", "抽牌额外延时（秒/张）", 1, 0, 20, .5), ("delay_choice", "抉择/发现选目标延时（秒）", .3, 0, 5, .1), ("delay_scale", "OCR 缩放", 1.4, .5, 4, .1))
        for key, label, value, lo, hi, step in fields:
            form.addRow(label, self._spin(key, value, lo, hi, step))
        layout.addWidget(self._group("自动化时序", form))
        self.delay_hint = QLabel("修改 OCR 缩放需重启进程；部分字段下一次开始对战生效。", objectName="pageHint")
        layout.addWidget(self.delay_hint)
        layout.addWidget(self._button("保存延时", self._save_delays, "primary"))
        layout.addStretch()

    def _build_calibration(self) -> None:
        inner, layout = self._page("calibration", "校准区域", "查看当前识别区域、打开屏幕校准窗口，并学习 UI 状态。")
        row = QHBoxLayout()
        row.addWidget(self._button("打开校准窗口（屏幕上）", self._calibrate, "primary"))
        row.addWidget(self._button("读取识别区域", self._read_regions))
        row.addWidget(self._button("学习当前 UI", self._learn_ui))
        row.addStretch()
        layout.addLayout(row)
        self.regions_text = QPlainTextEdit()
        self.regions_text.setReadOnly(True)
        self.regions_text.setPlaceholderText("读取后显示识别区域 JSON")
        layout.addWidget(self._group("区域与学习状态", QVBoxLayout()))
        layout.itemAt(layout.count() - 1).widget().layout().addWidget(self.regions_text)
        layout.addStretch()

    def _build_logs(self) -> None:
        inner, layout = self._page("logs", "日志与自检", "全部日志分类可勾选；自检结果、CDP 原始 JSON、Power.log 和推荐日志都在这里查看。")
        row = QHBoxLayout()
        row.addWidget(self._button("重新自检", self._selfcheck, "primary"))
        row.addWidget(self._button("导出反馈包", lambda: self._post("/api/feedback/export", {}, self._show_result)))
        row.addWidget(self._button("清空右侧日志", self._clear_log))
        row.addStretch()
        layout.addLayout(row)
        self.selfcheck_text = QPlainTextEdit()
        self.selfcheck_text.setReadOnly(True)
        layout.addWidget(self._group("环境自检", QVBoxLayout()))
        layout.itemAt(layout.count() - 1).widget().layout().addWidget(self.selfcheck_text)
        note = QLabel("日志分类开关在窗口右侧：操作、推荐、CDP、Power.log、调试。", objectName="pageHint")
        layout.addWidget(note)
        layout.addStretch()

    # ---------- saved state ----------
    def _load_saved_values(self) -> None:
        launcher = self.local.get("launcher") if isinstance(self.local.get("launcher"), dict) else {}
        self.widgets["name"].setText(str(self.local.get("name", "")))
        self.widgets["log_root"].setText(str(self.local.get("log_root", "")))
        self.widgets["box_path"].setText(str(launcher.get("box_path", "")))

    def _initialize_license(self) -> None:
        try:
            self.license_client = LicenseClient(data_dir=_data_dir(), app_version=version.VERSION)
            self._refresh_license()
        except Exception as exc:
            self.license_status.setText(f"授权初始化失败：{exc}")

    # ---------- navigation / async bridge ----------
    def _select_page(self, row: int) -> None:
        if row >= 0:
            key = self.nav.item(row).data(Qt.ItemDataRole.UserRole)
            if key not in self.pages:
                return
            self.stack.setCurrentWidget(self.pages[key])
            if key == "logs":
                self._selfcheck()

    def _show_page(self, key: str) -> None:
        for index in range(self.nav.count()):
            if self.nav.item(index).data(Qt.ItemDataRole.UserRole) == key:
                self.nav.setCurrentRow(index)
                return

    def _post(self, path: str, body: dict[str, Any], callback: Callable[[Any], None] | None = None) -> None:
        mapping = {"/api/config": "api_save_config", "/api/start": "api_start", "/api/prepare": "api_prepare", "/api/stop": "api_stop", "/api/cancel": "api_cancel", "/api/schedule": "api_schedule", "/api/schedule/cancel": "api_cancel_schedule", "/api/calibrate": "api_calibrate", "/api/ui_learn": "api_ui_learn", "/api/deck": "api_save_deck", "/api/enter_battle": "api_enter_battle", "/api/mode": "api_mode_click", "/api/concede_now": "api_concede_now", "/api/restart_hearthstone": "api_restart_hearthstone", "/api/overlay": "api_toggle_overlay", "/api/concede": "api_save_concede", "/api/surrender_rules": "api_save_surrender_rules", "/api/rank_stop": "api_save_rank_stop", "/api/human_like": "api_save_human_like", "/api/liveness": "api_save_liveness", "/api/watchdog": "api_watchdog", "/api/delays": "api_save_delays", "/api/selfcheck": "api_selfcheck", "/api/regions": "api_regions", "/api/feedback/export": "api_feedback_export"}
        name = mapping.get(path)
        if not name:
            self._show_error("未知操作", path)
            return
        def work():
            if name in {"api_cancel_schedule", "api_regions", "api_selfcheck"}:
                return self.bridge.call(name)
            return self.bridge.call(name, body) if body is not None else self.bridge.call(name)
        run_task(work, callback or self._show_result, lambda error: self._show_error("操作失败", error))

    def _show_result(self, result: Any) -> None:
        if isinstance(result, dict) and result.get("ok") is False:
            self._show_error("操作失败", str(result.get("error") or result))
            return
        message = result.get("message") if isinstance(result, dict) else None
        if message:
            self.status_label.setText(message)
        self._refresh_status_async()

    def _show_error(self, title: str, text: str) -> None:
        self.status_label.setText("操作失败")
        self.status_label.setProperty("class", "error")
        self.status_label.style().unpolish(self.status_label)
        self.status_label.style().polish(self.status_label)
        QMessageBox.warning(self, title, text)

    # ---------- launcher / license ----------
    def _browse_box(self) -> None:
        path = QFileDialog.getExistingDirectory(self, "选择炉石盒子目录")
        if path:
            self.widgets["box_path"].setText(path)

    def _save_local_launcher(self) -> None:
        self.local["launcher"] = {"box_path": self.widgets["box_path"].text().strip()}
        save_local_config(self.local)

    def _start_box(self) -> None:
        folder = self.widgets["box_path"].text().strip()
        if not folder:
            self._show_error("启动盒子", "请先在「基础配置」填写炉石盒子目录。")
            self._show_page("config")
            return
        try:
            executable = find_hsbox_executable(folder)
            if self.hsbox_process and self.hsbox_process.poll() is None:
                self.status_label.setText("盒子已运行")
                return
            self.hsbox_process = start_hsbox(folder)
            self._save_local_launcher()
            self.status_label.setText(f"盒子已启动：{executable.name}")
            self._log_message("SYS", f"盒子已启动：{executable}")
        except Exception as exc:
            self._show_error("启动盒子失败", str(exc))

    def _refresh_license(self) -> None:
        if not self.license_client:
            return
        def work():
            return self.license_client.status()
        run_task(work, self._render_license, lambda error: self.license_status.setText(f"授权状态读取失败：{error}"))

    def _render_license(self, state: Any) -> None:
        if getattr(state, "usable", False):
            expires = "永久" if getattr(state, "permanent", False) else time.strftime("%Y-%m-%d %H:%M", time.localtime(getattr(state, "entitlement_expires_at", 0)))
            text = f"授权有效 · {getattr(state, 'plan', '') or 'standard'} · 到期：{expires}"
        else:
            text = "未激活：必须使用卡密，试用也由服务端生成试用卡密。"
        self.license_status.setText(text)

    def _activate_license(self) -> None:
        code = self.card_code.text().strip()
        if not self.license_client:
            self._show_error("授权", "授权模块初始化失败。")
            return
        if not code:
            self._show_error("授权", "请输入卡密。")
            return
        run_task(lambda: self.license_client.activate(code), self._render_license, lambda error: self._show_error("激活失败", error))

    def _license_usable(self) -> bool:
        try:
            return bool(self.license_client and self.license_client.status().usable)
        except Exception:
            return False

    # ---------- original web interactions ----------
    def _save_config(self) -> None:
        self._save_local_launcher()
        self._post("/api/config", {"name": self.widgets["name"].text().strip(), "log_root": self.widgets["log_root"].text().strip()}, self._show_result)

    def _check_log(self) -> None:
        path = self.widgets["log_root"].text().strip()
        run_task(lambda: self.bridge.call("check_log_dir", path), lambda value: self._set_hint(self.config_hint, value), lambda error: self._set_hint(self.config_hint, error))

    def _set_hint(self, label: QLabel, value: Any) -> None:
        if isinstance(value, dict):
            label.setText(str(value.get("message") or value.get("error") or json.dumps(value, ensure_ascii=False)))
        else:
            label.setText(str(value))

    def _save_schedule(self) -> None:
        start = self.start_dt.dateTime().toString(Qt.DateFormat.ISODate)
        end = self.end_dt.dateTime().toString(Qt.DateFormat.ISODate) if self.end_enabled.isChecked() else ""
        self._post("/api/schedule", {"start": start, "end": end}, self._show_result)

    def _cancel_schedule(self) -> None:
        self._post("/api/schedule/cancel", {}, self._show_result)

    def _prepare(self) -> None:
        self._post("/api/prepare", {}, self._show_result)

    def _start_automation(self) -> None:
        if not self._license_usable():
            self._show_error("开始挂机", "请先在概览页使用卡密激活，授权有效后才能挂机。")
            self._show_page("overview")
            return
        if self.status_data.get("prepared"):
            answer = QMessageBox.question(self, "确认开始", "已完成准备，确定开始自动对战？")
            if answer != QMessageBox.StandardButton.Yes:
                return
            self._post("/api/start", {}, self._show_result)
        else:
            self._prepare()

    def _stop_after(self) -> None:
        answer = QMessageBox.question(self, "确认停止", "确定本局对战结束后停止自动化？")
        if answer == QMessageBox.StandardButton.Yes:
            self._post("/api/stop", {"mode": "after_game"}, self._show_result)

    def _stop_now(self) -> None:
        answer = QMessageBox.question(self, "确认停止", "确定立即停止自动化？当前对局会被中断。")
        if answer == QMessageBox.StandardButton.Yes:
            self._post("/api/stop", {"mode": "now"}, self._show_result)

    def _toggle_overlay(self) -> None:
        self._post("/api/overlay", {}, self._show_result)

    def _save_liveness(self) -> None:
        self._post("/api/liveness", {"enabled": self.widgets["liveness_enabled"].isChecked(), "log_stale_warn_seconds": self.widgets["liveness_warn"].value(), "log_stale_stop_seconds": self.widgets["liveness_stop"].value()}, self._show_result)

    def _save_watchdog(self) -> None:
        self._post("/api/watchdog", {"enabled": self.widgets["watchdog_enabled"].isChecked(), "stale_seconds": self.widgets["watchdog_stale"].value(), "max_restarts": self.widgets["watchdog_max"].value()}, self._show_result)

    def _save_concede(self) -> None:
        self._post("/api/concede", {"enabled": self.widgets["concede_enabled"].isChecked(), "threshold": self.widgets["concede_threshold"].value(), "rounds": self.widgets["concede_rounds"].value()}, self._show_result)

    def _save_rank(self) -> None:
        self._post("/api/rank_stop", {"enabled": self.widgets["rank_enabled"].isChecked(), "mode": self.widgets["rank_mode"].currentData(), "legend_number": self.widgets["rank_number"].value(), "action": self.widgets["rank_action"].currentData()}, self._show_result)

    def _save_human(self) -> None:
        self._post("/api/human_like", {"enabled": self.widgets["human_enabled"].isChecked(), "hand_hover_enabled": self.widgets["human_hand"].isChecked(), "minion_hover_enabled": self.widgets["human_minion"].isChecked(), "post_delay_min": self.widgets["human_min"].value(), "post_delay_max": self.widgets["human_max"].value(), "hover_min": self.widgets["human_hover_min"].value(), "hover_max": self.widgets["human_hover_max"].value(), "minion_hover_min": self.widgets["human_minion_min"].value(), "minion_hover_max": self.widgets["human_minion_max"].value()}, self._show_result)

    def _save_delays(self) -> None:
        keys = (("delay_ready", "mulligan_ready_delay_seconds"), ("delay_ocr", "mulligan_post_ocr_delay_seconds"), ("delay_retry", "mulligan_retry_delay_seconds"), ("delay_first", "first_turn_per_card_delay_seconds"), ("delay_pre", "pre_action_delay_seconds"), ("delay_post", "post_action_delay_seconds"), ("delay_draw", "draw_extra_delay_per_card_seconds"), ("delay_choice", "discover_target_delay_seconds"), ("delay_scale", "ocr_preprocess_scale"))
        self._post("/api/delays", {api_key: self.widgets[key].value() for key, api_key in keys}, self._show_result)

    def _calibrate(self) -> None:
        self._post("/api/calibrate", {}, self._show_result)

    def _read_regions(self) -> None:
        self._post("/api/regions", {}, lambda value: self.regions_text.setPlainText(json.dumps(value, ensure_ascii=False, indent=2)))

    def _learn_ui(self) -> None:
        self._post("/api/ui_learn", {}, self._show_result)

    # ---------- surrender editor ----------
    def _add_deck(self) -> None:
        row = QFrame()
        row.setStyleSheet("QFrame{background:#1c2b3e;border:1px solid #304761;border-radius:7px;}")
        form = QFormLayout(row)
        name = QLineEdit(); name.setPlaceholderText("例如：快攻猎")
        hero = QComboBox(); hero.addItem("不限职业", "")
        for value, text in (("DRUID", "德鲁伊"), ("HUNTER", "猎人"), ("MAGE", "法师"), ("PALADIN", "圣骑士"), ("PRIEST", "牧师"), ("ROGUE", "潜行者"), ("SHAMAN", "萨满"), ("WARLOCK", "术士"), ("WARRIOR", "战士"), ("DEMONHUNTER", "恶魔猎手"), ("DEATHKNIGHT", "死亡骑士")):
            hero.addItem(text, value)
        cond = QPlainTextEdit()
        cond.setPlaceholderText('{"all":[{"type":"played","side":"opponent","card":"卡牌名"}]}')
        cond.setMaximumHeight(82)
        form.addRow("卡组名称", name)
        form.addRow("职业", hero)
        form.addRow("条件 JSON", cond)
        remove = self._button("删除卡组", row.deleteLater, "flat")
        form.addRow("", remove)
        self.deck_list.addWidget(row)
        self.deck_rows.append({"name": name, "hero": hero, "when": cond})

    def _surrender_config(self) -> dict[str, Any]:
        decks = []
        for row in self.deck_rows:
            raw = row["when"].toPlainText().strip()
            try:
                when = json.loads(raw) if raw else {"all": []}
            except json.JSONDecodeError as exc:
                raise ValueError(f"卡组「{row['name'].text()}」条件 JSON 错误：{exc}")
            decks.append({"name": row["name"].text().strip(), "class": row["hero"].currentData(), "when": when, "enabled": True, "action": "concede"})
        if self.surrender_json.toPlainText().strip():
            try:
                advanced = json.loads(self.surrender_json.toPlainText())
                if isinstance(advanced, dict):
                    advanced["enabled"] = self.widgets["surrender_enabled"].isChecked()
                    if not decks and isinstance(advanced.get("decks"), list):
                        return advanced
            except json.JSONDecodeError as exc:
                raise ValueError(f"高级 JSON 错误：{exc}")
        return {"enabled": self.widgets["surrender_enabled"].isChecked(), "aliases": {}, "decks": decks}

    def _save_surrender(self) -> None:
        try:
            config = self._surrender_config()
        except ValueError as exc:
            self._show_error("保存卡组识别", str(exc))
            return
        self._post("/api/surrender_rules", {"config": config}, self._show_result)

    # ---------- status / logs ----------
    def _refresh_status_async(self) -> None:
        run_task(self.bridge.status, self._render_status, lambda error: self._set_status_error(error))

    def _set_status_error(self, error: str) -> None:
        self.status_label.setText("引擎未连接")
        self.overview_hint.setText(error)

    def _render_status(self, status: Any) -> None:
        if not isinstance(status, dict):
            return
        self.status_data = status
        running = bool(status.get("running"))
        label = status.get("state_label") or ("挂机中" if running else "待机")
        self.status_label.setText(str(label))
        self.control_state.setText(f"状态：{label} · 阶段：{status.get('phase', 'idle')}")
        self.overview_hint.setText(f"盒子：{'已配置' if self.widgets['box_path'].text().strip() else '未配置'} · 授权：{'有效' if self._license_usable() else '未激活'} · 热键 Ctrl+Q：{'已注册' if status.get('hotkey_ok') else '未注册'}")
        self.widgets["metric_state"].setText(str(label))
        self.widgets["metric_games"].setText(str(status.get("games", 0)))
        self.widgets["metric_wins"].setText(str(status.get("wins", 0)))
        self.widgets["metric_concede"].setText(str(status.get("concede_count", 0)))
        self.widgets["metric_rate"].setText(f"{status.get('win_rate', 0)}%")
        self.prepare_button.setText("开始对战" if status.get("prepared") else "开始运行（准备）")
        self.overlay_button.setText(f"日志浮窗（{'开' if status.get('overlay_running') else '关'}）")
        self.after_button.setEnabled(running and not status.get("stop_after_game"))
        self.now_button.setEnabled(running)
        self.start_button.setText("开始对战" if status.get("prepared") else "开始挂机")
        self.liveness_state.setText("存活状态：" + str(status.get("liveness", {}).get("status", "等待检测")))
        self.watchdog_state.setText("中断重启：" + str(status.get("watchdog", {}).get("status", "等待检测")))
        self.concede_state.setText("检测状态：" + str(status.get("concede_detect", {}).get("message", "等待自动化运行…")))
        rank = status.get("rank_stop", {})
        self.rank_state.setText(f"段位目标：{'已触发' if rank.get('triggered') else ('已启用' if rank.get('enabled') else '已关闭')}")
        surrender = status.get("surrenders", {})
        self.surrender_state.setText(str(surrender.get("message") or "状态：暂无启用的卡组规则。"))
        delays = status.get("delays") or {}
        delay_map = (("delay_ready", "mulligan_ready_delay_seconds"), ("delay_ocr", "mulligan_post_ocr_delay_seconds"), ("delay_retry", "mulligan_retry_delay_seconds"), ("delay_first", "first_turn_per_card_delay_seconds"), ("delay_pre", "pre_action_delay_seconds"), ("delay_post", "post_action_delay_seconds"), ("delay_draw", "draw_extra_delay_per_card_seconds"), ("delay_choice", "discover_target_delay_seconds"), ("delay_scale", "ocr_preprocess_scale"))
        for key, api_key in delay_map:
            if api_key in delays:
                self.widgets[key].setValue(float(delays[api_key]))
        cfg = status.get("config") or {}
        if cfg.get("name") and not self.widgets["name"].text(): self.widgets["name"].setText(str(cfg["name"]))
        if cfg.get("log_root") and not self.widgets["log_root"].text(): self.widgets["log_root"].setText(str(cfg["log_root"]))
        if status.get("schedule_start"):
            self.schedule_hint.setText(f"计划开始：{status['schedule_start']} · 结束：{status.get('schedule_end') or '未设置'}")

    def _refresh_logs_async(self) -> None:
        run_task(lambda: self.bridge.logs_after(self.log_seq), self._render_logs, lambda error: None)

    def _render_logs(self, value: Any) -> None:
        try:
            lines, seq = value
        except Exception:
            return
        self.log_seq = seq
        for entry in lines:
            if not isinstance(entry, dict) or not self.log_model.accepts(entry):
                continue
            line = f"[{entry.get('level', 'INFO')}] {entry.get('msg', '')}"
            self.log_text.appendPlainText(line)
        if lines and self.autoscroll.isChecked():
            self.log_text.verticalScrollBar().setValue(self.log_text.verticalScrollBar().maximum())

    def _log_message(self, level: str, message: str) -> None:
        self.log_text.appendPlainText(f"[{level}] {message}")

    def _set_log_filter(self, key: str, state: int) -> None:
        self.log_model.enabled[key] = bool(state)

    def _clear_log(self) -> None:
        self.log_text.clear()

    def _selfcheck(self) -> None:
        self._post("/api/selfcheck", {}, lambda result: self.selfcheck_text.setPlainText(json.dumps(result, ensure_ascii=False, indent=2, default=str)))

    def closeEvent(self, event: QCloseEvent) -> None:
        self._status_timer.stop()
        self._log_timer.stop()
        # Let an in-flight status/log request deliver before QApplication tears
        # down the QObject signal source.  This avoids noisy QRunnable errors
        # when the user closes the window during the first dependency import.
        QThreadPool.globalInstance().waitForDone(1500)
        if self.hsbox_process and self.hsbox_process.poll() is None:
            # The launcher owns only the box process it started; leave it alive
            # for a normal close so the user can inspect the game window.
            pass
        event.accept()


def main() -> None:
    app = QApplication.instance() or QApplication(sys.argv)
    app.setApplicationName("HSArriver Turbo")
    window = QtConsole()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
