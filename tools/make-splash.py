#!/usr/bin/env python3
"""인트로 스플래시 데이터를 만든다.

무엇을 만드나
  1) assets/splash-letters.svg — s t e p p Y ! 낱글자 심볼 묶음
  2) js/splash-data.js         — 글자마다 "흩어진 자리"와 "히어로 자리" 두 벌의 좌표

어떻게 재나
  흩어진 배치(tools/splash-layout.png)는 손으로 만든 이미지다. 각 글자의 회전
  각도는 눈대중하지 않고, 똑바로 선 글자를 1도씩 돌려 가며 겹치는 넓이가 가장
  큰 각을 찾아서 잡았다(일치율 0.89~0.96).

  히어로 자리는 tools/wordmark.py 의 아틀라스로 "steppY" 를 조판했을 때 각
  글자가 놓이는 x 좌표 그대로다. 그래서 애니메이션이 끝나면 글자가 실제
  워드마크와 정확히 겹친다.

  좌표는 전부 0~1 로 정규화해서 넘긴다 — 화면 크기와 무관하게 쓰려고.

사용
  python3 tools/make-splash.py
"""
import json, pathlib, re
import numpy as np
from PIL import Image

HERE   = pathlib.Path(__file__).parent
ATLAS  = json.loads((HERE / 'wordmark-glyphs.json').read_text())
WORD   = 'steppY!'
HERO   = 'steppY'          # 끝나고 합쳐질 단어(느낌표는 사라진다)
CAP, ASCENT, DESCENT = ATLAS['cap'], 1000.0, 300.0


def ink_of(p):
    a = np.array(Image.open(p).convert('RGBA'))
    rgb, al = a[..., :3].astype(int), a[..., 3]
    return (al > 80) & ~((rgb[..., 0] > 230) & (rgb[..., 1] > 230) & (rgb[..., 2] > 230))


def split_cols(band, gap=6):
    out, s, run = [], None, 0
    for x, v in enumerate(band.any(axis=0)):
        if v:
            if s is None:
                s = x
            run = 0
        elif s is not None:
            run += 1
            if run >= gap:
                out.append((s, x - run + 1)); s, run = None, 0
    if s is not None:
        out.append((s, band.shape[1]))
    return out


# ── 흩어진 배치 재기 ────────────────────────────────────────────────
lay = ink_of(HERE / 'splash-layout.png')
chunks = split_cols(lay)
assert len(chunks) == len(WORD), f'{len(chunks)}조각 vs {len(WORD)}글자'
ANGLES = json.loads((HERE / 'splash-angles.json').read_text())   # measure 단계 결과

boxes = []
for (x0, x1), ch in zip(chunks, WORD):
    ys = np.where(lay[:, x0:x1].any(axis=1))[0]
    boxes.append({'ch': ch, 'x0': x0, 'x1': x1, 'y0': int(ys.min()), 'y1': int(ys.max())})

LX0 = min(b['x0'] for b in boxes); LX1 = max(b['x1'] for b in boxes)
LY0 = min(b['y0'] for b in boxes); LY1 = max(b['y1'] for b in boxes)
LW, LH = LX1 - LX0, LY1 - LY0

# ── 히어로 자리 (아틀라스로 조판했을 때의 x) ─────────────────────────
G, gap = ATLAS['glyphs'], ATLAS['gap']
pad = CAP * 0.04
hx, hero_pos = pad, {}
for i, ch in enumerate(HERO):
    if i:
        hx += gap
    g = G[ch]
    hero_pos[i] = {'x': hx, 'w': g['w'], 'top': ASCENT + g['top'], 'ih': g['ih']}
    hx += g['w']
HERO_W, HERO_H = hx + pad, ASCENT + DESCENT

# ── 낱글자 심볼 ──────────────────────────────────────────────────────
syms, data = [], []
for i, b in enumerate(boxes):
    g = G[b['ch']]
    w, h = g['w'], g['ih']
    syms.append(
        f'  <symbol id="sp-{i}" viewBox="0 0 {w:.2f} {h:.2f}">'
        f'<g fill="currentColor"><g transform="translate(0,{h:.2f}) scale(0.1,-0.1)">'
        f'<path d="{g["d"]}"/></g></g></symbol>')
    hp = hero_pos.get(i)
    data.append({
        'ch': b['ch'],
        'angle': ANGLES[i]['angle'],
        # 흩어진 자리 — 배치 이미지 상자 기준 0~1
        'sx': round((b['x0'] - LX0) / LW, 4),
        'sy': round((b['y0'] - LY0) / LH, 4),
        'sw': round((b['x1'] - b['x0']) / LW, 4),
        # 히어로 자리 — 워드마크 상자 기준 0~1 (느낌표는 null → 사라진다)
        'hx': round(hp['x'] / HERO_W, 4) if hp else None,
        'hy': round(hp['top'] / HERO_H, 4) if hp else None,
        'hw': round(hp['w'] / HERO_W, 4) if hp else None,
        'hh': round(hp['ih'] / HERO_H, 4) if hp else None,
    })

(HERE.parent / 'assets' / 'splash-letters.svg').write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">\n' + '\n'.join(syms) + '\n</svg>\n')

(HERE.parent / 'js' / 'splash-data.js').write_text(
    '/* tools/make-splash.py 가 만든 파일 — 직접 고치지 말 것.\n'
    '   sx/sy/sw = 흩어진 배치에서의 자리(배치 상자 기준 0~1)\n'
    '   hx/hy/hw/hh = 히어로 워드마크에서의 자리(워드마크 상자 기준 0~1)\n'
    '   angle = 흩어진 배치에서의 기울기(CSS rotate 기준, 도) */\n'
    f'const SPLASH_LETTERS = {json.dumps(data, ensure_ascii=False)};\n'
    f'const SPLASH_LAYOUT_RATIO = {round(LW / LH, 4)};   // 흩어진 배치 가로세로비\n')

print(f'낱글자 {len(syms)}개 · 배치비 {LW/LH:.3f} · 히어로 {HERO_W:.0f}x{HERO_H:.0f}')
for d in data:
    print(f"  {d['ch']}  {d['angle']:+5.1f}°  흩어짐({d['sx']:.2f},{d['sy']:.2f})  "
          f"히어로({d['hx']},{d['hy']})")
