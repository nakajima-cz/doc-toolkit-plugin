#!/usr/bin/env node
/**
 * イベントシナリオスクリーンショットツール
 *
 * Markdownの仕様書に記載されたイベントを JSON 定義に基づいて順番に実行し、
 * 各ステップのスクリーンショットを保存する汎用スクリプト。
 *
 * Usage:
 *   node events-screenshot.js <events-json-path> [cookie-string]
 *
 * Arguments:
 *   events-json-path  イベント定義JSONファイルのパス
 *   cookie-string     セッションCookie文字列 (例: "session=abc123")
 *
 * Options (環境変数で上書き可能):
 *   BASE_URL              ベースURL (デフォルト: http://ticket.greenexpo.local)
 *   SCREENSHOT_TIMEOUT    networkidle 待機タイムアウト ms (デフォルト: 60000)
 *   EVENT_IDS             実行するイベントIDをカンマ区切りで指定 (例: "2,3,5")
 *
 * JSON フォーマット:
 *   {
 *     "meta": {
 *       "page": "/buy",
 *       "outputDir": "frontend/specs/buy",
 *       "description": "画面の説明"
 *     },
 *     "viewport": { "width": 1440, "height": 900 },
 *     "events": [
 *       {
 *         "id": 2,
 *         "name": "イベント名",
 *         "skip": false,
 *         "steps": [
 *           { "action": "click", "selector": "css-selector", "description": "説明" },
 *           { "action": "screenshot", "filename": "event_02_foo" }
 *         ]
 *       }
 *     ]
 *   }
 *
 * 利用可能なアクション:
 *   click          { selector }              CSS セレクターをクリック（最初の要素）
 *   clickText      { text }                  テキストを含む要素をクリック
 *   fill           { selector, value }       input に値を入力（input イベント発火）
 *   evaluate       { script }                ページ内で JS を実行
 *   waitTimeout    { ms }                    指定ミリ秒待機
 *   waitForSelector { selector, timeout? }   要素が表示されるまで待機
 *   waitNetworkIdle { timeout? }             ネットワーク静止まで待機
 *   addStyle       { css }                   スタイルを追加（要素非表示等）
 *   screenshot     { filename, description? } スクリーンショットを保存
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ヘッダー/フッターを非表示にするCSS（オプション用）
const HIDE_CHROME_CSS = `
  header,
  footer,
  [class*="main_bottom"] {
    display: none !important;
  }
`;

/**
 * 各アクションの実行関数
 * すべての関数は (page, step, context) を受け取る
 */
const stepExecutors = {
  /**
   * CSS セレクターで要素をクリック（最初にマッチした要素）
   * step: { selector, wait? }
   */
  click: async (page, step) => {
    await page.locator(step.selector).first().click();
    await page.waitForTimeout(step.wait ?? 300);
  },

  /**
   * テキストを含む要素をクリック
   * step: { text, wait? }
   */
  clickText: async (page, step) => {
    await page.locator(`text=${step.text}`).first().click();
    await page.waitForTimeout(step.wait ?? 300);
  },

  /**
   * input に値を入力（input イベントを発火させる）
   * step: { selector, value, wait? }
   */
  fill: async (page, step) => {
    const input = page.locator(step.selector).first();
    await input.fill(String(step.value));
    await input.dispatchEvent('input');
    await page.waitForTimeout(step.wait ?? 200);
  },

  /**
   * ページ内で任意の JS を実行
   * step: { script, wait? }
   */
  evaluate: async (page, step) => {
    await page.evaluate(step.script);
    await page.waitForTimeout(step.wait ?? 200);
  },

  /**
   * 指定ミリ秒待機
   * step: { ms }
   */
  waitTimeout: async (page, step) => {
    await page.waitForTimeout(step.ms);
  },

  /**
   * 要素が表示されるまで待機
   * step: { selector, timeout? }
   */
  waitForSelector: async (page, step, context) => {
    await page.waitForSelector(step.selector, {
      state: 'visible',
      timeout: step.timeout ?? 10000
    });
  },

  /**
   * ネットワーク通信が静止するまで待機
   * step: { timeout? }
   */
  waitNetworkIdle: async (page, step, context) => {
    await page.waitForLoadState('networkidle', {
      timeout: step.timeout ?? context.timeout
    });
  },

  /**
   * スタイルを追加（ヘッダー/フッター非表示など）
   * step: { css }
   */
  addStyle: async (page, step) => {
    await page.addStyleTag({ content: step.css });
    await page.waitForTimeout(200);
  },

  /**
   * スクリーンショットを保存
   * step: { filename, description? }
   * → {outputDir}/{filename}.png に保存
   */
  screenshot: async (page, step, context) => {
    const outputPath = path.join(context.outputDir, `${step.filename}.png`);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`    💾 ${outputPath}`);
  }
};

/**
 * 1イベントを実行する
 */
async function runEvent(browser, event, config, baseUrl, cookies, timeout) {
  const viewportWidth = config.viewport?.width ?? 1440;
  const viewportHeight = config.viewport?.height ?? 900;

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    locale: 'ja-JP'
  });

  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();

  const stepContext = {
    baseUrl,
    outputDir: config.meta.outputDir,
    timeout
  };

  // ページへ遷移（毎イベント新規ロード）
  const pageUrl = `${baseUrl}${config.meta.page}`;
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(300);

  // 各ステップを実行
  for (const step of event.steps) {
    const executor = stepExecutors[step.action];

    if (!executor) {
      console.warn(`    ⚠ 未知のアクション: "${step.action}" — スキップします`);
      continue;
    }

    const desc = step.description ? ` [${step.description}]` : '';
    console.log(`    → ${step.action}${desc}`);

    try {
      await executor(page, step, stepContext);
    } catch (err) {
      console.error(`    ✗ ステップ失敗 (${step.action}): ${err.message}`);
      // 失敗しても次のステップへ続行
    }
  }

  await context.close();
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node events-screenshot.js <events-json-path> [cookie-string]');
    console.error('');
    console.error('Example:');
    console.error('  node events-screenshot.js .claude/skills/screenshot/events/buy.json');
    console.error('  node events-screenshot.js .claude/skills/screenshot/events/buy.json "session=abc123"');
    console.error('');
    console.error('Options:');
    console.error('  BASE_URL=http://localhost:3000  ベースURL上書き');
    console.error('  EVENT_IDS=2,3,5                実行するイベントIDを絞り込み');
    process.exit(1);
  }

  const eventsJsonPath = args[0];
  const cookieString = args[1] ?? '';

  const baseUrl = (process.env.BASE_URL ?? 'http://ticket.greenexpo.local').replace(/\/$/, '');
  const timeout = parseInt(process.env.SCREENSHOT_TIMEOUT ?? '60000', 10);
  const filterIds = process.env.EVENT_IDS
    ? process.env.EVENT_IDS.split(',').map(id => parseInt(id.trim(), 10))
    : null;

  // JSON 読み込み
  if (!fs.existsSync(eventsJsonPath)) {
    console.error(`ファイルが見つかりません: ${eventsJsonPath}`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(eventsJsonPath, 'utf-8'));

  // Cookie パース
  const cookies = cookieString
    ? (() => {
        const urlObj = new URL(`${baseUrl}${config.meta.page}`);
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
    console.log(`Cookie: ${cookies.map(c => c.name).join(', ')}`);
  }

  console.log(`ページ    : ${baseUrl}${config.meta.page}`);
  console.log(`出力先    : ${config.meta.outputDir}`);
  console.log(`イベント数: ${config.events.length}`);
  if (filterIds) console.log(`絞り込み  : イベントID ${filterIds.join(', ')}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });

  let successCount = 0;
  let skipCount = 0;

  for (const event of config.events) {
    // ID フィルター
    if (filterIds && !filterIds.includes(event.id)) {
      continue;
    }
    // skip フラグ
    if (event.skip) {
      console.log(`[イベント #${event.id}] ${event.name} → スキップ`);
      skipCount++;
      continue;
    }

    console.log(`[イベント #${event.id}] ${event.name}`);
    await runEvent(browser, event, config, baseUrl, cookies, timeout);
    successCount++;
  }

  await browser.close();
  console.log(`\n完了: ${successCount}件実行, ${skipCount}件スキップ`);
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
