"""TikTok soundtrack re-timed to the ElevenLabs voiceover, with the voice mixed in and music ducked."""
src = open('audio.py').read()
head = src.split('# ===================== SCORE =====================')[0].replace('DUR = 190.0', 'DUR = 78.7')
score = r'''
B = dict(fan=0, phone=1.5, seal=3.1, vortex=4.6, reveal=7.2, greet=10.8, market=14.6, tablet=19.2, watch=24.8, hand=30.4,
         lapse=33.3, hamm=35.3, stele=41.7, tunnel=45.5, gate=47.5, close=51.5, animals=55.4, night=60.3, home=63.9,
         final=67.1, aerial=71.7, end=78.7)
# hook
t = T(1.6)
fan_f = 110 * np.clip(1 - t / 1.4, 0, 1) ** 1.3 + 0.01
add(sfx, 0, np.sin(2 * np.pi * np.cumsum(fan_f) / SR) * 0.3 + amb(1.6, 300, 1500, 0.9, 0) * np.clip(1 - t / 1.4, 0, 1) * 0.4, 0.6)
gen = sum(np.sin(2 * np.pi * 25 * k * t) / k for k in range(1, 8)) * (np.sin(2 * np.pi * 7 * t) > -0.2) * np.clip(1 - (t - 0.9) / 0.3, 0, 1)
add(sfx, 0, filt(gen, 'lowpass', 400), 0.4)
add(sfx, 1.5, tick(), 0.6); add(sfx, 1.9, ping(880), 0.4)
t = T(1.6); hf = 70 + 180 * (t / 1.6) ** 2
add(sfx, B['seal'], (np.sin(2 * np.pi * np.cumsum(hf) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(hf) / SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * (6 + t * 10) * t)) * (t / 1.6 + 0.3), 0.35)
add(sfx, B['vortex'], boom(3.0), 1.0)
add(sfx, B['vortex'], whoosh(2.8, 200, 3500, 0.8), 0.9, -0.2)
add(sfx, B['reveal'] - 0.05, thud(), 0.8)
# Ur
add(music, B['reveal'], choir([deg(0, 0), deg(4, 0), deg(0, 1), deg(2, 1)], 5.0, 0.4, 2.0), 0.8)
add(music, B['reveal'], dum(1.6), 0.9)
add(music, B['reveal'], pad(Dm, B['lapse'] - B['reveal'], 700, 0.5, 1.0), 0.3)
lyre_ostinato(B['reveal'] + 0.2, B['lapse'], 100, 0.38)
maqsum(B['greet'], B['lapse'], 100, 0.5)
theme(B['greet'] + 0.2, 100, 'ney', 1, 0.45)
theme(B['tablet'] + 0.2, 100, 'pluck', 2, 0.35, 0.4)
for i in range(12):
    add(sfx, B['market'] + 0.6 + (i * 0.9 + 1) / 5, clink(2400 + (i % 4) * 300), 0.9, 0.3)
for i in range(14):
    add(sfx, B['tablet'] + 0.5 + i * 0.3, thud(), 0.35, 0.2)
for k in range(int(5.5 / 0.0625)):
    add(sfx, B['watch'] + k * 0.0625, tick(), 0.3 if k % 4 == 0 else 0.12)
add(music, B['watch'], choir([deg(0, 0), deg(4, 0)], 5.6, 0.6, 1.5), 0.45)
t = T(2.8)
add(sfx, B['hand'], (np.sin(2 * np.pi * 110 * t) + 0.5 * np.sin(2 * np.pi * 220 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 10 * t)) * env(len(t), 0.4, 0.2), 0.22)
add(sfx, B['lapse'] - 0.2, whoosh(2.4, 150, 5000, 0.7), 1.0)
add(sfx, B['hamm'], boom(2.0), 0.6)
# Hammurabi
add(music, B['hamm'], pad([deg(0, -1), deg(4, -1), deg(5, -1)], 10.2, 500, 0.8, 1.0), 0.4)
for k in range(7):
    add(music, B['hamm'] + 0.1 + k * 1.4, dum(1.1), 0.5 if k % 2 == 0 else 0.3)
lyre_ostinato(B['hamm'] + 0.1, B['stele'], 84, 0.3, 0, (0, 4, 5, 4, 0, 4, 1, 0), -0.2)
add(sfx, B['hamm'] + 2.9, thud(), 0.6)
add(music, B['stele'], choir([deg(0, -1), deg(4, -1), deg(0, 0)], 3.8, 0.8, 1.0), 0.6)
theme(B['stele'] + 0.1, 90, 'pluck', 0, 0.45, 0.2)
add(sfx, B['tunnel'] - 0.2, whoosh(2.4, 100, 6000, 0.8), 1.0)
for k in range(16):
    add(music, B['tunnel'] + k * 0.125, tek() if k % 2 else dum(0.5 + k / 20), 0.15 + k / 30)
# Gate
g0 = B['gate']
add(sfx, g0, boom(5.0), 1.0)
add(music, g0, dum(2.0), 1.0)
add(music, g0, choir([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0), deg(4, 0)], B['night'] - g0, 0.6, 2.5), 1.0)
add(music, g0, pad([deg(0, -2), deg(0, -1)], B['night'] - g0, 400, 0.4, 2.5), 0.6)
maqsum(g0 + 1.2, B['night'], 100, 0.6, True)
lyre_ostinato(g0 + 1.2, B['night'], 100, 0.35, 1)
theme(B['close'], 70, 'ney', 1, 0.45, -0.1)
add(sfx, g0 + 0.3, amb(B['night'] - g0, 400, 2500, 0.5, 0.5), 0.12)
# night
n0 = B['night']
add(music, n0, pad([deg(0, -1), deg(4, -1)], 3.8, 400, 0.6, 1.0), 0.35)
add(sfx, n0, amb(3.6, 4200, 6000, 0.95, 10), 0.04)
add(music, n0 + 0.2, pluck(deg(4, 1), 3), 0.5)
add(music, n0 + 1.8, pluck(deg(0, 1), 3), 0.5)
add(sfx, B['home'] - 0.4, whoosh(1.4, 6000, 200, 0.7), 0.7)
for k in range(4):
    add(sfx, B['home'] + 0.2 + k * 0.3, ping(1320 if k % 2 else 1760), 0.45, -0.4)
add(music, B['home'], pad(Dm, B['aerial'] - B['home'], 700, 1.0, 1.0), 0.3)
theme(B['home'] + 0.3, 72, 'pluck', 1, 0.5)
add(music, B['final'], choir([deg(0, 0), deg(4, 0)], 4.6, 1.5, 1.0), 0.35)
# finale
a0 = B['aerial']
add(sfx, a0, boom(5.0), 0.8)
add(music, a0, dum(1.8), 0.8)
add(music, a0, choir([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0), deg(4, 0), deg(0, 1)], 7.0, 0.5, 3.0), 1.0)
add(music, a0, pad([deg(0, -2), deg(0, -1), deg(4, -1)], 7.0, 600, 0.5, 3.0), 0.6)
theme(a0 + 0.1, 80, 'pluck', 1, 0.6)

# ---------- voiceover ----------
w = wave.open('vo/vo44.wav'); vo_src = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
LINES = [(0.00, 2.29, 0.1), (2.61, 5.94, 3.2), (6.18, 9.40, 7.3), (51.27, 54.22, 11.4), (9.61, 13.08, 14.8),
         (13.28, 18.47, 19.3), (18.69, 23.86, 24.9), (24.11, 26.80, 30.5), (27.15, 28.46, 33.45), (54.52, 56.14, 35.5),
         (28.82, 32.01, 38.1), (32.26, 35.58, 41.85), (35.94, 37.48, 45.6), (37.76, 40.63, 48.3), (56.45, 59.90, 51.65),
         (40.89, 45.20, 55.5), (66.54, 67.21, 60.6), (60.17, 60.75, 61.9), (61.02, 61.73, 64.6), (61.97, 66.24, 67.25),
         (45.48, 50.89, 72.2)]
voice = np.zeros(N)
for a, b, o in LINES:
    a2, b2 = max(0, a - 0.06), min(len(vo_src) / SR, b + 0.14)
    seg = vo_src[int(a2 * SR):int(b2 * SR)].copy()
    seg *= env(len(seg), 0.02, 0.06)
    i = int((o - (a - a2)) * SR)
    voice[i:i + len(seg)] += seg[:N - i]
voice = filt(voice, 'highpass', 80)
voice /= np.abs(voice).max()
# ducking envelope from the voice
e = np.abs(voice)
win = int(0.05 * SR)
e = np.convolve(e, np.ones(win) / win, mode='same')
act = (e > 0.02).astype(float)
k = int(0.35 * SR)
act = np.convolve(act, np.ones(k) / k, mode='same').clip(0, 1)
duck_m = 1 - 0.68 * act
duck_s = 1 - 0.45 * act
'''
mix = r'''
ir_t = T(2.2)
ir = rng.standard_normal((2, len(ir_t))) * np.exp(-ir_t * 3.0)
ir[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
ir /= np.abs(ir).sum(axis=1, keepdims=True) ** 0.5 * 20
wet_m = np.stack([fftconvolve(music[c], ir[c])[:N] for c in range(2)])
wet_s = np.stack([fftconvolve(sfx[c], ir[c])[:N] for c in range(2)])
bed = (music * 0.9 + wet_m * 0.5) * duck_m + (sfx + wet_s * 0.2) * duck_s
bed = np.stack([filt(bed[c], 'highpass', 30) for c in range(2)])
bed /= np.percentile(np.abs(bed), 99.9) * 1.25
vwet = fftconvolve(voice, ir[0] * 0.5)[:N]
mixd = bed * 0.62 + (voice + vwet * 0.06)[None, :] * 0.95
tt = np.arange(N) / SR
mixd *= np.clip((DUR - 0.4 - tt) / 1.6, 0, 1)[None, :]
mixd /= np.abs(mixd).max() * 1.08
mixd = np.tanh(mixd * 1.2) / np.tanh(1.2) * 0.92
pcm = (mixd.T * 32767).astype(np.int16)
with wave.open('audio_vo.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape)
'''
exec(head + score + mix, {})
