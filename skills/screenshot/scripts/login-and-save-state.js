#!/usr/bin/env node
/**
 * ログインして auth-state.json を更新するスクリプト
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const STATE_FILE = path.resolve(__dirname, '..', 'auth-state.json');
const BASE_URL = 'http://ticket.greenexpo.local';
const EMAIL = 'testuser@expo.local';
const PASSWORD = 'Asdf1234!';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();

  try {
    console.log('ログインページへ移動...');
    await page.goto(`${BASE_URL}/login/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch(e) { console.log('  networkidle timeout (ignored)'); }
    await page.waitForTimeout(1000);
    
    console.log('URL:', page.url());
    
    // メールアドレス入力
    const emailInput = await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    await emailInput.fill(EMAIL);
    
    // パスワード入力
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pwInput.fill(PASSWORD);
    
    // ログインボタンクリック
    console.log('ログインボタンをクリック...');
    await page.click('button[type="submit"]');
    
    // ログイン後のページを待つ
    try {
      await page.waitForURL(/\/(mypage|index|\?)/, { timeout: 30000 });
    } catch(e) {
      console.log('  URL変化なし: ' + page.url());
    }
    
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch(e) { console.log('  networkidle timeout (ignored)'); }
    
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('ログイン後URL:', currentUrl);
    
    if (currentUrl.includes('/login/')) {
      // エラーメッセージを確認
      const error = await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent || '');
      console.error('ログイン失敗. エラー:', error || 'unknown');
      process.exit(1);
    }
    
    // auth-state.json を保存
    await ctx.storageState({ path: STATE_FILE });
    console.log('✅ auth-state.json を保存しました:', STATE_FILE);
    
    // 確認
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    const sessionCookie = state.cookies.find(c => c.name === 'session_id');
    if (sessionCookie) {
      console.log('session_id expires:', new Date(sessionCookie.expires * 1000).toISOString());
      console.log('session_id domain:', sessionCookie.domain);
      console.log('session_id value (first 20):', sessionCookie.value.substring(0, 20));
    } else {
      console.log('⚠ session_id cookie が見つかりません');
      console.log('Cookies:', state.cookies.map(c => c.name));
    }
    
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
