export const NAV_ITEMS = [
  ['overview', '⌂', '概览'],
  ['control', '▷', '挂机控制'],
  ['surrender', '▤', '投降规则'],
  ['rank', '▥', '段位目标'],
  ['human', '●', '人性化'],
  ['delays', '◷', '延迟设置'],
  ['calibration', '⌾', '校准'],
  ['diagnostics', '▣', '日志与自检'],
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

export function classifyLog(entry = {}) {
  const text = `${entry.msg || ''} ${entry.level || ''}`.toLowerCase();
  if (text.includes('cdp') || text.includes('raw_args') || text.includes('原始 json')) return 'cdp';
  if (text.includes('power.log') || text.includes('power log')) return 'power';
  if (String(entry.level || '').toUpperCase() === 'DEBUG' || text.includes('调试')) return 'debug';
  if (text.includes('推荐') || text.includes('recommend') || text.includes('actionname') || text.includes('play_')) return 'recommendation';
  return 'operation';
}
