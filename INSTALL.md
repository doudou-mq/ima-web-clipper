# IMA Web Clipper 安装和使用指南

## 系统要求

- 内核 ≥ Chromium 88 的浏览器（Chrome / Edge / QQ浏览器 11+ / 新版 360）
- IMA 账号和 API 访问权限
- 有效的 Client ID 和 API Key

## 获取安装包

发布产物在 GitHub Releases，两个文件内容相同：

| 文件 | 用途 |
|------|------|
| `ima-web-clipper.zip` | 稳定文件名，配 `releases/latest/download/` 写进文档不会失效 |
| `ima-web-clipper-<版本号>.zip` | 归档某一次的具体版本 |

```bash
curl -L -o ima-web-clipper.zip \
  https://github.com/doudou-mq/ima-web-clipper/releases/latest/download/ima-web-clipper.zip
```

## 安装步骤（四个浏览器通用）

zip 解压后是单层目录 `ima-web-clipper/`，`manifest.json` 就在它下面。

1. **解压到一个固定目录** —— 别在压缩包的临时预览窗口里直接加载，也别解压完就挪走。
   浏览器记住的是**文件夹路径**，路径一变扩展就失效，表现就是重启后"已删除"或"无法加载扩展程序"。
   建议放 `D:\browser-extensions\ima-web-clipper` 这种不会动的位置。
2. **打开扩展管理页面**
   - Chrome / QQ浏览器 / 360：`chrome://extensions/`
   - Edge：`edge://extensions/`
3. **开启开发者模式**（页面右上角开关）
4. **加载插件** —— 点"加载已解压的扩展程序"，选第 1 步那个**文件夹本身**
   （不是选 zip 文件，也不是选文件夹里的 `manifest.json`）

扩展 ID 已固定在 `piccfkjngomjhpbmlabnheidblehleai`，四个浏览器加载得到同一个 ID。

### 各浏览器的差异

| 浏览器 | 本地 zip / crx | 说明 |
|--------|----------------|------|
| Chrome | 都可拖拽安装 | 但拖拽会解压到临时目录，重启后失效；日常仍推荐上面的"加载已解压" |
| Edge | **都不支持** | 扩展页只有"加载已解压的扩展程序"一个入口。硬塞 crx 会被判为未知来源，装上后自动删除并提示"插件已删除" |
| QQ浏览器 11+ | 支持加载已解压 | 内核 Chromium 94，满足 MV3 要求 |
| 360 安全/极速浏览器 | 取决于内核版本 | 内核 ≥88 才能装 MV3。地址栏 `chrome://help` 或 设置→关于 查看版本；低于 88 会报"使用了不受支持的清单版本"，只能升级浏览器或改用 Chrome / Edge |
| Firefox | 不支持 | 依赖 Chrome 扩展 API，需另行移植 |

### 为什么只发 zip、不发 .crx

- Edge 从设计上不认本地 crx：非商店来源且 ID 不在 Edge 加载项目录里的，会被后台校验停用并删除。
- Chrome 拖 crx / 拖 zip 装出来的扩展解压在临时目录，下次启动就没了，还会挂"未列在网上应用店中"的黄条警告。
- 唯一在四个浏览器上行为一致的安装法就是"解压到固定目录 + 加载已解压"，所以发布物只需要一个 zip。

## 首次配置

### 1. 获取 IMA API 凭证

1. 登录 IMA 管理后台
2. 进入 API 管理页面
3. 创建新的 API 密钥或使用现有密钥
4. 记录以下信息：
   - **Client ID**
   - **API Key**

### 2. 配置插件

1. **点击插件图标**
   - 在浏览器工具栏中找到 IMA Web Clipper 图标
   - 点击打开配置界面

2. **输入凭证**
   ```
   Client ID: [您的 Client ID]
   API Key: [您的 API Key]
   ```

3. **测试连接**
   - 点击"测试连接"按钮
   - 等待连接测试完成
   - 成功后会显示可用的知识库列表

4. **选择知识库**
   - 从下拉菜单中选择目标知识库
   - 这个知识库将用于保存剪藏的内容

5. **配置剪藏模式**
   - **完整剪藏**：提取页面正文并转换为 Markdown（推荐）
   - **仅保存 URL**：只保存网页链接
   - **仅保存选区**：只保存选中的文本

6. **选择模板**
   - 使用默认模板或自定义模板
   - 模板决定了保存内容的格式

## 使用方法

### 基本剪藏

1. **打开要剪藏的网页**
2. **点击插件图标**
3. **确认设置**
   - 确保已选择正确的知识库
   - 选择剪藏模式
4. **点击"剪藏当前页面"**
5. **等待完成**
   - 成功后会显示提示信息
   - 失败时会显示错误原因

### 快速剪藏

#### 右键菜单
1. 在页面上右键
2. 选择"剪藏到 IMA"
3. 选择子菜单：
   - **完整剪藏**
   - **剪藏选中文本**
   - **仅保存 URL**

#### 快捷键
- 默认快捷键：`Ctrl+Shift+S` (Windows/Linux) 或 `Command+Shift+S` (Mac)
- 可以自定义快捷键（Chrome 扩展管理页面 → 键盘快捷键）

### 选区剪藏

1. **选中页面上的文本**
2. **右键点击选中区域**
3. **选择"剪藏到 IMA" → "剪藏选中文本"**
4. 选中的文本将单独保存为笔记

## 模板管理

### 访问模板管理
1. 点击插件图标
2. 点击"管理模板"按钮
3. 进入模板管理页面

### 创建新模板
1. 点击"添加新模板"
2. 填写模板信息：
   - **模板 ID**：唯一标识符（字母、数字、连字符）
   - **模板名称**：显示名称
   - **模板内容**：Markdown 格式，可以使用变量
3. 点击"保存模板"

### 编辑模板
1. 在模板列表中找到要编辑的模板
2. 点击"编辑"按钮
3. 修改模板内容
4. 点击"保存模板"

### 删除模板
1. 在模板列表中找到要删除的模板
2. 点击"删除"按钮
3. 确认删除

### 可用变量
在模板中可以使用以下变量：

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{{title}}` | 文章标题 | "IMA Web Clipper 测试页面" |
| `{{url}}` | 网页 URL | "https://example.com/test" |
| `{{date}}` | 剪藏时间 | "2024-01-15 14:30:25" |
| `{{content}}` | 文章内容 | 完整的 Markdown 内容 |
| `{{excerpt}}` | 文章摘要 | "这是一个用于测试..." |
| `{{author}}` | 文章作者 | "测试作者" |
| `{{selection}}` | 选中文本 | "选中的文本内容" |

## 故障排除

### 安装类问题

#### Edge 添加后提示"插件已删除"
你在装 `.crx`。Edge 不认本地 crx：它拿 crx 签名公钥派生出的 ID 去 Edge 加载项目录里查，查不到就判定为未知来源侧载，装上后几秒或下次启动时自动卸载。
**解决**：改用 zip + "加载已解压的扩展程序"，见上文安装步骤。

#### 提示"无法加载扩展程序"或重启后扩展消失
解压目录是临时路径（压缩包预览窗口里直接加载），或事后把文件夹挪走/改名了。
**解决**：解压到固定目录 → 在扩展页移除失效条目 → 重新"加载已解压"。

#### 360 上报"使用了不受支持的清单版本"
本插件是 Manifest V3，需要内核 ≥ Chromium 88；部分 360 版本停在 86。
**解决**：地址栏 `chrome://help` 确认内核版本，升级 360 到新版，或改用 Chrome / Edge / QQ浏览器 11+。

#### 每次打包扩展 ID 都变、配置丢失
manifest 里没有 `key` 时，"加载已解压"的 ID 由**解压路径**决定，换台机器就换一个 ID。
**解决**：本仓库已在 manifest.json 固定 `key`，ID 恒为 `piccfkjngomjhpbmlabnheidblehleai`。要改回去请执行 `npm run keygen`（见下文"构建与发布"）。

### 常见问题

#### 1. 连接测试失败
**可能原因：**
- Client ID 或 API Key 错误
- 网络连接问题
- IMA API 服务不可用

**解决方法：**
1. 检查凭证是否正确
2. 确认网络连接正常
3. 等待一段时间后重试

#### 2. 剪藏内容不完整
**可能原因：**
- 页面结构复杂
- Readability 算法无法正确识别正文

**解决方法：**
1. 尝试使用"完整 HTML"模式
2. 手动调整选区后使用选区剪藏

#### 3. 图片无法显示
**可能原因：**
- 图片是本地文件（file://）
- 图片链接失效
- IMA 不支持某些图片格式

**解决方法：**
1. 插件会自动过滤本地图片
2. 网络图片应该可以正常显示

### 调试方法

#### 查看错误信息
1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签页
3. 查看插件输出的错误信息

#### 检查网络请求
1. 打开开发者工具
2. 切换到 Network 标签页
3. 查看 IMA API 请求和响应

#### 重置插件
1. 进入扩展管理页面
2. 找到 IMA Web Clipper
3. 点击"移除"然后重新安装

## 构建与发布

### 本地打包

```bash
npm run build      # 或 node scripts/package.js
```

产出：

```
dist/ima-web-clipper/                 直接可"加载已解压"的目录
dist/ima-web-clipper.zip              稳定名，给下载链接用
dist/ima-web-clipper-<版本号>.zip      归档用
```

打包脚本走**白名单**（`manifest.json` + `background/ content/ lib/ popup/ options/ icons/ assets/`），并在压缩前校验：manifest 引用到的每个文件都在、manifest 与 package.json 版本一致、`key` 字段存在。任何一项不过就退出非 0，不会产出一个装不上的包。
顺手剔除 `icons/` 里的出图脚本和 `*.base64`，以及所有非 ASCII 文件名（中文文件名在 Windows 自带解压下会乱码导致图标裂）。

### 扩展 ID 与密钥

`manifest.json` 的 `key` 决定扩展 ID，私钥在 `keys/ima-web-clipper-private.pem`（已被 .gitignore 排除）。

```bash
npm run keygen          # 查看当前 ID、校验 manifest.key 与私钥是否一致
npm run keygen -- --write  # 把公钥同步进 manifest.json
```

- **私钥必须备份**：它一旦丢了，重新生成的就是另一个 ID，对已安装用户等于换了一个插件。
- 只有以后要出 `.crx` 或上架商店时才用得到私钥；发 zip 用不上它。
- 将来上架 Chrome Web Store / Edge Add-ons 后，ID 由商店用你的开发者账号重新签发，`key` 只影响手动加载这条路径。

### 发版

```bash
# 1. 提升版本号：manifest.json + package.json + CHANGELOG.md 三处保持一致
# 2. 提交
git commit -am "release v1.7.1" && git push
# 3. 打 tag 并推送 —— Actions 自动打包 zip 并发布到 Release
npm run release
```

只想先本地建 tag 不动远端：`npm run release:local`。

CI：
- `.github/workflows/release.yml` —— `v*` tag 触发，自动建 Release 并挂 zip。
- `.github/workflows/verify.yml` —— 每次 push main / PR 都跑一遍打包，并断言 `.git`、`*.pem`、README、docs、test 不会混进产物。

> 不要把 zip commit 进仓库：二进制进 git 历史后每次发版都永久增大仓库体积，且无法真正删除。走 Releases 附件。

## 安全注意事项

### 凭证安全
- **Session Storage**：默认使用，浏览器关闭后自动清除
- **Local Storage**：勾选"记住凭证"后使用，仅限个人设备
- **公共电脑**：不要在公共电脑上记住凭证

### 数据隐私
- 插件只向 IMA API 发送剪藏的内容
- 不会收集用户的浏览历史
- 不会向第三方发送数据

### 权限说明
插件需要以下权限：
- `activeTab`：访问当前标签页内容
- `storage`：保存用户设置和模板
- `contextMenus`：添加右键菜单
- `scripting`：注入内容脚本
- `https://ima.qq.com/*`：访问 IMA API

## 更新日志

### v1.0.0 (开发中)
- 初始版本
- 基本剪藏功能
- 模板系统
- 右键菜单支持
- 快捷键支持

## 获取帮助

### 文档资源
- [README.md](./README.md) - 项目概述
- [接口清单](../ima-skill/接口清单.md) - IMA API 参考

### 问题反馈
1. 检查是否是最新版本
2. 查看控制台错误信息
3. 提供复现步骤
4. 联系开发团队

### 功能建议
欢迎提出功能建议和改进意见！

---

**注意**：本插件为开发版本，功能可能不完整。生产使用前请充分测试。