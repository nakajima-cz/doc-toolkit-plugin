#!/usr/bin/env node
/**
 * アノテーション付きスクリーンショットツール
 *
 * events JSON の annotationSelector を使い、各イベントの UI 要素の座標を取得して
 * 以下3つのファイルを生成する:
 *   1. index_no_chrome.png          — クリーン画像（Excel に埋め込む）
 *   2. index_annotated_no_chrome.png — バッジ入り画像（レビュー用プレビュー）
 *   3. index_badge_positions.json   — バッジ座標 JSON（Excel 図形生成に使用）
 *
 * Usage:
 *   node annotate-screenshot.js <events-json-path> [cookie-string]
 *
 * Arguments:
 *   events-json-path  イベント定義JSONファイルのパス
 *   cookie-string     セッションCookie文字列 (例: "session=abc123")
 *
 * Options (環境変数で上書き可能):
 *   BASE_URL              ベースURL (デフォルト: http://ticket.greenexpo.local)
 *   SCREENSHOT_TIMEOUT    タイムアウト ms (デフォルト: 60000)
 *
 * events JSON の追加フィールド:
 *   meta.annotationOutputDir  出力先（省略時は meta.outputDir の親ディレクトリ）
 *   meta.annotationSetup      アノテーション前に実行するステップ配列（ページ状態を整える）
 *   event.annotationSelector  バッジを付ける要素の CSS セレクター
 *   event.annotationMultiple  true にすると同セレクターの全要素にバッジを付ける（デフォルト: false）
 *
 * バッジ衝突回避:
 *   同一または隣接する座標のバッジは x 方向にずらして重なりを防ぐ
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HIDE_CHROME_CSS = `
  header,
  footer,
  [class*="main_bottom"] {
    display: none !important;
  }
`;

const BADGE_CSS = `
  .event-annotation-badge {
    position: absolute;
    background: #E74C3C;
    color: #fff;
    border-radius: 50%;
    width: 26px;
    height: 26px;
    display: flex !important;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    z-index: 999999;
    pointer-events: none;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    border: 2px solid #fff;
    line-height: 1;
    box-sizing: border-box;
  }
`;

const BADGE_SIZE = 26;  // px
const BADGE_MARGIN = 6; // 最小間隔 px

/** setup ステップの実行 */
async function runSetupStep(page, step, timeout) {
  switch (step.action) {
    case 'click':
      await page.locator(step.selector).first().click();
      await page.waitForTimeout(step.wait ?? 400);
      break;
    case 'clickText':
      await page.locator(`text=${step.text}`).first().click();
      await page.waitForTimeout(step.wait ?? 400);
      break;
    case 'fill': {
      const input = page.locator(step.selector).first();
      await input.fill(String(step.value));
      await input.dispatchEvent('input');
      await page.waitForTimeout(step.wait ?? 200);
      break;
    }
    case 'evaluate':
      await page.evaluate(step.script);
      await page.waitForTimeout(step.wait ?? 200);
      break;
    case 'waitTimeout':
      await page.waitForTimeout(step.ms);
      break;
    case 'waitForSelector':
      await page.waitForSelector(step.selector, { state: 'visible', timeout: step.timeout ?? 10000 });
      break;
    case 'waitNetworkIdle':
      await page.waitForLoadState('networkidle', { timeout: step.timeout ?? timeout });
      break;
    case 'goto':
      await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: step.timeout ?? timeout });
      await page.waitForLoadState('networkidle', { timeout: step.timeout ?? timeout });
      await page.waitForTimeout(step.wait ?? 500);
      break;
    case 'waitForURL':
      await page.waitForURL(step.url, { timeout: step.timeout ?? timeout });
      await page.waitForLoadState('networkidle', { timeout: step.timeout ?? timeout });
      break;
    case 'addStyle':
      await page.addStyleTag({ content: step.css });
      await page.waitForTimeout(200);
      break;
    default:
      console.warn(`  ⚠ 未知のセットアップアクション: ${step.action}`);
  }
}

/** 要素のドキュメント座標（スクロール込み）を取得する */
async function getDocumentRect(el) {
  return el.evaluate(node => {
    const r = node.getBoundingClientRect();
    return {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      width: r.width,
      height: r.height,
    };
  });
}

/**
 * バッジ座標の衝突を解決する（グリーディ・x軸方向オフセット）
 *
 * @param {Array} rawBadges - {id, x, y, name} のリスト
 * @returns {Array} 衝突解決後のリスト
 */
function resolveCollisions(rawBadges) {
  const stride = BADGE_SIZE + BADGE_MARGIN;
  const placed = [];

  for (const badge of rawBadges) {
    let { id, x, y, name, rect } = badge;

    // 最大 8 ステップ x 方向にずらして衝突回避
    for (let attempt = 0; attempt < 8; attempt++) {
      const overlap = placed.some(
        p => Math.abs(p.x - x) < stride && Math.abs(p.y - y) < stride
      );
      if (!overlap) break;
      x += stride;
    }

    placed.push({ id, x, y, name, rect });
  }

  return placed;
}

/**
 * ページ設定・要素座標取得・クリーン/アノテーション撮影
 */
async function run(browser, url, outputDir, config, cookies, timeout) {
  const viewportWidth = config.viewport?.width ?? 1440;
  const viewportHeight = config.viewport?.height ?? 900;

  const makeCtx = async () => {
    const authStatePath = process.env.__AUTH_STATE_PATH__;
    const ctx = authStatePath
      ? await browser.newContext({
          storageState: authStatePath,
          viewport: { width: viewportWidth, height: viewportHeight },
          locale: 'ja-JP',
        })
      : await browser.newContext({
          viewport: { width: viewportWidth, height: viewportHeight },
          locale: 'ja-JP',
        });
    if (!authStatePath && cookies.length > 0) await ctx.addCookies(cookies);
    return ctx;
  };

  // ============================================================
  // Pass 1: クリーン画像を撮影 + バッジ座標を収集
  // ============================================================
  const ctx1 = await makeCtx();
  const page1 = await ctx1.newPage();

  await page1.goto(url, { waitUntil: 'domcontentloaded', timeout });
  // networkidle はポーリングAPIで永遠に解決しない場合があるため try-catch でラップ
  try {
    await page1.waitForLoadState('networkidle', { timeout: Math.min(timeout, 60000) });
  } catch (_) {
    // タイムアウトしても続行（ページが表示されていれば撮影可能）
    await page1.waitForTimeout(2000);
  }
  await page1.waitForTimeout(500);

  // セットアップ
  for (const step of config.meta.annotationSetup ?? []) {
    console.log(`  setup: ${step.action}${step.description ? ` [${step.description}]` : ''}`);
    try { await runSetupStep(page1, step, timeout); }
    catch (e) { console.warn(`  ⚠ setup失敗 (${step.action}): ${e.message}`); }
  }

  // ヘッダー非表示
  await page1.addStyleTag({ content: HIDE_CHROME_CSS });
  await page1.waitForTimeout(200);

  // クリーン画像を撮影
  const cleanPath = path.join(outputDir, 'index_no_chrome.png');
  fs.mkdirSync(outputDir, { recursive: true });
  await page1.evaluate(() => window.scrollTo(0, 0));
  await page1.waitForTimeout(200);
  await page1.screenshot({ path: cleanPath, fullPage: true });
  console.log(`  💾 ${cleanPath} (クリーン)`);

  // バッジ座標を取得（衝突前の生データ）
  const events = config.events ?? [];
  const rawBadges = [];

  for (const event of events) {
    if (!event.annotationSelector) continue;  // skip はスクリーンショットステップのみ対象（アノテーションは実行する）

    let elements;
    try {
      elements = event.annotationMultiple
        ? await page1.$$(event.annotationSelector)
        : (await page1.$(event.annotationSelector) ? [await page1.$(event.annotationSelector)] : []);
    } catch (e) {
      console.warn(`  ⚠ セレクター取得失敗 #${event.id}: ${e.message}`);
      continue;
    }

    for (const el of elements.filter(Boolean)) {
      const rect = await getDocumentRect(el).catch(() => null);
      if (!rect || rect.width === 0) continue;

      // 赤点線枠用の rect
      // 優先順位: annotationRectFixed > annotationRectSelector > 要素全体
      let boxRect = rect;
      if (event.annotationRectFixed) {
        // 固定サイズ: 要素の右端・垂直中央に配置（CSS 疑似要素など DOM 取得不可の場合に使用）
        const fw = event.annotationRectFixed.width ?? 40;
        const fh = event.annotationRectFixed.height ?? 40;
        boxRect = {
          left: rect.left + rect.width - fw,
          top: rect.top + (rect.height - fh) / 2,
          width: fw,
          height: fh,
        };
      } else if (event.annotationRectSelector) {
        try {
          const rectEl = await el.$(event.annotationRectSelector);
          if (rectEl) {
            const r = await getDocumentRect(rectEl).catch(() => null);
            if (r && r.width > 0) boxRect = r;
          }
        } catch (_) {}
      }

      // バッジを要素の右上コーナーに配置（中心が角に来るよう -13px）
      rawBadges.push({
        id: event.id,
        name: event.name,
        x: Math.round(rect.left + rect.width - 13),
        y: Math.round(rect.top - 13),
        rect: {
          left: Math.round(boxRect.left),
          top: Math.round(boxRect.top),
          width: Math.round(boxRect.width),
          height: Math.round(boxRect.height),
        },
      });
    }
  }

  await ctx1.close();

  // 衝突解決
  const resolvedBadges = resolveCollisions(rawBadges);

  // PNG 画像のサイズを取得（ポジションJSON用）
  // ページの自然な全幅はviewportWidth
  const { origW, origH } = await (async () => {
    const ctx = await makeCtx();
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await p.waitForLoadState('networkidle', { timeout });
    await p.addStyleTag({ content: HIDE_CHROME_CSS });
    await p.waitForTimeout(200);
    const scrollSize = await p.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
    }));
    await ctx.close();
    return { origW: scrollSize.w, origH: scrollSize.h };
  })();

  // badge_positions.json を保存
  const positionsData = {
    screenshot: {
      path: cleanPath,
      orig_width: origW,
      orig_height: origH,
    },
    badges: resolvedBadges,
  };
  const positionsPath = path.join(outputDir, 'index_badge_positions.json');
  fs.writeFileSync(positionsPath, JSON.stringify(positionsData, null, 2));
  console.log(`  📄 ${positionsPath} (バッジ座標 ${resolvedBadges.length}件)`);

  // 衝突解決後の座標をログ出力
  for (const b of resolvedBadges) {
    const wasAdjusted = rawBadges.find(r => r.id === b.id && r.x !== b.x);
    const adj = wasAdjusted ? ` (→ x調整)` : '';
    console.log(`  ✓ バッジ #${b.id} (x:${b.x}, y:${b.y})${adj}`);
  }

  // ============================================================
  // Pass 2: アノテーション画像（プレビュー用）を撮影
  // ============================================================
  if (process.env.SKIP_ANNOTATED === 'true') {
    console.log('  ⏭ アノテーション画像生成をスキップ (SKIP_ANNOTATED=true)');
    return;
  }
  const ctx2 = await makeCtx();
  const page2 = await ctx2.newPage();

  await page2.goto(url, { waitUntil: 'domcontentloaded', timeout });
  await page2.waitForLoadState('networkidle', { timeout });
  await page2.waitForTimeout(500);

  for (const step of config.meta.annotationSetup ?? []) {
    try { await runSetupStep(page2, step, timeout); }
    catch (_) {}
  }

  await page2.addStyleTag({ content: HIDE_CHROME_CSS });
  await page2.addStyleTag({ content: BADGE_CSS });
  await page2.waitForTimeout(200);

  // バッジコンテナを追加
  await page2.evaluate(() => {
    const c = document.createElement('div');
    c.id = '__annotation_container__';
    c.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:999998;pointer-events:none;';
    document.body.appendChild(c);
  });

  // 衝突解決後の座標でバッジを注入
  for (const badge of resolvedBadges) {
    await page2.evaluate(({ id, x, y }) => {
      const container = document.getElementById('__annotation_container__');
      const el = document.createElement('div');
      el.className = 'event-annotation-badge';
      el.textContent = String(id);
      el.style.position = 'absolute';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      container.appendChild(el);
    }, { id: badge.id, x: badge.x, y: badge.y });
  }

  await page2.evaluate(() => window.scrollTo(0, 0));
  await page2.waitForTimeout(200);

  const annotatedPath = path.join(outputDir, 'index_annotated_no_chrome.png');
  await page2.screenshot({ path: annotatedPath, fullPage: true });
  console.log(`  💾 ${annotatedPath} (アノテーション・プレビュー)`);

  await ctx2.close();
}

/**
 * モーダルのクリーン画像・バッジ座標・アノテーション画像を生成する
 * meta.modals 配列の各エントリを処理する
 */
async function runModals(browser, url, outputDir, config, cookies, timeout) {
  const modals = config.meta?.modals ?? [];
  if (modals.length === 0) return;

  const viewportWidth = config.viewport?.width ?? 1440;
  const viewportHeight = config.viewport?.height ?? 900;

  const makeCtx = async () => {
    const authStatePath = process.env.__AUTH_STATE_PATH__;
    const ctx = authStatePath
      ? await browser.newContext({
          storageState: authStatePath,
          viewport: { width: viewportWidth, height: viewportHeight },
          locale: 'ja-JP',
        })
      : await browser.newContext({
          viewport: { width: viewportWidth, height: viewportHeight },
          locale: 'ja-JP',
        });
    if (!authStatePath && cookies.length > 0) await ctx.addCookies(cookies);
    return ctx;
  };

  for (const modal of modals) {
    console.log(`\nモーダル処理: ${modal.name} (id: ${modal.id})`);

    // ============================================================
    // Pass 1: クリーン画像 + バッジ座標
    // ============================================================
    const ctx1 = await makeCtx();
    const page1 = await ctx1.newPage();

    await page1.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page1.waitForLoadState('networkidle', { timeout });
    await page1.waitForTimeout(500);

    // グローバル annotationSetup を実行
    for (const step of config.meta.annotationSetup ?? []) {
      try { await runSetupStep(page1, step, timeout); }
      catch (e) { console.warn(`  ⚠ global setup失敗: ${e.message}`); }
    }

    // モーダル固有の setup を実行
    for (const step of modal.setup ?? []) {
      console.log(`  setup: ${step.action}${step.description ? ` [${step.description}]` : ''}`);
      try { await runSetupStep(page1, step, timeout); }
      catch (e) { console.warn(`  ⚠ modal setup失敗 (${step.action}): ${e.message}`); }
    }

    // モーダルはスクロール位置に関係なく viewport 中央に表示されるため、
    // バッジ座標を viewport 基準に合わせるためにトップへスクロール
    await page1.evaluate(() => window.scrollTo(0, 0));
    await page1.waitForTimeout(200);

    // ヘッダー非表示
    await page1.addStyleTag({ content: HIDE_CHROME_CSS });
    await page1.waitForTimeout(200);

    // クリーン画像を撮影（viewport のみ、モーダルが画面中央に表示される状態）
    const cleanPath = path.join(outputDir, `modal_${modal.id}_no_chrome.png`);
    await page1.screenshot({ path: cleanPath, fullPage: false });
    console.log(`  💾 ${cleanPath} (モーダル・クリーン)`);

    // バッジ座標を取得
    const rawBadges = [];
    for (const event of modal.events ?? []) {
      if (!event.annotationSelector) continue;

      let elements;
      try {
        elements = event.annotationMultiple
          ? await page1.$$(event.annotationSelector)
          : (await page1.$(event.annotationSelector) ? [await page1.$(event.annotationSelector)] : []);
      } catch (e) {
        console.warn(`  ⚠ セレクター取得失敗 #${event.id}: ${e.message}`);
        continue;
      }

      for (const el of elements.filter(Boolean)) {
        const rect = await getDocumentRect(el).catch(() => null);
        if (!rect || rect.width === 0) continue;

        let boxRect = rect;
        if (event.annotationRectFixed) {
          const fw = event.annotationRectFixed.width ?? 40;
          const fh = event.annotationRectFixed.height ?? 40;
          boxRect = {
            left: rect.left + rect.width - fw,
            top: rect.top + (rect.height - fh) / 2,
            width: fw,
            height: fh,
          };
        } else if (event.annotationRectSelector) {
          try {
            const rectEl = await el.$(event.annotationRectSelector);
            if (rectEl) {
              const r = await getDocumentRect(rectEl).catch(() => null);
              if (r && r.width > 0) boxRect = r;
            }
          } catch (_) {}
        }

        rawBadges.push({
          id: event.id,
          name: event.name,
          x: Math.round(rect.left + rect.width - 13),
          y: Math.round(rect.top - 13),
          rect: {
            left: Math.round(boxRect.left),
            top: Math.round(boxRect.top),
            width: Math.round(boxRect.width),
            height: Math.round(boxRect.height),
          },
        });
      }
    }

    await ctx1.close();

    const resolvedBadges = resolveCollisions(rawBadges);

    // badge_positions.json を保存
    const positionsData = {
      screenshot: {
        path: cleanPath,
        orig_width: viewportWidth,
        orig_height: viewportHeight,
      },
      badges: resolvedBadges,
    };
    const positionsPath = path.join(outputDir, `modal_${modal.id}_badge_positions.json`);
    fs.writeFileSync(positionsPath, JSON.stringify(positionsData, null, 2));
    console.log(`  📄 ${positionsPath} (バッジ座標 ${resolvedBadges.length}件)`);
    for (const b of resolvedBadges) {
      console.log(`  ✓ バッジ #${b.id} (x:${b.x}, y:${b.y})`);
    }

    // ============================================================
    // Pass 2: アノテーション画像（プレビュー用）
    // ============================================================
    if (process.env.SKIP_ANNOTATED === 'true') {
      console.log(`  ⏭ モーダル ${modal.id} のアノテーション画像生成をスキップ (SKIP_ANNOTATED=true)`);
      continue;
    }
    const ctx2 = await makeCtx();
    const page2 = await ctx2.newPage();

    await page2.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page2.waitForLoadState('networkidle', { timeout });
    await page2.waitForTimeout(500);

    for (const step of config.meta.annotationSetup ?? []) {
      try { await runSetupStep(page2, step, timeout); }
      catch (_) {}
    }
    for (const step of modal.setup ?? []) {
      try { await runSetupStep(page2, step, timeout); }
      catch (_) {}
    }

    // モーダルはスクロール位置に関係なく viewport 中央に表示されるため、
    // バッジ座標を viewport 基準に合わせるためにトップへスクロール
    await page2.evaluate(() => window.scrollTo(0, 0));
    await page2.waitForTimeout(200);

    await page2.addStyleTag({ content: HIDE_CHROME_CSS });
    await page2.addStyleTag({ content: BADGE_CSS });
    await page2.waitForTimeout(200);

    await page2.evaluate(() => {
      const c = document.createElement('div');
      c.id = '__annotation_container__';
      c.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:999998;pointer-events:none;';
      document.body.appendChild(c);
    });

    for (const badge of resolvedBadges) {
      await page2.evaluate(({ id, x, y }) => {
        const container = document.getElementById('__annotation_container__');
        const el = document.createElement('div');
        el.className = 'event-annotation-badge';
        el.textContent = String(id);
        el.style.position = 'absolute';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        container.appendChild(el);
      }, { id: badge.id, x: badge.x, y: badge.y });
    }

    const annotatedPath = path.join(outputDir, `modal_${modal.id}_annotated_no_chrome.png`);
    await page2.screenshot({ path: annotatedPath, fullPage: false });
    console.log(`  💾 ${annotatedPath} (モーダル・アノテーション・プレビュー)`);

    await ctx2.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node annotate-screenshot.js <events-json-path> [cookie-string]');
    process.exit(1);
  }

  const eventsJsonPath = args[0];
  const cookieString = args[1] ?? '';
  const baseUrl = (process.env.BASE_URL ?? 'http://ticket.greenexpo.local').replace(/\/$/, '');
  const timeout = parseInt(process.env.SCREENSHOT_TIMEOUT ?? '60000', 10);
  const skipAnnotated = process.env.SKIP_ANNOTATED === 'true';

  // auth-state.json が存在する場合は storageState を優先使用
  const authStatePath = path.join(__dirname, '..', 'auth-state.json');
  const useStorageState = fs.existsSync(authStatePath);

  if (!fs.existsSync(eventsJsonPath)) {
    console.error(`ファイルが見つかりません: ${eventsJsonPath}`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(eventsJsonPath, 'utf-8'));

  const outputDir = config.meta.annotationOutputDir ?? path.dirname(config.meta.outputDir);
  const pageUrl = `${baseUrl}${config.meta.page}`;

  // Cookie 文字列のパース（storageState がない場合のフォールバック）
  const cookies = (!useStorageState && cookieString)
    ? (() => {
        const urlObj = new URL(pageUrl);
        return cookieString.split(';')
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

  if (useStorageState) {
    console.log(`認証      : auth-state.json を使用`);
  } else if (cookies.length > 0) {
    console.log(`認証      : Cookie を使用 (${cookies.map(c => c.name).join(', ')})`);
  }
  console.log(`ページ    : ${pageUrl}`);
  console.log(`出力先    : ${outputDir}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  try {
    // storageState がある場合は makeCtx をオーバーライド
    if (useStorageState) {
      const origMakeCtx = global.__makeCtx__;
      // run/runModals の makeCtx を storageState 版に差し替え
      // ※ run() / runModals() 内部の makeCtx() を上書きするため、
      //   環境変数でパスを渡して各関数内で参照させる
      process.env.__AUTH_STATE_PATH__ = authStatePath;
    }
    await run(browser, pageUrl, outputDir, config, cookies, timeout);
    await runModals(browser, pageUrl, outputDir, config, cookies, timeout);
  } finally {
    await browser.close();
  }

  console.log('\nすべて完了');
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
