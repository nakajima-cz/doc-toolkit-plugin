const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' });
  const page = await ctx.newPage();

  // 全リクエストをログ
  page.on('request', req => {
    if (!req.url().includes('/_next/') && !req.url().includes('.js') && !req.url().includes('.css')) {
      console.log('REQ:', req.method(), req.url());
    }
  });
  page.on('response', async res => {
    if (!res.url().includes('/_next/') && !res.url().includes('.js') && !res.url().includes('.css')) {
      console.log('RES:', res.status(), res.url());
    }
  });

  try {
    await page.goto('http://ticket.greenexpo.local/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch(e) {}
    await page.waitForTimeout(1000);
    
    const emailInput = await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await emailInput.fill('testuser@expo.local');
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput.fill('Asdf1234!');
    
    console.log('\n=== Clicking login ===');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('URL after login:', page.url());
    
  } finally {
    await b.close();
  }
})().catch(e => console.error('ERROR:', e.message));
