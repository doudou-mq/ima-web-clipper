#!/usr/bin/env node

/**
 * 打包 IMA Web Clipper —— 产出跨浏览器可用的 zip
 *
 *   node scripts/package.js
 *
 * 产物（都在 dist/ 下）：
 *   dist/ima-web-clipper/                可直接"加载已解压的扩展程序"的目录
 *   dist/ima-web-clipper.zip             稳定文件名，给文档里的永久下载链接用
 *   dist/ima-web-clipper-<version>.zip   同一份内容，带版本号，给归档用
 *
 * zip 内是单层目录 ima-web-clipper/，用户解压后直接选这个文件夹加载。
 *
 * 为什么不用 .crx：Edge 完全不认本地 crx（装上也会被判定未知来源后自动删除），
 * Chrome/QQ/360 走 crx 或 zip 拖拽又会解压到临时目录、重启即失效。
 * 唯一四个浏览器都成立的安装法是「解压到固定目录 + 加载已解压的扩展程序」。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { idFromSpkiDer } = require('./gen-key');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, 'ima-web-clipper');

// 白名单：只打运行期真正需要的东西。
// 用白名单而不是黑名单，是为了杜绝把 .git / docs / test / README 一起发出去
// —— 旧 build.js 的排除正则匹配不到顶层 .git，dist 里会混进整个仓库历史。
const INCLUDE_FILES = ['manifest.json'];
const INCLUDE_DIRS = [
  { dir: 'background' },
  { dir: 'content' },
  { dir: 'lib' },
  { dir: 'popup' },
  { dir: 'options' },
  // icons 目录里混着出图脚本和 base64 中间产物，只收图片
  { dir: 'icons', allow: /\.(png|jpg|jpeg|svg|webp)$/i },
  { dir: 'assets', allow: /\.(png|jpg|jpeg|svg|webp|css|js)$/i },
];

const skipped = [];

function isAscii(name) {
  return !/[^\x20-\x7e]/.test(name);
}

function copyInto(srcDir, rel, destDir) {
  const src = path.join(srcDir, rel);
  const dest = path.join(destDir, rel);
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyInto(srcDir, path.join(rel, entry), destDir);
    }
    return;
  }

  const base = path.basename(rel);
  const rules = INCLUDE_DIRS.find((d) => rel.split(path.sep)[0] === d.dir);
  if (rules && rules.allow && !rules.allow.test(base)) {
    skipped.push(rel + '  （非资源文件）');
    return;
  }
  // 中文/非 ASCII 文件名在 Windows 自带解压下容易乱码，图标会直接裂
  if (!isAscii(base)) {
    skipped.push(rel + '  （非 ASCII 文件名）');
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function stage() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });

  for (const file of INCLUDE_FILES) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      throw new Error(`缺少 ${file}`);
    }
    fs.copyFileSync(path.join(ROOT, file), path.join(STAGE, file));
  }
  for (const { dir } of INCLUDE_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) {
      throw new Error(`缺少 ${dir}/`);
    }
    for (const entry of fs.readdirSync(abs)) {
      copyInto(ROOT, path.join(dir, entry), STAGE);
    }
  }
}

/** 收集 manifest 里引用的所有相对文件路径，确保打包后一个都不缺 */
function manifestRefs(node, out = []) {
  if (typeof node === 'string') {
    const isFile = /\.[a-z0-9]{2,5}$/i.test(node) && !node.startsWith('<') && !node.includes('://');
    if (isFile) out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) manifestRefs(item, out);
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) manifestRefs(value, out);
  }
  return out;
}

function validate() {
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE, 'manifest.json'), 'utf8'));
  const problems = [];

  for (const ref of new Set(manifestRefs(manifest))) {
    if (!fs.existsSync(path.join(STAGE, ref))) problems.push(`manifest 引用但文件不存在：${ref}`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  if (pkg.version !== manifest.version) {
    problems.push(`版本不一致：manifest ${manifest.version} / package.json ${pkg.version}`);
  }
  if (!manifest.key) {
    problems.push('manifest 没有 key 字段 —— 各浏览器会按解压路径各发一个 ID');
  }

  // 仓库约定（CHANGELOG.md）：版本号要在 manifest / package.json / CHANGELOG / 设置页文案 四处同步，
  // 设置页里写死的 v1.2.3 最容易漏，这里一起挡住
  for (const uiFile of ['options/options.html', 'popup/popup.html']) {
    const ui = path.join(STAGE, uiFile);
    if (!fs.existsSync(ui)) continue;
    for (const m of fs.readFileSync(ui, 'utf8').matchAll(/\bv(\d+\.\d+\.\d+)\b/g)) {
      if (m[1] !== manifest.version) {
        problems.push(`${uiFile} 里的 v${m[1]} 与 manifest ${manifest.version} 不一致`);
      }
    }
  }

  const id = manifest.key
    ? idFromSpkiDer(Buffer.from(manifest.key, 'base64'))
    : '(未固定)';

  return { manifest, problems, id };
}

function makeZip(zipPath) {
  fs.rmSync(zipPath, { force: true });
  const args = ['-qr', path.basename(zipPath), path.basename(STAGE)];
  try {
    execFileSync('zip', args, { cwd: DIST, stdio: 'inherit' });
  } catch (error) {
    if (process.platform !== 'win32') throw error;
    // Windows 上没装 zip 时的兜底
    execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path '${path.join(STAGE)}' -DestinationPath '${zipPath}' -Force`,
    ], { stdio: 'inherit' });
  }
}

function main() {
  console.log('🚀 打包 IMA Web Clipper\n');

  stage();
  const { manifest, problems, id } = validate();

  if (skipped.length) {
    console.log('剔除的非运行期文件：');
    for (const s of skipped) console.log('  - ' + s);
    console.log();
  }
  if (problems.length) {
    console.error('❌ 打包前检查未通过：');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }

  const versioned = path.join(DIST, `ima-web-clipper-${manifest.version}.zip`);
  const stable = path.join(DIST, 'ima-web-clipper.zip');
  makeZip(versioned);
  fs.copyFileSync(versioned, stable);

  const files = fs.readdirSync(STAGE, { recursive: true }).filter((f) => fs.statSync(path.join(STAGE, f)).isFile());
  const size = (fs.statSync(versioned).size / 1024).toFixed(1);

  console.log('✅ 打包完成\n');
  console.log(`扩展 ID   : ${id}`);
  console.log(`版本      : ${manifest.version}`);
  console.log(`文件数    : ${files.length}`);
  console.log(`解压目录  : ${STAGE}`);
  console.log(`zip       : ${versioned} (${size} KB)`);
  console.log(`zip(稳定名): ${stable}`);
  console.log(`\n安装：浏览器扩展页 → 开发者模式 → 加载已解压的扩展程序 → 选 ima-web-clipper 文件夹`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('\n❌ 构建失败: ' + (error.stderr ? error.stderr.toString() : error.message));
    process.exit(1);
  }
}
