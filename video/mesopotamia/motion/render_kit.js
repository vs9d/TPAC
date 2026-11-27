const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/kit.html'); await p.evaluate(() => window.ready);
  const [t, ban, pro] = await p.evaluate(() => window.kit());
  fs.mkdirSync('kit', { recursive: true });
  [['kit/thumb_full.png', t], ['kit/banner.png', ban], ['kit/profile.png', pro]].forEach(([f, d]) => fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')));
  if (errs.length) console.log(errs); await b.close();
})();
