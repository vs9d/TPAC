// Mesopotamia time-travel motion film — deterministic canvas renderer.
// renderFrame(t) draws the frame at time t (seconds).
const C = document.getElementById('c'), G = C.getContext('2d');
const W = 1920, H = 1080, DURATION = 190;

// ---------- utils ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, t) => { t = clamp((t - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => (t = clamp(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const TAU = Math.PI * 2;
function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(c, a = 1) { const [r, g, b] = typeof c === 'string' ? hex(c) : c; return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function mixc(c1, c2, t) { const a = hex(c1), b = hex(c2); return rgba([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]); }
function shade(c, k) { const a = hex(c); return rgba(a.map(v => k < 0 ? v * (1 + k) : v + (255 - v) * k)); }
function off(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
const cache = {};
function cached(key, w, h, fn) { return cache[key] || (cache[key] = off(w, h, fn)); }

function vgrad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function sky(g, stops) { g.fillStyle = vgrad(g, 0, H, stops); g.fillRect(0, 0, W, H); }
function glow(g, x, y, r, c, a = 1) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); g.fill(); }
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.abs(r), 0, TAU); g.fill(); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function line(g, pts, w, c, cap = 'round') { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineWidth = w; g.strokeStyle = c; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); }
function quad(g, x0, y0, cx, cy, x1, y1, w, c) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.lineWidth = w; g.strokeStyle = c; g.lineCap = 'round'; g.stroke(); }
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }

// ---------- global FX ----------
const DUST = (() => { const r = rng(7); return Array.from({ length: 160 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 3.5, v: 6 + r() * 22, p: r() * TAU, a: .15 + r() * .5 })); })();
function dust(g, t, c = '#ffe2a8', amt = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const d of DUST) {
    const x = (d.x + t * d.v * 1.6) % (W + 40) - 20, y = (d.y - t * d.v * .35 + Math.sin(t * .7 + d.p) * 18 + H) % H;
    g.fillStyle = rgba(c, d.a * amt * (.6 + .4 * Math.sin(t * 2 + d.p))); circ(g, x, y, d.s);
  }
  g.restore();
}
function rays(g, x, y, t, c = '#ffd9a0', a = .12, n = 9) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * .5 + (i - n / 2) * .16 + Math.sin(t * .3 + i) * .03, len = 1700, wd = .035 + (i % 3) * .015;
    const gr = g.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang - wd) * len, y + Math.sin(ang - wd) * len); g.lineTo(x + Math.cos(ang + wd) * len, y + Math.sin(ang + wd) * len); g.closePath(); g.fill();
  }
  g.restore();
}
const GRAIN = Array.from({ length: 4 }, (_, k) => off(480, 270, (g, w, h) => { const im = g.createImageData(w, h), r = rng(100 + k); for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }));
function post(g, t, fi) {
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .045; g.globalCompositeOperation = 'overlay'; g.imageSmoothingEnabled = false; g.drawImage(GRAIN[fi % 4], 0, 0, W, H); g.restore();
  g.fillStyle = '#000'; g.fillRect(0, 0, W, 54); g.fillRect(0, H - 54, W, 54);
}

// ---------- characters ----------
const SKIN = '#c68a5c', HAIR = '#17110e', OLIVE = '#5f6d3a', OLIVE_D = '#47532a', JEANS = '#27365a';
function ali(g, x, y, s, o = {}) {
  const view = o.view || 'front', w = o.walk || 0, up = o.armUp || 0, look = o.look || 0, mouth = o.mouth || 0, sit = o.sit || 0;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s);
  const bob = Math.abs(Math.sin(w)) * -3; g.translate(0, bob);
  // legs
  const la = Math.sin(w) * .35, ra = -la;
  if (sit) {
    g.fillStyle = JEANS; rr(g, -18, -92, 16, 40, 6); rr(g, 2, -92, 16, 40, 6);
    rr(g, -20, -60, 16, 50, 6); rr(g, 4, -60, 16, 50, 6);
    g.fillStyle = '#f4f4f0'; ell(g, -12, -8, 13, 7); ell(g, 12, -8, 13, 7);
  } else {
    for (const [px, a] of [[-10, la], [10, ra]]) {
      g.save(); g.translate(px, -88); g.rotate(a); g.fillStyle = JEANS; rr(g, -8, 0, 16, 82, 6);
      g.fillStyle = '#f4f4f0'; ell(g, px < 0 ? -3 : 3, 84, 13, 7); g.fillStyle = '#d9d9d2'; g.fillRect(-12, 86, 24, 3); g.restore();
    }
  }
  // hood behind
  g.fillStyle = OLIVE_D; ell(g, 0, -158, 27, 12);
  // torso
  g.fillStyle = OLIVE; rr(g, -33, -162, 66, 80, 16);
  g.fillStyle = OLIVE_D; rr(g, -33, -94, 66, 12, 5);
  if (view === 'front') {
    g.fillStyle = '#f3f1ea'; poly(g, [-10, -158, 10, -158, 8, -86, -8, -86]);
    g.strokeStyle = OLIVE_D; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-10, -158); g.lineTo(-8, -86); g.moveTo(10, -158); g.lineTo(8, -86); g.stroke();
    g.fillStyle = '#e8e4d8'; ell(g, -13, -150, 2, 9); ell(g, 13, -150, 2, 9);
  } else {
    g.fillStyle = OLIVE_D; ell(g, 0, -150, 22, 14);
  }
  // arms
  const sw = Math.sin(w) * 10;
  line(g, [-31, -150, -38 - sw * .2, -118, -36 + sw * .3, -92], 17, OLIVE);
  g.fillStyle = SKIN; circ(g, -36 + sw * .3, -88, 8);
  g.fillStyle = '#111'; g.fillRect(-44 + sw * .3, -100, 15, 7);
  if (up > 0) {
    const ex = lerp(38, 50, up), ey = lerp(-118, -182, up), hx = lerp(36, 22, up), hy = lerp(-92, -212, up);
    line(g, [31, -150, ex, ey, hx, hy], 17, OLIVE); g.fillStyle = SKIN; circ(g, hx, hy, 8);
  } else {
    line(g, [31, -150, 38 + sw * .2, -118, 36 - sw * .3, -92], 17, OLIVE); g.fillStyle = SKIN; circ(g, 36 - sw * .3, -88, 8);
  }
  if (o.phone) { g.fillStyle = '#0d0d10'; rr(g, -14, -120, 28, 48, 5); g.fillStyle = rgba('#9fd0ff', .9); rr(g, -11, -116, 22, 40, 3); g.fillStyle = SKIN; circ(g, -14, -96, 8); circ(g, 14, -96, 8); }
  // neck + head
  g.fillStyle = shade(SKIN, -.12); g.fillRect(-7, -172, 14, 14);
  g.fillStyle = SKIN; ell(g, 0, -192, 23, 26);
  circ(g, -23, -190, 5.5); circ(g, 23, -190, 5.5);
  if (view === 'front') {
    g.fillStyle = rgba('#3a2418', .13); ell(g, 0, -178, 18, 12);
    g.fillStyle = '#fff'; ell(g, -8.5 + look * 1.5, -192, 5.6, 5); ell(g, 8.5 + look * 1.5, -192, 5.6, 5);
    g.fillStyle = '#3b2212'; circ(g, -8.5 + look * 3, -191.5, 3.4); circ(g, 8.5 + look * 3, -191.5, 3.4);
    g.fillStyle = '#fff'; circ(g, -7.5 + look * 3, -193, 1.1); circ(g, 9.5 + look * 3, -193, 1.1);
    line(g, [-14, -201 - (o.brow || 0), -4, -202 - (o.brow || 0)], 3.2, HAIR); line(g, [4, -202 - (o.brow || 0), 14, -201 - (o.brow || 0)], 3.2, HAIR);
    g.fillStyle = shade(SKIN, -.18); ell(g, 0, -184, 3, 2.2);
    if (mouth > .05) { g.fillStyle = '#5a2a1e'; ell(g, 0, -175, 6, 1.5 + 4 * mouth); }
    else { g.beginPath(); g.arc(0, -180, 7, .25 * Math.PI, .75 * Math.PI); g.strokeStyle = '#6b3424'; g.lineWidth = 2.4; g.stroke(); }
    if (o.tear) { g.fillStyle = rgba('#cfe8ff', .9 * o.tear); ell(g, -12, -184 + o.tear * 6, 1.8, 3); }
  }
  // hair (curly)
  g.fillStyle = HAIR;
  const hr = view === 'back' ? [150, 390] : [195, 345];
  for (let a = hr[0]; a <= hr[1]; a += 17) { const r = a * Math.PI / 180; circ(g, Math.cos(r) * 21, -196 + Math.sin(r) * 22, 9.5); }
  ell(g, 0, -208, 21, 11);
  if (view === 'back') ell(g, 0, -193, 22, 22);
  g.restore();
}
function luNanna(g, x, y, s, o = {}) {
  const w = o.walk || 0, look = o.look || 0;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s); g.translate(0, Math.abs(Math.sin(w)) * -3);
  const la = Math.sin(w) * .35;
  g.fillStyle = shade(SKIN, -.05);
  for (const [px, a] of [[-7, la], [7, -la]]) { g.save(); g.translate(px, -52); g.rotate(a); rr(g, -5, 0, 10, 52, 4); ell(g, 0, 52, 8, 4); g.restore(); }
  g.fillStyle = '#ece3cc'; poly(g, [-22, -92, 22, -92, 26, -46, -26, -46]);
  g.strokeStyle = '#cbbd98'; g.lineWidth = 1.5; for (let i = -24; i <= 24; i += 4) { g.beginPath(); g.moveTo(i, -48); g.lineTo(i * 1.04, -40); g.stroke(); }
  g.fillStyle = SKIN; rr(g, -19, -128, 38, 40, 12);
  const ar = o.wave ? Math.sin(o.wave * 9) * .4 - 1.9 : 0;
  line(g, [-18, -122, -24, -100, -22, -80], 9, SKIN);
  if (o.point) line(g, [18, -122, 34, -140, 44, -160], 9, SKIN);
  else if (o.wave) { g.save(); g.translate(18, -122); g.rotate(ar); line(g, [0, 0, 0, 22, 0, 40], 9, SKIN); g.restore(); }
  else line(g, [18, -122, 24, -100, 22, -80], 9, SKIN);
  g.fillStyle = shade(SKIN, -.1); g.fillRect(-5, -136, 10, 10);
  g.fillStyle = SKIN; ell(g, 0, -152, 19, 20);
  g.fillStyle = rgba('#3a2418', .25); ell(g, 0, -162, 17, 9); g.fillStyle = HAIR; circ(g, 0, -172, 4.5);
  g.fillStyle = '#fff'; ell(g, -7 + look, -152, 5, 5.2); ell(g, 7 + look, -152, 5, 5.2);
  g.fillStyle = '#2a170c'; circ(g, -7 + look * 2.5, -151.5, 3.3); circ(g, 7 + look * 2.5, -151.5, 3.3);
  g.fillStyle = '#fff'; circ(g, -6 + look * 2.5, -153, 1.1); circ(g, 8 + look * 2.5, -153, 1.1);
  g.beginPath(); g.arc(0, -142, 6.5, .15 * Math.PI, .85 * Math.PI); g.strokeStyle = '#6b3424'; g.lineWidth = 2.2; g.stroke();
  g.fillStyle = '#b89464'; rr(g, 12, -100, 16, 20, 3);
  g.restore();
}
function nupta(g, x, y, s, o = {}) {
  const look = o.look || 0;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s);
  g.fillStyle = '#8a6a4a'; ell(g, -9, -3, 10, 4); ell(g, 9, -3, 10, 4);
  g.fillStyle = '#9b3d25'; poly(g, [-26, -150, 26, -150, 40, -6, -40, -6]);
  g.fillStyle = '#d9a441'; g.fillRect(-40, -14, 80, 5);
  g.strokeStyle = '#d9a441'; g.lineWidth = 1.5; for (let i = -38; i <= 38; i += 5) { g.beginPath(); g.moveTo(i, -9); g.lineTo(i, -2); g.stroke(); }
  g.fillStyle = '#7a2c18'; poly(g, [-28, -150, 10, -150, 34, -60, 18, -56]);
  line(g, [-25, -146, -32, -110, -28, -86], 12, '#9b3d25'); line(g, [25, -146, 32, -110, 28, -86], 12, '#9b3d25');
  g.fillStyle = SKIN; circ(g, -28, -82, 6.5); circ(g, 28, -82, 6.5);
  g.fillStyle = '#b08d57'; g.fillRect(-33, -96, 10, 4); g.fillRect(23, -96, 10, 4);
  g.fillStyle = shade(SKIN, -.1); g.fillRect(-6, -162, 12, 12);
  ['#2456b5', '#c0392b', '#2456b5', '#c0392b', '#2456b5', '#c0392b', '#2456b5'].forEach((c, i) => { g.fillStyle = c; circ(g, -12 + i * 4, -150 + Math.sin(i / 6 * Math.PI) * 6, 2.6); });
  g.fillStyle = HAIR; ell(g, 0, -184, 23, 25);
  g.fillStyle = SKIN; ell(g, 0, -180, 19.5, 22);
  g.fillStyle = HAIR; ell(g, 0, -199, 20, 8);
  g.fillStyle = '#d9a441'; g.fillRect(-21, -196, 42, 5);
  g.fillStyle = HAIR; for (let i = 0; i < 6; i++) circ(g, 20 + Math.sin(i) * 2, -168 + i * 11, 5.5);
  g.fillStyle = '#fff'; ell(g, -7.5 + look, -180, 5, 4.6); ell(g, 7.5 + look, -180, 5, 4.6);
  g.fillStyle = '#2a170c'; circ(g, -7.5 + look * 2.5, -179.5, 3.2); circ(g, 7.5 + look * 2.5, -179.5, 3.2);
  g.fillStyle = '#fff'; circ(g, -6.5 + look * 2.5, -181, 1); circ(g, 8.5 + look * 2.5, -181, 1);
  line(g, [-12, -188, -4, -189], 2.4, HAIR); line(g, [4, -189, 12, -188], 2.4, HAIR);
  g.beginPath(); g.arc(0, -170, 6, .2 * Math.PI, .8 * Math.PI); g.strokeStyle = '#7a2c22'; g.lineWidth = 2.2; g.stroke();
  g.restore();
}
// generic background person (robe), side-ish
function person(g, x, y, s, c, o = {}) {
  const ph = o.ph || 0, bob = Math.abs(Math.sin(ph)) * 2;
  g.save(); g.translate(x, y - bob * s); g.scale(s * (o.flip ? -1 : 1), s);
  g.fillStyle = c;
  poly(g, [-14, -110, 14, -110, 22, 0, -22, 0]);
  rr(g, -15, -124, 30, 22, 9);
  circ(g, 0, -138, 12);
  if (o.beard) ell(g, 4, -126, 8, 9);
  if (o.cap) { rr(g, -12, -158, 24, 12, 4); }
  if (o.bald) { }
  if (o.jar) { ell(g, 14, -160, 11, 13); g.fillRect(9, -175, 10, 6); }
  if (o.arm) line(g, [10, -118, 26, -132, 30, -150], 7, c);
  if (o.staff) line(g, [16, -116, 22, 0], 3, c);
  if (o.sack) ell(g, -12, -128, 16, 13);
  g.restore();
}
function donkey(g, x, y, s, c, ph = 0) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = c;
  ell(g, 0, -48, 34, 16); ell(g, 34, -66, 9, 18, -.6); ell(g, 44, -76, 12, 7, .3);
  poly(g, [36, -86, 40, -102, 43, -86]); poly(g, [30, -86, 32, -102, 36, -86]);
  for (const [lx, a] of [[-22, Math.sin(ph) * .3], [-12, -Math.sin(ph) * .3], [16, -Math.sin(ph) * .3], [26, Math.sin(ph) * .3]]) { g.save(); g.translate(lx, -40); g.rotate(a); g.fillRect(-3, 0, 6, 40); g.restore(); }
  line(g, [-34, -52, -42, -30], 3, c);
  g.fillStyle = shade(c, -.25); ell(g, -6, -66, 18, 9);
  g.restore();
}

// ---------- props & environments ----------
function palm(g, x, y, s, t, c = '#1f3b1c', trunk = '#5a4126') {
  g.save(); g.translate(x, y); g.scale(s, s);
  const sw = Math.sin(t * .9 + x) * 6;
  quad(g, 0, 0, 10, -120, sw, -240, 12, trunk);
  g.strokeStyle = shade(trunk, -.3); g.lineWidth = 2; for (let i = 1; i < 12; i++) { const k = i / 12, px = lerp(0, sw, k * k) + 10 * 2 * k * (1 - k), py = -240 * k; g.beginPath(); g.moveTo(px - 6, py); g.lineTo(px + 6, py - 3); g.stroke(); }
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * .32 + Math.sin(t * 1.3 + i) * .04, L = 95 + (i % 3) * 18;
    const ex = sw + Math.cos(a) * L, ey = -240 + Math.sin(a) * L * .55 + Math.abs(i - 5) * 9;
    quad(g, sw, -240, sw + Math.cos(a) * L * .5, -240 + Math.sin(a) * L * .6 - 22, ex, ey, 7, c);
    for (let k = .3; k < 1; k += .14) { const px = lerp(sw, ex, k), py = lerp(-240 - 10, ey, k) - 14 * Math.sin(k * Math.PI); line(g, [px, py, px + Math.cos(a + .9) * 16, py + 14], 3, c); line(g, [px, py, px + Math.cos(a - .9) * 16, py + 14], 3, c); }
  }
  g.fillStyle = '#7a3e1c'; circ(g, sw - 6, -232, 5); circ(g, sw + 5, -230, 5);
  g.restore();
}
function house(g, x, y, w, h, base, seed = 1, o = {}) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(x, y - h, w, h);
  g.fillStyle = shade(base, .12); g.fillRect(x, y - h, w * .07, h);
  g.fillStyle = shade(base, -.12); g.fillRect(x - 3, y - h - 7, w + 6, 9);
  g.fillStyle = shade(base, -.45);
  if (!o.noDoor) { const dw = Math.min(34, w * .2), dx = x + w * (.2 + r() * .5); g.beginPath(); g.roundRect(dx, y - h * .42, dw, h * .42, [dw / 2, dw / 2, 0, 0]); g.fill(); }
  const nw = 1 + (r() * 3 | 0); for (let i = 0; i < nw; i++) g.fillRect(x + w * (.12 + r() * .7), y - h * (.72 + r() * .12), 10, 12);
  g.strokeStyle = rgba('#000', .07); g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { const yy = y - r() * h; g.beginPath(); g.moveTo(x + r() * w * .5, yy); g.lineTo(x + w * (.5 + r() * .5), yy); g.stroke(); }
  if (o.beam) { g.fillStyle = shade(base, -.35); for (let i = 0; i < 4; i++) g.fillRect(x + 8 + i * (w - 16) / 3, y - h + 4, 5, 6); }
}
function zigUr(g, cx, gy, w, h, col) {
  const { front = '#b9805a', side = '#8d5a3c', top = '#d29a6c', stair = '#9b6644', shrine = '#a06a48' } = col;
  const T = [[w, w * .8, h * .42], [w * .6, w * .52, h * .25], [w * .36, w * .31, h * .16]];
  let y = gy;
  T.forEach(([bw, tw, th], i) => {
    g.fillStyle = front; poly(g, [cx - bw / 2, y, cx + bw / 2, y, cx + tw / 2, y - th, cx - tw / 2, y - th]);
    g.fillStyle = side; poly(g, [cx + bw / 2, y, cx + bw / 2 + w * .02, y - 4, cx + tw / 2 + w * .02, y - th - 4, cx + tw / 2, y - th]);
    g.fillStyle = top; g.fillRect(cx - tw / 2, y - th - 5, tw, 6);
    g.fillStyle = rgba('#000', .1); for (let k = 1; k < 9; k++) { const fx = cx - bw / 2 + bw * k / 9; g.fillRect(fx - 3, y - th * .96, 6, th * .96); }
    y -= th;
  });
  g.fillStyle = shrine; g.fillRect(cx - w * .1, y - h * .12, w * .2, h * .12); g.fillStyle = shade(shrine, -.4); g.fillRect(cx - w * .02, y - h * .07, w * .04, h * .07);
  g.fillStyle = top; g.fillRect(cx - w * .11, y - h * .125, w * .22, 5);
  // stairs
  g.fillStyle = stair; poly(g, [cx - w * .045, gy, cx + w * .045, gy, cx + w * .03, gy - h * .67, cx - w * .03, gy - h * .67]);
  g.strokeStyle = rgba('#000', .18); g.lineWidth = 1.4; for (let k = 0; k < 30; k++) { const yy = gy - h * .67 * k / 30, hw = lerp(w * .045, w * .03, k / 30); g.beginPath(); g.moveTo(cx - hw, yy); g.lineTo(cx + hw, yy); g.stroke(); }
  for (const sgn of [-1, 1]) { g.fillStyle = stair; poly(g, [cx + sgn * w * .47, gy, cx + sgn * w * .4, gy, cx + sgn * w * .045, gy - h * .42, cx + sgn * w * .09, gy - h * .42]); }
  g.fillStyle = shade(shrine, -.2); g.fillRect(cx - w * .05, gy - h * .46, w * .1, h * .06);
}
function zigBab(g, cx, gy, w, h, c = '#b08a60', topC = '#1f4fa8') {
  let y = gy; const n = 7;
  for (let i = 0; i < n; i++) { const k = i / n, bw = w * (1 - k * .82), th = h / n * (i === n - 1 ? .9 : 1); g.fillStyle = shade(c, -i * .03); g.fillRect(cx - bw / 2, y - th, bw, th); g.fillStyle = rgba('#000', .12); g.fillRect(cx + bw / 2 - bw * .12, y - th, bw * .12, th); g.fillStyle = shade(c, .15); g.fillRect(cx - bw / 2, y - th, bw, 3); y -= th; }
  g.fillStyle = topC; g.fillRect(cx - w * .08, y - h * .1, w * .16, h * .1);
  g.fillStyle = '#d9a441'; g.fillRect(cx - w * .085, y - h * .1, w * .17, 4);
  g.fillStyle = shade(c, -.1); poly(g, [cx - w * .04, gy, cx + w * .04, gy, cx + w * .02, gy - h * .45, cx - w * .02, gy - h * .45]);
}
function water(g, y0, y1, t, c1, c2, hl = '#ffe9b0', speed = 1) {
  g.fillStyle = vgrad(g, y0, y1, [[0, c1], [1, c2]]); g.fillRect(0, y0, W, y1 - y0);
  const r = rng(33); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) { const yy = y0 + (y1 - y0) * Math.pow(r(), 1.3), len = 20 + r() * 90 * (yy - y0) / (y1 - y0 + 1), x = (r() * W + t * 30 * speed * (1 + r())) % (W + 200) - 100; g.fillStyle = rgba(hl, .12 + .2 * Math.abs(Math.sin(t * 2 + i))); g.fillRect(x, yy, len, 2); }
  g.restore();
}
function reedBoat(g, x, y, s, t, c = '#1d1510') {
  g.save(); g.translate(x, y + Math.sin(t * 2) * 3); g.scale(s, s); g.fillStyle = c;
  g.beginPath(); g.moveTo(-120, -50); g.quadraticCurveTo(-100, 0, 0, 2); g.quadraticCurveTo(100, 0, 120, -50); g.quadraticCurveTo(95, -14, 0, -14); g.quadraticCurveTo(-95, -14, -120, -50); g.fill();
  person(g, 10, -10, .7, c, { ph: 0, arm: 1 }); line(g, [30, -100, 70, 20], 4, c);
  g.restore();
}
function cylSeal(g, x, y, s, glowA, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (glowA > 0) glow(g, 0, 0, 260, '#ffcc66', .35 * glowA);
  g.fillStyle = '#7a3f24'; rr(g, -110, -42, 220, 84, 40);
  g.fillStyle = vgrad(g, -42, 42, [[0, '#b26a42'], [.45, '#8f4f2e'], [1, '#4e2615']]); rr(g, -110, -42, 220, 84, 40);
  g.fillStyle = '#5a2d18'; ell(g, 110 - 6, 0, 14, 40); g.fillStyle = '#2a1209'; ell(g, 108, 0, 5, 9);
  g.strokeStyle = rgba('#3b1a0c', .6); g.lineWidth = 3;
  [[-80, -20, -60, 20], [-40, -25, -40, 25], [-20, -10, 10, -10], [30, -28, 50, 0], [50, 0, 70, -24], [-70, 0, -50, -8]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  if (glowA > 0) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = '#7fc8ff'; g.shadowBlur = 25;
    const cr = [[-95, -10, -70, 5, -60, -18, -30, 2], [-10, 30, 10, 12, 35, 20, 60, 6], [20, -35, 30, -15, 55, -22, 85, -8]];
    cr.forEach((p, i) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]); g.strokeStyle = rgba(i % 2 ? '#7fc8ff' : '#ffd36b', glowA * (.7 + .3 * Math.sin(t * 13 + i))); g.lineWidth = 4; g.stroke(); });
    g.restore();
  }
  g.restore();
}
function tablet(g, x, y, s, base = '#c8a273', o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(o.rot || 0);
  g.fillStyle = rgba('#000', .35); rr(g, -205, -145, 420, 310, 60);
  g.fillStyle = vgrad(g, -150, 150, [[0, shade(base, .15)], [1, shade(base, -.2)]]); rr(g, -210, -155, 420, 310, 60);
  const r = rng(5); g.fillStyle = rgba('#5a3a1e', .08); for (let i = 0; i < 260; i++) circ(g, -200 + r() * 400, -145 + r() * 290, 1 + r() * 3);
  g.restore();
}
// cuneiform wedge pressed at (x,y), size s, ang
function wedge(g, x, y, s, ang, a = 1, base = '#c8a273') {
  g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = a;
  g.fillStyle = shade(base, -.55); poly(g, [0, -s * .3, 0, s * .3, s * .55, 0]);
  g.fillStyle = shade(base, -.3); poly(g, [0, 0, 0, s * .3, s * .55, 0]);
  g.fillStyle = shade(base, -.45); g.fillRect(s * .45, -s * .05, s * 1.25, s * .1);
  g.restore();
}
function cuneiNum(g, x, y, n, s, prog, base) { // draws number n (<60) with tens (corner) and ones (vertical), prog 0..1 reveal
  const tens = Math.floor(n / 10), ones = n % 10, total = tens + ones; let k = 0, cx = x;
  for (let i = 0; i < tens; i++, k++) { const a = clamp(prog * total - k); if (a > 0) { g.save(); g.globalAlpha = a; g.fillStyle = shade(base, -.55); poly(g, [cx, y, cx + s * .55, y - s * .42, cx + s * .55, y + s * .42]); g.fillStyle = shade(base, -.3); poly(g, [cx, y, cx + s * .55, y + s * .42, cx + s * .4, y]); g.restore(); } cx += s * .62; }
  cx += s * .25;
  for (let i = 0; i < ones; i++, k++) { const a = clamp(prog * total - k); const col = i % 3, row = Math.floor(i / 3); if (a > 0) wedge(g, cx + col * s * .5, y - s * .7 + row * s * .8, s * .75, Math.PI / 2, a, base); }
}

// ---------- glazed animals (facing right, box ~200x120, feet at y=120) ----------
function lionShape(g, body, mane) {
  g.fillStyle = body;
  ell(g, 100, 64, 64, 22); ell(g, 148, 62, 24, 25);
  line(g, [150, 76, 158, 118], 15, body); line(g, [166, 72, 178, 117], 14, body);
  line(g, [62, 76, 52, 117], 15, body); line(g, [78, 78, 88, 117], 14, body);
  ell(g, 162, 120, 11, 4); ell(g, 182, 119, 10, 4); ell(g, 48, 120, 11, 4); ell(g, 92, 120, 10, 4);
  quad(g, 40, 56, 10, 20, 2, 46, 5, body); ell(g, 2, 50, 6, 9);
  g.fillStyle = mane; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = i % 2 ? 26 : 33; g.lineTo(166 + Math.cos(a) * r, 52 + Math.sin(a) * r * 1.05); } g.fill();
  g.fillStyle = body; circ(g, 178, 50, 15); ell(g, 193, 57, 10, 8); poly(g, [168, 36, 174, 26, 178, 38]);
  g.fillStyle = mane; ell(g, 197, 58, 3, 2); g.fillStyle = shade(mane, -.5); circ(g, 183, 46, 2.5);
  g.strokeStyle = shade(mane, -.3); g.lineWidth = 2; g.beginPath(); g.moveTo(188, 64); g.lineTo(199, 63); g.stroke();
}
function bullShape(g, body, det) {
  g.fillStyle = body;
  ell(g, 96, 62, 66, 27); ell(g, 140, 50, 28, 24);
  line(g, [148, 80, 152, 116], 13, body); line(g, [128, 82, 132, 116], 12, body);
  line(g, [58, 80, 50, 116], 13, body); line(g, [76, 84, 82, 116], 12, body);
  g.fillStyle = det; for (const fx of [152, 132, 50, 82]) g.fillRect(fx - 7, 112, 14, 8);
  g.fillStyle = body; ell(g, 174, 64, 20, 13, .5); ell(g, 186, 76, 9, 8);
  line(g, [32, 54, 26, 96], 4, body); g.fillStyle = det; ell(g, 26, 100, 4, 7);
  quad(g, 168, 52, 178, 22, 198, 16, 7, det); poly(g, [160, 54, 150, 46, 162, 50]);
  g.fillStyle = det; circ(g, 178, 60, 2.5);
  g.strokeStyle = det; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 5; i++) { g.moveTo(130 + i * 6, 32); g.lineTo(126 + i * 6, 42); } g.stroke();
}
function dragonShape(g, body, det) {
  g.fillStyle = body;
  ell(g, 92, 66, 56, 17);
  quad(g, 132, 60, 160, 50, 162, 18, 16, body);
  ell(g, 176, 14, 17, 7.5, .08);
  g.fillStyle = det; line(g, [168, 8, 156, -14], 4, det); line(g, [174, 8, 170, -12], 3, det);
  line(g, [192, 16, 202, 12, 199, 18], 1.5, det);
  g.fillStyle = body;
  line(g, [130, 76, 136, 117], 11, body); line(g, [146, 74, 152, 117], 10, body);
  ell(g, 140, 120, 9, 3.5); ell(g, 156, 120, 9, 3.5);
  line(g, [58, 76, 54, 100, 60, 116], 9, body); line(g, [72, 78, 76, 100, 82, 116], 8, body);
  g.strokeStyle = det; g.lineWidth = 3; for (const fx of [60, 82]) { g.beginPath(); g.moveTo(fx, 116); g.lineTo(fx + 10, 121); g.moveTo(fx, 116); g.lineTo(fx - 8, 121); g.moveTo(fx, 116); g.lineTo(fx + 2, 122); g.stroke(); }
  g.beginPath(); g.moveTo(40, 64); g.bezierCurveTo(10, 60, 8, 24, 24, 14); g.lineWidth = 8; g.strokeStyle = body; g.stroke();
  g.beginPath(); g.moveTo(24, 14); g.quadraticCurveTo(36, 2, 34, 18); g.lineWidth = 4; g.strokeStyle = det; g.stroke();
  g.fillStyle = det; for (let i = 0; i < 9; i++) circ(g, 60 + i * 9, 62 + (i % 2) * 5, 2);
  g.fillStyle = det; circ(g, 180, 11, 2);
}
function animal(g, kind, x, y, s, flip, c1, c2) { g.save(); g.translate(x, y); g.scale(flip ? -s : s, s); g.translate(-100, -120); ({ lion: lionShape, bull: bullShape, dragon: dragonShape })[kind](g, c1, c2); g.restore(); }

function glazed(g, x, y, w, h, seed, base = '#1f4fa8') {
  g.fillStyle = vgrad(g, y, y + h, [[0, shade(base, .08)], [1, shade(base, -.2)]]); g.fillRect(x, y, w, h);
  const r = rng(seed), bh = 22, bw = 46;
  for (let yy = y, row = 0; yy < y + h; yy += bh, row++) for (let xx = x - (row % 2) * bw / 2; xx < x + w; xx += bw) {
    const v = r(); g.fillStyle = v < .5 ? rgba('#fff', v * .08) : rgba('#000', (v - .5) * .14); g.fillRect(Math.max(x, xx), yy, Math.min(bw, x + w - Math.max(x, xx)), bh);
    g.fillStyle = rgba('#0a1838', .5); g.fillRect(Math.max(x, xx), yy, 1.5, bh);
  }
  g.fillStyle = rgba('#0a1838', .45); for (let yy = y; yy < y + h; yy += bh) g.fillRect(x, yy, w, 1.5);
}
function rosettes(g, x, y, w, r = 14) { g.fillStyle = '#0f2f6e'; g.fillRect(x, y - r - 6, w, r * 2 + 12); for (let xx = x + r + 6; xx < x + w - r; xx += r * 2 + 12) { g.fillStyle = '#f3ede0'; circ(g, xx, y, r); g.fillStyle = '#e2a93b'; circ(g, xx, y, r * .45); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.fillStyle = '#9fb8e8'; circ(g, xx + Math.cos(a) * r * .72, y + Math.sin(a) * r * .72, r * .14); } } }
function merlons(g, x, y, w, c = '#1f4fa8') { const mw = 52; for (let xx = x; xx < x + w - 10; xx += mw) { g.fillStyle = shade(c, -.05); g.fillRect(xx + 4, y - 16, mw - 8, 16); g.fillRect(xx + 12, y - 32, mw - 24, 16); g.fillRect(xx + 19, y - 46, mw - 38, 14); g.fillStyle = shade(c, .25); g.fillRect(xx + 4, y - 16, mw - 8, 3); g.fillRect(xx + 12, y - 32, mw - 24, 3); g.fillRect(xx + 19, y - 46, mw - 38, 3); } }

const GATE = () => cached('gate', 2000, 1360, (g) => {
  const gy = 1360;
  const blocks = [[0, 700, 380], [1620, 700, 380], [380, 260, 420], [1200, 260, 420], [800, 420, 400]];
  blocks.forEach(([x, top, w], i) => { glazed(g, x, top, w, gy - top, 11 + i); merlons(g, x, top, w); rosettes(g, x, top + 30, w, 13); g.fillStyle = rgba('#000', .18); g.fillRect(x + w - 10, top, 10, gy - top); });
  // animals
  const rows = (x, w, ys, flip) => ys.forEach((yy, k) => animal(g, k % 2 ? 'dragon' : 'bull', x + w / 2, yy, w / 330, flip, k % 2 ? '#f1ecdc' : '#e7b64a', k % 2 ? '#e0a537' : '#1d6aa8'));
  rows(380, 420, [470, 660, 850, 1040, 1230], false); rows(1200, 420, [470, 660, 850, 1040, 1230], true);
  rows(0, 380, [880, 1070, 1260], false); rows(1620, 380, [880, 1070, 1260], true);
  animal(g, 'dragon', 1000 - 95, 640, .9, false, '#f1ecdc', '#e0a537'); animal(g, 'dragon', 1000 + 95, 640, .9, true, '#f1ecdc', '#e0a537');
  // arch
  const ax = 870, aw = 260, atop = 760;
  g.fillStyle = '#e8c169'; g.beginPath(); g.moveTo(ax - 22, gy); g.lineTo(ax - 22, atop + aw / 2); g.arc(1000, atop + aw / 2, aw / 2 + 22, Math.PI, 0); g.lineTo(ax + aw + 22, gy); g.fill();
  g.fillStyle = '#f2ecdc'; g.beginPath(); g.moveTo(ax - 10, gy); g.lineTo(ax - 10, atop + aw / 2); g.arc(1000, atop + aw / 2, aw / 2 + 10, Math.PI, 0); g.lineTo(ax + aw + 10, gy); g.fill();
  const ig = g.createLinearGradient(0, atop, 0, gy); ig.addColorStop(0, '#120c06'); ig.addColorStop(.6, '#3a2410'); ig.addColorStop(1, '#ffcf88');
  g.fillStyle = ig; g.beginPath(); g.moveTo(ax, gy); g.lineTo(ax, atop + aw / 2); g.arc(1000, atop + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, gy); g.fill();
  rosettes(g, 800, 1180, 70, 10); rosettes(g, 1130, 1180, 70, 10);
});
const LIONWALL = () => cached('lionwall', 3800, 900, (g, w, h) => {
  glazed(g, 0, 0, w, h, 77); rosettes(g, 0, 70, w, 15); rosettes(g, 0, h - 110, w, 15);
  g.fillStyle = '#e2a93b'; g.fillRect(0, 100, w, 6); g.fillRect(0, h - 146, w, 6);
  for (let i = 0; i < 9; i++) animal(g, 'lion', 220 + i * 430, 640, 1.65, true, i % 2 ? '#efe9da' : '#e7b64a', i % 2 ? '#e3a63a' : '#b8452a');
});

// ---------- text ----------
function wrap(g, s, maxW) { const words = s.split(' '), lines = []; let cur = ''; for (const w of words) { const tryS = cur ? cur + ' ' + w : w; if (g.measureText(tryS).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryS; } if (cur) lines.push(cur); return lines; }
function drawSub(g, sub, a, rise) {
  g.save(); g.globalAlpha = a; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const kind = sub.k || 'sub';
  if (kind === 'title') {
    g.font = '700 92px "Reem Kufi"'; const lines = wrap(g, sub.t, 1500); const lh = 128, y0 = H / 2 - (lines.length - 1) * lh / 2 + rise;
    g.fillStyle = rgba('#000', .35 * a); g.fillRect(0, y0 - 110, W, lines.length * lh + 100);
    lines.forEach((l, i) => { g.shadowColor = 'rgba(255,190,80,.7)'; g.shadowBlur = 30; const gr = g.createLinearGradient(0, y0 + i * lh - 50, 0, y0 + i * lh + 50); gr.addColorStop(0, '#fff3cf'); gr.addColorStop(1, '#e2a63c'); g.fillStyle = gr; g.fillText(l, W / 2, y0 + i * lh); });
  } else if (kind === 'card') {
    const x = W - 110 + (1 - a) * 40; g.textAlign = 'right';
    g.fillStyle = '#e2a63c'; g.fillRect(x + 22, 120, 6, 150);
    g.font = '800 76px "Cairo"'; g.fillStyle = '#fff6df'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 16; g.fillText(sub.t, x, 170);
    g.font = '600 40px "Cairo"'; g.fillStyle = '#f0c77a'; g.fillText(sub.t2, x, 240);
  } else if (kind === 'end') {
    g.font = '700 70px "Reem Kufi"'; const lines = wrap(g, sub.t, 1600), lh = 112, y0 = H / 2 - (lines.length - 1) * lh / 2 + rise;
    g.fillStyle = rgba('#000', .4 * a); g.fillRect(0, y0 - 100, W, lines.length * lh + 80);
    lines.forEach((l, i) => { g.shadowColor = 'rgba(255,200,110,.8)'; g.shadowBlur = 28; g.fillStyle = '#fff4d6'; g.fillText(l, W / 2, y0 + i * lh); });
  } else {
    g.font = '700 50px "Cairo"'; const lines = wrap(g, sub.t, 1480), lh = 74; const by = H - 140 - (lines.length - 1) * lh + rise;
    let mw = 0; lines.forEach(l => mw = Math.max(mw, g.measureText(l).width));
    const pad = 36, bx = W / 2 - mw / 2 - pad, bh = lines.length * lh + 26, top = by - lh / 2 - 13;
    g.fillStyle = rgba('#0b0805', .55); rr(g, bx, top, mw + pad * 2, bh, 18);
    if (sub.who || kind === 'fact') {
      const label = kind === 'fact' ? 'معلومة' : sub.who; g.font = '700 32px "Cairo"'; const lw = g.measureText(label).width + 40;
      g.fillStyle = kind === 'fact' ? '#2456b5' : '#e2a63c'; rr(g, W / 2 + mw / 2 + pad - lw, top - 30, lw, 46, 23);
      g.fillStyle = kind === 'fact' ? '#fff' : '#1a1208'; g.fillText(label, W / 2 + mw / 2 + pad - lw / 2, top - 7); g.font = '700 50px "Cairo"';
    }
    g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 8;
    lines.forEach((l, i) => g.fillText(l, W / 2, by + i * lh));
  }
  g.restore();
}
function bubble(g, x, y, s, a) {
  if (a <= 0) return; g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(.85 + .15 * a, .85 + .15 * a);
  g.font = '800 54px "Cairo"'; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(s).width + 60; g.fillStyle = '#fffaf0'; rr(g, -w / 2, -48, w, 90, 40); poly(g, [-20, 38, 10, 38, -30, 70]);
  g.fillStyle = '#2a1a0e'; g.fillText(s, 0, -2); g.restore();
}
function chip(g, x, y, s, a, c = '#e2a63c', fg = '#1a1208', size = 44) { if (a <= 0) return; g.save(); g.globalAlpha = a; g.font = `800 ${size}px "Cairo"`; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = g.measureText(s).width + 50; g.fillStyle = c; rr(g, x - w / 2, y - size * .75, w, size * 1.5, size * .75); g.fillStyle = fg; g.fillText(s, x, y + 2); g.restore(); }
function battery(g, x, y, pct, a = 1) {
  g.save(); g.globalAlpha = a; g.translate(x, y);
  g.fillStyle = rgba('#000', .5); rr(g, -90, -40, 200, 80, 20);
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.roundRect(-70, -20, 90, 40, 7); g.stroke(); g.fillStyle = '#fff'; g.fillRect(22, -8, 6, 16);
  g.fillStyle = '#ff3b30'; g.fillRect(-65, -15, Math.max(2, 80 * pct / 100 * 4), 30);
  g.font = '800 36px "Cairo"'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ff6b60'; g.fillText(pct + '%', 38, 3);
  g.restore();
}

// ---------- scene helpers ----------
const SUN = { dawn: [[0, '#1b2350'], [.45, '#7a4a6a'], [.72, '#e98a4a'], [.9, '#ffd39a'], [1, '#ffe6b8']], day: [[0, '#5f9ad3'], [.6, '#b9d6ea'], [1, '#f4e2c0']], dusk: [[0, '#2a1d47'], [.45, '#8a3f5c'], [.75, '#f0703a'], [1, '#ffc27a']] };
function urLayer(key, pal, seed, n, hmin, hmax, w = 3200) {
  return cached(key, w, 600, (g) => { const r = rng(seed); let x = -20; while (x < w) { const hw = 90 + r() * 170, hh = hmin + r() * (hmax - hmin); house(g, x, 600, hw, hh, pal[(r() * pal.length) | 0], (r() * 1e6) | 0, { beam: r() > .5 }); if (r() > .7) { const hh2 = hh + 40 + r() * 50; house(g, x + hw * .3, 600, hw * .5, hh2, pal[(r() * pal.length) | 0], (r() * 1e6) | 0, { noDoor: true, beam: true }); } x += hw + r() * 8; } });
}
function urCity(g, t, o) {
  const { cam = 0, zigX = W / 2, zigY = 700, zigS = 1, pal = 'day', crane = 0 } = o;
  const day = pal === 'day';
  const zc = day ? { front: '#c48a5e', side: '#93603f', top: '#dcaa7c', stair: '#a46b47', shrine: '#ad7651' } : { front: '#7a4a48', side: '#4e2e32', top: '#a0605a', stair: '#5c3438', shrine: '#64383b' };
  g.save(); g.translate(0, crane * .3);
  g.fillStyle = day ? '#c9a77d' : '#6a4048'; g.fillRect(0, zigY - 40, W, H);
  zigUr(g, zigX - cam * .15, zigY, 760 * zigS, 430 * zigS, zc);
  g.restore();
  const far = urLayer('urfar_' + pal, day ? ['#b98d64', '#c49a70', '#ad8058'] : ['#5a3540', '#6a3e46', '#4e2c38'], 3, 70, 130);
  const mid = urLayer('urmid_' + pal, day ? ['#c99a6a', '#d4a676', '#b98756', '#c08f60'] : ['#3d2430', '#4a2c36', '#361f2a'], 9, 140, 230);
  g.drawImage(far, -((cam * .3) % 1600) - 200, zigY - 560 + crane * .45, 3200, 600);
  for (let i = 0; i < 6; i++) palm(g, ((i * 370 - cam * .45) % 2200 + 2200) % 2200 - 140, zigY + 40 + crane * .55, .75, t, day ? '#2f4a22' : '#24161c', day ? '#5a4126' : '#2a1a1e');
  g.drawImage(mid, -((cam * .6) % 1600) - 100, zigY - 380 + crane * .7, 3200, 600);
  g.fillStyle = day ? '#b89068' : '#3a2430'; g.fillRect(0, zigY + 220 + crane * .7, W, H);
}
// ---------- scenes ----------
const S = [];
function scene(s, e, f) { S.push({ s, e, f }); }

// 0: fan
scene(0, 3, (g, t) => {
  sky(g, [[0, '#0c1220'], [1, '#18223a']]);
  glow(g, W * .85, H * .2, 700, '#3a5a8a', .35);
  const om = t < 2.6 ? 16 * Math.pow(1 - t / 2.6, 1.6) : 0, ang = 16 * 2.6 / 2.6 * (1 - Math.pow(1 - Math.min(t, 2.6) / 2.6, 2.6)) * 2.6 / 2.6 * 2.6;
  g.save(); g.translate(W / 2, H / 2 + 20);
  const sc = 1 + t * .05; g.scale(sc, sc);
  const blur = clamp(om / 16) * .5;
  for (let k = 0; k < 6; k++) {
    g.globalAlpha = k === 0 ? 1 : .18 * blur * 2;
    for (let b = 0; b < 3; b++) { g.save(); g.rotate(ang + b * TAU / 3 - k * blur * .12); g.fillStyle = '#2b2f36'; g.beginPath(); g.ellipse(250, 0, 230, 52, 0, 0, TAU); g.fill(); g.fillStyle = '#3a404a'; g.fillRect(40, -10, 80, 20); g.restore(); }
  }
  g.globalAlpha = 1; g.fillStyle = '#1c1f24'; circ(g, 0, 0, 70); g.fillStyle = '#4a515c'; circ(g, 0, 0, 30); g.restore();
});
// 1: phone in the dark
scene(3, 6, (g, t) => {
  sky(g, [[0, '#06080e'], [1, '#0e1422']]);
  const ph = ss(0, .6, t);
  g.save(); g.translate(W / 2, H + 40 - ph * 60); ali(g, 0, 0, 3.6, { view: 'front', phone: 0, mouth: .3, brow: 3, look: 0 }); g.restore();
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#4a6a9a'; g.fillRect(0, 0, W, H); g.restore();
  glow(g, W / 2, H * .82, 520, '#bfe0ff', .45);
  // phone
  g.save(); g.translate(W / 2 + 330, H * .62 - ph * 30); g.rotate(-.08);
  g.fillStyle = '#0c0c10'; rr(g, -150, -270, 300, 540, 38); g.fillStyle = '#e9f1fb'; rr(g, -136, -254, 272, 508, 28);
  g.fillStyle = '#1a2230'; for (let i = 0; i < 4; i++) g.fillRect(-110 + i * 16, -222 - i * 6, 11, 14 + i * 6);
  line(g, [-118, -238, -40, -196], 5, '#ff3b30');
  g.strokeStyle = '#1a2230'; g.lineWidth = 6; g.beginPath(); g.roundRect(40, -226, 62, 28, 6); g.stroke(); g.fillStyle = '#ff3b30'; g.fillRect(46, -220, 6, 16); g.fillStyle = '#1a2230'; g.fillRect(104, -217, 5, 10);
  g.save(); g.translate(0, -20); g.strokeStyle = '#9aa7b8'; g.lineWidth = 12; g.lineCap = 'round';
  for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(0, 40, i * 34, -Math.PI * .78, -Math.PI * .22); g.stroke(); } g.fillStyle = '#9aa7b8'; circ(g, 0, 40, 9);
  line(g, [-90, -80, 90, 70], 12, '#ff3b30'); g.restore();
  g.restore();
  battery(g, W / 2 + 640, H * .62 - 220 - ph * 30, 3, ss(.4, .8, t));
});
// 2: the seal
scene(6, 9, (g, t) => {
  sky(g, [[0, '#0a0c12'], [1, '#1d150e']]);
  g.fillStyle = vgrad(g, H * .55, H, [[0, '#3b2616'], [1, '#1a0f08']]); g.fillRect(0, H * .55, W, H);
  const gl = ss(0, 2.4, t);
  glow(g, W / 2, H * .6, 900, '#ffb347', .25 * gl);
  g.fillStyle = rgba('#9fc6ff', .25); rr(g, W * .72, H * .3, 110, 230, 18); g.fillStyle = rgba('#9fc6ff', .15); rr(g, W * .72, H * .45, 110, 120, 10);
  line(g, [W * .1, H * .78, W * .2, H * .72, W * .28, H * .8], 8, '#222');
  const j = gl * 6; const r = rng((t * 30) | 0);
  cylSeal(g, W / 2 + (r() - .5) * j, H * .64 + (r() - .5) * j, 2.2, gl, t);
  dust(g, t, '#ffcf7a', gl);
});
// 3: vortex
scene(9, 13, (g, t) => {
  const p = t / 4;
  const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .7); gr.addColorStop(0, '#fff6dd'); gr.addColorStop(.25, '#f0b866'); gr.addColorStop(.6, '#8a4e22'); gr.addColorStop(1, '#2a160a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(42);
  for (let i = 0; i < 260; i++) {
    const r0 = 80 + r() * 1000, sp = .6 + r() * 1.4, a0 = r() * TAU, rad = r0 * (1 - .35 * p) + 40 * Math.sin(t * 2 + i), ang = a0 + t * sp * (1.4 + 600 / r0);
    const x = W / 2 + Math.cos(ang) * rad * 1.3, y = H / 2 + Math.sin(ang) * rad * .75;
    g.save(); g.translate(x, y); g.rotate(ang * 2 + i); const sz = 10 + r() * 30;
    if (i % 3) { g.fillStyle = mixc('#b27a4c', '#d8a46e', r()); g.fillRect(-sz, -sz * .45, sz * 2, sz * .9); g.fillStyle = rgba('#000', .2); g.fillRect(-sz, sz * .3, sz * 2, sz * .15); }
    else { g.fillStyle = rgba('#ffe3a8', .6); circ(g, 0, 0, sz * .15); }
    g.restore();
  }
  g.save(); g.translate(W / 2, H / 2 + 160); g.rotate(Math.sin(t * 3) * .4); ali(g, 0, 0, 1.4, { view: 'front', armUp: 1, mouth: .8, brow: 4 }); g.restore();
  g.fillStyle = rgba('#fff', clamp(1 - t * 1.6)); g.fillRect(0, 0, W, H);
});
// 4: reveal ziggurat at sunrise
scene(13, 17.5, (g, t) => {
  sky(g, SUN.dawn); const z = 1 + t * .025;
  g.save(); g.translate(W / 2, H * .62); g.scale(z, z); g.translate(-W / 2, -H * .62);
  glow(g, W * .5, H * .5, 700, '#ffd08a', .55); g.fillStyle = '#fff1cf'; circ(g, W * .5, H * .52, 70);
  urCity(g, t, { pal: 'dawn', zigY: 720 });
  rays(g, W * .5, H * .5, t, '#ffcf8a', .1);
  g.restore();
  dust(g, t, '#ffd9a0', .8);
  const up = ss(.2, 2.2, t);
  ali(g, W * .3, H + 120 - up * 30, 2.6, { view: 'back' });
  // goat
  g.save(); g.translate(W * .12, H - 60); g.scale(-1.3, 1.3); donkey(g, 0, 0, .7, '#e8dcc4', t * 3); g.restore();
});
// 5: crane + title
scene(17.5, 24, (g, t) => {
  const c = eio(t / 6.5);
  sky(g, [[0, '#4f6fa8'], [.55, '#f0a868'], [.8, '#ffd9a0'], [1, '#ffe8c4']]);
  glow(g, W * .62, H * .55 - c * 120, 600, '#ffd08a', .5);
  g.save(); g.translate(0, c * 260); urCity(g, t, { pal: 'day', cam: 400 + t * 40, zigX: W * .55, zigY: 640 }); g.restore();
  g.save(); g.translate(0, c * 260); water(g, 940, 1100, t, '#5c8db0', '#2f5c7a'); g.restore();
  rays(g, W * .62, H * .45 - c * 120, t, '#ffe0a8', .08);
  dust(g, t);
});
// 6: Ur street + greeting
scene(24, 36, (g, t) => {
  sky(g, SUN.day); glow(g, W * .8, H * .15, 600, '#fff2cc', .5);
  urCity(g, t, { pal: 'day', cam: 900 + t * 22, zigX: W * .62, zigY: 600, zigS: .8 });
  g.fillStyle = vgrad(g, 820, H, [[0, '#b58c62'], [1, '#8d6642']]); g.fillRect(0, 820, W, H);
  house(g, -40, 860, 360, 420, '#c69564', 91, { beam: true }); house(g, W - 300, 860, 380, 460, '#bf8c5a', 92, { beam: true });
  for (let i = 0; i < 5; i++) person(g, ((i * 420 + t * 40 * (i % 2 ? 1 : -1)) % 2200 + 2200) % 2200 - 150, 840, .8, rgba('#6b4a30', .85), { ph: t * 5 + i, flip: i % 2 === 0, jar: i === 2, sack: i === 4, beard: i % 2 === 1 });
  donkey(g, ((t * 50) % 2400) - 200, 860, 1, '#7d6a58', t * 6);
  const mx = lerp(W + 100, W * .66, eo((t - .3) / 2.2));
  person(g, mx, 1010, 1.45, '#e9dcc0', { ph: t < 2.5 ? t * 6 : 0, flip: true, beard: 1, arm: t > 2.4 });
  g.save(); g.translate(mx, 1010); g.scale(1.45, 1.45); g.fillStyle = SKIN; circ(g, 0, -138, 12); g.fillStyle = HAIR; ell(g, -3, -126, 9, 10); ell(g, 0, -148, 11, 6); g.restore();
  const look = t < 2.5 ? Math.sin(t * 1.5) : .9;
  ali(g, W * .42, 1030, 1.55, { view: 'front', look, armUp: ss(5, 5.6, t) * (1 - ss(8.5, 9, t)), mouth: t > 5 && t < 8.5 ? Math.abs(Math.sin(t * 9)) * .6 : 0, brow: t > 2.6 ? 3 : 0 });
  bubble(g, mx - 40, 690, 'سِلِم-ما!', ss(2.6, 3, t) * (1 - ss(5, 5.3, t)));
  dust(g, t, '#fff0cc', .6);
});
// 7: market + scale
scene(36, 46, (g, t) => {
  sky(g, [[0, '#d9b98a'], [1, '#a07850']]);
  g.fillStyle = '#7a5434'; g.fillRect(0, 0, W, 200);
  g.fillStyle = '#b23a2a'; for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#c4552f' : '#e8d4a8'; poly(g, [i * 230 - 40, 120, i * 230 + 190, 120, i * 230 + 200 + 10 * Math.sin(t + i), 250, i * 230 - 50, 250]); }
  glow(g, W * .5, H * .4, 900, '#ffe7b0', .3);
  g.fillStyle = '#5c3b22'; g.fillRect(0, 700, W, 380); g.fillStyle = '#714a2c'; g.fillRect(0, 690, W, 22);
  const piles = [[200, '#5a2a14', 'dates'], [480, '#c9a046', 'barley'], [1440, '#b86a8a', 'onion'], [1720, '#8a9aa0', 'fish']];
  piles.forEach(([x, c], k) => { g.fillStyle = '#8a6440'; ell(g, x, 700, 150, 40); const r = rng(k + 3); for (let i = 0; i < 70; i++) { const a = r() * Math.PI, rr2 = r(); g.fillStyle = shade(c, (r() - .5) * .4); if (k === 3) ell(g, x + Math.cos(a) * 120 * rr2, 690 - Math.sin(a) * 70 * rr2, 26, 8, r()); else circ(g, x + Math.cos(a) * 120 * rr2, 690 - Math.sin(a) * 80 * rr2, k === 1 ? 6 : 13); } });
  // balance scale
  const tilt = Math.sin(clamp((t - 1) / 3) * Math.PI * 2.5) * .18 * (1 - clamp((t - 1) / 4)) + .04;
  g.save(); g.translate(W / 2, 330);
  g.fillStyle = '#4a3020'; g.fillRect(-10, 0, 20, 380); g.fillStyle = '#3a2416'; ell(g, 0, 380, 90, 18);
  g.rotate(tilt); line(g, [-300, 0, 300, 0], 14, '#c9a25a');
  for (const sgn of [-1, 1]) {
    g.save(); g.translate(sgn * 290, 0); g.rotate(-tilt);
    line(g, [0, 0, -80, 200], 3, '#d8c49a'); line(g, [0, 0, 80, 200], 3, '#d8c49a');
    g.fillStyle = '#b8873e'; g.beginPath(); g.ellipse(0, 205, 110, 26, 0, 0, Math.PI); g.fill();
    if (sgn < 0) { g.fillStyle = '#3a3a40'; ell(g, 0, 186, 40, 22); ell(g, 34, 172, 13, 10); g.fillStyle = '#2a2a30'; ell(g, 44, 175, 8, 3); }
    else { const n = Math.floor(clamp((t - .6) / 2.4) * 12); const r = rng(8); for (let i = 0; i < 12; i++) { const fall = clamp((t - .6) * 5 - i * .9); if (fall <= 0) continue; const yy = lerp(-200, 190 - (i % 4) * 6, eo(fall)); g.fillStyle = '#e8ecf0'; g.save(); g.translate(-60 + r() * 120, yy); g.rotate(r() * 3); g.fillRect(-9, -5, 18, 10); g.restore(); } }
    g.restore();
  }
  g.fillStyle = '#e0b55a'; circ(g, 0, 0, 16); g.restore();
  person(g, W * .78, 1000, 1.6, '#3d2a1c', { beard: 1, arm: 1, flip: true });
  chip(g, W * .26, 520, 'شيقل ≈ 8 غرام فضة', ss(5.2, 5.8, t), '#e2a63c', '#1a1208', 46);
  dust(g, t, '#fff0cc', .5);
});
// 8: river, shaduf, boat, friends
scene(46, 54, (g, t) => {
  sky(g, SUN.day); glow(g, W * .2, H * .18, 600, '#fff2cc', .5);
  g.fillStyle = '#9fb08a'; g.fillRect(0, 430, W, 120);
  for (let i = 0; i < 9; i++) palm(g, i * 240 - 60 + (i % 2) * 40, 520, .7 + (i % 3) * .1, t);
  g.fillStyle = '#c8b56a'; g.fillRect(0, 520, W, 60);
  const r = rng(9); for (let i = 0; i < 300; i++) { const x = r() * W, y = 520 + r() * 60; line(g, [x, y + 14, x + Math.sin(t * 2 + x) * 4, y], 2, shade('#a8a050', r() * .3)); }
  water(g, 580, 860, t, '#5f93b8', '#2c5878');
  reedBoat(g, ((t * 70) % 2400) - 300, 720, 1.1, t);
  // shaduf
  const sa = Math.sin(t * 1.4) * .35;
  g.save(); g.translate(W * .78, 880); line(g, [-40, 0, 0, -220, 40, 0], 12, '#5a4126');
  g.translate(0, -215); g.rotate(sa - .1); line(g, [-260, 0, 200, 0], 9, '#6b4d2e'); g.fillStyle = '#8a6440'; circ(g, 200, 0, 32);
  line(g, [-260, 0, -260, 170], 2, '#3a2a1a'); g.fillStyle = '#6a4a30'; rr(g, -280, 170, 40, 36, 8); g.restore();
  person(g, W * .7, 900, 1.1, '#4a3424', { arm: 1, ph: t * 2 });
  g.fillStyle = vgrad(g, 860, H, [[0, '#6e5236'], [1, '#4a3420']]); g.fillRect(0, 860, W, H);
  const laugh = Math.abs(Math.sin(t * 8)) * .7;
  ali(g, W * .36, 1050, 1.45, { view: 'front', mouth: t > 1.5 ? laugh : .2, look: .6 });
  luNanna(g, W * .48, 1050, 1.45, { look: -.6, point: t > 4.5 });
  g.fillStyle = rgba('#5a3a20', .9); ell(g, W * .48, 1050, 60, 10);
});
// 9: clay tablet + stylus writing numbers
scene(54, 64, (g, t) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#3a2414'], [1, '#1a0e06']]); g.fillRect(0, 0, W, H);
  glow(g, W * .3, H * .2, 1100, '#ffcf8a', .35);
  const base = '#cfa676';
  tablet(g, W / 2, H / 2 + 10, 2.05, base);
  const rows = [23, 15, 41, 7]; let k = 0;
  rows.forEach((n, i) => { const p = clamp((t - .5 - i * 1.6) / 1.5); cuneiNum(g, W / 2 - 330, 300 + i * 150, n, 52, p, base); g.fillStyle = shade(base, -.35); g.fillRect(W / 2 - 380, 360 + i * 150, 760, 3); });
  // sheep/barley pictographs simple (left column)
  const ic = clamp((t - 6.8) / 1); if (ic > 0) { g.save(); g.globalAlpha = ic; g.strokeStyle = shade(base, -.5); g.lineWidth = 7; for (let i = 0; i < 4; i++) { const y = 290 + i * 150; g.beginPath(); if (i % 2) { g.arc(W / 2 + 230, y, 26, 0, TAU); g.moveTo(W / 2 + 214, y - 10); g.lineTo(W / 2 + 246, y + 10); g.moveTo(W / 2 + 214, y + 10); g.lineTo(W / 2 + 246, y - 10); } else { g.moveTo(W / 2 + 230, y + 34); g.lineTo(W / 2 + 230, y - 34); for (let j = -1; j <= 1; j++) { g.moveTo(W / 2 + 230, y + j * 14); g.lineTo(W / 2 + 208, y + j * 14 - 16); g.moveTo(W / 2 + 230, y + j * 14); g.lineTo(W / 2 + 252, y + j * 14 - 16); } } g.stroke(); } g.restore(); }
  // stylus
  const seg = Math.min(3, Math.floor((t - .5) / 1.6)), sp = ((t - .5) / 1.6) % 1, press = Math.max(0, Math.sin(sp * Math.PI * 6));
  const sx = W / 2 - 330 + sp * 300, sy = 300 + Math.max(0, seg) * 150 - 10 - press * 12;
  if (t < 7) { g.save(); g.translate(sx, sy); g.rotate(-2.4); g.scale(1, -1); g.fillStyle = '#d9c08a'; g.fillRect(0, -9, 620, 18); g.fillStyle = '#b89a62'; for (let i = 60; i < 620; i += 120) g.fillRect(i, -10, 6, 20); g.fillStyle = '#c4a46c'; poly(g, [0, -9, -30, 0, 0, 9]); g.restore(); }
});
// 10: school + watch
scene(64, 76, (g, t) => {
  if (t < 4.2) {
    g.fillStyle = vgrad(g, 0, H, [[0, '#4a2e1a'], [1, '#2a180c']]); g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffe7b0'; g.fillRect(W * .72, 180, 120, 90);
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#ffd28a', .16); poly(g, [W * .72, 180, W * .72 + 120, 180, W * .5, H, W * .2, H]); g.restore();
    for (let row = 0; row < 2; row++) { g.fillStyle = '#5a3a22'; g.fillRect(0, 720 + row * 200, W, 40); for (let i = 0; i < 6; i++) { const x = 180 + i * 290 + row * 120; g.save(); g.translate(x, 740 + row * 200); g.rotate(Math.sin(t * 4 + i) * .06); person(g, 0, 0, .95 + row * .15, '#1e120a', { bald: 1 }); g.restore(); } }
    const tx = W * .5 + Math.sin(t * .8) * 300; person(g, tx, 760, 1.5, '#140c06', { beard: 1, staff: 1 });
    ali(g, W * .86, 1040, 1.3, { view: 'front', mouth: t > 1.2 ? Math.abs(Math.sin(t * 9)) * .6 : 0, brow: 3 });
    // cane hit + Lu-Nanna
    luNanna(g, W * .2, 1040, 1.3, { look: .5 });
    if (t > 1 && t < 1.4) { g.fillStyle = rgba('#fff', .8); g.font = '800 70px Cairo'; g.textAlign = 'center'; g.fillText('!', W * .2 + 70, 790); }
    line(g, [W * .2 + 120, 870 - Math.max(0, Math.sin(clamp((t - .8) * 3) * Math.PI)) * 120, W * .2 + 40, 910], 6, '#3a2414');
  } else {
    const p = t - 4.2;
    g.fillStyle = vgrad(g, 0, H, [[0, '#1d2230'], [1, '#0c0e14']]); g.fillRect(0, 0, W, H);
    glow(g, W * .35, H / 2, 700, '#ffd08a', .2);
    g.save(); g.translate(W * .33, H / 2);
    g.fillStyle = '#1a1a1a'; rr(g, -90, -420, 180, 840, 50);
    g.fillStyle = '#0d0d0d'; circ(g, 0, 0, 300); g.fillStyle = '#f2ead8'; circ(g, 0, 0, 268);
    for (let i = 0; i < 60; i++) { g.save(); g.rotate(i / 60 * TAU); g.fillStyle = '#222'; i % 5 ? g.fillRect(-2, -258, 4, 18) : g.fillRect(-5, -258, 10, 40); g.restore(); }
    g.save(); g.rotate(TAU * 10 / 12 + p * .01); g.fillStyle = '#222'; rr(g, -8, -150, 16, 160, 8); g.restore();
    g.save(); g.rotate(TAU * 2 / 60 + p * .05); g.fillStyle = '#222'; rr(g, -6, -220, 12, 230, 6); g.restore();
    g.save(); g.rotate(clamp(p / 3) * TAU); g.fillStyle = '#c0392b'; g.fillRect(-2.5, -250, 5, 290); circ(g, 0, 0, 12); g.restore();
    g.restore();
    const a1 = ss(.3, .8, p), a2 = ss(1.5, 2, p), a3 = ss(2.7, 3.2, p), a4 = ss(4, 4.6, p);
    chip(g, W * .74, 300, '60 ثانية', a1, '#e2a63c', '#1a1208', 64);
    chip(g, W * .74, 440, '60 دقيقة', a2, '#e2a63c', '#1a1208', 64);
    chip(g, W * .74, 580, '360 درجة', a3, '#e2a63c', '#1a1208', 64);
    if (a4 > 0) { g.save(); g.globalAlpha = a4; tablet(g, W * .74, 760, .42, '#cfa676'); wedge(g, W * .74 - 30, 760, 70, Math.PI / 2, 1, '#cfa676'); g.restore(); chip(g, W * .74, 880, '= 60 بالمسماري', a4, '#2456b5', '#fff', 34); }
  }
});
// 11: sunset ziggurat + moon, then handprint tablet
scene(76, 86, (g, t) => {
  if (t < 7) {
    sky(g, SUN.dusk); const sy = 560 + t * 30; glow(g, W * .2, sy, 600, '#ffb060', .6); g.fillStyle = '#ffd9a0'; circ(g, W * .2, sy, 80);
    const my = 520 - t * 40; glow(g, W * .82, my, 300, '#fff6e0', .35); g.fillStyle = '#fff4dc'; circ(g, W * .82, my, 60); g.fillStyle = rgba('#e8dcc0', .5); circ(g, W * .82 - 15, my - 10, 12); circ(g, W * .82 + 18, my + 14, 9);
    g.fillStyle = '#3a1f2c'; g.fillRect(0, 760, W, H);
    zigUr(g, W * .5, 860, 1100, 620, { front: '#2a1520', side: '#1e0e18', top: '#4a2530', stair: '#331a26', shrine: '#2a1520' });
    for (let i = 0; i < 7; i++) person(g, W * .5 - 20 + Math.sin(i) * 10, 860 - i * 60 - t * 8, .5, '#120810', {});
    for (let i = 0; i < 8; i++) palm(g, i * 270 - 50, 980, .9, t, '#120810', '#120810');
    g.save(); g.globalAlpha = .95; ali(g, W * .36, 900, .9, { view: 'back', sit: 1 }); luNanna(g, W * .4, 900, .9, { point: t > 3.5 }); g.restore();
  } else {
    const p = t - 7;
    g.fillStyle = vgrad(g, 0, H, [[0, '#24121c'], [1, '#0c0608']]); g.fillRect(0, 0, W, H);
    glow(g, W / 2, H / 2, 800, '#ffb050', .2 + .25 * Math.sin(p * 10) ** 2);
    const base = '#c49a6a'; tablet(g, W / 2, H / 2, 1.5, base);
    g.save(); g.translate(W / 2 + 60, H / 2 + 20); g.fillStyle = shade(base, -.35); ell(g, 0, 30, 60, 70); [[-55, -55, -.4], [-22, -80, -.1], [12, -82, .1], [44, -66, .35], [76, 0, 1.0]].forEach(([x, y, r]) => ell(g, x, y, 15, 38, r)); g.restore();
    g.save(); g.translate(W / 2 - 170, H / 2 - 60); g.strokeStyle = shade(base, -.45); g.lineWidth = 9; g.beginPath(); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI; g.moveTo(Math.cos(a) * 50, Math.sin(a) * 50); g.lineTo(-Math.cos(a) * 50, -Math.sin(a) * 50); } g.stroke(); g.restore();
    battery(g, W - 260, 150, 1, ss(.3, .7, p));
    cylSeal(g, 300, H - 220, .9, 1, t);
  }
});
// 12: time-lapse jump 1
scene(86, 90, (g, t) => {
  const cyc = t * 3.2, d = (Math.sin(cyc * TAU) + 1) / 2;
  g.fillStyle = mixc('#0c1030', '#8ab4dc', d); g.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) { const a = ((cyc + i * .17) % 1) * Math.PI; g.fillStyle = rgba('#fff2c0', .5); circ(g, W / 2 - Math.cos(a) * 900, 820 - Math.sin(a) * 620, 30); }
  g.fillStyle = mixc('#2a1820', '#b48a62', d); g.fillRect(0, 760, W, H);
  zigUr(g, W / 2, 860, 1000 - t * 60, 560 - t * 50, { front: mixc('#2a1820', '#b9805a', d), side: '#5a3a2a', top: '#7a5a3a', stair: '#6a4a3a', shrine: '#5a3a2a' });
  g.save(); g.globalCompositeOperation = 'lighter'; const r = rng(4); for (let i = 0; i < 80; i++) { const y = r() * H, x = (r() * W + t * 3000) % W; g.fillStyle = rgba('#ffe0a0', .15); g.fillRect(x, y, 200 + r() * 300, 2); } g.restore();
  g.fillStyle = rgba('#fff', ss(3.3, 4, t)); g.fillRect(0, 0, W, H);
});
// 13: Hammurabi's Babylon square
scene(90, 104, (g, t) => {
  sky(g, [[0, '#8fb2cf'], [.7, '#e6d2ae'], [1, '#f0dcb8']]);
  glow(g, W * .7, H * .2, 600, '#fff2cc', .4);
  // temple with niches
  g.fillStyle = '#b38f66'; g.fillRect(W * .25, 300, W * .5, 520); g.fillStyle = '#a07d56'; for (let i = 0; i < 22; i++) g.fillRect(W * .25 + 20 + i * (W * .5 - 40) / 22, 330, 18, 490);
  g.fillStyle = '#c29e74'; g.fillRect(W * .25 - 10, 290, W * .5 + 20, 20); g.fillStyle = '#5a3e26'; g.beginPath(); g.roundRect(W / 2 - 70, 560, 140, 260, [70, 70, 0, 0]); g.fill();
  zigBab(g, W * .12, 820, 300, 520, '#a88660', '#a88660');
  const pal = ['#b69168', '#a8845c', '#c19c72'];
  for (let i = 0; i < 5; i++) house(g, i * 160 + (i > 2 ? W * .55 : 0), 830, 170, 180 + (i * 37) % 90, pal[i % 3], 200 + i, { beam: true });
  g.fillStyle = vgrad(g, 820, H, [[0, '#c2a27a'], [1, '#9a7a54']]); g.fillRect(0, 820, W, H);
  for (let i = 0; i < 9; i++) person(g, ((i * 260 + t * 45 * (i % 2 ? 1 : -1)) % 2300 + 2300) % 2300 - 200, 900 + (i % 3) * 30, .9 + (i % 3) * .1, ['#6a4a30', '#7a3a2a', '#4a3a5a'][i % 3], { ph: t * 5 + i, flip: i % 2 === 0, beard: 1, cap: i % 4 === 0 });
  const look = Math.sin(t * 2.2) * (t < 6 ? 1 : .3);
  ali(g, W * .5, 1050, 1.6, { view: 'front', look, mouth: (t > 2.6 && t < 5.6) || (t > 10.2) ? Math.abs(Math.sin(t * 9)) * .6 : 0, brow: t > 2.6 && t < 6 ? 4 : 1, armUp: ss(3, 3.4, t) * (1 - ss(6, 6.4, t)) });
  person(g, W * .78, 1050, 1.5, '#3a2a4a', { beard: 1, arm: t > 9.5 && t < 11, flip: true });
  bubble(g, W * .74, 680, 'شُلْمُم!', ss(9.8, 10.1, t) * (1 - ss(13.4, 13.8, t)));
  if (t > 6.5 && t < 10) { const a = ss(6.5, 7, t) * (1 - ss(9.5, 10, t)); g.save(); g.globalAlpha = a * .9; glazed(g, W * .5 - 160, 330, 320, 200, 5); g.globalAlpha = a; g.strokeStyle = '#ff4a3a'; g.lineWidth = 14; g.beginPath(); g.moveTo(W * .5 - 140, 350); g.lineTo(W * .5 + 140, 510); g.moveTo(W * .5 + 140, 350); g.lineTo(W * .5 - 140, 510); g.stroke(); g.restore(); }
  dust(g, t, '#fff0cc', .5);
});
// 14: Hammurabi stele
scene(104, 114, (g, t) => {
  sky(g, [[0, '#b8a080'], [1, '#806040']]);
  glow(g, W * .5, H * .3, 900, '#ffe0a8', .35);
  g.fillStyle = '#7a5a3a'; g.fillRect(0, 880, W, H);
  const z = .78 + t * .025; g.save(); g.translate(W * .5, 900); g.scale(z, z);
  g.fillStyle = rgba('#000', .3); ell(g, 0, 0, 260, 30);
  g.fillStyle = vgrad(g, -820, 0, [[0, '#3a3a40'], [1, '#1a1a1e']]); g.beginPath(); g.moveTo(-190, 0); g.lineTo(-170, -640); g.quadraticCurveTo(0, -860, 170, -640); g.lineTo(190, 0); g.fill();
  // relief
  g.fillStyle = '#4c4c54';
  g.fillRect(-40, -720, 150, 14); g.fillRect(30, -720, 70, 120); // throne
  rr(g, 30, -840, 70, 130, 20); circ(g, 64, -862, 28); for (let i = 0; i < 4; i++) g.fillRect(40, -905 + i * 9, 50, 5);
  line(g, [100, -830, 130, -860], 6, '#5a5a62'); line(g, [100, -800, 135, -810], 6, '#5a5a62');
  line(g, [30, -800, -10, -790], 9, '#4c4c54'); g.strokeStyle = '#5c5c64'; g.lineWidth = 5; g.beginPath(); g.arc(-22, -790, 12, 0, TAU); g.stroke();
  rr(g, -140, -830, 56, 200, 18); circ(g, -112, -850, 25); g.fillRect(-140, -884, 56, 14); ell(g, -108, -826, 12, 22); line(g, [-90, -812, -78, -840], 9, '#4c4c54');
  // inscription lines
  g.strokeStyle = rgba('#5a5a62', .7); g.lineWidth = 2;
  for (let c = 0; c < 6; c++) for (let r = 0; r < 40; r++) { const x = -160 + c * 54, y = -600 + r * 14.5; const w = 30 + ((c * 7 + r * 13) % 15); g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
  g.restore();
  person(g, W * .2, 1030, 1.5, '#5a3a22', { flip: false, arm: t > 1 });
  person(g, W * .78, 1030, 1.5, '#2a2a4a', { flip: true, beard: 1, cap: 1 });
  g.save(); g.translate(W * .78, 1030); g.scale(-1.5, 1.5); tablet(g, -10, -120, .08, '#cfa676'); g.restore();
  dust(g, t, '#fff0cc', .4);
});
// 15: brick tunnel brown -> blue
scene(114, 119, (g, t) => {
  const p = t / 5; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (let i = 14; i >= 0; i--) {
    const z = ((i + (t * 2.2) % 1) / 14), s = Math.pow(z, 2.2) * 2.4 + .02, w = W * s, h = H * s;
    const c = mixc('#a8774a', '#1f4fa8', clamp(p * 1.4 - .1 + (1 - z) * .2));
    g.fillStyle = c; g.fillRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
    g.strokeStyle = rgba('#000', .35); g.lineWidth = Math.max(1, s * 6); for (let k = 0; k < 6; k++) { g.strokeRect(W / 2 - w / 2 + k * s * 30, H / 2 - h / 2 + k * s * 18, w - k * s * 60, h - k * s * 36); }
    g.fillStyle = rgba('#000', .25 + (1 - z) * .5); g.fillRect(W / 2 - w * .46, H / 2 - h * .46, w * .92, h * .92);
  }
  glow(g, W / 2, H / 2, 500, '#9fd0ff', .5 * p);
  ali(g, W / 2, H / 2 + 120, .9 + p * .4, { view: 'front', armUp: 1, mouth: .7 });
  g.fillStyle = rgba('#fff', ss(4.3, 5, t)); g.fillRect(0, 0, W, H);
});
// 16: lion wall pan
scene(119, 124, (g, t) => {
  sky(g, [[0, '#f0b66a'], [1, '#ffe2b0']]);
  const lw = LIONWALL(); const px = -t * 220 - 200;
  g.drawImage(lw, px, 80, 3800 * 1.05, 900 * 1.05);
  g.fillStyle = vgrad(g, 1000, H, [[0, '#d9c29a'], [1, '#a88c62']]); g.fillRect(0, 1010, W, H);
  g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,200,120,0)'); gr.addColorStop(.5 + Math.sin(t) * .2, 'rgba(255,220,150,.18)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  ali(g, W * .3 + t * 30, 1060, 1.1, { view: 'front', walk: t * 7, look: 1 });
  g.fillStyle = rgba('#fff', clamp(1 - t * 2)); g.fillRect(0, 0, W, H);
});
// 17: Ishtar Gate reveal
scene(124, 138, (g, t) => {
  sky(g, [[0, '#3f6aa8'], [.55, '#e8a868'], [.8, '#ffd39a'], [1, '#ffe8c4']]);
  glow(g, W * .5, H * .35, 900, '#ffd08a', .45);
  const z = lerp(2.6, 1, eio(t / 6)), fy = lerp(980, 640, eio(t / 6));
  g.save(); g.translate(W / 2, fy); g.scale(z, z); g.translate(-W / 2, -640);
  zigBab(g, W * .86, 640, 420, 520, '#b8956a', '#1f4fa8');
  g.drawImage(GATE(), W / 2 - 520, 640 - 708, 1040, 708);
  g.fillStyle = vgrad(g, 640, 1400, [[0, '#cdb38a'], [1, '#8a7050']]); g.fillRect(-W, 640, W * 3, 1200);
  g.strokeStyle = rgba('#000', .12); g.lineWidth = 2; for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 12, 640); g.lineTo(W / 2 + i * 160, 1400); g.stroke(); }
  for (let i = 0; i < 18; i++) { const side = i % 2 ? 1 : -1, d = (i >> 1); person(g, W / 2 + side * (170 + d * 30), 700 + d * 12, .35 + d * .03, rgba(['#7a2a1a', '#2a3a6a', '#6a4a20', '#e8dcc0'][i % 4], .95), { ph: t * 4 + i, arm: (i % 3 === 0) && Math.sin(t * 6 + i) > 0, flip: side > 0 }); }
  // procession with golden statue
  const pr = ss(7, 14, t); if (pr > 0) { const py = lerp(660, 760, pr); g.save(); g.translate(W / 2, py); g.scale(.5, .5); g.fillStyle = '#6a3a1a'; g.fillRect(-70, -20, 140, 18); g.fillStyle = '#ffd25a'; rr(g, -18, -120, 36, 100, 10); circ(g, 0, -134, 16); g.fillStyle = '#c0392b'; poly(g, [-80, -150, 80, -150, 60, -170, -60, -170]); line(g, [-70, -150, -70, -20], 4, '#3a2a1a'); line(g, [70, -150, 70, -20], 4, '#3a2a1a'); for (let k = -1; k <= 1; k += 2) { person(g, k * 50, 40, 1, '#2a6a3a', { ph: t * 6 }); } g.restore(); }
  ali(g, W / 2, 780, .4, { view: 'back', sit: 1 });
  g.restore();
  rays(g, W * .5, H * .1, t, '#ffe0a8', .08);
  dust(g, t, '#ffe7b8', .7);
  // reaction close-up
  if (t > 4 && t < 9) { const a = ss(4, 4.4, t) * (1 - ss(8.6, 9, t)); g.save(); g.globalAlpha = a; g.fillStyle = vgrad(g, 0, H, [[0, '#1d3a78'], [1, '#2a1a10']]); g.fillRect(0, 0, W, H); glow(g, W / 2, H * .3, 800, '#ffd08a', .35); const glimmer = Math.sin(t * 3); g.save(); g.translate(W / 2, H + 230); ali(g, 0, 0, 4.2, { view: 'front', look: 0, mouth: t > 5 && t < 8.6 ? Math.abs(Math.sin(t * 8)) * .5 : 0, brow: 4, tear: clamp((t - 6.5) / 1.5) }); g.restore(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#5aa0ff', .25 + glimmer * .05); ell(g, W / 2 - 36, H + 230 - 192 * 4.2, 14, 12); ell(g, W / 2 + 36, H + 230 - 192 * 4.2, 14, 12); g.restore(); }
});
// 18: brickyard + market with Nupta
scene(138, 150, (g, t) => {
  if (t < 5) {
    g.fillStyle = vgrad(g, 0, H, [[0, '#3a2414'], [1, '#1a0e06']]); g.fillRect(0, 0, W, H);
    g.fillStyle = '#5a3a22'; g.beginPath(); g.moveTo(W * .66, 900); g.lineTo(W * .66, 500); g.quadraticCurveTo(W * .8, 300, W * .94, 500); g.lineTo(W * .94, 900); g.fill();
    g.fillStyle = '#ff9a3a'; g.beginPath(); g.roundRect(W * .74, 660, W * .12, 240, [100, 100, 0, 0]); g.fill(); glow(g, W * .8, 760, 500, '#ff8a2a', .55 + .1 * Math.sin(t * 13));
    for (let i = 0; i < 14; i++) { g.fillStyle = i % 3 === 0 ? '#2456b5' : '#a8774a'; g.fillRect(150 + (i % 7) * 72, 900 - Math.floor(i / 7) * 34, 66, 30); }
    for (let i = 0; i < 7; i++) { g.fillStyle = '#2456b5'; g.fillRect(150 + (i % 7) * 72, 832 - 0, 66, 30); }
    g.fillStyle = '#6a4428'; g.fillRect(0, 930, W, H);
    const st = Math.max(0, Math.sin(t * 4)); person(g, W * .5, 940, 1.4, '#20140a', { arm: st > .5 });
    g.fillStyle = '#a8774a'; g.fillRect(W * .5 + 10, 900, 90, 34); g.fillStyle = '#3a2414'; g.fillRect(W * .5 + 30, 820 + st * 60, 50, 24);
    nupta(g, W * .26, 1050, 1.5, { look: .6 }); ali(g, W * .36, 1050, 1.5, { view: 'front', look: -.5, mouth: t > 3 ? .2 : 0 });
    g.save(); g.translate(W * .31, 880); g.fillStyle = '#1f4fa8'; rr(g, -60, -40, 120, 80, 6); g.scale(.5, .5); animal(g, 'lion', 40, 50, .9, true, '#efe9da', '#e3a63a'); g.restore();
    dust(g, t, '#ffb060', .5);
  } else {
    const p = t - 5;
    sky(g, [[0, '#e8c48a'], [1, '#b88a56']]); g.fillStyle = '#7a4a2a'; g.fillRect(0, 0, W, 170);
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#1f4fa8' : '#e8d4a8'; poly(g, [i * 230 - 40, 100, i * 230 + 190, 100, i * 230 + 200, 220, i * 230 - 50, 220]); }
    g.fillStyle = '#5c3b22'; g.fillRect(0, 580, W, 500);
    const items = [['تمر', '#5a2a14'], ['خبز شعير', '#d8a860'], ['سمك الفرات', '#8a9aa0'], ['دهن السمسم', '#c9902a'], ['عدس وبصل', '#b86a4a']];
    items.forEach(([nm, c], i) => { const x = 220 + i * 370, a = ss(.2 + i * .45, .6 + i * .45, p); g.save(); g.globalAlpha = a; g.translate(x, 560 + (1 - a) * 40); g.fillStyle = '#8a6440'; ell(g, 0, 0, 150, 38); const r = rng(i + 50);
      if (i === 3) { g.fillStyle = c; for (let k = -1; k <= 1; k++) { ell(g, k * 80, -70, 42, 60); g.fillRect(k * 80 - 16, -150, 32, 30); } }
      else if (i === 1) { for (let k = 0; k < 5; k++) { g.fillStyle = shade(c, k * .04); ell(g, -80 + k * 40, -20 - (k % 2) * 30, 50, 18); } }
      else if (i === 2) { for (let k = 0; k < 6; k++) { g.fillStyle = shade(c, r() * .2); ell(g, -60 + (k % 3) * 60, -15 - Math.floor(k / 3) * 26, 50, 14, .1); } }
      else for (let k = 0; k < 60; k++) { const aa = r() * Math.PI, rr2 = r(); g.fillStyle = shade(c, (r() - .5) * .4); circ(g, Math.cos(aa) * 120 * rr2, -10 - Math.sin(aa) * 90 * rr2, i === 0 ? 12 : 15); }
      g.restore(); chip(g, x, 650, nm, a, '#fff4dc', '#2a1a0e', 38); });
    nupta(g, W * .6, 1080, 1.25, { look: -.6 }); ali(g, W * .45, 1080, 1.25, { view: 'front', look: .6, mouth: p > 4 ? Math.abs(Math.sin(p * 8)) * .4 : 0 });
    dust(g, t, '#fff0cc', .5);
  }
});
// 19: night rooftop
scene(150, 157, (g, t) => {
  sky(g, [[0, '#060a1e'], [.7, '#14204a'], [1, '#2a2a4a']]);
  const r = rng(77); for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H * .7, s = r() * 2.2 + .4; g.fillStyle = rgba('#fff', .3 + .6 * Math.abs(Math.sin(t * 1.5 + i))); circ(g, x, y, s); }
  g.fillStyle = '#ffd9a0'; circ(g, W * .78, 200, 6); g.fillStyle = '#ffb0a0'; circ(g, W * .62, 150, 4.5);
  g.fillStyle = '#fff4dc'; circ(g, W * .2, 180, 50); g.fillStyle = '#060a1e'; circ(g, W * .2 + 20, 170, 46);
  zigBab(g, W * .8, 760, 520, 560, '#1a1630', '#14204a');
  for (let i = 0; i < 12; i++) house(g, i * 170 - 40, 820, 180, 120 + (i * 53) % 100, '#16142a', 300 + i, { beam: 1 });
  for (let i = 0; i < 18; i++) { const x = (i * 113) % W, y = 700 + (i * 37) % 120; glow(g, x, y, 30, '#ffb050', .5 + .2 * Math.sin(t * 5 + i)); }
  g.fillStyle = '#100c1a'; g.fillRect(0, 880, W, H);
  glow(g, W * .5, 900, 260, '#ffb050', .5 + .1 * Math.sin(t * 9)); g.fillStyle = '#ffcf70'; ell(g, W * .5, 880, 10, 14);
  const pointing = t < 3;
  ali(g, W * .58, 1040, 1.4, { view: 'front', look: -.6, mouth: t > 3.5 && t < 6 ? Math.abs(Math.sin(t * 8)) * .4 : 0 });
  nupta(g, W * .42, 1040, 1.4, { look: .6 });
  if (pointing) line(g, [W * .42 + 34, 1040 - 210, W * .42 + 80, 1040 - 300], 14, '#9b3d25');
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba('#3a3a7a', .55); g.fillRect(0, 0, W, H); g.restore();
  glow(g, W * .5, 880, 420, '#ffb050', .25);
  battery(g, W - 260, 150, 0, ss(3.4, 3.8, t));
});
// 20: dissolve – bricks fly like birds
scene(157, 161, (g, t) => {
  g.fillStyle = mixc('#0a1030', '#fff6e0', ss(1, 4, t)); g.fillRect(0, 0, W, H);
  const r = rng(91);
  for (let i = 0; i < 220; i++) {
    const x0 = r() * W, y0 = 300 + r() * 800, delay = r() * 1.5, p = clamp((t - delay) / 2.4), fl = Math.sin(t * 18 + i) * .6;
    const x = x0 + Math.sin(i) * 300 * p, y = y0 - p * p * 1300;
    g.save(); g.translate(x, y); g.rotate(i + t * (1 + r())); g.scale(1, p > 0 ? .4 + .6 * Math.abs(fl) : 1); g.globalAlpha = 1 - p * .6;
    g.fillStyle = i % 4 === 0 ? '#e2a93b' : i % 3 === 0 ? '#cfa676' : '#1f4fa8'; g.fillRect(-26, -12, 52, 24); g.restore();
  }
});
// 21: home again
scene(161, 170, (g, t) => {
  if (t < 3.2) {
    sky(g, [[0, '#2a2438'], [1, '#6a4a48']]); glow(g, W * .85, H * .2, 800, '#ffc080', .5);
    const ang = t * t * 3;
    g.save(); g.translate(W / 2, H / 2 - 120); g.scale(.8, .5); for (let k = 0; k < 5; k++) { g.globalAlpha = k ? .12 : 1; for (let b = 0; b < 3; b++) { g.save(); g.rotate(ang + b * TAU / 3 - k * .1 * clamp(t)); g.fillStyle = '#3a3036'; ell(g, 250, 0, 230, 52); g.restore(); } } g.globalAlpha = 1; g.fillStyle = '#2a2228'; circ(g, 0, 0, 70); g.restore();
    ali(g, W / 2, H + 40, 2.8, { view: 'front', mouth: t > .6 && t < 2.6 ? Math.abs(Math.sin(t * 9)) * .9 : .1, brow: 5, armUp: ss(.4, .8, t) });
    const pings = Math.floor(clamp((t - 1.2) / 2) * 6); for (let i = 0; i < pings; i++) chip(g, 300 + (i % 2) * 120, 220 + i * 90, '🔔', 1, '#fff', '#000', 40);
  } else {
    const p = t - 3.2;
    g.fillStyle = vgrad(g, 0, H, [[0, '#4a3438'], [1, '#2a1c1e']]); g.fillRect(0, 0, W, H);
    glow(g, W * .7, H * .2, 900, '#ffc080', .35);
    const lift = eo(p / 1.4), base = '#c49a6a';
    g.save(); g.translate(0, (1 - lift) * 500);
    g.fillStyle = OLIVE; rr(g, W / 2 - 520, 860, 300, 240, 60); rr(g, W / 2 + 220, 860, 300, 240, 60);
    tablet(g, W / 2, H / 2 + 60, 1.4, base);
    g.save(); g.translate(W / 2 + 60, H / 2 + 80); g.fillStyle = shade(base, -.35); ell(g, 0, 30, 56, 64); [[-50, -50, -.4], [-20, -74, -.1], [11, -76, .1], [40, -60, .35], [70, 0, 1.0]].forEach(([x, y, r]) => ell(g, x, y, 14, 35, r)); g.restore();
    g.save(); g.translate(W / 2 - 160, H / 2); g.strokeStyle = shade(base, -.45); g.lineWidth = 9; g.beginPath(); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI; g.moveTo(Math.cos(a) * 46, Math.sin(a) * 46); g.lineTo(-Math.cos(a) * 46, -Math.sin(a) * 46); } g.stroke(); g.restore();
    g.fillStyle = SKIN; rr(g, W / 2 - 300, H / 2 + 140, 130, 90, 40); rr(g, W / 2 + 170, H / 2 + 140, 130, 90, 40);
    g.restore();
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#5aa0ff', .8 * ss(3, 4, p) * (.6 + .4 * Math.sin(p * 6))); circ(g, W / 2 + 230, H / 2 - 120, 5); g.restore();
  }
});
// 22: final words to camera
scene(170, 180, (g, t) => {
  sky(g, [[0, '#5a4a5a'], [1, '#c08a6a']]); glow(g, W * .8, H * .25, 900, '#ffd09a', .55);
  g.fillStyle = '#3a2a2a'; g.fillRect(0, 760, W, H);
  g.fillStyle = '#d8d0c0'; g.fillRect(W * .7, 260, 330, 260); g.fillStyle = '#ffe8c0'; g.fillRect(W * .7 + 12, 272, 306, 236);
  const talk = (t > .4 && t < 4.6) || (t > 5 && t < 9.4);
  g.save(); g.translate(W * .42, H + 60); ali(g, 0, 0, 3.2, { view: 'front', look: 0, mouth: talk ? Math.abs(Math.sin(t * 8.5)) * .55 : 0, brow: 2 }); g.restore();
  g.save(); g.translate(W * .42 + 120, H - 230); g.scale(.22, .22); tablet(g, 0, 0, 1, '#c49a6a'); g.restore();
});
// 23: aerial rivers + ghosts
scene(180, 190, (g, t) => {
  sky(g, [[0, '#2a2a5a'], [.4, '#d88a5a'], [.6, '#ffd09a'], [1, '#c8a070']]);
  glow(g, W * .5, H * .32, 900, '#ffd08a', .55);
  g.fillStyle = vgrad(g, H * .4, H, [[0, '#b08a60'], [1, '#6a5030']]); g.fillRect(0, H * .4, W, H);
  const r = rng(5); for (let i = 0; i < 40; i++) { g.fillStyle = rgba(r() > .5 ? '#5a7a3a' : '#8a6a40', .35); ell(g, r() * W, H * .45 + r() * H * .55, 60 + r() * 140, 10 + r() * 24); }
  const pan = t * 6;
  const river = (pts, w) => { g.beginPath(); g.moveTo(pts[0], pts[1] + pan); g.bezierCurveTo(pts[2], pts[3] + pan, pts[4], pts[5] + pan, pts[6], pts[7] + pan); g.lineWidth = w; g.strokeStyle = '#ffd590'; g.shadowColor = '#ffe2a8'; g.shadowBlur = 30; g.stroke(); g.shadowBlur = 0; g.lineWidth = w * .5; g.strokeStyle = '#fff2cc'; g.stroke(); };
  river([W * .18, H * .44, W * .3, H * .7, W * .4, H * .8, W * .62, H * 1.08], 26);
  river([W * .55, H * .43, W * .7, H * .62, W * .6, H * .85, W * .66, H * 1.08], 22);
  const ga = ss(1.5, 4, t) * (1 - ss(8.5, 10, t)) * .55;
  g.save(); g.globalAlpha = ga; g.globalCompositeOperation = 'screen';
  zigUr(g, W * .25, H * .55 - ga * 60, 560, 320, { front: '#ffd9a8', side: '#e0a878', top: '#fff0d0', stair: '#f0c090', shrine: '#ffe0b8' });
  g.drawImage(GATE(), W * .58, H * .55 - 360 - ga * 60, 560, 381);
  g.restore();
  rays(g, W * .5, H * .3, t, '#ffe0a8', .1);
  dust(g, t, '#ffe7b8', .7);
  g.fillStyle = rgba('#000', ss(9, 10, t)); g.fillRect(0, 0, W, H);
});

// ---------- subtitles ----------
const SUBS = [
  { s: .4, e: 5.6, t: 'تخيّل تصحى باچر الصبح…' },
  { s: 6.3, e: 8.9, t: '«شنو هذا الصوت؟!»', who: 'علي' },
  { s: 9.3, e: 13, t: 'بس مو بالعراق اللي تعرفه… بغداد مو موجودة!' },
  { s: 13.4, e: 17.4, t: 'رجعت بالزمن 4000 سنة… إنت هسّه عايش بين السومريين!' },
  { s: 18.2, e: 23.6, t: 'ماذا لو كنت تعيش في بلاد الرافدين قبل 4000 سنة؟', k: 'title' },
  { s: 24.2, e: 28.4, t: 'أور', t2: 'حوالي 2050 قبل الميلاد', k: 'card' },
  { s: 29.2, e: 32.6, t: '«عمي والله آني ما أفتهم ولا كلمة!»', who: 'علي' },
  { s: 32.8, e: 35.9, t: 'السومرية لغة ما إلها أي قريب من لغات اليوم.', k: 'fact' },
  { s: 36.4, e: 40.8, t: 'ماكو عملة معدنية… الفضة توزن بالميزان!' },
  { s: 41, e: 45.8, t: 'ووحدة الوزن اسمها «شيقل»… نفس الكلمة بعدها مستعملة لهسّه!', k: 'fact' },
  { s: 46.4, e: 50.2, t: 'لو-نانا: ولد سومري شقي… وصار أول صديق لعلي.' },
  { s: 50.3, e: 53.8, t: 'بين دجلة والفرات حفروا قنوات… وبالقنوات صنعوا مدن.' },
  { s: 54.4, e: 58.8, t: 'تدري شنو جانت أول كتابة بالتاريخ؟' },
  { s: 59, e: 63.8, t: 'حسابات! كم گونية شعير… كم راس غنم. وبدأت بأوروك قبل 5000 سنة.', k: 'fact' },
  { s: 64.3, e: 68, t: 'بالمدرسة… «بيت الألواح». وحتى العصا موجودة!' },
  { s: 68.6, e: 75.8, t: 'حسبوا بالستين… ومنهم وصلتنا الساعة 60 دقيقة والدائرة 360 درجة.', k: 'fact' },
  { s: 76.4, e: 80, t: 'الزقورة مو قبر ولا هرم… فوگها معبد إله القمر «نانا».', k: 'fact' },
  { s: 80.2, e: 83, t: 'وهنا انكتبت قوانين «أور-نمّو»… أقدم من حمورابي بـ300 سنة!', k: 'fact' },
  { s: 83.2, e: 85.8, t: 'لو-نانا يهدي علي لوح… عليه كف إيده الصغيرة.' },
  { s: 86.3, e: 89.8, t: 'تمشي 300 سنة… ونجمة جديدة تطلع بالشمال: بابل.' },
  { s: 90.3, e: 93.6, t: 'بابل', t2: 'عهد حمورابي · حوالي 1755 قبل الميلاد', k: 'card' },
  { s: 93.8, e: 96.6, t: '«وين البوابة الزرقاء؟ وين الأسود؟!»', who: 'علي' },
  { s: 96.8, e: 100.6, t: 'اصبر… البوابة بعدها ما انبنت! باقي عليها 1200 سنة.' },
  { s: 100.8, e: 103.9, t: 'الأكدية لغة سامية: «شُلْمُم» = سلام · «بيتُم» = بيت · «شَمشُم» = شمس', k: 'fact' },
  { s: 104.3, e: 108.8, t: 'شريعة حمورابي: حوالي 282 مادة… «حتى القوي ما يظلم الضعيف».', k: 'fact' },
  { s: 109, e: 113.8, t: 'واللي عنده مظلومية… ييجي گدام المسلة ويقرولَه حقّه.' },
  { s: 114.3, e: 118.6, t: 'بابل وگعت وگامت أكثر من مرة… وبعد 1200 سنة…' },
  { s: 119.3, e: 123.6, t: 'بابل', t2: 'عهد نبوخذنصر الثاني · حوالي 575 قبل الميلاد', k: 'card' },
  { s: 128.6, e: 132.8, t: '«معقولة كل هذا الجمال كان هنا… بأرض العراق؟»', who: 'علي' },
  { s: 133, e: 137.8, t: 'الثور رمز «أدد» · التنين «موشخوشو» رمز «مردوخ» · الأسد رمز «عشتار»', k: 'fact' },
  { s: 138.3, e: 140.6, t: 'هاي نُبتا… عائلتها تسوّي الطابوق المزجّج.' },
  { s: 140.7, e: 142.8, t: 'وكل طابوقة تنختم باسم الملك نبوخذنصر!', k: 'fact' },
  { s: 143.2, e: 146.4, t: 'بابل جانت مدينة عالمية… تجار وناس من كل مكان.' },
  { s: 146.6, e: 149.8, t: 'الحضارة مو بس ملوك وقصور… ناس عاديين صنعوا تاريخ مو عادي.' },
  { s: 150.3, e: 153.2, t: 'وبابل سجّلت السما كل ليلة… لقرون. من أطول السجلات العلمية بالتاريخ.', k: 'fact' },
  { s: 153.4, e: 155.2, t: '«شْلام…»', who: 'نُبتا' },
  { s: 155.3, e: 156.9, t: '«…سلام.»', who: 'علي' },
  { s: 161.4, e: 164, t: '«إجت الكهرباء!»', who: 'علي' },
  { s: 165, e: 169.6, t: '«جان حلم…؟»', who: 'علي' },
  { s: 170.3, e: 174.9, t: '«إحنا مو مجرد ناس نعيش على أرض قديمة… إحنا نعيش على أرض كتبت بداية فصول عظيمة من تاريخ البشرية.»', who: 'علي' },
  { s: 175.1, e: 179.6, t: '«تخيّل شكد أشياء بعدنا ما نعرفها عن تاريخنا!»', who: 'علي' },
  { s: 181, e: 188.8, t: 'هنا لم تبدأ حكاية العراق فقط… هنا كُتبت فصول من حكاية الحضارة الإنسانية', k: 'end' },
];

function renderFrame(t, fi = 0) {
  G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
  G.fillStyle = '#000'; G.fillRect(0, 0, W, H);
  for (const sc of S) if (t >= sc.s && t < sc.e) { G.save(); sc.f(G, t - sc.s, sc.e - sc.s); G.restore(); }
  // scene-cut fades (short dip)
  for (const sc of S) { const d = Math.min(Math.abs(t - sc.s), 99); if (d < .12 && sc.s > 0) { G.fillStyle = rgba('#000', (1 - d / .12) * .5); G.fillRect(0, 0, W, H); } }
  post(G, t, fi);
  for (const sb of SUBS) if (t >= sb.s && t < sb.e) { const a = ss(sb.s, sb.s + .3, t) * (1 - ss(sb.e - .3, sb.e, t)); drawSub(G, sb, a, (1 - ss(sb.s, sb.s + .4, t)) * 18); }
  if (t < .25) { G.fillStyle = rgba('#000', 1 - t / .25); G.fillRect(0, 0, W, H); }
}
window.renderFrame = renderFrame; window.DURATION = DURATION;
window.ready = document.fonts.ready.then(() => Promise.all(['700 50px Cairo', '800 50px Cairo', '600 50px Cairo', '700 50px "Reem Kufi"'].map(f => document.fonts.load(f, 'بابل 2050 گچ')))).then(() => { GATE(); LIONWALL(); return true; });
