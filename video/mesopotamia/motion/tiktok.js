// Vertical 9:16 TikTok cut built from the 16:9 scenes.
const V = document.getElementById('v'), VG = V.getContext('2d');
const VW = 1080, VH = 1920, BAND_Y = 880;

// [outStart, srcStart, duration, centerX (0..1 of 1920), visible source width]
const CLIPS = [
  [0.0, 1.0, 1.5, .5, 1150], [1.5, 3.4, 1.6, .58, 1150], [3.1, 6.9, 1.5, .5, 1150], [4.6, 9.0, 2.6, .5, 1150],
  [7.2, 13.6, 3.4, .42, 1300], [10.6, 26.5, 3.6, .54, 1300], [14.2, 37.0, 4.6, .5, 1500], [18.8, 55.0, 4.0, .5, 1150],
  [22.8, 68.4, 4.8, .53, 1800], [27.6, 83.3, 2.7, .5, 1300], [30.3, 87.0, 2.0, .5, 1300], [32.3, 93.6, 6.2, .5, 1300],
  [38.5, 105.0, 3.6, .5, 1150], [42.1, 115.6, 2.0, .5, 1150], [44.1, 124.0, 4.0, .5, 1300], [48.1, 129.0, 3.4, .5, 1150],
  [51.5, 133.2, 3.6, .5, 1300], [55.1, 153.3, 3.6, .5, 1300], [58.7, 164.6, 3.2, .5, 1300], [61.9, 170.3, 4.6, .42, 1150],
  [66.5, 182.0, 5.0, .5, 1500],
];
const TT_DURATION = 71.5;

const ERAS = [[0, 7.2, 'بغداد · اليوم'], [7.2, 32.3, 'أور · حوالي 2050 ق.م'], [32.3, 42.1, 'بابل حمورابي · حوالي 1755 ق.م'], [42.1, 58.7, 'بابل نبوخذنصر · حوالي 575 ق.م'], [58.7, 66.5, 'بغداد · اليوم']];

const TSUBS = [
  { s: .1, e: 3.0, t: 'تخيّل تصحى باچر الصبح…' },
  { s: 3.1, e: 7.1, t: 'بس مو بالعراق اللي تعرفه… بغداد مو موجودة!' },
  { s: 7.2, e: 10.5, t: 'رجعت 4000 سنة… إنت هسّه بين السومريين!' },
  { s: 10.6, e: 14.1, t: '«عمي والله ما أفتهم ولا كلمة!»', who: 'علي' },
  { s: 14.2, e: 18.7, t: 'ماكو عملة… الفضة توزن، والوحدة اسمها «شيقل»!', k: 'fact' },
  { s: 18.8, e: 22.7, t: 'أول كتابة بالتاريخ؟ حسابات! كم گونية شعير… كم راس غنم.', k: 'fact' },
  { s: 22.8, e: 27.5, t: 'الساعة 60 دقيقة والدائرة 360 درجة… من حساب العراق القديم!', k: 'fact' },
  { s: 27.6, e: 30.2, t: 'صديقه لو-نانا يهديه لوح… عليه كف إيده.' },
  { s: 30.3, e: 32.2, t: 'تمشي 300 سنة…' },
  { s: 32.3, e: 35.3, t: '«وين البوابة الزرقاء؟!»', who: 'علي' },
  { s: 35.4, e: 38.4, t: 'بعدها ما انبنت! باقي عليها 1200 سنة.' },
  { s: 38.5, e: 42.0, t: 'شريعة حمورابي: «حتى القوي ما يظلم الضعيف»', k: 'fact' },
  { s: 42.1, e: 44.0, t: 'وبعد 1200 سنة…' },
  { s: 44.2, e: 48.0, t: 'بوابة عشتار… بناها نبوخذنصر الثاني' },
  { s: 48.1, e: 51.4, t: '«معقولة كل هذا الجمال كان هنا… بأرض العراق؟»', who: 'علي' },
  { s: 51.5, e: 55.0, t: 'الثور رمز «أدد» · التنين رمز «مردوخ» · الأسد رمز «عشتار»', k: 'fact' },
  { s: 55.1, e: 56.9, t: '«شْلام…»', who: 'نُبتا' },
  { s: 57.0, e: 58.6, t: '«…سلام.»', who: 'علي' },
  { s: 58.7, e: 61.8, t: '«جان حلم…؟»', who: 'علي' },
  { s: 61.9, e: 66.4, t: '«إحنا نعيش على أرض كتبت بداية فصول عظيمة من تاريخ البشرية»', who: 'علي' },
];

function vSub(g, sub, a, rise) {
  g.save(); g.globalAlpha = a; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 64px "Cairo"'; const lines = wrap(g, sub.t, 840), lh = 92;
  let mw = 0; lines.forEach(l => mw = Math.max(mw, g.measureText(l).width));
  const cy = 1470 + rise, top = cy - lines.length * lh / 2 - 22, bh = lines.length * lh + 44, pad = 40;
  g.fillStyle = rgba('#0b0805', .72); rr(g, VW / 2 - mw / 2 - pad, top, mw + pad * 2, bh, 26);
  if (sub.who || sub.k === 'fact') {
    const label = sub.k === 'fact' ? 'معلومة' : sub.who; g.font = '800 40px "Cairo"'; const lw = g.measureText(label).width + 44;
    const lx = VW / 2 + mw / 2 + pad - lw; g.fillStyle = sub.k === 'fact' ? '#2456b5' : '#e2a63c'; rr(g, lx, top - 34, lw, 56, 28);
    g.fillStyle = sub.k === 'fact' ? '#fff' : '#1a1208'; g.fillText(label, lx + lw / 2, top - 5); g.font = '800 64px "Cairo"';
  }
  g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 10;
  lines.forEach((l, i) => g.fillText(l, VW / 2, top + 22 + lh / 2 + i * lh));
  g.restore();
}

function renderTT(tau, fi = 0) {
  let clip = CLIPS[CLIPS.length - 1];
  for (const c of CLIPS) if (tau >= c[0] && tau < c[0] + c[2]) { clip = c; break; }
  const [o, s, d, cx, w0] = clip, t = s + (tau - o);
  renderFrame(t, fi);
  const g = VG; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
  // blurred background
  const bs = VH / 1080, bw = 1920 * bs;
  g.filter = 'blur(36px) brightness(.5) saturate(1.2)';
  g.drawImage(C, VW / 2 - cx * bw, 0, bw, VH);
  g.filter = 'none';
  // main band
  const x0 = clamp(cx * 1920 - w0 / 2, 0, 1920 - w0), bh = 1080 * VW / w0, by = BAND_Y - bh / 2;
  g.drawImage(C, x0, 0, w0, 1080, 0, by, VW, bh);
  const fade = 70;
  let gr = g.createLinearGradient(0, by, 0, by + fade); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, by, VW, fade);
  gr = g.createLinearGradient(0, by + bh - fade, 0, by + bh); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, by + bh - fade, VW, fade);
  // headline
  if (tau < 66.5) {
    g.save(); g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 74px "Reem Kufi"'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 18;
    const gg = g.createLinearGradient(0, 170, 0, 330); gg.addColorStop(0, '#fff3cf'); gg.addColorStop(1, '#e2a63c'); g.fillStyle = gg;
    const pop = tau < .4 ? .9 + .1 * eo(tau / .4) : 1; g.translate(VW / 2, 215); g.scale(pop, pop);
    g.fillText('لو صحيت بالعراق', 0, -44); g.fillText('قبل 4000 سنة؟', 0, 50);
    g.restore();
    for (const [a, b, label] of ERAS) if (tau >= a && tau < b) { const al = ss(a, a + .35, tau) * (1 - ss(b - .25, b, tau)); chip(g, VW / 2, 345, label, al, '#2456b5', '#fff', 38); }
  } else {
    const p = tau - 66.5, a = ss(.3, 1.1, p);
    g.save(); g.globalAlpha = a; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = rgba('#000', .45); g.fillRect(0, 1250, VW, 330);
    g.font = '700 62px "Reem Kufi"'; g.shadowColor = 'rgba(255,200,110,.85)'; g.shadowBlur = 24; g.fillStyle = '#fff4d6';
    ['هنا لم تبدأ حكاية العراق فقط…', 'هنا كُتبت فصول من حكاية', 'الحضارة الإنسانية'].forEach((l, i) => g.fillText(l, VW / 2, 1320 + i * 92));
    g.restore();
    g.fillStyle = rgba('#000', ss(4.2, 5, p)); g.fillRect(0, 0, VW, VH);
  }
  for (const sb of TSUBS) if (tau >= sb.s && tau < sb.e) vSub(g, sb, ss(sb.s, sb.s + .25, tau) * (1 - ss(sb.e - .25, sb.e, tau)), (1 - ss(sb.s, sb.s + .3, tau)) * 16);
}
window.renderTT = renderTT; window.TT_DURATION = TT_DURATION;
