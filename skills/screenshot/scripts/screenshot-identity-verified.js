#!/usr/bin/env node
/**
 * 本人確認フロー経由のスクリーンショット撮影スクリプト
 *
 * 1. mypage_identity_verification ページで認証コードを要求
 * 2. auth_waiting.json を書き出し（Claude が Gmail MCP でコードを取得して auth_code.json に書く）
 * 3. 認証コード入力 → パスワード変更ページへ遷移
 * 4. スクリーンショット撮影
 *
 * Usage:
 *   node screenshot-identity-verified.js <output-path> [base-url]
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SKILL_DIR = path.resolve(__dirname, '..');
const WAITING_FILE = path.join(SKILL_DIR, 'auth_waiting.json');
const CODE_FILE = path.join(SKILL_DIR, 'auth_code.json');
const STATE_FILE = path.join(SKILL_DIR, 'auth-state.json');

async function main() {
  const [outputPath, baseUrl = 'http://ticket.greenexpo.local'] = process.argv.slice(2);

  if (!outputPath) {
    console.error('Usage: node screenshot-identity-verified.js <output-path> [base-url]');
    process.exit(1);
  }

  if (!fs.existsSync(STATE_FILE)) {
    console.error(`auth-state.json が見つかりません: ${STATE_FILE}`);
    process.exit(1);
  }

  // 前回の一時ファイルをクリア
  if (fs.existsSync(WAITING_FILE)) fs.unlinkSync(WAITING_FILE);
  if (fs.existsSync(CODE_FILE)) fs.unlinkSync(CODE_FILE);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STATE_FILE,
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
  });
  const page = await context.newPage();

  const timeout = 120000;

  try {
    // Step 1: 本人確認ページへ
    const identityUrl = `${baseUrl}/mypage_identity_verification/?path=%2Fmypage_password_change%2F`;
    console.log(`[1/5] 本人確認ページへ移動: ${identityUrl}`);
    // networkidle で待機。ポーリングAPIで networkidle にならない場合は無視して続行
    await page.goto(identityUrl, { waitUntil: 'domcontentloaded', timeout });
    try {
      await page.waitForLoadState('networkidle', { timeout: 90000 });
    } catch (e) {
      console.log(`    → networkidle タイムアウト（無視）: ${e.message.substring(0, 60)}`);
    }
    await page.waitForTimeout(1000);

    console.log(`    → 現在URL: ${page.url()}`);

    // Step 2: 「送信する」ボタンをクリックして認証コードを要求
    console.log(`[2/5] 認証コード送信ボタンをクリック...`);
    await page.click('button[type="submit"]', { timeout });
    console.log(`    → クリック完了`);

    // Step 3: verification_code ページへの遷移を待つ
    console.log(`[3/5] verification_code ページへの遷移を待機...`);
    await page.waitForURL(/\/verification_code/, { timeout });
    console.log(`    → 認証コードページに遷移: ${page.url()}`);

    // 待機シグナルファイルを書き出す
    fs.writeFileSync(WAITING_FILE, JSON.stringify({
      status: 'waiting',
      purpose: 'identity_verification',
      url: page.url(),
      timestamp: new Date().toISOString(),
    }, null, 2));
    console.log(`\n📧 Gmail から認証コードを取得して以下のファイルに書き込んでください:`);
    console.log(`   ${CODE_FILE}`);
    console.log(`   形式: { "code": "123456" }`);
    console.log(`\n   (Claude が自動的に Gmail を確認して書き込みます...)\n`);

    // auth_code.json が書かれるまでポーリング（最大5分）
    const code = await waitForCode(CODE_FILE, 300000);
    console.log(`    → 認証コード取得: ${code}`);

    // Step 4: 認証コードを入力
    await page.fill('#NSW_GP_DL_200_012_0011-input, input[type="text"], input[type="number"], input[name="code"]', code);
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]');
    console.log(`    → 認証コードを送信`);

    // パスワード変更ページへの遷移を待つ
    await page.waitForURL(/\/mypage_password_change/, { timeout });
    // フォームが表示されるまで待つ
    await page.waitForSelector('input[type="password"]', { timeout });
    await page.waitForTimeout(1000);
    console.log(`    → パスワード変更ページに遷移: ${page.url()}`);

    // Step 5: スクリーンショット撮影
    console.log(`[5/5] スクリーンショット撮影...`);
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`\n✅ スクリーンショットを保存しました: ${outputPath}`);

  } finally {
    await browser.close();
    if (fs.existsSync(WAITING_FILE)) fs.unlinkSync(WAITING_FILE);
    if (fs.existsSync(CODE_FILE)) fs.unlinkSync(CODE_FILE);
  }
}

function waitForCode(filePath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (fs.existsSync(filePath)) {
        clearInterval(interval);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          resolve(String(data.code));
        } catch (e) {
          reject(new Error(`auth_code.json のパースに失敗: ${e.message}`));
        }
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`タイムアウト: ${timeoutMs / 1000}秒以内に認証コードが提供されませんでした`));
      }
    }, 1000);
  });
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
