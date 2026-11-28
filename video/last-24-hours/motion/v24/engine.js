// "Last 24 hours" — cinematic silhouette motion engine (uses utils from ../scene.js)
const MC = document.getElementById('m'), MG = MC.getContext('2d');
const DK = '#06070a', BAR = 138;   // 2.39:1 letterbox
const GLINT = '#ffc46b';
hex = function (h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
function mixh(c1, c2, t) { const a = hex(c1), b = hex(c2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))).toString(16).padStart(2, '0')).join(''); }

// ---------- fx ----------
function bokeh(g, t, col, n = 40, seed = 1, a = .35, rmax = 60, area = [0, 0, W, H]) {
  const r = rng(seed); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = area[0] + ((r() * area[2] + t * (r() - .5) * 20) % area[2] + area[2]) % area[2], y = area[1] + r() * area[3], rad = 8 + r() * rmax;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgba(col, a * (.4 + .6 * Math.abs(Math.sin(t * .5 + i))))); gr.addColorStop(.7, rgba(col, a * .3)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.restore();
}
function motes(g, t, col = '#ffe2b0', n = 70, seed = 3, a = .5, area = [0, 0, W, H]) {
  const r = rng(seed); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const x = area[0] + (r() * area[2] + t * (4 + r() * 12)) % area[2], y = area[1] + (r() * area[3] + Math.sin(t * .6 + i) * 14 + area[3]) % area[3]; g.fillStyle = rgba(col, a * (.3 + .7 * Math.abs(Math.sin(t + i)))); circ(g, x, y, .8 + r() * 2.2); }
  g.restore();
}
function beam(g, x0, y0, x1a, x1b, y1, col, a = .18) {
  g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(x0, y0, (x1a + x1b) / 2, y1); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr;
  g.beginPath(); g.moveTo(x0 - 20, y0); g.lineTo(x0 + 20, y0); g.lineTo(x1b, y1); g.lineTo(x1a, y1); g.closePath(); g.fill(); g.restore();
}
function rain(g, t, n = 220, col = '#bcd4ff', a = .35, ang = .18, seed = 5) {
  const r = rng(seed); g.save(); g.strokeStyle = rgba(col, a); g.lineWidth = 1.4;
  for (let i = 0; i < n; i++) { const x = (r() * W * 1.2 + t * 160) % (W * 1.2) - W * .1, y = (r() * H + t * (900 + r() * 400)) % H, L = 18 + r() * 26; g.beginPath(); g.moveTo(x, y); g.lineTo(x - L * ang, y + L); g.stroke(); }
  g.restore();
}
function grade(g, col, a, mode = 'soft-light') { g.save(); g.globalCompositeOperation = mode; g.fillStyle = rgba(col, a); g.fillRect(0, 0, W, H); g.restore(); }
function fadeBlack(g, a) { if (a > 0) { g.fillStyle = rgba('#000', clamp(a)); g.fillRect(0, 0, W, H); } }
function filmFrame(g, a = 1) { // memory look
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba('#c9a27a', .35 * a); g.fillRect(0, 0, W, H); g.restore();
  g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = rgba('#3a2010', .25 * a); g.fillRect(0, 0, W, H); g.restore();
  const v = g.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, rgba('#1a0d05', .7 * a)); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
function lightLeak(g, t, a = .5, col = '#ff9a4a') { g.save(); g.globalCompositeOperation = 'screen'; const x = W * (.2 + .6 * (Math.sin(t * .4) * .5 + .5)); const gr = g.createRadialGradient(x, H * .2, 0, x, H * .2, W * .7); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }

// ---------- people (silhouettes, facing right) ----------
const PEOPLE = {
  hero: { hair: 'wavy', beard: 1, h: 1, glint: 1, sneakers: '#cfcfcf' },
  old: { hair: 'white', beard: 'white', h: .97, glint: 1, coat: 1, stoop: .08, sneakers: null },
  mother: { scarf: 1, dress: 1, h: .9 },
  father: { hair: 'short', moustache: 1, h: .95 },
  friend: { hair: 'curly', glasses: 1, h: 1.02, sneakers: '#bfbfbf' },
  kid: { hair: 'short', h: .55, big: 1.25 },
  crowd: { hair: 'short', h: 1 },
};
function figure(g, o, col, isRim) {
  const P = PEOPLE[o.kind || 'hero'], pose = o.pose || 'stand', ph = o.walk || 0, sw = (pose === 'walk' || pose === 'run') ? Math.sin(ph) : 0;
  const run = pose === 'run' ? 1.8 : 1, hd = P.big || 1;
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  const L = (pts, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  let hipY = -170, shY = -288, headY = -322, lean = P.stoop || 0;
  if (pose === 'sit') { hipY = -150; shY = -265; headY = -300; }
  if (pose === 'floor') { hipY = -36; shY = -150; headY = -186; }
  // legs
  if (pose === 'sit') { L([0, hipY, 70, hipY - 4, 72, -12], 28); L([-6, hipY, 60, hipY + 2, 58, -12], 26); }
  else if (pose === 'floor') { L([0, hipY, 150, -18], 28); L([0, hipY + 4, 140, -12], 26); }
  else { L([0, hipY, sw * 32 * run, hipY / 2 + Math.abs(sw) * -8, sw * 46 * run, -12], 27); L([0, hipY, -sw * 32 * run, hipY / 2 + Math.abs(sw) * -8, -sw * 46 * run, -12], 27); }
  // torso
  g.save(); g.translate(0, hipY); g.rotate(lean + (pose === 'run' ? .18 : 0) + (pose === 'floor' ? -.05 : 0)); const th = shY - hipY;
  if (P.coat) poly(g, [-30, th + 2, 30, th + 2, 38, 90, -36, 90]);
  else if (P.dress) poly(g, [-26, th + 4, 26, th + 4, 46, -hipY - 8, -46, -hipY - 8]);
  else poly(g, [-32, th + 2, 30, th + 2, 26, 12, -28, 12]);
  // arms
  const arm = o.arm || 'down', ax = 2, ay = th + 12;
  const armPts = {
    down: [ax, ay, 8 - sw * 30 * run, ay + 56, 10 - sw * 44 * run, ay + 112],
    phoneEar: [ax, ay, 26, ay + 48, 22, ay - 6],
    phoneLook: [ax, ay, 28, ay + 60, 52, ay + 36],
    knee: [ax, ay, 30, ay + 60, 66, ay + 70],
    wave: [ax, ay, 34, ay - 40, 44 + Math.sin((o.t || 0) * 10) * 10, ay - 96],
    hug: [ax, ay, 46, ay + 20, 70, ay + 10],
    up: [ax, ay, 20, ay - 60, 26, ay - 120],
    write: [ax, ay, 34, ay + 50, 66 + Math.sin((o.t || 0) * 7) * 6, ay + 52],
    piano: [ax, ay, 36, ay + 54, 74, ay + 48],
    reach: [ax, ay, 50, ay + 30, 92, ay + 26],
  }[arm];
  L(armPts, 20);
  if (P.glint && !isRim) { glow(g, armPts[4] - 4, armPts[5] - 10, 16, GLINT, .9); g.fillStyle = GLINT; circ(g, armPts[4] - 4, armPts[5] - 10, 2.6); g.fillStyle = col; }
  if (o.phone && !isRim) { g.save(); g.translate(armPts[4] + 6, armPts[5] - 8); g.fillStyle = '#0b0b0e'; rr(g, -8, -14, 16, 28, 3); g.restore(); glow(g, armPts[4] + 6, armPts[5] - 8, 70, '#9cc8ff', .35); g.fillStyle = col; }
  g.restore();
  // head
  const hx = Math.sin(lean) * (hipY - headY) * -1 + (pose === 'run' ? 18 : 0) + (pose === 'floor' ? -8 : 0), hy = headY, R = 24 * hd;
  g.fillStyle = col; g.fillRect(hx - 8, hy + 10, 16, 22); circ(g, hx, hy, R);
  if (o.look !== 'down') poly(g, [hx + R - 2, hy - 2, hx + R + 7, hy + 6, hx + R - 1, hy + 10]);
  if (P.beard) ell(g, hx + 8, hy + 18, 17, 13);
  if (P.moustache) ell(g, hx + R - 4, hy + 10, 6, 3);
  if (P.hair === 'wavy') { ell(g, hx - 4, hy - 16, R + 3, 14); for (let k = 0; k < 5; k++) circ(g, hx - 20 + k * 9, hy - 22 - (k % 2) * 3, 8); }
  if (P.hair === 'curly') for (let k = 0; k < 7; k++) circ(g, hx - 24 + k * 8, hy - 20 - Math.sin(k) * 4, 9);
  if (P.scarf) { ell(g, hx - 2, hy - 2, R + 6, R + 8); poly(g, [hx - R - 6, hy, hx + R + 4, hy, hx + R + 14, hy + 50, hx - R - 14, hy + 50]); }
  if (P.hair === 'white' && !isRim) { g.fillStyle = '#b9b6ae'; ell(g, hx - 6, hy - 14, R, 12); if (P.beard === 'white') ell(g, hx + 8, hy + 18, 16, 12); g.fillStyle = col; }
  if (P.glasses && !isRim) { g.fillStyle = rgba('#ffffff', .7); circ(g, hx + R - 5, hy - 2, 3); g.fillStyle = col; }
  // shoes
  if (P.sneakers && !isRim && pose !== 'floor' && pose !== 'sit') { g.fillStyle = P.sneakers; ell(g, sw * 46 * run + 8, -8, 18, 8); ell(g, -sw * 46 * run + 8, -8, 18, 8); }
  if (P.sneakers && !isRim && pose === 'sit') { g.fillStyle = P.sneakers; ell(g, 80, -8, 18, 8); ell(g, 66, -8, 17, 8); }
}
function person(g, x, y, s, o = {}) {
  const P = PEOPLE[o.kind || 'hero'];
  g.save(); g.translate(x, y); g.scale(s * P.h * (o.flip ? -1 : 1), s * P.h);
  if (o.blur) g.filter = `blur(${o.blur}px)`;
  if (o.shadow !== false) { g.fillStyle = rgba('#000', .35); ell(g, 10, 0, 70, 12); }
  if (o.rim) { g.save(); g.translate(o.rimDx || 4, -2); figure(g, o, o.rim, true); g.restore(); }
  figure(g, o, o.col || DK, false);
  g.restore();
}

// ---------- eye & face ----------
function eye(g, x, y, s, open = 1, refl = '#8fc4ff', t = 0, skin = true) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (skin) { const sk = g.createRadialGradient(0, 0, 40, 0, 0, 520); sk.addColorStop(0, '#b47d5c'); sk.addColorStop(.6, '#5a3424'); sk.addColorStop(1, '#120a06'); g.fillStyle = sk; g.fillRect(-1400, -900, 2800, 1800); }
  const o = 80 * open;
  g.save(); g.beginPath(); g.moveTo(-190, 0); g.quadraticCurveTo(0, -o * 1.6, 190, 0); g.quadraticCurveTo(0, o * 1.2, -190, 0); g.closePath(); g.clip();
  g.fillStyle = '#e9e2da'; g.fillRect(-200, -120, 400, 240);
  const ir = g.createRadialGradient(0, 0, 10, 0, 0, 82); ir.addColorStop(0, '#6a3a1a'); ir.addColorStop(.6, '#3a1c0c'); ir.addColorStop(1, '#140804'); g.fillStyle = ir; circ(g, 0, 0, 82);
  g.fillStyle = '#050302'; circ(g, 0, 0, 34 + Math.sin(t) * 2);
  g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(refl, .75); rr(g, 14, -40, 30, 22, 4); g.fillStyle = rgba('#fff', .6); circ(g, -26, -26, 9);
  g.restore();
  g.strokeStyle = '#1a0d08'; g.lineWidth = 10; g.beginPath(); g.moveTo(-190, 0); g.quadraticCurveTo(0, -o * 1.6, 190, 0); g.stroke();
  g.strokeStyle = '#120906'; g.lineWidth = 4; for (let i = -170; i <= 170; i += 16) { const yy = -o * 1.6 * (1 - (i / 190) ** 2) * .5; g.beginPath(); g.moveTo(i, yy); g.lineTo(i * 1.06 + 4, yy - 26); g.stroke(); }
  g.restore();
}
function profileHead(g, x, y, s, rim = '#7fa8d8', col = DK) { // big profile face facing right
  g.save(); g.translate(x, y); g.scale(s, s);
  const draw = (c) => {
    g.fillStyle = c; g.beginPath(); g.moveTo(-120, -160); g.bezierCurveTo(-60, -230, 60, -220, 96, -140); g.lineTo(104, -96); g.bezierCurveTo(110, -80, 132, -60, 130, -46);
    g.lineTo(108, -40); g.lineTo(112, -24); g.lineTo(104, -14); g.lineTo(110, 0); g.bezierCurveTo(104, 26, 96, 40, 70, 70); g.bezierCurveTo(40, 100, -10, 100, -30, 120); g.lineTo(-60, 320); g.lineTo(-220, 320); g.bezierCurveTo(-200, 160, -190, -60, -120, -160); g.fill();
    for (let k = 0; k < 7; k++) circ(g, -100 + k * 26, -186 + Math.sin(k * 1.7) * 8, 26);
  };
  g.save(); g.translate(6, -3); draw(rim); g.restore(); draw(col);
  g.restore();
}

// ---------- phone UI ----------
function fmt(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return [h, m, s].map(v => String(v).padStart(2, '0')).join(':'); }
function phone(g, x, y, s, mode, data = {}, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = rgba('#000', .5); rr(g, -150, -300, 316, 616, 44);
  g.fillStyle = '#121318'; rr(g, -160, -310, 320, 620, 46); g.fillStyle = '#1d1f26'; rr(g, -156, -306, 312, 612, 43);
  const on = mode !== 'off';
  g.fillStyle = on ? (mode === 'call' || mode === 'nosvc' ? '#0e1622' : '#0b0f18') : '#020203'; rr(g, -146, -296, 292, 592, 36);
  if (on) {
    const bg = g.createLinearGradient(0, -296, 0, 296); bg.addColorStop(0, mode === 'final' ? '#2a3a5a' : '#152032'); bg.addColorStop(1, mode === 'final' ? '#6a4a3a' : '#070a12'); g.fillStyle = bg; rr(g, -146, -296, 292, 592, 36);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#000'; rr(g, -44, -282, 88, 24, 12);
    g.fillStyle = rgba('#fff', .85); g.font = '600 18px Cairo'; g.textAlign = 'left'; g.direction = 'ltr'; g.fillText(data.clock || '6:00', -122, -266); g.textAlign = 'center'; g.direction = 'rtl';
    if (mode === 'message' || mode === 'final') {
      g.font = '300 96px Cairo'; g.direction = 'ltr'; g.fillStyle = rgba('#fff', .92); g.fillText(data.clock || '6:00', 0, -170);
      g.direction = 'rtl'; g.fillStyle = rgba('#ffffff', .16); rr(g, -128, -70, 256, 150, 22);
      g.fillStyle = rgba('#fff', .55); g.font = '600 17px Cairo'; g.fillText(mode === 'final' ? 'رسالة جديدة · الآن' : 'رقم غير معروف · الآن', 0, -46);
      g.fillStyle = '#fff'; g.font = '700 30px Cairo';
      if (mode === 'final') { g.fillText('انتهت التجربة.', 0, -4); g.font = '600 22px Cairo'; g.fillText('يومك الحقيقي يبدأ الآن.', 0, 36); }
      else { g.fillText('أمامك 24 ساعة.', 0, -2); g.font = '500 34px "Courier New", monospace'; g.direction = 'ltr'; g.fillStyle = data.red ? '#ff5a4a' : '#ffd36b'; g.fillText(fmt(data.left || 0), 0, 44); }
    } else if (mode === 'countdown') {
      g.direction = 'ltr'; g.font = '500 64px "Courier New", monospace'; g.fillStyle = data.left < 11 ? '#ff5a4a' : '#ffd36b'; g.fillText(fmt(data.left || 0), 0, 0);
      g.direction = 'rtl'; g.font = '600 20px Cairo'; g.fillStyle = rgba('#fff', .6); g.fillText('الوقت المتبقي', 0, -70);
    } else if (mode === 'call' || mode === 'nosvc') {
      g.fillStyle = rgba('#fff', .2); circ(g, 0, -150, 56); g.fillStyle = rgba('#fff', .7); circ(g, 0, -170, 20); ell(g, 0, -128, 34, 20);
      g.fillStyle = '#fff'; g.font = '700 28px Cairo'; g.fillText(data.name || 'رقم غير معروف', 0, -62);
      g.font = '500 20px Cairo'; g.fillStyle = mode === 'nosvc' ? '#ff8a7a' : rgba('#fff', .65); g.fillText(mode === 'nosvc' ? 'الرقم غير موجود في الخدمة' : 'جارٍ الاتصال…', 0, -22);
      g.fillStyle = '#e5483a'; circ(g, 0, 210, 36); g.fillStyle = '#fff'; g.save(); g.translate(0, 210); g.rotate(2.36); rr(g, -18, -6, 36, 12, 6); g.restore();
    } else if (mode === 'chat') {
      g.fillStyle = rgba('#fff', .1); g.fillRect(-146, -250, 292, 56); g.fillStyle = '#fff'; g.font = '700 22px Cairo'; g.fillText(data.name || '', 0, -222);
      (data.msgs || []).forEach(([txt, mine, a], i) => { if (a <= 0) return; g.save(); g.globalAlpha = a; g.font = '600 24px Cairo'; const w = g.measureText(txt).width + 36, bx = mine ? 120 - w : -120, by = 40 + i * 70; g.fillStyle = mine ? '#2f7d5a' : '#2a2f3a'; rr(g, bx, by - 24, w, 48, 18); g.fillStyle = '#fff'; g.fillText(txt, bx + w / 2, by + 2); g.restore(); });
      if (data.typing) { g.fillStyle = '#2a2f3a'; rr(g, -120, 136, 84, 44, 18); for (let k = 0; k < 3; k++) { g.fillStyle = rgba('#fff', .4 + .6 * Math.abs(Math.sin(data.t * 6 + k))); circ(g, -98 + k * 20, 158, 5); } }
    } else if (mode === 'incoming') {
      g.fillStyle = '#fff'; g.font = '700 34px Cairo'; g.fillText(data.name || 'أمي', 0, -120); g.font = '500 20px Cairo'; g.fillStyle = rgba('#fff', .6); g.fillText(data.sub || '3 مكالمات فائتة', 0, -76);
      g.fillStyle = '#34c759'; circ(g, 0, 200, 38); g.fillStyle = '#fff'; g.save(); g.translate(0, 200); g.rotate(-.8); rr(g, -18, -6, 36, 12, 6); g.restore();
    }
    const gl = g.createLinearGradient(-146, -296, 146, 296); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.35, 'rgba(255,255,255,0)'); g.fillStyle = gl; rr(g, -146, -296, 292, 592, 36);
  }
  g.restore();
  if (on) glow(g, x, y, 420 * s, mode === 'final' ? '#ffd2a0' : '#8cb8ff', .16);
}

// ---------- environments ----------
function skyline(g, y0, seed, col, hmin, hmax, wmin = 60, wmax = 160, windows = 0, t = 0, winCol = '#ffd08a', winOn = 1) {
  const r = rng(seed); let x = -40;
  while (x < W + 40) {
    const w = wmin + r() * (wmax - wmin), h = hmin + r() * (hmax - hmin); g.fillStyle = col; g.fillRect(x, y0 - h, w, h + 400);
    if (r() > .7) { g.fillRect(x + w * .4, y0 - h - 30, 4, 30); }
    if (r() > .8) { ell(g, x + w * .2, y0 - h - 6, 12, 5); }
    if (windows) for (let wy = y0 - h + 16; wy < y0 - 10; wy += 24) for (let wx = x + 10; wx < x + w - 14; wx += 20) { const v = r(); if (v < windows * winOn) { g.fillStyle = rgba(winCol, .35 + v * .6); g.fillRect(wx, wy, 8, 11); } }
    g.fillStyle = col; x += w + r() * 10;
  }
}
function room(g, wallTop, wallBot, floorCol, floorY) { g.fillStyle = vgrad(g, 0, floorY, [[0, wallTop], [1, wallBot]]); g.fillRect(0, 0, W, floorY); g.fillStyle = floorCol; g.fillRect(0, floorY, W, H - floorY); }
function windowFrame(g, x, y, w, h, light, a = 1, curtains = true) {
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, rgba(light, a)); gr.addColorStop(1, rgba(mixh(light, '#000000', .3), a)); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = DK; g.fillRect(x + w / 2 - 4, y, 8, h); g.fillRect(x, y + h / 2 - 4, w, 8);
  g.fillStyle = '#0d0f14'; g.fillRect(x - 14, y - 14, w + 28, 14); g.fillRect(x - 14, y + h, w + 28, 18); g.fillRect(x - 14, y, 14, h); g.fillRect(x + w, y, 14, h);
  if (curtains) { g.fillStyle = rgba('#0c0e14', .92); poly(g, [x - 60, y - 30, x + w * .22, y - 30, x + w * .14, y + h + 30, x - 60, y + h + 30]); poly(g, [x + w * .78, y - 30, x + w + 60, y - 30, x + w + 60, y + h + 30, x + w * .86, y + h + 30]); }
  glow(g, x + w / 2, y + h / 2, Math.max(w, h) * 1.2, light, .18 * a);
}
function mug(g, x, y, s, t, steam = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#1a1c22'; rr(g, -30, -70, 60, 70, 8); g.strokeStyle = '#1a1c22'; g.lineWidth = 9; g.beginPath(); g.arc(34, -38, 16, -1.4, 1.4); g.stroke();
  g.fillStyle = rgba('#fff', .12); g.fillRect(-24, -64, 8, 56);
  if (steam) { g.strokeStyle = rgba('#e8eef8', .22 * steam); g.lineWidth = 6; for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i < 20; i++) { const yy = -80 - i * 8, xx = -12 + k * 12 + Math.sin(t * 2 + i * .5 + k) * 8; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); } }
  g.restore();
}
function guitar(g, x, y, s, col = '#14161c') { g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-.2); g.fillStyle = col; ell(g, 0, 0, 70, 84); ell(g, 0, -100, 54, 60); g.fillRect(-9, -330, 18, 240); g.fillRect(-16, -370, 32, 50); g.fillStyle = '#05060a'; circ(g, 0, -60, 20); g.fillStyle = rgba('#fff', .06); ell(g, -30, -20, 20, 50, -.2); g.restore(); }
function car(g, x, y, s, col = '#0b0c10', flip = false, lights = true) {
  g.save(); g.translate(x, y); g.scale(flip ? -s : s, s); g.fillStyle = col;
  poly(g, [-200, -30, -190, -80, -120, -90, -70, -150, 90, -150, 150, -90, 210, -80, 215, -30]);
  g.fillStyle = '#05060a'; circ(g, -120, -30, 38); circ(g, 130, -30, 38); g.fillStyle = '#2a2c33'; circ(g, -120, -30, 16); circ(g, 130, -30, 16);
  if (lights) { glow(g, 208, -70, 90, '#fff2cc', .6); glow(g, -198, -70, 60, '#ff3020', .6); }
  g.restore();
}
