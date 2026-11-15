/**
 * 학교 찾기 — 지구본 보기. 파견교 로고를 실제 위치(학교 좌표)에 올려 "어디에 어느 학교가 있는지" 한눈에 보게 한다.
 *
 * 그리는 방법
 *   세계 지도 한 장(assets/globe/earth-equirect.webp, 랜딩 지구본과 같은 그림)을 정사영으로 구면에 입힌다.
 *   화면 픽셀마다 "그 자리가 지구의 어느 위도·경도인지"를 거꾸로 구해 지도에서 색을 가져온다.
 *   끌 때만 다시 그린다(가만히 있으면 아무 계산도 하지 않는다).
 *
 * 로고
 *   캔버스 위에 DOM 버튼으로 얹는다 — 누를 수 있어야 하고, 글자(약어)도 선명해야 해서.
 *   QS 순위가 높은 학교부터 자리를 잡고, 이미 잡힌 로고와 겹치면 그 로고에 "+N"으로 묶는다.
 *   묶음을 누르면 그 자리로 확대한다. 끝까지 확대해도 겹치는(같은 도시) 학교들은 목록으로 보여준다.
 *
 * 쓰는 법: SchoolGlobe.mount(el, { onOpen(id) }) → SchoolGlobe.update(schools)
 */
const SchoolGlobe = (function () {
  const D2R = Math.PI / 180;
  const LOGO = 30;          // 로고 지름(css px)
  const MIN_GAP = 26;       // 로고 중심끼리 이보다 가까우면 묶는다
  const ZOOMS = [1, 1.8, 3.2, 5.5];

  let host = null, canvas = null, ctx = null, layer = null, pop = null, opts = {};
  let tex = null, texW = 0, texH = 0;          // 지도 픽셀(Uint32)
  let size = 0, res = 0;                        // css 크기, 그리는 해상도
  let lon0 = 10, lat0 = 30, zi = 0;             // 화면 가운데의 경도·위도, 확대 단계
  let schools = [];
  let dirty = false, raf = 0;

  /* ------------------------------------------------------------ 준비 */
  function mount(el, o) {
    host = el; opts = o || {};
    host.classList.add('sglobe');
    host.innerHTML = `
      <div class="sglobe__stage">
        <canvas class="sglobe__earth" aria-hidden="true"></canvas>
        <div class="sglobe__logos" role="list" aria-label="지구본 위 학교 로고"></div>
      </div>
      <div class="sglobe__pop" hidden></div>
      <div class="sglobe__bar">
        <p class="sglobe__hint">끌어서 돌리고, 로고를 누르면 학교 정보가 열려요.<br><b>+숫자</b>는 그 근처에 학교가 그만큼 더 있다는 뜻이에요.<br>누르면 확대돼요.</p>
        <div class="sglobe__zoom">
          <button type="button" data-zoom="-1" aria-label="축소">−</button>
          <button type="button" data-zoom="1" aria-label="확대">+</button>
        </div>
      </div>`;
    canvas = host.querySelector('.sglobe__earth');
    ctx = canvas.getContext('2d');
    layer = host.querySelector('.sglobe__logos');
    pop = host.querySelector('.sglobe__pop');
    host.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => setZoom(zi + Number(b.dataset.zoom))));
    wireDrag();
    layer.addEventListener('click', onLogoClick);
    pop.addEventListener('click', onPopClick);
    loadTexture();
    new ResizeObserver(() => { measure(); request(); }).observe(host);
    measure();
  }

  function measure() {
    const w = host.querySelector('.sglobe__stage').clientWidth;
    if (!w || w === size) return;
    size = w;
    // 가만히 있을 때는 휴대폰 화면 밀도(3배)까지 선명하게, 최대 900px. 끄는 동안은 drawEarth가 절반으로 낮춘다
    res = Math.min(900, Math.round(size * Math.min(3, window.devicePixelRatio || 1)));
    canvas.width = canvas.height = res;
  }

  function loadTexture() {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = texW = img.naturalWidth; c.height = texH = img.naturalHeight;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      tex = new Uint32Array(cx.getImageData(0, 0, texW, texH).data.buffer);
      buildMask(tex);
      request();
    };
    img.src = 'assets/globe/earth-equirect.webp';
  }

  /**
   * 사진 같은 지구 대신 일러스트 — 땅·바다 두 가지 색에 얇은 해안선과 옅은 위·경선만.
   * 지도 사진에서는 "땅인지 바다인지"(0~1)만 뽑아 살짝 흐린다. 그릴 때 이 값을 이웃 네 칸에서
   * 섞어(쌍선형) 0.5 자리를 해안선으로 삼으니, 확대해도 계단처럼 깨지지 않고 매끈하다.
   */
  let mask = null;
  function buildMask(px) {
    const raw = new Float32Array(texW * texH);
    for (let i = 0; i < px.length; i++) {
      const c = px[i], r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      raw[i] = (b > r * 1.1 && b >= g * 0.95 && lum < 0.6) ? 0 : 1;   // 파랗고 어두우면 바다
    }
    // 3×3 평균으로 한 번 흐려 해안선이 계단이 되지 않게
    mask = new Float32Array(texW * texH);
    for (let y = 0; y < texH; y++) for (let x = 0; x < texW; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= texH) continue;
        for (let dx = -1; dx <= 1; dx++) { const xx = (x + dx + texW) % texW; sum += raw[yy * texW + xx]; n++; } }
      mask[y * texW + x] = sum / n;
    }
  }
  function maskAt(u, v) {      // u,v: 0~1, 쌍선형
    const fx = u * texW - 0.5, fy = Math.max(0, Math.min(texH - 1.001, v * texH - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = (x0 + texW) % texW, xb = (x0 + 1) % texW, y1 = y0 + 1;
    const a = mask[y0 * texW + xa], b = mask[y0 * texW + xb], c = mask[y1 * texW + xa], d = mask[y1 * texW + xb];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  const OCEAN = [205, 227, 236], GRID = [221, 236, 242], LAND = [246, 240, 224], COAST = [150, 178, 170];

  /* ------------------------------------------------------------ 투영 */
  const radius = () => (size / 2 - 6) * ZOOMS[zi];

  /** 위도·경도 → 화면 좌표(css px). 뒤편이면 null */
  function project(lat, lon) {
    const φ = lat * D2R, λ = (lon - lon0) * D2R, φ0 = lat0 * D2R;
    const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ);
    if (cosc < 0.05) return null;
    const R = radius();
    const x = R * Math.cos(φ) * Math.sin(λ);
    const y = R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ));
    const px = size / 2 + x, py = size / 2 - y;
    if (px < -LOGO || py < -LOGO || px > size + LOGO || py > size + LOGO) return null;
    return { x: px, y: py, depth: cosc };
  }

  function drawEarth() {
    if (!mask || !res) return;
    // 끄는 동안에는 절반 해상도로 빠르게, 손을 떼면 원래 해상도로 다시 그린다(움직일 때 끊기지 않게)
    const want = drag && moved ? Math.min(400, Math.round(res / 2)) : res;
    if (canvas.width !== want) canvas.width = canvas.height = want;
    const res_ = want;
    const img = ctx.createImageData(res_, res_);
    const out = new Uint32Array(img.data.buffer);
    const scale = res_ / size;
    const R = radius() * scale, c = res_ / 2;
    const φ0 = lat0 * D2R, sφ0 = Math.sin(φ0), cφ0 = Math.cos(φ0);
    const λ0 = lon0 * D2R;
    const r2 = R * R;
    for (let py = 0; py < res_; py++) {
      const Y = (c - py - 0.5);
      if (Y * Y > r2) continue;
      for (let px = 0; px < res_; px++) {
        const X = (px + 0.5 - c);
        const d2 = X * X + Y * Y;
        if (d2 > r2) continue;
        const nx = X / R, ny = Y / R, nz = Math.sqrt(1 - d2 / r2);
        const lat = Math.asin(nz * sφ0 + ny * cφ0);
        let lon = λ0 + Math.atan2(nx, nz * cφ0 - ny * sφ0);
        let u = ((lon / (2 * Math.PI)) + 0.5) % 1; if (u < 0) u += 1;
        const v = 0.5 - lat / Math.PI;
        const m = maskAt(u, v);
        // 땅/바다 섞기(0.5 근처만 부드럽게), 해안선은 0.5 부근 얇은 띠 — 화면 픽셀 기준 두께라 확대해도 같은 굵기
        const edge = Math.abs(m - 0.5);
        const t = Math.max(0, Math.min(1, (m - 0.42) / 0.16));
        let r = OCEAN[0] + (LAND[0] - OCEAN[0]) * t, g = OCEAN[1] + (LAND[1] - OCEAN[1]) * t, b = OCEAN[2] + (LAND[2] - OCEAN[2]) * t;
        if (t < 0.5) {
          // 바다에 30°마다 옅은 위·경선
          const latD = lat / D2R, lonD = lon / D2R;
          const dl = Math.abs(latD - Math.round(latD / 30) * 30) * D2R * R;
          const dn = Math.abs(lonD - Math.round(lonD / 30) * 30) * D2R * R * Math.cos(lat);
          if (Math.min(dl, dn) < 0.7) { r = GRID[0]; g = GRID[1]; b = GRID[2]; }
        }
        const cw = 0.06 / Math.max(1, ZOOMS[zi] * 0.6);
        if (edge < cw) { const k = 1 - edge / cw; r += (COAST[0] - r) * k; g += (COAST[1] - g) * k; b += (COAST[2] - b) * k; }
        const shade = 0.94 + 0.06 * nz;   // 가장자리만 아주 살짝
        out[py * res_ + px] = (255 << 24) | (((b * shade) & 255) << 16) | (((g * shade) & 255) << 8) | ((r * shade) & 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ------------------------------------------------------------ 로고 */
  function initials(name) {
    return String(name || '?').replace(/\(.*?\)/g, '').split(/\s+/).filter(w => /^[A-Z]/.test(w)).slice(0, 3).map(w => w[0]).join('') || String(name || '?')[0];
  }
  function logoInner(s) {
    const file = typeof SCHOOL_LOGOS !== 'undefined' && SCHOOL_LOGOS[s.id];
    return file ? `<img src="assets/school-logos/${file}" alt="" draggable="false">` : `<span>${initials(s.name)}</span>`;
  }

  let groups = [];   // [{ x, y, depth, list: [school] }]
  function placeLogos() {
    const seen = schools
      .filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map(s => ({ s, p: project(s.lat, s.lng) }))
      .filter(o => o.p)
      .sort((a, b) => (a.s.qsRank || 9999) - (b.s.qsRank || 9999));
    groups = [];
    seen.forEach(({ s, p }) => {
      const near = groups.find(g => Math.hypot(g.x - p.x, g.y - p.y) < MIN_GAP);
      if (near) near.list.push(s);
      else groups.push({ x: p.x, y: p.y, depth: p.depth, list: [s] });
    });
    layer.innerHTML = groups.map((g, i) => {
      const s = g.list[0], more = g.list.length - 1;
      const sc = 0.75 + 0.25 * g.depth;
      return `<button type="button" class="sglobe__logo${more ? ' has-more' : ''}" role="listitem" data-g="${i}"
        style="transform:translate(${(g.x - LOGO / 2).toFixed(1)}px,${(g.y - LOGO / 2).toFixed(1)}px) scale(${sc.toFixed(2)});z-index:${Math.round(g.depth * 100)}"
        aria-label="${s.name}${more ? ` 외 ${more}곳` : ''}">${logoInner(s)}${more ? `<b class="sglobe__more">+${more}</b>` : ''}</button>`;
    }).join('');
    // 흰 글자 로고는 흰 동그라미 위에서 안 보인다 — 진한 바탕으로(logo-fit.js isLightLogo)
    layer.querySelectorAll('img').forEach(img => {
      const check = () => { if (typeof isLightLogo === 'function' && isLightLogo(img)) img.parentElement.classList.add('is-light'); };
      if (img.complete && img.naturalWidth) check(); else img.addEventListener('load', check, { once: true });
    });
  }

  function render() {
    raf = 0;
    if (!dirty) return;
    dirty = false;
    measure();
    drawEarth();
    placeLogos();
  }
  function request() { dirty = true; if (!raf) raf = requestAnimationFrame(render); }

  /* ------------------------------------------------------------ 조작 */
  function setZoom(next, focus) {
    zi = Math.max(0, Math.min(ZOOMS.length - 1, next));
    if (focus) { lat0 = Math.max(-80, Math.min(80, focus.lat)); lon0 = focus.lon; }
    host.querySelector('[data-zoom="-1"]').disabled = zi === 0;
    host.querySelector('[data-zoom="1"]').disabled = zi === ZOOMS.length - 1;
    closePop();
    request();
  }

  let drag = null, moved = false;
  function wireDrag() {
    const stage = host.querySelector('.sglobe__stage');
    stage.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, lon: lon0, lat: lat0 };
      moved = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) { moved = true; closePop(); }
      e.preventDefault();
      const k = 180 / Math.PI / radius();
      lon0 = drag.lon - dx * k;
      lat0 = Math.max(-80, Math.min(80, drag.lat + dy * k));
      request();
    }, { passive: false });
    const end = () => { if (!drag) return; const wasMoving = moved; drag = null; if (wasMoving) request(); };   // 손을 떼면 선명하게 다시
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    // 데스크톱 휠로 확대·축소
    stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zi + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
  }

  function onLogoClick(e) {
    if (moved) { moved = false; return; }
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const g = groups[Number(b.dataset.g)];
    if (!g) return;
    if (g.list.length === 1) { closePop(); if (opts.onOpen) opts.onOpen(g.list[0].id); return; }
    // 묶음 — 더 확대할 수 있으면 그 자리로 확대, 끝까지 확대했으면 목록
    if (zi < ZOOMS.length - 1) {
      const lat = g.list.reduce((a, s) => a + s.lat, 0) / g.list.length;
      const lon = g.list.reduce((a, s) => a + s.lng, 0) / g.list.length;
      setZoom(zi + 1, { lat, lon });
      return;
    }
    openPop(g);
  }

  function openPop(g) {
    pop.innerHTML = `<p class="sglobe__pop-title">${g.list[0].city || g.list[0].countryEn || ''} · ${g.list.length}곳</p>
      <ul>${g.list.map(s => `<li><button type="button" data-open="${s.id}"><span class="sglobe__pop-logo">${logoInner(s)}</span>${s.name}</button></li>`).join('')}</ul>`;
    pop.hidden = false;
    const left = Math.max(8, Math.min(size - 228, g.x - 110));
    const top = g.y + LOGO / 2 + 6 + 200 > size ? Math.max(8, g.y - LOGO / 2 - 6 - Math.min(200, pop.offsetHeight)) : g.y + LOGO / 2 + 6;
    // 목록은 지구본(원 모양으로 잘림) 밖에 둔다 — 지구본 자리만큼 옮겨 놓는다
    const st = host.querySelector('.sglobe__stage');
    pop.style.left = (st.offsetLeft + left) + 'px'; pop.style.top = (st.offsetTop + top) + 'px';
  }
  function closePop() { if (pop) pop.hidden = true; }
  function onPopClick(e) {
    const b = e.target.closest('[data-open]');
    if (b && opts.onOpen) { closePop(); opts.onOpen(b.dataset.open); }
  }

  /* ------------------------------------------------------------ 바깥에서 */
  /** 보여줄 학교를 바꾼다(필터 결과). 처음이면 학교들이 모인 쪽으로 돌려 둔다 */
  function update(list, { recenter } = {}) {
    schools = list || [];
    if (recenter) {
      const pts = schools.filter(s => typeof s.lat === 'number');
      if (pts.length) {
        // 경도는 평균 대신 단위 벡터 평균 — 날짜변경선을 넘는 묶음(미주+아시아)에서 엉뚱한 바다로 가지 않게
        let x = 0, y = 0, la = 0;
        pts.forEach(s => { x += Math.cos(s.lng * D2R); y += Math.sin(s.lng * D2R); la += s.lat; });
        lon0 = Math.atan2(y, x) / D2R;
        lat0 = Math.max(-60, Math.min(60, la / pts.length));
      }
    }
    closePop();
    request();
  }

  return { mount, update };
})();
