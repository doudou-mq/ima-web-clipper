/**
 * Readability.js - 简化版本
 * 基于 Mozilla Readability 的内容提取算法
 */

(function(global) {
  'use strict';
  
  /**
   * Readability 构造函数
   * @param {Document} doc - 文档对象
   * @param {Object} options - 配置选项
   */
  function Readability(doc, options) {
    this._doc = doc;
    this._options = options || {};
    
    // 默认配置
    this._defaultOptions = {
      debug: false,
      maxElemsToParse: 0,
      nbTopCandidates: 5,
      charThreshold: 500,
      classesToPreserve: [],
      keepClasses: false,
      serializer: function(el) {
        return el.innerHTML;
      },
      disableJSONLD: false
    };
    
    for (var opt in this._defaultOptions) {
      if (this._defaultOptions.hasOwnProperty(opt) && !this._options.hasOwnProperty(opt)) {
        this._options[opt] = this._defaultOptions[opt];
      }
    }
  }
  
  /**
   * 解析文档并提取内容
   * @returns {Object} 解析结果
   */
  Readability.prototype.parse = function() {
    try {
      // 简化版本：直接返回页面基本信息
      var article = {
        title: this._getArticleTitle(),
        content: this._getArticleContent(),
        textContent: this._getTextContent(),
        length: 0,
        excerpt: '',
        byline: '',
        dir: ''
      };
      
      // 计算长度
      if (article.textContent) {
        article.length = article.textContent.length;
        article.excerpt = article.textContent.substring(0, 140);
      }
      
      return article;
    } catch (e) {
      console.error('Readability parse error:', e);
      return {
        title: '',
        content: '',
        textContent: '',
        length: 0,
        excerpt: '',
        byline: '',
        dir: ''
      };
    }
  };
  
  /**
   * 获取文章标题
   * @returns {string} 文章标题
   */
  Readability.prototype._getArticleTitle = function() {
    var doc = this._doc;
    var curTitle = '';
    var origTitle = '';
    
    try {
      curTitle = origTitle = doc.title.trim();
      
      // 尝试从 h1 标签获取标题
      var h1 = doc.getElementsByTagName('h1')[0];
      if (h1) {
        var h1Title = h1.textContent.trim();
        if (h1Title.length > 0) {
          curTitle = h1Title;
        }
      }
      
      return curTitle;
    } catch (e) {
      return origTitle || '';
    }
  };
  
  /**
   * 获取文章内容
   * @returns {string} HTML 内容
   */
  Readability.prototype._getArticleContent = function() {
    var doc = this._doc;
    
    // 简化版本：尝试获取主要内容区域
    var contentSelectors = [
      'article',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content',
      'main',
      '.main-content'
    ];
    
    for (var i = 0; i < contentSelectors.length; i++) {
      var element = doc.querySelector(contentSelectors[i]);
      if (element) {
        return element.innerHTML;
      }
    }
    
    // 如果没有找到特定区域，返回 body 内容
    return doc.body.innerHTML;
  };
  
  /**
   * 获取纯文本内容
   * @returns {string} 纯文本内容
   */
  Readability.prototype._getTextContent = function() {
    var content = this._getArticleContent();
    var tempDiv = this._doc.createElement('div');
    tempDiv.innerHTML = content;
    return tempDiv.textContent || tempDiv.innerText || '';
  };
  
  // 导出到全局
  global.Readability = Readability;
  
})(typeof module === 'object' && module.exports ? global : window);