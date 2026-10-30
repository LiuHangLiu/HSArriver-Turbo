const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEV_ROOT = path.resolve(__dirname, '..');
const PACKAGED_ENGINE_ROOT = path.join(process.resourcesPath, 'engine');
const PACKAGED_BUNDLE_ROOT = path.join(PACKAGED_ENGINE_ROOT, 'HSArriverTurboEngine');
const ENGINE_ROOT = fs.existsSync(path.join(PACKAGED_BUNDLE_ROOT, 'HSArriverTurboEngine.exe'))
  ? PACKAGED_BUNDLE_ROOT
  : fs.existsSync(path.join(PACKAGED_ENGINE_ROOT, 'web_ui.py'))
    ? PACKAGED_ENGINE_ROOT
  : DEV_ROOT;
const PORT_FILE = path.join(ENGINE_ROOT, 'log', 'ui_port.txt');
const DEFAULT_CDP_PORT = 9222;

let mainWindow;
let engineProcess;
let enginePort;
let engineError = '';
let boxProcess;
let boxError = '';

function runtimeRoot() {
  return ENGINE_ROOT;
}

function readJson(file, fallback = {}) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function uiConfigPath() {
  return path.join(runtimeRoot(), 'ui_config.json');
}

function loadUiConfig() {
  return readJson(uiConfigPath(), {});
}

async function saveUiConfig(patch) {
  const current = loadUiConfig();
  const next = { ...current, ...patch };
  const temp = `${uiConfigPath()}.tmp`;
  await fsp.mkdir(path.dirname(temp), { recursive: true });
  await fsp.writeFile(temp, JSON.stringify(next, null, 2), 'utf8');
  await fsp.rename(temp, uiConfigPath());
  return next;
}

function pythonCandidates() {
  if (process.env.HSARRIVER_PYTHON) return [process.env.HSARRIVER_PYTHON];
  if (ENGINE_ROOT !== DEV_ROOT) {
    return [
      path.join(runtimeRoot(), 'HSArriverTurboEngine.exe'),
      path.join(runtimeRoot(), 'python', 'python.exe'),
      'python.exe',
    ];
  }
  return [
    path.join(DEV_ROOT, '.venv-release312', 'Scripts', 'python.exe'),
    path.join(DEV_ROOT, '.venv-release', 'Scripts', 'python.exe'),
    'python.exe',
  ];
}

function spawnEngine() {
  if (engineProcess && !engineProcess.killed) return;
  // A packaged sidecar can inherit a port file from the build workspace. Never
  // trust that file before starting a fresh process; the sidecar rewrites it
  // atomically after it has successfully bound its HTTP port.
  try {
    fs.unlinkSync(PORT_FILE);
  } catch {
    // The file is optional and may not exist on the first launch.
  }
  const script = path.join(runtimeRoot(), 'web_ui.py');
  const bundledEngine = path.join(runtimeRoot(), 'HSArriverTurboEngine.exe');
  const bundled = fs.existsSync(bundledEngine);
  const command = bundled ? bundledEngine : pythonCandidates()[0];
  const args = bundled ? ['--no-browser'] : [script, '--no-browser'];
  engineError = '';
  try {
    engineProcess = spawn(command, args, {
      cwd: runtimeRoot(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    engineError = `${error.name}: ${error.message}`;
    return;
  }
  engineProcess.stdout?.on('data', (data) => {
    engineError = String(data).includes('Traceback') ? String(data).slice(-1000) : engineError;
  });
  engineProcess.stderr?.on('data', (data) => {
    engineError = String(data).slice(-2000);
  });
  engineProcess.on('error', (error) => {
    engineError = `${error.name}: ${error.message}`;
  });
  engineProcess.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      engineError = engineError || `控制引擎退出：code=${code}, signal=${signal}`;
    }
    engineProcess = undefined;
    enginePort = undefined;
  });
}

async function findEnginePort(timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  spawnEngine();
  while (Date.now() < deadline) {
    const raw = await fsp.readFile(PORT_FILE, 'utf8').catch(() => '');
    let port = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(port)) {
      try {
        port = Number(JSON.parse(raw).port);
      } catch {
        port = 0;
      }
    }
    if (port > 0 && port < 65536) {
      enginePort = port;
      return port;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(engineError || '控制引擎未能启动，请查看日志与自检页面。');
}

async function engineRequest(apiPath, method = 'GET', body) {
  const port = enginePort || await findEnginePort();
  const response = await fetch(`http://127.0.0.1:${port}${apiPath}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok && !data?.error) throw new Error(`引擎请求失败：HTTP ${response.status}`);
  return data;
}

function cdpPortFromConfig(config = loadUiConfig()) {
  return Number(config?.recommendation?.port || DEFAULT_CDP_PORT);
}

async function cdpSnapshot(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    const data = await response.json();
    return { connected: true, port, browser: data.Browser || 'CDP' };
  } catch {
    return { connected: false, port, browser: '' };
  }
}

function resolveBoxExecutable(folder) {
  if (!folder) throw new Error('请先填写炉石盒子目录。');
  const root = path.resolve(folder);
  if (root.toLowerCase().endsWith('.exe') && fs.existsSync(root)) return root;
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('盒子目录不存在。');
  }
  const direct = path.join(root, 'HSAng.exe');
  if (fs.existsSync(direct)) return direct;
  const stack = [root];
  while (stack.length) {
    const current = stack.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'hsang.exe') return candidate;
      if (entry.isDirectory() && !entry.name.startsWith('.')) stack.push(candidate);
    }
  }
  throw new Error('目录内没有找到 HSAng.exe。');
}

async function startBox({ folder, port = DEFAULT_CDP_PORT }) {
  if (boxProcess && !boxProcess.killed) return { ok: true, running: true, reused: true };
  const executable = resolveBoxExecutable(folder);
  boxError = '';
  boxProcess = spawn(executable, [
    `--remote-debugging-port=${Number(port)}`,
    '--remote-debugging-address=127.0.0.1',
  ], {
    cwd: path.dirname(executable),
    windowsHide: false,
    stdio: 'ignore',
  });
  boxProcess.on('error', (error) => { boxError = `${error.name}: ${error.message}`; });
  boxProcess.on('exit', (code) => {
    if (code && code !== 0) boxError = `盒子进程退出：${code}`;
    boxProcess = undefined;
  });
  const config = await saveUiConfig({
    hsbox_dir: folder,
    recommendation: {
      ...(loadUiConfig().recommendation || {}),
      source: 'cdp',
      host: '127.0.0.1',
      port: Number(port),
    },
  });
  return { ok: true, running: true, executable, config };
}

async function getStatus() {
  const config = loadUiConfig();
  let engine = { running: false, error: engineError };
  let backend = {};
  try {
    backend = await engineRequest('/api/status');
    engine = { running: true, error: '' };
  } catch (error) {
    engine = { running: false, error: error.message };
  }
  const cdp = await cdpSnapshot(cdpPortFromConfig(config));
  return {
    ...backend,
    engine,
    configFull: config,
    box: {
      running: Boolean(boxProcess && !boxProcess.killed),
      error: boxError,
      directory: config.hsbox_dir || '',
    },
    cdp,
  };
}

const ALLOWED_PATHS = new Set([
  '/api/status', '/api/config', '/api/logs', '/api/selfcheck', '/api/regions',
  '/api/ui_state', '/api/enter_battle', '/api/queue', '/api/check_log',
  '/api/card_search', '/api/start', '/api/prepare', '/api/stop', '/api/cancel',
  '/api/schedule', '/api/schedule/cancel', '/api/calibrate', '/api/ui_learn',
  '/api/restart_hearthstone', '/api/feedback/export', '/api/feedback/status',
  '/api/overlay', '/api/concede', '/api/surrender_rules', '/api/concede_now',
  '/api/rank_stop', '/api/human_like', '/api/liveness', '/api/watchdog',
  '/api/delays', '/api/license/status', '/api/license/activate',
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1680,
    height: 950,
    minWidth: 1360,
    minHeight: 820,
    frame: false,
    backgroundColor: '#0e1726',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  if (!app.isPackaged) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, 'dist-react', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = undefined; });
}

ipcMain.handle('window:control', (_event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  if (action === 'close') mainWindow.close();
});
ipcMain.handle('window:is-maximized', () => Boolean(mainWindow?.isMaximized()));
ipcMain.handle('engine:status', () => getStatus());
ipcMain.handle('engine:request', async (_event, request) => {
  const apiPath = String(request?.path || '');
  if (!ALLOWED_PATHS.has(apiPath.split('?')[0])) throw new Error('未授权的本地接口。');
  return engineRequest(apiPath, request.method || 'GET', request.body);
});
ipcMain.handle('engine:logs', async (_event, seq) => engineRequest(`/api/logs?seq=${Number(seq) || 0}`));
ipcMain.handle('runtime:save-config', async (_event, payload) => {
  const patch = {
    hsbox_dir: String(payload?.hsboxDir || ''),
    recommendation: {
      ...(loadUiConfig().recommendation || {}),
      source: 'cdp',
      host: '127.0.0.1',
      port: Number(payload?.cdpPort || DEFAULT_CDP_PORT),
    },
  };
  return saveUiConfig(patch);
});
ipcMain.handle('runtime:start-box', (_event, payload) => startBox(payload || {}));
ipcMain.handle('runtime:pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? '' : result.filePaths[0];
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  if (engineProcess && !engineProcess.killed) engineProcess.kill();
});
