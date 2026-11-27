"""Synthesized soundtrack + SFX for the Mesopotamia motion film (190 s)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave

SR = 44100
DUR = 190.0
N = int(SR * DUR)
rng = np.random.default_rng(1)
music = np.zeros((2, N))
sfx = np.zeros((2, N))


def T(d):
    return np.arange(int(SR * d)) / SR


def add(bus, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[0, i:i + len(sig)] += sig * l * 1.414
    bus[1, i:i + len(sig)] += sig * r * 1.414


def filt(sig, kind, f):
    sos = butter(2, f, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, sig)


def env(n, a, r, sustain=True):
    e = np.ones(n)
    na = min(int(a * SR), n // 2)
    nr = min(int(r * SR), n - na)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr and nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


# ---------- scale: D hijaz ----------
D3 = 146.83
HIJAZ = [0, 1, 4, 5, 7, 8, 10]  # semitones


def deg(d, octave=0):
    o, k = divmod(d, 7)
    return D3 * 2 ** (octave + o + HIJAZ[k] / 12)


# ---------- instruments ----------
def pluck(f, d=2.2, bright=1.0):
    t = T(d)
    s = np.zeros_like(t)
    for k in range(1, 10):
        if f * k > 9000:
            break
        s += (1 / k ** 1.1) * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (1.6 + k * 1.3 / bright))
    click = rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.3
    return (s + filt(click, 'highpass', 2000)) * env(len(t), 0.002, 0.05) * 0.5


def ney(f, d, vib=5.0):
    t = T(d)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.006 * np.sin(2 * np.pi * vib * t) * np.clip(t * 2, 0, 1))) / SR
    s = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    breath = filt(rng.standard_normal(len(t)), 'bandpass', [f * 0.8, f * 3]) * 0.25
    return (s + breath) * env(len(t), 0.12, 0.25) * 0.35


def pad(freqs, d, cutoff=900, a=1.5, r=1.5):
    t = T(d)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0, 0.005):
            s += 2 * ((f * (1 + det) * t + rng.random()) % 1) - 1
    s = filt(s, 'lowpass', cutoff) / (len(freqs) * 3)
    return s * env(len(t), a, r)


def choir(freqs, d, a=1.2, r=2.0):
    t = T(d)
    s = np.zeros_like(t)
    formants = [(700, 1.0), (1220, 0.5), (2600, 0.25)]
    for f in freqs:
        for v in range(3):
            fv = f * (1 + (v - 1) * 0.004)
            ph = 2 * np.pi * np.cumsum(fv * (1 + 0.005 * np.sin(2 * np.pi * (5 + v * 0.3) * t + v))) / SR
            for k in range(1, 16):
                hk = fv * k
                if hk > 5000:
                    break
                w = sum(g * np.exp(-((hk - fc) / 260) ** 2) for fc, g in formants) + 0.15 / k
                s += w * np.sin(k * ph)
    s /= max(1, len(freqs) * 3)
    return s * env(len(t), a, r) * 0.6


def dum(big=1.0):
    t = T(0.6)
    f = 55 + 70 * np.exp(-t * 25)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * big
    s += filt(rng.standard_normal(len(t)), 'bandpass', [150, 1500]) * np.exp(-t * 40) * 0.4
    return s * 0.8


def tek():
    t = T(0.12)
    return filt(rng.standard_normal(len(t)), 'bandpass', [1800, 6000]) * np.exp(-t * 60) * 0.5


def boom(d=3.0):
    t = T(d)
    s = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t * 4)) / SR) * np.exp(-t * 1.6)
    s += filt(rng.standard_normal(len(t)), 'lowpass', 300) * np.exp(-t * 3) * 0.8
    return s


def whoosh(d, f0, f1, q=0.6):
    n = int(d * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    hop, win = 1024, np.hanning(2048)
    for i in range(0, n - 2048, hop):
        k = i / n
        fc = f0 * (f1 / f0) ** k
        seg = filt(noise[i:i + 2048], 'bandpass', [max(40, fc * (1 - q / 2)), min(18000, fc * (1 + q / 2))])
        out[i:i + 2048] += seg * win
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return out * e * 0.6


def clink(f=2600):
    t = T(0.5)
    s = sum(np.sin(2 * np.pi * f * m * t) * np.exp(-t * (14 + m * 6)) for m in (1, 1.47, 2.09, 2.76))
    return s * 0.18


def tick():
    t = T(0.03)
    return filt(rng.standard_normal(len(t)), 'highpass', 3000) * np.exp(-t * 300) * 0.5


def thud():
    t = T(0.15)
    return np.sin(2 * np.pi * 120 * t) * np.exp(-t * 40) * 0.6 + filt(rng.standard_normal(len(t)), 'bandpass', [300, 2500]) * np.exp(-t * 80) * 0.3


def amb(d, lo, hi, depth=0.4, rate=0.3):
    t = T(d)
    s = filt(rng.standard_normal(len(t)), 'bandpass', [lo, hi])
    return s * (1 - depth + depth * np.sin(2 * np.pi * rate * t + rng.random() * 6)) * env(len(t), 0.8, 0.8)


def ping(f=1320):
    t = T(0.35)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 12) * 0.25


# ---------- patterns ----------
def lyre_ostinato(start, end, bpm, gain=0.5, octave=1, pattern=(0, 4, 7, 4, 2, 4, 7, 4), pan=-0.3):
    step = 60 / bpm / 2
    t, i = start, 0
    while t < end - 0.2:
        add(music, t, pluck(deg(pattern[i % len(pattern)], octave), 1.6), gain * (1 if i % 8 == 0 else 0.7), pan)
        t += step
        i += 1


def maqsum(start, end, bpm, gain=0.6, heavy=False):
    step = 60 / bpm / 2
    t, i = start, 0
    while t < end - 0.1:
        p = i % 8
        if p in (0, 4):
            add(music, t, dum(1.3 if heavy else 1), gain, 0)
        elif p in (1, 3, 6):
            add(music, t, tek(), gain * 0.6, 0.25)
        elif heavy and p == 7:
            add(music, t, tek(), gain * 0.4, -0.25)
        t += step
        i += 1


THEME = [(0, 1), (1, .5), (2, .5), (3, 1), (4, 1.5), (3, .5), (2, .5), (1, .5), (0, 2)]


def theme(start, bpm, inst='pluck', octave=1, gain=0.6, pan=0.2):
    beat = 60 / bpm
    t = start
    for d, b in THEME:
        f = deg(d, octave)
        sig = pluck(f, max(1.2, b * beat + 0.8)) if inst == 'pluck' else ney(f, b * beat + 0.15)
        add(music, t, sig, gain, pan)
        t += b * beat
    return t


Dm = [deg(0, -1), deg(4, -1), deg(0, 0)]

# ===================== SCORE =====================
# Hook: fan + generator dying
t = T(2.8)
fan_f = 110 * np.clip(1 - t / 2.6, 0, 1) ** 1.3 + 0.01
fan = np.sin(2 * np.pi * np.cumsum(fan_f) / SR) * 0.3
blade = amb(2.8, 300, 1500, 0.9, 0) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(fan_f / 4) / SR)) * np.clip(1 - t / 2.6, 0, 1)
add(sfx, 0, fan + blade * 0.8, 0.5)
t = T(1.6)
gen = sum(np.sin(2 * np.pi * 25 * k * t) / k for k in range(1, 8))
stutter = (np.sin(2 * np.pi * 6 * t) > -0.2).astype(float)
gen *= stutter * np.clip(1 - (t - 1.0) / 0.4, 0, 1) * np.where(t < 1.0, 1, 1)
add(sfx, 0.1, filt(gen, 'lowpass', 400), 0.35)
add(sfx, 3.05, tick(), 0.6)
# phone low beep
add(sfx, 3.6, ping(880), 0.5)
# seal hum
t = T(3.2)
hf = 70 + 160 * (t / 3.2) ** 2
hum = (np.sin(2 * np.pi * np.cumsum(hf) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(hf) / SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * (4 + t * 6) * t))
add(sfx, 6.0, hum * env(len(t), 0.4, 0.05) * (t / 3.2 + 0.2), 0.35)
# flash + vortex
add(sfx, 9.0, boom(3.5), 0.9)
add(sfx, 9.0, whoosh(4.2, 200, 3000, 0.8), 0.9, -0.2)
add(sfx, 9.3, whoosh(3.5, 3500, 300, 0.5), 0.6, 0.3)
add(sfx, 13.05, thud(), 0.8)
# reveal: pad + ney
add(music, 13.2, pad(Dm, 5.0, 700, 2.0, 1.0), 0.5)
add(music, 13.6, ney(deg(4, 1), 1.6), 0.6)
add(music, 15.2, ney(deg(5, 1), 0.6), 0.6)
add(music, 15.8, ney(deg(4, 1), 1.6), 0.6)
# title swell
add(music, 17.4, choir([deg(0, 0), deg(4, 0), deg(0, 1), deg(2, 1)], 7.0, 1.0, 2.5), 0.9)
add(sfx, 18.1, boom(4.0), 0.9)
add(music, 18.15, dum(1.6), 0.9)
theme(18.3, 72, 'pluck', 1, 0.7)
add(music, 17.4, pad(Dm, 7.0, 1200, 1.0, 2.0), 0.4)
# Ur day
add(music, 24, pad(Dm, 22.5, 600, 2.0, 2.0), 0.28)
lyre_ostinato(24.2, 46, 96, 0.38)
maqsum(28.0, 46, 96, 0.45)
theme(30.0, 96, 'ney', 1, 0.5)
theme(38.0, 96, 'pluck', 2, 0.35, 0.4)
add(sfx, 24, amb(22, 300, 1400, 0.3, 0.2), 0.08)  # street murmur
add(sfx, 26.6, ping(700), 0.0)
# donkey-ish hoof clops
for k in range(24):
    add(sfx, 24.3 + k * 0.45, tick(), 0.15, 0.4)
# silver falling into the pan
for i in range(12):
    tt = 36 + 0.6 + (i * 0.9 + 1) / 5
    add(sfx, tt, clink(2400 + (i % 4) * 300), 0.9, 0.3)
add(sfx, 36.2, thud(), 0.5)
# river
add(sfx, 46, amb(8.2, 200, 900, 0.5, 0.15), 0.25)
add(music, 46, pad(Dm, 8.5, 500, 1.0, 2.0), 0.3)
lyre_ostinato(46, 54, 84, 0.3, 1, (0, 4, 7, 4, 0, 4, 7, 9))
add(sfx, 47.5, amb(4, 900, 2500, 0.8, 4), 0.08)  # laughter-ish flutter
# tablet: stylus presses
add(music, 54, pad([deg(0, -1), deg(4, -1)], 10, 450, 1.5, 1.5), 0.35)
for i, n in enumerate([23, 15, 41, 7]):
    tens, ones = divmod(n, 10)
    total = tens + ones
    for k in range(total):
        tt = 54 + 0.5 + i * 1.6 + 1.5 * k / total
        add(sfx, tt, thud(), 0.45, 0.2)
for k, d in enumerate([0, 4, 3, 2, 0]):
    add(music, 55 + k * 1.8, pluck(deg(d, 1), 2.0), 0.4)
# school + clock
lyre_ostinato(64, 68.2, 120, 0.3, 2, (0, 2, 4, 2))
add(sfx, 65.05, filt(rng.standard_normal(int(SR * 0.08)), 'bandpass', [900, 3500]) * np.exp(-T(0.08) * 50), 1.0)
add(sfx, 65.2, amb(1.2, 600, 2500, 0.9, 7), 0.25)  # class laughs
for k in range(48):
    add(sfx, 68.2 + k * 0.0625, tick(), 0.35 if k % 4 == 0 else 0.15)
add(music, 68.2, pad([deg(0, 0), deg(4, 0), deg(2, 1)], 7.8, 900, 0.8, 1.5), 0.35)
for k, d in enumerate([0, 4, 7]):
    add(music, 68.7 + k * 1.2, pluck(deg(d, 1), 2.5), 0.6)
add(music, 72.2, choir([deg(0, 0), deg(4, 0)], 3.8, 0.6, 1.5), 0.5)
# dusk
add(music, 76, pad(Dm, 10, 500, 2.0, 1.5), 0.35)
theme(76.6, 62, 'ney', 1, 0.55, 0)
add(sfx, 76, amb(10, 4000, 6000, 0.95, 9), 0.03)  # crickets
t = T(3)
add(sfx, 83, (np.sin(2 * np.pi * 110 * t) + 0.5 * np.sin(2 * np.pi * 220 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 10 * t)) * env(len(t), 0.5, 0.2), 0.25)
# jump 1
add(sfx, 85.8, whoosh(4.4, 150, 5000, 0.7), 1.0)
add(sfx, 89.9, boom(2.5), 0.7)
# Hammurabi
add(music, 90, pad([deg(0, -1), deg(4, -1), deg(5, -1)], 24, 500, 1.5, 2.0), 0.35)
for k in range(int(24 / 1.5)):
    add(music, 90.2 + k * 1.5, dum(1.1), 0.45 if k % 2 == 0 else 0.25)
lyre_ostinato(93, 104, 80, 0.3, 0, (0, 4, 5, 4, 0, 4, 1, 0), -0.2)
add(sfx, 90, amb(14, 300, 1300, 0.3, 0.25), 0.1)
add(sfx, 96.8, ping(520), 0.25)
add(music, 104, choir([deg(0, -1), deg(4, -1), deg(0, 0)], 10, 1.5, 2.0), 0.6)
theme(105, 60, 'pluck', 0, 0.45, 0.2)
# tunnel jump 2
add(sfx, 113.8, whoosh(5.4, 100, 6000, 0.8), 1.0)
add(music, 114, pad([deg(0, 0), deg(4, 0), deg(2, 1)], 5.2, 2000, 4.5, 0.3), 0.45)
# lion wall build
add(music, 119, pad([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0)], 5.5, 1200, 0.3, 0.5), 0.45)
for k in range(32):
    tt = 119.1 + k * (4.8 / 32)
    add(music, tt, tek() if k % 2 else dum(0.5 + k / 40), 0.15 + k / 50)
lyre_ostinato(119.1, 124, 110, 0.3, 1)
# GATE
add(sfx, 124.0, boom(5.0), 1.0)
add(music, 124.0, dum(2.0), 1.0)
add(music, 124.0, choir([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0), deg(4, 0)], 14, 0.8, 3.0), 1.0)
add(music, 124.0, pad([deg(0, -2), deg(0, -1)], 14, 400, 0.5, 3.0), 0.6)
maqsum(126, 138, 100, 0.6, True)
lyre_ostinato(126, 138, 100, 0.35, 1)
theme(128.5, 64, 'ney', 1, 0.45, -0.1)
theme(133.0, 100, 'pluck', 2, 0.45, 0.4)
add(sfx, 124.5, amb(13, 400, 2500, 0.5, 0.5), 0.12)  # cheering crowd
for k in range(10):
    add(sfx, 131 + k * 0.6, amb(0.5, 2500, 5000, 0.9, 14), 0.05)  # ululation shimmer
# daily life
add(sfx, 138, amb(5, 100, 900, 0.7, 3), 0.25)  # kiln roar
for k in range(30):
    add(sfx, 138 + rng.random() * 5, tick(), 0.25 * rng.random())
for k in range(6):
    add(sfx, 138.3 + k * 0.785, thud(), 0.5)  # brick stamping
add(music, 138, pad(Dm, 12.5, 700, 1.0, 1.5), 0.3)
maqsum(143, 150, 112, 0.5)
lyre_ostinato(138.2, 150, 112, 0.35, 1, (0, 2, 4, 5, 4, 2, 4, 7))
theme(143.4, 112, 'ney', 1, 0.45)
add(sfx, 143, amb(7, 300, 1600, 0.3, 0.3), 0.14)
# night
add(music, 150, pad([deg(0, -1), deg(4, -1)], 7.5, 400, 1.5, 1.5), 0.35)
theme(150.4, 58, 'ney', 1, 0.45)
add(sfx, 150, amb(7, 4200, 6000, 0.95, 10), 0.04)
add(music, 153.5, pluck(deg(4, 1), 3), 0.5)
add(music, 155.4, pluck(deg(0, 1), 3), 0.5)
# dissolve
add(sfx, 156.8, whoosh(4.4, 6000, 150, 0.7), 0.9)
for k in range(40):
    add(sfx, 157 + rng.random() * 3.5, filt(rng.standard_normal(int(SR * 0.12)), 'bandpass', [600, 3000]) * np.hanning(int(SR * 0.12)), 0.06, rng.random() * 2 - 1)
add(music, 157, choir([deg(0, 1), deg(4, 1)], 4.2, 1.5, 1.5), 0.35)
# home
t = T(3.0)
ff = 110 * np.clip(t / 2.5, 0, 1)
add(sfx, 161, np.sin(2 * np.pi * np.cumsum(ff) / SR) * 0.3 * np.clip(t, 0, 1), 0.4)
gen = sum(np.sin(2 * np.pi * 25 * k * t) / k for k in range(1, 8)) * np.clip((t - 0.2) * 2, 0, 1)
add(sfx, 161, filt(gen, 'lowpass', 400), 0.25)
for k in range(6):
    add(sfx, 162.4 + k * 0.33, ping(1320 if k % 2 else 1760), 0.6, -0.4)
add(music, 164.2, pad(Dm, 6, 600, 1.5, 1.5), 0.3)
theme(164.3, 70, 'pluck', 1, 0.5)
add(music, 166.5, ney(deg(4, 1), 2.5), 0.35)
# final words
add(music, 170, pad([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0)], 10.2, 800, 2.0, 1.0), 0.35)
lyre_ostinato(170.2, 180, 76, 0.28, 1)
add(music, 175, choir([deg(0, 0), deg(4, 0)], 5.2, 2.0, 1.0), 0.35)
# finale
add(sfx, 180.0, boom(5.0), 0.8)
add(music, 180.0, dum(1.8), 0.8)
add(music, 180.0, choir([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0), deg(4, 0), deg(0, 1)], 10, 1.0, 4.0), 1.0)
add(music, 180.0, pad([deg(0, -2), deg(0, -1), deg(4, -1)], 10, 600, 1.0, 4.0), 0.6)
maqsum(181, 186.5, 84, 0.5, True)
theme(181.0, 80, 'pluck', 1, 0.6)
theme(181.0, 80, 'ney', 2, 0.25)

# ---------- mix ----------
ir_t = T(2.2)
ir = rng.standard_normal((2, len(ir_t))) * np.exp(-ir_t * 3.0)
ir[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
ir /= np.abs(ir).sum(axis=1, keepdims=True) ** 0.5 * 20
wet_m = np.stack([fftconvolve(music[c], ir[c])[:N] for c in range(2)])
wet_s = np.stack([fftconvolve(sfx[c], ir[c])[:N] for c in range(2)])
mix = music * 0.9 + wet_m * 0.5 + sfx + wet_s * 0.2
mix = np.stack([filt(mix[c], 'highpass', 30) for c in range(2)])
tt = np.arange(N) / SR
mix *= np.clip((DUR - 0.6 - tt) / 1.8, 0, 1)[None, :]
mix /= np.percentile(np.abs(mix), 99.9) * 1.25
mix = np.tanh(mix * 1.1) * 0.9
pcm = (mix.T * 32767).astype(np.int16)
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('ok', pcm.shape, float(np.abs(mix).max()))
