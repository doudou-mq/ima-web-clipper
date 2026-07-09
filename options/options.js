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
}

let config = null;
let templates = [];
let currentTplId = 'default';
let isConnected = false;

// ===== 初始化 =====
async function initApp() {
  initDOMElements();
  bindEvents();
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
      renderKbTree(response.treeData);
      if (response.isDemo) {
        els.kbSourceLabel.textContent = '⚠️ 当前为演示数据（API 不可用）';
        els.kbSourceLabel.style.color = '#D97706';
        showStatus(els.statusKb, 'warning', '⚠️ API 获取失败，显示演示数据。选中文档可保存选择。');
      } else {
        const count = countTreeItems(response.treeData);
        els.kbSourceLabel.textContent = `✅ 真实数据 — 共 ${count.total} 个知识库，${count.folders} 个文件夹，${count.files} 个文档`;
        els.kbSourceLabel.style.color = '#059669';
        showStatus(els.statusKb, 'success', '✅ 选择一个文档作为剪藏目标位置');
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

function countTreeItems(tree) {
  let folders = 0, files = 0;
  function walk(nodes) {
    if (!nodes) return;
    for (const n of nodes) {
      if (n.type === 'folder') { folders++; walk(n.children); }
      else if (n.type === 'file') files++;
    }
  }
  tree.forEach(kb => walk(kb.children));
  return { total: tree.length, folders, files };
}

function renderKbTree(treeData) {
  els.kbRoot.innerHTML = '';
  treeData.forEach(kb => {
    const root = document.createElement('div');
    root.className = 'kb-root';
    root.dataset.kbId = kb.id;
    root.innerHTML = `<div class="kr-icon">📚</div><div class="kr-info"><div class="kr-name">${escHtml(kb.name)}</div><div class="kr-desc">${kb.children ? kb.children.length : 0} 个项目</div></div><span class="kr-arrow">▶</span>`;
    root.addEventListener('click', function() {
      this.classList.toggle('open');
      if (this.nextElementSibling) this.nextElementSibling.classList.toggle('open');
    });
    els.kbRoot.appendChild(root);
    const container = document.createElement('div');
    container.className = 'kb-tree-container';
    const ul = document.createElement('ul');
    ul.style.cssText = 'list-style:none;';
    buildTreeNodes(kb.children || [], ul);
    container.appendChild(ul);
    els.kbRoot.appendChild(container);
  });
}

function buildTreeNodes(nodes, parentUl) {
  nodes.forEach(node => {
    const li = document.createElement('li');
    li.className = 'tree-node';
    li.dataset.id = node.id;
    li.dataset.type = node.type;

    const row = document.createElement('div');
    row.className = 'node-row';
    if (node.type === 'folder') {
      row.innerHTML = '<span class="nd-arrow">▶</span>';
    } else {
      row.innerHTML = '<span class="nd-arrow" style="visibility:hidden;">▶</span>';
    }
    row.innerHTML += `<span class="nd-icon">${node.type === 'folder' ? '📁' : '📄'}</span><span class="nd-name">${escHtml(node.name)}</span><span class="nd-check">✓</span>`;

    if (node.type === 'folder') {
      row.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('open');
        const ch = this.parentElement.querySelector('.tree-children');
        if (ch) ch.classList.toggle('open');
      });
    } else {
      row.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
        li.classList.add('selected');
        const path = getNodePath(li);
        showStatus(els.statusKb, 'success', `✅ 已选择：<strong>${escHtml(path)}</strong>`);
        if (config) {
          config.selectedKbId = node.id;
          config.selectedKbName = path;
          saveConfigToBackground();
        }
      });
    }
    li.appendChild(row);
    if (node.children && node.children.length > 0) {
      const ch = document.createElement('ul');
      ch.className = 'tree-children';
      ch.style.cssText = 'list-style:none;';
      buildTreeNodes(node.children, ch);
      li.appendChild(ch);
    }
    parentUl.appendChild(li);
  });
}

function getNodePath(li) {
  const parts = [];
  let current = li;
  while (current) {
    if (current.classList.contains('tree-node')) {
      const n = current.querySelector('.nd-name');
      if (n) parts.unshift(n.textContent);
    }
    current = current.parentElement.closest('.tree-node, .kb-tree-container');
    if (current && current.classList.contains('kb-tree-container')) {
      const prev = current.previousElementSibling;
      if (prev && prev.classList.contains('kb-root')) {
        const n = prev.querySelector('.kr-name');
        if (n) parts.unshift(n.textContent);
      }
      break;
    }
  }
  return parts.join(' > ');
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
