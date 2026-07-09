/**
 * IMA Web Clipper - 后台服务 Worker
 */

importScripts('../lib/ima-api.js');
importScripts('../lib/template-engine.js');

let imaAPI = null;
let templateStorage = new TemplateStorage();

// ===== 初始化 =====
function initService() {
  console.log('IMA Web Clipper 后台服务已启动');
  initContextMenus();
}

// ===== 右键菜单 =====
function initContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'clip-to-ima', title: '剪藏到 IMA', contexts: ['page', 'selection'] });
    chrome.contextMenus.create({ id: 'clip-full', parentId: 'clip-to-ima', title: '完整剪藏', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'clip-selection', parentId: 'clip-to-ima', title: '剪藏选中文本', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'clip-url', parentId: 'clip-to-ima', title: '仅保存 URL', contexts: ['page'] });
  });
}

// ===== 配置管理（新增，不修改原有功能）=====
const CONFIG_KEY = 'ima_clipper_config';

async function getConfig() {
  try {
    const r = await chrome.storage.local.get(CONFIG_KEY);
    return r[CONFIG_KEY] || null;
  } catch { return null; }
}

async function saveConfig(cfg) {
  await chrome.storage.local.set({ [CONFIG_KEY]: cfg });
  return true;
}

// ===== 连接测试 =====
async function testConnection(credentials) {
  try {
    imaAPI = new IMAAPI(credentials);
    const result = await imaAPI.testConnection();

    if (result.success) {
      // 保存配置
      const cfg = await getConfig() || {};
      cfg.credentials = { clientId: credentials.clientId, apiKey: credentials.apiKey };
      cfg.connected = true;
      cfg.knowledgeBases = result.knowledgeBases;
      await saveConfig(cfg);
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== 知识库树（优先调真实 API，失败回退演示数据）=====
async function getKbTree() {
  const config = await getConfig();
  if (!config || !config.credentials || !config.connected) {
    return getDemoKbTree();
  }

  try {
    const api = new IMAAPI(config.credentials);
    const kbList = await api.getKnowledgeBaseList();

    if (!kbList || kbList.length === 0) {
      return getDemoKbTree();
    }

    const treeData = [];
    for (const kb of kbList) {
      try {
        const children = await buildKbTreeRecursive(api, kb.id);
        treeData.push({ id: kb.id, name: kb.name || '知识库', children });
      } catch (e) {
        console.warn('获取知识库 "' + kb.name + '" 内容失败:', e);
        treeData.push({ id: kb.id, name: kb.name || '知识库', children: [] });
      }
    }

    return { success: true, treeData, isDemo: false };
  } catch (e) {
    console.warn('获取知识库树失败，回退演示数据:', e);
    return getDemoKbTree();
  }
}

/**
 * 递归构建单个知识库的树形结构
 */
async function buildKbTreeRecursive(api, kbId, folderId = '') {
  const data = await api.getKnowledgeList(kbId, folderId);
  const nodes = [];

  for (const item of data.knowledge_list || []) {
    if (item.folder_id !== undefined) {
      // 文件夹 — 递归获取子内容
      const children = await buildKbTreeRecursive(api, kbId, item.folder_id);
      nodes.push({
        id: item.folder_id,
        name: item.name || '未命名文件夹',
        type: 'folder',
        children
      });
    } else if (item.media_id !== undefined) {
      // 文件/文档
      nodes.push({
        id: item.media_id,
        name: item.title || '未命名文档',
        type: 'file'
      });
    }
  }

  return nodes;
}

/**
 * 演示用树数据（API 不可用时的回退）
 */
function getDemoKbTree() {
  const demoTree = [
    { id: 'kb1', name: '我的知识库', children: [
      { id: 'f1', name: '项目文档', type: 'folder', children: [
        { id: 'f1d1', name: '需求说明书.md', type: 'file' },
        { id: 'f1d2', name: '技术架构方案.md', type: 'file' },
        { id: 'f1f1', name: '设计稿', type: 'folder', children: [
          { id: 'f1f1d1', name: 'UI 设计规范.md', type: 'file' }
        ]}
      ]},
      { id: 'f2', name: '学习笔记', type: 'folder', children: [
        { id: 'f2d1', name: 'React 入门指南.md', type: 'file' },
        { id: 'f2f1', name: '算法', type: 'folder', children: [
          { id: 'f2f1d1', name: '动态规划笔记.md', type: 'file' }
        ]}
      ]},
      { id: 'kb1d1', name: '未分类笔记.md', type: 'file' }
    ]},
    { id: 'kb2', name: '技术笔记', children: [
      { id: 'f3', name: '前端', type: 'folder', children: [
        { id: 'f3d1', name: 'Vue3 组合式 API.md', type: 'file' },
        { id: 'f3d2', name: 'Webpack 优化.md', type: 'file' }
      ]},
      { id: 'f4', name: '后端', type: 'folder', children: [
        { id: 'f4d1', name: 'Node.js 最佳实践.md', type: 'file' }
      ]}
    ]},
    { id: 'kb3', name: '产品文档', children: [
      { id: 'f5', name: '需求文档', type: 'folder', children: [
        { id: 'f5d1', name: 'V2.0 需求规格说明.md', type: 'file' }
      ]}
    ]}
  ];
  return { success: true, treeData: demoTree, isDemo: true };
}

// ===== 直接保存（复用预览已处理好的内容，不再提取和转换）=====
async function saveClippedContent(params) {
  const { credentials, knowledgeBaseId, title, markdown, author, date, url, accountName } = params;
  try {
    if (!imaAPI || imaAPI.credentials.clientId !== credentials.clientId) {
      imaAPI = new IMAAPI(credentials);
    }
    // 直接应用模板并保存
    const config = await getConfig();
    const templateId = (config && config.selectedTemplateId) || 'default';
    const templateContent = await templateStorage.getTemplateContent(templateId);
    const templateEngine = new TemplateEngine();

    const markdownContent = templateEngine.processClipping(
      { title, content: markdown, author, date, accountName },
      url || '',
      templateContent
    );

    return await imaAPI.clipArticle({ title, content: markdownContent }, knowledgeBaseId);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== 实时预览（提取内容→转Markdown→返回，不保存）=====
async function getPagePreview(tabId) {
  try {
    const extractionResult = await execContentScript(tabId, { type: 'EXTRACT_CONTENT', mode: 'readability' });
    if (!extractionResult.success) return { success: false, error: '内容提取失败: ' + (extractionResult.error || '未知错误') };

    const article = extractionResult.data;
    const markdownResult = await execContentScript(tabId, { type: 'HTML_TO_MARKDOWN', html: article.content });
    if (!markdownResult.success) return { success: false, error: 'Markdown 转换失败: ' + (markdownResult.error || '未知错误') };

    const pageInfoResult = await execContentScript(tabId, { type: 'GET_PAGE_INFO' });
    const pageUrl = pageInfoResult.success ? pageInfoResult.data.url : '';
    const author = article.author || article.byline || (pageInfoResult.data && pageInfoResult.data.author) || '';
    const date = article.date || (pageInfoResult.data && pageInfoResult.data.date) || '';

    return {
      success: true,
      data: {
        title: article.title,
        markdown: markdownResult.markdown,
        excerpt: article.excerpt || '',
        author: author,
        date: date,
        url: pageUrl,
        accountName: article.accountName || ''
      }
    };
  } catch (error) {
    return { success: false, error: '预览生成失败: ' + error.message };
  }
}

// ===== 剪藏 =====
async function clipPage(params) {
  const { tabId, credentials, knowledgeBaseId, clippingMode } = params;

  try {
    if (!imaAPI || imaAPI.credentials.clientId !== credentials.clientId) {
      imaAPI = new IMAAPI(credentials);
    }

    switch (clippingMode) {
      case 'full': return await clipFullPage(tabId, knowledgeBaseId);
      case 'url-only': return await clipUrlOnly(tabId, knowledgeBaseId);
      default: return await clipFullPage(tabId, knowledgeBaseId);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clipFullPage(tabId, knowledgeBaseId) {
  const extractionResult = await execContentScript(tabId, { type: 'EXTRACT_CONTENT', mode: 'readability' });
  if (!extractionResult.success) throw new Error(`内容提取失败: ${extractionResult.error}`);

  const article = extractionResult.data;
  const markdownResult = await execContentScript(tabId, { type: 'HTML_TO_MARKDOWN', html: article.content });
  if (!markdownResult.success) throw new Error(`Markdown 转换失败: ${markdownResult.error}`);

  const pageInfoResult = await execContentScript(tabId, { type: 'GET_PAGE_INFO' });
  const pageUrl = pageInfoResult.success ? pageInfoResult.data.url : '';

  const author = article.author || article.byline || pageInfoResult.data?.author || '';
  const date = article.date || pageInfoResult.data?.date || '';
  const accountName = article.accountName || '';

  const config = await getConfig();
  const templateId = (config && config.selectedTemplateId) || 'default';
  const templateContent = await templateStorage.getTemplateContent(templateId);
  const templateEngine = new TemplateEngine();

  const markdownContent = templateEngine.processClipping(
    { title: article.title, content: markdownResult.markdown, excerpt: article.excerpt, author, date, accountName },
    pageUrl,
    templateContent
  );

  return await imaAPI.clipArticle({ title: article.title, content: markdownContent }, knowledgeBaseId);
}

async function clipUrlOnly(tabId, knowledgeBaseId) {
  const pageInfoResult = await execContentScript(tabId, { type: 'GET_PAGE_INFO' });
  if (!pageInfoResult.success) throw new Error(`获取页面信息失败: ${pageInfoResult.error}`);
  // clipUrl(url, knowledgeBaseId) — 注意参数顺序
  return await imaAPI.clipUrl(pageInfoResult.data.url, knowledgeBaseId);
}

async function clipSelection(tabId, knowledgeBaseId) {
  const extractionResult = await execContentScript(tabId, { type: 'EXTRACT_CONTENT', mode: 'selection' });
  if (!extractionResult.success) throw new Error(`选中文本提取失败: ${extractionResult.error}`);

  const selection = extractionResult.data;
  const markdownResult = await execContentScript(tabId, { type: 'HTML_TO_MARKDOWN', html: selection.content });
  if (!markdownResult.success) throw new Error(`Markdown 转换失败: ${markdownResult.error}`);

  const pageInfoResult = await execContentScript(tabId, { type: 'GET_PAGE_INFO' });
  const pageUrl = pageInfoResult.success ? pageInfoResult.data.url : '';
  const pageTitle = pageInfoResult.success ? pageInfoResult.data.title : '选中文本';

  const config = await getConfig();
  const templateId = (config && config.selectedTemplateId) || 'default';
  const templateContent = await templateStorage.getTemplateContent(templateId);
  const templateEngine = new TemplateEngine();

  const markdownContent = templateEngine.processClipping(
    { title: `${pageTitle} (选中部分)`, content: markdownResult.markdown, excerpt: selection.textContent.substring(0, 140), author: pageInfoResult.data?.author || '', date: pageInfoResult.data?.date || '' },
    pageUrl,
    templateContent,
    selection.textContent
  );

  return await imaAPI.clipArticle(
    { title: `${pageTitle} (选中部分)`, content: markdownContent },
    knowledgeBaseId
  );
}

async function execContentScript(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (error.message.includes('Receiving end does not exist')) {
      try {
        await injectContentScript(tabId);
        await new Promise(r => setTimeout(r, 100));
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (e) {
        return { success: false, error: `注入脚本失败: ${e.message}` };
      }
    }
    return { success: false, error: error.message };
  }
}

async function injectContentScript(tabId) {
  const scripts = ['lib/readability.js', 'lib/turndown.js', 'content/content.js'];
  for (const s of scripts) {
    await chrome.scripting.executeScript({ target: { tabId }, files: [s] });
  }
}

// ===== 消息监听 =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      let result;

      switch (request.type) {
        // --- 原有消息类型（完全保留）---
        case 'TEST_CONNECTION':
          result = await testConnection(request.credentials);
          break;

        case 'CLIP_PAGE':
          result = await clipPage(request);
          break;

        case 'GET_TEMPLATES':
          result = await templateStorage.getAllTemplates();
          break;

        case 'SAVE_TEMPLATE':
          result = await templateStorage.saveTemplate(request.template);
          break;

        case 'DELETE_TEMPLATE':
          result = await templateStorage.deleteTemplate(request.templateId);
          break;

        // --- 新增消息类型（仅新 UI 使用）---
        case 'GET_CONFIG':
          result = await getConfig();
          break;

        case 'SAVE_CONFIG':
          result = await saveConfig(request.config);
          break;

        case 'GET_CONFIG_STATE': {
          const cfg = await getConfig();
          if (cfg && cfg.credentials && cfg.credentials.clientId && cfg.credentials.apiKey && cfg.connected) {
            result = { configured: true, knowledgeBase: cfg.selectedKbName || null, templateId: cfg.selectedTemplateId || 'default' };
          } else {
            result = { configured: false };
          }
          break;
        }

        case 'GET_KB_TREE':
          result = await getKbTree();
          break;

        // --- 实时预览：提取当前页面内容，不保存 ---
        case 'GET_PAGE_PREVIEW':
          result = await getPagePreview(request.tabId);
          break;

        case 'SAVE_CLIPPED_CONTENT':
          result = await saveClippedContent(request);
          break;

        default:
          result = { success: false, error: '未知的消息类型' };
      }

      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // keep message channel open
});

// ===== 右键菜单点击 =====
chrome.contextMenus.onClicked.addListener((info, tab) => {
  (async () => {
    const config = await getConfig();
    if (!config || !config.connected || !config.selectedKbId) {
      console.warn('IMA Web Clipper: 未完成设置');
      return;
    }

    let mode = 'full';
    if (info.menuItemId === 'clip-selection') mode = 'selection';
    else if (info.menuItemId === 'clip-url') mode = 'url-only';
    else if (info.menuItemId !== 'clip-full') return;

    const result = await clipPage({
      tabId: tab.id,
      credentials: config.credentials,
      knowledgeBaseId: config.selectedKbId,
      clippingMode: mode
    });
    console.log('右键剪藏结果:', result);
  })();
});

initService();
