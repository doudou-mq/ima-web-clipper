// 共享操作日志模块：弹窗(popup)与设置页(options)共同使用，日志统一存 chrome.storage.local
const LOG_KEY = 'ima_clipper_logs';
const LOG_RETENTION_MS = 2 * 24 * 60 * 60 * 1000; // 保留窗口：2 天
const LOG_MAX_ENTRIES = 500; // 条数上限

let logEntries = [];
let _flushTimer = null;
let logDirty = false; // 内存中是否有尚未落盘的新条目（避免 onChanged 重载吞掉）
let _onChange = null; // 页面注册的回调：有新日志时即时刷新界面

function setLogOnChange(fn) { _onChange = fn; }

function pruneLogs(list, now) {
  const n = now || Date.now();
  return list.filter(e => e && typeof e.t === 'number' && n - e.t <= LOG_RETENTION_MS).slice(-LOG_MAX_ENTRIES);
}

async function loadLogs() {
  try {
    const res = await chrome.storage.local.get(LOG_KEY);
    if (!logDirty) {
      logEntries = pruneLogs(Array.isArray(res[LOG_KEY]) ? res[LOG_KEY] : [], Date.now());
    }
  } catch (e) { /* 读取失败时保留内存态 */ }
  return logEntries;
}

function flushLogs() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  try {
    chrome.storage.local.set({ [LOG_KEY]: pruneLogs(logEntries, Date.now()) });
    logDirty = false;
  } catch (e) { /* storage 不可用时静默 */ }
}

function scheduleFlush(immediate) {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  _flushTimer = setTimeout(function () { _flushTimer = null; flushLogs(); }, immediate ? 0 : 500);
}

// 所有点击/流程的统一日志出口；ERROR 立即落盘，其余防抖 500ms
function log(level, src, msg, data) {
  logEntries.push({ t: Date.now(), level: level || 'INFO', src: src || '', msg: msg || '', data: data || {} });
  logDirty = true;
  scheduleFlush(level === 'ERROR');
  if (typeof _onChange === 'function') _onChange();
  return logEntries[logEntries.length - 1];
}

// 清空日志：重置内存 + 删除存储；页面自行再记录一条「日志已清空」
async function clearLogs() {
  logEntries = [];
  logDirty = false;
  try { await chrome.storage.local.remove(LOG_KEY); } catch (e) { /* 忽略 */ }
  if (typeof _onChange === 'function') _onChange();
}

// 日志来源类型 → 中文名称 + 标记颜色（区分不同类型的操作）
const SRC_META = {
  initApp:   { label: '初始化',   color: '#059669' },
  click:     { label: '点击',     color: '#64748B' },
  'mode-tab': { label: '模式切换', color: '#4F46E5' },
  tpl:       { label: '模板切换', color: '#0891B2' },
  'kb-dd':   { label: '知识库',   color: '#7C3AED' },
  preview:   { label: '预览',     color: '#0D9488' },
  startClip: { label: '保存流程', color: '#2563EB' },
  persistConfigField: { label: '配置保存', color: '#D97706' },
  conn:      { label: '连接测试', color: '#EA580C' },
  config:    { label: '配置管理', color: '#B45309' },
  'tpl-mgr': { label: '模板管理', color: '#0E7490' },
  'kb-mgr':  { label: '知识库管理', color: '#7C3AED' },
  log:       { label: '日志操作', color: '#94A3B8' }
};
function srcMeta(src) {
  return SRC_META[src] || { label: src || '未知', color: '#64748B' };
}
