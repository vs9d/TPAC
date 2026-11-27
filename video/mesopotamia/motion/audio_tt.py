"""Soundtrack for the 71.5 s TikTok cut — reuses the instruments from audio.py."""
src = open('audio.py').read()
head = src.split('# ===================== SCORE =====================')[0].replace('DUR = 190.0', 'DUR = 71.5')
mix = src.split('# ---------- mix ----------')[1].replace("'audio.wav'", "'audio_tt.wav'")
score = r'''
# hook: fan + generator dying (compressed)
t = T(1.6)
fan_f = 110 * np.clip(1 - t / 1.4, 0, 1) ** 1.3 + 0.01
add(sfx, 0, np.sin(2 * np.pi * np.cumsum(fan_f) / SR) * 0.3 + amb(1.6, 300, 1500, 0.9, 0) * np.clip(1 - t / 1.4, 0, 1) * 0.4, 0.6)
gen = sum(np.sin(2 * np.pi * 25 * k * t) / k for k in range(1, 8)) * (np.sin(2 * np.pi * 7 * t) > -0.2) * np.clip(1 - (t - 0.9) / 0.3, 0, 1)
add(sfx, 0, filt(gen, 'lowpass', 400), 0.4)
add(sfx, 1.5, tick(), 0.6); add(sfx, 1.9, ping(880), 0.5)
t = T(1.6)
hf = 70 + 180 * (t / 1.6) ** 2
add(sfx, 3.1, (np.sin(2 * np.pi * np.cumsum(hf) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(hf) / SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * (6 + t * 10) * t)) * (t / 1.6 + 0.3), 0.4)
add(sfx, 4.6, boom(3.0), 1.0)
add(sfx, 4.6, whoosh(2.8, 200, 3500, 0.8), 1.0, -0.2)
add(sfx, 7.15, thud(), 0.8)
# Ur
add(music, 7.2, choir([deg(0, 0), deg(4, 0), deg(0, 1), deg(2, 1)], 5.0, 0.4, 2.0), 0.8)
add(music, 7.2, dum(1.6), 0.9)
add(music, 7.2, pad(Dm, 23.1, 700, 0.5, 1.0), 0.3)
lyre_ostinato(7.4, 30.3, 100, 0.38)
maqsum(9.6, 30.3, 100, 0.5)
theme(10.6, 100, 'ney', 1, 0.45)
theme(19.0, 100, 'pluck', 2, 0.35, 0.4)
for i in range(12):
    add(sfx, 14.2 + 0.6 + (i * 0.9 + 1) / 5, clink(2400 + (i % 4) * 300), 0.9, 0.3)
for i in range(12):
    add(sfx, 18.8 + 0.5 + i * 0.28, thud(), 0.4, 0.2)
for k in range(76):
    add(sfx, 22.8 + k * 0.0625, tick(), 0.3 if k % 4 == 0 else 0.12)
add(music, 22.8, choir([deg(0, 0), deg(4, 0)], 4.8, 0.6, 1.5), 0.45)
t = T(2.6)
add(sfx, 27.6, (np.sin(2 * np.pi * 110 * t) + 0.5 * np.sin(2 * np.pi * 220 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 10 * t)) * env(len(t), 0.4, 0.2), 0.25)
add(sfx, 30.1, whoosh(2.4, 150, 5000, 0.7), 1.0)
add(sfx, 32.3, boom(2.0), 0.6)
# Hammurabi
add(music, 32.3, pad([deg(0, -1), deg(4, -1), deg(5, -1)], 10, 500, 0.8, 1.0), 0.4)
for k in range(7):
    add(music, 32.4 + k * 1.4, dum(1.1), 0.5 if k % 2 == 0 else 0.3)
lyre_ostinato(32.4, 38.4, 84, 0.3, 0, (0, 4, 5, 4, 0, 4, 1, 0), -0.2)
add(sfx, 35.4, thud(), 0.6)
add(music, 38.5, choir([deg(0, -1), deg(4, -1), deg(0, 0)], 3.8, 0.8, 1.0), 0.6)
theme(38.6, 90, 'pluck', 0, 0.45, 0.2)
# jump 2 + riser
add(sfx, 41.9, whoosh(2.4, 100, 6000, 0.8), 1.0)
for k in range(16):
    add(music, 42.1 + k * 0.125, tek() if k % 2 else dum(0.5 + k / 20), 0.15 + k / 30)
# Gate
add(sfx, 44.1, boom(5.0), 1.0)
add(music, 44.1, dum(2.0), 1.0)
add(music, 44.1, choir([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0), deg(4, 0)], 11, 0.6, 2.5), 1.0)
add(music, 44.1, pad([deg(0, -2), deg(0, -1)], 11, 400, 0.4, 2.5), 0.6)
maqsum(45.3, 55.1, 100, 0.6, True)
lyre_ostinato(45.3, 55.1, 100, 0.35, 1)
theme(48.1, 70, 'ney', 1, 0.45, -0.1)
add(sfx, 44.4, amb(10.5, 400, 2500, 0.5, 0.5), 0.12)
# night
add(music, 55.1, pad([deg(0, -1), deg(4, -1)], 3.8, 400, 0.6, 1.0), 0.35)
add(sfx, 55.1, amb(3.6, 4200, 6000, 0.95, 10), 0.04)
add(music, 55.3, pluck(deg(4, 1), 3), 0.5)
add(music, 57.1, pluck(deg(0, 1), 3), 0.5)
add(sfx, 58.1, whoosh(1.4, 6000, 200, 0.7), 0.7)
# home
for k in range(4):
    add(sfx, 58.9 + k * 0.3, ping(1320 if k % 2 else 1760), 0.5, -0.4)
add(music, 58.7, pad(Dm, 8.0, 700, 1.0, 1.0), 0.3)
theme(59.0, 72, 'pluck', 1, 0.5)
add(music, 61.9, choir([deg(0, 0), deg(4, 0)], 4.6, 1.5, 1.0), 0.35)
# finale
add(sfx, 66.5, boom(5.0), 0.8)
add(music, 66.5, dum(1.8), 0.8)
add(music, 66.5, choir([deg(0, -1), deg(4, -1), deg(0, 0), deg(2, 0), deg(4, 0), deg(0, 1)], 5.0, 0.5, 2.5), 1.0)
add(music, 66.5, pad([deg(0, -2), deg(0, -1), deg(4, -1)], 5.0, 600, 0.5, 2.5), 0.6)
theme(66.6, 96, 'pluck', 1, 0.6)
'''
ns = {}
exec(head + score + mix, ns)
