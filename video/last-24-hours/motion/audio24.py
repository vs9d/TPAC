"""Soundtrack for "Last 24 hours" (600 s): piano/strings score + sound design. Reuses helpers from audio.py."""
src = open('audio.py').read()
head = src.split('# ===================== SCORE =====================')[0].replace('DUR = 190.0', 'DUR = 600.0')
score = r'''
NOTES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def nf(n):
    name, octv = n[:-1], int(n[-1]); return 440 * 2 ** ((NOTES[name] + 12 * (octv + 1) - 69) / 12)
def piano(f, d=3.5, vel=1.0):
    t = T(d); s = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 12000: break
        s += (1 / k ** 1.25) * np.sin(2 * np.pi * fk * t + k * .3) * np.exp(-t * (0.5 + 0.45 * k))
    ham = filt(rng.standard_normal(len(t)), 'bandpass', [800, 5000]) * np.exp(-t * 180) * 0.15
    return (s * 0.45 + ham) * env(len(t), 0.004, 0.25) * vel
def strings(freqs, d, a=1.8, r=2.0, cut=1600):
    return pad(freqs, d, cut, a, r)
CH = {
 'Am': ['A2', 'E3', 'A3', 'C4', 'E4'], 'F': ['F2', 'C3', 'F3', 'A3', 'C4'], 'C': ['C3', 'G3', 'C4', 'E4', 'G4'],
 'G': ['G2', 'D3', 'G3', 'B3', 'D4'], 'Em': ['E2', 'B2', 'E3', 'G3', 'B3'], 'Dm': ['D3', 'A3', 'D4', 'F4', 'A4'],
}
def chord_seq(start, end, seq, dur, style='block', vel=.55, strings_gain=0.0, octave_up=False, arp_div=4):
    t, i = start, 0
    while t < end - 0.5:
        notes = CH[seq[i % len(seq)]]
        fr = [nf(n) * (2 if octave_up else 1) for n in notes]
        if style == 'block':
            for k, f in enumerate(fr): add(music, t + k * 0.02, piano(f, dur + 1.5, vel * (0.7 if k else 1)), 1, -0.2 + k * 0.1)
        else:
            step = dur / arp_div
            for k in range(arp_div):
                f = fr[[0, 2, 3, 4, 3, 2, 1, 3][k % 8] % len(fr)]
                add(music, t + k * step, piano(f, 2.5, vel * (1 if k == 0 else .7)), 1, -0.3 + (k % 4) * 0.2)
            add(music, t, piano(fr[0] / 2, dur + 1, vel * .6), 1, 0)
        if strings_gain:
            add(music, t, strings(fr[1:4], dur + 0.6, 1.0, 1.2), strings_gain, 0)
        t += dur; i += 1
def heartbeat(start, end, bpm0, bpm1, gain=.7):
    t = start
    while t < end:
        k = (t - start) / max(1e-6, end - start); bpm = bpm0 + (bpm1 - bpm0) * k
        add(sfx, t, dum(0.9), gain, 0); add(sfx, t + 0.22, dum(0.6), gain * .7, 0); t += 60 / bpm
def ticks(start, end, every=1.0, gain=.25, rise=False):
    t = start
    while t < end:
        g = gain * (1 + 2 * (t - start) / (end - start) if rise else 1); add(sfx, t, tick(), g, .3); add(sfx, t + .5 * every, tick(), g * .5, .3) if every >= 1 else None; t += every
def notif_mystery(): # glassy dissonant two-tone
    t = T(1.8); s = (np.sin(2 * np.pi * 1318.5 * t) + .8 * np.sin(2 * np.pi * 1396.9 * t + .5)) * np.exp(-t * 3.2) + .4 * np.sin(2 * np.pi * 659.3 * t) * np.exp(-t * 2)
    return s * 0.18
def notif_warm():
    a = T(0.5); b = T(0.9)
    s1 = np.sin(2 * np.pi * 880 * a) * np.exp(-a * 9); s2 = np.sin(2 * np.pi * 1318.5 * b) * np.exp(-b * 6)
    out = np.zeros(int(SR * 1.1)); out[:len(s1)] += s1; out[int(SR * .12):int(SR * .12) + len(s2)] += s2; return out * 0.2
def ring(d=2.0):
    t = T(d); return (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * 0.08 * env(len(t), .02, .02)
def sit_tone():
    out = []
    for f in (950, 1400, 1800): t = T(0.33); out.append(np.sin(2 * np.pi * f * t) * 0.1 * env(len(t), .01, .02))
    return np.concatenate(out)
def vibrate(d=2.2):
    t = T(d); s = filt(rng.standard_normal(len(t)), 'bandpass', [90, 260]) * (np.sin(2 * np.pi * 7 * t) > 0) * 0.9
    return s * env(len(t), .01, .05)
def birds(d):
    out = np.zeros(int(SR * d))
    for k in range(int(d * 1.2)):
        st = rng.random() * (d - .4); t = T(.18); f0 = 3000 + rng.random() * 1800
        c = np.sin(2 * np.pi * np.cumsum(f0 + 900 * np.sin(2 * np.pi * 14 * t)) / SR) * np.hanning(len(t)) * .08
        i = int(st * SR); out[i:i + len(c)] += c
    return out

# ---------------- CHAPTER 1: mystery ----------------
add(sfx, 0.55, vibrate(2.3), 0.55)
add(sfx, 0.5, boom(2.5), 0.35)
for k in range(5):
    tt = 3.0 + k * 0.8; add(sfx, tt, boom(0.9), 0.55); add(sfx, tt, whoosh(0.5, 300, 4000, .8), 0.5, (-1) ** k * .4)
ticks(3.0, 7.0, 0.4, 0.2)
add(music, 7.0, pad([nf('A1'), nf('E2')], 48, 300, 3.0, 3.0), 0.55)
add(music, 7.0, choir([nf('A2'), nf('E3')], 48, 4.0, 4.0), 0.18)
add(sfx, 12.0, notif_mystery(), 1.0, .1)
heartbeat(16.0, 30.0, 52, 58, .35)
for t0 in (30.6, 34.4): add(sfx, t0, ring(2.0), 1.0, .3)
add(sfx, 36.4, sit_tone(), 1.0, .3)
ticks(38.0, 55.0, 1.0, 0.22, rise=True)
heartbeat(38.0, 55.0, 60, 96, .45)
add(music, 46.0, pad([nf('A2'), nf('D#3'), nf('A3')], 9.5, 900, 6.0, 0.3), 0.35)
add(sfx, 55.0, boom(5.0), 1.0)
# ---------------- CHAPTER 2: lonely piano ----------------
chord_seq(60.6, 108.5, ['Am', 'F', 'C', 'G'], 4.0, 'arp', .5, 0.0, False, 4)
add(sfx, 81.5, filt(rng.standard_normal(int(SR * 2.5)), 'bandpass', [1500, 6000]) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * T(2.5))) * .25, 0.6)
add(sfx, 88.0, amb(8, 300, 1200, .3, .2), 0.05)
add(music, 96.0, strings([nf('A3'), nf('C4'), nf('E4')], 12, 2.0, 2.0), 0.2)
add(music, 115.2, piano(nf('E4'), 5, .55), 1)
add(music, 116.0, piano(nf('A3'), 5, .45), 1)
# ---------------- CHAPTER 3: warm people ----------------
chord_seq(120.2, 208.0, ['C', 'G', 'Am', 'F'], 3.33, 'arp', .45, 0.28, False, 4)
add(sfx, 128.3, notif_warm(), .7)
for t0 in (133.6, 136.0): add(sfx, t0, ring(1.6), .8, -.3)
for k in range(10): add(sfx, 148.5 + k * .45, tick(), .2, .2)
add(sfx, 166.0, amb(16, 500, 3000, .4, .4), .06)
r2 = np.random.default_rng(5)
for k in range(26): add(sfx, 166.5 + r2.random() * 15, clink(2200 + r2.random() * 1600), .35, r2.random() * 2 - 1)
add(sfx, 190.0, notif_warm(), 1.0, .2)
add(sfx, 194.0, amb(16, 300, 1400, .3, .3), .09)
add(sfx, 194.0, amb(16, 2000, 8000, .2, .1), .05)
# ---------------- CHAPTER 4: dreams ----------------
chord_seq(210.0, 224.0, ['F', 'C', 'G', 'Am'], 3.5, 'arp', .42, 0.25, False, 8)
add(sfx, 221.0, whoosh(4.0, 150, 3000, .6), .7)
chord_seq(224.0, 240.0, ['F', 'G', 'Am', 'C'], 4.0, 'arp', .5, 0.4, True, 8)
for k in range(8): add(music, 224.0 + k * 2.0, dum(1.0), .35)
add(sfx, 224.0, amb(5.2, 200, 2200, .6, .5), .25)
add(sfx, 229.0, amb(5.5, 4200, 6000, .95, 10), .04)
add(sfx, 234.5, amb(5.5, 1500, 9000, .2, .2), .12)
chord_seq(240.0, 281.5, ['Am', 'F', 'C', 'G'], 4.0, 'arp', .42, 0.25, False, 4)
add(sfx, 248.6, whoosh(1.4, 2000, 300, .6), .5)
add(sfx, 272.6, (lambda t: (np.sin(2 * np.pi * 2093 * t) + np.sin(2 * np.pi * 2637 * t)) * np.exp(-t * 4) * .12)(T(1.5)), 1.0, .2)
for tt, n in ((283.0, 'C4'), (283.8, 'D#4'), (284.6, 'F#4')): add(sfx, tt, piano(nf(n), 4.0, .9), 1.0, 0)
add(music, 292.0, strings([nf('C4'), nf('E4'), nf('G4')], 8.5, 1.5, 2.5), .35)
add(music, 292.0, piano(nf('C5'), 6, .4), 1)
# ---------------- CHAPTER 5: city ----------------
city = amb(90, 80, 900, .2, .05) * 1.0 + amb(90, 900, 3500, .4, .2) * .35
c = np.ones(len(city)); i0, i1 = int(34 * SR), int(36.5 * SR); c[i0:i1] = np.linspace(1, .15, i1 - i0) if False else .2
add(sfx, 300.0, city * c, .22)
for k in range(9): add(sfx, 302 + k * 9.3 + (k % 3), (lambda t: np.sin(2 * np.pi * (440 if k % 2 else 392) * t) * env(len(t), .01, .05) * .06)(T(0.35)), 1, (-1) ** k * .6)
t = 300.0
while t < 374.0:
    add(music, t, dum(0.8), .28); add(music, t + .3, tek(), .12, .2); t += 60 / 100 * 2
add(music, 300.0, pad([nf('A2'), nf('E3'), nf('A3')], 75, 700, 2.5, 3.0), .22)
for k in range(12): add(music, 312 + k * 5.0, piano(nf(['E5', 'C5', 'A4', 'B4'][k % 4]), 3, .25), 1, .3)
add(sfx, 320.0, whoosh(4.0, 200, 900, .5), .45)
add(sfx, 355.0, amb(20, 600, 3000, .5, .8), .08)
for k in range(8): add(sfx, 356 + k * 2.3, thud(), .4, .2)
ticks(375.0, 381.0, 1.0, .25)
add(music, 381.0, strings([nf('A3'), nf('C4'), nf('E4')], 9, 2.0, 2.5), .3)
# ---------------- CHAPTER 6: sunset & memories ----------------
add(sfx, 390.0, amb(30, 300, 1500, .4, .3), .05)
chord_seq(390.0, 420.0, ['F', 'C', 'Am', 'G'], 4.0, 'arp', .45, .3, False, 4)
add(sfx, 418.5, whoosh(2.0, 3000, 400, .6), .4)
chord_seq(420.0, 451.0, ['Am', 'F', 'C', 'G'], 3.875, 'arp', .5, .35, True, 8)
for k in range(4): add(sfx, 420 + [0, 8, 15, 23][k], whoosh(1.2, 1500, 300, .6), .3)
chord_seq(451.0, 472.0, ['F', 'G', 'Am', 'C', 'F', 'G', 'C'], 3.0, 'block', .6, .55, False)
add(music, 455.0, choir([nf('A3'), nf('C4'), nf('E4')], 17, 4.0, 4.0), .45)
add(sfx, 460.0, boom(4.0), .5)
add(music, 472.0, pad([nf('C3'), nf('G3')], 8, 500, 1.0, 2.0), .3)
ticks(472.0, 480.0, 0.25, .12)
# ---------------- CHAPTER 7: last hour, silence, reveal, hope ----------------
add(sfx, 480.0, amb(44, 150, 700, .3, .1), .14)
add(sfx, 486.0, birds(36), .5, .3)
add(music, 480.0, pad([nf('A2'), nf('E3')], 34, 400, 4.0, 4.0), .3)
for k, n in enumerate(['E4', 'C4', 'A3', 'B3', 'C4']): add(music, 482 + k * 6, piano(nf(n), 6, .35), 1)
ticks(514.0, 524.0, 1.0, .35, rise=True)
add(sfx, 527.2, notif_warm(), 1.0)
add(sfx, 527.0, birds(27), .7, -.2)
for k, n in enumerate(['C4', 'E4', 'G4', 'C5']): add(music, 533 + k * 3.5, piano(nf(n), 6, .4), 1)
add(music, 533.0, strings([nf('C3'), nf('G3'), nf('E4')], 15, 4.0, 2.0), .25)
add(music, 548.2, piano(nf('E5'), 7, .6), 1)
add(music, 548.2, strings([nf('E4'), nf('A4')], 6, 1.0, 1.5), .2)
chord_seq(554.0, 587.0, ['C', 'G', 'Am', 'F'], 3.0, 'arp', .55, .5, True, 8)
add(music, 554.0, choir([nf('C3'), nf('G3'), nf('C4'), nf('E4')], 33, 3.0, 4.0), .4)
for k in range(11): add(music, 554 + k * 3.0, dum(1.1), .3)
add(sfx, 554.0, boom(5.0), .45)
add(sfx, 584.2, choir([nf('E5')], 2.0, .2, 1.5), .5)
add(sfx, 584.1, amb(.8, 300, 2000, .1, .1) * np.hanning(int(.8 * SR)), .3)
chord_seq(587.0, 597.0, ['F', 'C'], 5.0, 'block', .45, .3, False)
add(sfx, 596.0, notif_warm(), .5)
'''
mix = r'''
ir_t = T(3.2)
ir = rng.standard_normal((2, len(ir_t))) * np.exp(-ir_t * 2.2)
ir[:, :int(0.03 * SR)] *= np.linspace(0, 1, int(0.03 * SR))
ir /= np.abs(ir).sum(axis=1, keepdims=True) ** 0.5 * 20
wet_m = np.stack([fftconvolve(music[c], ir[c])[:N] for c in range(2)])
wet_s = np.stack([fftconvolve(sfx[c], ir[c])[:N] for c in range(2)])
mixd = music * 0.85 + wet_m * 0.7 + sfx + wet_s * 0.25
mixd = np.stack([filt(mixd[c], 'highpass', 30) for c in range(2)])
mixd /= np.percentile(np.abs(mixd), 99.95) * 1.15
mixd = np.tanh(mixd * 1.1) / np.tanh(1.1) * 0.9
tt = np.arange(N) / SR
mixd[:, (tt >= 524.0) & (tt < 527.0)] = 0.0          # absolute cinematic silence
fade = np.clip((tt - 523.6) / 0.4, 0, 1); mixd *= np.where(tt < 524.0, 1 - fade, 1)[None, :]
mixd *= np.clip((600.0 - 0.3 - tt) / 2.5, 0, 1)[None, :]
pcm = (mixd.T * 32767).astype(np.int16)
with wave.open('audio24.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape)
'''
exec(head + score + mix, {})
