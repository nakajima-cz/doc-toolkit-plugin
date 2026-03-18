#!/usr/bin/env node
/**
 * ログインして auth-state.json を更新するスクリプト
 *
 * 使い方:
 *   SCREENSHOT_EMAIL=your@email.com SCREENSHOT_PASSWORD=yourpass node setup-auth.js
 *
 * または .claude/skills/screenshot/.env に記述:
 *   SCREENSHOT_EMAIL=your@email.com
 *   SCREENSHOT_PASSWORD=yourpass
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// .env ファイルを読み込む（存在する場合）
const envFile = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf-8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  });
}

const STATE_FILE = path.resolve(__dirname, '..', 'auth-state.json');
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://ticket.greenexpo.local';
const EMAIL = process.env.SCREENSHOT_EMAIL;
const PASSWORD = process.env.SCREENSHOT_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('❌ SCREENSHOT_EMAIL と SCREENSHOT_PASSWORD を設定してください');
  console.error('   例: SCREENSHOT_EMAIL=your@email.com SCREENSHOT_PASSWORD=pass node setup-auth.js');
  console.error('   または .claude/skills/screenshot/.env に記述してください');
  process.exit(1);
}

(async () => {
  console.log(`🔑 ログイン中: ${EMAIL}`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE_URL}/login/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch(e) {}
    await page.waitForTimeout(1000);

    const emailInput = await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    await emailInput.fill(EMAIL);
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pwInput.fill(PASSWORD);

    await page.click('button[type="submit"]');

    try {
      await page.waitForURL(url => !url.includes('/login/'), { timeout: 30000 });
    } catch(e) {}
    try {
      await page.waitForLoadState('networkidle', { timeout: 20000 });
    } catch(e) {}
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login/')) {
      const error = await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent?.trim() || '');
      console.error('❌ ログイン失敗:', error || '認証情報が正しくありません');
      process.exit(1);
    }

    await ctx.storageState({ path: STATE_FILE });

    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    const sessionCookie = state.cookies.find(c => c.name === 'session_id');
    if (sessionCookie) {
      const expires = new Date(sessionCookie.expires * 1000);
      console.log('✅ auth-state.json を更新しました');
      console.log(`   有効期限: ${expires.toLocaleString('ja-JP')}`);
    } else {
      console.log('✅ auth-state.json を更新しました（session_id cookie なし）');
    }

  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
