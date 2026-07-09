# IMA Web Clipper

一键剪藏网页内容到 [ima.copilot](https://ima.copilot.com) 知识库的浏览器插件。

## 功能特性

- **一键剪藏**：将当前网页内容保存为 Markdown 笔记，关联到 IMA 知识库
- **微信公众号优化**：自动识别微信公众号文章，提取标题、作者、公众号名、发布时间
- **模板系统**：自定义 Markdown 模板，支持 YAML frontmatter 和变量替换，实时预览
- **实时预览**：打开弹窗时自动提取页面内容并渲染模板，保存前可见最终效果
- **知识库树形浏览**：在设置页查看知识库的文件夹与文档结构，选择目标位置
- **右键菜单**：在页面上右键快速剪藏
- **快捷键**：`Ctrl+Shift+S`（Windows/Linux）或 `Command+Shift+S`（Mac）
- **安全存储**：Session / Local 分级凭证管理

## 安装方法

### 开发模式
1. 克隆或下载本项目
2. 打开 Chrome/Edge 浏览器
3. 进入扩展管理页面（`chrome://extensions/` 或 `edge://extensions/`）
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择本项目目录

### 生产模式
待发布到 Chrome Web Store 和 Edge Add-ons 商店。

## 使用方法

### 首次使用
1. 点击浏览器工具栏中的 IMA Web Clipper 图标
2. 弹出提示"还未完成设置"，点击「打开设置页面」
3. 在设置页的「凭证配置」面板输入 Client ID 和 API Key，点击「测试连接」
4. 连接成功后前往「知识库」面板，点击「获取知识库结构」浏览并选择目标文件夹
5. 前往「模板管理」面板选择合适的 Markdown 模板
6. 关闭设置页，回到弹窗即可看到当前页面的实时预览

### 一键剪藏
1. 打开要剪藏的网页
2. 点击插件图标 → 弹窗自动提取内容并预览
3. 选择目标知识库（可在下拉或设置页的树形结构中预选）
4. 可在顶部下拉切换不同模板，实时查看效果
5. 点击「添加到 ima.copilot」保存到知识库

### 快速剪藏
- **右键菜单**：在页面上右键 → 「剪藏到 IMA」→ 选择剪藏方式
- **快捷键**：`Ctrl+Shift+S`（Win/Linux）或 `Command+Shift+S`（Mac）

## 配置说明

### 凭证管理
- **Session Storage**：默认存储，浏览器关闭后清除
- **Local Storage**：勾选"记住凭证"后使用，适合个人设备
- **安全提示**：插件会明确提示凭证存储位置和风险

### 设置页（Options）
采用左右结构布局：
- **🔑 凭证配置**：Client ID + API Key 输入与连接测试
- **📚 知识库**：树形浏览知识库文件夹与文档，选择目标位置
- **📝 模板管理**：左右结构编辑器，支持编辑/预览 Tab 切换

### 模板系统
- **默认模板**：提供三种默认模板（默认、简洁、技术文章）
- **自定义模板**：支持创建、编辑、删除自定义模板
- **YAML Frontmatter**：模板支持 `---` 分隔的元数据区（标题、作者、日期、关键词、标签）
- **实时预览**：设置页和弹窗均支持 Markdown 实时渲染
- **模板变量**：

| 变量 | 说明 |
|---|---|
| `{{title}}` | 文章标题 |
| `{{url}}` | 网页 URL |
| `{{date}}` | 文章发布时间（微信文章取原始时间） |
| `{{content}}` | 文章内容（Markdown 格式） |
| `{{excerpt}}` | 文章摘要 |
| `{{author}}` | 文章作者 |
| `{{wechat_account}}` | 微信公众号名称 |
| `{{selection}}` | 选中文本 |

## 项目结构

```
ima-web-clipper/
├── manifest.json                 # 插件配置文件 (MV3)
├── popup/                        # 工具栏弹窗（简约 UI）
│   ├── popup.html               # 弹窗界面（4 状态：未配置/就绪/保存中/完成）
│   ├── popup.js                 # 弹窗逻辑（实时预览 + 一键保存）
│   └── popup.css                # 弹窗样式
├── background/                   # 后台服务 Worker
│   └── service-worker.js        # 消息路由、API 调用、配置管理、右键菜单
├── content/                      # 页面注入脚本
│   └── content.js               # 内容提取（微信专用 + Readability + 三层回退）
├── lib/                          # 核心库
│   ├── readability.js           # Mozilla 内容提取算法
│   ├── turndown.js              # HTML 转 Markdown（简化版 + 自定义规则）
│   ├── ima-api.js               # IMA OpenAPI 封装（9 个方法）
│   └── template-engine.js       # 模板引擎（变量替换 + YAML frontmatter）
├── options/                      # 设置页（左右布局）
│   ├── options.html             # 设置界面
│   └── options.js               # 设置逻辑
├── icons/                        # 插件图标
├── docs/                         # 文档
│   ├── ob.md                    # Obsidian Web Clipper 输出参考
│   └── ima.md                   # 当前剪藏输出参考
└── README.md                     # 说明文档
```

## 技术栈

- **Manifest V3**：Chrome / Edge 扩展标准
- **原生 JavaScript**：无框架依赖
- **Readability.js**：Mozilla 正文提取算法
- **Turndown.js**：HTML → Markdown 转换（简化版 + 自定义规则）
- **IMA OpenAPI**：腾讯 IMA 知识库接口（17 个可用接口）
- **Chrome APIs**：扩展 API、Storage API、消息传递、右键菜单

## 内容提取流程

```
网页页面
  ├─ 微信公众号 (mp.weixin.qq.com) → extractWeChat()
  │   → 从 DOM 取标题、作者、公众号名、发布时间、正文
  ├─ 其他网页 → Readability 提取
  │   → 成功 → 清理 HTML → Turndown 转 Markdown
  │   → 失败 → 12 种选择器回退 → 再失败 → body 段落提取
  └─ 所有路径 → cleanHtml() → processImages() → 返回 Markdown
```

## 开发指南

### 环境要求
- Chrome 88+ 或 Edge 88+
- 文本编辑器或 IDE
- IMA 账号和 API 凭证

### 本地开发
1. 修改代码后保存
2. 在扩展管理页面点击刷新图标
3. 右键插件图标 →「检查」调试 Popup

### 调试方法
- **Popup**：右键插件图标 →「检查」
- **Content Script**：打开开发者工具 → Console
- **Background**：扩展管理页面 →「service worker」链接

## IMA API 依赖

| 接口 | 用途 | 状态 |
|---|---|---|
| `get_addable_knowledge_base_list` | 获取可添加的知识库列表 | ✅ |
| `get_knowledge_list` | 浏览知识库文件/文件夹 | ✅ |
| `import_doc` | 以 Markdown 创建笔记 | ✅ |
| `add_knowledge` | 将笔记关联到知识库 | ✅ |
| `import_urls` | 直接导入 URL | ✅ |
| `search_knowledge_base` | 搜索知识库 | ✅ |
| `search_knowledge` | 搜索知识库内容 | ✅ |
| `get_knowledge_base` | 获取知识库信息 | ✅ |
| `get_media_info` | 获取媒体信息 | ✅ |
| `search_note` | 搜索笔记 | ✅ |
| `get_doc_content` | 获取笔记内容 | ✅ |

## 限制说明

由于 IMA OpenAPI 的限制：

1. **本地图片保存**：IMA 笔记接口不支持本地图片
2. **文件附件**：仅支持 Markdown 文本内容
3. **修改/删除**：OpenAPI 没有提供修改和删除接口
4. **文件夹管理**：创建文件夹的 API 未暴露

## 版本历史

### v1.0.0（当前）
- 实时预览：弹窗自动提取当前页面内容并渲染模板
- 微信公众号专用提取：标题、作者、公众号名、发布时间
- 模板 YAML Frontmatter 支持
- 知识库树形浏览与文件夹选择
- 左右结构设置页（凭证/知识库/模板管理/关于）
- 自定义 Turndown 规则（图片 data-src、javascript 过滤、GFM 表格）
- 三层内容提取回退策略

### v1.0.0
- 初始版本发布
- 基本剪藏功能
- 凭证管理和模板系统
- 右键菜单和快捷键支持

## 许可证

MIT License
