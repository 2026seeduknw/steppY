"""iOS 시작 화면(LaunchScreen) 이미지를 만든다 — 가운데에 SB 어그로 steppY 한 줄.

시작 화면 스토리보드에서는 커스텀 글꼴을 믿을 수 없어서(앱 글꼴이 아직 안
올라온 시점이다) 글자를 그림으로 구워 넣는다. 모양은 랜딩 히어로의 steppY
(.wm-text)와 맞춘다:
  - 채움 --key-500, 테두리 --key-ink 0.028em (paint-order: stroke fill → 바깥 절반만 보임)
  - font-weight 700 은 글꼴에 굵은 꼴이 없어 브라우저가 흉내 낸 굵기다 → 같은 색 테두리로 흉내
  - t·e 사이를 0.065em 당긴다(.wm-kern-te)

    python3 tools/make-launch-splash.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "assets/fonts/SBAggroLight.otf"
OUT_DIR = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"
NAMES = ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]

SIZE = 2732
BG = "#F3F6F9"          # capacitor.config.json 의 backgroundColor 와 같다
FILL = "#23354D"        # --key-500 (Storm)
INK = "#1E2A3A"         # --key-ink
TARGET_W = 820          # 휴대폰에서 화면 폭의 2/3 남짓 (2732 정사각형이 화면 높이에 맞춰 잘린다)

FAUX_BOLD = 0.02        # em
STROKE = 0.028          # em
KERN_TE = -0.065        # em

TEXT = "steppY"


def layout(font, fs):
    """글자별 x 위치와 전체 폭. t 다음 글자만 당긴다."""
    xs, x = [], 0.0
    for i, ch in enumerate(TEXT):
        xs.append(x)
        x += font.getlength(ch)
        if ch == "t":
            x += KERN_TE * fs
    return xs, x


def render():
    # 폭이 TARGET_W 가 되도록 글자 크기를 정한다
    fs = 400
    font = ImageFont.truetype(str(FONT), fs)
    _, w = layout(font, fs)
    fs = round(fs * TARGET_W / w)
    font = ImageFont.truetype(str(FONT), fs)
    xs, w = layout(font, fs)

    img = Image.new("RGB", (SIZE, SIZE), BG)
    d = ImageDraw.Draw(img)
    asc, desc = font.getmetrics()
    # 획이 실제로 차지하는 세로 범위로 가운데를 맞춘다
    bbox = font.getbbox(TEXT)
    x0 = (SIZE - w) / 2
    y0 = (SIZE - (bbox[3] + bbox[1])) / 2

    bold = max(1, round(FAUX_BOLD * fs))
    outer = bold + max(1, round(STROKE / 2 * fs))
    for ch, x in zip(TEXT, xs):                      # 1) 네이비 바깥 테두리
        d.text((x0 + x, y0), ch, font=font, fill=INK, stroke_width=outer, stroke_fill=INK)
    for ch, x in zip(TEXT, xs):                      # 2) 채움(흉내 낸 굵기 포함)
        d.text((x0 + x, y0), ch, font=font, fill=FILL, stroke_width=bold, stroke_fill=FILL)
    return img


if __name__ == "__main__":
    img = render()
    for n in NAMES:
        img.save(OUT_DIR / n, optimize=True)
        print("wrote", OUT_DIR / n)
