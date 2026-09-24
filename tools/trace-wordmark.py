#!/usr/bin/env python3
"""로고 시트 이미지에서 워드마크를 누끼 떠 SVG 패스로 만든다.

왜 이렇게 하냐
  워드마크에 쓰는 글씨체가 앱 번들에 없다(앱에는 Pretendard 하나만 들어간다).
  폰트 파일을 새로 넣으면 용량이 늘고 라이선스도 따져야 한다. 로고는 글자가
  몇 개뿐이라, 글자 모양만 패스로 박아 두면 폰트가 아예 필요 없다.
  어느 기기·브라우저에서도 같은 모양이고, 폰트 로딩 지연도 없다.

준비
  brew install potrace

사용
  python3 tools/trace-wordmark.py                         # 기본 시트 2번 줄 → steppy
  python3 tools/trace-wordmark.py --row 3                 # 같은 시트 3번 줄(손글씨)
  python3 tools/trace-wordmark.py --src tools/step.png --name step --row 1

  --name 은 결과 파일 이름이 된다: assets/wordmark-<name>.svg
  한 이미지에 여러 줄이 있으면 --row 로 고른다(위에서부터 1, 2, 3...).
  줄을 모르겠으면 --list 로 먼저 몇 줄이 잡히는지 본다.
"""
import argparse, subprocess, re, pathlib
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).parent
ap = argparse.ArgumentParser()
ap.add_argument('--src',  default=str(HERE / 'wordmark-source.png'))
ap.add_argument('--name',  default='steppy')
ap.add_argument('--label', default=None, help='화면 낭독용 실제 문구(기본: --name)')
ap.add_argument('--row',  type=int, default=2)
ap.add_argument('--list', action='store_true', help='줄만 세어 보고 끝낸다')
args = ap.parse_args()
LABEL = args.label or args.name

SRC  = pathlib.Path(args.src)
OUT  = HERE.parent / 'assets' / f'wordmark-{args.name}.svg'
ROW  = args.row
PAD  = 8
TMP  = pathlib.Path('/tmp/steppy-wordmark.pbm')

a = np.array(Image.open(SRC).convert('RGBA'))
rgb, alpha = a[..., :3].astype(int), a[..., 3]
# 시안 글자만 남긴다 — 흰 배경과 투명 영역을 뺀다
ink = (alpha > 80) & ~((rgb[..., 0] > 230) & (rgb[..., 1] > 230) & (rgb[..., 2] > 230))

# 잉크가 이어지는 y 구간 = 한 줄
runs, start = [], None
for y, has in enumerate(ink.any(axis=1)):
    if has and start is None:
        start = y
    elif not has and start is not None:
        if y - start > 8:
            runs.append((start, y))
        start = None
if start is not None:
    runs.append((start, ink.shape[0]))
if args.list:
    for i, (a, b) in enumerate(runs, 1):
        print(f'{i}번 줄: y {a}-{b} (높이 {b - a})')
    raise SystemExit(0)
if not 1 <= ROW <= len(runs):
    raise SystemExit(f'{ROW}번 줄이 없다 — 이 이미지에는 {len(runs)}줄이 있다')

y0, y1 = runs[ROW - 1]
band = ink[max(0, y0 - PAD): y1 + PAD]
xs = np.where(band.any(axis=0))[0]
band = band[:, max(0, xs.min() - PAD): xs.max() + PAD]

# potrace 는 글자가 검정(0), 배경이 흰색(255)인 비트맵을 먹는다
Image.fromarray(np.where(band, 0, 255).astype('uint8'), 'L').save(TMP)
subprocess.run(['potrace', '-s', '-o', '/tmp/steppy-wordmark.svg',
                '--turdsize', '4', '--alphamax', '1.0', '--opttolerance', '0.2',
                str(TMP)], check=True)

traced = pathlib.Path('/tmp/steppy-wordmark.svg').read_text()
w = float(re.search(r'width="([\d.]+)pt"', traced).group(1))
h = float(re.search(r'height="([\d.]+)pt"', traced).group(1))
d = ' '.join(p.replace('\n', ' ') for p in re.findall(r'<path d="(.*?)"', traced, re.S))

# fill 을 currentColor 로 두면 쓰는 쪽에서 CSS 로 색을 정할 수 있다
OUT.write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
    f'role="img" aria-label="{LABEL}">\n  <title>{LABEL}</title>\n'
    f'  <!-- tools/trace-wordmark.py 로 {SRC.name} 의 {ROW}번 줄을 누끼 뜬 것.\n'
    f'       폰트 없이도 어느 기기에서든 같은 모양으로 나온다. -->\n'
    f'  <g transform="translate(0,{h:.0f}) scale(0.1,-0.1)" fill="currentColor">\n'
    f'    <path d="{d}"/>\n  </g>\n</svg>\n'
)
print(f'{OUT} — {ROW}번 줄, viewBox 0 0 {w:.0f} {h:.0f}, {OUT.stat().st_size}B')
