import json, re
VO = {  # id: (file, start, end) in the ElevenLabs file(s)
 'N1':(2,0.00,2.54),'A2':(2,137.69,138.74),'N3':(2,2.89,6.40),'N4':(2,6.64,10.60),'N5':(2,10.84,15.22),'N6':(2,15.51,18.22),
 'A8':(2,139.03,142.16),'N9':(2,18.48,21.41),'N10':(2,21.65,24.62),'N11':(2,24.80,28.83),'N12':(2,29.03,32.59),'N13':(2,32.80,36.73),
 'N14':(2,37.01,39.62),'N15':(2,39.68,45.48),'N16':(2,45.70,49.45),'N17':(2,49.64,55.30),'N18':(2,55.55,59.43),'N19':(2,59.66,63.88),
 'N20':(2,64.11,67.18),'N21':(2,67.45,71.44),'N22':(2,71.80,76.60),'A23':(2,142.50,144.46),'N24':(2,76.81,81.21),'N26':(2,81.44,87.45),
 'N27':(2,87.63,93.01),'N28':(2,93.20,97.01),'N29':(2,97.27,101.29),'N30':(2,101.59,106.73),'A31':(2,144.74,149.19),'N32':(2,106.94,111.84),
 'N33':(2,112.07,114.84),'N34':(2,115.02,117.87),'N35':(2,118.09,121.73),'N36':(2,121.93,126.17),'N37':(2,126.39,131.71),
 'NUP':(1,66.54,67.21),'A39':(2,149.59,150.15),'A40':(2,150.49,151.42),'A41':(2,151.84,152.55),'A42':(2,152.98,159.87),
 'A43':(2,160.27,162.98),'N44':(2,131.89,137.23)}
ORDER = ['N1','A2','N3','N4','N5','N6','A8','N9','N10','N11','N12','N13','N14','N15','N16','N17','N18','N19','N20','N21','N22','A23',
         'N24','N26','N27','N28','N29','N30','A31','N32','N33','N34','N35','N36','N37','NUP','A39','A40','A41','A42','A43','N44']
BEATS = [(0,6.0,'N1',.4),(6.0,9.0,'A2',.3),(9.0,13.0,'N3',.3),(13.0,17.5,'N4',.4),(17.5,24.0,'N5',.7),(24.0,29.0,'N6',.3),
 (29.0,32.7,'A8',.3),(32.7,36.0,'N9',.15),(36.0,41.0,'N10',.4),(41.0,46.0,'N11',.1),(46.0,50.2,'N12',.4),(50.2,54.0,'N13',.15),
 (54.0,58.8,'N14',.4),(58.8,64.0,'N15',.2),(64.0,68.4,'N16',.3),(68.4,76.0,'N17',.3),(76.0,80.1,'N18',.3),(80.1,83.0,'N19',.15),
 (83.0,86.0,'N20',.2),(86.0,90.0,'N21',.2),(90.0,93.6,'N22',.2),(93.6,96.6,'A23',.2),(96.6,100.4,'N24',.2),(100.4,104.0,'N26',.2),
 (104.0,108.9,'N27',.3),(108.9,114.0,'N28',.2),(114.0,119.0,'N29',.3),(119.0,124.0,'N30',.3),(124.0,128.3,None,0),
 (128.3,133.0,'A31',.3),(133.0,138.0,'N32',.2),(138.0,140.6,'N33',.3),(140.6,143.0,'N34',.1),(143.0,146.5,'N35',.2),
 (146.5,150.0,'N36',.1),(150.0,153.3,'N37',.3),(153.3,155.2,'NUP',.1),(155.2,157.0,'A39',.1),(157.0,161.0,None,0),
 (161.0,164.6,'A40',.4),(164.6,170.0,'A41',.6),(170.0,175.0,'A42',.3),(175.0,180.0,'A43',.1),(180.0,190.0,'N44',1.0)]
# original subtitle texts, in ORDER
js = open('scene.js').read()
subs_src = js[js.index('const SUBS = ['):js.index('];', js.index('const SUBS = ['))]
SUBS = [m for m in re.findall(r'\{[^{}]*\}', subs_src)]
assert len(SUBS) == len(ORDER), len(SUBS)
sub_by_id = dict(zip(ORDER, SUBS))
out, beats_js, place, lsubs = 0.0, [], [], []
for s0, s1, lid, lead in BEATS:
    sd = s1 - s0
    if lid:
        f, a, b = VO[lid]; d = b - a
        od = max(sd, lead + d + 0.45)
        vs = out + lead
        place.append((f, a, b, round(vs, 3)))
        sub = sub_by_id[lid]
        kind = re.search(r"k: '(\w+)'", sub)
        kind = kind.group(1) if kind else 'sub'
        e = out + od - 0.15 if kind in ('card', 'title', 'end') else min(vs + d + 0.5, out + od - 0.05)
        lsubs.append(re.sub(r's: [\d.]+, e: [\d.]+', f's: {vs - 0.05:.2f}, e: {e:.2f}', sub, count=1))
    else:
        od = sd
    beats_js.append([round(out, 3), round(out + od, 3), s0, s1])
    out += od
TOTAL = round(out, 3)
open('long_vo.js', 'w').write(f'''// Long 16:9 cut re-timed to the voiceover: output time -> source time warp + subtitles.
const BEATS = {json.dumps(beats_js)};
const LONG_DURATION = {TOTAL};
const LSUBS = [
  {(','+chr(10)+'  ').join(lsubs)}
];
function srcTime(tau) {{ for (const [o0, o1, s0, s1] of BEATS) if (tau < o1) return s0 + (Math.max(tau, o0) - o0) * (s1 - s0) / (o1 - o0); return 190; }}
function renderLong(tau, fi = 0) {{
  renderFrame(srcTime(tau), fi);
  for (const sb of LSUBS) if (tau >= sb.s && tau < sb.e) {{ const a = ss(sb.s, sb.s + .3, tau) * (1 - ss(sb.e - .3, sb.e, tau)); drawSub(G, sb, a, (1 - ss(sb.s, sb.s + .4, tau)) * 18); }}
}}
window.renderLong = renderLong; window.LONG_DURATION = LONG_DURATION;
''')
json.dump({'beats': beats_js, 'place': place, 'total': TOTAL}, open('long_vo.json', 'w'))
print('total', TOTAL, 'stretched beats:', [(b[2], round((b[1]-b[0])/(b[3]-b[2]), 2)) for b in beats_js if (b[1]-b[0]) > (b[3]-b[2]) + 0.01])
