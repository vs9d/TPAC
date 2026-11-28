# Motion video source — «آخر 24 ساعة» (10:00, 1080p, 24 fps)

Cinematic silhouette style: rim-lit figures, per-chapter grading, 2.39:1 bars, phone UI, countdown.
Needs `../../mesopotamia/motion/scene.js` (shared utilities) and `../../mesopotamia/motion/audio.py` (synth helpers)
copied next to these files, plus `npm i @fontsource/cairo playwright` and `pip install numpy scipy`.

```bash
python3 -m http.server 8765 --bind 127.0.0.1 &
node render24.js stills 12,150,540 out/        # preview frames
node render24.js video 0 600 video.mp4          # all frames (split into parallel ranges to go faster)
python3 audio24.py                              # -> audio24.wav (score + sound design, 3 s true silence at 8:44)
ffmpeg -i video.mp4 -i audio24.wav -c:v copy -af volume=-1.3dB -c:a aac -b:a 256k -shortest final.mp4
```
Subtitles come from `v24/subs.json` (the narration lines with their times); turn them off with `OPTS24.subs = false`.
