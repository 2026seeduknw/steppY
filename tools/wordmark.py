#!/usr/bin/env python3
"""로고 글씨체로 아무 단어나 SVG 워드마크로 만든다.

왜 이게 필요하냐
  워드마크에 쓰는 글씨체가 앱 번들에 없다(번들 폰트는 Pretendard 하나뿐).
  폰트 파일을 넣으면 용량·라이선스가 걸리고, 라이브 텍스트로 두면 폰트가
  늦게 오거나 못 오면 다른 글꼴로 보인다. 그래서 글자 모양만 패스로 박는다.

  처음에는 단어 하나를 통째로 누끼 떴는데, 문구가 바뀔 때마다 그 단어를
  다시 찍어서 받아야 했다. 지금은 **알파벳 시트에서 글자를 낱개로 떠 두고**
  (아틀라스), 필요한 단어는 그 글자들을 붙여서 만든다.

준비
  brew install potrace

사용
  python3 tools/wordmark.py --build              # 아틀라스 새로 만들기(한 번)
  python3 tools/wordmark.py STEP                 # assets/wordmark-step.svg
  python3 tools/wordmark.py "Four Steps!" --name four-steps
"""
import argparse, json, pathlib, re, subprocess, sys
import numpy as np
from PIL import Image

HERE   = pathlib.Path(__file__).parent
ASSETS = HERE.parent / 'assets'
ATLAS  = HERE / 'wordmark-glyphs.json'

# 어느 시트의 몇 번째 줄에 어떤 글자가 있는지. 줄 번호는 --list 로 확인한다.
SHEETS = [
    ('alphabet-source.png', {3: 'ABCDEFGHI', 4: 'JKLMNOPQR', 5: 'STUVWXYZ'}),
    ('alphabet-lower.png',  {1: 'abcdefghij', 2: 'klmnopqrst', 3: 'uvwxyz'}),
    ('alphabet-source.png', {6: 'Four Steps!'}),   # 느낌표 + 자간 보정용
]
# 자간은 견본(A B C D…)이 아니라 **실제로 조판된 단어**에서만 잰다.
# 견본은 글자를 띄워 늘어놓은 거라 그 간격을 쓰면 단어가 흩어진다.
KERN_ROWS = {('alphabet-source.png', 6)}
CAP = 700.0          # 정규화 기준 — 대문자 높이를 700 단위로 맞춘다
# 어센더도 디센더도 없는 소문자 — 줄의 x 높이를 재는 데 쓴다
X_HEIGHT_LETTERS = set('acemnorsuvwxz')
# 모든 워드마크가 공유하는 세로 자 — 베이스라인 위/아래로 얼마를 비워 둘지.
# 이 글씨체에서 가장 높은 글자(t, f, 대문자)와 가장 낮은 글자(p, g, y) 기준.
ASCENT, DESCENT = 1000.0, 300.0
# 이 글씨체의 x높이 : 대문자높이. 둘 다 들어 있는 "Four Steps!" 줄에서 잰다.
X_OVER_CAP = None
COL_GAP = 6          # 글자 사이로 인정할 최소 빈 칸(px)


def ink_of(path):
    a = np.array(Image.open(path).convert('RGBA'))
    rgb, alpha = a[..., :3].astype(int), a[..., 3]
    # 시안 글자만 — 흰 배경과 투명 영역을 뺀다
    return (alpha > 80) & ~((rgb[..., 0] > 230) & (rgb[..., 1] > 230) & (rgb[..., 2] > 230))


def split_rows(ink, min_h=8):
    out, start = [], None
    for y, has in enumerate(ink.any(axis=1)):
        if has and start is None:
            start = y
        elif not has and start is not None:
            if y - start > min_h:
                out.append((start, y))
            start = None
    if start is not None:
        out.append((start, ink.shape[0]))
    return out


def split_cols(band, gap=COL_GAP):
    out, start, run = [], None, 0
    present = band.any(axis=0)
    for x, has in enumerate(present):
        if has:
            if start is None:
                start = x
            run = 0
        elif start is not None:
            run += 1
            if run >= gap:
                out.append((start, x - run + 1))
                start, run = None, 0
    if start is not None:
        out.append((start, len(present)))
    return out


def trace(mask):
    """비트맵 한 조각 → potrace 패스. 좌표는 mask 픽셀 단위(y 아래가 +)."""
    pbm = pathlib.Path('/tmp/steppy-glyph.pbm')
    Image.fromarray(np.where(mask, 0, 255).astype('uint8'), 'L').save(pbm)
    subprocess.run(['potrace', '-s', '-o', '/tmp/steppy-glyph.svg', '--turdsize', '2',
                    '--alphamax', '1.0', '--opttolerance', '0.2', str(pbm)], check=True)
    svg = pathlib.Path('/tmp/steppy-glyph.svg').read_text()
    h = float(re.search(r'height="([\d.]+)pt"', svg).group(1))
    d = ' '.join(p.replace('\n', ' ') for p in re.findall(r'<path d="(.*?)"', svg, re.S))
    # potrace 는 translate(0,h) scale(.1,-.1) 안에 그린다. 그 변환을 미리 적용해
    # 평범한 "왼쪽 위가 원점, 아래가 +y" 좌표로 바꿔 둔다.
    return d, h


def measure_x_over_cap():
    """대문자와 소문자가 함께 있는 줄에서 x높이 / 대문자높이 를 잰다."""
    fname, row_no, letters = 'alphabet-source.png', 6, 'FourSteps!'
    ink = ink_of(HERE / fname)
    y0, y1 = split_rows(ink)[row_no - 1]
    band = ink[y0:y1]
    chunks = split_cols(band)
    bottoms = [np.where(band[:, a:b].any(axis=1))[0].max() for a, b in chunks]
    baseline = float(np.median(bottoms))
    caps, xs_ = [], []
    for (a, b), ch in zip(chunks, letters):
        h = baseline - np.where(band[:, a:b].any(axis=1))[0].min()
        (caps if ch.isupper() else xs_ if ch in X_HEIGHT_LETTERS else []).append(h)
    return float(np.median(xs_)) / float(np.median(caps))


def build():
    global X_OVER_CAP
    X_OVER_CAP = measure_x_over_cap()
    print(f'x높이 / 대문자높이 = {X_OVER_CAP:.3f}')
    glyphs, gaps = {}, []
    for fname, rowmap in SHEETS:
        ink = ink_of(HERE / fname)
        rows = split_rows(ink)
        for row_no, letters in rowmap.items():
            y0, y1 = rows[row_no - 1]
            band = ink[y0:y1]
            chunks = split_cols(band)
            letters_only = letters.replace(' ', '')
            if len(chunks) != len(letters_only):
                sys.exit(f'{fname} {row_no}번 줄: 덩어리 {len(chunks)}개 vs 글자 {len(letters_only)}개 — SHEETS 표를 확인하라')

            # 베이스라인 = 글자 밑변의 중앙값. 디센더(g j p q y)와 Q 꼬리가 섞여
            # 있어도 중앙값은 베이스라인에 남는다.
            bottoms = []
            for x0, x1 in chunks:
                ys = np.where(band[:, x0:x1].any(axis=1))[0]
                bottoms.append(ys.max())
            baseline = float(np.median(bottoms))

            # 줄마다 배율이 다를 수 있으니(시트를 따로 찍었다) 각 줄에서 자를 잰다.
            # 대문자가 있으면 대문자 높이로, 소문자뿐인 줄은 x 높이로 재고
            # 두 사이의 비율(X_OVER_CAP)로 환산한다. 예전에는 소문자 줄에서
            # 자를 못 재 100px 로 넘겨짚었고, 그래서 대문자만 작게 나왔다.
            def heights(pred):
                out = []
                for (a_, b_), ch in zip(chunks, letters_only):
                    if pred(ch):
                        ys = np.where(band[:, a_:b_].any(axis=1))[0]
                        out.append(baseline - ys.min())
                return out

            caps = heights(str.isupper)
            xs_  = heights(lambda c: c in X_HEIGHT_LETTERS)
            if caps:
                cap_px = float(np.median(caps))
            elif xs_:
                cap_px = float(np.median(xs_)) / X_OVER_CAP
            else:
                sys.exit(f'{fname} {row_no}번 줄: 배율을 잴 글자가 없다')
            k = CAP / cap_px          # 픽셀 → 정규화 단위

            prev_x1 = None
            for (x0, x1), ch in zip(chunks, letters_only):
                sub = band[:, x0:x1]
                ys = np.where(sub.any(axis=1))[0]
                piece = sub[ys.min():ys.max() + 1]
                # **여기서 미리 키운다.** 줄마다 배율(k)이 다른 채로 트레이스하면
                # 글자마다 <g scale> 값이 달라지고, 그러면 stroke-width 가 글자마다
                # 다른 두께로 먹어서 테두리가 들쭉날쭉해진다(어떤 글자는 아예 안 보인다).
                # 비트맵 단계에서 k 를 적용해 두면 모든 글자가 같은 자를 쓴다.
                img = Image.fromarray((piece * 255).astype('uint8'), 'L')
                img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))),
                                 Image.LANCZOS)
                d, h = trace(np.array(img) > 127)
                if ch not in glyphs:
                    glyphs[ch] = {
                        'd': d,
                        'w': round((x1 - x0) * k, 2),                 # 잉크 폭
                        'top': round((ys.min() - baseline) * k, 2),   # 베이스라인 기준(위가 음수)
                        'ih': round(h, 2),                            # 잉크 높이(이미 정규화 단위)
                    }
                if prev_x1 is not None and (fname, row_no) in KERN_ROWS:
                    gaps.append((x0 - prev_x1) * k)
                prev_x1 = x1

    # "Four Steps!" 안의 글자 사이 간격들. 낱말 사이 공백(r 과 S 사이)은
    # 글자 간격보다 훨씬 크므로 중앙값을 쓰면 자연히 빠진다.
    tight = sorted(g for g in gaps if g > 0)
    letter_gap = float(np.median(tight)) if tight else CAP * 0.06
    space_w = max(tight) if tight else CAP * 0.30
    ATLAS.write_text(json.dumps({'cap': CAP, 'gap': round(letter_gap, 2),
                                 'space': round(space_w, 2), 'glyphs': glyphs}))
    print(f'{ATLAS.name} — 글자 {len(glyphs)}개 · 자간 {letter_gap:.0f} · 낱말 사이 {space_w:.0f} (대문자 높이 {CAP:.0f} 기준)')


def compose(word, name, label):
    atlas = json.loads(ATLAS.read_text())
    G, gap, space = atlas['glyphs'], atlas['gap'], atlas['space']
    missing = sorted({c for c in word if c != ' ' and c not in G})
    if missing:
        sys.exit(f'아틀라스에 없는 글자: {" ".join(missing)}')

    # 좌표 규약: viewBox 는 **반드시 0 0 에서 시작**한다.
    # <use> 가 <symbol> 을 불러올 때 심볼 내용을 "현재 사용자 좌표의 원점"에
    # 붙여 놓기 때문에, min-x/min-y 가 0 이 아니면 그만큼 글자가 상자 밖으로
    # 밀려나 아무것도 안 보인다. 그래서 베이스라인을 y=0 이 아니라 y=ASCENT 에 둔다.
    #
    # 세로 상자는 단어마다 다르게 잡지 않는다. 잉크에 딱 맞춰 자르면
    # STEP(디센더 없음)과 step(t 어센더 + p 디센더)의 상자 높이가 달라서,
    # 같은 height 로 놓았을 때 글자 크기가 서로 달라 보인다.
    pad = CAP * 0.04
    x, parts = pad, []
    for i, ch in enumerate(word):
        if ch == ' ':
            x += space
            continue
        if i and word[i - 1] != ' ':
            x += gap
        g = G[ch]
        # 모든 글자가 같은 0.1 배율이다 — 그래서 stroke-width 하나로 통일된다
        parts.append(f'<g transform="translate({x:.2f},{ASCENT + g["top"] + g["ih"]:.2f}) '
                     f'scale(0.1,-0.1)"><path d="{g["d"]}"/></g>')
        x += g['w']

    vb = (0, 0, round(x + pad, 2), round(ASCENT + DESCENT, 2))
    out = ASSETS / f'wordmark-{name}.svg'
    out.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" '
        f'role="img" aria-label="{label}">\n  <title>{label}</title>\n'
        # XML 주석 안에는 하이픈 두 개를 못 넣는다(--name 을 그대로 적으면 파일이 깨진다)
        f'  <!-- tools/wordmark.py 가 알파벳 아틀라스에서 글자를 붙여 만든 것.\n'
        f'       폰트 없이도 어느 기기에서든 같은 모양으로 나온다.\n'
        f'       다시 만들기: python3 tools/wordmark.py "{word}" (name: {name}) -->\n'
        f'  <g fill="currentColor">\n    ' + '\n    '.join(parts) + '\n  </g>\n</svg>\n')
    print(f'{out.name} — "{word}", viewBox {vb}')


ap = argparse.ArgumentParser()
ap.add_argument('word', nargs='?')
ap.add_argument('--build', action='store_true', help='알파벳 시트에서 아틀라스를 새로 만든다')
ap.add_argument('--name', default=None, help='결과 파일 이름 (assets/wordmark-<name>.svg)')
ap.add_argument('--label', default=None, help='스크린리더용 문구 (기본: word)')
a = ap.parse_args()
if a.build:
    build()
elif a.word:
    compose(a.word, a.name or re.sub(r'[^a-z0-9]+', '-', a.word.lower()).strip('-'), a.label or a.word)
else:
    ap.error('단어를 주거나 --build 를 쓴다')
