/**
 * IMA Web Clipper - 设置页
 * 全部使用 addEventListener，无内联事件处理器
 */

const $ = id => document.getElementById(id);
const els = {};

function initDOMElements() {
  els.clientId = $('input-client-id');
  els.apiKey = $('input-api-key');
  els.rememberCreds = $('input-remember-creds');
  els.testConnBtn = $('btn-test-conn');
  els.connStatus = $('status-conn');
  els.badgeCred = $('badge-cred');
  els.secAfterConn = $('sec-after-conn');
  els.secKb = $('sec-kb');
  els.badgeKb = $('badge-kb');
  els.kbRoot = $('kb-tree-root');
  els.statusKb = $('status-kb');
  els.tplList = $('tpl-list-items');
  els.tplCount = $('tpl-count');
  els.tplEditName = $('tpl-edit-name');
  els.tplEditContent = $('tpl-edit-content');
  els.panePreview = $('pane-preview');
  els.statusTpl = $('status-tpl');
  els.sidebarNav = $('sidebar-nav');
  els.btnGotoKb = $('btn-goto-kb');
  els.btnGotoTemplates = $('btn-goto-templates');
  els.btnRefreshKbTree = $('btn-refresh-kb-tree');
  els.kbLoadingText = $('kb-loading-text');
  els.kbSourceLabel = $('kb-source-label');
  els.btnNewTemplate = $('btn-new-template');
  els.tplTabs = $('tpl-tabs');
  els.btnSaveTemplate = $('btn-save-template');
  els.btnResetTemplate = $('btn-reset-template');
  // 配置管理
  els.btnExportPreview = $('btn-export-preview');
  els.btnExportDownload = $('btn-export-download');
  els.exportPreview = $('export-preview');
  els.statusExport = $('status-export');
  els.btnImportSelect = $('btn-import-select');
  els.importFile = $('import-file');
  els.importFileName = $('import-file-name');
  els.importPreview = $('import-preview');
  els.statusImport = $('status-import');
  els.btnImportApply = $('btn-import-apply');
}

let config = null;
let templates = [];
let currentTplId = 'default';
let isConnected = false;
let lastTreeData = null; // 最近一次获取的知识库列表（置顶切换时本地重排，不重新请求）
let pendingImportData = null; // 导入文件校验通过后的暂存数据

// ===== 初始化 =====
async function initApp() {
  initDOMElements();
  bindEvents();
  renderVersionHistory();
  await loadSavedConfig();
  await loadTemplates();
  renderTplList();
  selectTemplateById('default');
}

// ===== 事件绑定（全部 addEventListener）=====
function bindEvents() {
  // 侧边栏导航 — 事件代理
  els.sidebarNav.addEventListener('click', function(e) {
    const item = e.target.closest('.sidebar-item');
    if (!item) return;
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(item.dataset.panel);
    if (panel) panel.classList.add('active');
  });

  // 测试连接
  els.testConnBtn.addEventListener('click', handleTestConnection);

  // 连接后引导按钮
  els.btnGotoKb.addEventListener('click', () => switchPanelSide('panel-knowledge'));
  els.btnGotoTemplates.addEventListener('click', () => switchPanelSide('panel-templates'));

  // 获取知识库结构
  els.btnRefreshKbTree.addEventListener('click', loadKbTree);

  // 模板 — 新建
  els.btnNewTemplate.addEventListener('click', handleNewTemplate);

  // 模板 — Tab 切换（事件代理）
  els.tplTabs.addEventListener('click', function(e) {
    const tab = e.target.closest('.tpl-tab');
    if (!tab) return;
    document.querySelectorAll('.tpl-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const pane = tab.dataset.tab;
    document.getElementById('pane-edit').classList.toggle('active', pane === 'edit');
    els.panePreview.classList.toggle('active', pane === 'preview');
    if (pane === 'preview') renderPreview(els.tplEditContent.value);
  });

  // 模板 — 保存 / 重置
  els.btnSaveTemplate.addEventListener('click', handleSaveTemplate);
  els.btnResetTemplate.addEventListener('click', () => selectTemplateById(currentTplId || 'default'));

  // 配置管理 — 导出（先预览，再下载）
  els.btnExportPreview.addEventListener('click', handleExportPreview);
  els.btnExportDownload.addEventListener('click', handleExportDownload);

  // 配置管理 — 导入（选文件 → 预览校验 → 更新配置）
  els.btnImportSelect.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', handleImportFileChange);
  els.btnImportApply.addEventListener('click', handleImportApply);
}

function switchPanelSide(panelId) {
  document.querySelectorAll('.sidebar-item').forEach(i => {
    i.classList.toggle('active', i.dataset.panel === panelId);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
  if (panelId === 'panel-knowledge' && isConnected) loadKbTree();
}

// ===== 配置管理 =====
async function loadSavedConfig() {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    config = result;
    if (config && config.credentials) {
      els.clientId.value = config.credentials.clientId || '';
      els.apiKey.value = config.credentials.apiKey || '';
      els.rememberCreds.checked = config.rememberCreds !== false;
      if (config.connected) {
        isConnected = true;
        updateConnectedUI();
        if (config.selectedTemplateId) currentTplId = config.selectedTemplateId;
      }
    }
  } catch (e) {
    console.warn('加载配置失败:', e.message);
  }
}

async function saveConfigToBackground() {
  try { await chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config }); }
  catch (e) { console.error('保存配置失败:', e); }
}

// ===== 连接测试 =====
async function handleTestConnection() {
  const clientId = els.clientId.value.trim();
  const apiKey = els.apiKey.value.trim();

  if (!clientId || !apiKey) {
    showStatus(els.connStatus, 'error', '⚠️ 请填写 Client ID 和 API Key');
    return;
  }

  els.testConnBtn.disabled = true;
  els.testConnBtn.textContent = '连接中...';
  showStatus(els.connStatus, 'warning', '<span class="spinner"></span> 正在测试 API 连接...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_CONNECTION',
      credentials: { clientId, apiKey }
    });

    if (response.success) {
      isConnected = true;
      config = config || {};
      config.credentials = { clientId, apiKey };
      config.rememberCreds = els.rememberCreds.checked;
      config.connected = true;
      config.knowledgeBases = response.knowledgeBases || [];
      await saveConfigToBackground();

      els.testConnBtn.textContent = '✅ 已连接';
      els.testConnBtn.className = 'btn btn-success';
      els.testConnBtn.disabled = false;

      showStatus(els.connStatus, 'success',
        `✅ 连接成功！获取到 ${config.knowledgeBases.length} 个知识库。`
      );
      updateConnectedUI();
    } else {
      els.testConnBtn.textContent = '🔗 测试连接';
      els.testConnBtn.className = 'btn btn-primary';
      els.testConnBtn.disabled = false;
      showStatus(els.connStatus, 'error', `❌ 连接失败: ${response.error}`);
    }
  } catch (e) {
    els.testConnBtn.textContent = '🔗 测试连接';
    els.testConnBtn.className = 'btn btn-primary';
    els.testConnBtn.disabled = false;
    showStatus(els.connStatus, 'error', `❌ 请求失败: ${e.message}`);
  }
}

function updateConnectedUI() {
  els.badgeCred.className = 'badge badge-ready';
  els.badgeCred.textContent = '✅ 已连接';
  els.secAfterConn.style.display = 'block';
  els.badgeKb.className = 'badge badge-ready';
  els.badgeKb.textContent = '✅ 可浏览';
}

// ===== 知识库树 =====
async function loadKbTree() {
  if (!isConnected) {
    showStatus(els.statusKb, 'info', '⚠️ 请先在"凭证配置"面板完成连接测试');
    return;
  }

  // 加载态
  els.btnRefreshKbTree.disabled = true;
  els.kbLoadingText.style.display = 'inline';
  els.kbLoadingText.innerHTML = '<span class="spinner"></span> 正在获取知识库结构...';
  els.kbSourceLabel.style.display = 'none';
  showStatus(els.statusKb, 'warning', '<span class="spinner"></span> 正在获取知识库内容...');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_KB_TREE' });
    if (response.success && response.treeData) {
      lastTreeData = response.treeData;
      renderKbTree(sortKbTreeByPin(response.treeData));
      if (response.isDemo) {
        els.kbSourceLabel.textContent = '⚠️ 当前为演示数据（API 不可用）';
        els.kbSourceLabel.style.color = '#D97706';
        showStatus(els.statusKb, 'warning', '⚠️ API 获取失败，显示演示知识库列表。');
      } else {
        els.kbSourceLabel.textContent = `✅ 真实数据 — 共 ${response.treeData.length} 个知识库`;
        els.kbSourceLabel.style.color = '#059669';
        showStatus(els.statusKb, 'success', '✅ 知识库列表加载成功');
      }
      els.kbSourceLabel.style.display = 'block';
    } else {
      els.kbRoot.innerHTML = '<p style="color:#94A3B8;font-size:13px;padding:12px;">暂无知识库数据</p>';
      showStatus(els.statusKb, 'info', '当前账号下没有可用的知识库');
    }
  } catch (e) {
    showStatus(els.statusKb, 'error', '获取知识库失败: ' + e.message);
  } finally {
    els.btnRefreshKbTree.disabled = false;
    els.kbLoadingText.style.display = 'none';
  }
}

function renderKbTree(treeData) {
  els.kbRoot.innerHTML = '';
  const pinned = (config && config.pinnedKbs) || {};
  treeData.forEach(kb => {
    const isPinned = pinned[kb.id] !== undefined;
    const root = document.createElement('div');
    root.className = 'kb-root' + (isPinned ? ' pinned' : '');
    root.dataset.kbId = kb.id;
    root.innerHTML =
      '<div class="kr-icon">📚</div>' +
      '<div class="kr-info"><div class="kr-name">' + escHtml(kb.name) +
        (isPinned ? '<img class="kb-pin-ico" src="../icons/yizhiding.png" alt="已置顶" title="已置顶">' : '') +
      '</div></div>' +
      '<button class="kb-pin' + (isPinned ? ' active' : '') + '" title="' + (isPinned ? '取消置顶' : '置顶') + '">' +
        '<img class="kb-pin-btn-ico" src="../icons/' + (isPinned ? 'quxiaozhiding.png' : 'zhiding.png') + '" alt="">' +
        '<span>' + (isPinned ? '取消置顶' : '置顶') + '</span>' +
      '</button>';
    root.querySelector('.kb-pin').addEventListener('click', function(e) {
      e.stopPropagation();
      toggleKbPin(kb.id);
    });
    els.kbRoot.appendChild(root);
  });
}

/**
 * 按置顶时间戳倒序重排知识库列表：置顶的在最前，未置顶保持原顺序
 */
function sortKbTreeByPin(treeData) {
  const pinned = (config && config.pinnedKbs) || {};
  const pinnedItems = treeData
    .filter(kb => pinned[kb.id] !== undefined)
    .sort((a, b) => (pinned[b.id] || 0) - (pinned[a.id] || 0));
  const unpinnedItems = treeData.filter(kb => pinned[kb.id] === undefined);
  return pinnedItems.concat(unpinnedItems);
}

/**
 * 置顶 / 取消置顶：pinnedKbs = { [kbId]: 置顶时间戳 }
 */
function toggleKbPin(kbId) {
  config = config || {};
  config.pinnedKbs = config.pinnedKbs || {};
  if (config.pinnedKbs[kbId] !== undefined) {
    delete config.pinnedKbs[kbId];
    showStatus(els.statusKb, 'info', '已取消置顶，知识库恢复原顺序');
  } else {
    config.pinnedKbs[kbId] = Date.now();
    showStatus(els.statusKb, 'success', '✅ 已置顶，知识库已排到列表最前面');
  }
  saveConfigToBackground();
  // 本地重排，无需重新请求接口
  if (lastTreeData) renderKbTree(sortKbTreeByPin(lastTreeData));
}

// ===== 模板管理 =====
async function loadTemplates() {
  try { templates = await chrome.runtime.sendMessage({ type: 'GET_TEMPLATES' }); }
  catch (e) { console.error('加载模板失败:', e); templates = []; }
}

function renderTplList() {
  els.tplList.innerHTML = '';
  els.tplCount.textContent = templates.length + ' 个';
  templates.forEach(tpl => {
    const li = document.createElement('li');
    li.className = 'tpl-list-item' + (tpl.id === currentTplId ? ' active' : '');
    li.textContent = '📄 ' + tpl.name;
    li.addEventListener('click', () => selectTemplateById(tpl.id));
    els.tplList.appendChild(li);
  });
}

function selectTemplateById(id) {
  currentTplId = id;
  document.querySelectorAll('.tpl-list-item').forEach(i => i.classList.remove('active'));
  const idx = templates.findIndex(t => t.id === id);
  if (idx >= 0 && els.tplList.children[idx]) els.tplList.children[idx].classList.add('active');
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  els.tplEditName.value = tpl.name;
  els.tplEditContent.value = tpl.content;
  els.statusTpl.className = 'status-msg';
  renderPreview(tpl.content);
}

function renderPreview(content) {
  let text = content
    .replace(/{{title}}/g, '示例文章标题')
    .replace(/{{url}}/g, 'https://example.com/article')
    .replace(/{{date}}/g, '2026-07-02 14:30')
    .replace(/{{content}}/g, '这是文章正文内容。包含多个段落和重要信息。\n- 列表项 1\n- 列表项 2')
    .replace(/{{excerpt}}/g, '这是一篇示例文章的摘要。')
    .replace(/{{author}}/g, '示例作者')
    .replace(/{{selection}}/g, '选中的文本');

  let yamlBlock = '';
  const m = text.match(/^---\n([\s\S]*?)\n---\n*/);
  if (m) {
    yamlBlock = '<div class="yaml-meta"><div class="ym-title">📋 元数据</div>';
    m[1].split('\n').forEach(l => { const t = l.trim(); if (t) yamlBlock += '<div>' + escHtml(t) + '</div>'; });
    yamlBlock += '</div>';
    text = text.slice(m[0].length);
  }
  els.panePreview.innerHTML = yamlBlock + simpleMD(text);
}

function simpleMD(md) {
  let h = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>').replace(/^---$/gm, '<hr>').replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  h = '<p>' + h + '</p>';
  h = h.replace(/<p><\/p>/g, '').replace(/<p><ul>/g, '<ul>').replace(/<\/ul><\/p>/g, '</ul>');
  h = h.replace(/<p><li>/g, '<li>').replace(/<\/li><\/p>/g, '</li>');
  h = h.replace(/<p><blockquote>/g, '<blockquote>').replace(/<\/blockquote><\/p>/g, '</blockquote>');
  h = h.replace(/<p><h/g, '<h').replace(/<\/h(\d)><\/p>/g, '</h$1>');
  h = h.replace(/<p><hr>/g, '<hr>').replace(/\n/g, '<br>');
  return h;
}

async function handleSaveTemplate() {
  const name = els.tplEditName.value.trim();
  const content = els.tplEditContent.value.trim();
  if (!name || !content) {
    showStatus(els.statusTpl, 'error', '⚠️ 请输入模板名称和内容');
    return;
  }
  const existing = templates.find(t => t.id === currentTplId);
  const isDefault = existing && existing.isDefault === true;
  const template = { id: isDefault ? currentTplId : (existing ? currentTplId : 'custom-' + Date.now()), name, content, isDefault };
  try {
    const ok = await chrome.runtime.sendMessage({ type: 'SAVE_TEMPLATE', template });
    if (ok) {
      if (existing) { existing.name = name; existing.content = content; }
      else { templates.push(template); currentTplId = template.id; }
      renderTplList();
      showStatus(els.statusTpl, 'success', '✅ 模板已保存');
      if (config) { config.selectedTemplateId = currentTplId; saveConfigToBackground(); }
    } else showStatus(els.statusTpl, 'error', '❌ 保存失败');
  } catch (e) { showStatus(els.statusTpl, 'error', '❌ 保存失败: ' + e.message); }
}

function handleNewTemplate() {
  currentTplId = 'custom-new';
  document.querySelectorAll('.tpl-list-item').forEach(i => i.classList.remove('active'));
  els.tplEditName.value = '';
  els.tplEditContent.value = '---\ntitle: "{{title}}"\nauthor: "{{author}}"\ndate: "{{date}}"\nkeywords: []\ntags: []\n---\n\n# {{title}}\n\n{{content}}\n\n[原文链接]({{url}})';
  els.statusTpl.className = 'status-msg';
  renderPreview(els.tplEditContent.value);
}

// ===== 配置管理：导入 / 导出 =====
const EXPORT_TYPE = 'ima-web-clipper-export';
const EXPORT_VERSION = 3; // v3：templates 改为导出完整可见列表（内置+自定义）；v2：知识库相关数据不随导入导出

async function buildExportData() {
  const res = await chrome.storage.local.get('ima_clipper_config');
  const cfg = res.ima_clipper_config || {};
  // 模板用「完整可见列表」（内置 + 自定义）：内置模板不落盘，原始 storage 里只有自定义模板，直接读会为空
  let tpls = [];
  try {
    const r = await chrome.runtime.sendMessage({ type: 'GET_TEMPLATES' });
    if (Array.isArray(r)) tpls = r;
  } catch (e) { tpls = []; }
  return {
    type: EXPORT_TYPE,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    config: {
      credentials: cfg.credentials || null,
      rememberCreds: cfg.rememberCreds,
      lastMode: cfg.lastMode,
      selectedTemplateId: cfg.selectedTemplateId
    },
    templates: tpls
  };
}

async function handleExportPreview() {
  try {
    const data = await buildExportData();
    els.exportPreview.textContent = JSON.stringify(data, null, 2);
    els.exportPreview.classList.remove('empty');
    els.btnExportDownload.disabled = false;
    showStatus(els.statusExport, 'info', '已生成预览，确认内容无误后可点击「导出 JSON 文件」');
  } catch (e) {
    showStatus(els.statusExport, 'error', '❌ 生成预览失败: ' + e.message);
  }
}

async function handleExportDownload() {
  try {
    const data = await buildExportData();
    const filename = 'ima-web-clipper-config-' + new Date().toISOString().slice(0, 10) + '.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showStatus(els.statusExport, 'success', '✅ 已导出 ' + filename);
  } catch (e) {
    showStatus(els.statusExport, 'error', '❌ 导出失败: ' + e.message);
  }
}

async function handleImportFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  els.importFileName.textContent = file.name;
  els.btnImportApply.disabled = true;
  pendingImportData = null;
  els.importPreview.textContent = '';
  els.importPreview.classList.add('empty');
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    validateExportData(data);
    pendingImportData = data;
    els.importPreview.textContent = JSON.stringify(data, null, 2);
    els.importPreview.classList.remove('empty');
    els.btnImportApply.disabled = false;
    showStatus(els.statusImport, 'success', '✅ 文件校验通过，请确认上方内容后点击「更新配置」');
  } catch (err) {
    showStatus(els.statusImport, 'error', '❌ ' + err.message);
  } finally {
    els.importFile.value = '';
  }
}

function validateExportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('文件内容不是有效的 JSON 对象');
  if (data.type !== EXPORT_TYPE) throw new Error('不是 IMA Web Clipper 的导出文件（缺少 type 标记，请选择正确的导出文件）');
  if (typeof data.version !== 'number') throw new Error('导出文件缺少 version 版本号');
  if (data.config === undefined || typeof data.config !== 'object' || Array.isArray(data.config)) throw new Error('config 字段缺失或格式错误');
  if (data.config.credentials !== undefined && data.config.credentials !== null) {
    const c = data.config.credentials;
    if (typeof c !== 'object' || typeof c.clientId !== 'string' || typeof c.apiKey !== 'string') throw new Error('credentials 字段格式错误');
  }
  if (data.templates !== undefined && !Array.isArray(data.templates)) throw new Error('templates 字段格式错误');
  if (Array.isArray(data.templates)) {
    for (const t of data.templates) {
      if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.content !== 'string') {
        throw new Error('模板格式错误（每个模板需包含字符串 id / name / content）');
      }
    }
  }
}

// 导入时强制重置知识库相关数据：知识库列表/默认/置顶/连接状态不随导入恢复，连接后由接口重新获取
function sanitizeImportedConfig(cfg) {
  const base = cfg && typeof cfg === 'object' ? cfg : {};
  return {
    credentials: base.credentials || null,
    rememberCreds: base.rememberCreds,
    lastMode: base.lastMode,
    selectedTemplateId: base.selectedTemplateId,
    connected: false,
    knowledgeBases: []
  };
}

// 导入时只把自定义模板写回存储（内置默认模板由模板引擎提供，不落盘，写回也会被合并逻辑过滤）
function sanitizeImportedTemplates(tpls) {
  if (!Array.isArray(tpls)) return [];
  return tpls.filter(t => t && typeof t === 'object' && !t.isDefault);
}

async function handleImportApply() {
  if (!pendingImportData) return;
  const ok = confirm('确认更新配置？当前所有配置与自定义模板将被导入文件内容覆盖，且不可恢复。');
  if (!ok) return;
  try {
    await chrome.storage.local.set({
      ima_clipper_config: sanitizeImportedConfig(pendingImportData.config),
      ima_clipper_templates: sanitizeImportedTemplates(pendingImportData.templates)
    });
    // 先重置连接态 UI，再重新加载存储内容
    isConnected = false;
    els.badgeCred.className = 'badge badge-pending';
    els.badgeCred.textContent = '未配置';
    els.secAfterConn.style.display = 'none';
    els.badgeKb.className = 'badge badge-pending';
    els.badgeKb.textContent = '请先测试连接';
    await loadSavedConfig();
    await loadTemplates();
    renderTplList();
    const tplId = config && config.selectedTemplateId;
    selectTemplateById(templates.some(t => t.id === tplId) ? tplId : 'default');
    // 清理导入面板
    pendingImportData = null;
    els.importPreview.textContent = '';
    els.importPreview.classList.add('empty');
    els.importFileName.textContent = '';
    els.btnImportApply.disabled = true;
    showStatus(els.statusImport, 'success', '✅ 配置已更新。知识库列表不会随导入恢复，请到「凭证配置」重新测试连接获取');
  } catch (err) {
    showStatus(els.statusImport, 'error', '❌ 更新配置失败: ' + err.message);
  }
}

// ===== 关于：版本记录（读取 CHANGELOG.md 渲染）=====
async function renderVersionHistory() {
  const container = $('version-history');
  if (!container) return;
  try {
    const res = await fetch('../CHANGELOG.md');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const md = await res.text();
    container.innerHTML = buildVersionHtml(md);
    const badge = $('badge-version');
    if (badge) {
      const m = md.match(/^## \[([^\]]+)\]/m);
      if (m) badge.textContent = '最新 ' + m[1];
    }
  } catch (e) {
    container.innerHTML = '<p style="color:#94A3B8;font-size:12px;">版本记录加载失败</p>';
  }
}

function buildVersionHtml(md) {
  const blocks = [];
  let cur = null;
  const lines = md.split('\n');
  for (const line of lines) {
    const vm = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
    if (vm) { cur = { version: vm[1], date: vm[2].trim(), sections: [] }; blocks.push(cur); continue; }
    if (!cur) continue;
    const sm = line.match(/^###\s+(.+)$/);
    if (sm) { cur.sections.push({ title: sm[1].trim(), items: [] }); continue; }
    const bm = line.match(/^-\s+(.+)$/);
    if (bm && cur.sections.length) cur.sections[cur.sections.length - 1].items.push(bm[1].trim());
  }
  if (blocks.length === 0) return '<p style="color:#94A3B8;font-size:12px;">暂无版本记录</p>';
  return blocks.map(b => {
    const secs = b.sections.map(s => {
      const cls = s.title.indexOf('修复') !== -1 ? 'vh-fix' : s.title.indexOf('新增') !== -1 ? 'vh-new' : 'vh-chg';
      const items = s.items.length ? s.items.map(i => '<li>' + escHtml(i) + '</li>').join('') : '';
      return '<div class="vh-cat"><span class="vh-cat-tag ' + cls + '">' + escHtml(s.title) + '</span>' + (items ? '<ul class="vh-items">' + items + '</ul>' : '') + '</div>';
    }).join('');
    return '<div class="vh-block"><div class="vh-head"><span class="vh-version">v' + escHtml(b.version) + '</span><span class="vh-date">' + escHtml(b.date) + '</span></div>' + secs + '</div>';
  }).join('');
}

function showStatus(el, type, msg) {
  el.className = 'status-msg show ' + type;
  el.innerHTML = msg;
}

function escHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', initApp);
