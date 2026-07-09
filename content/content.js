/**
 * IMA Web Clipper — 内容提取脚本
 * 注入到页面中，提供内容提取功能
 * 支持微信公众号文章专用提取 + 通用 Readability 提取
 */

class ContentExtractor {
  constructor() {
    this.readability = null;
    this.turndown = null;
    this._initLibraries();
    this._setupTurndownRules();
  }

  _initLibraries() {
    if (typeof Readability !== 'undefined') this.readability = Readability;
    if (typeof TurndownService !== 'undefined') {
      this.turndown = new TurndownService({
        headingStyle: 'atx',        // ## heading
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full'
      });
    }
  }

  /**
   * 自定义 Turndown 规则 — 优化输出质量
   */
  _setupTurndownRules() {
    if (!this.turndown) return;

    // 简化版 Turndown API:
    //   this.turndown.rules.addRule(tagName, { handle: function(element, turndown) { ... } })
    //   handle 需手动 turndown._processNode(childNodes[i])
    //   不是标准版的 addRule(name, {filter, replacement})
    var rules = this.turndown.rules;

    // 移除无用元素（handle 不捕获 tag，无需闭包）
    var removeTags = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'svg', 'form', 'input', 'button', 'select', 'textarea'];
    for (var t = 0; t < removeTags.length; t++) {
      rules.addRule(removeTags[t], {
        handle: function() { return ''; }
      });
    }

    // 图片 — 优先 data-src，过滤空/本地/占位图
    rules.addRule('img', {
      handle: function(element) {
        var src = element.getAttribute('data-src') || element.getAttribute('src') || '';
        if (!src || src.startsWith('data:') || src.startsWith('file://')) return '';
        var alt = element.getAttribute('alt') || '';
        return '![' + alt + '](' + src + ')';
      }
    });

    // 链接 — 过滤 javascript: 和 # 空链接
    rules.addRule('a', {
      handle: function(element, turndown) {
        var href = element.getAttribute('href') || '';
        var text = '';
        for (var i = 0; i < element.childNodes.length; i++) {
          text += turndown._processNode(element.childNodes[i]);
        }
        if (href.startsWith('javascript:') || href === '#') return text;
        if (!href) return text;
        return '[' + text + '](' + href + ')';
      }
    });

    // 表格 — 转 GFM 格式
    rules.addRule('table', {
      handle: function(element, turndown) {
        var rows = element.querySelectorAll('tr');
        if (rows.length < 2) return '';

        var parts = [];
        var headerDone = false;
        var colCount = 0;

        for (var r = 0; r < rows.length; r++) {
          var cells = rows[r].querySelectorAll('td, th');
          if (cells.length === 0) continue;

          var rowParts = [];
          for (var c = 0; c < cells.length; c++) {
            rowParts.push(cells[c].textContent.trim());
          }

          if (!headerDone) {
            colCount = cells.length;
            parts.push('| ' + rowParts.join(' | ') + ' |');
            parts.push('| ' + Array(colCount + 1).join('--- |'));
            headerDone = true;
          } else {
            parts.push('| ' + rowParts.join(' | ') + ' |');
          }
        }

        return '\n' + parts.join('\n') + '\n';
      }
    });
  }

  // ===== 微信公众号文章专用提取 =====
  /**
   * 检测当前页面是否为微信公众号文章
   */
  isWeChatArticle() {
    return window.location.hostname.includes('mp.weixin.qq.com');
  }

  /**
   * 提取微信公众号文章内容
   */
  extractWeChat() {
    // 文章标题
    const titleEl = document.querySelector('#activity-name') ||
                    document.querySelector('.rich_media_title');
    const title = titleEl ? titleEl.textContent.trim() : document.title;

    // 作者
    const authorEl = document.querySelector('#js_name') ||
                     document.querySelector('.profile_nickname') ||
                     document.querySelector('#js_author_name');
    const author = authorEl ? authorEl.textContent.trim() : '';

    // 发布时间
    const dateEl = document.querySelector('#publish_time') ||
                   document.querySelector('#create_time') ||
                   document.querySelector('.rich_media_meta_text');
    const date = dateEl ? dateEl.textContent.trim() : '';

    // 公众号名称
    const accountEl = document.querySelector('#js_name') ||
                      document.querySelector('.rich_media_meta_nickname');
    const accountName = accountEl ? accountEl.textContent.trim() : '';

    // 文章正文
    let contentHtml = '';
    const contentArea = document.querySelector('.rich_media_content') ||
                        document.querySelector('#js_content') ||
                        document.querySelector('.rich_media_area_primary') ||
                        document.querySelector('.rich_media_area_extra_inner');

    if (contentArea) {
      // 深克隆，避免污染原 DOM
      const clone = contentArea.cloneNode(true);
      // 移除 WeChat 注入的样式和脚本
      const junk = clone.querySelectorAll('script, style, iframe, svg, .js_underline_content');
      junk.forEach(el => el.remove());

      // 去除 data-* 属性保持干净
      const allEls = clone.querySelectorAll('*');
      allEls.forEach(el => {
        // 保留必要的属性
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const name = attrs[i].name;
          if (name === 'src' || name === 'href' || name === 'alt' || name === 'width' || name === 'height') continue;
          if (name.startsWith('data-') || name.startsWith('aria-') || name === 'style' || name === 'class' || name === 'id') {
            el.removeAttribute(name);
          }
        }
      });

      contentHtml = clone.innerHTML;
    }

    // 提取正文纯文本
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    // 提取封面图
    const coverImg = document.querySelector('.rich_media_thumb_img') ||
                     document.querySelector('meta[property="og:image"]');
    let coverUrl = '';
    if (coverImg) {
      coverUrl = coverImg.getAttribute('src') || coverImg.getAttribute('data-src') || '';
    }
    if (!coverUrl && coverImg && coverImg.getAttribute) {
      // meta tag
      coverUrl = coverImg.getAttribute('content') || '';
    }

    return {
      title,
      content: contentHtml,
      textContent,
      excerpt: textContent.substring(0, 200),
      byline: author,
      author,
      date,
      accountName,
      coverUrl,
      success: true,
      source: 'wechat'
    };
  }

  // ===== 通用元数据提取 =====
  extractPageMetadata() {
    const meta = {
      title: document.title,
      author: '',
      date: '',
      description: '',
      tags: []
    };

    // 从 meta 标签取
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
      const prop = tag.getAttribute('property') || tag.getAttribute('name') || '';
      const content = tag.getAttribute('content') || '';

      if (prop === 'og:title' || prop === 'twitter:title') meta.title = content || meta.title;
      if (prop === 'article:author' || prop === 'author' || prop === 'og:author') meta.author = content || meta.author;
      if (prop === 'article:published_time' || prop === 'date') meta.date = content || meta.date;
      if (prop === 'description' || prop === 'og:description') meta.description = content || meta.description;
      if (prop === 'keywords' || prop === 'article:tag') {
        if (content) meta.tags = content.split(',').map(s => s.trim()).filter(Boolean);
      }
    });

    // 从 DOM 取（覆盖 meta 标签）
    if (!meta.author) {
      const el = document.querySelector('[rel="author"]') ||
                 document.querySelector('meta[name="author"]');
      if (el) meta.author = el.getAttribute('content') || el.textContent || '';
    }

    if (!meta.date) {
      const el = document.querySelector('time') ||
                 document.querySelector('.date') ||
                 document.querySelector('.post-date') ||
                 document.querySelector('[datetime]');
      if (el) meta.date = el.getAttribute('datetime') || el.textContent || '';
    }

    return meta;
  }

  // ===== Readability 提取 =====
  extractWithReadability() {
    if (!this.readability) throw new Error('Readability 库未加载');

    try {
      const documentClone = document.cloneNode(true);
      const reader = new this.readability(documentClone);
      const article = reader.parse();

      if (article && article.content) {
        const cleanContent = this.cleanHtml(article.content);
        const meta = this.extractPageMetadata();

        return {
          title: article.title || document.title,
          content: cleanContent,
          textContent: article.textContent || '',
          excerpt: article.excerpt || '',
          byline: article.byline || meta.author || '',
          author: meta.author || article.byline || '',
          date: meta.date || '',
          description: meta.description || '',
          length: article.length || 0,
          success: true,
          source: 'readability'
        };
      }
      throw new Error('Readability 返回空内容');
    } catch (error) {
      console.error('Readability 提取失败，尝试备用提取:', error.message || error);
      return this.fallbackExtract();
    }
  }

  // ===== 备用提取 =====
  fallbackExtract() {
    const meta = this.extractPageMetadata();

    // 尝试常见内容容器
    const selectors = [
      'article',
      '[role="main"]',
      '.post-content', '.article-content', '.entry-content',
      '.content', '#content',
      '.rich_media_content', '.rich_media_area_primary', // 微信
      'main', '.main-content'
    ];

    let contentEl = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 200) {
        contentEl = el.cloneNode(true);
        break;
      }
    }

    if (contentEl) {
      const html = this.cleanHtml(contentEl.innerHTML);
      const text = contentEl.textContent || contentEl.innerText || '';
      return {
        title: meta.title || document.title,
        content: html,
        textContent: text,
        excerpt: text.substring(0, 200),
        byline: meta.author || '',
        author: meta.author || '',
        date: meta.date || '',
        description: meta.description || '',
        length: text.length,
        success: true,
        source: 'fallback-selector'
      };
    }

    // 最终手段：清理 body 后取可见段落
    const bodyClone = document.body.cloneNode(true);
    const removals = bodyClone.querySelectorAll(
      'script, style, nav, header, footer, aside, iframe, ' +
      '.nav, .navbar, .header, .footer, .sidebar, .menu, ' +
      '.comment, .comments, #comment, #comments, ' +
      '.ad, .ads, .advertisement, .recommend, .related, ' +
      '.share, .social, .toolbar, form, input, button, select, textarea'
    );
    removals.forEach(el => el.remove());

    const contentParts = [];
    const contentTags = bodyClone.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th');
    contentTags.forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 10) contentParts.push(el.outerHTML);
    });

    const finalHtml = contentParts.join('\n');
    const finalText = bodyClone.textContent || bodyClone.innerText || '';

    return {
      title: meta.title || document.title,
      content: finalHtml || '',
      textContent: finalText,
      excerpt: finalText.substring(0, 200),
      byline: meta.author || '',
      author: meta.author || '',
      date: meta.date || '',
      description: meta.description || '',
      length: finalText.length,
      success: true,
      source: 'fallback-body'
    };
  }

  // ===== 选区提取 =====
  extractSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (!selectedText) return { content: '', textContent: '', success: false, error: '未选中任何文本' };

    let selectedHtml = '';
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const div = document.createElement('div');
      div.appendChild(range.cloneContents());
      selectedHtml = div.innerHTML;
    }

    return { content: selectedHtml, textContent: selectedText, success: true };
  }

  // ===== 完整 HTML =====
  extractFullHtml() {
    return { content: document.documentElement.outerHTML, textContent: document.body.textContent || document.body.innerText, success: true };
  }

  // ===== HTML 清理 =====
  cleanHtml(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // 移除无用标签
    const removals = tempDiv.querySelectorAll('script, style, noscript, iframe, object, embed, svg, form, input, button, select, textarea');
    removals.forEach(el => el.remove());

    // 移除空标签
    const empties = tempDiv.querySelectorAll('p:empty, div:empty, span:empty, li:empty, h1:empty, h2:empty, h3:empty, h4:empty, h5:empty, h6:empty');
    empties.forEach(el => el.remove());

    // 移除 WeChat 特定垃圾
    const junk = tempDiv.querySelectorAll('.js_underline_content, .rich_media_area_extra, .rich_media_area_extra_inner');
    junk.forEach(el => el.remove());

    // 清除图片 data-src 写入 src
    const imgs = tempDiv.querySelectorAll('img[data-src]');
    imgs.forEach(img => {
      if (!img.getAttribute('src') || img.getAttribute('src') === '') {
        img.setAttribute('src', img.getAttribute('data-src'));
      }
      img.removeAttribute('data-src');
      img.removeAttribute('data-ratio');
      img.removeAttribute('data-w');
    });

    // 移除 style 属性
    const allEls = tempDiv.querySelectorAll('[style]');
    allEls.forEach(el => el.removeAttribute('style'));

    return tempDiv.innerHTML;
  }

  // ===== 处理图片 =====
  processImages(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const images = tempDiv.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('file://')) img.remove();
      if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
    });
    return tempDiv.innerHTML;
  }

  // ===== HTML → Markdown =====
  htmlToMarkdown(html) {
    if (!this.turndown) throw new Error('Turndown 库未加载');
    try {
      // 先预清理：去掉无用的 div 包装，保留内联内容
      let cleaned = html
        .replace(/<div[^>]*>/gi, '\n')
        .replace(/<\/div>/gi, '')
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // 控制字符

      return this.turndown.turndown(cleaned)
        .replace(/\n{4,}/g, '\n\n') // 压缩过多空行
        .replace(/[ \t]+$/gm, '')   // 去除行尾空白
        .trim();
    } catch (error) {
      console.error('HTML 转 Markdown 失败:', error);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || tempDiv.innerText || '';
    }
  }
}

// ===== 全局实例 =====
let extractor = null;

function initExtractor() {
  if (!extractor) extractor = new ContentExtractor();
  return extractor;
}

// ===== 消息监听 =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const extractor = initExtractor();

  switch (request.type) {
    case 'EXTRACT_CONTENT': {
      try {
        const mode = request.mode || 'readability';
        let result;

        switch (mode) {
          case 'wechat':
            result = extractor.extractWeChat();
            break;
          case 'readability':
            // 自动识别微信文章
            if (extractor.isWeChatArticle()) {
              result = extractor.extractWeChat();
            } else {
              result = extractor.extractWithReadability();
            }
            break;
          case 'selection':
            result = extractor.extractSelection();
            break;
          case 'full':
            result = extractor.extractFullHtml();
            break;
          default:
            result = extractor.extractWithReadability();
        }

        // 清理和优化
        if (result.content) {
          result.content = extractor.cleanHtml(result.content);
          result.content = extractor.processImages(result.content);
        }

        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
    }

    case 'HTML_TO_MARKDOWN': {
      try {
        const markdown = extractor.htmlToMarkdown(request.html);
        sendResponse({ success: true, markdown });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
    }

    case 'GET_PAGE_INFO': {
      try {
        const meta = extractor.extractPageMetadata();
        sendResponse({ success: true, data: {
          url: window.location.href,
          title: document.title,
          description: meta.description,
          author: meta.author,
          date: meta.date,
          favicon: getFaviconUrl()
        }});
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
    }

    default:
      sendResponse({ success: false, error: '未知的消息类型' });
  }

  return true; // 保持消息通道
});

// ===== 工具函数 =====
function getFaviconUrl() {
  const icon = document.querySelector('link[rel*="icon"]');
  if (icon) {
    const href = icon.getAttribute('href');
    if (href && !href.startsWith('data:')) return new URL(href, window.location.origin).href;
  }
  return new URL('/favicon.ico', window.location.origin).href;
}

// ===== 导出到 window =====
window.IMAClipper = {
  extractor: initExtractor(),
  extractContent: function(mode) {
    const ex = initExtractor();
    if (mode === 'wechat' || (mode === 'readability' && ex.isWeChatArticle())) return ex.extractWeChat();
    return ex.extractWithReadability();
  },
  htmlToMarkdown: function(html) { return initExtractor().htmlToMarkdown(html); }
};

initExtractor();
console.log('IMA Web Clipper 内容脚本已加载');
