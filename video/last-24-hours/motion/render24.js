const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
(async () => {
  const mode = process.argv[2], FPS = 24;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/v24.html'); await p.evaluate(() => window.readyV24);
  if (mode === 'stills') {
    const dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
    for (const t of process.argv[3].split(',').map(Number)) { const d = await p.evaluate(t => { renderV24(t, 0); return document.getElementById('m').toDataURL('image/jpeg', .82); }, t); fs.writeFileSync(`${dir}/t${String(t).padStart(7, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64')); }
  } else {
    const [a, z, out] = [Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = Math.round(a * FPS); f < Math.round(z * FPS); f++) { const d = await p.evaluate(([t, f]) => { renderV24(t, f); return document.getElementById('m').toDataURL('image/jpeg', .92); }, [f / FPS, f]); if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  if (errs.length) console.log('ERRORS:', [...new Set(errs)].slice(0, 12).join('\n')); await b.close();
})();
