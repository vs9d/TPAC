"""Long-video soundtrack time-warped to the voiceover edit, with the voice mixed in and music ducked."""
import json
cfg = json.load(open('long_vo.json'))
src = open('audio.py').read()
head = src.split('# ===================== SCORE =====================')[0].replace('DUR = 190.0', f"DUR = {cfg['total']}")
score = src.split('# ===================== SCORE =====================')[1].split('# ---------- mix ----------')[0]
pre = r'''
import json
CFG = json.load(open('long_vo.json'))
_OB = np.array([b[0] for b in CFG['beats']] + [CFG['beats'][-1][1]])
_SB = np.array([b[2] for b in CFG['beats']] + [CFG['beats'][-1][3]])
def W(s):
    return float(np.interp(s, _SB, _OB))
class Lazy:
    def __init__(self, fn, args, kw):
        self.fn, self.args, self.kw = fn, list(args), kw
        self.d = args[1]
    def make(self, d):
        a = list(self.args); a[1] = d
        return self.fn(*a, **self.kw)
    def arr(self):
        return self.fn(*self.args, **self.kw)
    def __mul__(self, o): return self.arr() * o
    __rmul__ = __mul__
_pad, _choir = pad, choir
pad = lambda *a, **k: Lazy(_pad, a, k)
choir = lambda *a, **k: Lazy(_choir, a, k)
_raw_add = add
def add(bus, start, sig, gain=1.0, pan=0.0):
    if isinstance(sig, Lazy):
        sig = sig.make(max(0.5, W(start + sig.d) - W(start)))
    _raw_add(bus, W(start), sig, gain, pan)
def lyre_ostinato(start, end, bpm, gain=0.5, octave=1, pattern=(0, 4, 7, 4, 2, 4, 7, 4), pan=-0.3):
    step = 60 / bpm / 2; t = W(start); e = W(end); i = 0
    while t < e - 0.2:
        _raw_add(music, t, pluck(deg(pattern[i % len(pattern)], octave), 1.6), gain * (1 if i % 8 == 0 else 0.7), pan); t += step; i += 1
def maqsum(start, end, bpm, gain=0.6, heavy=False):
    step = 60 / bpm / 2; t = W(start); e = W(end); i = 0
    while t < e - 0.1:
        p = i % 8
        if p in (0, 4): _raw_add(music, t, dum(1.3 if heavy else 1), gain, 0)
        elif p in (1, 3, 6): _raw_add(music, t, tek(), gain * 0.6, 0.25)
        elif heavy and p == 7: _raw_add(music, t, tek(), gain * 0.4, -0.25)
        t += step; i += 1
def theme(start, bpm, inst='pluck', octave=1, gain=0.6, pan=0.2):
    beat = 60 / bpm; t = W(start)
    for d, b in THEME:
        f = deg(d, octave)
        sig = pluck(f, max(1.2, b * beat + 0.8)) if inst == 'pluck' else ney(f, b * beat + 0.15)
        _raw_add(music, t, sig, gain, pan); t += b * beat
    return t
'''
voice = r'''
srcs = {}
for f, path in ((1, 'vo/vo44.wav'), (2, 'vo2/vo44.wav')):
    w = wave.open(path); srcs[f] = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
voice = np.zeros(N)
for f, a, b, o in CFG['place']:
    x = srcs[f]; a2, b2 = max(0, a - 0.06), min(len(x) / SR, b + 0.14)
    seg = x[int(a2 * SR):int(b2 * SR)].copy(); seg *= env(len(seg), 0.02, 0.06)
    i = int((o - (a - a2)) * SR); voice[i:i + len(seg)] += seg[:N - i]
voice = filt(voice, 'highpass', 80); voice /= np.abs(voice).max()
e = np.convolve(np.abs(voice), np.ones(int(0.05 * SR)) / int(0.05 * SR), mode='same')
act = np.convolve((e > 0.02).astype(float), np.ones(int(0.35 * SR)) / int(0.35 * SR), mode='same').clip(0, 1)
duck_m = 1 - 0.68 * act; duck_s = 1 - 0.45 * act
'''
mix = open('audio_vo.py').read().split("mix = r'''")[1].split("'''")[0].replace("'audio_vo.wav'", "'audio_long_vo.wav'")
exec(head + pre + score + voice + mix, {})
