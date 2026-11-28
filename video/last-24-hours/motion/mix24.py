import json, wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 44100
def rd(p):
    w = wave.open(p); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
    return a.reshape(-1, w.getnchannels()).T
bed = rd('audio24.wav'); N = bed.shape[1]
vo = rd('vo3/vo44.wav')[0]
voice = np.zeros(N)
for a, b, o in json.load(open('vo3/place.json')):
    a2, b2 = max(0, a - .06), min(len(vo) / SR, b + .18)
    seg = vo[int(a2 * SR):int(b2 * SR)].copy(); n = len(seg); e = np.ones(n); f = int(.02 * SR); e[:f] = np.linspace(0, 1, f); e[-int(.08 * SR):] *= np.linspace(1, 0, int(.08 * SR))
    i = int((o - (a - a2)) * SR); voice[i:i + n] += (seg * e)[:N - i]
voice = sosfilt(butter(2, 70, 'highpass', fs=SR, output='sos'), voice)
voice /= np.abs(voice).max()
r = np.random.default_rng(3); t = np.arange(int(1.4 * SR)) / SR; ir = r.standard_normal(len(t)) * np.exp(-t * 4); ir /= np.abs(ir).sum() ** .5 * 25
voice = voice + fftconvolve(voice, ir)[:N] * .5
env = np.convolve(np.abs(voice), np.ones(int(.05 * SR)) / int(.05 * SR), mode='same')
act = np.convolve((env > .02).astype(float), np.ones(int(.45 * SR)) / int(.45 * SR), mode='same').clip(0, 1)
duck = 1 - 0.65 * act
mix = bed * 0.86 * duck[None, :] + voice[None, :] * 0.72
tt = np.arange(N) / SR
mix[:, (tt >= 524.0) & (tt < 527.0)] = 0.0
pk = np.abs(mix).max(); mix = mix / pk * 0.89
pcm = (mix.T * 32767).astype(np.int16)
with wave.open('audio24_vo.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
