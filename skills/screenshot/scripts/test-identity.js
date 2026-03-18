const { chromium } = require('playwright');
const STATE = '.claude/skills/screenshot/auth-state.json';

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ storageState: STATE, viewport: {width: 1440, height: 900}, locale: 'ja-JP' });
  const p = await ctx.newPage();

  try {
    // Listen for console errors
    p.on('console', msg => {
      if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
    });

    const url = 'http://ticket.greenexpo.local/mypage';
    console.log('Navigating to:', url);
    await p.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await p.waitForTimeout(2000);
    console.log('Current URL:', p.url());
    console.log('Title:', await p.title());

    const buttons = await p.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => ({text: b.textContent.trim(), type: b.type}))
    );
    console.log('Buttons:', JSON.stringify(buttons));

    const headings = await p.evaluate(() =>
      Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.trim())
    );
    console.log('Headings:', JSON.stringify(headings));

    // Get HTML content
    const html = await p.content();
    console.log('HTML length:', html.length);
    // Find main/body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]{0,2000})/);
    if (bodyMatch) console.log('Body start:', bodyMatch[1].substring(0, 1000));

    // Check for any div with content
    const divsWithContent = await p.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('#__next > *'));
      return divs.map(d => ({tag: d.tagName, class: d.className, children: d.children.length, text: d.textContent?.substring(0, 100)}));
    });
    console.log('Next root children:', JSON.stringify(divsWithContent, null, 2));

    // Take a quick screenshot to see what's on the page
    await p.screenshot({ path: '/tmp/identity-test.png', fullPage: false });
  } finally {
    await b.close();
  }
})().catch(e => console.error('ERROR:', e.message));
