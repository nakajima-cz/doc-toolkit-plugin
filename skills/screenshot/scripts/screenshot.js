#!/usr/bin/env node
/**
 * pia-green-expo ページスクリーンショットツール
 *
 * Usage:
 *   node screenshot.js <page-path-or-url> <output-path> [cookie-string]
 *
 * Arguments:
 *   page-path-or-url  URLパス (例: /buy) または完全URL (例: http://localhost:3000/buy)
 *   output-path       PNGの保存先パス (例: frontend/specs/buy/index.png)
 *                     ※ SCREENSHOT_ALL=true 時は自動的に4バリアントに展開される
 *   cookie-string     セッションCookie文字列 (例: "session=abc123")
 *
 * Options (環境変数で上書き可能):
 *   BASE_URL              ベースURL (デフォルト: http://ticket.greenexpo.local)
 *   SCREENSHOT_WIDTH      ビューポート幅 (デフォルト: 1440)
 *   SCREENSHOT_HEIGHT     ビューポート高さ (デフォルト: 900)
 *   SCREENSHOT_TIMEOUT    networkidle 待機タイムアウト ms (デフォルト: 60000)
 *   SCREENSHOT_ALL        true にすると4バリアントを一括生成 (デフォルト: false)
 *   SCREENSHOT_HIDE_CHROME ヘッダー・フッターを非表示にして撮影 (デフォルト: false)
 *
 * SCREENSHOT_ALL=true 時の出力ファイル:
 *   [name].png              デスクトップ (1440px) + ヘッダー/フッターあり
 *   [name]_no_chrome.png    デスクトップ (1440px) + ヘッダー/フッターなし
 *   [name]_mobile.png       モバイル (375px)     + ヘッダー/フッターあり
 *   [name]_mobile_no_chrome.png  モバイル (375px) + ヘッダー/フッターなし
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ヘッダー/フッターを非表示にするCSS
const HIDE_CHROME_CSS = `
  header,
  footer,
  [class*="main_bottom"] {
    display: none !important;
  }
`;

async function takeScreenshot({ browser, url, outputPath, width, height, timeout, cookies, hideChrome }) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: 'ja-JP',
  });

  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();

  // 出力ディレクトリを作成
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1) DOM構築まで待機
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

  // 2) APIレスポンス含む全ネットワークが静止するまで待機
  await page.waitForLoadState('networkidle', { timeout });

  // 3) ヘッダー/フッターを非表示にする
  if (hideChrome) {
    await page.addStyleTag({ content: HIDE_CHROME_CSS });
    await page.waitForTimeout(200);
  }

  // 4) アニメーションが落ち着くまで待つ
  await page.waitForTimeout(300);

  await page.screenshot({ path: outputPath, fullPage: true });
  await context.close();

  console.log(`  完了: ${outputPath}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node screenshot.js <page-path-or-url> <output-path> [cookie-string]');
    console.error('');
    console.error('Examples:');
    console.error('  # 単体撮影');
    console.error('  node screenshot.js /buy frontend/specs/buy/index.png');
    console.error('');
    console.error('  # 4バリアント一括生成');
    console.error('  SCREENSHOT_ALL=true node screenshot.js /buy frontend/specs/buy/index.png "session=abc"');
    process.exit(1);
  }

  const baseUrl = (process.env.BASE_URL || 'http://ticket.greenexpo.local').replace(/\/$/, '');
  const url = args[0].startsWith('http') ? args[0] : `${baseUrl}${args[0]}`;
  const outputPath = args[1];
  const cookieString = args[2] || '';

  const desktopWidth = parseInt(process.env.SCREENSHOT_WIDTH || '1440', 10);
  const desktopHeight = parseInt(process.env.SCREENSHOT_HEIGHT || '900', 10);
  const timeout = parseInt(process.env.SCREENSHOT_TIMEOUT || '60000', 10);
  const allVariants = process.env.SCREENSHOT_ALL === 'true';
  const hideChrome = process.env.SCREENSHOT_HIDE_CHROME === 'true';

  // Cookieをパース（一度だけ）
  const cookies = cookieString
    ? (() => {
        const urlObj = new URL(url);
        return cookieString
          .split(';')
          .map(pair => {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) return null;
            const name = pair.slice(0, eqIdx).trim();
            const value = pair.slice(eqIdx + 1).trim();
            return { name, value, domain: urlObj.hostname, path: '/' };
          })
          .filter(c => c && c.name && c.value);
      })()
    : [];

  if (cookies.length > 0) {
    console.log(`Cookie設定: ${cookies.map(c => c.name).join(', ')}`);
  }

  console.log(`ページ: ${url}`);

  const browser = await chromium.launch({ headless: true });

  if (allVariants) {
    // 出力パスから拡張子を除いたベース名を作成
    const ext = path.extname(outputPath);
    const base = outputPath.slice(0, -ext.length);

    const variants = [
      { suffix: '',                   width: desktopWidth, height: desktopHeight, hideChrome: false, label: 'デスクトップ' },
      { suffix: '_no_chrome',         width: desktopWidth, height: desktopHeight, hideChrome: true,  label: 'デスクトップ（ヘッダー/フッターなし）' },
      { suffix: '_mobile',            width: 375,          height: 812,           hideChrome: false, label: 'モバイル (375px)' },
      { suffix: '_mobile_no_chrome',  width: 375,          height: 812,           hideChrome: true,  label: 'モバイル (375px)（ヘッダー/フッターなし）' },
    ];

    for (const v of variants) {
      console.log(`撮影中: ${v.label}`);
      await takeScreenshot({
        browser,
        url,
        outputPath: `${base}${v.suffix}${ext}`,
        width: v.width,
        height: v.height,
        timeout,
        cookies,
        hideChrome: v.hideChrome,
      });
    }
  } else {
    // 単体撮影
    console.log('撮影中...');
    await takeScreenshot({
      browser,
      url,
      outputPath,
      width: desktopWidth,
      height: desktopHeight,
      timeout,
      cookies,
      hideChrome,
    });
  }

  await browser.close();
  console.log('すべて完了');
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
