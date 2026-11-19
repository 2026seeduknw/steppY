/**
 * 학교 로고 크기 맞추기 + 안 보이는 로고 처리.
 *
 * 1) 크기 — 로고 파일은 정사각형 문장(紋章)부터 가로로 긴 글자 로고까지 비율이 제각각이다.
 *    같은 칸에 "꽉 차게(contain)" 넣으면 정사각형은 크고 가로로 긴 로고는 실처럼 가늘어져,
 *    같은 줄의 학교들이 크기가 달라 보였다. 그래서 칸 대신 **면적**을 맞춘다 —
 *    비율이 r 이면 너비 = √(면적·r), 높이 = 너비 / r. 칸을 넘으면 칸에 맞춰 줄인다.
 *
 * 2) 흰 로고 — 271곳 중 18곳(모스크바 국립대·Glasgow·York·HKUST…)은 어두운 바탕용 흰 로고라
 *    흰 칸에서 통째로 사라졌다. 불러온 뒤 흰 바탕에 그려 보아 잉크가 거의 없으면
 *    `is-light-logo` 를 붙인다 — 바탕을 짙게 까는 건 CSS(v2.css)가 한다.
 *
 * 3) 파일 없음 — 목록(school-logos.js)에는 있는데 파일이 없는 학교가 있다(국립대만사범대·홍콩대).
 *    그대로 두면 깨진 그림 아이콘이 뜬다 — data-abbr 의 약어 글자로 바꾼다.
 *
 *   fitLogosIn(root, 'img', { maxW: 64, maxH: 42, area: 38 * 38 })            // px
 *   fitLogo(img, { maxW: 100, maxH: 100, area: 78 * 78, unit: '%' })          // 칸 대비 %
 */
function fitLogo(img, opts) {
  const { maxW, maxH, area, unit = 'px' } = opts;
  const apply = () => {
    // 고유 크기가 없는 SVG는 naturalWidth가 0이다 — 정사각형으로 본다
    const r = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 1;
    let w = Math.sqrt(area * r), h = w / r;
    if (w > maxW) { w = maxW; h = w / r; }
    if (h > maxH) { h = maxH; w = h * r; }
    img.style.width = w + unit;
    img.style.height = h + unit;
    img.style.objectFit = 'contain';
    if (isLightLogo(img)) {
      img.classList.add('is-light-logo');
      if (img.parentElement) img.parentElement.classList.add('has-light-logo');
    }
  };
  const fail = () => {
    const span = document.createElement('span');
    span.className = 'logo-fallback';
    span.textContent = img.dataset.abbr || '';
    if (img.parentElement) img.parentElement.classList.add('has-logo-fallback');
    img.replaceWith(span);
  };
  if (img.complete && img.naturalWidth) apply();
  else if (img.complete && !img.naturalWidth && img.src) fail();
  else {
    img.addEventListener('load', apply, { once: true });
    img.addEventListener('error', fail, { once: true });
  }
}

function fitLogosIn(root, selector, opts) {
  root.querySelectorAll(selector).forEach(img => fitLogo(img, opts));
}

/** 흰 바탕에 그렸을 때 어두운 점이 0.5%도 안 되면 흰 로고로 본다(같은 파일은 한 번만 잰다). */
const _lightLogoCache = new Map();
function isLightLogo(img) {
  const key = img.currentSrc || img.src;
  if (_lightLogoCache.has(key)) return _lightLogoCache.get(key);
  let light = false;
  try {
    const W = 60, H = 60;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 225) ink++;
    }
    light = ink / (W * H) < 0.005;
  } catch (e) { /* 다른 출처 그림이면 잴 수 없다 — 그대로 둔다 */ }
  _lightLogoCache.set(key, light);
  return light;
}
