import json, wave, numpy as np
subs = json.load(open('v24/subs.json')); assert len(subs) == 76
w = wave.open('vo3/vo44.wav'); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768; SR = 44100
# (start, end, [line indices]) from the transcription
G = [(0.00,3.53,[0]),(4.00,7.84,[1]),(8.18,10.95,[2]),(11.27,14.62,[3]),(15.03,20.62,[4]),(21.03,21.98,[5]),(22.41,25.89,[6]),
 (26.24,29.26,[7]),(29.67,35.21,[8]),(35.63,37.42,[9]),(37.91,41.26,[10]),(41.68,45.12,[11]),(45.45,57.20,[12,13,14]),
 (57.52,61.03,[15]),(61.42,65.42,[16,17]),(65.90,69.43,[18]),(69.74,93.60,[19,20,21,22,23,24]),(93.91,100.63,[25]),
 (100.97,107.06,[26]),(107.40,113.17,[27,28]),(113.47,117.67,[29]),(117.97,121.19,[30]),(121.58,128.87,[31,32]),
 (129.19,130.28,[33]),(130.62,141.83,[34,35,36]),(142.13,159.40,[37,38,39,40]),(159.76,169.69,[41,42,43]),
 (170.07,179.57,[44,45]),(179.98,182.04,[46]),(182.53,189.75,[47]),(190.09,194.66,[48]),(195.01,200.30,[49]),
 (200.66,208.12,[50]),(208.46,215.38,[51]),(215.82,219.07,[52]),(219.39,223.56,[53]),(223.92,230.19,[54]),
 (230.56,233.68,[55]),(234.06,239.01,[56]),(239.31,246.18,[57,58]),(246.58,252.56,[59]),(253.02,261.14,[60]),
 (261.44,264.81,[61]),(265.25,267.59,[62]),(268.03,269.20,[63]),(269.74,275.61,[64]),(275.96,279.78,[65]),
 (280.22,283.36,[66]),(283.78,288.16,[67]),(288.48,291.30,[68]),(291.62,298.82,[69]),(299.12,315.31,[70,71,72,73]),
 (315.68,320.68,[74,75])]
assert sorted(i for g in G for i in g[2]) == list(range(76))
hop = int(.01 * SR); rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 2) / (hop * 2), mode='same'))[::hop]
def best_pause(a, b, target):
    i0, i1 = int(a * 100), int(b * 100); seg = rms[i0:i1]
    win = 12; sm = np.convolve(seg, np.ones(win) / win, mode='same')
    cand = [(abs((i0 + k) / 100 - target) * 0.6 + sm[k] * 40, (i0 + k) / 100) for k in range(win, len(sm) - win)]
    return min(cand)[1]
spans = {}
for a, b, idx in G:
    if len(idx) == 1: spans[idx[0]] = (a, b); continue
    L = [len(subs[i][2]) for i in idx]; tot = sum(L); cur = a; bounds = [a]
    for k in range(len(idx) - 1):
        target = a + (b - a) * sum(L[:k + 1]) / tot
        p = best_pause(max(cur + .4, target - 1.6), min(b - .4, target + 1.6), target); bounds.append(p); cur = p
    bounds.append(b)
    for k, i in enumerate(idx): spans[i] = (bounds[k] + (0.05 if k else 0), bounds[k + 1] - (0.05 if k < len(idx) - 1 else 0))
place, prev_end, warn = [], 0, []
for i, (s, e, txt) in enumerate(subs):
    t0 = s - 0.15; a, b = spans[i]; d = b - a
    nxt = subs[i + 1][0] - 0.15 if i + 1 < 76 else 600
    start = max(t0, prev_end + 0.25)
    if start + d > nxt - 0.1: warn.append((i, round(start + d - nxt, 2)))
    place.append([round(a, 3), round(b, 3), round(start, 3)]); prev_end = start + d
json.dump(place, open('vo3/place.json', 'w'))
print('overflows:', warn)
for i in (12, 13, 14, 19, 20, 21, 22, 23, 24, 37, 38, 39, 40, 70, 71, 72, 73): print(i, place[i], subs[i][2][:30])
