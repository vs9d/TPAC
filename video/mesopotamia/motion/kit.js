function strokeText(g, s, x, y, font, fill, stroke, sw) { g.font = font; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = sw; g.strokeStyle = stroke; g.strokeText(s, x, y); g.fillStyle = fill; g.fillText(s, x, y); }
function thumb() {
  const g = G; g.setTransform(1, 0, 0, 1, 0, 0);
  sky(g, [[0, '#1d3f86'], [.55, '#e8a868'], [1, '#ffd9a0']]);
  glow(g, 1350, 420, 900, '#ffd08a', .55);
  g.drawImage(GATE(), 760, 240, 1240, 844);
  rays(g, 1380, 150, 2, '#ffe0a8', .12);
  g.fillStyle = vgrad(g, 0, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
  const lg = g.createLinearGradient(0, 0, 1100, 0); lg.addColorStop(0, 'rgba(10,8,20,.75)'); lg.addColorStop(1, 'rgba(10,8,20,0)'); g.fillStyle = lg; g.fillRect(0, 0, 1100, 1080);
  g.save(); g.translate(430, 1500); ali(g, 0, 0, 4.2, { view: 'front', look: 1, mouth: .9, brow: 6 }); g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(90,160,255,.25)'; ell(g, 430 - 36 + 13, 1500 - 192 * 4.2, 15, 13); ell(g, 430 + 36 + 13, 1500 - 192 * 4.2, 15, 13); g.restore();
  strokeText(g, 'رجعت 4000 سنة!', 1290, 150, '800 136px Cairo', '#ffd23a', '#120a04', 26);
  strokeText(g, 'يوم كامل بالعراق القديم', 1290, 300, '800 78px Cairo', '#ffffff', '#120a04', 18);
  chip(g, 1330, 960, 'أور ← بابل ← بوابة عشتار', 1, '#2456b5', '#fff', 52);
  post(g, 0, 1);
}
function banner() {
  const g = document.getElementById('b').getContext('2d'), BW = 2560, BH = 1440;
  const gr = g.createLinearGradient(0, 0, BW, 0); gr.addColorStop(0, '#f0a868'); gr.addColorStop(.45, '#3a2a4a'); gr.addColorStop(.55, '#2a2a5a'); gr.addColorStop(1, '#1f4fa8'); g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
  glow(g, 420, 560, 900, '#ffd08a', .6); glow(g, 2150, 560, 900, '#7fb0ff', .35);
  g.fillStyle = vgrad(g, 900, 1440, [[0, '#b48a62'], [1, '#7a5a3a']]); g.fillRect(0, 900, BW, 540);
  zigUr(g, 380, 900, 680, 420, { front: '#c48a5e', side: '#93603f', top: '#dcaa7c', stair: '#a46b47', shrine: '#ad7651' });
  for (let i = 0; i < 4; i++) palm(g, 40 + i * 190, 960, .8, 1, '#2f4a22', '#5a4126');
  g.drawImage(GATE(), 1880, 430, 700, 476);
  
  const mid = g.createLinearGradient(560, 0, 2000, 0); mid.addColorStop(0, 'rgba(20,14,30,0)'); mid.addColorStop(.25, 'rgba(20,14,30,.85)'); mid.addColorStop(.75, 'rgba(20,14,30,.85)'); mid.addColorStop(1, 'rgba(20,14,30,0)');
  g.fillStyle = mid; g.fillRect(560, 0, 1440, BH);
  g.save(); g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 150px "Reem Kufi"'; g.shadowColor = 'rgba(255,190,80,.7)'; g.shadowBlur = 30;
  const tg = g.createLinearGradient(0, 590, 0, 760); tg.addColorStop(0, '#fff3cf'); tg.addColorStop(1, '#e2a63c'); g.fillStyle = tg; g.fillText('حكايات الرافدين', BW / 2, 670);
  g.shadowBlur = 0; g.font = '700 54px Cairo'; g.fillStyle = '#f3e6cc'; g.fillText('رحلات بالزمن لتاريخ العراق القديم', BW / 2, 800);
  g.restore();
}
function profile() {
  const g = document.getElementById('p').getContext('2d');
  const r = g.createRadialGradient(400, 380, 0, 400, 400, 420); r.addColorStop(0, '#2a5cc0'); r.addColorStop(1, '#0d2458'); g.fillStyle = r; g.fillRect(0, 0, 800, 800);
  g.save(); g.beginPath(); g.arc(400, 400, 330, 0, TAU); g.clip();
  g.drawImage(GATE(), 640, 400, 720, 960, 40, 140, 720, 960);
  g.restore();
  g.strokeStyle = '#e2a63c'; g.lineWidth = 22; g.beginPath(); g.arc(400, 400, 342, 0, TAU); g.stroke();
  g.strokeStyle = '#fff3cf'; g.lineWidth = 4; g.beginPath(); g.arc(400, 400, 356, 0, TAU); g.stroke();
}
window.kit = () => { thumb(); banner(); profile(); return ['c', 'b', 'p'].map(id => document.getElementById(id).toDataURL('image/png')); };
