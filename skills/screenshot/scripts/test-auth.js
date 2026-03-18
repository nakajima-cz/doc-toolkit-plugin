const { chromium } = require('playwright');
const path = require('path');
const STATE = path.resolve('/Users/nakajima/git/creadorz/greenexpo/pia-green-expo-docs/.claude/skills/screenshot/auth-state.json');

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ 
    storageState: STATE,
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP'
  });
  const p = await ctx.newPage();
  
  try {
    // ログとAPIレスポンスを監視
    p.on('response', async (res) => {
      if (res.url().includes('/api/') && res.status() !== 200) {
        console.log(`API ${res.status()}: ${res.url()}`);
      }
    });
    
    console.log('Navigating to mypage...');
    await p.goto('http://ticket.greenexpo.local/mypage', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    try {
      await p.waitForLoadState('networkidle', { timeout: 30000 });
    } catch(e) { console.log('networkidle timeout'); }
    
    await p.waitForTimeout(2000);
    console.log('URL:', p.url());
    console.log('Title:', await p.title());
    const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent || 'no h1');
    console.log('H1:', h1);
    
    // Cookieを確認
    const cookies = await ctx.cookies('http://ticket.greenexpo.local');
    console.log('Cookies for ticket.greenexpo.local:', cookies.map(c => c.name + '=' + c.value.substring(0,10)));
    
    const apiCookies = await ctx.cookies('http://api.ticket.greenexpo.local');
    console.log('Cookies for api.ticket.greenexpo.local:', apiCookies.map(c => c.name + '=' + c.value.substring(0,10)));
    
  } finally {
    await b.close();
  }
})().catch(e => console.error('ERROR:', e.message));
