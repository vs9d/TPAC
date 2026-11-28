// Timeline of the 10-minute film. Each scene: [start, end, fn(g, lt, dur, t)]
const DUR24 = 600, L0 = 86399; // countdown seconds at 6:00:00
const S24 = [];
const sc = (s, e, f) => S24.push({ s, e, f });
function camz(g, z, cx = W / 2, cy = H / 2) { g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-cx, -cy); }
function bedroomBase(g, t, dawn = .6, z = 1, cy = H / 2) {
  g.save(); camz(g, z, W / 2, cy);
  room(g, '#0c1220', '#111a2c', '#0a0d14', 860);
  windowFrame(g, 1240, 220, 420, 460, mixh('#2a4a78', '#9ab8d8', dawn), 1);
  beam(g, 1450, 680, 900, 1500, 1080, '#9ab8d8', .08 * dawn);
  g.fillStyle = '#0e121c'; g.fillRect(260, 640, 900, 240); g.fillStyle = '#151b28'; rr(g, 280, 600, 860, 90, 30); g.fillStyle = '#1c2434'; rr(g, 300, 580, 200, 60, 26);
  g.fillStyle = '#0b0e16'; g.fillRect(150, 560, 120, 300); g.fillStyle = '#121724'; g.fillRect(140, 548, 140, 16);
  g.restore();
}
// ===================== CHAPTER 1 =====================
sc(0, 3, (g, lt) => {
  g.fillStyle = '#020306'; g.fillRect(0, 0, W, H);
  const on = lt > .5, v = on ? Math.sin(lt * 60) * 3 : 0;
  if (on) { glow(g, W / 2, 140, 900, '#6f9fe0', .25 * ss(.5, .9, lt)); }
  g.fillStyle = '#0d0f15'; g.fillRect(0, 700, W, 380); g.fillStyle = '#151924'; g.fillRect(0, 690, W, 14);
  g.save(); g.translate(W / 2 + v, 690); g.fillStyle = '#0a0b0f'; rr(g, -120, -22, 240, 22, 8); g.restore();
  if (on) { glow(g, W / 2, 690, 380, '#8cb8ff', .45); g.fillStyle = rgba('#bcd8ff', .5); g.fillRect(W / 2 - 118 + v, 688, 236, 3); }
  mug(g, W / 2 + 420, 690, 1.2, lt, 0);
});
sc(3, 7, (g, lt) => {
  const k = Math.min(4, Math.floor(lt / .8)), p = (lt % .8) / .8;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (k === 0) { const w = 40 + p * 340; g.fillStyle = vgrad(g, 0, H, [[0, '#ffd8a0'], [1, '#c8702a']]); g.fillRect(W / 2 - w / 2, 120, w, 840); person(g, W / 2 - w / 2 + 60, 960, 2.2, { kind: 'mother', col: '#050505', shadow: false }); }
  if (k === 1) { g.fillStyle = vgrad(g, 0, H, [[0, '#e8a060'], [1, '#5a3020']]); g.fillRect(0, 0, W, H); for (let i = 0; i < 30; i++) { g.fillStyle = rgba('#000', .3); g.fillRect(((i * 197 - p * 2400) % 2200 + 2200) % 2200 - 140, 300 + (i % 5) * 70, 160, 500); } person(g, W / 2, 980, 2.2, { pose: 'run', walk: lt * 14, col: '#07070a' }); }
  if (k === 2) { g.fillStyle = vgrad(g, 0, H, [[0, '#3a2a5a'], [.6, '#f08a4a'], [1, '#ffd09a']]); g.fillRect(0, 0, W, H); glow(g, W * .62, 640, 300, '#fff0c0', .9); skyline(g, 820, 7, '#120a10', 80, 300); person(g, W * .4 + p * 30, 1000, 1.6, { pose: 'sit', col: '#050306' }); }
  if (k === 3) { phone(g, W / 2, H / 2, 1.35, 'countdown', { left: 3, clock: '5:59' }, .05); }
  if (k === 4) { eye(g, W / 2, H / 2, 2.6, ss(0, .7, p), '#8fc4ff', lt); }
  fadeBlack(g, 0); if (p < .12) { g.fillStyle = rgba('#fff', (1 - p / .12) * .6); g.fillRect(0, 0, W, H); }
});
sc(7, 12, (g, lt) => {
  bedroomBase(g, lt, .25 + lt * .04, lerp(1.25, 1.05, eio(lt / 5)), lerp(420, 560, eio(lt / 5)));
  g.save(); camz(g, lerp(1.25, 1.05, eio(lt / 5)), W / 2, lerp(420, 560, eio(lt / 5)));
  g.fillStyle = '#0a0e17'; g.beginPath(); g.moveTo(480, 640); g.quadraticCurveTo(800, 560 + Math.sin(lt * 1.2) * 4, 1130, 640); g.lineTo(1130, 700); g.lineTo(480, 700); g.fill();
  g.fillStyle = '#05070b'; circ(g, 420, 600, 34); for (let k = 0; k < 5; k++) circ(g, 398 + k * 10, 572 + (k % 2) * 4, 12);
  g.fillStyle = '#0a0b0f'; rr(g, 170, 538, 70, 12, 4); glow(g, 205, 540, 160, '#8cb8ff', .45);
  g.restore(); motes(g, lt, '#a8c4ec', 40, 4, .3);
});
sc(12, 16, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#070a12'], [1, '#0e1422']]); g.fillRect(0, 0, W, H);
  const z = lerp(1, 1.12, eio(lt / 4)); g.save(); camz(g, z, W / 2 + 80, H / 2);
  phone(g, W / 2 + 120, H / 2 + 30, 1.25, 'message', { left: L0 - Math.floor(lt), clock: '6:00' }, -.06);
  g.restore();
  g.save(); g.filter = 'blur(10px)'; person(g, 260, 1500, 4.5, { pose: 'sit', col: '#030407', shadow: false }); g.restore();
});
sc(16, 22, (g, lt) => {
  g.fillStyle = '#04060b'; g.fillRect(0, 0, W, H);
  glow(g, 1260, 900, 700, '#7fb2ff', .3 + .05 * Math.sin(lt * 3));
  profileHead(g, 900 + lt * 6, 560, 1.9, '#86b6ff');
  g.save(); g.translate(1330, 930); g.rotate(-.5); g.fillStyle = '#0b0c10'; rr(g, -70, -130, 140, 260, 20); g.fillStyle = rgba('#a8ccff', .9); rr(g, -60, -120, 120, 240, 14); g.restore();
  motes(g, lt, '#a8c4ec', 50, 8, .25);
});
sc(22, 30, (g, lt) => {
  bedroomBase(g, lt, .5, 1.02 + lt * .004);
  person(g, 760, 870, 1.25, { pose: 'sit', arm: 'phoneLook', phone: 1, rim: '#7fa8d8', rimDx: 5 });
  const blink = Math.floor(lt * 2) % 2; g.fillStyle = '#0c0e14'; rr(g, 150, 506, 110, 50, 8); g.font = '700 30px "Courier New", monospace'; g.direction = 'ltr'; g.textAlign = 'center'; g.fillStyle = lt < 2 ? (blink ? '#ff3a2a' : '#5a0f0a') : '#ff3a2a'; g.fillText('06:00', 205, 540);
  if (lt < 2) glow(g, 205, 532, 120, '#ff3a2a', .3 * blink);
});
sc(30, 38, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#0a1020'], [1, '#05070c']]); g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.rotate(lt * .012); g.translate(-W / 2, -H / 2);
  profileHead(g, 560, 600, 1.8, '#7aa4dc'); g.fillStyle = '#0b0c10'; g.save(); g.translate(760, 470); g.rotate(.3); rr(g, -30, -110, 60, 200, 14); g.restore(); glow(g, 770, 470, 160, '#8cb8ff', .3);
  g.restore();
  phone(g, 1420, 560, 1.0, lt < 4.5 ? 'call' : 'nosvc', { name: 'رقم غير معروف', clock: '6:01' }, .04);
});
sc(38, 46, (g, lt) => {
  g.fillStyle = '#030408'; g.fillRect(0, 0, W, H);
  const z = lerp(1.6, 1.9, lt / 8); g.save(); camz(g, z, W / 2, H / 2 + 40); phone(g, W / 2, H / 2, 1.2, 'countdown', { left: 86232 - Math.floor(lt), clock: '6:02' }); g.restore();
  g.save(); g.globalAlpha = .16 + .06 * Math.sin(lt); g.globalCompositeOperation = 'screen'; eye(g, W / 2 + 200, H / 2 - 120, 1.4, 1, '#ffd36b', lt, false); g.restore();
});
sc(46, 55, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#0a1222'], [1, '#03050a']]); g.fillRect(0, 0, W, H);
  const z = lerp(1, 1.25, eio(lt / 9)); g.save(); camz(g, z, 980, 520); profileHead(g, 860, 560, 1.7, mixh('#7aa4dc', '#3a5a8a', lt / 9)); g.restore();
  motes(g, lt, '#7a9ad0', 60, 9, .25);
});
sc(55, 60, (g, lt) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const a = ss(.2, 1.2, lt) * (1 - ss(4.2, 5, lt));
  g.save(); g.globalAlpha = a; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 84px Cairo'; g.fillStyle = '#e8ecf2'; g.shadowColor = 'rgba(140,180,255,.35)'; g.shadowBlur = 30;
  g.fillText('ماذا لو أخبروك', W / 2, 470); g.fillText('أن هذه آخر 24 ساعة لك؟', W / 2, 590);
  g.restore();
  g.save(); g.globalAlpha = a * .7; g.fillStyle = '#ffb347'; g.fillRect(W / 2 - 160 * ss(.6, 2, lt), 664, 320 * ss(.6, 2, lt), 3); g.restore();
});
// ===================== CHAPTER 2 =====================
sc(60, 74, (g, lt) => {
  room(g, '#1a1e26', '#23262e', '#14161b', 820);
  const lx = lerp(1500, 300, lt / 14); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#e8d8b8', .16); poly(g, [lx, 820, lx + 380, 820, lx + 520, 1080, lx + 80, 1080]); g.restore();
  windowFrame(g, 1500, 160, 300, 360, '#c8c4b8', .8);
  g.fillStyle = '#101218'; g.fillRect(200, 600, 1000, 230); g.fillStyle = '#181b22'; rr(g, 210, 560, 980, 80, 28);
  person(g, 620, 900, 1.6, { pose: 'floor', arm: 'knee', rim: '#a8a090', rimDx: 4 });
  mug(g, 1120, 900, 1.3, lt, 1);
  motes(g, lt, '#f0e0c0', 60, 11, .35);
});
sc(74, 81, (g, lt) => {
  const px = lt * 70; room(g, '#1c1f26', '#262931', '#15171c', 760);
  g.fillStyle = '#0f1116'; g.fillRect(0, 640, W, 30);
  g.save(); g.translate(-px, 0);
  mug(g, 420, 640, 1.6, lt, 0); g.fillStyle = '#d4a24e'; g.fillRect(400, 560, 40, 6);
  guitar(g, 1020, 680, 1.15);
  g.fillStyle = '#2a2a30'; g.save(); g.translate(1620, 640); g.rotate(-.04); rr(g, -150, -30, 300, 30, 4); g.fillStyle = '#7a5a3a'; rr(g, -146, -24, 292, 20, 3); g.restore();
  g.restore();
  beam(g, 1800, 0, 900, 1700, 760, '#f0e0c0', .1); motes(g, lt, '#f0e0c0', 90, 12, .4, [0, 0, W, 760]);
});
sc(81, 88, (g, lt) => {
  g.fillStyle = '#16140f'; g.fillRect(0, 0, W, H);
  const flip = ss(3.6, 4.6, lt), sep = ss(4.2, 6.5, lt);
  g.save(); g.translate(W / 2, H / 2); g.rotate(-.05);
  g.fillStyle = mixh('#d8ccb0', '#e8c890', sep); rr(g, -520, -300, 1040, 600, 10);
  g.strokeStyle = rgba('#3a2a1a', .5); g.lineWidth = 3; for (let i = 0; i < 9; i++) { const y = -220 + i * 56, w = 260 + ((i * 37) % 160); g.beginPath(); g.moveTo(-460, y); g.bezierCurveTo(-360, y - 6, -200, y + 6, -460 + w, y); g.stroke(); g.beginPath(); g.moveTo(60, y); g.bezierCurveTo(150, y - 5, 250, y + 5, 60 + w * .9, y); g.stroke(); }
  g.fillStyle = rgba('#000', .25); g.fillRect(-6, -300, 12, 600);
  if (flip > 0 && flip < 1) { g.save(); g.scale(1 - 2 * Math.abs(flip - .5) * 0 + Math.cos(flip * Math.PI), 1); g.fillStyle = '#e8dcc0'; rr(g, 0, -300, 520, 600, 8); g.restore(); }
  g.restore();
  g.save(); g.globalAlpha = .9; g.translate(W / 2 + 300 + Math.sin(lt * 5) * 40, H / 2 + 150); g.rotate(-.6); g.fillStyle = '#0a0806'; rr(g, -12, -260, 24, 280, 8); g.restore();
  if (sep > 0) filmFrame(g, sep);
});
sc(88, 96, (g, lt) => {
  room(g, '#5a3a22', '#3a2416', '#2a1a10', 820);
  [[260, 200, '#8aa0b0'], [560, 240, '#c8a060'], [1500, 210, '#a07060']].forEach(([x, y, c], i) => { g.fillStyle = c; g.fillRect(x, y, 220, 150); g.fillStyle = rgba('#000', .35); if (i === 0) poly(g, [x + 20, y + 140, x + 100, y + 40, x + 170, y + 140]); if (i === 1) { circ(g, x + 160, y + 50, 26); g.fillRect(x + 20, y + 110, 180, 30); } if (i === 2) { g.fillRect(x + 30, y + 60, 40, 80); g.fillRect(x + 90, y + 30, 40, 110); g.fillRect(x + 150, y + 80, 40, 60); } });
  g.fillStyle = '#1a100a'; g.fillRect(820, 640, 560, 26); g.fillRect(860, 666, 20, 220); g.fillRect(1320, 666, 20, 220);
  glow(g, 1260, 600, 300, '#ffc070', .6); g.fillStyle = '#1a100a'; g.fillRect(1250, 520, 10, 120); poly(g, [1210, 520, 1300, 520, 1280, 480, 1230, 480]);
  person(g, 900, 880, 1.25, { pose: 'sit', arm: 'write', t: lt, kind: 'hero', col: '#1a0f08', rim: '#ffb060', rimDx: 4 });
  g.fillStyle = '#e8d8b0'; g.fillRect(990, 626, 120, 14);
  filmFrame(g, 1); motes(g, lt, '#ffd8a0', 50, 13, .4);
});
sc(96, 103, (g, lt) => {
  g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
  const pw = W / 3;
  for (let i = 0; i < 3; i++) {
    const a = ss(i * 1.6, i * 1.6 + .6, lt); if (a <= 0) continue;
    g.save(); g.beginPath(); g.rect(i * pw + 6, 0, pw - 12, H); g.clip(); g.globalAlpha = a; g.translate((1 - a) * 80, 0);
    if (i === 0) { g.fillStyle = vgrad(g, 0, H, [[0, '#0c1424'], [1, '#05070c']]); g.fillRect(0, 0, pw, H); const cl = ss(1, 2.6, lt); g.save(); g.translate(pw / 2, 700); g.fillStyle = '#0a0b0f'; g.fillRect(-180, 0, 360, 18); g.save(); g.transform(1, 0, 0, Math.cos(cl * 1.4), 0, 0); g.fillStyle = '#16181e'; g.fillRect(-170, -220, 340, 220); g.fillStyle = rgba('#8cb8ff', .5 * (1 - cl)); g.fillRect(-160, -210, 320, 200); g.restore(); g.restore(); glow(g, pw / 2, 600, 260, '#8cb8ff', .25 * (1 - cl)); person(g, pw / 2 - 60, 980, 1.0, { pose: 'sit', arm: 'reach', col: '#030406' }); }
    if (i === 1) { g.fillStyle = vgrad(g, 0, H, [[0, '#1a1416'], [1, '#08060a']]); g.fillRect(0, 0, pw, H); phone(g, pw * 1.5, H / 2, .95, 'incoming', { name: 'صديقي', sub: '' }); const tap = ss(3.6, 4.2, lt); if (tap > 0) { g.fillStyle = rgba('#ff3a2a', .5 * tap); circ(g, pw * 1.5 - 0, H / 2 + 190, 60 * tap); } }
    if (i === 2) { g.fillStyle = vgrad(g, 0, H, [[0, '#1e1a14'], [1, '#0a0806']]); g.fillRect(0, 0, pw, H); const dc = ss(4.4, 6, lt); g.fillStyle = '#2a2018'; g.fillRect(pw * 2 + 60, 560, pw - 120, 260); g.fillStyle = '#3a2c20'; g.fillRect(pw * 2 + 80 + (1 - dc) * 0, 600 - (1 - dc) * 0, pw - 160, 80 + (1 - dc) * 120); g.fillStyle = '#c8a870'; g.fillRect(pw * 2 + pw / 2 - 20, 630 - (1 - dc) * 60, 40, 10); }
    g.restore();
  }
});
sc(103, 110, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#22242a'], [1, '#121317']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a2b31'; g.fillRect(500, 560, 920, 520); g.fillStyle = '#34353c'; g.fillRect(540, 620, 840, 200); g.fillStyle = '#18191d'; g.fillRect(560, 640, 800, 160);
  const hy = lerp(420, 520, eo(lt / 2.2)); g.fillStyle = '#d8ccb0'; g.save(); g.translate(960, hy); g.rotate(-.06); rr(g, -150, -100, 300, 200, 8); g.restore();
  g.fillStyle = DK; g.save(); g.translate(1110, hy + 60); g.rotate(-.3); rr(g, -40, -40, 90, 70, 26); g.fillRect(30, -40, 600, 70); g.restore();
  glow(g, 1170, hy + 40, 18, GLINT, .9);
  beam(g, 1600, 0, 700, 1500, 1080, '#d8e0f0', .08);
});
sc(110, 115, (g, lt) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); eye(g, W / 2, H / 2, 2.4, .75 + .1 * Math.sin(lt), '#cfd8e8', lt); });
sc(115, 120, (g, lt) => {
  room(g, '#1c1f26', '#262931', '#15171c', 860);
  g.fillStyle = vgrad(g, 120, 860, [[0, '#f0e6d0'], [1, '#c8b890']]); g.fillRect(1500, 120, 260, 740); glow(g, 1630, 500, 500, '#f0e0c0', .3);
  person(g, lerp(800, 1380, ss(1, 5, lt)), 900, 1.5, { pose: ss(1, 5, lt) > 0 && lt < 4.8 ? 'walk' : 'stand', walk: lt * 7, rim: '#f0e0c0', rimDx: 5 });
  const a = ss(.3, .8, lt) * (1 - ss(4.3, 4.9, lt)); g.save(); g.globalAlpha = a; g.direction = 'rtl'; g.textAlign = 'center'; g.font = '700 120px Cairo'; g.fillStyle = '#f2f2f2'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 20; g.fillText('لاحقاً', W / 2 - 380, 330);
  const st = ss(1.6, 2.4, lt); g.fillStyle = '#ff4a3a'; g.fillRect(W / 2 - 380 - 190, 300, 380 * st, 12); g.restore();
});
// ===================== CHAPTER 3 =====================
function street(g, lt, scroll, warm = 1) {
  g.fillStyle = vgrad(g, 0, 700, [[0, mixh('#9ec4e0', '#f2d2a0', .3 * warm)], [1, '#f6e2c0']]); g.fillRect(0, 0, W, 760);
  glow(g, W * .8, 160, 500, '#fff2cc', .6);
  g.save(); g.translate(-(scroll * .3 % 1600), 0); skyline(g, 760, 31, '#c8b49a', 120, 260, 120, 220, .0); skyline(g, 760, 31, '#c8b49a', 120, 260, 120, 220, .0); g.restore();
  g.save(); g.translate(-(scroll % 1400), 0);
  for (let k = 0; k < 2; k++) { const r = rng(32); let x = k * 1400; while (x < (k + 1) * 1400) { const w = 220 + r() * 160, h = 320 + r() * 260; g.fillStyle = ['#e2c8a0', '#d8b890', '#ead6b4'][(r() * 3) | 0]; g.fillRect(x, 820 - h, w, h); g.fillStyle = rgba('#000', .1); g.fillRect(x + w - 16, 820 - h, 16, h); for (let fy = 820 - h + 40; fy < 760; fy += 90) { g.fillStyle = '#5a4632'; g.fillRect(x + 30, fy, w - 60, 46); g.fillStyle = '#8a6a4a'; g.fillRect(x + 20, fy + 46, w - 40, 8); g.fillStyle = '#e8e8e8'; g.fillRect(x + w - 70, fy + 6, 34, 22); } if (r() > .5) { g.fillStyle = '#d0d0d0'; ell(g, x + 40, 820 - h - 10, 18, 8); } x += w + 6; } }
  g.restore();
  g.fillStyle = '#b8a890'; g.fillRect(0, 820, W, 80); g.fillStyle = '#6a6460'; g.fillRect(0, 900, W, 180);
  g.save(); g.translate(-(scroll * 1.4 % 900), 0); for (let k = 0; k < 4; k++) { palm(g, 300 + k * 900, 900, 1.1, lt, '#2f4a22', '#5a4126'); } g.restore();
}
sc(120, 133, (g, lt) => {
  street(g, lt, lt * 140);
  person(g, 820, 900, 1.45, { pose: 'walk', walk: lt * 6.5, arm: lt > 6 ? 'phoneLook' : 'down', phone: lt > 6 ? 1 : 0, rim: '#ffe2b0', rimDx: -4, col: '#1a1a20' });
  if (lt > 6.4) { const a = ss(6.4, 7, lt); g.save(); g.globalAlpha = a; phone(g, 1480, 520, .8 + .05 * a, 'incoming', { name: 'أمي', sub: '3 مكالمات فائتة', clock: '12:18' }, .05); g.restore(); }
  grade(g, '#ffb060', .12);
});
sc(133, 148, (g, lt) => {
  const op = eo(lt / 1.2), half = W / 2 * op;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(W / 2 - half, 0, half - 4, H); g.clip();
  g.fillStyle = vgrad(g, 0, H, [[0, '#a8c0d0'], [1, '#d8c8b0']]); g.fillRect(0, 0, W / 2, H); street(g, lt, 0, .6);
  g.fillStyle = rgba('#000', .1); g.fillRect(0, 0, W / 2, H);
  person(g, 640, 1000, 1.7, { pose: 'stand', arm: 'phoneEar', rim: '#ffe2b0', rimDx: -4, col: '#1a1a20' });
  g.restore();
  g.save(); g.beginPath(); g.rect(W / 2 + 4, 0, half, H); g.clip();
  room(g, '#e8c890', '#c89a60', '#8a6440', 820); windowFrame(g, 1300, 200, 340, 300, '#fff0d0', 1, false);
  for (let i = 0; i < 4; i++) { g.fillStyle = '#3a6a2a'; ell(g, 1340 + i * 80, 480, 30, 40); g.fillStyle = '#8a4a2a'; g.fillRect(1325 + i * 80, 490, 30, 30); }
  g.fillStyle = '#6a4a2a'; g.fillRect(960, 700, 960, 40); g.fillStyle = '#5a3a20'; g.fillRect(960, 740, 960, 340);
  person(g, 1560, 1000, 1.6, { kind: 'mother', flip: true, arm: lt > 2.5 ? 'phoneEar' : 'reach', col: '#2a1a12', rim: '#fff0c8', rimDx: -4 });
  g.restore();
  g.fillStyle = '#000'; g.fillRect(W / 2 - 4, 0, 8, H);
});
sc(148, 166, (g, lt) => {
  if (lt < 8) {
    room(g, '#2a1a10', '#1a100a', '#140c06', 900);
    const op = eo(lt / 2); g.fillStyle = vgrad(g, 160, 900, [[0, '#ffe0a8'], [1, '#e8a050']]); g.fillRect(W / 2 - 200 * op - 20, 160, 400 * op + 40, 740);
    glow(g, W / 2, 520, 700, '#ffc070', .4 * op);
    if (lt < 3) person(g, W / 2 - 40, 960, 1.6, { kind: 'mother', flip: true, col: '#1a0e06', arm: 'reach' });
    else { person(g, W / 2 - 60, 960, 1.6, { kind: 'mother', col: '#120a04', arm: 'hug' }); person(g, W / 2 + 40, 960, 1.6, { kind: 'hero', flip: true, col: '#0a0604', arm: 'hug' }); }
    motes(g, lt, '#ffd8a0', 60, 14, .45);
  } else {
    const p = lt - 8, px = p * 40;
    room(g, '#d8b080', '#b88a58', '#6a4a2a', 860);
    g.save(); g.translate(-px, 0); for (let i = 0; i < 6; i++) { g.fillStyle = '#3a2414'; g.fillRect(200 + i * 300, 260 + (i % 2) * 60, 200, 150); g.fillStyle = ['#c8a070', '#a8b8c0', '#d0b090'][i % 3]; g.fillRect(212 + i * 300, 272 + (i % 2) * 60, 176, 126); g.fillStyle = rgba('#000', .3); circ(g, 260 + i * 300, 330 + (i % 2) * 60, 22); circ(g, 330 + i * 300, 336 + (i % 2) * 60, 18); }
    g.restore();
    g.fillStyle = '#4a2a18'; rr(g, 1180, 560, 360, 380, 40); g.fillStyle = '#5a3420'; rr(g, 1150, 700, 420, 140, 30);
    person(g, 1380, 900, 1.35, { kind: 'father', pose: 'sit', arm: 'reach', flip: true, col: '#1a0e08' });
    const lift = Math.sin(p * 1.6) > .6 ? 30 : 0; g.fillStyle = '#e8e0cc'; g.save(); g.translate(1240, 650 + lift); g.rotate(.1); g.fillRect(-90, -70, 180, 130); g.fillStyle = rgba('#000', .3); for (let k = 0; k < 6; k++) g.fillRect(-76, -54 + k * 18, 150, 5); g.restore();
    grade(g, '#ffb060', .15);
  }
});
sc(166, 182, (g, lt) => {
  g.fillStyle = '#3a2416'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.rotate(lt * .01);
  g.fillStyle = '#7a4a28'; rr(g, -760, -340, 1520, 680, 40); g.strokeStyle = rgba('#000', .15); g.lineWidth = 3; for (let i = -700; i < 760; i += 90) { g.beginPath(); g.moveTo(i, -340); g.lineTo(i + 20, 340); g.stroke(); }
  const plates = [[-460, -150, '#d8a040'], [-140, -170, '#c86030'], [180, -150, '#e0c070'], [480, -160, '#9ab050'], [-380, 140, '#d07040'], [0, 160, '#e8b060'], [400, 140, '#c8a060']];
  plates.forEach(([x, y, c], i) => { g.fillStyle = '#f2ece0'; circ(g, x, y, 92); g.fillStyle = '#e0d8c8'; circ(g, x, y, 72); g.fillStyle = c; const r = rng(i); for (let k = 0; k < 10; k++) circ(g, x + (r() - .5) * 90, y + (r() - .5) * 90, 14 + r() * 12); });
  g.fillStyle = '#e8d8b0'; ell(g, 0, 0, 160, 70); g.fillStyle = '#c89a50'; ell(g, 0, 0, 130, 50);
  [[-620, -40], [620, 30], [-80, 290], [260, -300]].forEach(([x, y], i) => { g.save(); g.translate(x, y); g.rotate(i); g.fillStyle = '#0c0c10'; rr(g, -40, -76, 80, 152, 12); g.restore(); });
  for (let i = 0; i < 5; i++) { const a = lt * 1.2 + i * 1.3, hx = Math.cos(i * 1.25) * 560, hy = Math.sin(i * 1.25) * 300, ext = .5 + .5 * Math.sin(a); g.fillStyle = '#b07a54'; g.save(); g.translate(hx * (1 + .25 * (1 - ext)), hy * (1 + .25 * (1 - ext))); g.rotate(Math.atan2(hy, hx) + Math.PI); rr(g, -30, -26, 120, 52, 26); g.restore(); }
  g.restore();
  motes(g, lt, '#ffe0b0', 50, 15, .35); grade(g, '#ffb060', .18);
});
sc(182, 194, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#f2c890'], [1, '#d89860']]); g.fillRect(0, 0, W, H);
  skyline(g, 820, 41, '#c8946a', 100, 300); glow(g, 300, 300, 500, '#fff0c0', .5);
  g.fillStyle = '#2a1a10'; g.fillRect(0, 780, W, 20); for (let x = 20; x < W; x += 60) g.fillRect(x, 800, 10, 200); g.fillRect(0, 990, W, 90);
  person(g, 560, 1080, 1.7, { pose: 'stand', arm: 'phoneLook', phone: 1, col: '#1a0e08', rim: '#ffe0b0', rimDx: -4 });
  const m1 = ss(.8, 1.2, lt), ty = lt > 4 && lt < 7.6, m2 = ss(7.6, 8, lt);
  phone(g, 1380, 540, .95, 'chat', { name: 'سامر', t: lt, typing: ty, msgs: [['وحشتني.', true, m1], ['وينك؟ أنا جاي.', false, m2]], clock: '3:02' }, -.04);
});
sc(194, 210, (g, lt) => {
  room(g, '#4a2a18', '#2a180c', '#20140a', 860);
  g.fillStyle = vgrad(g, 120, 760, [[0, '#7a8a9a'], [1, '#4a5a6a']]); g.fillRect(140, 120, 860, 620); skyline(g, 740, 51, '#3a4652', 120, 380); g.fillStyle = '#20140a'; g.fillRect(140, 420, 860, 14); g.fillRect(560, 120, 14, 620);
  g.save(); g.beginPath(); g.rect(140, 120, 860, 620); g.clip(); const r = rng(9); for (let i = 0; i < 90; i++) { const x = 150 + r() * 840, y = (120 + r() * 600 + lt * (30 + r() * 60)) % 760; g.fillStyle = rgba('#dfe8f0', .35); ell(g, x, y, 3, 5); } g.restore();
  for (let i = 0; i < 4; i++) { glow(g, 1150 + i * 220, 240, 160, '#ffb050', .6); g.fillStyle = '#ffcf80'; ell(g, 1150 + i * 220, 240, 26, 16); g.fillStyle = '#1a0e06'; g.fillRect(1148 + i * 220, 0, 4, 226); }
  person(g, 1620, 860, 1.05, { kind: 'old', pose: 'sit', arm: 'knee', col: '#1a1008', blur: 6 });
  g.fillStyle = '#3a2010'; rr(g, 900, 760, 520, 26, 8); g.fillRect(1140, 780, 30, 160);
  const hug = lt < 5;
  if (hug) { person(g, 1080, 960, 1.55, { kind: 'hero', arm: 'hug', col: '#120a04', rim: '#ffc070', rimDx: 4 }); person(g, 1200, 960, 1.55, { kind: 'friend', flip: true, arm: 'hug', col: '#160c06', rim: '#ffc070', rimDx: -4 }); }
  else { person(g, 900, 960, 1.45, { kind: 'hero', pose: 'sit', arm: 'reach', col: '#120a04', rim: '#ffc070', rimDx: 4 }); person(g, 1420, 960, 1.45, { kind: 'friend', pose: 'sit', arm: 'reach', flip: true, col: '#160c06', rim: '#ffc070', rimDx: -4 }); for (const x of [1050, 1270]) { g.fillStyle = '#e8dcc8'; rr(g, x - 20, 726, 40, 34, 6); mug(g, x, 760, .5, lt, .7); } }
  motes(g, lt, '#ffd8a0', 40, 16, .35); grade(g, '#ff9a40', .12);
});
// ===================== CHAPTER 4 =====================
function mountainDream(g, lt) {
  g.fillStyle = vgrad(g, 0, H, [[0, '#6a8ab8'], [.6, '#e8d8e8'], [1, '#ffffff']]); g.fillRect(0, 0, W, H);
  [[0, 640, '#8a9ab8', 3], [0, 760, '#b8c4d8', 5], [0, 880, '#e8eef6', 7]].forEach(([_, y, c, sd]) => { const r = rng(sd); g.fillStyle = c; g.beginPath(); g.moveTo(0, H); let x = 0; while (x <= W) { g.lineTo(x, y - r() * 220); x += 120 + r() * 120; } g.lineTo(W, H); g.fill(); });
  g.fillStyle = '#f4f8fc'; poly(g, [700, 1080, 960, 700, 1220, 1080]);
  person(g, 960, 712, 1.1, { pose: 'stand', arm: 'up', col: '#14182a', rim: '#ffffff', rimDx: 3 });
  const r = rng(3); g.fillStyle = rgba('#fff', .8); for (let i = 0; i < 160; i++) { const x = (r() * W - lt * 300 * (1 + r())) % W + W, y = (r() * H + lt * 60) % H; circ(g, x % W, y, 1 + r() * 2.5); }
}
sc(210, 224, (g, lt) => {
  const z = lt < 8 ? lerp(1, 1.15, lt / 8) : lerp(1.15, 6, ss(8, 14, lt) ** 2);
  g.save(); camz(g, z, 760, 470);
  g.fillStyle = vgrad(g, 0, H, [[0, '#d8b888'], [1, '#a88858']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a1e14'; g.fillRect(240, 180, 1440, 640);
  const posters = [[300, 230, 'm'], [780, 230, 'd'], [1260, 230, 's']];
  posters.forEach(([x, y, k]) => { g.save(); g.beginPath(); g.rect(x, y, 400, 300); g.clip(); if (k === 'm') { g.save(); g.translate(x, y); g.scale(400 / W, 300 / H); mountainDream(g, 0); g.restore(); } if (k === 'd') { g.fillStyle = vgrad(g, y, y + 300, [[0, '#1a1a40'], [1, '#c8884a']]); g.fillRect(x, y, 400, 300); g.fillStyle = '#e8a860'; ell(g, x + 200, y + 330, 300, 90); } if (k === 's') { g.fillStyle = '#3a4050'; g.fillRect(x, y, 400, 300); for (let i = 0; i < 5; i++) { g.fillStyle = '#d8b070'; circ(g, x + 40 + i * 80, y + 120, 8); } } g.restore(); g.strokeStyle = '#e8dcc0'; g.lineWidth = 8; g.strokeRect(x, y, 400, 300); });
  g.save(); g.globalAlpha = .1; g.globalCompositeOperation = 'screen'; person(g, 1100, 1060, 2.6, { col: '#c8d8e8', shadow: false, blur: 3 }); g.restore();
  const gl = g.createLinearGradient(240, 180, 1680, 820); gl.addColorStop(0, 'rgba(255,255,255,.12)'); gl.addColorStop(.4, 'rgba(255,255,255,0)'); gl.addColorStop(.6, 'rgba(255,255,255,.08)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(240, 180, 1440, 640);
  g.restore();
  if (lt > 12) g.save(), g.globalAlpha = ss(12, 14, lt), mountainDream(g, lt), g.restore();
});
sc(224, 229, (g, lt) => { g.save(); camz(g, 1 + lt * .02); mountainDream(g, lt); g.restore(); grade(g, '#ffd8a0', .1); });
sc(229, 234.5, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#04061a'], [1, '#1a1630']]); g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H * .9); g.rotate(lt * .01 - .5); const r = rng(5); for (let i = 0; i < 900; i++) { const a = r() * TAU, d = r() * 1400, band = Math.exp(-((Math.sin(a) * d) ** 2) / 40000); if (r() > band * .9 + .1) continue; g.fillStyle = rgba('#fff', .3 + r() * .7); circ(g, Math.cos(a) * d, Math.sin(a) * d * .5, r() * 1.8); } g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(W / 2, H * .45); g.rotate(-.5 + lt * .01); g.fillStyle = 'rgba(160,140,220,.10)'; ell(g, 0, 0, 1300, 140); g.fillStyle = 'rgba(255,220,200,.06)'; ell(g, 0, 0, 900, 60); g.restore();
  [[880, '#1a1420'], [960, '#0e0a14']].forEach(([y, c], i) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x / 300 + i * 2) * 50); g.lineTo(W, H); g.fill(); });
  person(g, 1080, 930, 1.0, { pose: 'sit', arm: 'knee', col: '#05040a', rim: '#8a7ac8', rimDx: 3 });
});
sc(234.5, 240, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#1a2030'], [1, '#2a2620']]); g.fillRect(0, 0, W, H);
  for (let s = -1; s <= 1; s += 2) { g.fillStyle = '#2a2a30'; poly(g, [W / 2 + s * 120, 560, W / 2 + s * 1000, 0, W / 2 + s * 1100, 0, W / 2 + s * 1100, H, W / 2 + s * 520, H]); for (let i = 0; i < 6; i++) { const k = i / 6, x = W / 2 + s * lerp(140, 900, k), y = lerp(520, 200, k); glow(g, x, y, 60 + k * 200, '#ffb060', .7); g.fillStyle = '#ffd890'; ell(g, x, y, 6 + k * 16, 9 + k * 22); } }
  g.fillStyle = '#3a3630'; poly(g, [W / 2 - 120, 560, W / 2 + 120, 560, W / 2 + 520, H, W / 2 - 520, H]);
  g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const k = i / 6; g.fillStyle = rgba('#ffb060', .12); ell(g, W / 2 + (i % 2 ? 1 : -1) * lerp(60, 300, k), lerp(600, 1040, k), 20 + k * 60, 80 + k * 140); } g.restore();
  for (let i = 0; i < 5; i++) { const d = ((i * .21 + lt * .03) % 1), s = .4 + d * .9; person(g, W / 2 + (i % 2 ? 1 : -1) * (40 + d * 360), 560 + d * 480, s, { kind: 'crowd', pose: 'walk', walk: lt * 6 + i, col: '#0a0a0e' }); g.fillStyle = '#0a0a0e'; ell(g, W / 2 + (i % 2 ? 1 : -1) * (40 + d * 360) + 10 * s, 560 + d * 480 - 340 * s, 80 * s, 30 * s); }
  person(g, W / 2, 900 - lt * 20, 1.2 - lt * .05, { pose: 'walk', walk: lt * 6, flip: true, col: '#060608', rim: '#ffb060', rimDx: 3 });
  rain(g, lt, 260, '#c8d8f0', .3);
});
sc(240, 248, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#3a2a1e'], [1, '#1a120c']]); g.fillRect(0, 0, W, H); glow(g, W / 2, H / 2, 800, '#ffc070', .2);
  g.save(); g.translate(W / 2, H / 2 + 60); g.rotate(-.04); g.fillStyle = '#f2ece0'; rr(g, -420, -300, 840, 600, 6); g.strokeStyle = rgba('#000', .08); g.lineWidth = 3; g.beginPath(); g.moveTo(0, -300); g.lineTo(0, 300); g.moveTo(-420, 0); g.lineTo(420, 0); g.stroke();
  const p = ss(0, 3, lt), rise = ss(3.4, 6.5, lt);
  const sketch = [[-240, 150, -240, -60], [-240, -60, 240, -60], [240, -60, 240, 150], [-280, -60, 0, -200], [0, -200, 280, -60], [-80, 150, -80, 20], [-80, 20, 40, 20], [40, 20, 40, 150], [100, 0, 200, 0], [100, 0, 100, 80], [200, 0, 200, 80], [100, 80, 200, 80], [-180, -30, 180, -30]];
  g.strokeStyle = '#2a2a3a'; g.lineWidth = 5; g.lineCap = 'round'; const tot = sketch.length;
  sketch.forEach(([a, b, c, d], i) => { const q = clamp(p * tot - i); if (q <= 0) return; g.beginPath(); g.moveTo(a, b); g.lineTo(lerp(a, c, q), lerp(b, d, q)); g.stroke(); });
  if (rise > 0) { g.save(); g.translate(0, 150); g.scale(1, rise); g.translate(0, -150); g.globalAlpha = rise; g.fillStyle = '#d8a060'; g.fillRect(-240, -60, 480, 210); g.fillStyle = '#b84a30'; poly(g, [-290, -56, 0, -210, 290, -56]); g.fillStyle = '#3a2414'; g.fillRect(-80, 20, 120, 130); g.fillStyle = '#ffd890'; g.fillRect(100, 0, 100, 80); glow(g, 150, 40, 120, '#ffd890', .6); g.fillStyle = '#e8c890'; g.fillRect(-200, -40, 400, 26); g.restore(); }
  g.restore(); motes(g, lt, '#ffd8a0', 40, 17, .3);
});
sc(248, 255, (g, lt) => {
  g.fillStyle = '#1a1610'; g.fillRect(0, 0, W, H);
  for (let row = 0; row < 3; row++) { g.fillStyle = '#3a2a1a'; g.fillRect(0, 300 + row * 280, W, 24); const r = rng(row + 20); let x = 60; while (x < W - 60) { const w = 34 + r() * 40, h = 180 + r() * 60; g.fillStyle = ['#6a2a1a', '#2a3a5a', '#4a5a2a', '#7a6a4a', '#3a2a3a'][(r() * 5) | 0]; g.fillRect(x, 300 + row * 280 - h, w, h); x += w + 4; } }
  const pull = ss(1, 3, lt); g.save(); g.translate(980, 580 - 0 + pull * 120); g.rotate(pull * -.2); g.fillStyle = '#5a4a3a'; g.fillRect(-36, -230, 72, 230); g.fillStyle = rgba('#c8c0b0', .5 * (1 - ss(3.5, 4.5, lt))); g.fillRect(-36, -230, 72, 230); g.fillStyle = '#c0392b'; g.fillRect(-6, -230, 12, 60); g.restore();
  beam(g, 1500, 0, 700, 1300, 1080, '#ffe0b0', .12);
  if (lt > 3.4) { const r = rng(4); g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 160; i++) { const d = (lt - 3.4) * (60 + r() * 220), a = r() * TAU; g.fillStyle = rgba('#e8dcc8', .5 * (1 - ss(3.4, 7, lt))); circ(g, 980 + Math.cos(a) * d, 560 + Math.sin(a) * d * .6 - (lt - 3.4) * 30, 1 + r() * 2.5); } g.restore(); }
  motes(g, lt, '#ffe0b0', 70, 18, .4);
});
sc(255, 262, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#2a2420'], [1, '#141210']]); g.fillRect(0, 0, W, H);
  const z = lerp(1, 1.12, lt / 7); g.save(); camz(g, z);
  g.fillStyle = '#0c0a08'; g.fillRect(300, 160, 1320, 760); g.fillStyle = '#1a1610'; g.fillRect(340, 200, 1240, 680);
  beam(g, 960, 200, 640, 1280, 860, '#fff0d0', .3); glow(g, 960, 760, 400, '#ffe0b0', .25);
  g.fillStyle = '#050505'; g.beginPath(); g.moveTo(700, 760); g.lineTo(1260, 760); g.bezierCurveTo(1300, 640, 1180, 560, 1040, 580); g.bezierCurveTo(940, 600, 900, 520, 760, 600); g.lineTo(700, 640); g.fill();
  g.fillRect(740, 760, 18, 120); g.fillRect(1220, 760, 18, 120); g.fillStyle = '#e8e8e8'; g.fillRect(704, 744, 360, 12);
  const gl = g.createLinearGradient(300, 160, 1620, 920); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(300, 160, 1320, 760);
  g.restore();
});
sc(262, 272, (g, lt) => {
  street(g, lt, 0, .9); g.fillStyle = rgba('#000', .1); g.fillRect(0, 0, W, H);
  const r = rng(19); for (let i = 0; i < 26; i++) { const dir = i % 2 ? 1 : -1, sp = 600 + r() * 600, x = ((r() * W + dir * lt * sp) % (W + 400) + W + 400) % (W + 400) - 200, y = 900 + r() * 120, s = .9 + r() * .4; for (let k = 0; k < 5; k++) { g.save(); g.globalAlpha = .18; person(g, x - dir * k * 30, y, s, { kind: 'crowd', pose: 'walk', walk: lt * 20 + i, col: '#1a1a20', shadow: false, flip: dir < 0 }); g.restore(); } }
  person(g, W / 2, 1000, 1.5, { pose: 'stand', col: '#0a0a0e', rim: '#ffe0b0', rimDx: -4 });
});
sc(272, 282, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#c8a880'], [1, '#8a6a4a']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a1e14'; g.fillRect(820, 180, 520, 780); g.fillStyle = vgrad(g, 200, 960, [[0, '#ffe0a8'], [1, '#c88a40']]); g.fillRect(860, 220, 440, 740); glow(g, 1080, 600, 500, '#ffd090', .35);
  const ox = lerp(1080, 300, ss(0, 4, lt)), hx = lerp(500, 1000, ss(0, 4.2, lt));
  if (lt < 6.5) person(g, ox, 980, 1.5, { kind: 'old', pose: lt < 4 ? 'walk' : 'stand', walk: lt * 5, flip: true, col: '#1a120c', rim: '#ffd090', rimDx: -3 });
  else { const a = 1 - ss(6.5, 7.2, lt); if (a > 0) { g.save(); g.globalAlpha = a; person(g, 300, 980, 1.5, { kind: 'old', flip: true, col: '#1a120c' }); g.restore(); } }
  person(g, hx, 980, 1.5, { kind: 'hero', pose: lt < 4.2 ? 'walk' : 'stand', walk: lt * 6, flip: lt > 5.2, col: '#0c0806', rim: '#ffd090', rimDx: 3 });
  if (lt > 3.6 && lt < 4.4) { g.fillStyle = rgba('#fff', .15); g.fillRect(0, 0, W, H); }
});
sc(282, 300, (g, lt) => {
  if (lt < 10) {
    g.fillStyle = '#0a0806'; g.fillRect(0, 0, W, H); glow(g, W / 2, 300, 900, '#ffd8a0', .3 + .08 * ss(1, 3, lt));
    g.save(); g.translate(W / 2, 640); g.transform(1, 0, -.3, 1, 0, 0);
    const keys = 14, kw = 120; const press = [1.0, 1.8, 2.6].map(tt => Math.max(0, 1 - Math.abs(lt - tt) * 4));
    for (let i = 0; i < keys; i++) { const x = -keys * kw / 2 + i * kw, pi = i === 5 ? press[0] : i === 7 ? press[1] : i === 8 ? press[2] : 0; g.fillStyle = mixh('#f0ece4', '#d8d0c0', pi); g.fillRect(x + 3, -200 + pi * 14, kw - 6, 520); g.fillStyle = rgba('#000', .2); g.fillRect(x + kw - 8, -200, 5, 520); }
    for (let i = 0; i < keys - 1; i++) { if ([2, 6, 9, 13].includes(i % 7 + 7 * 0) && i % 7 !== 2 && i % 7 !== 6) {} if (i % 7 === 2 || i % 7 === 6) continue; g.fillStyle = '#0a0a0c'; g.fillRect(-keys * kw / 2 + (i + 1) * kw - 34, -200, 68, 300); }
    g.restore();
    const fx = [W / 2 - 100, W / 2 + 140, W / 2 + 260][lt < 1.4 ? 0 : lt < 2.2 ? 1 : 2], fy = 360 + Math.max(0, 1 - Math.abs((lt % .8) - .4) * 3) * 30;
    g.fillStyle = '#1a0e08'; g.save(); g.translate(fx, fy); g.rotate(.2); rr(g, -50, -300, 100, 320, 50); g.restore();
    motes(g, lt, '#ffe0b0', 50, 21, .4);
  } else {
    const p = lt - 10; g.fillStyle = '#0a0806'; g.fillRect(0, 0, W, H); beam(g, 980, 0, 620, 1340, 1080, '#ffe0b0', .3); glow(g, 980, 860, 500, '#ffd8a0', .35);
    g.fillStyle = '#050505'; g.beginPath(); g.moveTo(1000, 800); g.lineTo(1500, 800); g.bezierCurveTo(1540, 680, 1420, 600, 1300, 620); g.lineTo(1000, 660); g.fill(); g.fillRect(1020, 800, 16, 140); g.fillRect(1460, 800, 16, 140);
    person(g, 860, 960, 1.4, { pose: 'sit', arm: 'piano', col: '#0a0604', rim: '#ffe0b0', rimDx: 4 });
    g.save(); g.translate(0, Math.abs(Math.sin(p * 9)) * -4); g.restore();
    const z = 1 + p * .01; motes(g, lt, '#ffe0b0', 60, 22, .45);
  }
});
// ===================== CHAPTER 5 =====================
sc(300, 312, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#8ab0d0'], [.6, '#f0d8b0'], [1, '#d8b890']]); g.fillRect(0, 0, W, H); glow(g, 1500, 300, 600, '#fff0c8', .6);
  const z = lerp(1, 1.12, lt / 12); g.save(); camz(g, z, W / 2 + lt * 10, H / 2);
  skyline(g, 560, 61, '#a8a4a8', 120, 360, 80, 180); skyline(g, 680, 62, '#7a7680', 140, 420, 90, 200, .12, lt, '#ffe8c0');
  g.fillStyle = '#5a7a90'; g.fillRect(0, 760, W, 120);
  g.fillStyle = '#2a2a30'; g.fillRect(0, 700, W, 18); for (let x = 0; x < W; x += 160) { g.fillRect(x, 718, 10, 60); }
  g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const x = ((i * 77 + lt * (200 + (i % 5) * 60)) % (W + 200)) - 100; g.fillStyle = i % 2 ? 'rgba(255,240,200,.8)' : 'rgba(255,80,60,.8)'; g.fillRect(x, 694 + (i % 2) * 6, 30, 3); } g.restore();
  skyline(g, 1080, 63, '#3a3640', 200, 360, 120, 260, .1, lt);
  g.restore();
});
sc(312, 320, (g, lt) => {
  street(g, lt, lt * 30, .7);
  const r = rng(23); for (let i = 0; i < 18; i++) { const dir = i % 2 ? 1 : -1, sp = 500 + r() * 500, x = ((r() * W + dir * lt * sp) % (W + 400) + W + 400) % (W + 400) - 200, y = 900 + r() * 140; for (let k = 0; k < 4; k++) { g.save(); g.globalAlpha = k ? .15 : .7; person(g, x - dir * k * 26, y, .95 + r() * .3, { kind: 'crowd', pose: 'walk', walk: lt * 16 + i, flip: dir < 0, col: '#1e1e24', shadow: !k }); g.restore(); } }
  person(g, W / 2, 1010, 1.55, { pose: 'walk', walk: lt * 4, col: '#0a0a0e', rim: '#ffe0b0', rimDx: -4 });
});
sc(320, 325, (g, lt) => {
  street(g, lt, 0, .8);
  const bx = lerp(900, 2600, ss(0, 5, lt) ** 1.4); g.save(); g.translate(bx, 900); g.fillStyle = '#c84a30'; rr(g, -500, -300, 1000, 270, 30); g.fillStyle = '#2a3a4a'; for (let i = 0; i < 6; i++) g.fillRect(-460 + i * 150, -270, 120, 110); g.fillStyle = '#0a0a0c'; circ(g, -320, -30, 50); circ(g, 320, -30, 50); g.restore();
  for (let i = 0; i < 3; i++) person(g, lerp(200 + i * 120, 820 + i * 60, ss(0, 3.5, lt)), 1010, 1.2, { kind: 'crowd', pose: lt < 3.5 ? 'run' : 'stand', walk: lt * 12 + i, col: '#1a1a20' });
  person(g, 1700, 1040, 1.6, { pose: 'stand', flip: true, col: '#0a0a0e', rim: '#ffe0b0', rimDx: 4 });
});
sc(325, 334, (g, lt) => {
  g.fillStyle = '#2a2a30'; g.fillRect(0, 0, W, H); bokeh(g, lt, '#ffd8a0', 50, 9, .35, 70);
  for (let i = 0; i < 5; i++) { const x = 240 + i * 360 + Math.sin(lt * .3 + i) * 20; person(g, x, 1300, 2.3, { kind: 'crowd', pose: 'stand', arm: 'phoneLook', phone: 1, col: '#0c0c10', rim: '#ffd8a0', rimDx: (i % 2 ? 4 : -4), flip: i % 2 === 1, look: 'down' }); }
  grade(g, '#204060', .15);
});
sc(334, 340, (g, lt) => {
  street(g, lt, 0, .8); g.fillStyle = '#5a5a60'; g.fillRect(0, 860, W, 220); g.fillStyle = '#e8e8e8'; for (let x = 200; x < W; x += 140) g.fillRect(x, 940, 80, 140);
  person(g, lerp(600, 1300, lt / 6), 930, .9, { kind: 'old', pose: 'walk', walk: lt * 5, col: '#2a2a30', look: 'right' });
  for (let i = 0; i < 2; i++) { const cx = ((lt * 900 + i * 1200) % 2800) - 400; g.save(); g.filter = 'blur(8px)'; car(g, cx, 1120, 1.6, '#101014'); g.restore(); }
});
sc(340, 355, (g, lt) => {
  street(g, lt, 0, .8); g.fillStyle = rgba('#000', .15); g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a1a1e'; g.fillRect(1620, 220, 16, 700); rr(g, 1580, 200, 96, 240, 16); glow(g, 1628, 250, 90, '#ff2a1a', .8); g.fillStyle = '#ff3a2a'; circ(g, 1628, 250, 28); g.fillStyle = '#2a1a10'; circ(g, 1628, 320, 28); g.fillStyle = '#0e2a14'; circ(g, 1628, 390, 28);
  car(g, 880, 1000, 2.2, '#2a2e3a', false, true); g.fillStyle = '#8ab0c8'; poly(g, [880 - 120, 1000 - 320, 880 + 140, 1000 - 320, 880 + 260, 1000 - 200, 880 - 200, 1000 - 200]);
  person(g, 760, 1000 - 190, .55, { kind: 'kid', arm: 'wave', t: lt, col: '#1a1a20', shadow: false });
  person(g, 1360, 1080, 1.6, { pose: 'stand', arm: lt > 8 ? 'wave' : 'down', t: lt, flip: true, col: '#0a0a0e', rim: '#ffe0b0', rimDx: 4 });
});
sc(355, 375, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#f0c890'], [1, '#c89a68']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#b8946a'; poly(g, [0, 0, 760, 260, 760, 900, 0, H]); g.fillStyle = '#a8845a'; poly(g, [W, 0, 1160, 260, 1160, 900, W, H]);
  g.fillStyle = '#d8b888'; poly(g, [760, 900, 1160, 900, W, H, 0, H]);
  beam(g, 1400, 0, 700, 1300, 1000, '#fff0c8', .25);
  const slow = .45, tt = lt * slow;
  for (let i = 0; i < 6; i++) { const jump = lt > 10 ? Math.abs(Math.sin(tt * 8 + i)) * 40 : 0; person(g, 560 + i * 160 + Math.sin(tt * 3 + i) * 60, 1020 - (i % 2) * 40 - jump, 1.45, { kind: 'kid', pose: lt > 10 ? 'stand' : 'run', arm: lt > 10 ? 'up' : 'down', walk: tt * 14 + i, col: '#2a1a10', flip: i % 2 === 0 }); }
  const bxp = 960 + Math.sin(tt * 2) * 260, byp = 980 - Math.abs(Math.sin(tt * 4)) * 140; g.fillStyle = '#f2f2f2'; circ(g, bxp, byp, 16); g.fillStyle = '#1a1a1a'; circ(g, bxp + 4, byp - 3, 5);
  motes(g, lt, '#fff0c8', 120, 24, .6, [600, 300, 800, 700]);
});
sc(375, 390, (g, lt) => {
  if (lt < 6) { g.fillStyle = '#0e1016'; g.fillRect(0, 0, W, H); phone(g, W / 2, H / 2 + 40 - lt * 10, 1.2, 'countdown', { left: 45068 - Math.floor(lt), clock: '5:29' }); glow(g, W / 2, 100, 800, '#ffb060', .3); }
  else { const p = lt - 6, y = lerp(0, -400, eio(p / 9)); g.save(); g.translate(0, -y); g.fillStyle = vgrad(g, -400, H, [[0, '#5a6aa0'], [.5, '#f0905a'], [1, '#ffd09a']]); g.fillRect(0, -400, W, H + 400); glow(g, W * .5, 200, 600, '#fff0c0', .9); g.fillStyle = '#fff4d8'; circ(g, W * .5, 200, 70); skyline(g, 1080, 71, '#2a1a20', 160, 420); g.restore(); }
});
// ===================== CHAPTER 6 =====================
function rooftop(g, lt, sunY, night = 0) {
  g.fillStyle = vgrad(g, 0, H, [[0, mixh('#4a3a6a', '#060a1e', night)], [.55, mixh('#f08a4a', '#14204a', night)], [1, mixh('#ffd09a', '#2a2a4a', night)]]); g.fillRect(0, 0, W, H);
  if (night < 1) { glow(g, W * .7, sunY, 500, '#fff0c0', .9 * (1 - night)); g.fillStyle = rgba('#fff4d8', 1 - night); circ(g, W * .7, sunY, 60); }
  skyline(g, 760, 81, mixh('#3a2030', '#0a0c18', night), 120, 360, 80, 180, .25 * night + .02, lt, '#ffd08a');
  g.fillStyle = mixh('#2a1820', '#06070c', night); g.fillRect(0, 800, W, 280);
  g.fillRect(180, 600, 180, 200); g.fillRect(200, 560, 140, 40); ell(g, 1600, 640, 50, 20); g.fillRect(1596, 640, 8, 160);
  g.strokeStyle = mixh('#2a1820', '#06070c', night); g.lineWidth = 3; g.beginPath(); g.moveTo(400, 640); g.quadraticCurveTo(900, 690, 1400, 630); g.stroke();
  for (let i = 0; i < 6; i++) { const x = 520 + i * 140, y = 640 + Math.sin(i / 6 * Math.PI) * 40; g.save(); g.translate(x, y); g.rotate(Math.sin(lt * 2 + i) * .15); g.fillStyle = ['#c84a3a', '#e8d8c0', '#3a6a9a'][i % 3]; g.globalAlpha = 1 - night * .7; g.fillRect(-30, 0, 60, 80); g.restore(); }
}
sc(390, 406, (g, lt) => {
  if (lt < 4) { g.fillStyle = '#0a0806'; g.fillRect(0, 0, W, H); for (let i = 0; i < 8; i++) { g.fillStyle = '#1a140e'; g.fillRect(400 + i * 60, 900 - i * 70, 600, 20); } const op = eo(lt / 3); g.fillStyle = vgrad(g, 120, 900, [[0, '#ffd09a'], [1, '#f08a4a']]); g.fillRect(1200, 120, 360 * op, 780); glow(g, 1380, 500, 700, '#ffb060', .5 * op); person(g, 1100, 760, 1.3, { pose: 'stand', col: '#060404', rim: '#ffb060', rimDx: 4 }); }
  else { const p = lt - 4; rooftop(g, lt, 520 + p * 6); person(g, 900 + p * 4, 900, 1.3, { pose: 'sit', arm: 'knee', col: '#0a0406', rim: '#ffb060', rimDx: 4 }); g.fillStyle = '#1a1014'; g.fillRect(860 + p * 4, 760, 130, 140); }
});
sc(406, 414, (g, lt) => {
  const n = ss(0, 8, lt); rooftop(g, lt, 560 + lt * 50, n * .8);
  person(g, 900, 900, 1.3, { pose: 'sit', arm: 'knee', col: '#0a0406', rim: mixh('#ffb060', '#6a8ad0', n), rimDx: 4 }); g.fillStyle = '#1a1014'; g.fillRect(860, 760, 130, 140);
});
sc(414, 420, (g, lt) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); eye(g, W / 2, H / 2, 2.4, .85, '#ff9a4a', lt); g.save(); g.globalCompositeOperation = 'screen'; glow(g, W / 2 + 60, H / 2 - 40, 140, '#ffb060', .6); g.restore(); fadeBlack(g, ss(4.6, 6, lt) * .4); g.fillStyle = rgba('#e8c8a0', ss(5, 6, lt) * .6); g.fillRect(0, 0, W, H); });
sc(420, 451, (g, lt) => {
  const B = [0, 8, 15, 23, 31], k = lt < 8 ? 0 : lt < 15 ? 1 : lt < 23 ? 2 : 3, p = (lt - B[k]) / (B[k + 1] - B[k]);
  if (k === 0) { g.fillStyle = vgrad(g, 0, H, [[0, '#d8c8a0'], [1, '#a89060']]); g.fillRect(0, 0, W, H); g.fillStyle = '#8a7a5a'; g.fillRect(0, 860, W, 220); const fall = ss(0, .25, p);
    g.save(); g.translate(820, 860); g.rotate(-fall * .9); g.strokeStyle = '#2a1a10'; g.lineWidth = 8; g.beginPath(); g.arc(-80, -50, 50, 0, TAU); g.arc(80, -50, 50, 0, TAU); g.stroke(); g.restore();
    person(g, 760, 860, .6, { kind: 'kid', pose: p < .3 ? 'stand' : 'floor', col: '#3a2414' }); person(g, lerp(1300, 900, ss(.3, .7, p)), 870, 1.35, { kind: 'father', pose: p < .7 ? 'walk' : 'stand', walk: p * 30, arm: p > .7 ? 'reach' : 'down', flip: true, col: '#2a1a0c' }); }
  if (k === 1) { g.fillStyle = vgrad(g, 0, H, [[0, '#c8a070'], [1, '#6a4a2a']]); g.fillRect(0, 0, W, H); windowFrame(g, 1300, 160, 360, 320, '#fff0d0', 1, false); g.fillStyle = '#5a3a20'; ell(g, 760, 760, 260, 200); g.fillStyle = '#ff8a30'; ell(g, 760, 740, 120, 80); glow(g, 760, 740, 300, '#ff9a40', .6);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#e8c890'; ell(g, 1100 + i * 110, 820, 60, 18); } g.strokeStyle = rgba('#fff', .25); g.lineWidth = 8; for (let s = 0; s < 3; s++) { g.beginPath(); for (let i = 0; i < 16; i++) { const yy = 800 - i * 18, xx = 1100 + s * 110 + Math.sin(lt * 2 + i * .5) * 10; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); }
    person(g, 1500, 960, 1.2, { kind: 'mother', flip: true, col: '#3a2010', arm: 'reach' }); }
  if (k === 2) { g.fillStyle = vgrad(g, 0, H, [[0, '#a8c0d0'], [1, '#e8d8b0']]); g.fillRect(0, 0, W, H); for (let i = 0; i < 14; i++) person(g, 100 + i * 130, 1080, 1.1, { kind: 'crowd', col: '#1a2030', shadow: false, arm: i % 3 ? 'up' : 'down', t: lt + i }); for (let i = 0; i < 10; i++) { const y = lerp(800, 160, ss(0, .6, p)) + Math.sin(i) * 80, x = 200 + i * 160 + Math.sin(lt * 2 + i) * 30; g.save(); g.translate(x, y); g.rotate(lt * 3 + i); g.fillStyle = '#0a0a14'; g.fillRect(-36, -8, 72, 16); g.restore(); }
    person(g, 1700, 1080, 1.4, { kind: 'mother', col: '#2a2010', flip: true, arm: 'up' }); }
  if (k === 3) { const m = ss(.45, .6, p); g.fillStyle = vgrad(g, 0, H, [[0, mixh('#c8a070', '#3a2a20', m)], [1, mixh('#8a6a40', '#1a120c', m)]]); g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, 640); g.fillStyle = '#c0392b'; rr(g, -90, -70, 180, 140, 10); g.fillStyle = '#e8c060'; g.fillRect(-12, -70, 24, 140); g.fillRect(-90, -12, 180, 24); g.restore();
    if (m < 1) { g.save(); g.globalAlpha = 1 - m; person(g, 700, 1000, 1.5, { kind: 'hero', arm: 'reach', col: '#2a1a0c' }); person(g, 1240, 1000, 1.4, { kind: 'mother', flip: true, arm: 'reach', col: '#2a1a0c' }); g.restore(); }
    if (m > 0) { g.save(); g.globalAlpha = m; g.fillStyle = '#2a1a10'; g.fillRect(560, 300, 800, 20); g.fillRect(560, 720, 800, 20); g.fillStyle = '#8a6a4a'; rr(g, 640, 560, 120, 160, 10); g.fillStyle = '#c8b090'; rr(g, 1100, 600, 160, 120, 10); g.restore(); glow(g, W / 2, 640, 300, '#ffd090', .3 * m); }
  }
  filmFrame(g, 1); motes(g, lt, '#ffd8a0', 60, 25, .35);
  if (p < .06) { g.fillStyle = rgba('#fff4e0', (1 - p / .06) * .5); g.fillRect(0, 0, W, H); }
});
sc(451, 472, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#050818'], [1, '#1a2244']]); g.fillRect(0, 0, W, H);
  const r = rng(30); for (let i = 0; i < 200; i++) { g.fillStyle = rgba('#fff', .3 + .5 * Math.abs(Math.sin(lt + i))); circ(g, r() * W, r() * 600, r() * 1.6); }
  const ang = lt / 21 * TAU;
  [[.25, 81, '#121830', 200, 460, .35], [.6, 82, '#0a0e1e', 140, 300, .25], [1.0, 83, '#05070e', 80, 200, .12]].forEach(([par, seed, col, hmin, hmax, win]) => { g.save(); g.translate(-((ang * 900 * par) % 1920), 0); skyline(g, 900, seed, col, hmin, hmax, 80, 180, win, lt); g.translate(1920, 0); skyline(g, 900, seed, col, hmin, hmax, 80, 180, win, lt); g.restore(); });
  g.fillStyle = '#04050a'; g.fillRect(0, 880, W, 200);
  const rimSide = Math.cos(ang) > 0 ? 5 : -5; person(g, W / 2, 1000, 1.7, { pose: 'sit', arm: 'knee', col: '#020306', rim: '#ffd08a', rimDx: rimSide, flip: Math.sin(ang) < 0 });
  glow(g, W / 2 + 16, 1000 - 300 * 1.7, 14, '#cfe0ff', .8 * ss(2, 4, lt));
  motes(g, lt, '#ffd08a', 60, 31, .3); grade(g, '#2040a0', .12);
});
sc(472, 480, (g, lt) => {
  g.fillStyle = '#03050c'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W * .7, -200); for (let i = 0; i < 260; i++) { const r = rng(i), rad = 100 + r() * 1600, a0 = r() * TAU; g.strokeStyle = rgba('#dfe8ff', .18 + r() * .3); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, rad, a0, a0 + lt * .06 + .02); g.stroke(); } g.restore();
  skyline(g, 900, 84, '#05070e', 120, 380, 80, 180, .3 * (1 - lt / 8), lt);
  g.fillStyle = '#020306'; g.fillRect(0, 880, W, 200);
  person(g, W / 2, 1000, 1.4, { pose: 'sit', arm: 'knee', col: '#010204', rim: '#4a6aa0', rimDx: 4 });
  const left = Math.round(lerp(39734, 3600, ss(0, 7.5, lt))); g.save(); g.direction = 'ltr'; g.font = '500 44px "Courier New", monospace'; g.textAlign = 'right'; g.fillStyle = '#ffd36b'; g.fillText(fmt(left), W - 120, BAR + 70); g.restore();
});
// ===================== CHAPTER 7 =====================
function river(g, lt, dawn = 0, mist = 1) {
  g.fillStyle = vgrad(g, 0, H, [[0, mixh('#0a1430', '#6a7ab0', dawn)], [.55, mixh('#1a2a4a', '#f0b080', dawn)], [1, mixh('#0a1020', '#3a3040', dawn)]]); g.fillRect(0, 0, W, H);
  if (dawn > 0) { glow(g, W * .65, 640, 700, '#ffd8a0', .7 * dawn); g.fillStyle = rgba('#ffe8c0', dawn); g.fillRect(W * .65 - 600 * dawn, 638, 1200 * dawn, 4); }
  skyline(g, 640, 91, mixh('#0c1424', '#3a3040', dawn), 60, 220, 80, 200, .08 * (1 - dawn), lt);
  water(g, 640, 860, lt, mixh('#142040', '#c08a70', dawn), mixh('#0a1020', '#3a3040', dawn), mixh('#6a8ac0', '#ffe0b0', dawn), .4);
  g.save(); g.globalAlpha = .5 * mist; for (let i = 0; i < 6; i++) { g.fillStyle = rgba('#c8d0e8', .12); ell(g, ((i * 420 + lt * 20) % (W + 600)) - 300, 680 + (i % 3) * 30, 500, 40); } g.restore();
  g.fillStyle = mixh('#0a0e18', '#2a2228', dawn); g.fillRect(0, 860, W, 220);
  for (let i = 0; i < 4; i++) { const x = 200 + i * 520; g.fillStyle = mixh('#06080e', '#1a1418', dawn); g.fillRect(x, 520, 8, 340); glow(g, x + 4, 520, 120 * (1 - dawn), '#ffd08a', .7 * (1 - dawn)); }
  g.fillStyle = mixh('#06080e', '#1a1418', dawn); g.fillRect(620, 770, 680, 20); g.fillRect(620, 730, 680, 12); g.fillRect(650, 790, 16, 80); g.fillRect(1254, 790, 16, 80);
}
sc(480, 506, (g, lt) => {
  river(g, lt, 0);
  person(g, 1180, 870, 1.25, { kind: 'old', pose: 'sit', arm: 'knee', col: '#05070c', rim: '#8aa4d8', rimDx: -3, flip: true });
  if (lt < 7) person(g, lerp(200, 720, ss(0, 7, lt)), 870, 1.25, { pose: 'walk', walk: lt * 5, col: '#05070c', rim: '#8aa4d8', rimDx: 3 });
  else person(g, 720, 870, 1.25, { pose: 'sit', arm: 'knee', col: '#05070c', rim: '#8aa4d8', rimDx: 3 });
  if (lt > 15 && lt < 21) { const a = Math.sin((lt - 15) / 6 * Math.PI); glow(g, 805, 650, 30, GLINT, a); glow(g, 1098, 650, 30, GLINT, a); }
});
sc(506, 524, (g, lt) => {
  if (lt < 8) { g.fillStyle = vgrad(g, 0, H, [[0, '#0a1222'], [1, '#03050a']]); g.fillRect(0, 0, W, H); profileHead(g, 900 + lt * 4, 560, 1.75, '#8aa4d8'); motes(g, lt, '#8aa4d8', 40, 32, .2); }
  else { const p = lt - 8; g.fillStyle = '#020306'; g.fillRect(0, 0, W, H); const z = lerp(1.3, 1.7, p / 10); g.save(); camz(g, z, W / 2, H / 2 + 30); phone(g, W / 2, H / 2, 1.2, 'countdown', { left: Math.max(0, 10 - Math.floor(p)), clock: '5:59' }); g.restore(); }
});
sc(524, 527, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); });
sc(527, 548, (g, lt) => {
  const d = ss(0, 21, lt) * .5;
  if (lt < 6) { river(g, lt, d, .8); phone(g, 960, 760, .5, lt > 2 ? 'final' : 'off', { clock: '6:00' }); person(g, 760, 870, 1.25, { pose: 'sit', arm: 'phoneLook', phone: 1, col: '#05070c', rim: '#ffd8a0', rimDx: 3 }); }
  else { g.fillStyle = vgrad(g, 0, H, [[0, '#1a2440'], [1, '#3a2a30']]); g.fillRect(0, 0, W, H); glow(g, 1500, 640, 800, '#ffd8a0', .35 + .2 * ss(6, 20, lt)); profileHead(g, 640, 580, 1.6, mixh('#8aa4d8', '#ffd8a0', ss(6, 16, lt))); phone(g, 1420, 520, 1.0, 'final', { clock: '6:00' }, .05); }
});
sc(548, 554, (g, lt) => {
  river(g, lt, .6, .5);
  if (lt < 2.5) { person(g, 720, 870, 1.25, { pose: 'sit', arm: 'knee', col: '#0a0a10', rim: '#ffd8a0', rimDx: 3, flip: lt > .8 }); }
  else { const p = lt - 2.5; g.fillStyle = '#1a1014'; g.fillRect(0, 0, W, H); glow(g, W / 2, 300, 900, '#ffd8a0', .3);
    g.fillStyle = '#4a3020'; g.fillRect(0, 640, W, 440); g.strokeStyle = rgba('#000', .3); g.lineWidth = 4; for (let y = 660; y < H; y += 90) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const z = lerp(1, 1.5, eio(p / 3.5)); g.save(); camz(g, z, W / 2, 640);
    g.fillStyle = '#6a3a1a'; rr(g, W / 2 - 520, 610, 1040, 60, 26);
    g.fillStyle = '#b8873e'; circ(g, W / 2, 640, 120); g.fillStyle = '#f2e8d0'; circ(g, W / 2, 640, 102);
    for (let i = 0; i < 12; i++) { g.save(); g.translate(W / 2, 640); g.rotate(i * TAU / 12); g.fillStyle = '#3a2a1a'; g.fillRect(-3, -96, 6, 16); g.restore(); }
    g.save(); g.translate(W / 2, 640); g.rotate(-.9); g.fillStyle = '#1a1a1a'; g.fillRect(-4, -70, 8, 76); g.rotate(2.6); g.fillRect(-3, -88, 6, 94); g.restore();
    g.strokeStyle = rgba('#fff', .85); g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 70, 580); g.lineTo(W / 2 + 74, 704); g.stroke();
    g.restore(); }
});
sc(554, 562, (g, lt) => {
  const y = lerp(0, 260, eio(lt / 8)); g.save(); g.translate(0, y);
  g.fillStyle = vgrad(g, -260, H, [[0, '#6a8ac8'], [.5, '#ffc890'], [1, '#ffe0b0']]); g.fillRect(0, -260, W, H + 260);
  const sy = 640 - lt * 30; glow(g, W * .62, sy, 900, '#fff0c0', .9); g.fillStyle = '#fff6e0'; circ(g, W * .62, sy, 80);
  rays(g, W * .62, sy, lt, '#ffe8c0', .12, 11);
  skyline(g, 640, 91, '#5a4048', 60, 220, 80, 200);
  water(g, 640, 860, lt, '#e8a880', '#6a4a50', '#fff0c8', .5);
  g.fillStyle = '#3a2a2e'; g.fillRect(0, 860, W, 300); g.fillRect(620, 770, 680, 20); g.fillRect(650, 790, 16, 80); g.fillRect(1254, 790, 16, 80);
  person(g, 720, 870, 1.25, { pose: 'sit', arm: 'knee', col: '#1a1014', rim: '#fff0c0', rimDx: 3 });
  g.restore();
});
sc(562, 572, (g, lt) => {
  const k = Math.min(3, Math.floor(lt / 2.5)), p = (lt % 2.5) / 2.5;
  if (k === 0) { room(g, '#f0d8b0', '#d8b888', '#a88858', 820); windowFrame(g, 1200, 160, 420, 360, '#fff6e0', 1, false); person(g, 760, 960, 1.5, { arm: 'phoneEar', col: '#2a1a10', rim: '#fff0c8', rimDx: 4 }); g.save(); g.translate(0, Math.abs(Math.sin(lt * 10)) * -3); g.restore(); }
  if (k === 1) { g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, W, H); g.fillStyle = '#2a2a30'; rr(g, 460, 220, 1000, 620, 20); g.fillStyle = '#8ab8e8'; rr(g, 480, 240, 960, 580, 12); g.strokeStyle = '#fff'; g.lineWidth = 6; g.setLineDash([18, 14]); g.beginPath(); g.moveTo(560, 700); g.quadraticCurveTo(960, 300, 1360, 520); g.stroke(); g.setLineDash([]); const q = ss(0, 1, p); const px = (1 - q) * (1 - q) * 560 + 2 * (1 - q) * q * 960 + q * q * 1360, py = (1 - q) * (1 - q) * 700 + 2 * (1 - q) * q * 300 + q * q * 520; g.fillStyle = '#fff'; g.save(); g.translate(px, py); g.rotate(-.3 + q * .8); poly(g, [30, 0, -20, -14, -10, 0, -20, 14]); g.restore(); }
  if (k === 2) { g.fillStyle = '#3a2a1e'; g.fillRect(0, 0, W, H); const op = ss(0, .6, p); g.fillStyle = '#f2ece0'; rr(g, W / 2 - 420 * op, 260, 840 * op, 560, 8); if (op > .9) { g.strokeStyle = '#2a2a3a'; g.lineWidth = 5; g.strokeRect(W / 2 - 220, 420, 440, 260); g.beginPath(); g.moveTo(W / 2 - 260, 420); g.lineTo(W / 2, 320); g.lineTo(W / 2 + 260, 420); g.stroke(); } glow(g, W / 2, 540, 500, '#ffd090', .2); }
  if (k === 3) { g.fillStyle = '#e8dcc8'; g.fillRect(0, 0, W, H); g.fillStyle = '#0a0a0c'; g.beginPath(); g.moveTo(900, 800); g.lineTo(1500, 800); g.bezierCurveTo(1540, 680, 1420, 600, 1300, 620); g.lineTo(900, 660); g.fill(); person(g, 780, 960, 1.4, { pose: 'sit', arm: 'piano', col: '#2a1a10' }); person(g, 1640, 960, 1.4, { kind: 'father', flip: true, arm: 'reach', col: '#3a2a1a' }); }
  grade(g, '#ffd8a0', .12); if (p < .08) { g.fillStyle = rgba('#fff', (1 - p / .08) * .35); g.fillRect(0, 0, W, H); }
});
sc(572, 580, (g, lt) => {
  const k = Math.min(2, Math.floor(lt / 2.67)), p = (lt % 2.67) / 2.67;
  g.fillStyle = vgrad(g, 0, H, [[0, '#ffd8a8'], [1, '#e8b888']]); g.fillRect(0, 0, W, H); glow(g, W * .3, 200, 700, '#fff6e0', .6);
  if (k === 0) { person(g, 860, 1000, 1.1, { kind: 'kid', arm: 'hug', col: '#3a2418' }); person(g, 1000, 1000, 1.4, { kind: 'mother', flip: true, arm: 'hug', col: '#4a3020' }); }
  if (k === 1) { g.fillStyle = '#c8a070'; g.fillRect(560, 300, 800, 700); const up = ss(0, .8, p); g.fillStyle = '#6a6a70'; g.fillRect(600, 340, 720, 620 * (1 - up)); for (let y = 340; y < 340 + 620 * (1 - up); y += 30) { g.fillStyle = '#5a5a60'; g.fillRect(600, y, 720, 4); } g.fillStyle = '#ffd890'; if (up > .3) { glow(g, 960, 700, 300, '#ffd890', .4 * up); } person(g, 1500, 1000, 1.5, { kind: 'crowd', arm: 'up', col: '#2a1a10' }); }
  if (k === 2) { street(g, lt, lt * 60, 1); person(g, 900, 1000, 1.5, { kind: 'friend', pose: 'run', walk: lt * 10, col: '#2a1a10' }); }
});
sc(580, 587, (g, lt) => {
  g.fillStyle = vgrad(g, 0, H, [[0, '#d8d4cc'], [1, '#b8b4ac']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#e8e4dc'; g.fillRect(560, 140, 800, 700); g.fillStyle = '#9aa8b0'; g.fillRect(590, 170, 740, 640);
  const swap = lt > 4.2 && lt < 4.8;
  g.save(); g.beginPath(); g.rect(590, 170, 740, 640); g.clip(); g.fillStyle = vgrad(g, 170, 810, [[0, '#c8d0d8'], [1, '#8a98a0']]); g.fillRect(590, 170, 740, 640);
  person(g, 960, 1400, 2.6, { kind: swap ? 'old' : 'hero', col: swap ? '#3a3836' : '#2a2420', shadow: false });
  g.restore();
  const gl = g.createLinearGradient(590, 170, 1330, 810); gl.addColorStop(0, 'rgba(255,255,255,.25)'); gl.addColorStop(.4, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(590, 170, 740, 640);
  g.fillStyle = '#f2f0ec'; g.fillRect(500, 860, 920, 80); g.fillStyle = '#c8ccd0'; ell(g, 960, 880, 220, 26);
  if (lt < 2.4) { const r = rng(5); for (let i = 0; i < 30; i++) { g.fillStyle = rgba('#e8f4ff', .6); circ(g, 960 + (r() - .5) * 300, 820 - (lt * 200 * r()) % 300, 3 + r() * 4); } }
  if (swap) { g.fillStyle = rgba('#fff', .08); g.fillRect(0, 0, W, H); }
});
sc(587, 595, (g, lt) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); lightLeak(g, lt, .25, '#ff9a4a');
  const words = ['لا', 'تنتظر', 'أن', 'تعرف', 'قيمة', 'الوقت…'], words2 = ['حتى', 'تدرك', 'أنك', 'تملكه', 'الآن.'];
  const drawLine = (ws, y, t0) => { g.save(); g.font = '700 74px Cairo'; g.direction = 'rtl'; g.textBaseline = 'middle'; g.textAlign = 'right'; const wd = ws.map(w => g.measureText(w).width), sp = 22, tot = wd.reduce((a, b) => a + b) + sp * (ws.length - 1); let x = W / 2 + tot / 2;
    ws.forEach((w, i) => { const a = ss(t0 + i * .3, t0 + i * .3 + .6, lt) * (1 - ss(7.2, 8, lt)); g.globalAlpha = a; g.fillStyle = (w === 'الآن.') ? '#ffcf7a' : '#f2f2f2'; g.shadowColor = 'rgba(255,190,110,.35)'; g.shadowBlur = 24; g.fillText(w, x, y + (1 - a) * 12); x -= wd[i] + sp; }); g.restore(); };
  drawLine(words, 470, .4); drawLine(words2, 590, 2.6);
});
sc(595, 600, (g, lt) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const a = ss(.2, 1, lt) * (1 - ss(4.2, 5, lt));
  g.save(); g.globalAlpha = a; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = '#ffcf7a'; g.lineWidth = 6; g.beginPath(); g.arc(W / 2, 440, 70, -Math.PI / 2, -Math.PI / 2 + TAU * ss(.2, 1.6, lt)); g.stroke();
  g.fillStyle = '#ffcf7a'; g.font = '700 54px "Courier New", monospace'; g.direction = 'ltr'; g.fillText('24', W / 2, 444); g.direction = 'rtl';
  g.font = '600 46px Cairo'; g.fillStyle = '#e8e8e8'; g.fillText('اكتب في التعليقات: ماذا ستفعل اليوم؟', W / 2, 620);
  g.restore();
  if (lt > 1.2 && lt < 4.6) { phone(g, W - 260, H - 300, .32, 'message', { left: 86399, clock: 'الآن' }, .08); }
});

// ===================== render =====================
let SUBS24 = [];
const EXTRA_SUBS = [[138.6, 141.6, '«خير يا حبيبي؟ صوتك متغيّر…»', 'الأم']];
function renderV24(t, fi = 0) {
  const g = MG; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (const s of S24) if (t >= s.s && t < s.e) { g.save(); s.f(g, t - s.s, s.e - s.s, t); g.restore(); g.filter = 'none'; }
  // gentle dip at scene cuts (except hard cuts to black)
  for (const s of S24) { const d = t - s.s; if (d >= 0 && d < .25 && s.s > 0 && ![3, 524, 527].includes(s.s)) { g.fillStyle = rgba('#000', (1 - d / .25) * .55); g.fillRect(0, 0, W, H); } }
  // global grade + grain + vignette
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .06; g.globalCompositeOperation = 'overlay'; g.imageSmoothingEnabled = false; g.drawImage(GRAIN[fi % 4], 0, 0, W, H); g.restore();
  g.fillStyle = '#000'; g.fillRect(0, 0, W, BAR); g.fillRect(0, H - BAR, W, BAR);
  if (window.OPTS24.subs) {
    for (const [s, e, txt, who] of SUBS24.concat(EXTRA_SUBS.map(x => x))) if (t >= s && t < e) {
      const a = ss(s, s + .35, t) * (1 - ss(e - .35, e, t)); g.save(); g.globalAlpha = a * .92; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 40px Cairo';
      const lines = wrap(g, (who ? who + ': ' : '') + txt, 1500); lines.forEach((l, i) => { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(l, W / 2 + 2, H - BAR / 2 - (lines.length - 1) * 26 + i * 52 + 2); g.fillStyle = who ? '#ffd8a0' : '#e8e8e8'; g.fillText(l, W / 2, H - BAR / 2 - (lines.length - 1) * 26 + i * 52); });
      g.restore();
    }
  }
  if (t < .3) { g.fillStyle = rgba('#000', 1 - t / .3); g.fillRect(0, 0, W, H); }
  if (t > DUR24 - .8) { g.fillStyle = rgba('#000', ss(DUR24 - .8, DUR24, t)); g.fillRect(0, 0, W, H); }
}
window.renderV24 = renderV24; window.DUR24 = DUR24;
window.readyV24 = (async () => { await window.ready; SUBS24 = await (await fetch('v24/subs.json')).json(); return true; })();
