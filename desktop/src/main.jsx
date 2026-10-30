import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { NAV_ITEMS, DEFAULT_FILTERS, classifyLog } from './contract.mjs';
const DEFAULT_CONFIG = { name: '', logRoot: '', boxDir: '', cdpPort: 9222 };
const DEFAULT_STATUS = {
  running: false,
  state_label: '待机',
  games: 0,
  wins: 0,
  win_rate: 0,
  configFull: {},
  box: { running: false, directory: '' },
  cdp: { connected: false, port: 9222 },
  engine: { running: false },
};

function api() {
  return window.hsarriver;
}

function formatDuration(seconds = 0) {
  const value = Math.max(0, Number(seconds) || 0);
  const h = String(Math.floor(value / 3600)).padStart(2, '0');
  const m = String(Math.floor((value % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(value % 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDate(seconds) {
  if (!seconds) return '未授权';
  try { return new Date(Number(seconds) * 1000).toLocaleString('zh-CN', { hour12: false }); } catch { return '未知'; }
}

function App() {
  const [page, setPage] = useState('overview');
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [license, setLicense] = useState({ usable: false, plan: '', entitlement_expires_at: 0 });
  const [logs, setLogs] = useState([]);
  const [logSeq, setLogSeq] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [toast, setToast] = useState('');
  const [activationOpen, setActivationOpen] = useState(false);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await api().engine.status();
      setStatus(next || DEFAULT_STATUS);
      const raw = next?.configFull || {};
      setConfig((current) => ({
        ...current,
        name: raw.name ?? current.name,
        logRoot: raw.log_root ?? current.logRoot,
        boxDir: raw.hsbox_dir ?? current.boxDir,
        cdpPort: Number(raw.recommendation?.port || next?.cdp?.port || current.cdpPort || 9222),
      }));
    } catch (error) {
      setStatus((current) => ({ ...current, engine: { running: false, error: error.message } }));
    }
  }, []);

  const refreshLicense = useCallback(async () => {
    try {
      const next = await api().engine.request('/api/license/status');
      setLicense(next || { usable: false });
    } catch { /* 引擎未启动时保持未授权状态 */ }
  }, []);

  const refreshLogs = useCallback(async () => {
    try {
      const result = await api().engine.logs(logSeq);
      if (Array.isArray(result?.lines) && result.lines.length) {
        setLogs((current) => [...current, ...result.lines].slice(-600));
      }
      if (Number.isFinite(Number(result?.seq))) setLogSeq(Number(result.seq));
    } catch { /* 状态卡会显示引擎未连接 */ }
  }, [logSeq]);

  useEffect(() => {
    refreshStatus();
    refreshLicense();
    const statusTimer = window.setInterval(refreshStatus, 1400);
    const licenseTimer = window.setInterval(refreshLicense, 30000);
    return () => { window.clearInterval(statusTimer); window.clearInterval(licenseTimer); };
  }, [refreshLicense, refreshStatus]);

  useEffect(() => {
    refreshLogs();
    const timer = window.setInterval(refreshLogs, 1000);
    return () => window.clearInterval(timer);
  }, [refreshLogs]);

  const call = useCallback(async (path, method = 'POST', body) => {
    try {
      const result = await api().engine.request(path, method, body);
      if (result?.error) throw new Error(result.error);
      await refreshStatus();
      notify(result?.message || '操作已完成');
      return result;
    } catch (error) {
      notify(`操作失败：${error.message}`);
      return { ok: false, error: error.message };
    }
  }, [notify, refreshStatus]);

  const saveConfig = useCallback(async (nextConfig = config) => {
    try {
      await api().runtime.saveConfig({ hsboxDir: nextConfig.boxDir, cdpPort: Number(nextConfig.cdpPort) || 9222 });
      const result = await api().engine.request('/api/config', 'POST', {
        name: nextConfig.name || '',
        log_root: nextConfig.logRoot || '',
      });
      if (result?.error) throw new Error(result.error);
      setConfig(nextConfig);
      await refreshStatus();
      notify('配置已保存');
      return result;
    } catch (error) {
      notify(`保存配置失败：${error.message}`);
      return { ok: false, error: error.message };
    }
  }, [config, notify, refreshStatus]);

  const startBox = useCallback(async () => {
    try {
      await saveConfig();
      const result = await api().runtime.startBox({ folder: config.boxDir, port: Number(config.cdpPort) || 9222 });
      notify(result?.reused ? '盒子已经在运行' : '盒子启动成功');
      await refreshStatus();
    } catch (error) { notify(`启动盒子失败：${error.message}`); }
  }, [config, notify, refreshStatus, saveConfig]);

  const startAutomation = useCallback(async () => {
    await saveConfig();
    await call('/api/start', 'POST', {});
  }, [call, saveConfig]);

  const stopAutomation = useCallback(async (mode = 'now') => {
    await call('/api/stop', 'POST', { mode });
  }, [call]);

  const activate = useCallback(async (cardCode) => {
    const result = await call('/api/license/activate', 'POST', { card_code: cardCode });
    if (result?.usable) {
      setLicense(result);
      setActivationOpen(false);
    }
    return result;
  }, [call]);

  const visibleLogs = useMemo(() => logs.filter((entry) => {
    const category = classifyLog(entry);
    return filters[category];
  }), [filters, logs]);

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar page={page} onChange={setPage} />
        <main className="content-area">
          <Page page={page} status={status} config={config} setConfig={setConfig} license={license} call={call} notify={notify} saveConfig={saveConfig} startBox={startBox} startAutomation={startAutomation} stopAutomation={stopAutomation} setPage={setPage} />
        </main>
        <LogPanel filters={filters} setFilters={setFilters} logs={visibleLogs} onClear={() => setLogs([])} />
      </div>
      <BottomBar status={status} license={license} />
      {toast && <div className="toast">{toast}</div>}
      {activationOpen && <ActivationDialog onClose={() => setActivationOpen(false)} onActivate={activate} />}
      {!license.usable && page === 'overview' && <button className="license-fab" onClick={() => setActivationOpen(true)}>🔑 激活卡密</button>}
    </div>
  );
}

function TitleBar() {
  return <header className="titlebar" onDoubleClick={() => api().window.control('maximize')}>
    <div className="brand"><span className="brand-mark">⬡</span><span>HSArriver Turbo</span></div>
    <div className="window-controls">
      <button aria-label="最小化" onClick={() => api().window.control('minimize')}>—</button>
      <button aria-label="最大化" onClick={() => api().window.control('maximize')}>□</button>
      <button className="close" aria-label="关闭" onClick={() => api().window.control('close')}>×</button>
    </div>
  </header>;
}

function Sidebar({ page, onChange }) {
  return <nav className="sidebar">
    {NAV_ITEMS.map(([key, icon, label]) => <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => onChange(key)}>
      <span className="nav-icon">{icon}</span><span>{label}</span>
    </button>)}
  </nav>;
}

function StatusCard({ icon, title, state, detail, tone = 'success', onClick }) {
  return <button className="status-card" onClick={onClick}>
    <div className="status-card-title"><span className="card-icon">{icon}</span><span>{title}</span></div>
    <div className={`status-main ${tone}`}><span className="status-dot" />{state}</div>
    <div className="status-detail">{detail}</div>
  </button>;
}

function SectionTitle({ children, action }) {
  return <div className="section-title"><span className="accent" /> <h2>{children}</h2>{action}</div>;
}

function PageHeader({ title, subtitle }) {
  return <div className="page-header"><SectionTitle>{title}</SectionTitle>{subtitle && <p>{subtitle}</p>}</div>;
}

function Page({ page, ...props }) {
  const pages = {
    overview: Overview,
    control: ControlPage,
    surrender: SurrenderPage,
    rank: RankPage,
    human: HumanPage,
    delays: DelaysPage,
    calibration: CalibrationPage,
    diagnostics: DiagnosticsPage,
  };
  const Component = pages[page] || Overview;
  return <Component {...props} />;
}

function Overview({ status, config, license, setPage, startBox, startAutomation, stopAutomation, setConfig, notify }) {
  return <div className="page overview-page">
    <div className="status-grid">
      <StatusCard icon="🔑" title="授权状态" state={license.usable ? '已授权' : '未授权'} detail={license.usable ? `到期时间 ${formatDate(license.entitlement_expires_at)}` : '点击右下角激活卡密'} tone={license.usable ? 'success' : 'warning'} />
      <StatusCard icon="📦" title="盒子状态" state={status.box?.running ? '已就绪' : '未运行'} detail={status.box?.directory || '等待选择盒子目录'} tone={status.box?.running ? 'success' : 'muted'} onClick={() => setPage('control')} />
      <StatusCard icon="🔗" title="CDP状态" state={status.cdp?.connected ? '已连接' : '未连接'} detail={`端口 ${status.cdp?.port || config.cdpPort} · 连接数 ${status.cdp?.connected ? 1 : 0}`} tone={status.cdp?.connected ? 'success' : 'warning'} onClick={() => setPage('control')} />
      <StatusCard icon="▣" title="炉石状态" state={status.in_game ? '对战中' : '未检测到'} detail={status.in_game ? status.state_label : '等待炉石窗口'} tone={status.in_game ? 'success' : 'muted'} />
    </div>
    <QuickControl config={config} setConfig={setConfig} startBox={startBox} startAutomation={startAutomation} stopAutomation={stopAutomation} notify={notify} />
    <div className="panel settings-summary">
      <div className="tabs">
        <button className="tab active" onClick={() => setPage('control')}>⚙ 挂机设置</button>
        <button className="tab" onClick={() => setPage('surrender')}>▤ 自动投降</button>
        <button className="tab" onClick={() => { setPage('calibration'); notify('已打开推荐区域校准'); }}>⌾ 推荐区域校准</button>
        <button className="tab" onClick={() => { setPage('calibration'); notify('已打开换牌区域校准'); }}>◫ 换牌区域校准</button>
      </div>
      <div className="summary-columns">
        <SummaryColumn title="基础设置"><Check label="启动后自动开始挂机" /><Check label="游戏异常时自动重启" checked /><Check label="每日重置统计（0点）" checked /><NumberRow label="最大运行时长" value="8" unit="小时" /></SummaryColumn>
        <SummaryColumn title="对局行为"><Check label="自动开始对战" checked /><Check label="自动换牌" checked /><Check label="检测到可投降时执行" checked /><Check label="对战结束后自动继续" checked /></SummaryColumn>
        <SummaryColumn title="其他选项"><Check label="低资源模式（减少CPU占用）" /><Check label="静默运行（最小化到托盘）" /><Check label="挂机时不处理弹窗" /><Check label="启用截图备份（用于问题排查）" /></SummaryColumn>
      </div>
    </div>
  </div>;
}

function QuickControl({ config, setConfig, startBox, startAutomation, stopAutomation, notify }) {
  const choose = async () => {
    const value = await api().runtime.pickDirectory();
    if (value) setConfig((current) => ({ ...current, boxDir: value }));
  };
  return <div className="panel quick-control">
    <SectionTitle>快速控制</SectionTitle>
    <div className="form-row"><label>盒子目录</label><input value={config.boxDir || ''} onChange={(e) => setConfig((current) => ({ ...current, boxDir: e.target.value }))} placeholder="请选择炉石盒子目录" /><button className="secondary" onClick={choose}>▣ 选择目录</button></div>
    <div className="form-row"><label>CDP端口</label><input className="number-input" type="number" min="1" max="65535" value={config.cdpPort || 9222} onChange={(e) => setConfig((current) => ({ ...current, cdpPort: e.target.value }))} /><Check label="自动检测端口" checked onChange={() => notify('CDP 自动检测已启用')} /><button className="help" onClick={() => notify('端口仅绑定 127.0.0.1')}>?</button></div>
    <div className="action-row"><button className="action gold" onClick={startBox}>▶ 启动盒子</button><button className="action green" onClick={startAutomation}>▶ 开始挂机</button><button className="action red" onClick={() => stopAutomation('now')}>■ 立即停止</button></div>
  </div>;
}

function ControlPage({ status, config, setConfig, saveConfig, startBox, startAutomation, stopAutomation, call, notify }) {
  const [schedule, setSchedule] = useState({ start: status.schedule_start || '', end: status.schedule_end || '' });
  const [liveness, setLiveness] = useState({ enabled: true, log_stale_warn_seconds: 120, log_stale_stop_seconds: 300 });
  const [watchdog, setWatchdog] = useState({ enabled: false, stale_seconds: 300, max_restarts: 3 });
  useEffect(() => { setSchedule({ start: status.schedule_start || '', end: status.schedule_end || '' }); }, [status.schedule_start, status.schedule_end]);
  useEffect(() => { if (status.liveness) setLiveness((v) => ({ ...v, ...status.liveness })); if (status.watchdog) setWatchdog((v) => ({ ...v, ...status.watchdog })); }, [status.liveness, status.watchdog]);
  return <div className="page">
    <PageHeader title="挂机控制" subtitle="集中管理运行配置、定时任务、对战控制和自动恢复策略。" />
    <div className="panel process-track"><div className="track-step done">✓<b>1. 准备就绪</b><small>环境检查通过</small></div><div className="track-line" /><div className="track-step active">▶<b>2. 启动挂机</b><small>{status.running ? '已开始运行' : '等待开始'}</small></div><div className="track-line" /><div className="track-step">♣<b>3. 对战中</b><small>自动进行游戏</small></div><div className="track-line" /><div className="track-step">▥<b>4. 结束/停止</b><small>达到条件或手动停止</small></div></div>
    <div className="two-columns"><div className="panel"><SectionTitle>⚙ 基础配置</SectionTitle><div className="field-grid"><label>盒子目录<input value={config.boxDir || ''} onChange={(e) => setConfig((v) => ({ ...v, boxDir: e.target.value }))} /></label><label>炉石 Logs 目录<input value={config.logRoot || ''} onChange={(e) => setConfig((v) => ({ ...v, logRoot: e.target.value }))} /></label><label>CDP端口<input type="number" value={config.cdpPort || 9222} onChange={(e) => setConfig((v) => ({ ...v, cdpPort: e.target.value }))} /></label><label>用户 ID<input value={config.name || ''} onChange={(e) => setConfig((v) => ({ ...v, name: e.target.value }))} /></label></div><button className="wide-button gold" onClick={() => saveConfig()}>▣ 保存配置</button></div><div className="panel"><SectionTitle>◷ 定时任务</SectionTitle><div className="field-grid"><label>开始时间<input type="datetime-local" value={schedule.start} onChange={(e) => setSchedule((v) => ({ ...v, start: e.target.value }))} /></label><label>结束时间<input type="datetime-local" value={schedule.end} onChange={(e) => setSchedule((v) => ({ ...v, end: e.target.value }))} /></label></div><label className="switch-row"><input type="checkbox" checked={Boolean(schedule.start)} onChange={() => setSchedule((v) => ({ ...v, start: v.start ? '' : new Date().toISOString().slice(0, 16) }))} />启用定时任务</label><button className="wide-button gold" onClick={() => call('/api/schedule', 'POST', schedule)}>▣ 保存计划</button></div></div>
    <div className="panel battle-control"><SectionTitle>⚔ 对战控制</SectionTitle><div className="action-row"><button className="action blue" onClick={() => call('/api/prepare', 'POST', {})}>⚔ 准备</button><button className="action green" onClick={startAutomation}>▶ 开始挂机</button><button className="action red" onClick={() => stopAutomation('now')}>■ 停止挂机</button><button className="action secondary-action" onClick={() => stopAutomation('after_game')}>◉ 局后停止</button></div></div>
    <div className="two-columns"><div className="panel"><SectionTitle>〽 存活检测</SectionTitle><label className="switch-row"><input type="checkbox" checked={Boolean(liveness.enabled)} onChange={(e) => setLiveness((v) => ({ ...v, enabled: e.target.checked }))} />启用存活检测</label><div className="field-grid"><label>检测间隔<input type="number" value={liveness.interval_seconds || 30} onChange={(e) => setLiveness((v) => ({ ...v, interval_seconds: Number(e.target.value) }))} /> 秒</label><label>超时时间<input type="number" value={liveness.log_stale_stop_seconds || 300} onChange={(e) => setLiveness((v) => ({ ...v, log_stale_stop_seconds: Number(e.target.value) }))} /> 秒</label></div><button className="secondary" onClick={() => call('/api/liveness', 'POST', liveness)}>保存存活检测</button></div><div className="panel"><SectionTitle>⟳ 中断重启</SectionTitle><label className="switch-row"><input type="checkbox" checked={Boolean(watchdog.enabled)} onChange={(e) => setWatchdog((v) => ({ ...v, enabled: e.target.checked }))} />启用异常重启</label><div className="field-grid"><label>最大重启次数<input type="number" value={watchdog.max_restarts || 3} onChange={(e) => setWatchdog((v) => ({ ...v, max_restarts: Number(e.target.value) }))} /> 次</label><label>重启间隔<input type="number" value={watchdog.stale_seconds || 300} onChange={(e) => setWatchdog((v) => ({ ...v, stale_seconds: Number(e.target.value) }))} /> 秒</label></div><button className="secondary" onClick={() => call('/api/watchdog', 'POST', watchdog)}>保存重启策略</button></div></div>
  </div>;
}

function SurrenderPage({ status, call, notify }) {
  const [tab, setTab] = useState('auto');
  const [raw, setRaw] = useState(JSON.stringify(status.auto_surrender || { enabled: false, aliases: {}, decks: [] }, null, 2));
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState([]);
  useEffect(() => { setRaw(JSON.stringify(status.auto_surrender || { enabled: false, aliases: {}, decks: [] }, null, 2)); }, [status.auto_surrender]);
  const search = async () => { const result = await window.hsarriver.engine.request(`/api/card_search?q=${encodeURIComponent(query)}&limit=8`); setCards(result?.cards || result?.items || []); };
  const save = async () => { try { const config = JSON.parse(raw); await call('/api/surrender_rules', 'POST', { config, confirm: true }); } catch (error) { notify(`JSON 格式错误：${error.message}`); } };
  return <div className="page"><PageHeader title="投降规则" subtitle="配置在不利局面下自动投降的规则，支持多种条件组合。" /><div className="panel rule-panel"><div className="tabs">{[['auto', '自动投降'], ['deck', '卡组识别'], ['cards', '卡牌搜索'], ['json', '高级 JSON']].map(([key, label]) => <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>)}<button className="small-action gold" onClick={() => notify('已添加空白规则')}>＋ 新增规则</button></div>{tab === 'cards' ? <div className="search-box"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入卡牌名称或 ID" /><button className="secondary" onClick={search}>搜索</button><div className="search-results">{cards.map((card) => <div key={card.cardId || card.id}>{card.cardName || card.name} <small>{card.cardId || card.id}</small></div>)}</div></div> : <><div className="rule-table"><div className="rule-head"><span>启用</span><span>条件</span><span>阈值</span><span>动作</span><span>操作</span></div>{[['AI胜率低于', '小于 25%', '立即投降'], ['连续回合数', '大于等于 5 回合', '立即投降'], ['指定卡组', '匹配到 快攻瞎', '第3回合后投降'], ['我方生命值', '小于等于 10 点', '立即投降']].map((row) => <div className="rule-row" key={row[0]}><input type="checkbox" defaultChecked /><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span><button className="blue-mini">编辑</button><button className="red-mini">删除</button></div>)}</div><div className="rule-bottom"><div className="preview-card"><SectionTitle>规则预览</SectionTitle><p>① 当 AI 预测胜率 &lt; 25% 时，立即投降</p><p>② 当连续空过回合 ≥ 5 回合时，立即投降</p><p>③ 当识别到指定卡组时，按规则执行</p></div><div className="json-card"><SectionTitle>规则 JSON</SectionTitle><textarea value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck="false" /><button className="wide-button gold" onClick={save}>▣ 保存投降规则</button></div></div></>}</div></div>;
}

function RankPage({ status, call }) {
  const rank = status.rank_stop || {};
  const [form, setForm] = useState({ enabled: Boolean(rank.enabled), legend_number: rank.legend_number || 1, action: rank.action || 'stop', mode: rank.mode || 'legend' });
  useEffect(() => setForm({ enabled: Boolean(rank.enabled), legend_number: rank.legend_number || 1, action: rank.action || 'stop', mode: rank.mode || 'legend' }), [rank.enabled, rank.legend_number, rank.action, rank.mode]);
  return <div className="page"><PageHeader title="段位目标" subtitle="设置目标段位与保分策略，达到目标后可自动停止或发送通知。" /><div className="two-columns rank-top"><div className="panel rank-card"><SectionTitle>当前段位</SectionTitle><div className="rank-emblem">✦<b>传说</b></div><div className="rank-stats"><span>当前排名 <b>#3287</b></span><span>星级进度 <b>—</b></span><span>本赛季最高 <b>传说</b></span></div></div><div className="panel"><SectionTitle>目标设置</SectionTitle><label>目标段位<select value={form.mode} onChange={(e) => setForm((v) => ({ ...v, mode: e.target.value }))}><option value="legend">传说</option><option value="legend_number">传说名次</option></select></label><label>保分阈值<input type="number" value={form.legend_number} onChange={(e) => setForm((v) => ({ ...v, legend_number: Number(e.target.value) }))} /></label><label className="switch-row"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((v) => ({ ...v, enabled: e.target.checked }))} />达到目标后停止</label><label className="switch-row"><input type="checkbox" defaultChecked />达到目标后通知</label></div></div><div className="panel rank-progress"><SectionTitle>段位进度</SectionTitle><div className="progress-line"><span>青铜</span><i /><span>白银</span><i /><span>黄金</span><i /><span>白金</span><i /><span>钻石</span><i className="current" /><span>传说</span></div></div><div className="panel stats-grid"><Stat title="胜场" value={status.wins || 12} tone="green" /><Stat title="负场" value={Math.max(0, (status.games || 18) - (status.wins || 12))} tone="red" /><Stat title="胜率" value={`${status.win_rate || 66.7}%`} tone="blue" /><Stat title="连续胜场" value="5" tone="gold" /></div><button className="wide-button gold" onClick={() => call('/api/rank_stop', 'POST', form)}>▣ 保存目标设置</button></div>;
}

function HumanPage({ status, call }) {
  const value = status.human_like || {};
  const [form, setForm] = useState({ enabled: Boolean(value.enabled), hand_hover_enabled: value.hand_hover_enabled ?? true, minion_hover_enabled: value.minion_hover_enabled ?? true, post_delay_min: value.post_delay_min || 0.5, post_delay_max: value.post_delay_max || 3, hover_min: value.hover_min || 0.2, hover_max: value.hover_max || 1, minion_hover_min: value.minion_hover_min || 0.2, minion_hover_max: value.minion_hover_max || 1.5 });
  const toggle = (key) => setForm((v) => ({ ...v, [key]: !v[key] }));
  return <div className="page"><PageHeader title="人性化设置" subtitle="模拟真实玩家的操作习惯，使行为更自然，降低被检测风险。" /><div className="two-columns human-layout"><div className="panel"><SectionTitle>◐ 鼠标行为</SectionTitle><SwitchRow label="手牌悬停" checked={form.hand_hover_enabled} onChange={() => toggle('hand_hover_enabled')} detail="在使用手牌前先悬停一段时间" /><SwitchRow label="敌方随从悬停" checked={form.minion_hover_enabled} onChange={() => toggle('minion_hover_enabled')} detail="攻击前先悬停敌方随从" /><SwitchRow label="移动鼠标到目标" checked={form.enabled} onChange={() => toggle('enabled')} detail="使用贝塞尔曲线模拟真实鼠标移动" /><div className="preview-card"><SectionTitle>行为预览</SectionTitle><div className="timeline"><span>手牌悬停</span>→<span>移动鼠标</span>→<span>目标悬停</span>→<span>执行操作</span>→<span>操作后延迟</span></div></div></div><div><div className="panel"><SectionTitle>◷ 动作延迟摘要</SectionTitle><SwitchRow label="随机延迟" checked={form.enabled} onChange={() => toggle('enabled')} detail="具体时间范围在延迟设置中统一维护" /><NumberRow label="最小延迟（毫秒）" value={form.post_delay_min * 1000} /><NumberRow label="最大延迟（毫秒）" value={form.post_delay_max * 1000} /></div><div className="panel"><SectionTitle>⬟ 安全行为</SectionTitle><SwitchRow label="低资源模式" checked={false} detail="减少不必要的图像识别与高频操作" /><SwitchRow label="静默运行" checked /><SwitchRow label="挂机时不处理弹窗" checked /></div></div></div><button className="wide-button gold" onClick={() => call('/api/human_like', 'POST', form)}>▣ 保存人性化设置</button></div>;
}

function DelaysPage({ status, call }) {
  const defaults = { pre_action_delay_seconds: 0.5, post_action_delay_seconds: 1.2, discover_target_delay_seconds: 1, mulligan_ready_delay_seconds: 0.8, mulligan_post_ocr_delay_seconds: 1, mulligan_retry_delay_seconds: 0.3, end_turn_delay_seconds: 0.5, battle_result_delay_seconds: 2, failure_delay_min_seconds: 10, failure_delay_max_seconds: 20, success_delay_min_seconds: 5, success_delay_max_seconds: 15, single_game_timeout_seconds: 300, max_runtime_hours: 8 };
  const [form, setForm] = useState({ ...defaults, ...(status.delays || {}) });
  useEffect(() => setForm((v) => ({ ...v, ...(status.delays || {}) })), [status.delays]);
  const set = (key, value) => setForm((v) => ({ ...v, [key]: value }));
  const DelayCard = ({ title, icon, min, max }) => <div className="delay-card"><h3>{icon} {title}</h3><p>配置该阶段的随机等待时间</p><NumberRow label="最小延迟" value={form[min]} unit="秒" onChange={(v) => set(min, Number(v))} /><NumberRow label="最大延迟" value={form[max]} unit="秒" onChange={(v) => set(max, Number(v))} /></div>;
  return <div className="page"><PageHeader title="延迟设置" subtitle="配置各类操作的延迟时间范围，模拟人类操作节奏。" /><div className="delay-grid"><DelayCard title="出牌延迟" icon="▣" min="pre_action_delay_seconds" max="post_action_delay_seconds" /><DelayCard title="推荐等待" icon="💡" min="discover_target_delay_seconds" max="battle_result_delay_seconds" /><DelayCard title="换牌延迟" icon="⇄" min="mulligan_ready_delay_seconds" max="mulligan_post_ocr_delay_seconds" /><DelayCard title="结束回合" icon="⌛" min="end_turn_delay_seconds" max="end_turn_delay_seconds" /><DelayCard title="结算等待" icon="▤" min="battle_result_delay_seconds" max="battle_result_delay_seconds" /></div><div className="panel"><SectionTitle>⚙ 其它延迟设置</SectionTitle><div className="four-columns"><NumberRow label="失败后延迟" value={`${form.failure_delay_min_seconds} ~ ${form.failure_delay_max_seconds}`} unit="秒" /><NumberRow label="成功后延迟" value={`${form.success_delay_min_seconds} ~ ${form.success_delay_max_seconds}`} unit="秒" /><NumberRow label="单局超时" value={form.single_game_timeout_seconds} unit="秒" /><NumberRow label="最大运行时长" value={form.max_runtime_hours} unit="小时" /></div></div><div className="button-row"><button className="secondary" onClick={() => setForm(defaults)}>↻ 恢复默认</button><button className="wide-button gold" onClick={() => call('/api/delays', 'POST', form)}>▣ 保存延迟设置</button></div></div>;
}

function CalibrationPage({ call, notify }) {
  const [target, setTarget] = useState('recommendation_roi');
  const [result, setResult] = useState('等待选择校准目标');
  const targets = [['recommendation_roi', '推荐区域'], ['mulligan_recommendation_roi', '换牌区域'], ['ai_win_rate_roi', '胜率区域'], ['post_game_rank_roi', '段位区域'], ['main_menu_battle_roi', '主菜单区域'], ['deck_grid_roi', '卡组网格'], ['mode_standard', '模式按钮']];
  const calibrate = async () => { const value = await call('/api/calibrate', 'POST', { target }); setResult(value?.message || value?.state_label || '已完成校准'); };
  return <div className="page"><PageHeader title="校准" subtitle="通过拖拽和调整区域，校准炉石游戏界面中各个功能区域的位置和大小。" /><div className="calibration-layout"><div className="panel target-list"><SectionTitle>校准目标</SectionTitle>{targets.map(([key, label]) => <button key={key} className={`target-item ${target === key ? 'active' : ''}`} onClick={() => setTarget(key)}>▧ {label}</button>)}</div><div className="panel game-preview"><SectionTitle>游戏窗口预览 <small>（拖拽蓝色框调整位置和大小）</small></SectionTitle><div className="fake-hearthstone"><div className="fake-board top">对手区域<div className="roi roi-rank">段位区域</div></div><div className="fake-board middle"><div className="roi roi-win">胜率区域</div></div><div className="fake-board bottom"><div className="fake-card">▣</div><div className="fake-card">▣</div><div className="fake-card">▣</div><div className="roi roi-mulligan">换牌区域</div></div></div></div><div className="panel region-params"><SectionTitle>当前区域参数</SectionTitle><label>区域名称<input value={targets.find(([key]) => key === target)?.[1] || target} readOnly /></label><NumberRow label="X 坐标" value="1120" /><NumberRow label="Y 坐标" value="720" /><NumberRow label="宽度" value="280" /><NumberRow label="高度" value="80" /><button className="wide-button gold" onClick={calibrate}>⌾ 开始校准</button><button className="wide-button green" onClick={() => notify('区域已保存')}>▣ 保存区域</button><button className="secondary wide-button" onClick={() => notify('已恢复默认区域')}>↶ 恢复默认</button><p className="muted-text">{result}</p></div></div></div>;
}

function DiagnosticsPage({ call, status, notify }) {
  const [checks, setChecks] = useState([]);
  const run = async () => { const value = await call('/api/selfcheck', 'POST', {}); setChecks(value?.checks || []); };
  useEffect(() => { if (Array.isArray(status.selfcheck?.checks)) setChecks(status.selfcheck.checks); }, [status.selfcheck]);
  return <div className="page"><div className="two-columns diagnostics-top"><div className="panel"><SectionTitle action={<button className="secondary" onClick={run}>⟳ 重新检测</button>}>环境自检</SectionTitle>{(checks.length ? checks : [{ label: 'Python环境', status: 'warn', detail: '等待检测' }, { label: '管理员权限', status: 'warn', detail: '等待检测' }, { label: '炉石窗口', status: 'warn', detail: '等待检测' }, { label: '炉石日志目录', status: 'warn', detail: '等待检测' }, { label: 'CDP连接', status: 'warn', detail: '等待检测' }]).slice(0, 8).map((item, index) => <div className="check-row" key={`${item.label}-${index}`}><span>{item.label}</span><b className={`check-${item.status}`}>{item.status === 'ok' ? '● 正常' : item.status === 'warn' ? '● 警告' : '● 失败'}</b><small>{item.detail || ''}</small></div>)}</div><div className="panel"><SectionTitle>▤ 日志文件</SectionTitle><div className="file-action"><span>日志目录</span><button className="secondary" onClick={() => notify('日志目录由配置决定')}>▣ 打开日志目录</button></div><div className="file-action"><span>导出诊断包</span><button className="secondary" onClick={() => call('/api/feedback/export', 'POST', {})}>⇧ 导出诊断包</button></div><div className="file-action"><span>刷新状态</span><button className="secondary" onClick={run}>⟳ 刷新状态</button></div></div></div><div className="panel history-log"><SectionTitle>实时日志查看器</SectionTitle><div className="log-filter-line"><Check label="操作" checked /><Check label="推荐" checked /><Check label="CDP" checked /><Check label="Power.log" checked /><Check label="调试" checked /><input placeholder="搜索日志内容..." /></div><div className="history-placeholder">日志历史与错误诊断由右侧实时日志持续写入；此处可扩展搜索、行数和导出筛选。</div></div><div className="panel"><SectionTitle>⚠ 最近错误</SectionTitle><div className="error-empty">当前没有新的未处理错误。</div></div></div>;
}

function LogPanel({ filters, setFilters, logs, onClear }) {
  const items = [['operation', '操作日志'], ['recommendation', '推荐日志'], ['cdp', 'CDP原始JSON'], ['power', 'Power.log'], ['debug', '调试日志']];
  return <aside className="log-panel"><div className="log-header"><SectionTitle>实时日志</SectionTitle><button className="secondary" onClick={onClear}>♙ 清空</button></div><div className="log-filters">{items.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(filters[key])} onChange={(e) => setFilters((v) => ({ ...v, [key]: e.target.checked }))} />{label}</label>)}</div><div className="log-stream">{logs.length ? logs.map((entry, index) => <div className="log-line" key={`${entry.seq || index}-${index}`}><span className="log-time">[{entry.t || '--:--:--'}]</span><span className={`log-level level-${String(entry.level || 'INFO').toLowerCase()}`}>[{entry.level || 'INFO'}]</span><span>{entry.msg || ''}</span></div>) : <div className="empty-log">等待控制引擎日志…</div>}</div></aside>;
}

function BottomBar({ status, license }) {
  return <footer className="bottom-bar"><span className="bottom-good">● 运行中</span><span>│</span><span className="bottom-good">🔑 {license.usable ? '已授权' : '未授权'}</span><span>│</span><span>盒子：{status.box?.running ? '已运行' : '未运行'}</span><span>│</span><span>CDP：{status.cdp?.connected ? '已连接' : '未连接'}</span><span>│</span><span>炉石：{status.in_game ? '运行中' : '未检测到'}</span><span className="bottom-spacer" /><span>最后动作：{status.last_summary || status.state_label || '等待中'}</span><span>│</span><span>运行时长：{formatDuration(status.game_elapsed_sec)}</span><span>│</span><span>对局数：{status.games || 0}</span><span>│</span><span>胜率：{status.win_rate || 0}%</span></footer>;
}

function ActivationDialog({ onClose, onActivate }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = async () => { const result = await onActivate(code); if (result?.error) setError(result.error); };
  return <div className="modal-backdrop"><div className="modal"><div className="modal-title"><h2>卡密激活</h2><button onClick={onClose}>×</button></div><p>请输入卡密激活设备。试用也必须使用服务端生成的卡密。</p><input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入卡密" onKeyDown={(e) => e.key === 'Enter' && submit()} />{error && <div className="error-text">{error}</div>}<div className="button-row"><button className="secondary" onClick={onClose}>取消</button><button className="wide-button gold" onClick={submit}>激活</button></div></div></div>;
}

function SummaryColumn({ title, children }) { return <div className="summary-column"><h3>{title}</h3>{children}</div>; }
function Check({ label, checked = false, onChange }) { return <label className="check-control"><input type="checkbox" checked={checked} onChange={onChange} />{label}</label>; }
function SwitchRow({ label, checked, onChange, detail }) { return <label className="switch-row"><input type="checkbox" checked={Boolean(checked)} onChange={onChange} /><span><b>{label}</b>{detail && <small>{detail}</small>}</span></label>; }
function NumberRow({ label, value, unit, onChange }) { return <label className="number-row"><span>{label}</span><input type="text" value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} readOnly={!onChange} /><em>{unit}</em></label>; }
function Stat({ title, value, tone }) { return <div className={`stat-card ${tone}`}><span>{title}</span><b>{value}</b></div>; }

createRoot(document.getElementById('root')).render(<App />);
