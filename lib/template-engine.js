/**
 * 模板引擎
 * 处理 Markdown 模板和变量替换，支持 YAML frontmatter
 */

class TemplateEngine {
  constructor() {
    this.defaultTemplate = `# {{title}}

{{author}}  {{date}}

{{content}}

---

来源：[{{url}}]({{url}}) · 由 IMA Web Clipper 保存`;

    this.variables = {
      '{{title}}': '标题',
      '{{url}}': '网页 URL',
      '{{date}}': '剪藏时间',
      '{{content}}': '文章内容',
      '{{excerpt}}': '文章摘要',
      '{{author}}': '作者',
      '{{wechat_account}}': '公众号名称',
      '{{selection}}': '选中文本'
    };
  }

  /**
   * 解析 YAML frontmatter
   * @param {string} text - 原始文本
   * @returns {{ yaml: Object|null, body: string }}
   */
  parseYamlFrontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n*/);
    if (!match) {
      return { yaml: null, body: text };
    }

    const yamlText = match[1];
    const body = text.slice(match[0].length);
    const yaml = this._parseSimpleYaml(yamlText);

    return { yaml, body };
  }

  /**
   * 简单 YAML 解析器
   * 支持: key: value, key: "quoted", key: [list], 多行
   */
  _parseSimpleYaml(text) {
    const result = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // key: value 或 key: "value" 或 key: [item1, item2]
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      // 空值跳过
      if (!value) continue;

      // 解析数组 [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        result[key] = inner ? inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : [];
        continue;
      }

      // 去除引号
      value = value.replace(/^["']|["']$/g, '');

      // 尝试解析布尔和数字
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(value) && value !== '') value = Number(value);

      result[key] = value;
    }

    return result;
  }

  /**
   * 替换模板变量
   * @param {string} template - 模板字符串
   * @param {Object} data - 变量数据
   * @returns {string} 处理后的内容
   */
  applyTemplate(template, data) {
    let result = template;

    for (const [variable, defaultValue] of Object.entries(this.variables)) {
      const key = variable.slice(2, -2);
      const value = data[key] !== undefined ? data[key] : (defaultValue || '');
      result = result.replace(new RegExp(this._escapeRegExp(variable), 'g'), value);
    }

    return result;
  }

  /**
   * 处理含 YAML frontmatter 的模板
   * @param {string} template - 模板文本
   * @param {Object} data - 模板变量数据
   * @returns {{ yaml: Object|null, body: string, result: string }}
   */
  processTemplate(template, data) {
    const { yaml, body } = this.parseYamlFrontmatter(template);

    // 处理 YAML 中的变量
    let yamlResult = '';
    if (yaml) {
      const processedYaml = {};
      for (const [key, value] of Object.entries(yaml)) {
        if (typeof value === 'string') {
          processedYaml[key] = this._replaceInString(value, data);
        } else if (Array.isArray(value)) {
          processedYaml[key] = value.map(item =>
            typeof item === 'string' ? this._replaceInString(item, data) : item
          );
        } else {
          processedYaml[key] = value;
        }
      }
      yamlResult = this._serializeYaml(processedYaml);
    }

    // 处理 body 中的变量
    const bodyResult = this.applyTemplate(body, data);

    // 组装完整结果
    const fullResult = yaml ? `---\n${yamlResult}---\n\n${bodyResult}` : bodyResult;

    return {
      yaml,
      body: bodyResult,
      result: fullResult
    };
  }

  /**
   * 在字符串中替换变量
   */
  _replaceInString(str, data) {
    for (const [variable] of Object.entries(this.variables)) {
      const key = variable.slice(2, -2);
      const value = data[key] !== undefined ? data[key] : '';
      str = str.replace(new RegExp(this._escapeRegExp(variable), 'g'), value);
    }
    return str;
  }

  /**
   * 序列化 YAML 对象为文本
   */
  _serializeYaml(yaml) {
    const lines = [];
    for (const [key, value] of Object.entries(yaml)) {
      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`);
      } else if (typeof value === 'string') {
        if (value.includes(':') || value.includes('#') || value.includes('"')) {
          lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * 获取默认模板
   */
  getDefaultTemplate() {
    return this.defaultTemplate;
  }

  /**
   * 获取变量列表
   */
  getVariables() {
    return this.variables;
  }

  /**
   * 创建模板数据对象
   */
  createTemplateData(article, url, selection = '') {
    const now = new Date();
    const author = article.author || article.byline || '';
    const dateStr = article.date || now.toLocaleString('zh-CN');
    return {
      title: article.title || '无标题',
      url: url || '',
      date: dateStr,
      content: article.content || '',
      excerpt: article.excerpt || '',
      author: author,
      wechat_account: article.wechat_account || article.accountName || '',
      selection: selection || ''
    };
  }

  /**
   * 处理完整剪藏流程（兼容旧接口）
   */
  processClipping(article, url, template, selection = '') {
    const data = this.createTemplateData(article, url, selection);
    const { result } = this.processTemplate(template, data);
    return result;
  }

  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ===== 模板存储管理 =====
class TemplateStorage {
  constructor() {
    this.storageKey = 'ima_clipper_templates';
    this.defaultTemplates = [
      {
        id: 'default',
        name: '默认模板',
        content: `# {{title}}

{{author}}  {{date}}

{{content}}

---

来源：[{{url}}]({{url}}) · 由 IMA Web Clipper 保存`,
        isDefault: true
      },
      {
        id: 'simple',
        name: '简洁模板',
        content: `# {{title}}

{{content}}

[原文链接]({{url}})`,
        isDefault: true
      },
      {
        id: 'tech',
        name: '技术文章模板',
        content: `# {{title}}

> 作者：{{author}} · 来源：[{{url}}]({{url}}) · 时间：{{date}}

{{content}}

---

*由 IMA Web Clipper 保存*`,
        isDefault: true
      }
    ];
  }

  async getAllTemplates() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const savedTemplates = result[this.storageKey] || [];
      const allTemplates = [...this.defaultTemplates];

      savedTemplates.forEach(userTemplate => {
        if (!this.defaultTemplates.some(t => t.id === userTemplate.id)) {
          allTemplates.push(userTemplate);
        }
      });

      return allTemplates;
    } catch (error) {
      console.error('获取模板失败:', error);
      return this.defaultTemplates;
    }
  }

  async saveTemplate(template) {
    try {
      const allTemplates = await this.getAllTemplates();
      const userTemplates = allTemplates.filter(t => !t.isDefault);
      const existingIndex = userTemplates.findIndex(t => t.id === template.id);

      if (existingIndex >= 0) {
        userTemplates[existingIndex] = template;
      } else {
        userTemplates.push(template);
      }

      await chrome.storage.local.set({ [this.storageKey]: userTemplates });
      return true;
    } catch (error) {
      console.error('保存模板失败:', error);
      return false;
    }
  }

  async deleteTemplate(templateId) {
    try {
      if (this.defaultTemplates.some(t => t.id === templateId)) {
        return false;
      }
      const allTemplates = await this.getAllTemplates();
      const userTemplates = allTemplates.filter(t => !t.isDefault).filter(t => t.id !== templateId);
      await chrome.storage.local.set({ [this.storageKey]: userTemplates });
      return true;
    } catch (error) {
      console.error('删除模板失败:', error);
      return false;
    }
  }

  async getTemplateContent(templateId) {
    const allTemplates = await this.getAllTemplates();
    const template = allTemplates.find(t => t.id === templateId);
    return template ? template.content : this.defaultTemplates[0].content;
  }
}

// 跨环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TemplateEngine, TemplateStorage };
} else if (typeof self !== 'undefined') {
  self.TemplateEngine = TemplateEngine;
  self.TemplateStorage = TemplateStorage;
} else {
  window.TemplateEngine = TemplateEngine;
  window.TemplateStorage = TemplateStorage;
}
