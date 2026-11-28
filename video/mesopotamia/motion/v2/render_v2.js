const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
(async () => {
  const mode = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8765/v2.html');
  await page.evaluate(() => window.readyV2);
  if (mode === 'stills') {
    const times = process.argv[3].split(',').map(Number);
    const dir = process.argv[4] || 'stills'; fs.mkdirSync(dir, { recursive: true });
    for (const t of times) {
      const d = await page.evaluate(t => { renderV2(t); return document.getElementById('v2').toDataURL('image/jpeg', .85); }, t);
      fs.writeFileSync(`${dir}/t${String(t).padStart(6, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
    }
  } else {
    const [a, b, out] = [Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
    const fps = 30;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = Math.round(a * fps); f < Math.round(b * fps); f++) {
      const d = await page.evaluate(([t, f]) => { renderV2(t); return document.getElementById('v2').toDataURL('image/jpeg', .93); }, [f / fps, f]);
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  if (errs.length) console.log('ERRORS:', [...new Set(errs)].slice(0, 10).join('\n'));
  await browser.close();
})();
