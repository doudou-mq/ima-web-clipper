/**
 * Turndown.js - 简化版本
 * HTML 转 Markdown 工具
 */

(function(global) {
  'use strict';
  
  /**
   * TurndownService 构造函数
   * @param {Object} options - 配置选项
   */
  function TurndownService(options) {
    this.options = options || {};
    this.rules = new Rules();
  }
  
  /**
   * 将 HTML 转换为 Markdown
   * @param {string|HTMLElement} input - HTML 字符串或元素
   * @returns {string} Markdown 字符串
   */
  TurndownService.prototype.turndown = function(input) {
    if (input === null || input === undefined) {
      return '';
    }
    
    // 如果是字符串，转换为 DOM 元素
    if (typeof input === 'string') {
      var doc = document.implementation.createHTMLDocument('');
      doc.body.innerHTML = input;
      input = doc.body;
    }
    
    // 递归处理子节点
    return this._processNode(input);
  };
  
  /**
   * 处理节点
   * @param {Node} node - DOM 节点
   * @returns {string} 处理结果
   */
  TurndownService.prototype._processNode = function(node) {
    var result = '';
    
    // 处理文本节点
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    // 处理元素节点
    if (node.nodeType === Node.ELEMENT_NODE) {
      var element = node;
      var rule = this.rules.getRule(element.nodeName.toLowerCase());
      
      if (rule) {
        result = rule.handle(element, this);
      } else {
        // 默认处理：递归处理子节点
        for (var i = 0; i < element.childNodes.length; i++) {
          result += this._processNode(element.childNodes[i]);
        }
      }
    }
    
    return result;
  };
  
  /**
   * 规则管理器
   */
  function Rules() {
    this._rules = {};
    this._initRules();
  }
  
  Rules.prototype._initRules = function() {
    // 段落
    this.addRule('p', {
      handle: function(element, turndown) {
        var content = '';
        for (var i = 0; i < element.childNodes.length; i++) {
          content += turndown._processNode(element.childNodes[i]);
        }
        return content + '\n\n';
      }
    });
    
    // 标题
    this.addRule('h1', this._createHeadingRule(1));
    this.addRule('h2', this._createHeadingRule(2));
    this.addRule('h3', this._createHeadingRule(3));
    this.addRule('h4', this._createHeadingRule(4));
    this.addRule('h5', this._createHeadingRule(5));
    this.addRule('h6', this._createHeadingRule(6));
    
    // 链接
    this.addRule('a', {
      handle: function(element, turndown) {
        var href = element.getAttribute('href') || '';
        var text = '';
        for (var i = 0; i < element.childNodes.length; i++) {
          text += turndown._processNode(element.childNodes[i]);
        }
        
        if (href && text) {
          return '[' + text + '](' + href + ')';
        }
        return text;
      }
    });
    
    // 图片
    this.addRule('img', {
      handle: function(element) {
        var src = element.getAttribute('src') || '';
        var alt = element.getAttribute('alt') || '';
        return '![' + alt + '](' + src + ')';
      }
    });
    
    // 列表
    this.addRule('ul', {
      handle: function(element, turndown) {
        var result = '';
        var items = element.querySelectorAll('li');
        for (var i = 0; i < items.length; i++) {
          var itemContent = '';
          for (var j = 0; j < items[i].childNodes.length; j++) {
            itemContent += turndown._processNode(items[i].childNodes[j]);
          }
          result += '- ' + itemContent.trim() + '\n';
        }
        return result + '\n';
      }
    });
    
    this.addRule('ol', {
      handle: function(element, turndown) {
        var result = '';
        var items = element.querySelectorAll('li');
        for (var i = 0; i < items.length; i++) {
          var itemContent = '';
          for (var j = 0; j < items[i].childNodes.length; j++) {
            itemContent += turndown._processNode(items[i].childNodes[j]);
          }
          result += (i + 1) + '. ' + itemContent.trim() + '\n';
        }
        return result + '\n';
      }
    });
    
    // 代码
    this.addRule('code', {
      handle: function(element, turndown) {
        var content = '';
        for (var i = 0; i < element.childNodes.length; i++) {
          content += turndown._processNode(element.childNodes[i]);
        }
        return '`' + content + '`';
      }
    });
    
    // 引用
    this.addRule('blockquote', {
      handle: function(element, turndown) {
        var content = '';
        for (var i = 0; i < element.childNodes.length; i++) {
          content += turndown._processNode(element.childNodes[i]);
        }
        return '> ' + content.trim().replace(/\n/g, '\n> ') + '\n\n';
      }
    });
    
    // 换行
    this.addRule('br', {
      handle: function() {
        return '  \n';
      }
    });
    
    // 水平线
    this.addRule('hr', {
      handle: function() {
        return '\n---\n\n';
      }
    });
  };
  
  Rules.prototype._createHeadingRule = function(level) {
    return {
      handle: function(element, turndown) {
        var content = '';
        for (var i = 0; i < element.childNodes.length; i++) {
          content += turndown._processNode(element.childNodes[i]);
        }
        var prefix = '#'.repeat(level);
        return prefix + ' ' + content.trim() + '\n\n';
      }
    };
  };
  
  Rules.prototype.addRule = function(tagName, rule) {
    this._rules[tagName.toLowerCase()] = rule;
  };
  
  Rules.prototype.getRule = function(tagName) {
    return this._rules[tagName.toLowerCase()];
  };
  
  // 导出到全局
  global.TurndownService = TurndownService;
  
})(typeof module === 'object' && module.exports ? global : window);