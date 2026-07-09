/**
 * IMA Web Clipper - Popup
 * 实时预览：打开弹窗时自动提取当前页面内容并渲染模板
 */

const $ = id => document.getElementById(id);
const els = {};

function initDOM() {
  els.stateEmpty = $('state-empty');
  els.stateReady = $('state-ready');
  els.stateClipping = $('state-clipping');
  els.stateDone = $('state-done');
  els.btnOpenSettings = $('btn-open-settings');
  els.configKbName = $('config-kb-name');
  els.btnConfigLink = $('btn-config-link');
  els.tplSwitcher = $('tpl-switcher');
  els.tplBodyContent = $('tpl-body-content');
  els.kbSelect = $('kb-select');
  els.btnClip = $('btn-clip');
  els.btnBackToReady = $('btn-back-to-ready');
  els.clipStatusText = $('clip-status-text');
  els.doneKbLabel = $('done-kb-label');
  els.previewHeader = $('preview-header');
}

let configState = { configured: false };
let templates = [];
let knowledgeBases = [];

// 缓存当前页面的提取结果（用于模板切换时不重复提取）
let cachedPreview = null;

// ===== 初始化 =====
async function initApp() {
  initDOM();
  bindEvents();

  let config = null;
  try { configState = await chrome.runtime.sendMessage({ type: 'GET_CONFIG_STATE' }); } catch (e) { console.warn(e); }
  try { templates = await chrome.runtime.sendMessage({ type: 'GET_TEMPLATES' }); } catch (e) { console.warn(e); }
  try { config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' }); } catch (e) { console.warn(e); }

  if (config && config.knowledgeBases && config.knowledgeBases.length > 0) {
    knowledgeBases = config.knowledgeBases;
  }
  if (config && config.connected) {
    if (!configState.configured) configState.configured = true;
  }

  if (!templates || templates.length === 0) {
    templates = [
      { id: 'default', name: '默认模板', content: '# {{title}}\n\n{{author}}  {{date}}\n\n{{content}}\n\n---\n\n来源：[{{url}}]({{url}}) · 由 IMA Web Clipper 保存' }
    ];
  }

  populateTplSwitcher();

  if (configState.configured) {
    showState('ready');
    showReadyState();
    // 触发实时预览
    loadPagePreview();
  } else {
    showState('empty');
  }
}

// ===== 事件绑定 =====
function bindEvents() {
  els.btnOpenSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.btnConfigLink.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.btnClip.addEventListener('click', startClip);
  els.btnBackToReady.addEventListener('click', () => showState('ready'));
  els.kbSelect.addEventListener('change', onKbChange);
  els.tplSwitcher.addEventListener('change', function() {
    renderTemplatePreview(this.value);
  });
}

// ===== 实时预览：提取当前页面内容 =====
async function loadPagePreview() {
  els.tplBodyContent.innerHTML = '<div style="padding:20px;text-align:center;color:#94A3B8;"><span class="spinner"></span> 正在提取页面内容...</div>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, windowType: 'normal', status: 'complete' });
    if (!tab || !tab.url || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      els.tplBodyContent.innerHTML = '<div style="padding:16px;text-align:center;color:#94A3B8;font-size:12px;">当前页面无法预览</div>';
      return;
    }

    const result = await chrome.runtime.sendMessage({
      type: 'GET_PAGE_PREVIEW',
      tabId: tab.id
    });

    if (result.success && result.data) {
      cachedPreview = result.data;
      renderTemplatePreview(els.tplSwitcher.value);
    } else {
      els.tplBodyContent.innerHTML = '<div style="padding:16px;text-align:center;color:#D97706;font-size:12px;">⚠️ 页面内容提取失败: ' + (result.error || '') + '</div>';
    }
  } catch (e) {
    els.tplBodyContent.innerHTML = '<div style="padding:16px;text-align:center;color:#D97706;font-size:12px;">⚠️ 预览加载失败: ' + e.message + '</div>';
  }
}

// ===== 模板切换器 =====
function populateTplSwitcher() {
  els.tplSwitcher.innerHTML = '';
  templates.forEach(tpl => {
    const opt = document.createElement('option');
    opt.value = tpl.id;
    opt.textContent = tpl.name;
    els.tplSwitcher.appendChild(opt);
  });
  const tplId = configState.templateId || 'default';
  if (templates.some(t => t.id === tplId)) {
    els.tplSwitcher.value = tplId;
  }
}

// ===== 模板渲染（使用缓存的页面数据）=====
function renderTemplatePreview(tplId) {
  const tpl = templates.find(t => t.id === (tplId || els.tplSwitcher.value)) || templates[0];
  if (!tpl) return;

  // 如果有缓存数据，用真实的页面数据填充模板
  // 否则用回退数据
  const data = cachedPreview ? {
    title: cachedPreview.title || '无标题',
    url: cachedPreview.url || '',
    date: cachedPreview.date || new Date().toLocaleString('zh-CN'),
    content: cachedPreview.markdown || '',
    excerpt: cachedPreview.excerpt || '',
    author: cachedPreview.author || '',
    wechat_account: cachedPreview.accountName || '',
    selection: ''
  } : {
    title: '当前页面',
    url: '',
    date: new Date().toLocaleString('zh-CN'),
    content: '等待内容提取完成...',
    excerpt: '',
    author: '',
    wechat_account: '',
    selection: ''
  };

  // 替换变量
  let text = tpl.content;
  for (const [key, value] of Object.entries(data)) {
    text = text.replace(new RegExp('{{' + key + '}}', 'g'), value);
  }

  // 渲染 Markdown → HTML
  els.tplBodyContent.innerHTML = renderMarkdown(text);
}

// ===== Markdown → HTML 渲染 =====
function renderMarkdown(md) {
  if (!md || md.trim() === '') return '<div style="color:#94A3B8;font-size:12px;padding:8px;">无内容预览</div>';

  let h = md
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  h = h.replace(/^\|(.+)\|$/gm, function(match) {
    const cells = match.split('|').filter(c => c.trim());
    if (cells.length === 0) return match;
    if (cells.every(c => /^[\s:-]+$/.test(c))) return '<tr class="sep">';
    return '<td>' + cells.map(c => c.trim()).join('</td><td>') + '</td>';
  });
  h = h.replace(/((?:<td>.*<\/td>\n?)+)/g, '<tr>$1</tr>');
  h = h.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>');
  h = h.replace(/<tr class="sep"><\/tr>/g, '');

  h = '<div class="md-content">' + h + '</div>';
  h = h.replace(/<div class="md-content"><\/div>/g, '');
  h = h.replace(/<div class="md-content">(\s*<h)/g, '$1');
  h = h.replace(/<\/h(\d)><\/div>/g, '</h$1>');
  h = h.replace(/<div class="md-content">(\s*<table)/g, '$1');
  h = h.replace(/<\/table><\/div>/g, '</table>');
  h = h.replace(/<div class="md-content">(\s*<blockquote)/g, '$1');
  h = h.replace(/<\/blockquote><\/div>/g, '</blockquote>');
  h = h.replace(/<div class="md-content">(\s*<hr)/g, '$1');
  h = h.replace(/<hr><\/div>/g, '<hr>');
  h = h.replace(/<div class="md-content">(\s*<ul)/g, '$1');
  h = h.replace(/<\/ul><\/div>/g, '</ul>');
  h = h.replace(/<div class="md-content"><p>/g, '<p>');
  h = h.replace(/<\/p><\/div>/g, '</p>');

  return h;
}

// ===== 状态管理 =====
function showState(name) {
  [els.stateEmpty, els.stateReady, els.stateClipping, els.stateDone].forEach(el => el.classList.remove('active'));
  const map = { empty: els.stateEmpty, ready: els.stateReady, clipping: els.stateClipping, done: els.stateDone };
  if (map[name]) map[name].classList.add('active');
}

function showReadyState() {
  els.configKbName.textContent = configState.knowledgeBase || '知识库';
  populateKbSelect();
}

// ===== 知识库下拉 =====
function populateKbSelect() {
  els.kbSelect.innerHTML = '';
  if (knowledgeBases.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '暂无知识库，请前往设置页';
    els.kbSelect.appendChild(opt);
    els.btnClip.disabled = true;
    return;
  }
  els.btnClip.disabled = false;
  knowledgeBases.forEach(kb => {
    const opt = document.createElement('option');
    opt.value = kb.id;
    opt.textContent = '📚 ' + (kb.name || '知识库 ' + kb.id);
    els.kbSelect.appendChild(opt);
  });
}

function onKbChange() {
  const name = els.kbSelect.options[els.kbSelect.selectedIndex]?.textContent?.replace('📚 ', '') || '知识库';
  els.configKbName.textContent = name;
}

// ===== 剪藏 =====
async function startClip() {
  const kbId = els.kbSelect.value;
  if (!kbId || !cachedPreview) return;

  showState('clipping');

  try {
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (!config || !config.credentials) {
      showState('ready');
      return;
    }

    // 复用预览已提取好的内容，直接保存到 API
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_CLIPPED_CONTENT',
      credentials: config.credentials,
      knowledgeBaseId: kbId,
      title: cachedPreview.title || '无标题',
      markdown: cachedPreview.markdown || '',
      author: cachedPreview.author || '',
      date: cachedPreview.date || '',
      url: cachedPreview.url || '',
      accountName: cachedPreview.accountName || ''
    });

    if (response && response.success) {
      showState('done');
      const name = els.kbSelect.options[els.kbSelect.selectedIndex]?.textContent?.replace('📚 ', '') || '知识库';
      els.doneKbLabel.textContent = name;
    } else {
      showState('ready');
    }
  } catch (e) {
    showState('ready');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
