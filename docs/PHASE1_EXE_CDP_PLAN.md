# 第一阶段技术方案：单 EXE + CDP 推荐读取 + 前台操作

## 1. 目标与边界

### 目标

把当前项目包装成一个 Windows 便携式 EXE 压缩包，用户解压后直接运行即可，不提供安装向导。

交付形式：

- 一个 ZIP 压缩包；
- 解压后包含 `HSArriver.exe`、运行所需资源、Hook 文件、模板和默认配置；
- 不需要点击「下一步」安装；
- 不写入注册表，不依赖固定安装目录；
- 用户可以右键 `HSArriver.exe`，选择「以管理员身份运行」；
- 本机路径、端口和用户配置保存在 EXE 同目录下的本机配置文件中。
- 启动后使用原生桌面客户端，不打开浏览器、不依赖 `localhost` 页面；
- 启动器、挂机控制台、配置、校准、日志和自检全部集中在同一个客户端窗口中。

用户完成以下流程即可开始运行：

1. 启动 `HSArriver.exe`；
2. 填写或选择炉石盒子目录；
3. 点击「启动盒子」；
4. 点击「开始挂机」；
5. 程序自动进入对战、读取盒子推荐、按推荐执行出牌，并持续记录状态和日志。

### 第一阶段明确不做

- 不实现真正后台输入；炉石仍按当前 `click.py` 的前台鼠标/键盘方式操作。
- 不删除炉石界面截图识别；主界面、选卡组、按钮存在性和校准仍可能需要截图。
- 不重写 `Power.log` 状态解析。
- 不实现新的独立策略 AI；策略仍由炉石盒子提供。
- 不修改炉石、炉石盒子安装目录中的 DLL/EXE。
- 不把 CDP 端口暴露到公网或局域网，只绑定 `127.0.0.1`。
- 不把 `web/index.html` 作为运行时界面；它仅作为原有功能清单、交互逻辑和布局参考。
- 不以“简化启动器”替代原有控制台；原 Web 页面已有功能必须在原生客户端中逐项覆盖。

## 2. 目标架构

```text
HSArriver.exe
│
├─ Launcher/UI
│  ├─ 原生单窗口桌面客户端
│  ├─ 授权、盒子目录和 CDP 配置
│  ├─ 启动/停止炉石盒子
│  ├─ 开始/停止挂机
│  ├─ 原 Web 页面全部控制项的桌面化实现
│  └─ 可筛选的实时日志与自检
│
├─ ProcessSupervisor
│  ├─ 查找/启动 Battle.net 与炉石
│  ├─ 查找/启动 HSAng.exe
│  ├─ 检查进程和窗口
│  └─ 检查 Power.log 是否持续更新
│
├─ CdpClient
│  ├─ 请求 http://127.0.0.1:<port>/json/version
│  ├─ 请求 /json/list，选择推荐页面 target
│  ├─ 注入 hsbox_recommend_hook.js
│  ├─ 监听 Runtime.consoleAPICalled 或读取事件缓存
│  └─ 自动处理页面刷新和 target 变化
│
├─ RecommendationAdapter
│  ├─ 原始推荐 JSON → 统一 ProposedAction
│  ├─ 去重、序号、时间戳和回合号校验
│  └─ CDP 字段缺失时返回明确错误
│
├─ Existing Engine
│  ├─ Power.log / log_state.py
│  ├─ FSM_action.py
│  ├─ recommendation_flow.py
│  ├─ click.py
│  └─ battle_entry.py
│
└─ Diagnostics
   ├─ 结构化 JSONL 日志
   ├─ CDP 原始事件保存
   ├─ 错误截图
   └─ 一键导出诊断包
```

## 3. 模块改造计划

### 3.1 新增模块

建议新增：

- `src/cdp/cdp_client.py`：CDP HTTP/WebSocket 连接、target 发现、重连。
- `src/cdp/hsbox_events.py`：Hook 注入、事件订阅和事件缓存读取。
- `src/cdp/recommendation_adapter.py`：盒子推荐 JSON 转为项目已有的 `ProposedAction`。
- `src/launcher/process_supervisor.py`：启动和监控炉石、盒子、控制台进程。
- `src/launcher/config_store.py`：保存盒子目录、CDP 端口、炉石日志目录等本机配置。
- `native_console.py`：原生桌面主窗口；不直接运行 `web/index.html`。
- `phase1_launcher.py`：PyInstaller 稳定入口，转交给原生桌面客户端。
- 原生页面覆盖：概览、挂机控制、投降规则、段位目标、人性化、延迟设置、校准、日志与自检。
- `LogFilterModel`：统一操作日志、推荐日志、CDP 原始 JSON、Power.log 和调试日志的筛选与展示。

### 3.2 保留模块

- `FSM_action.py`：继续作为对战状态机。
- `src/flow/recommendation_flow.py`：继续负责等待、动作消费、校验、重试。
- `log_state.py` / `power_log.py`：继续提供回合、实体、手牌和玩家状态。
- `click.py`：继续执行前台鼠标、拖拽、键盘动作。
- `battle_entry.py`：继续负责进入传统对战、选卡组和界面确认。
- `display_mapping.py` / `window_tracker.py`：继续负责坐标换算。
- `feedback.py` / `battle_record.py`：继续保留错误反馈和结构化日志。

### 3.3 降级模块

以下模块先保留，但不作为 CDP 正常路径：

- `src/capture/desktop_capture.py`
- `src/ocr/paddle_adapter.py`
- `src/parser/recommendation_parser.py`

推荐读取路径应为：

```text
CDP JSON → RecommendationAdapter → ProposedAction → RecommendationFlow
```

OCR 路径作为备用：

```text
截图 → PaddleOCR → recommendation_parser.py → ProposedAction
```

### 3.4 原生客户端 UI 需求

`web/index.html` 不作为运行时页面，但它当前提供的功能必须 100% 迁移到原生客户端。这里的 100% 指功能和可配置项覆盖，不要求像素级复刻网页样式。

必须覆盖的功能分组：

| 左侧菜单 | 必须覆盖的内容 |
|---|---|
| 概览 | 授权状态、盒子状态、CDP 状态、炉石状态、当前对局、统计和最近动作 |
| 挂机控制 | 准备、开始、停止、局后停止、浮窗、运行状态和安全停止 |
| 投降规则 | 自动投降、胜率阈值、卡组识别、卡牌搜索、规则增删改 |
| 段位目标 | 当前段位、目标段位、保分阈值、达到目标后的停止策略 |
| 人性化 | 手牌悬停、敌方随从悬停、动作随机延迟和移动行为 |
| 延迟设置 | 出牌、推荐等待、换牌、结束回合、结算等延迟配置 |
| 校准 | 推荐区域、换牌区域、胜率、段位、主菜单、卡组网格、模式按钮等区域校准 |
| 日志与自检 | 实时日志、服务状态、环境检查、诊断信息和导出诊断包 |

客户端顶部还应保留：

- 卡密激活/续期和授权有效期；
- 炉石盒子目录选择；
- CDP 端口和连接状态；
- 启动盒子、开始挂机、立即停止三个主操作；
- 当前运行状态、最后动作和错误提示。

日志面板必须允许用户自行勾选显示类别：

```text
[x] 操作日志
[x] 推荐日志
[ ] CDP 原始 JSON
[ ] Power.log
[ ] 调试日志
```

日志要求：

1. 在客户端窗口中实时显示；
2. 可按类别单独开启或关闭；
3. 操作日志显示动作、目标、执行结果和失败原因；
4. 推荐日志显示推荐来源、回合号、动作名称、卡牌和原始摘要；
5. CDP 原始 JSON 可单独打开，便于补充未知动作字段；
6. 所有类别仍写入本地结构化日志文件，不因关闭界面显示而丢失；
7. 支持暂停滚动、清空显示和导出诊断包。

UI 方案图：

![原生客户端总览](images/ui/phase1-native-console-overview.png)

![剩余菜单页面预览](images/ui/phase1-native-console-pages.png)

以上图片是功能布局参考稿，最终实现应以实际控件可用性、配置保存和现有接口兼容为准。

## 4. 推荐 JSON 字段与已验证映射

附件 `示例json.txt` 是实际对局中由 `tools.rar` 只读采集器跑出来的真实回调 JSON，不是手工构造样本。当前已经拿到真实推荐事件；推荐不是页面 DOM 文本，而是盒子宿主通过以下 window callback 推送给 CEF 页面：

- `onUpdateLadderActionRecommend`：当前标准对战推荐主回调，第一阶段优先接入；
- `onUpdateArenaRecommend`：已能安装 Hook，但当前样本没有真实竞技场动作数据；
- `onUpdateWinrateData`：胜率预测信息，只做诊断/展示，不作为出牌指令。

### 4.1 已确认的外层事件结构

采集器输出的事件外层保持统一格式：

```json
{
  "schema": 1,
  "kind": "recommendation",
  "callback": "onUpdateLadderActionRecommend",
  "captured_at": "2026-10-29T13:45:51.224Z",
  "target": {
    "id": "612366B54BED3C50CEC59644DF644673",
    "url": "https://hs-web-embed.lushi.163.com/client-jipaiqi/ladder-opp",
    "title": "炉石盒子记牌器"
  },
  "payload": {
    "status": 2,
    "error": "",
    "turnNum": 2,
    "optionId": 2,
    "choiceId": -1,
    "data": []
  },
  "raw_args": ["原始 JSON 字符串"]
}
```

适配器必须保留 `payload` 和 `raw_args`，并将原始事件写入 JSONL 日志；`raw_args` 不能直接作为业务字段解析后丢弃。

### 4.2 已确认的推荐动作

当前样本已经确认以下动作和字段：

```json
{
  "status": 2,
  "error": "",
  "turnNum": 2,
  "optionId": 2,
  "choiceId": -1,
  "data": [
    {
      "actionName": "play_minion",
      "card": {
        "ZONE_POSITION": 4,
        "cardId": "TOY_518",
        "cardName": "宝藏经销商"
      },
      "position": 1,
      "using_disguised": 0
    }
  ]
}
```

已确认的动作映射：

| `actionName` | 含义 | 已确认字段 |
|---|---|---|
| `replace` | 换牌/调度 | `card[]`、每张牌的 `ZONE_POSITION`、`cardId`、`cardName` |
| `play_minion` | 打出随从 | `card.ZONE_POSITION`、`cardId`、`cardName`、`position`、`using_disguised` |
| `play_special` | 打出法术/特殊牌 | `card.ZONE_POSITION`、`cardId`、`cardName`、`using_disguised` |
| `end_turn` | 结束回合 | 无额外字段 |

`data` 是动作数组，因此一条推荐可能要求连续执行多个动作，例如“打出幸运币 → 结束回合”。`optionId` 当前样本呈递增变化，可作为推荐版本候选字段；最终去重键仍应组合 `target.id`、`callback`、`turnNum`、`optionId` 和 payload 摘要，不能只使用时间戳。

### 4.3 通过盒子前端源码可推断的动作协议

`lushibox/template/src/components/action-group/index.tsx` 已经明确列出了前端能够渲染的 `actionName`，`src/views/ladder/recommend.tsx` 也明确了推荐对象字段。因此，不需要为“动作名称和字段名”逐一等待实战 JSON：

| 动作名 | 前端读取的字段 | 说明 |
|---|---|---|
| `end_turn` | 无 | 结束回合 |
| `replace` | `card[]` | 换牌，数组中的牌使用 `ZONE_POSITION/cardId/cardName` |
| `play_minion` | `card/target/oppTarget/targetHero/oppTargetHero/subOption/position/using_disguised` | 打出随从，可带目标、选择和站位 |
| `play_special` | `card/target/oppTarget/targetHero/oppTargetHero/subOption` | 打出法术/特殊牌 |
| `play_weapon` | 同上 | 打出武器 |
| `play_hero` | 同上 | 打出英雄牌 |
| `play_location` | 同上 | 打出地标 |
| `hero_skill` | `card/target/oppTarget/targetHero/oppTargetHero/subOption` | 使用英雄技能 |
| `minion_attack` | `card + target/oppTarget/targetHero/oppTargetHero` | 随从攻击 |
| `hero_attack` | `card + target/oppTarget/targetHero/oppTargetHero` | 英雄攻击 |
| `location_power` | `card + target/oppTarget/targetHero/oppTargetHero` | 使用地标能力 |
| `titan_power` | `card + target/oppTarget/targetHero/oppTargetHero` | 使用泰坦能力 |
| `launch_starship` | `card + target/oppTarget/targetHero/oppTargetHero` | 发射星舰 |
| `forge` | `card` | 锻造 |
| `trade` | `card` | 交易 |
| `prepare` | `card` | 预备动作 |
| `common_action` | `card + target/oppTarget/targetHero/oppTargetHero/subOption` | 通用卡牌动作 |
| `choice` | `target/oppTarget` | 选择一个目标牌 |
| `choose` | `card[]` | 选择一张牌，主要用于竞技场/选择界面 |
| `discard` | `card[]` | 舍弃牌，主要用于竞技场/选择界面 |
| `assemble` | `target` | 拼装，前端读取 `target.ZONE_POSITION` |

前端还会把兼容字段名归一化：`opp-target-hero → oppTargetHero`、`opp-target → oppTarget`、`target-hero → targetHero`。因此适配器应同时接受原始连字符字段和归一化后的驼峰字段，内部统一成一种格式。

### 4.4 源码推断的边界

前端源码能确认“有哪些动作”和“UI 读取哪些字段”，但不能单独证明以下运行时语义：

- `target/oppTarget` 中的 `ZONE_POSITION` 是随从、英雄还是其它实体；
- `targetHero/oppTargetHero` 的真假组合和目标对象是否同时存在；
- `subOption` 的具体结构，以及选项后是否还要再次选目标；
- `position` 的坐标/站位编号方向，以及 `using_disguised` 的枚举含义；
- `status` 的完整枚举、非空 `error` 语义和动作不可执行时的返回方式；
- `onUpdateArenaRecommend` 的竞技场 payload 与 `choose/discard` 的完整约束。

因此实现策略调整为：附件中已经实际出现的 `replace`、`play_minion`、`play_special`、`end_turn` 直接按真实 JSON 实现和测试；前端源码已列出但附件中尚未出现的动作，可以先实现字段适配框架，第一次遇到未知目标组合、未知动作值或字段校验失败时保存原始 JSON 并安全暂停，再补充针对该动作的实战样本。

### 4.5 采集器行为对正式实现的影响

`tools.rar` 中的参考脚本已经验证以下实现方式可行：

- 仅连接 `127.0.0.1:9222`，通过 `/json/list` 发现 page target；
- 对每个 target 使用 `Page.addScriptToEvaluateOnNewDocument` 和 `Runtime.evaluate` 注入 Hook；
- 通过 setter 包装 callback，兼容 callback 先定义或后定义的页面；
- 监听 `Runtime.consoleAPICalled`，用专用 marker 过滤页面普通日志；
- 每 2 秒重新扫描 target，页面刷新或 target 消失时重连；
- 只读盒子已经收到的推荐，不请求推荐服务、不操作炉石、不修改盒子目录。

正式的 `src/cdp/cdp_client.py`、`hsbox_events.py` 应以此行为为基线；其中 Node.js 参考脚本可作为验收工具，但不直接作为最终 EXE 的运行入口。

### 4.6 允许迭代开发，不要求一次拿齐全部动作 JSON

当前附件已经提供真实对局 JSON，因此可以立即开始开发，不需要等待地标、英雄技能、攻击、发现/抉择等所有动作样本齐全。

第一批直接实现并编写回归测试：

1. `replace`：换牌/调度；
2. `play_minion`：打出随从；
3. `play_special`：打出法术或特殊牌；
4. `end_turn`：结束回合。

开发测试分为两层：

- 离线测试：使用附件中的真实 JSON 文件，验证 JSON 解析、字段归一化、动作去重、`ProposedAction` 转换和错误处理；
- 实战测试：连接本机 CDP，进入真实对局；遇到前端源码已列出但当前样本没有的动作时，自动保存完整原始事件，再针对该动作补适配和回归用例。

未知动作或字段组合的默认策略必须是“记录并安全暂停”，不能猜测点击坐标或直接执行。这样可以在不破坏现有 FSM、Power.log 和 `click.py` 的情况下逐步扩展动作覆盖范围。

## 5. 启动流程

```text
用户点击「启动盒子」
    ↓
校验盒子目录 / HSAng.exe
    ↓
发现或启动炉石盒子，并带 --remote-debugging-port=9222
    ↓
验证 /json/version 和 /json/list
    ↓
找到推荐页面 target
    ↓
注入 Hook
    ↓
确认 Hook 已安装，显示「CDP 已连接」

用户点击「开始挂机」
    ↓
检查管理员权限、炉石窗口、日志目录、账号状态
    ↓
启动/恢复 FSM
    ↓
Power.log 更新 → FSM 推进
盒子推荐 JSON → RecommendationAdapter → RecommendationFlow
    ↓
click.py 前台执行
    ↓
记录推荐、动作、结果、重试和错误
```

## 6. EXE 打包与交付方案

第一阶段使用 `PyInstaller --onedir`，再将整个输出目录压缩为 ZIP；不建议一开始使用单文件 `--onefile`：

- PaddleOCR/OpenCV/PaddlePaddle 等依赖体积大，单文件启动时解压慢；
- 模型、模板、`cards.json`、默认配置和 Hook 文件需要稳定的相对路径；
- `--onedir` 更容易定位依赖缺失和收集错误日志；
- 压缩包解压后即可运行，不需要安装程序；
- 资源目录和 EXE 保持相对路径，便于移动到其它目录或机器；
- 后续如果 CDP 路径稳定，可以把 OCR 依赖拆成可选的 fallback 包。

EXE 仍需要 Windows 管理员权限。交付包不自动提权、不绕过 UAC；用户直接双击运行时可以显示权限不足提示，推荐右键 EXE 选择「以管理员身份运行」。

推荐压缩包结构：

```text
HSArriver-Phase1.zip
└─ HSArriver-Phase1/
   ├─ HSArriver.exe
   ├─ _internal/                 # PyInstaller 运行库
   ├─ assets/                    # 模板、Hook、界面资源
   ├─ cards.json
   ├─ config.example.json
   ├─ README.txt                 # 解压后运行说明
   └─ logs/                      # 运行时自动创建/写入
```

## 7. 用户需要提供或确认的内容

### 必须提供

1. 一台可以实际运行炉石和炉石盒子的测试环境；
2. 炉石盒子的实际安装目录；
3. 炉石盒子启动后实际使用的版本；
4. 进入一局真实对战，打开推荐面板；
5. CDP Hook 捕获到的真实推荐事件 JSON；
6. 至少覆盖普通出牌、攻击、目标法术、换牌、发现/抉择、结束回合的样本。

### 需要确认

- 是否接受程序启动时请求管理员权限；
- 是否允许程序自动重启炉石；
- 是否允许程序自动重启炉石盒子；
- 默认使用标准、狂野还是休闲；
- 默认卡组是否由用户点击选择，还是固定卡组序号；
- CDP 失败时是否自动降级到 OCR；
- 是否保存原始推荐 JSON 到 `logs/`；
- 是否保留现有网页控制台，还是第一阶段只提供桌面 EXE；
- 「开始挂机」是否只启动自动化，还是还要自动点击「开始匹配」；
- 发生推荐无法解析、炉石卡死或窗口失焦时，默认停止还是重试。

### 不需要用户提供

- 不需要提供炉石盒子内部源码；
- 不需要提供账号密码或 CDK；
- 不需要提供炉石客户端源码；
- 不需要提供机器固定路径，路径应保存在本机配置中，不入库；
- 不需要另外提供 hongguo 授权接口地址、字段文档或协议样本，直接复用 `D:\workplace\hongguo` 当前实现。

## 8. 第一阶段验收标准

### 启动与连接

- EXE 能发现或启动炉石盒子；
- 能验证 CDP 端口和页面 target；
- 页面刷新或 target 更换后能自动重连；
- Hook 安装失败时明确显示原因，不假装已连接。

### 推荐读取

- 能把真实推荐 JSON 转成已有 `ProposedAction`；
- 同一推荐不会重复执行；
- 推荐变化能及时通知 `recommendation_flow.py`；
- 推荐字段不完整时安全停止并保存原始 JSON。

### 对战执行

- 现有 FSM 可以正常进入对战、换牌、出牌、结束回合和结算；
- `click.py` 仍只点击炉石窗口，不误点其它窗口；
- 失去前台或炉石被遮挡时能告警并停止；
- Ctrl+Q 和界面停止按钮仍然有效。

### 可恢复性

- 炉石崩溃或 Power.log 停止更新时能停止或按配置重启；
- 炉石盒子退出时能提示重新启动；
- 日志中能区分 CDP 原始事件、适配后的动作和最终点击结果。

### 原生客户端覆盖

- EXE 启动后直接进入原生桌面窗口，不打开浏览器；
- 启动器和挂机控制台在同一个窗口内完成；
- `web/index.html` 中的功能分组、配置项、校准项和操作按钮均有对应的原生控件；
- 用户可以在客户端内完成授权、选择盒子目录、启动盒子、开始挂机和停止挂机；
- 操作日志、推荐日志、CDP 原始 JSON、Power.log、调试日志均可独立勾选显示；
- 关闭某类日志显示只影响界面过滤，不影响本地结构化日志落盘；
- 客户端重启后能恢复上次保存的本机配置，不写入仓库或硬编码机器路径。

## 9. 实施顺序

1. 使用附件中的真实 JSON 完成 CDP 事件模型和离线回归测试；
2. 编写 `RecommendationAdapter`，先接入 `replace`、`play_minion`、`play_special`、`end_turn`；
3. 连接真实 CDP，边测试边采集未知动作并增量补齐适配器；
4. 在保留 OCR fallback 的情况下跑通一局真实对战；
5. 增加进程启动、CDP 重连和配置保存；
6. 将原 Web 页面功能逐项迁移到原生桌面客户端，并补齐日志筛选；
7. 增加桌面客户端启动、配置恢复和授权状态联动；
8. 使用 `PyInstaller --onedir` 打包并压缩成 ZIP；
9. 在干净 Windows 环境验收“解压 → 右键以管理员身份运行”的流程；
10. 最后再决定是否移除默认 OCR 依赖。

当前便携包构建命令：

```powershell
\.venv-release312\Scripts\python.exe tools\build_phase1.py
```

如旧版输出目录仍被正在运行的 EXE 占用，可使用新的包名构建：

```powershell
$env:HSARRIVER_BUILD_NAME = "HSArriverTurbo-Desktop"
\.venv-release312\Scripts\python.exe tools\build_phase1.py
```

## 10. 当前最大风险

第一阶段的唯一硬前置是：**必须拿到真实对局中 HSAng 推荐回调的字段结构**。当前仓库只验证了 CDP 端口、页面 target 和 Hook 注入，不代表已经验证推荐 JSON 的完整格式。若实际对局没有稳定回调，就只能继续保留 OCR 主路径，或先做“CDP 优先、OCR fallback”的混合方案。

## 11. 设备注册与授权生命周期

### 11.1 目标

第一阶段加入独立的设备注册和租约校验。EXE 启动后先确认本机授权状态，只有授权状态可用时才启用「启动盒子」和「开始挂机」。授权服务不可用时，不影响打开设置、查看设备 ID、查看日志和导出诊断信息，但不能绕过授权启动自动化。

优先复用 `D:\workplace\hongguo` 已有的授权服务接口和协议，不另起一套注册服务。HSArriver 只实现授权客户端适配层，通过配置接入现有服务；不复制服务端私钥、管理凭据或本机专属配置：

```text
本机硬件 UUID
    ↓ 只在本机计算
SHA-256(hsarriver-device-v1:win32:<uuid>)
    ↓
设备 fingerprint（64 位小写十六进制）

本机生成 Ed25519 设备密钥
    ↓ 设备公钥 + fingerprint 注册
授权服务发放签名租约
    ↓
EXE 使用内置服务公钥验签
    ↓
active / offline / expired / disabled / online-required
```

### 11.2 本机唯一标识

Windows 第一阶段建议使用 `Win32_ComputerSystemProduct.UUID` 作为硬件来源：

- 读取失败、空值、全 0、全 F 时拒绝注册，不降级成随机安装 ID；
- 原始 UUID 不发送给服务器；
- 服务器只收到带产品前缀和平台信息的 SHA-256 fingerprint；
- UI 默认只显示 fingerprint 前 12 位，完整值只用于诊断/管理；
- 同一硬件重装 EXE 时，如果设备密钥仍在本机安全存储中，应保持同一设备身份。

本机设备密钥：

- 使用 Ed25519 生成公钥/私钥；
- 私钥使用 Windows DPAPI 或 Windows Credential Manager 加密保存；
- 私钥不写入日志、不上传、不打包进 ZIP、不提交 Git；
- EXE 内只内置授权服务 URL 和服务端签名公钥；
- 服务端签名私钥只保存在服务器，不能放在客户端。

### 11.3 最小服务接口

第一阶段优先直接使用 `hongguo` 已提供的接口、请求签名方式、租约格式、错误码和状态语义。只有在现有接口缺少 HSArriver 所需字段时，才增加兼容字段或版本化扩展，不修改已有客户端的兼容行为。

建议通过本机配置指定以下兼容参数：

```json
{
  "license": {
    "serviceBaseUrl": "https://api.hgapp.shop",
    "protocolVersion": "hongguo-license-v1",
    "trustedKeyId": "prod-2026-01",
    "trustedPublicKey": "oGTHWFKptcDwJZYVdIsB6yH3EqdddTnv1BeLrmJ5mWA"
  }
}
```

以上为 `D:\workplace\hongguo\hongguo-desktop\src\native\license-config.json` 当前生产配置：服务域名为 `https://api.hgapp.shop`，服务端公钥为公开验签公钥，不是服务端私钥。HSArriver 打包时可以沿用该公开配置；如果 hongguo 后续轮换 `kid` 或公钥，只更新公开配置并保留旧 key 的兼容校验策略。

开发环境仅允许使用 hongguo 已定义的 loopback 服务，例如 `http://127.0.0.1:18080`；生产 EXE 不允许使用未配置的服务地址，也不接受服务端响应动态下发信任根。

第一阶段 EXE 实际调用以下 4 个客户端接口。HSArriver 不调用 hongguo 的自动试用接口，所有授权必须输入卡密：

#### 获取挑战

```http
POST https://api.hgapp.shop/api/v1/license/challenge
Content-Type: application/json
```

请求：

```json
{
  "action": "activate",
  "device": {
    "fingerprint": "64-char-sha256",
    "publicKey": "base64url-ed25519-public-key",
    "platform": "win32",
    "appVersion": "0.1.0"
  }
}
```

`action` 使用 `activate` 或 `refresh`。挑战为一次性数据，默认有效 300 秒，并绑定 action、设备 fingerprint、公钥和平台信息。

响应：

```json
{
  "code": 0,
  "data": {
    "challengeId": "server-generated-id",
    "nonce": "server-generated-random-value",
    "expiresAt": 1800000300
  }
}
```

#### 激活/注册设备

```http
POST https://api.hgapp.shop/api/v1/license/activate
Content-Type: application/json
```

请求：

```json
{
  "challengeId": "challenge-id",
  "signature": "base64url-ed25519-signature",
  "cardCode": "HG-XXXX-XXXX",
  "device": {
    "fingerprint": "64-char-sha256",
    "publicKey": "base64url-ed25519-public-key",
    "platform": "win32",
    "appVersion": "0.1.0"
  }
}
```

设备首次出现时由该接口完成注册和激活，客户端不新增 `/register` 接口。`cardCode` 按 hongguo 规则先 trim、转 ASCII 大写后参与摘要：

```text
hongguo-license-v1\n{action}\n{challengeId}\n{nonce}\n{fingerprint}\n{cardDigest}
```

其中 `cardDigest = SHA256(normalizeCardCode(cardCode))` 的小写十六进制，Ed25519 签名结果使用 base64url 无填充编码。refresh 时 `cardDigest` 为空字符串且不发送 `cardCode`。

授权凭证使用 hongguo 当前支持的卡密字段：

- 卡密；

后台预授权、续期和停用由 hongguo 管理端完成，不由客户端伪造“已授权”。

#### 试用卡激活

HSArriver 不使用 `POST /api/v1/license/trial` 的自动试用逻辑，也不在界面提供“免费领取试用”按钮。需要试用时，由 hongguo 管理端生成 `plan=trial`、有效期 1 天的试用卡，用户在 HSArriver 中输入卡密，仍然调用现有的：

```http
POST https://api.hgapp.shop/api/v1/license/activate
```

这样试用和正式授权使用同一套 challenge、设备签名、卡密激活和租约校验。试用卡的有效期、绑定设备、重复使用和停用规则全部由服务端控制，客户端不自行判断或延长试用时间。

说明：`hongguo` 服务端仍保留 `/trial` 路由，是为了兼容 hongguo 自身客户端；HSArriver 不调用它。如果要全局关闭 hongguo 的自动试用，需要另行把服务配置中的 `trialEnabled` 关闭。

#### 刷新租约

```http
POST https://api.hgapp.shop/api/v1/license/refresh
Content-Type: application/json
```

刷新前先请求 `challenge(action=refresh)`，然后提交：

```json
{
  "challengeId": "challenge-id",
  "signature": "base64url-ed25519-signature",
  "device": {
    "fingerprint": "64-char-sha256",
    "publicKey": "base64url-ed25519-public-key",
    "platform": "win32",
    "appVersion": "0.1.0"
  }
}
```

刷新请求必须包含设备身份和签名，不能只凭 fingerprint 刷新，也不发送 cardCode。

#### 查询状态

```http
POST https://api.hgapp.shop/api/v1/license/status
Authorization: Bearer <lease-token>
Content-Type: application/json
```

请求 body 为 `{}`，只允许查询当前设备，不接受客户端传入任意设备 ID 查询其它设备。

### 11.3.1 统一响应和错误码

四个接口统一返回 JSON envelope：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

成功使用 `code=0`。客户端至少处理以下 hongguo 业务码：

```text
40101 INVALID_CARD       卡密无效
40102 DEVICE_MISMATCH    卡密已绑定其它设备
40103 EXPIRED            权益到期
40104 DISABLED           授权停用
40105 PROOF_INVALID      设备签名验证失败
40106 CHALLENGE_EXPIRED  挑战过期或已使用
40107 KEY_MISMATCH       设备密钥不一致
40108 ALREADY_PERMANENT  已是永久授权
40109 RECOVERY_REQUIRED  原设备密钥恢复需人工处理
40110 TRIAL_NOT_AVAILABLE 临时卡不可用或已使用
42901 RATE_LIMITED       请求频繁
```

网络超时、HTTP 5xx、服务不可用不能直接等同于 `DISABLED` 或 `EXPIRED`；只有经过 `refresh/status` 明确返回整体设备停用或到期，才撤销本地可用状态。

激活或刷新成功时，`data` 至少包含：

```json
{
  "token": "header.payload.signature",
  "serverTime": 1800000000,
  "refreshAfter": 1800021600
}
```

服务端返回的 `token` 只作为本地缓存和 `status` 查询凭据，客户端必须先完成本地 JWS 验签，不能只根据 `code=0` 放行挂机。

### 11.4 生命周期租约

服务端返回 hongguo 兼容的 Ed25519 签名 compact JWS/JWT。Header 必须包含 `typ=JWT`、`alg=EdDSA` 和已配置的 `kid=prod-2026-01`：

```json
{
  "iss": "hongguo-service",
  "aud": "hongguo",
  "sub": "device-id",
  "fingerprint": "64-char-sha256",
  "deviceKey": "base64url-public-key",
  "plan": "monthly",
  "permanent": false,
  "entitlementExpiresAt": 1802592000,
  "revision": 1,
  "iat": 1800000000,
  "exp": 1800259200
}
```

建议先沿用 `hongguo` 的生命周期参数：

- 租约最长 72 小时；
- 正常在线每 6 小时刷新；
- 每次启动优先联网刷新；
- 普通网络短暂失败时允许继续使用尚未过期的签名租约；
- 租约到期、设备被停用、设备公钥不匹配时停止自动化；
- 系统时间明显回拨时进入 `online-required`，联网重新校验后才能恢复；
- 租约 `exp` 不能晚于实际套餐到期时间；
- 永久权益也必须使用有限期离线租约，不能生成永不过期的客户端 token。

客户端必须校验：签名、`kid`、`alg`、签发者、受众、设备 fingerprint、公钥、`iat`、`exp`、套餐和 revision。不能只看服务端返回的文字状态。

### 11.5 本机授权状态

EXE 对外显示以下状态：

```text
unregistered     尚未注册
active           在线授权有效
offline          网络暂时不可用，但本地租约仍有效
expired          套餐或租约已过期
disabled         服务器停用设备
online-required  需要联网重新验证，例如检测到时间回拨
device-mismatch  设备指纹或公钥与服务器绑定不一致
```

自动化入口必须判断结构化字段 `usable=true/false`，不能根据状态文字自行放行。

### 11.6 本地存储与恢复

本机建议保存：

- 加密设备私钥；
- 最近一次服务端租约；
- `lastServerTime`、`lastLocalTime`、`refreshAfter`；
- 授权状态和最近错误码；
- 不保存卡密明文到日志。

第一阶段不开放自助换绑。若设备私钥丢失：

- 默认返回 `RECOVERY_REQUIRED`；
- 不允许仅凭客户端重新生成的 fingerprint 覆盖服务器公钥；
- 如果将来需要恢复，可参考 `hongguo` 的加密密钥备份，但必须由原硬件指纹、备份密码和在线签名共同证明。

### 11.7 服务端最小数据模型

建议至少有以下数据：

```text
devices
  id, fingerprint(unique), public_key, platform, app_version,
  status, created_at, last_seen_at

entitlements
  id, device_id, plan, starts_at, expires_at, revision, disabled

license_events
  id, device_id, action, outcome, error_code, created_at
```

服务端必须使用唯一约束和事务处理：

- 同一 fingerprint + publicKey 重试应幂等；
- 同一 fingerprint + 不同 publicKey 默认拒绝；
- challenge 一次性、短时有效并绑定完整设备身份；
- 设备停用/恢复需要有审计事件；
- 日志不保存私钥、完整 token、卡密和原始硬件 UUID。

### 11.8 启动流程补充

```text
启动 HSArriver.exe
    ↓
读取/生成本机设备指纹和设备密钥
    ↓
验证本地缓存租约
    ↓
联网注册或刷新租约
    ↓
显示授权状态
    ↓
usable=true 才启用「启动盒子」/「开始挂机」
    ↓
启动盒子 → CDP 连接 → 开始自动化
    ↓
后台定时刷新租约，但不因普通网络抖动立即打断当前动作
```

### 11.9 与 hongguo 的兼容边界

- 复用 hongguo 的注册、激活、刷新、状态查询接口时，HSArriver 仅组装 hongguo 现有的设备字段：`fingerprint`、`publicKey`、`platform`、`appVersion`；
- 复用 hongguo 的 challenge、Ed25519 设备签名、JWS/JWT 租约、`exp` 和错误码校验；
- 当前协议的 `iss/aud` 保持 `hongguo-service/hongguo`，不擅自替换成 `hsarriver`；如果服务端未来增加产品隔离，再按兼容协议增加产品映射；
- 客户端不保存或上传 hongguo 服务端私钥、后台凭据、卡密明文和原始硬件 UUID；
- 接口地址、字段名、签名串、`kid`、租约算法和错误码直接以 `D:\workplace\hongguo` 当前源码与 `license-config.json` 为准，不再要求用户额外提供接口资料；
- HSArriver 的产品标识只在本地配置中保留兼容扩展位；当前请求按 hongguo 现有字段发送，不强行加入服务端尚未定义的 `productId`，也不改变既有请求签名。

### 11.10 需要用户确认的授权事项

第一阶段已按以下结论实现，不再阻塞开发：

1. 只使用卡密激活；不调用自动 `/trial`。一天试用由服务端生成 `plan=trial` 卡密；
2. 复用 hongguo 的 `https://api.hgapp.shop`、Ed25519、72 小时租约和刷新机制；
3. 设备私钥丢失不自助换绑，按 hongguo 的 `RECOVERY_REQUIRED` 处理；
4. 网络短暂失败允许有效租约继续，租约到期或设备停用则禁止启动/继续挂机。

### 11.11 第一阶段代码落点与启动方式

当前实现已经落到以下文件：

- `src/cdp/hsbox_events.py`：回调 JSON 校验、字段归一化、事件去重和 JSONL 留痕；
- `src/cdp/cdp_client.py`：仅连接 `127.0.0.1` 的 CDP 发现、注入监听和回调接收；
- `src/cdp/recommendation_adapter.py`：把已确认的 `replace`、`play_minion`、`play_special`、`end_turn` 转为现有 `ProposedAction`；
- `src/cdp/recommendation_reader.py`：给现有 `RecommendationFlow` 提供 CDP evidence，不截图；
- `src/license/`：设备身份、卡密激活、租约验签和状态读取；
- `phase1_launcher.py`：便携启动界面；
- `tools/build_phase1.py`：PyInstaller onedir 构建并生成 ZIP。

交付形态不是安装包：解压 ZIP 后直接运行 `HSArriverTurbo-Phase1/HSArriverTurbo-Phase1.exe`，需要点击操作时由用户以管理员权限启动。启动器流程为：输入卡密并激活 → 选择炉石盒子目录 → 点击“启动盒子” → 点击“开始挂机”。启动器会写入本机 `ui_config.json`，选择 `recommendation.source=cdp`；原有 OCR 默认仍保留作兼容回退。

第一阶段仍有两项真实环境验收：确认炉石盒子实际 CDP 进程接受的端口参数，以及确认目标页面回调 JSON 的完整动作覆盖。未知动作不会盲点，会写入 `logs/hsbox_cdp_events.jsonl` 并安全重试/暂停；后续可直接从该日志增加适配器单测，不需要重写 FSM。
### 11.12 新增验收标准

- 新设备能生成稳定 fingerprint 和 Ed25519 公钥；
- 注册请求必须经过 challenge + 设备签名；
- 服务端签发的租约能在客户端离线验签；
- 篡改 token、换设备、公钥不匹配、过期、停用和时间回拨均不能启动挂机；
- 普通网络失败不会误撤销尚未过期的有效租约；
- 同一设备重复注册不会重复创建设备或重复消耗授权；
- 客户端 ZIP 中没有服务端私钥、管理凭据、卡密和本机原始 UUID；
- 授权状态、错误码和刷新记录可在本地日志中追踪，但日志不泄露敏感凭据。
