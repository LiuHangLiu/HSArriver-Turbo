# 给下一位 AI 的项目接手提示词

请在 `D:\workplace\HSArriver-Turbo` 目录继续开发 HSArriver-Turbo。你的任务是基于现有代码进行定位、修复和增量开发，不要脱离当前架构重新造一个项目。

## 必须先阅读

1. `AGENTS.md`：这是本仓库的执行规则，优先级最高。
2. `docs/AI_HANDOFF.md`：项目用途、架构、目录职责、UI、CDP、校准、日志、授权和打包说明。
3. `docs/PHASE1_EXE_CDP_PLAN.md`：第一阶段完整技术方案和验收标准。
4. `docs/HSANG_CEF_DOM_CAPTURE_HANDOFF.md`：炉石盒子 CDP/CEF Hook 的验证结果。
5. `README.md`、`docs/FEATURES.md`、`docs/CLI.md`：原有引擎功能和命令行入口。

## 项目用途

这是一个 Windows 炉石传说自动化挂机辅助程序。最终形态是 Electron + React 的便携式桌面客户端，解压后直接运行 EXE，不要求用户打开浏览器或访问 `127.0.0.1:5173`。

用户流程是：输入卡密授权 → 选择炉石盒子目录 → 启动 `HSAng.exe` → 通过本机 CDP 读取盒子推荐 → 点击开始挂机 → 由现有前台操作/FSM 在炉石窗口执行动作。

## 不要破坏的架构边界

- Electron/React 只负责桌面 UI、配置、按钮、状态和日志展示。
- `desktop/main.js` 负责 Electron 窗口、Python 引擎、炉石盒子进程、目录选择、IPC 白名单和状态汇总。
- `desktop/preload.js` 是安全 IPC 桥，React 不直接使用 Node.js API。
- `web_ui.py` 是 Python 本地控制服务、日志中心、授权桥接和自动化生命周期入口。
- CDP 只负责读取炉石盒子的推荐、AI 胜率和 Hook 事件，不负责操作炉石。
- `src/cdp/` 负责 CDP 连接、事件读取和推荐适配。
- `src/flow/recommendation_flow.py`、`FSM_action.py`、`click.py` 是现有动作执行主链，不要在 React 内复制或重写。
- `Power.log` 用于游戏状态/实体解析的兜底路径，不是盒子推荐主来源。
- 截图和 OCR 仍用于炉石窗口、按钮、选卡组、模式、段位和校准；不能因为接入 CDP 就全部删除。
- 授权复用 `D:\workplace\hongguo` 的现有接口和协议，不要自行新增授权服务、自动试用逻辑或绕过授权。

## 当前重要产品决策

1. 客户端布局必须保持目标深色 UI：顶部标题栏、左侧八项菜单、中央内容区、右侧实时日志、底部状态栏。
2. 概览页必须显示授权状态、盒子状态、CDP 状态、炉石状态四张卡。
3. 未授权状态使用黄色；CDP 已连接使用绿色；盒子或炉石退出后状态不能继续显示绿色旧状态。
4. 卡密激活入口和概览页授权卡放在一起，不要做成孤立页面。
5. 挂机控制不要求用户填写炉石 Logs 目录；CDP 主链路不依赖手填 Power.log 路径。
6. 游戏未启动时，段位目标页的当前段位和排名必须为空，不能显示伪造的默认值。
7. CDP 推荐和 AI 胜率不需要校准，也不能出现在校准目标列表中。
8. 校准采用“11 版固定示意图 + 14 版真实落地”：
   - `desktop/src/assets/calibration-preview.png` 是固定示意图，展示全部区域；
   - 真实校准通过 `POST /api/calibrate` 启动 `calibrate_roi.py` 的透明屏幕校准层；
   - Electron 启动真实校准后自动最小化，用户直接在炉石画面拖动当前目标框；
   - 当前目标切换只影响真实校准层和右侧坐标，不改变固定示意图；
   - `GET /api/regions?all=1&meta=1` 是元数据读取，不应为了显示坐标抓桌面截图。
9. 右侧日志必须可单独勾选：操作日志、推荐日志、CDP 原始 JSON、Power.log、调试日志。
10. CDP 断开时应显示明确提示，例如“未监听到 CDP 日志：未启动 HSAng.exe，请确认已启动，并确认只监听 127.0.0.1”；连接后应显示真实 `hook-installed` 原始 JSON。

## 排查问题时的顺序

遇到 bug 不要先凭 UI 猜测，也不要马上重写模块。按以下顺序：

1. 执行 `git status --short`，确认没有把用户参考资料、日志、压缩包或本机配置加入提交。
2. 先查相关测试、`/api/status`、`/api/logs`、引擎启动输出和 Python traceback。
3. 确认问题属于 Electron、IPC、Python API、CDP、FSM、窗口/坐标还是日志分类。
4. 在原有职责层修复，优先增加最小回归测试。
5. 只有确认代码需要改动后才编辑文件；编辑使用 `apply_patch`。
6. 修改后运行 `git diff --check`、相关 Python 测试和 `desktop` 下的前端测试/构建。

## CDP 重点

- 默认端口是 `9222`，只允许 `127.0.0.1`。
- 启动参数必须包含：

```text
--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
```

- Hook 回调目前关注：`onUpdateArenaRecommend`、`onUpdateLadderActionRecommend`、`onUpdateWinrateData`。
- 适配器必须保留完整 raw event、`payload` 和 `raw_args`。
- 未知动作先记录原始 JSON 并安全暂停/重试，不允许盲点。
- 普通日志和 CDP 高频原始事件要分流，避免日志文件无限增长；当前实现已经有内存日志环、JSONL 事件记录和运行日志裁剪逻辑。

## 主要代码位置

- Electron：`desktop/main.js`、`desktop/preload.js`、`desktop/src/main.jsx`、`desktop/src/styles.css`
- Python 控制层：`web_ui.py`
- 校准：`calibrate_roi.py`、`screen_regions.py`、`region_overlay.py`
- CDP：`src/cdp/cdp_client.py`、`src/cdp/recommendation_reader.py`、`src/cdp/recommendation_adapter.py`
- 执行：`src/flow/recommendation_flow.py`、`FSM_action.py`、`click.py`
- 游戏状态：`power_log.py`、`log_state.py`、`battle_entry.py`、`window_tracker.py`
- 授权：`src/license/identity.py`、`src/license/client.py`；服务协议参考 `D:\workplace\hongguo`
- 测试：`tests/` 和 `desktop/test/`
- 旧 Web 参考：`web/index.html`，只用于功能对照，不是运行时客户端页面

## 不能删除的内容

不要删除 `docs/`、`tools/`、`assets/`、`web/index.html`、`lushibox/`、`lushibox.zip`、`tools/lushihook.zip`、`mermaid-diagram.png` 或用户提供的示例素材。它们是协议、Hook、旧功能、参考项目或 UI 资料。

可以清理的仅限编译/打包/缓存/运行产物，例如 `build/`、根目录 `dist/`、`desktop/dist-react/`、`desktop/engine-build/`、`desktop/node_modules/`、`__pycache__/`、`.venv-release*`、运行日志和临时截图；删除前先确认没有正在运行的 EXE 占用文件。

## 测试和构建

可以生成 Windows 便携 EXE/ZIP，但必须先恢复被清理的构建依赖和 Python sidecar。`npm run build:zip` 不会自动生成 `desktop/engine-build`，它假定 sidecar 已经存在。

在干净 Windows 环境首次构建时按以下顺序执行：

```powershell
cd D:\workplace\HSArriver-Turbo
py -3.12 -m venv .venv-release312
.\.venv-release312\Scripts\python.exe -m pip install -r requirements.txt
.\.venv-release312\Scripts\python.exe -m pip install pyinstaller
.\.venv-release312\Scripts\python.exe tools/build_electron_engine.py

cd desktop
npm ci
npm test
npm run build:zip
```

其中 `tools/build_electron_engine.py` 使用 `desktop_engine.spec` 生成 `desktop/engine-build/HSArriverTurboEngine/HSArriverTurboEngine.exe`；Electron Builder 再把它和 Python 资源放进 `resources/engine`。最终 ZIP 位于 `desktop/dist/`，解压后运行 `HSArriver Turbo.exe`。如果机器没有 `py` 命令，使用已确认可用的 Python 3.12 解释器替换它，不要把本机绝对路径写进代码或 Git。

Electron 命令必须在 `desktop/` 执行：

```powershell
cd D:\workplace\HSArriver-Turbo\desktop
npm test
npm run build:react
npm run build:dir
npm run build:zip
```

Python 侧按当前环境执行：

```powershell
python -m py_compile web_ui.py screen_regions.py calibrate_roi.py desktop_engine.py
python -m pytest -q
```

不要把 `node_modules`、构建目录、便携包、日志、用户路径、卡密、token、设备私钥提交到 Git。未经用户明确要求不要 `git push`。

## 你开始工作时的第一条回复

先用不超过 3 行说明：

1. 已读取哪些规则/交接文档；
2. 当前 `git status` 和测试状态；
3. 你准备修复的具体问题或需要用户确认的唯一阻塞项。

如果用户只要求分析或评审，不要擅自修改代码；如果用户明确要求修复，先复现，再改动，再测试，并报告具体文件和测试结果。
