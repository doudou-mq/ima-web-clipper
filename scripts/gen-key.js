#!/usr/bin/env node

/**
 * 生成 / 校验固定扩展 ID 所需的密钥
 *
 *   node scripts/gen-key.js          查看当前 ID；缺私钥时生成
 *   node scripts/gen-key.js --write  把公钥同步进 manifest.json 的 key 字段
 *
 * 原理：扩展 ID = SHA-256(SPKI DER 公钥) 前 16 字节，每半字节映射到 a-p。
 * 只要 manifest.key 不变，任何人、任何浏览器、任何解压路径加载都得到同一个 ID。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const KEY_DIR = path.join(ROOT, 'keys');
const PRIVATE_PEM = path.join(KEY_DIR, 'ima-web-clipper-private.pem');
const MANIFEST = path.join(ROOT, 'manifest.json');

const ALPHA = 'abcdefghijklmnop';

function idFromSpkiDer(der) {
  const hash = crypto.createHash('sha256').update(der).digest().subarray(0, 16);
  let id = '';
  for (const b of hash) id += ALPHA[b >> 4] + ALPHA[b & 0x0f];
  return id;
}

function toPkcs1Pem(privateKey) {
  // Chrome 的打包器认 PKCS#1（BEGIN RSA PRIVATE KEY），统一成这一种
  return privateKey.export({ type: 'pkcs1', format: 'pem' });
}

function main() {
  const write = process.argv.includes('--write');
  let privateKey;

  if (fs.existsSync(PRIVATE_PEM)) {
    privateKey = crypto.createPrivateKey(
      fs.readFileSync(PRIVATE_PEM)
    );
    // 顺手把格式规范成 PKCS#1
    fs.writeFileSync(PRIVATE_PEM, toPkcs1Pem(privateKey));
  } else {
    console.log('未找到私钥，生成 2048 位 RSA 密钥对...');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = pair.privateKey;
    fs.mkdirSync(KEY_DIR, { recursive: true });
    fs.writeFileSync(PRIVATE_PEM, toPkcs1Pem(privateKey), { mode: 0o600 });
    console.log(`已写入 ${path.relative(ROOT, PRIVATE_PEM)}（权限 600）`);
  }

  // 私钥只能导出 pkcs1/pkcs8，公钥要先提出来再导 SPKI DER
  const spkiDer = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const keyB64 = spkiDer.toString('base64');
  const id = idFromSpkiDer(spkiDer);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  console.log('\n扩展 ID     : ' + id);
  console.log('manifest.key: ' + (manifest.key ? '已设置' : '未设置'));

  if (manifest.key === keyB64) {
    console.log('\n✓ manifest.json 的 key 与私钥一致，无需改动。');
  } else if (write) {
    const raw = fs.readFileSync(MANIFEST, 'utf8');
    if (manifest.key) {
      fs.writeFileSync(MANIFEST, raw.replace(/"key":\s*"[^"]*"/, `"key": ${JSON.stringify(keyB64)}`));
    } else {
      fs.writeFileSync(MANIFEST, raw.replace(/("description":\s*"[^"]*",)/, `$1\n  "key": ${JSON.stringify(keyB64)},`));
    }
    console.log('\n✓ 已把公钥写入 manifest.json。');
  } else {
    console.log('\n! manifest.key 与私钥不匹配 —— 用 --write 同步。');
  }

  console.log(`\nID 也可用于下载地址与文档：chrome-extension://${id}/`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ ' + error.message);
    process.exit(1);
  }
}

module.exports = { idFromSpkiDer };
