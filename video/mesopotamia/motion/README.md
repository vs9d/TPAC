# Motion video source

Renders the 3:10 motion-graphics version of the film (1920×1080, 30 fps).

```bash
npm i @fontsource/cairo @fontsource/reem-kufi playwright   # in this folder
pip install numpy scipy
python3 -m http.server 8765 --bind 127.0.0.1 &               # serve index.html + fonts
node render.js video 0 190 video.mp4                          # frames -> H.264
python3 audio.py                                              # music + SFX -> audio.wav
ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -b:a 192k -shortest final.mp4
```

- `scene.js` — every scene, character and subtitle, drawn on a canvas; `renderFrame(t)` is deterministic.
- `audio.py` — soundtrack (lyre, ney, frame drum, choir in D hijaz) and sound effects, timed to the scenes.
- `node render.js stills 12,95,130 out/` renders single preview frames.

## TikTok cut (9:16, 1080×1920, 71.5 s)

```bash
node render_tt.js video 0 71.5 tt.mp4      # uses tiktok.html + tiktok.js (clip list, headline, vertical subtitles)
python3 audio_tt.py                         # -> audio_tt.wav (same instruments, re-scored for the cut)
ffmpeg -i tt.mp4 -i audio_tt.wav -c:v copy -c:a aac -b:a 192k -shortest tiktok.mp4
```
