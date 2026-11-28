// v2 style: painted backgrounds with ink outlines, outlined stick characters, pop-in animation,
// word-by-word headlines, parchment map with pins/arrows, counters.
const V2 = document.getElementById('v2'), X2 = V2.getContext('2d');
const V2_DUR = 37, INK = '#2b1d12', PAPERW = '#fbfaf3';
let GEO = null;

const easeBack = t => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const popS = (t, t0, d = .38) => t < t0 ? 0 : easeBack((t - t0) / d);
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

// ---------- ink helpers ----------
function jitter(pts, seed, amp = 1.6, step = 16, closed = true) {
  const r = rng(seed), out = [], n = pts.length / 2, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
    const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 0; j < k; j++) { const u = j / k; out.push(lerp(x0, x1, u) + (r() - .5) * amp * 2, lerp(y0, y1, u) + (r() - .5) * amp * 2); }
  }
  if (!closed) out.push(pts[pts.length - 2], pts[pts.length - 1]);
  return out;
}
function pathOf(g, p, closed = true) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); if (closed) g.closePath(); }
function inkShape(g, pts, fill, lw = 4, seed = 1, amp = 1.4) {
  const p = jitter(pts, seed, amp); pathOf(g, p);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); }
}
function inkEll(g, x, y, rx, ry, fill, lw = 4, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); } }
function limb(g, pts, w, fill) { line(g, pts, w + 7, INK); line(g, pts, w, fill); }
function brush(g, x, y, w, h, cols, n, seed, len = 34, w0 = 3, w1 = 12, a = .1, ang = 0) {
  const r = rng(seed); g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, L = len * (.5 + r()), an = ang + (r() - .5) * .6;
    g.strokeStyle = rgba(cols[(r() * cols.length) | 0], a * (.5 + r())); g.lineWidth = w0 + r() * (w1 - w0);
    g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + Math.cos(an) * L * .5, py + Math.sin(an) * L * .5 + (r() - .5) * 8, px + Math.cos(an) * L, py + Math.sin(an) * L); g.stroke();
  }
  g.restore();
}
const TEX = off(960, 540, (g, w, h) => { const im = g.createImageData(w, h), r = rng(9); for (let i = 0; i < im.data.length; i += 4) { const v = 200 + r() * 55; im.data[i] = v; im.data[i + 1] = v * .97; im.data[i + 2] = v * .9; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); g.filter = 'blur(1px)'; g.drawImage(g.canvas, 0, 0); });

// ---------- props ----------
function inkPalm(g, x, y, s, t = 0, seed = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const sw = Math.sin(t * .8 + seed) * 4, r = rng(seed);
  const trunk = jitter([-9, 0, 9, 0, 5 + sw, -230, -5 + sw, -230], seed, 1.2);
  pathOf(g, trunk); g.fillStyle = '#7a5532'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = rgba(INK, .5); g.lineWidth = 2; for (let k = 1; k < 13; k++) { const yy = -230 * k / 13; g.beginPath(); g.moveTo(-7 + sw * k / 13, yy); g.lineTo(7 + sw * k / 13, yy - 4); g.stroke(); }
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * .38 + (r() - .5) * .1, L = 100 + r() * 30;
    const ex = sw + Math.cos(a) * L, ey = -232 + Math.sin(a) * L * .45 + Math.abs(i - 4) * 12;
    const mx = sw + Math.cos(a) * L * .5, my = -232 + Math.sin(a) * L * .6 - 26;
    g.beginPath(); g.moveTo(sw, -232); g.quadraticCurveTo(mx, my - 10, ex, ey); g.quadraticCurveTo(mx, my + 14, sw, -226); g.closePath();
    g.fillStyle = i % 2 ? '#4f7a33' : '#5f8c3c'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.strokeStyle = rgba('#2f4a1f', .7); g.lineWidth = 1.6; for (let k = .25; k < .95; k += .12) { const px = lerp(sw, ex, k), py = lerp(-232, ey, k) - 18 * Math.sin(k * Math.PI); g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1.2) * 12, py + 10); g.stroke(); }
  }
  inkEll(g, sw - 6, -226, 6, 6, '#8a3e1c', 2); inkEll(g, sw + 6, -224, 6, 6, '#8a3e1c', 2);
  g.restore();
}
function inkHouse(g, x, y, w, h, c, seed) {
  inkShape(g, [x, y, x + w, y, x + w, y - h, x, y - h], c, 3.5, seed);
  inkShape(g, [x - 5, y - h, x + w + 5, y - h, x + w + 5, y - h - 10, x - 5, y - h - 10], shade(c, -.08), 3, seed + 1);
  g.fillStyle = rgba('#fff', .14); g.fillRect(x + 3, y - h + 3, w * .12, h - 6);
  const r = rng(seed); const dw = Math.min(30, w * .22), dx = x + w * (.25 + r() * .4);
  g.beginPath(); g.roundRect(dx, y - h * .48, dw, h * .48, [dw / 2, dw / 2, 0, 0]); g.fillStyle = '#4a2e1a'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  if (w > 70) { g.fillStyle = '#3a2414'; g.fillRect(x + w * .72, y - h * .78, 10, 12); g.strokeRect(x + w * .72, y - h * .78, 10, 12); }
  g.strokeStyle = rgba(INK, .16); g.lineWidth = 1.5; for (let k = 0; k < 5; k++) { const yy = y - r() * h; g.beginPath(); g.moveTo(x + r() * w * .4, yy); g.lineTo(x + w * (.5 + r() * .45), yy); g.stroke(); }
}
function inkZig(g, cx, gy, w, h) {
  const T = [[w, w * .8, h * .44], [w * .6, w * .52, h * .26], [w * .36, w * .31, h * .16]];
  let y = gy;
  T.forEach(([bw, tw, th], i) => {
    inkShape(g, [cx - bw / 2, y, cx + bw / 2, y, cx + tw / 2, y - th, cx - tw / 2, y - th], ['#d39c6c', '#c98f60', '#be8457'][i], 4, 40 + i);
    inkShape(g, [cx + bw * .18, y, cx + bw / 2, y, cx + tw / 2, y - th, cx + tw * .18, y - th], rgba('#7a4a2c', .35), 0, 50 + i);
    g.strokeStyle = rgba(INK, .35); g.lineWidth = 2; for (let k = 1; k < 10; k++) { const fx = lerp(cx - bw / 2, cx + bw / 2, k / 10), fx2 = lerp(cx - tw / 2, cx + tw / 2, k / 10); g.beginPath(); g.moveTo(fx, y - 3); g.lineTo(fx2, y - th + 3); g.stroke(); }
    y -= th;
  });
  inkShape(g, [cx - w * .1, y, cx + w * .1, y, cx + w * .1, y - h * .12, cx - w * .1, y - h * .12], '#b97a50', 4, 60);
  inkShape(g, [cx - w * .025, y, cx + w * .025, y, cx + w * .025, y - h * .07, cx - w * .025, y - h * .07], '#4a2e1a', 2.5, 61);
  inkShape(g, [cx - w * .05, gy, cx + w * .05, gy, cx + w * .032, gy - h * .7, cx - w * .032, gy - h * .7], '#e0b07e', 3.5, 62);
  g.strokeStyle = rgba(INK, .45); g.lineWidth = 1.6; for (let k = 1; k < 26; k++) { const yy = gy - h * .7 * k / 26, hw = lerp(w * .05, w * .032, k / 26); g.beginPath(); g.moveTo(cx - hw, yy); g.lineTo(cx + hw, yy); g.stroke(); }
  for (const s of [-1, 1]) inkShape(g, [cx + s * w * .47, gy, cx + s * w * .39, gy, cx + s * w * .05, gy - h * .44, cx + s * w * .1, gy - h * .44], '#e0b07e', 3.5, 63 + s);
}
function sheep(g, x, y, s, t, flip = false, seed = 1) {
  g.save(); g.translate(x, y); g.scale(flip ? -s : s, s); const r = rng(seed), b = Math.sin(t * 2 + seed) * 1.5;
  for (const lx of [-26, -10, 14, 28]) limb(g, [lx, -20, lx, 0], 5, '#3a2a20');
  g.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.arc(Math.cos(a) * 36, -40 + b + Math.sin(a) * 22, 11 + r() * 3, a - 1, a + 1); }
  g.closePath(); g.fillStyle = '#f7f3ea'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
  inkEll(g, 44, -50 + b, 14, 11, '#3a2a20', 3); inkEll(g, 38, -60 + b, 7, 4, '#3a2a20', 2.5, -.5);
  g.fillStyle = '#fff'; circ(g, 49, -53 + b, 2.2);
  g.restore();
}

// ---------- characters ----------
const KINDS = {
  ali: { top: '#6b7a3c', tee: true, legs: '#2f4a7a', shoes: '#f4f4f0', hair: 'curly' },
  sumer: { top: PAPERW, skirt: '#efe4c8', skirtLen: 46, legs: PAPERW, shoes: '#6b4a30', beard: '#3a2a1e', staff: true },
  merchant: { top: '#9b4a2c', skirt: '#9b4a2c', skirtLen: 70, legs: PAPERW, shoes: '#5a3a22', beard: '#2e2018', cap: '#e2b04a' },
  bab: { top: '#2f5a9a', skirt: '#2f5a9a', skirtLen: 66, legs: PAPERW, shoes: '#5a3a22', beard: '#2e2018', shawl: '#c9a24a' },
};
function stick(g, x, y, s, o = {}) {
  const K = Object.assign({}, KINDS[o.kind || 'ali'], o.colors || {}), t = o.t || 0;
  if (s <= 0.001) return;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s);
  g.fillStyle = 'rgba(0,0,0,.18)'; ell(g, 0, 0, 40, 9);
  const w = o.walk || 0, sw = Math.sin(w) * 14, bob = o.walk ? Math.abs(Math.sin(w)) * -4 : Math.sin(t * 2.2 + (o.seed || 0)) * 1.2;
  g.translate(0, bob);
  const hipY = -78, shY = -150, hy = -202, R = 34;
  // legs
  for (const [lx, d] of [[-11, sw], [11, -sw]]) { limb(g, [lx, hipY, lx * 1.2 + d * .6, -40, lx * 1.3 + d, -8], 8, K.legs); inkEll(g, lx * 1.3 + d + (lx > 0 ? 5 : -5), -6, 13, 7, K.shoes, 3.5); }
  // back arm
  const armL = o.armsUp ? [-24, shY + 8, -44, shY - 30, -50 + Math.sin(t * 9) * 6, shY - 66] : [-24, shY + 8, -36, shY + 40, -34 + sw * .3, hipY - 6];
  limb(g, armL, 7, K.top === PAPERW ? PAPERW : K.top); inkEll(g, armL[4], armL[5], 8, 8, PAPERW, 3.5);
  // torso
  inkShape(g, [-25, shY - 6, 25, shY - 6, 31, hipY + 4, -31, hipY + 4], K.top, 4, 7);
  if (K.tee) { inkShape(g, [-8, shY - 4, 8, shY - 4, 7, hipY + 2, -7, hipY + 2], '#f4f2ea', 2.5, 8); }
  if (K.shawl) inkShape(g, [-25, shY - 4, -8, shY - 6, 31, hipY + 30, 18, hipY + 40], K.shawl, 3, 9);
  if (K.skirt) { inkShape(g, [-31, hipY - 4, 31, hipY - 4, 38, hipY + K.skirtLen, -38, hipY + K.skirtLen], K.skirt, 4, 10); g.strokeStyle = rgba(INK, .6); g.lineWidth = 2; for (let i = -34; i <= 34; i += 6) { g.beginPath(); g.moveTo(i, hipY + K.skirtLen - 2); g.lineTo(i * 1.02, hipY + K.skirtLen + 7); g.stroke(); } }
  // front arm
  let armR;
  if (o.wave) armR = [24, shY + 8, 46, shY - 22, 54 + Math.sin(t * 12) * 10, shY - 62];
  else if (o.armsUp) armR = [24, shY + 8, 44, shY - 30, 50 + Math.sin(t * 9 + 1) * 6, shY - 66];
  else if (o.point) armR = [24, shY + 8, 56, shY - 6, 82, shY - 18];
  else if (o.scratch) armR = [24, shY + 8, 52, shY - 30, 22, hy - R + 4];
  else armR = [24, shY + 8, 36, shY + 40, 34 - sw * .3, hipY - 6];
  if (K.staff && !o.wave) { limb(g, [44, hipY + 70, 50, shY - 90], 4, '#8a5a34'); g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); g.arc(60, shY - 90, 10, Math.PI, 0); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#8a5a34'; g.stroke(); armR = [24, shY + 8, 40, shY + 20, 47, shY - 20]; }
  limb(g, armR, 7, K.top === PAPERW ? PAPERW : K.top); inkEll(g, armR[4], armR[5], 8, 8, PAPERW, 3.5);
  // head
  inkEll(g, 0, hy, R, R * 1.02, PAPERW, 4.5);
  const look = o.look || 0, blink = (Math.sin(t * 1.3 + (o.seed || 0) * 7) > .985) ? .15 : 1;
  const ex = look * 5;
  g.fillStyle = INK; ell(g, -11 + ex, hy - 2, 4.4, 6.5 * blink); ell(g, 11 + ex, hy - 2, 4.4, 6.5 * blink);
  g.fillStyle = '#fff'; if (blink > .5) { circ(g, -10 + ex, hy - 5, 1.4); circ(g, 12 + ex, hy - 5, 1.4); }
  const ex2 = o.expr || 'smile'; g.lineWidth = 3.5; g.strokeStyle = INK; g.lineCap = 'round';
  const brow = (dx, dy, tilt) => { g.beginPath(); g.moveTo(dx - 7, hy - 15 + dy + tilt); g.lineTo(dx + 7, hy - 15 + dy - tilt); g.stroke(); };
  if (ex2 === 'surprise') { brow(-11 + ex, -6, 0); brow(11 + ex, -6, 0); }
  else if (ex2 === 'confused') { brow(-11 + ex, -2, -2); brow(11 + ex, -7, 2); }
  else if (ex2 === 'sly') { brow(-11 + ex, 1, -3); brow(11 + ex, 1, 3); }
  else { brow(-11 + ex, -2, 0); brow(11 + ex, -2, 0); }
  const m = o.mouth || 0, my = hy + 15;
  if (m > .05) { inkEll(g, ex * .6, my, 7, 2 + m * 7, '#6a2a1e', 3); }
  else if (ex2 === 'surprise') inkEll(g, ex * .6, my, 5, 6, '#6a2a1e', 3);
  else if (ex2 === 'confused') { g.beginPath(); g.moveTo(-8, my); g.quadraticCurveTo(-3, my - 4, 0, my); g.quadraticCurveTo(4, my + 4, 9, my - 1); g.stroke(); }
  else if (ex2 === 'sly') { g.beginPath(); g.moveTo(-9, my - 1); g.quadraticCurveTo(2, my + 7, 11, my - 5); g.stroke(); }
  else { g.beginPath(); g.arc(ex * .6, my - 5, 10, .2 * Math.PI, .8 * Math.PI); g.stroke(); }
  if (K.beard) { inkShape(g, [-24, hy + 8, -14, hy + 22, 0, hy + 26, 14, hy + 22, 24, hy + 8, 22, hy + 30, 8, hy + 50, -8, hy + 50, -22, hy + 30], K.beard, 3, 11, 1); if (m > .05) inkEll(g, ex * .6, my, 6, 1.5 + m * 5, '#6a2a1e', 2.5); }
  if (K.hair === 'curly') { g.fillStyle = '#16100c'; for (let a = 190; a <= 350; a += 16) { const rr = a * Math.PI / 180; circ(g, Math.cos(rr) * 30, hy - 6 + Math.sin(rr) * 30, 11); } ell(g, 0, hy - 28, 28, 12); g.lineWidth = 3; g.strokeStyle = INK; g.beginPath(); g.arc(0, hy - 6, 41, 1.06 * Math.PI, 1.94 * Math.PI); g.stroke(); }
  if (K.cap) inkShape(g, [-26, hy - 24, 26, hy - 24, 22, hy - 46, -22, hy - 46], K.cap, 3.5, 12);
  if (o.sweat) { g.save(); g.translate(R + 6, hy - 18 + (t * 30) % 14); inkShape(g, [0, -10, 6, 2, 0, 8, -6, 2], '#8fd0ff', 2.5, 13, .3); g.restore(); }
  g.restore();
}

// ---------- overlays ----------
function headline(g, words, t, t0, t1, y = 118, size = 70, stroke = 13) {
  if (t < t0 || t > t1) return;
  const fade = 1 - ss(t1 - .2, t1, t);
  g.save(); g.font = `800 ${size}px Cairo`; g.direction = 'rtl'; g.textBaseline = 'middle'; g.textAlign = 'right';
  const ws = words.map(w => g.measureText(w.w).width), sp = size * .28, total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let x = W / 2 + total / 2;
  words.forEach((w, i) => {
    const st = t0 + i * .09, p = popS(t, st, .28); if (p <= 0) { x -= ws[i] + sp; return; }
    const sc = .6 + .4 * p; g.save(); g.globalAlpha = fade * clamp((t - st) / .12); g.translate(x - ws[i] / 2, y); g.scale(sc, sc);
    g.lineJoin = 'round'; g.lineWidth = stroke; g.strokeStyle = '#150d07'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.strokeText(w.w, ws[i] / 2, 0); g.shadowColor = 'transparent'; g.fillStyle = w.c || '#ffffff'; g.fillText(w.w, ws[i] / 2, 0); g.restore();
    x -= ws[i] + sp;
  });
  g.restore();
}
const HW = s => s.split(' ').map(w => { const m = w.match(/^«(.*)»(.*)$/); return m ? { w: m[1] + m[2], c: '#ffd23a' } : w.startsWith('!') ? { w: w.slice(1), c: '#ff4b3e' } : { w }; });
function inkBubble(g, x, y, s, a, tail = 1) {
  if (a <= 0) return; g.save(); g.translate(x, y); g.scale(a, a);
  g.font = '800 56px Cairo'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(s).width + 64;
  g.beginPath(); g.roundRect(-w / 2, -50, w, 96, 46); g.moveTo(-12 * tail, 44); g.lineTo(-40 * tail, 84); g.lineTo(16 * tail, 44);
  g.fillStyle = '#fffdf6'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.fillText(s, 0, -2); g.restore();
}
function pin(g, x, y, t, t0, big = 1, col = '#d8302a') {
  const p = popS(t, t0, .4); if (p <= 0) return;
  const pulse = (t - t0) % 1.6 / 1.6;
  g.save(); g.translate(x, y); g.scale(p * big, p * big);
  g.strokeStyle = rgba(col, .5 * (1 - pulse)); g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 28 + pulse * 40, 0, TAU); g.stroke();
  inkEll(g, 0, 0, 27, 27, col, 5); inkEll(g, 0, 0, 13, 13, '#ffd23a', 3.5); g.fillStyle = 'rgba(255,255,255,.6)'; circ(g, -8, -9, 5);
  g.restore();
}
function tag(g, x, y, s, t, t0, rot = 0, size = 34) {
  const p = popS(t, t0, .35); if (p <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(p, p); g.font = `800 ${size}px Cairo`; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(s).width + 34, h = size * 1.45;
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-w / 2 + 5, -h / 2 + 6, w, h);
  inkShape(g, [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2], '#f8f0dc', 3.5, 70, .8);
  g.fillStyle = INK; g.fillText(s, 0, 2); g.restore();
}
function arrow(g, ax, ay, bx, by, t, t0, d = .8, bend = .2, col = '#d8302a') {
  const p = eo((t - t0) / d); if (t < t0) return;
  const mx = (ax + bx) / 2 - (by - ay) * bend, my = (ay + by) / 2 + (bx - ax) * bend;
  const pts = []; const n = 40; for (let i = 0; i <= n * p; i++) { const u = i / n; pts.push((1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx, (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by); }
  if (pts.length < 4) return;
  line(g, pts, 17, INK); line(g, pts, 10, col);
  const L = pts.length, ex = pts[L - 2], ey = pts[L - 1], ang = Math.atan2(ey - pts[L - 3], ex - pts[L - 4]);
  g.save(); g.translate(ex, ey); g.rotate(ang); inkShape(g, [16, 0, -14, -16, -14, 16], col, 4.5, 71, .3); g.restore();
}

// ---------- backgrounds ----------
const URBG = () => cached('v2_ur', 2400, 1350, (g, w, h) => {
  const hz = 610;
  g.fillStyle = vgrad(g, 0, hz, [[0, '#8fbfdc'], [.55, '#f3d9ae'], [1, '#fbe6c2']]); g.fillRect(0, 0, w, hz + 20);
  glow(g, 1780, 470, 520, '#fff1c8', .8);
  const r = rng(3);
  for (let c = 0; c < 7; c++) { const cx = 150 + r() * 2100, cy = 90 + r() * 260, cw = 160 + r() * 220; for (let k = 0; k < 8; k++) { g.fillStyle = rgba('#ffffff', .55); ell(g, cx + (r() - .5) * cw, cy + (r() - .5) * 30, 40 + r() * 70, 18 + r() * 26); } }
  brush(g, 0, 0, w, hz, ['#ffffff', '#f6d2a0', '#a8cde3'], 500, 4, 60, 4, 16, .07);
  // far haze
  for (let i = 0; i < 26; i++) { g.save(); g.globalAlpha = .45; inkPalm(g, 60 + i * 95 + r() * 40, hz + 10, .45 + r() * .15, 0, 100 + i); g.restore(); }
  g.fillStyle = rgba('#f3dfc0', .55); g.fillRect(0, hz - 140, w, 160);
  // city + ziggurat
  for (let i = 0; i < 16; i++) inkHouse(g, 1200 + i * 62 + r() * 20, hz + 40, 70 + r() * 40, 50 + r() * 50, ['#d7aa7a', '#cf9f6e', '#c79563'][i % 3], 200 + i);
  inkZig(g, 1720, hz + 10, 620, 360);
  for (let i = 0; i < 10; i++) inkHouse(g, 1250 + i * 95 + r() * 20, hz + 70, 90 + r() * 30, 60 + r() * 50, ['#dcb080', '#d2a372'][i % 2], 300 + i);
  // land
  g.fillStyle = vgrad(g, hz + 40, h, [[0, '#c8b06e'], [.25, '#d7bd84'], [1, '#c99d68']]); g.fillRect(0, hz + 60, w, h);
  for (let i = 0; i < 7; i++) { const y0 = hz + 70 + i * 18; g.fillStyle = i % 2 ? '#9fb25a' : '#b5bf62'; g.fillRect(0, y0, w, 14); }
  g.strokeStyle = rgba('#5a6a2a', .35); g.lineWidth = 2; for (let i = 0; i < 200; i++) { const x = r() * w, y = hz + 70 + r() * 125; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.stroke(); }
  // river (Euphrates) winding to foreground left
  const riv = [1150, hz + 92, 900, hz + 120, 600, hz + 170, 380, hz + 260, 220, hz + 420, 120, h, -40, h, 40, hz + 420, 200, hz + 250, 450, hz + 160, 760, hz + 110, 1000, hz + 88];
  inkShape(g, riv, '#6fa6c4', 4, 80, 2);
  g.save(); pathOf(g, jitter(riv, 80, 2)); g.clip(); brush(g, 0, hz, 1200, h - hz, ['#ffffff', '#9fd0e8', '#4a86aa'], 260, 81, 70, 3, 9, .2, 0); g.restore();
  for (let i = 0; i < 40; i++) { const u = r(), x = lerp(1050, 40, u) + (r() - .5) * 60, y = lerp(hz + 100, h - 40, u * u); for (let k = 0; k < 5; k++) line(g, [x + k * 4, y, x + k * 4 + (r() - .5) * 10, y - 26 - r() * 20], 2.5, '#5f7a2e'); }
  // reed boat
  g.save(); g.translate(330, hz + 330); inkShape(g, [-110, -40, -80, 4, 80, 4, 110, -40, 70, -12, -70, -12], '#3a2818', 3.5, 82); g.restore();
  // palms
  [[330, 760], [480, 800], [760, 740], [2050, 770], [2230, 800], [1000, 730]].forEach(([x, y], i) => inkPalm(g, x, y, .9 + (i % 3) * .12, 0, 400 + i));
  // reed hut (mudhif) + fence
  g.save(); g.translate(560, 980);
  const hut = [-170, 0, -170, -90, -120, -170, 0, -200, 120, -170, 170, -90, 170, 0];
  inkShape(g, hut, '#cfae6a', 4.5, 90); for (let k = -150; k <= 150; k += 30) { g.strokeStyle = rgba(INK, .55); g.lineWidth = 3; g.beginPath(); g.moveTo(k, 0); g.quadraticCurveTo(k * .9, -150, k * .3, -195); g.stroke(); }
  inkShape(g, [-40, 0, -40, -90, 0, -120, 40, -90, 40, 0], '#3a2414', 3.5, 91);
  g.restore();
  for (let i = 0; i < 11; i++) { const x = 1820 + i * 48; limb(g, [x, 990, x + 2, 900], 5, '#9a7444'); }
  limb(g, [1810, 930, 2310, 930], 4, '#9a7444'); limb(g, [1810, 965, 2310, 965], 4, '#9a7444');
  // dirt path
  const pathP = [960, h, 1560, h, 1330, 900, 1250, hz + 205, 1215, hz + 205, 1150, 900];
  inkShape(g, pathP, '#e6cc9c', 0, 95, 3);
  g.save(); pathOf(g, jitter(pathP, 95, 3)); g.clip(); brush(g, 900, hz + 200, 700, h, ['#f3dfb6', '#cfb07a', '#bf9a62'], 300, 96, 40, 3, 10, .2); g.restore();
  brush(g, 0, hz + 200, w, h, ['#e3c58e', '#b98c58', '#a8b05a', '#d4b27a'], 1400, 97, 40, 3, 12, .12);
  for (let i = 0; i < 60; i++) { const x = r() * w, y = hz + 260 + r() * (h - hz - 260); inkEll(g, x, y, 4 + r() * 8, 3 + r() * 4, ['#b8a088', '#9a8670', '#cdb89a'][i % 3], 2); }
  for (let i = 0; i < 50; i++) { const x = r() * w, y = hz + 230 + r() * (h - hz - 230); for (let k = -2; k <= 2; k++) line(g, [x, y, x + k * 5, y - 14 - r() * 10], 2.5, '#6f8a34'); }
});
const MARKET_BACK = () => cached('v2_mback', 1920, 1080, (g, w, h) => {
  g.fillStyle = vgrad(g, 0, h, [[0, '#d7a874'], [1, '#b8854f']]); g.fillRect(0, 0, w, h);
  const r = rng(12);
  for (let y = 0; y < 760; y += 34) for (let x = -((y / 34) % 2) * 40; x < w; x += 80) { g.strokeStyle = rgba(INK, .16); g.lineWidth = 2; g.strokeRect(x, y, 80, 34); }
  brush(g, 0, 0, w, 760, ['#e8c08c', '#b07a46', '#f2d2a2'], 900, 13, 50, 4, 14, .1);
  g.beginPath(); g.roundRect(1560, 230, 210, 530, [105, 105, 0, 0]); g.fillStyle = '#4a2e1a'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  inkShape(g, [230, 300, 330, 300, 330, 380, 230, 380], '#3a2414', 4, 14);
  // awning
  const top = 150, bot = 330;
  for (let i = 0; i < 12; i++) { const x0 = 120 + i * 140; inkShape(g, [x0, top, x0 + 140, top, x0 + 140, bot - 10, x0 + 70, bot + 12, x0, bot - 10], i % 2 ? '#e9dcc0' : '#c4492e', 3.5, 20 + i); }
  limb(g, [130, top, 130, 780], 8, '#7a4f2c'); limb(g, [1790, top, 1790, 780], 8, '#7a4f2c');
  g.fillStyle = vgrad(g, 760, h, [[0, '#c9a26c'], [1, '#a37a48']]); g.fillRect(0, 760, w, h);
  brush(g, 0, 760, w, 320, ['#dcbb86', '#9a7444'], 400, 15, 40, 3, 10, .15);
  // jars
  [[300, 870], [380, 900], [1640, 890]].forEach(([x, y], i) => { inkShape(g, [x - 34, y - 110, x + 34, y - 110, x + 50, y - 60, x + 26, y, x - 26, y, x - 50, y - 60], ['#b8673a', '#a85a30', '#c27a48'][i], 4, 30 + i); inkShape(g, [x - 18, y - 128, x + 18, y - 128, x + 18, y - 108, x - 18, y - 108], '#9a5028', 3, 33 + i); });
});
const MARKET_FRONT = () => cached('v2_mfront', 1920, 1080, (g) => {
  inkShape(g, [180, 650, 1740, 650, 1740, 700, 180, 700], '#8a5a34', 4.5, 40);
  inkShape(g, [200, 700, 1720, 700, 1700, 860, 220, 860], '#c9963f', 4.5, 41);
  g.strokeStyle = rgba(INK, .4); g.lineWidth = 2.5; for (let i = 0; i < 9; i++) { const x = 300 + i * 160; g.beginPath(); g.moveTo(x, 705); g.lineTo(x - 6, 855); g.stroke(); }
  const goods = [[380, '#4a1e0e', 12], [600, '#e2b44a', 6], [1320, '#9a4a6a', 15], [1540, '#9aa8ae', 0]];
  goods.forEach(([x, c, rad], k) => {
    inkEll(g, x, 640, 110, 30, '#a8783e', 4);
    const r = rng(k + 3);
    for (let i = 0; i < 46; i++) { const a = r() * Math.PI, rr2 = r(); const px = x + Math.cos(a) * 95 * rr2, py = 630 - Math.sin(a) * 70 * rr2; if (rad) inkEll(g, px, py, rad, rad * .85, shade(c, (r() - .5) * .3), 2); else inkEll(g, px, py, 30, 9, shade(c, (r() - .5) * .2), 2.2, r() - .5); }
  });
});
function projMap(lon, lat) { const k = 100, c = Math.cos(33 * Math.PI / 180); return [960 + (lon - 44.6) * k * c, 540 - (lat - 33.1) * k]; }
const PLACES = { ur: [46.103, 30.963], uruk: [45.64, 31.32], babylon: [44.421, 32.536], larsa: [45.853, 31.284], eshnunna: [44.727, 33.484], mari: [40.888, 34.549], baghdad: [44.366, 33.315] };
const RIVERS = {
  euphrates: [[38.8, 38.8], [38.3, 37.9], [38.1, 37.0], [38.3, 36.6], [39.0, 35.95], [40.1, 35.3], [41.0, 34.4], [42.4, 34.1], [43.3, 33.42], [43.78, 33.35], [44.3, 32.9], [44.42, 32.5], [44.9, 32.0], [45.3, 31.3], [46.26, 31.05], [47.43, 31.0]],
  tigris: [[40.2, 37.9], [41.2, 37.6], [42.2, 37.3], [42.7, 36.9], [43.13, 36.34], [43.4, 35.5], [43.68, 34.6], [43.87, 34.2], [44.2, 33.7], [44.36, 33.31], [44.8, 33.0], [45.8, 32.5], [46.6, 32.2], [47.15, 31.84], [47.43, 31.0]],
  shatt: [[47.43, 31.0], [47.8, 30.5], [48.3, 30.1], [48.6, 29.9]],
};
const MAPBG = () => cached('v2_map', 1920, 1080, (g, w, h) => {
  g.fillStyle = vgrad(g, 0, h, [[0, '#5a3a22'], [1, '#3a2414']]); g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 135) { g.fillStyle = rgba('#000', .18); g.fillRect(0, y, w, 4); }
  brush(g, 0, 0, w, h, ['#7a5232', '#2a1a0e', '#8a6040'], 1400, 5, 120, 2, 6, .18, 0);
  // parchment
  const P = [230, 95, 1690, 105, 1705, 985, 215, 975];
  g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 40; g.shadowOffsetY = 14; inkShape(g, P, '#ecd8ae', 0, 2, 6); g.restore();
  g.save(); pathOf(g, jitter(P, 2, 6)); g.clip();
  g.fillStyle = '#bcd0cb'; g.fillRect(0, 0, w, h);
  if (GEO) {
    const drawRings = (geom, fn) => { const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates; for (const poly of polys) { g.beginPath(); for (const ring of poly) { ring.forEach(([lo, la], i) => { const [x, y] = projMap(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); } fn(); } };
    for (const f of GEO.countries) drawRings(f.geometry, () => { g.fillStyle = f.id === '368' ? '#eccb8e' : '#e6d0a0'; g.fill('evenodd'); });
    brush(g, 0, 0, w, h, ['#c9a46a', '#f6e6c2', '#b88d58'], 900, 6, 60, 3, 12, .1);
    g.setLineDash([6, 6]); g.lineWidth = 1.6; g.strokeStyle = rgba('#7a5a3a', .55);
    for (const f of GEO.countries) drawRings(f.geometry, () => g.stroke()); g.setLineDash([]);
    g.lineWidth = 2.6; g.strokeStyle = INK; for (const f of GEO.land) drawRings(f.geometry, () => g.stroke());
  }
  for (const k in RIVERS) { const pts = RIVERS[k].flatMap(([lo, la]) => projMap(lo, la)); line(g, pts, 9, rgba(INK, .8)); line(g, pts, 6, '#5d97bd'); line(g, pts, 2, '#a8d2ea'); }
  g.font = '700 34px Cairo'; g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#2f6a92';
  const lab = (s, lo, la, rot) => { const [x, y] = projMap(lo, la); g.save(); g.translate(x, y); g.rotate(rot); g.fillText(s, 0, 0); g.restore(); };
  lab('الفرات', 41.6, 34.65, .3); lab('دجلة', 43.0, 35.6, 1.25); lab('الخليج', 49.6, 28.9, -.5);
  g.strokeStyle = rgba('#7a5a3a', .35); g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(230 + i * 180, 95); g.lineTo(230 + i * 180, 985); g.stroke(); }
  g.restore();
  g.lineWidth = 4; g.strokeStyle = INK; pathOf(g, jitter(P, 2, 6)); g.stroke();
  // compass
  g.save(); g.translate(300, 230); inkEll(g, 0, 0, 120, 120, '#b8873e', 5); inkEll(g, 0, 0, 98, 98, '#f1e4c4', 4);
  for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); inkShape(g, [0, -(i % 2 ? 50 : 86), 12, 0, 0, 10, -12, 0], i % 2 ? '#c9a46a' : (i === 0 ? '#c0392b' : '#5a4a3a'), 2.5, 120 + i, .2); g.restore(); }
  inkEll(g, 0, 0, 10, 10, '#b8873e', 3); g.restore();
  // magnifier
  g.save(); g.translate(1590, 800); g.rotate(.7); limb(g, [0, 120, 0, 290], 26, '#6a3e1e'); inkEll(g, 0, 0, 120, 120, null, 0);
  g.lineWidth = 30; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, 118, 0, TAU); g.stroke(); g.lineWidth = 22; g.strokeStyle = '#b8873e'; g.stroke();
  g.fillStyle = 'rgba(220,240,255,.18)'; circ(g, 0, 0, 104); g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, -40, -46, 30, 14, -.6); g.restore();
  // pencils
  [[140, 700, -.9], [1750, 300, 2.4], [1790, 420, 2.6]].forEach(([x, y, a], i) => { g.save(); g.translate(x, y); g.rotate(a); inkShape(g, [0, -10, 300, -10, 300, 10, 0, 10], ['#c9853a', '#4a6a8a', '#8a4a2a'][i], 3.5, 130 + i, .4); inkShape(g, [300, -10, 340, 0, 300, 10], '#e8cfa0', 3, 140 + i, .2); g.fillStyle = INK; poly(g, [330, -3, 342, 0, 330, 3]); g.restore(); });
});
const BABBG = () => cached('v2_bab', 1920, 1080, (g, w, h) => {
  g.fillStyle = vgrad(g, 0, 700, [[0, '#8fb8d6'], [1, '#f4dcb2']]); g.fillRect(0, 0, w, 720);
  brush(g, 0, 0, w, 600, ['#ffffff', '#f6d2a0'], 300, 21, 70, 4, 16, .08);
  inkShape(g, [380, 760, 1540, 760, 1540, 250, 380, 250], '#cfa476', 5, 22, 1);
  for (let i = 0; i < 18; i++) { const x = 410 + i * 63; inkShape(g, [x, 740, x + 26, 740, x + 26, 290, x, 290], '#b98c5e', 2.5, 23 + i, .6); }
  inkShape(g, [370, 250, 1550, 250, 1550, 222, 370, 222], '#d9b286', 4, 45);
  g.beginPath(); g.roundRect(880, 470, 160, 290, [80, 80, 0, 0]); g.fillStyle = '#4a2e1a'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  [[60, 300, 230], [180, 360, 200], [1600, 330, 210], [1730, 380, 240]].forEach(([x, hh, ww], i) => inkHouse(g, x, 770, ww, hh, ['#d4a878', '#c99c6c'][i % 2], 500 + i));
  g.fillStyle = vgrad(g, 760, h, [[0, '#d9bd8c'], [1, '#b8955f']]); g.fillRect(0, 760, w, h);
  brush(g, 0, 760, w, 320, ['#ecd3a2', '#a88458'], 600, 24, 40, 3, 10, .14);
});
function stele(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,.25)'; ell(g, 0, 0, 170, 22);
  const shp = [-130, 0, -118, -430]; const pts = [-130, 0, 130, 0, 118, -430]; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI; pts.push(Math.cos(a) * 118, -430 - Math.sin(a) * 120); } pts.push(-118, -430);
  inkShape(g, pts, '#34353c', 5, 150, .8);
  g.fillStyle = '#4a4b54'; rr(g, 10, -500, 60, 110, 14); circ(g, 40, -520, 22); g.fillRect(-10, -400, 95, 14); rr(g, -86, -520, 40, 130, 12); circ(g, -66, -540, 19);
  g.strokeStyle = 'rgba(110,112,124,.8)'; g.lineWidth = 2; for (let c = 0; c < 5; c++) for (let rr2 = 0; rr2 < 22; rr2++) { const lx = -104 + c * 44, ly = -360 + rr2 * 15.5, lw = 24 + ((c * 7 + rr2 * 13) % 12); g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + lw, ly); g.stroke(); }
  g.restore();
}
function scaleV2(g, x, y, tilt, nSilver, t) {
  g.save(); g.translate(x, y);
  limb(g, [0, 0, 0, 300], 12, '#7a4f2c'); inkEll(g, 0, 300, 60, 14, '#6a4226', 4);
  g.rotate(tilt); limb(g, [-260, 0, 260, 0], 12, '#d0a24e');
  for (const sgn of [-1, 1]) {
    g.save(); g.translate(sgn * 250, 0); g.rotate(-tilt);
    line(g, [0, 0, -70, 180], 3, INK); line(g, [0, 0, 70, 180], 3, INK);
    g.beginPath(); g.ellipse(0, 184, 100, 26, 0, 0, Math.PI); g.closePath(); g.fillStyle = '#c08a3c'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    if (sgn < 0) { inkEll(g, 0, 166, 38, 21, '#4a4a52', 3.5); inkEll(g, 32, 150, 13, 11, '#4a4a52', 3); inkEll(g, 44, 152, 9, 3, '#2a2a30', 2); }
    else { const r = rng(8); for (let i = 0; i < nSilver; i++) { g.save(); g.translate(-55 + r() * 110, 172 - (i % 4) * 7); g.rotate(r() * 3); inkShape(g, [-11, -6, 11, -6, 11, 6, -11, 6], '#e8ecf2', 2.5, 160 + i, .4); g.restore(); } }
    g.restore();
  }
  inkEll(g, 0, 0, 15, 15, '#e0b55a', 3.5); g.restore();
}

// ---------- scenes ----------
function cam(g, sx, cx, cy) { g.translate(W / 2, H / 2); g.scale(sx, sx); g.translate(-cx, -cy); }
function v2Scene(g, t) {
  if (t < 10.6) {
    const s1 = t < 6;
    const sc = s1 ? lerp(.8, .88, eio(t / 6)) : lerp(1.08, 1.14, (t - 6) / 4.6);
    const cx = s1 ? lerp(1200, 1230, t / 6) : 1260, cy = s1 ? lerp(675, 760, eio(t / 6)) : 930;
    g.save(); cam(g, sc, cx, cy); g.drawImage(URBG(), 0, 0);
    sheep(g, 1560, 1040, 1.1, t, true, 1); sheep(g, 1680, 1090, 1.2, t, false, 2); sheep(g, 820, 1060, 1.1, t, false, 3);
    if (s1) {
      const p = popS(t, 1.6); stick(g, 1180, 1200, 1.3 * p, { kind: 'ali', t, look: Math.sin(t * 1.6) * .8, expr: 'surprise', seed: 1 });
    } else {
      const lt = t - 6, mx = lerp(1720, 1430, eo(lt / 1.1));
      stick(g, 1060, 1200, 1.3, { kind: 'ali', t, look: .8, expr: 'confused', sweat: lt > 1.6, scratch: lt > 1.4 && lt < 4.4, mouth: (t > 7.4 && t < 10.5) ? Math.abs(Math.sin(t * 9)) * .7 : 0, seed: 1 });
      stick(g, mx, 1200, 1.3, { kind: 'sumer', t, flip: true, walk: lt < 1.1 ? lt * 9 : 0, wave: lt > 1 && lt < 2.6, expr: 'smile', seed: 2 });
      inkBubble(g, mx - 30, 830, 'سِلِم-ما!', popS(t, 6.9, .35) * (1 - ss(8.4, 8.7, t)), -1);
    }
    g.restore();
    headline(g, HW('قبل «٤٠٠٠» سنة…'), t, .3, 2.8);
    headline(g, HW('إنت هسّه بين «السومريين»!'), t, 2.9, 6.0);
    headline(g, HW('لغة ما إلها !قريب بالعالم…'), t, 6.15, 10.55);
  } else if (t < 19) {
    const lt = t - 10.6, sc = lerp(1, 1.06, lt / 8.4);
    g.save(); cam(g, sc, 960, 560);
    g.drawImage(MARKET_BACK(), 0, 0);
    stick(g, 560, 700, 1.25 * popS(t, 10.7), { kind: 'merchant', t, expr: 'sly', seed: 3, point: lt > 1 && lt < 3 });
    const n = Math.min(12, Math.max(0, Math.floor((t - 11.4) * 6)));
    const tilt = -.16 + n * .022 + Math.sin(t * 6) * .02 * (n < 12 ? 1 : .2);
    scaleV2(g, 960, 330, tilt, n, t);
    if (t > 11.4 && n < 12) { const k = (t - 11.4) * 6 % 1; g.save(); g.translate(960 + 250 * Math.cos(tilt), 330 + 250 * Math.sin(tilt) + lerp(-200, 160, k)); inkShape(g, [-11, -6, 11, -6, 11, 6, -11, 6], '#e8ecf2', 2.5, 170, .4); g.restore(); }
    g.drawImage(MARKET_FRONT(), 0, 0);
    stick(g, 1400, 1040, 1.35 * popS(t, 10.9), { kind: 'ali', t, look: -.8, expr: lt > 3.5 ? 'surprise' : 'smile', seed: 1 });
    g.restore();
    headline(g, HW('ماكو !عملة… الفضة «توزن»!'), t, 10.8, 14.2);
    headline(g, HW('وحدة الوزن: «الشيقل» ≈ ٨ غرام'), t, 14.3, 19.0);
  } else if (t < 28) {
    const lt = t - 19, [bx, by] = projMap(...PLACES.babylon);
    const sc = lerp(1.0, 1.32, eio(lt / 9)), cx = lerp(960, bx - 40, eio(lt / 9)), cy = lerp(540, by + 40, eio(lt / 9));
    g.save(); cam(g, sc, cx, cy); g.drawImage(MAPBG(), 0, 0);
    const P = k => projMap(...PLACES[k]);
    const [ux, uy] = P('ur'), [rx, ry] = P('uruk');
    pin(g, ux, uy, t, 19.3, .8); tag(g, ux + 70, uy + 50, 'أور', t, 19.45, .04);
    pin(g, rx, ry, t, 19.9, .6); tag(g, rx + 75, ry - 30, 'أوروك', t, 20.0, -.04, 26);
    arrow(g, ux, uy, bx, by, t, 21.6, .9, -.25);
    pin(g, bx, by, t, 22.5, 1.0); tag(g, bx - 90, by - 40, 'بابل', t, 22.65, -.05, 40);
    [['eshnunna', 'إشنونا', 24.3, .25, [70, -40]], ['larsa', 'لارسا', 24.9, .3, [80, 10]], ['mari', 'ماري', 25.5, .18, [0, -55]]].forEach(([k, nm, t0, bend, [ox, oy]]) => { const [x, y] = P(k); arrow(g, bx, by, x, y, t, t0, .7, bend); pin(g, x, y, t, t0 + .65, .6); tag(g, x + ox, y + oy, nm, t, t0 + .75, .03, 28); });
    const [gx, gy] = P('baghdad'); const pg = popS(t, 26.6, .35); if (pg > 0) { g.save(); g.globalAlpha = .85; inkEll(g, gx, gy, 9 * pg, 9 * pg, '#7a7a80', 3); g.restore(); tag(g, gx - 95, gy - 18, 'بغداد اليوم', t, 26.7, -.03, 24); }
    g.restore();
    headline(g, HW('تمشي «٣٠٠» سنة… وتطلع «بابل»'), t, 19.2, 23.9);
    headline(g, HW('حمورابي !يوحّد بلاد الرافدين'), t, 24.0, 28.0);
  } else {
    const lt = t - 28, sc = lerp(1, 1.05, lt / 9);
    g.save(); cam(g, sc, 960, 560); g.drawImage(BABBG(), 0, 0);
    const sp = popS(t, 28.15, .45); if (sp > 0) stele(g, 960, 900, 1.15 * sp);
    const r = rng(21); const crowd = [];
    for (let i = 0; i < 16; i++) crowd.push([180 + r() * 1560, 940 + r() * 120, .85 + r() * .2, 29 + i * .26, r() > .5]);
    crowd.sort((a, b) => a[1] - b[1]).forEach(([x, y, s, t0, fl], i) => { if (Math.abs(x - 960) < 170) x += x < 960 ? -190 : 190; stick(g, x, y, s * popS(t, t0, .35), { kind: i % 3 === 0 ? 'merchant' : i % 3 === 1 ? 'bab' : 'sumer', colors: { top: ['#2f5a9a', '#8a3a2a', '#5a6a2a', '#7a4a8a'][i % 4], skirt: ['#2f5a9a', '#8a3a2a', '#5a6a2a', '#7a4a8a'][i % 4] }, t, flip: fl, armsUp: t > 32.2 && (i % 2 === 0), expr: 'smile', seed: i + 5 }); });
    g.restore();
    const cnt = Math.round(282 * eo((t - 28.4) / 3.0));
    if (t > 28.3) {
      const a = 1 - ss(36.0, 36.4, t), p = popS(t, 28.3, .35);
      g.save(); g.globalAlpha = a; g.translate(W / 2, 120); g.scale(.6 + .4 * p, .6 + .4 * p);
      g.font = '800 92px Cairo'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const s = AR(Math.max(0, cnt)) + ' مادة قانونية'; g.lineWidth = 15; g.strokeStyle = '#150d07'; g.strokeText(s, 0, 0); g.fillStyle = '#ffffff'; g.fillText(s, 0, 0);
      g.font = '800 44px Cairo'; g.lineWidth = 10; g.strokeText('بشريعة حمورابي', 0, 76); g.fillStyle = '#ffd23a'; g.fillText('بشريعة حمورابي', 0, 76);
      g.restore();
    }
    headline(g, HW('«حتى» القوي ما يظلم !الضعيف'), t, 32.3, 36.4, 990, 58, 11);
  }
}
function renderV2(t) {
  const g = X2; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save(); v2Scene(g, t); g.restore();
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = .22; g.drawImage(TEX, 0, 0, W, H); g.restore();
  const v = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,15,5,.35)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  if (t > 36.2) { g.fillStyle = rgba('#000', ss(36.2, 37, t)); g.fillRect(0, 0, W, H); }
  for (const c of [6.0, 10.6, 19.0, 28.0]) { const d = Math.abs(t - c); if (d < .08) { g.fillStyle = rgba('#fff', (1 - d / .08) * .25); g.fillRect(0, 0, W, H); } }
}
window.renderV2 = renderV2;
window.readyV2 = (async () => {
  await window.ready;
  const topo = await (await fetch('node_modules/world-atlas/countries-50m.json')).json();
  const land = await (await fetch('node_modules/world-atlas/land-50m.json')).json();
  const box = f => { const c = []; (function walk(a) { if (typeof a[0] === 'number') c.push(a); else a.forEach(walk); })(f.geometry.coordinates); return c.some(([lo, la]) => lo > 30 && lo < 60 && la > 22 && la < 42); };
  GEO = { countries: topojson.feature(topo, topo.objects.countries).features.filter(box), land: topojson.feature(land, land.objects.land).features };
  URBG(); MARKET_BACK(); MARKET_FRONT(); MAPBG(); BABBG();
  return true;
})();
