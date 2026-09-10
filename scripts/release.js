#!/usr/bin/env node

/**
 * 发版：以 manifest.json 的版本号打 tag 并推送，由 GitHub Actions 自动发 Release
 *
 *   node scripts/release.js                只创建本地 tag（不联网）
 *   node scripts/release.js --push         建 tag 并推送，触发 CI，回读结果
 *   node scripts/release.js --push --proxy http://127.0.0.1:8668
 *                                          强制走指定代理推送
 *
 * 断点续发：tag 已建好但上次推送失败时，直接重跑 --push 即可补推，不会报"tag 已存在"。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const PUSH = argv.includes('--push');
const TIMEOUT = 20000; // 直连 github 被干扰时会干等 75s，这里 20s 判死

const die = (msg) => { console.error('\n❌ ' + msg + '\n'); process.exit(1); };

function git(args, opts = {}) {
  const r = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: opts.timeout || TIMEOUT,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (r.error || r.status !== 0) {
    return { ok: false, out: ((r.stdout || '') + (r.stderr || '') + (r.error?.message || '')).trim(), status: r.status };
  }
  return { ok: true, out: (r.stdout || '').trim() };
}

function gitMust(args, opts) {
  const r = git(args, opts);
  if (!r.ok) die(`git ${args.join(' ')} 失败：\n${r.out}`);
  return r.out;
}

// ---------------------------------------------------------------- 远端与代理

const proxyIdx = argv.indexOf('--proxy');
const explicitProxy = argv.find((a) => a.startsWith('--proxy='))?.split('=')[1]
  || (proxyIdx >= 0 ? argv[proxyIdx + 1] : null);

const remoteUrl = gitMust(['remote', 'get-url', 'origin']).replace(/\/$/, '');
const repo = (remoteUrl.match(/[:/]([^/]+\/[^/.]+?)(?:\.git)?$/) || [])[1];
if (!repo) die(`认不出 origin 的仓库名：${remoteUrl}`);

/** macOS 系统代理 —— git 不读它，所以直连失败时拿来兜底 */
function guessProxy() {
  if (explicitProxy) return explicitProxy;
  if (process.env.HTTPS_PROXY || process.env.https_proxy) return process.env.HTTPS_PROXY || process.env.https_proxy;
  if (process.platform !== 'darwin') return null;
  const s = spawnSync('scutil', ['--proxy'], { encoding: 'utf8' }).stdout || '';
  const get = (k) => (s.match(new RegExp(k + '\\s*:\\s*(.+)')) || [])[1]?.trim();
  if (get('HTTPEnable') !== '1') return null;
  const host = get('HTTPProxy'), port = get('HTTPPort');
  if (!host || !port) return null;
  if (spawnSync('nc', ['-z', '-G', '2', host, port]).status !== 0) return null; // 端口没在监听就别浪费
  return `http://${host}:${port}`;
}

/** 远端可达吗（--exit-code: 0=有匹配 ref，2=连上了但没匹配，都算通） */
function reachable(env) {
  const r = spawnSync('git', ['ls-remote', '--exit-code', 'origin', 'HEAD'], {
    cwd: ROOT, timeout: TIMEOUT, env: { ...process.env, ...(env || {}) },
  });
  return r.status === 0 || r.status === 2;
}

// ---------------------------------------------------------------- 本地状态

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const tag = `v${manifest.version}`;
const hasLocalTag = !!git(['tag', '--list', tag]).out;
const branch = gitMust(['rev-parse', '--abbrev-ref', 'HEAD']);
const head = gitMust(['rev-parse', '--short', 'HEAD']);
const ensureTag = () => {
  if (hasLocalTag) return;
  const dirty = gitMust(['status', '--porcelain']);
  if (dirty) die(`工作区有未提交改动，tag 必须指向含本次改动的 commit：\n${dirty}`);
  gitMust(['tag', '-a', tag, '-m', `IMA Web Clipper ${manifest.version}`]);
  console.log(`✓ 已创建 tag ${tag}`);
};

console.log(`\n📦 IMA Web Clipper ${manifest.version}  (tag ${tag} @ ${branch} ${head})\n`);

// --------------------------------------------------------------- 只建 tag 模式

if (!PUSH) {
  if (hasLocalTag) console.log(`tag ${tag} 已存在，无需重建。`);
  else ensureTag();
  console.log('下一步：node scripts/release.js --push');
  process.exit(0);
}

// ------------------------------------------------------------------ 联网发版

let proxyEnv = null;
if (reachable(null)) {
  console.log('✓ 直连 origin 可达');
} else {
  const proxy = guessProxy();
  if (!proxy) {
    die(`连不上 ${remoteUrl}\n` +
      '  直连超时，也没找到可用的本地代理。\n' +
      '  开 VPN/代理后重跑：      node scripts/release.js --push\n' +
      '  或显式指定代理端口：      node scripts/release.js --push --proxy http://127.0.0.1:<端口>\n' +
      '  让 git 长期走代理（只作用于这个远端，不影响内网仓库）：\n' +
      `    git config --global http.${remoteUrl}.proxy http://127.0.0.1:<端口>`);
  }
  const env = { https_proxy: proxy, http_proxy: proxy, HTTPS_PROXY: proxy, HTTP_PROXY: proxy };
  if (!reachable(env)) {
    die(`直连和代理 ${proxy} 都连不上 ${remoteUrl}\n  确认代理进程活着，或用 --proxy 指定别的端口。`);
  }
  proxyEnv = env;
  console.log(`! 直连不通，改走本地代理 ${proxy}`);
}

const pushRefs = (refs) => {
  const r = git(['push', 'origin', ...refs], { env: proxyEnv, timeout: TIMEOUT * 2 });
  if (!r.ok) {
    die(`推送 ${refs.join(' ')} 失败：\n${r.out}\n` +
      `  网络恢复后重跑本脚本即可续传：node scripts/release.js --push`);
  }
  return r.out;
};

// ① 先推分支，别让 tag 指向一个远端还不存在的 commit
const aheadRes = git(['rev-list', '--count', `origin/${branch}..HEAD`]);
const ahead = aheadRes.ok ? Number(aheadRes.out) : 0;
if (ahead > 0) {
  pushRefs([branch]);
  console.log(`✓ 已推送 ${branch}（${ahead} 个 commit）`);
} else {
  console.log(`✓ ${branch} 与远端一致`);
}

// ② 建 tag / 补推 tag
if (hasLocalTag) {
  const onRemote = git(['ls-remote', '--tags', 'origin', tag], { env: proxyEnv });
  if (onRemote.ok && onRemote.out) {
    die(`${tag} 本地和远端都已存在 —— 这个版本已经发过了。\n  请提升 manifest.json / package.json 的 version 再发版。`);
  }
  console.log(`↻ ${tag} 已建但远端没有（上次推送中断），补推`);
} else {
  ensureTag();
}
pushRefs([tag]);
console.log(`✓ 已推送 ${tag} → ${repo}`);

// ③ 等 Actions 打包结果
const releaseUrl = `https://github.com/${repo}/releases/tag/${tag}`;
console.log(`  ${releaseUrl}\n`);
console.log('等 Actions 出包（最多 3 分钟）...');

const api = (p) => spawnSync('curl', [
  '-sS', '-m', '12', '-H', 'Accept: application/vnd.github+json',
  ...(proxyEnv ? ['-x', proxyEnv.https_proxy] : []),
  `https://api.github.com/repos/${repo}${p}`,
], { encoding: 'utf8', timeout: TIMEOUT }).stdout;

for (let i = 0; i < 30; i++) {
  if (i === 0) console.log(`   进度页：https://github.com/${repo}/actions`);
  spawnSync('sleep', ['6']);

  let runs = [];
  try { runs = (JSON.parse(api('/actions/runs?per_page=8') || '{}').workflow_runs) || []; } catch { continue; }
  const mine = runs.find((r) => r.head_branch === `refs/tags/${tag}`);
  if (!mine || mine.status !== 'completed') continue;

  if (mine.conclusion !== 'success') {
    die(`Actions 结束，结论 ${mine.conclusion}：\n   ${mine.html_url}`);
  }
  let assets = [];
  try {
    assets = ((JSON.parse(api(`/releases/tags/${tag}`) || '{}').assets) || [])
      .map((a) => `${a.name}  ${(a.size / 1024).toFixed(0)} KB`);
  } catch { /* 拿不到附件也不影响结论 */ }
  console.log('\n✅ Release 已发布');
  for (const a of assets) console.log('   - ' + a);
  console.log(`   下载：https://github.com/${repo}/releases/latest/download/ima-web-clipper.zip`);
  console.log(`   页面：${releaseUrl}\n`);
  process.exit(0);
}
console.log(`\n⏳ 没等到结果，手动看：${releaseUrl}`);
