/**
 * IMA API 封装
 * 封装 IMA OpenAPI 调用
 */

class IMAAPI {
  /**
   * 构造函数
   * @param {Object} credentials - 凭证信息
   * @param {string} credentials.clientId - Client ID
   * @param {string} credentials.apiKey - API Key
   */
  constructor(credentials) {
    this.credentials = credentials;
    this.baseURL = 'https://ima.qq.com/openapi';
    this.skillVersion = '1.1.7';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'ima-openapi-clientid': credentials.clientId,
      'ima-openapi-apikey': credentials.apiKey,
      'ima-openapi-ctx': `skill_version=${this.skillVersion}`
    };
  }

  /**
   * 发送 API 请求
   * @param {string} endpoint - API 端点
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _request(endpoint, data) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`API 错误: ${result.msg || '未知错误'}`);
      }

      return result.data || {};
    } catch (error) {
      console.error('IMA API 请求错误:', error);
      throw error;
    }
  }

  /**
   * 测试连接
   * @returns {Promise<Object>} 连接测试结果
   */
  async testConnection() {
    try {
      // 通过获取知识库列表来测试连接
      const knowledgeBases = await this.getKnowledgeBaseList();
      return {
        success: true,
        knowledgeBases: knowledgeBases
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取可添加的知识库列表
   * @returns {Promise<Array>} 知识库列表
   */
  async getKnowledgeBaseList() {
    const data = await this._request('/wiki/v1/get_addable_knowledge_base_list', {
      cursor: '',
      limit: 50
    });

    return data.addable_knowledge_base_list || [];
  }

  /**
   * 浏览知识库内容（支持文件夹层级）
   * POST /openapi/wiki/v1/get_knowledge_list
   * @param {string} knowledgeBaseId - 知识库 ID
   * @param {string} folderId - 文件夹 ID，空字符串表示根目录
   * @param {string} cursor - 游标
   * @param {number} limit - 数量限制 (1-50)
   * @returns {Promise<{knowledge_list: Array, is_end: boolean, next_cursor: string, current_path: Array}>}
   */
  async getKnowledgeList(knowledgeBaseId, folderId = '', cursor = '', limit = 50) {
    const params = { cursor, limit, knowledge_base_id: knowledgeBaseId };
    if (folderId) params.folder_id = folderId;
    return await this._request('/wiki/v1/get_knowledge_list', params);
  }

  /**
   * 导入文档为笔记
   * @param {string} content - Markdown 内容
   * @param {number} contentFormat - 内容格式 (1: Markdown)
   * @returns {Promise<string>} 笔记 ID
   */
  async importDoc(content, contentFormat = 1) {
    const data = await this._request('/note/v1/import_doc', {
      content_format: contentFormat,
      content: content
    });

    return data.note_id;
  }

  /**
   * 添加知识到知识库
   * @param {string} knowledgeBaseId - 知识库 ID
   * @param {string} noteId - 笔记 ID
   * @param {string} title - 标题
   * @returns {Promise<Object>} 添加结果
   */
  async addKnowledge(knowledgeBaseId, noteId, title) {
    const data = await this._request('/wiki/v1/add_knowledge', {
      media_type: 11, // 笔记类型
      note_info: {
        content_id: noteId
      },
      title: title,
      knowledge_base_id: knowledgeBaseId
    });

    return data;
  }

  /**
   * 导入 URL 到知识库
   * @param {string} knowledgeBaseId - 知识库 ID
   * @param {Array<string>} urls - URL 列表
   * @returns {Promise<Object>} 导入结果
   */
  async importUrls(knowledgeBaseId, urls) {
    const data = await this._request('/wiki/v1/import_urls', {
      knowledge_base_id: knowledgeBaseId,
      urls: urls
    });

    return data;
  }

  /**
   * 完整剪藏工作流（模式 A）
   * @param {Object} article - 文章信息
   * @param {string} article.title - 文章标题
   * @param {string} article.content - HTML 内容
   * @param {string} knowledgeBaseId - 知识库 ID
   * @returns {Promise<Object>} 剪藏结果
   */
  async clipArticle(article, knowledgeBaseId) {
    try {
      // 1. 导入文档为笔记
      const noteId = await this.importDoc(article.content);

      // 2. 添加到知识库
      const result = await this.addKnowledge(knowledgeBaseId, noteId, article.title);

      return {
        success: true,
        noteId: noteId,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * URL 剪藏工作流（模式 B）
   * @param {string} url - 网页 URL
   * @param {string} knowledgeBaseId - 知识库 ID
   * @returns {Promise<Object>} 剪藏结果
   */
  async clipUrl(url, knowledgeBaseId) {
    try {
      const result = await this.importUrls(knowledgeBaseId, [url]);

      return {
        success: true,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 导出 - 支持 Service Worker 和浏览器环境
if (typeof module !== 'undefined' && module.exports) {
  // Node.js 环境
  module.exports = IMAAPI;
} else if (typeof self !== 'undefined') {
  // Service Worker 环境
  self.IMAAPI = IMAAPI;
} else {
  // 浏览器环境
  window.IMAAPI = IMAAPI;
}
