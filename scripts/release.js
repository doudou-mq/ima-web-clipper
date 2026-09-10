#!/usr/bin/env node

/**
 * 发版：以 manifest.json 的版本号打 tag 并推送，由 GitHub Actions 自动发 Release
 *
 *   node scripts/release.js            只创建本地 tag
 *   node scripts/release.js --push     创建并推送 tag（触发 CI）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const tag = `v${manifest.version}`;
const push = process.argv.includes('--push');

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

const existing = execSync('git tag --list ' + tag, { cwd: ROOT, encoding: 'utf8' }).trim();
if (existing) {
  console.error(`❌ ${tag} 已存在。先提升 manifest.json / package.json 的 version。`);
  process.exit(1);
}

const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
if (dirty) {
  console.error('❌ 工作区有未提交改动，先提交再发版（tag 必须指向含本次改动的 commit）：');
  console.error(dirty);
  process.exit(1);
}

sh(`git tag -a ${tag} -m "IMA Web Clipper ${manifest.version}"`);
console.log(`✓ 已创建 tag ${tag}`);

if (push) {
  sh(`git push origin ${tag}`);
  console.log(`✓ 已推送 ${tag} —— Actions 会打包 zip 并发布到 Release`);
  console.log(`  进度：https://github.com/doudou-mq/ima-web-clipper/actions`);
} else {
  console.log(`下一步：node scripts/release.js --push`);
}
