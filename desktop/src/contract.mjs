export const NAV_ITEMS = [
  ['overview', 'home', '概览'],
  ['control', 'play', '挂机控制'],
  ['surrender', 'file', '投降规则'],
  ['rank', 'chart', '段位目标'],
  ['human', 'user', '人性化'],
  ['delays', 'clock', '延迟设置'],
  ['calibration', 'crosshair', '校准'],
  ['diagnostics', 'clipboard', '日志与自检'],
];

export const DEFAULT_FILTERS = {
  operation: true,
  recommendation: true,
  cdp: true,
  power: true,
  debug: true,
};

export const PAGE_FEATURES = {
  overview: ['status-cards', 'quick-control', 'settings-shortcuts'],
  control: ['runtime-config', 'schedule', 'battle-control', 'liveness', 'watchdog'],
  surrender: ['auto-surrender', 'deck-recognition', 'card-search', 'advanced-json'],
  rank: ['rank-target', 'rank-progress', 'rank-stop-policy'],
  human: ['hover-behavior', 'random-behavior', 'safety-behavior', 'delay-preview'],
  delays: ['action-delays', 'failure-success-delays', 'runtime-limits'],
  calibration: ['roi-list', 'roi-preview', 'roi-editor'],
  diagnostics: ['selfcheck', 'log-history', 'diagnostic-export', 'recent-errors'],
};

const LEGACY_LOG_MARKUP_RE = /^\s*(?:\*\*\[(?:TRACE|DEBUG|INFO|WARN|ERROR|SYS)\]\*\*|\[(?:TRACE|DEBUG|INFO|WARN|ERROR|SYS)\])\s*/i;
const LEGACY_OPERATION_RE = /^\s*(?:&#x6f;|&#111;)?peration(?=[\u4e00-\u9fff])\s*/i;

/**
 * 日志正文必须作为 React 文本节点显示，不能把旧版 Markdown/HTML 包装带进来。
 * 时间和级别由客户端列单独渲染；这里仅兼容旧包已经写入缓冲区的前缀。
 */
export function normalizeLogMessage(value) {
  let text = String(value ?? '');
  text = text.replace(LEGACY_LOG_MARKUP_RE, '');
  return text.replace(LEGACY_OPERATION_RE, '');
}

export function logSourceLabel(entry = {}) {
  const labels = {
    operation: '操作',
    recommendation: '推荐',
    cdp: 'CDP',
    power: 'Power.log',
    debug: '调试',
  };
  return labels[classifyLog(entry)] || '操作';
}

export function classifyLog(entry = {}) {
  const explicit = String(entry.source || entry.category || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call({ operation: 1, recommendation: 1, cdp: 1, power: 1, debug: 1 }, explicit)) return explicit;
  const text = `${entry.msg || ''} ${entry.level || ''}`.toLowerCase();
  if (text.includes('"schema"') && text.includes('"kind"') && text.includes('"target"')) return 'cdp';
  if (text.includes('cdp') || text.includes('raw_args') || text.includes('原始 json')) return 'cdp';
  if (text.includes('power.log') || text.includes('power log')) return 'power';
  if (String(entry.level || '').toUpperCase() === 'DEBUG' || text.includes('调试')) return 'debug';
  if (text.includes('推荐') || text.includes('recommend') || text.includes('actionname') || text.includes('play_')) return 'recommendation';
  return 'operation';
}
