# 炉石盒子 CEF 页面读取方案交接文档

日期：2026-10-28

## 目标

在不修改炉石盒子安装文件、不绕过 `HSAExternal` 安全校验的前提下，读取盒子 CEF 页面执行后的 DOM/JS 回调，实时获取：

- AI 推荐打法；
- 推荐胜率；
- 记牌器或其他页面推送信息。

如果无法开放 CEF 调试接口，则退回当前项目已有的截图/OCR 方案。

## 已确认的前端链路

本地网页源码位置：`lushibox/template`。

推荐页面不是主动调用 `standard_substep` 接口，而是等待宿主程序回调：

- `src/views/ai-recommend/index.tsx`：注册 `window.onUpdateArenaRecommend`；
- `src/views/ladder/recommend.tsx`：注册 `window.onUpdateLadderActionRecommend`；
- `src/views/winrate-predict/index.tsx`：注册 `window.onUpdateWinrateData`。

这些回调收到的内容通常是 JSON 字符串，然后由 React 页面解析并渲染。

`packages/api2/dist/index.mjs` 中的 `HsboxClient` 使用：

- `window.app.setMessageCallback()`；
- `window.app.sendMessage()`；
- `window.ds.callHandler('callLsBox', ...)`。

这些主要是网页向宿主发送命令/获取配置。源码中没有发现 `recommend`、`winrate`、`standard_substep` 的直接调用方法，因此推荐和胜率更可能是宿主/插件获取后反向推送到上述全局回调。

相关文件：

- `lushibox/template/src/views/ai-recommend/index.tsx`
- `lushibox/template/src/views/winrate-predict/index.tsx`
- `lushibox/template/packages/api2/dist/index.mjs`

## 对盒子程序的静态分析结论

涉及程序：

- `HSAng.exe`：主宿主程序；
- `HSAExternal.exe`：外部/插件通信程序；
- `QtCefWebView.dll`：CEF WebView 封装；
- `hsaplugins/MessagePush.dll`；
- `hsaplugins/VideoPlugin.dll`；
- `hsaplugins/VideoEditor.dll`。

### CEF 能力

`QtCefWebView.dll` 中发现以下能力/字符串：

- `ExecuteJavaScript`；
- `Show DevTools`；
- `RegisterProcessMessageDelegates`；
- `external-devtools`；
- `CefFrame`/CEF WebView 相关代码。

这说明宿主内部具备执行 JS 和打开 DevTools 的能力，但不代表普通用户界面一定暴露了这些入口。

### HSAExternal 通信

`HSAExternal.exe` 中发现：

- Apache Thrift 的 `SubscribeService`、`PublishService`；
- `callMethodInJson`；
- 命名管道 `\\.\pipe\`；
- `HSA2hsa-ipc-handshake`；
- HMAC/AES、进程身份校验、nonce/timestamp/replay 检查。

因此不能把 `HSAExternal` 当作普通 HTTP API 使用，也不应尝试绕过其握手或身份校验。

### 插件通信

静态字符串显示：

- `MessagePush.dll` 支持 `subscribe`、`publish`、`messageReceived`；
- `VideoPlugin.dll` 能接收 `game state message`、`game history message`；
- `VideoEditor.dll` 包含 `enableCardRecommend`、`enableStandardAIWinRateCurve`、`enableAIRecommendMark`、`winRate` 等配置字段。

目前没有发现公开的推荐主题名或插件 SDK，因此这些只能作为后续官方插件接口分析线索。

## 关键突破：CEF 远程调试可用

在测试电脑上，使用以下方式启动 `HSAng.exe` 后，远程调试成功开放：

```powershell
& '<盒子安装目录>\HSAng.exe' '--remote-debugging-port=9222'
```

验证命令：

```powershell
Invoke-RestMethod 'http://127.0.0.1:9222/json/version'
```

成功时应看到：

- `Browser` 类似 `Chrome/108...`；
- `Protocol-Version`；
- `webSocketDebuggerUrl`，例如 `ws://127.0.0.1:9222/devtools/browser/...`。

查看页面目标：

```powershell
(Invoke-WebRequest 'http://127.0.0.1:9222/json/list' -UseBasicParsing).Content
```

成功时会返回页面目标及其 `webSocketDebuggerUrl`。之前测试中曾看到：

- `https://hs-web.lushi.163.com/client-home/`；
- `https://hs-web.lushi.163.com/static/html/JiPai_wel.html`。

这证明当前盒子的 CEF 实例支持 CDP，之前的 `9618` 端口不是 CDP。

官方参考：

- [CEF remote_debugging_port](https://cef-builds.spotifycdn.com/docs/113.1/structcef__settings__t.html)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [CDP DOM.getOuterHTML](https://chromedevtools.github.io/devtools-protocol/tot/DOM/)

## 已创建的被动 Hook

文件：`tools/hsbox_recommend_hook.js`

它监听：

- `window.onUpdateArenaRecommend`；
- `window.onUpdateLadderActionRecommend`；
- `window.onUpdateWinrateData`。

特点：

- 保留并继续调用原始回调；
- 只记录参数；
- 不发送网络请求；
- 不修改盒子文件；
- 数据暂存到 `window.__HSBOX_EVENTS`；
- 最近一条数据在 `window.__HSBOX_LAST_EVENT`。

Hook 通过 CDP 注入，而不是放到盒子安装目录。

## CDP 注入思路

连接页面目标的 WebSocket 后，执行两个动作：

1. `Page.addScriptToEvaluateOnNewDocument`：保证后续页面加载时自动注入；
2. `Runtime.evaluate`：立即注入当前已经加载的页面。

验证 Hook 是否安装：

```js
JSON.stringify({
  url: location.href,
  hooked: [
    'onUpdateArenaRecommend',
    'onUpdateLadderActionRecommend',
    'onUpdateWinrateData'
  ].map(k => ({
    name: k,
    hooked: !!window['__HSBOX_HOOK_' + k]
  }))
})
```

读取已捕获事件：

```js
JSON.stringify({
  events: window.__HSBOX_EVENTS || [],
  last: window.__HSBOX_LAST_EVENT || null
})
```

## 当前测试结果

已确认：

- `--remote-debugging-port=9222` 生效；
- `/json/version` 返回有效 CDP 信息；
- `/json/list` 可以列出 CEF 页面；
- Hook 已成功注入页面；
- CDP 监听器已成功收到 Hook 安装日志。

尚未确认：

- 实际进入一局后是否触发推荐回调；
- 推荐 JSON 的完整字段结构；
- 胜率回调的完整字段结构；
- 推荐页是否始终复用同一个 CDP page target。

上次测试没有收到推荐数据的原因是页面仍停留在 `client-home`，没有进入实际对局/推荐页面；当时 `window.__HSBOX_EVENTS` 为空。

## 另一台电脑的验证步骤

1. 确认盒子安装目录中存在 `HSAng.exe`。
2. 关闭正在运行的盒子，避免重复实例。
3. 用带参数方式启动：

   ```powershell
   & '<盒子安装目录>\HSAng.exe' '--remote-debugging-port=9222'
   ```

4. 验证端口：

   ```powershell
   Invoke-RestMethod 'http://127.0.0.1:9222/json/version'
   ```

5. 获取页面目标：

   ```powershell
   (Invoke-WebRequest 'http://127.0.0.1:9222/json/list' -UseBasicParsing).Content
   ```

6. 将 `tools/hsbox_recommend_hook.js` 通过 CDP 注入当前 `type=page` 的目标。
7. 进入炉石对局，打开盒子推荐面板。
8. 查询：

   ```js
   hsboxReadEvents()
   ```

9. 记录实际返回的 JSON，重点关注：

   - 推荐动作名称；
   - 卡牌 ID/名称；
   - 目标实体；
   - `status`、`error`；
   - 胜率字段名和数值格式。

## 后续实现方向

### 方向 A：CDP 结构化采集，优先推荐

编写一个 Python 采集器：

1. 请求 `/json/list`；
2. 找到当前盒子页面的 `webSocketDebuggerUrl`；
3. 使用 `websockets` 连接；
4. 注入 Hook；
5. 监听 `Runtime.consoleAPICalled` 或周期性读取 `window.__HSBOX_EVENTS`；
6. 将 JSON 写入当前项目的日志系统；
7. 后续把结构化推荐适配到 `src/flow/recommendation_flow.py`。

需要处理页面刷新/新 target：页面 target 改变时重新注入 Hook。

### 方向 B：CDP 直接读取 DOM

如果推荐信息只存在渲染后的 DOM 中，可以使用：

- `DOM.getDocument`；
- `DOM.getOuterHTML`；
- `Runtime.evaluate('document.documentElement.outerHTML')`。

但推荐页面当前已知存在宿主回调，因此优先读取回调 JSON，而不是从 DOM 反推。

### 方向 C：继续 OCR

如果另一台电脑的盒子不接受 `--remote-debugging-port`，则不能从外部读取 DOM。此时继续使用当前项目的截图/OCR路径：

- `src/capture/desktop_capture.py`；
- `src/flow/recommendation_flow.py`；
- `src/parser/recommendation_parser.py`。

当前项目已有推荐区域 OCR 和动作解析；胜率需要单独确认 ROI 和 OCR 解析逻辑。

## 不建议做的事

- 不要修改盒子安装目录中的 DLL/EXE；
- 不要绕过 `HSAExternal` 的 HMAC/AES/进程身份握手；
- 不要安装 HTTPS 中间人证书去改写第三方 HTTPS 页面；
- 不要 DLL 注入或修改宿主进程内存；
- 不要把 CDP 端口绑定到公网或局域网；
- 只使用 `127.0.0.1`，测试结束后正常退出盒子即可关闭端口。

## 给下一个 AI 的直接任务提示

```text
请继续分析当前项目和炉石盒子 CEF 页面。

已知：HSAng.exe 支持 --remote-debugging-port=9222；访问
http://127.0.0.1:9222/json/version 可以得到 webSocketDebuggerUrl。
项目已有 tools/hsbox_recommend_hook.js，它被动监听：
onUpdateArenaRecommend、onUpdateLadderActionRecommend、onUpdateWinrateData。

下一步请：
1. 连接 /json/list 中的 page target；
2. 通过 Page.addScriptToEvaluateOnNewDocument 和 Runtime.evaluate 注入 Hook；
3. 监听 Runtime.consoleAPICalled 或读取 window.__HSBOX_EVENTS；
4. 等待实际进入对局后记录推荐/胜率 JSON；
5. 根据真实字段把结构化数据接入 src/flow/recommendation_flow.py；
6. 如果没有回调，检查是否产生了新的 page target，并对新 target 重新注入。

不要修改盒子安装文件，不要绕过 HSAExternal 握手，不要安装 HTTPS 中间人证书。
```
