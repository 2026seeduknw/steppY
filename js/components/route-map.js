/**
 * My steps — 다녀온 도시를 흑백 지구본이나 평면 지도의 실제 자리에 올리고 방문 순서대로 잇는다.
 *
 * 지도 그림은 학교 지구본과 같은 assets/globe 를 쓴다. 사진에서 땅·바다만 뽑아 흑백으로 그린다.
 * 위치는 도시 중심 좌표뿐이고(GPS는 저장하지 않는다), 도시 사이는 실제 이동 길이 아니라 최단 대권 항로로 긋는다.
 *
 * 쓰는 법: const map = RouteMap.create(el, stops, { mode }) → map.pick(i) · map.destroy()
 *   stops = [{ name, cover, coord: [lat, lng] | null }]. 사진·도시 선택은 부모가 [data-stop] 클릭으로 받는다.
 */
const RouteMap = (function () {
  const D2R = Math.PI / 180;
  const OCEAN = [22, 22, 22], LAND = [252, 252, 252], COAST = [150, 150, 150], GRID = [46, 46, 46];
  const ROUTE = '#4D9BFF', DOT = '#E5483D';
  const ZOOMS = { globe: [1, 1.8, 3.2, 5.5], map: [1, 1.7, 2.8, 4.5] };
  const CARD = 48, CARD_H = 66;
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const wrap = (d) => ((d + 540) % 360 + 360) % 360 - 180;
  // 평면 지도는 메르카토르 — 모양이 익숙하고 세로로 화면을 더 채운다. 남극은 넓게 늘어나 뺀다
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * D2R / 2)) / D2R;
  const unmerc = (y) => (2 * Math.atan(Math.exp(y * D2R)) - Math.PI / 2) / D2R;
  const MAP_SOUTH = -60;

  /* 지도 자료는 한 번만 읽는다 */
  let mask = null, texW = 0, texH = 0, borders = null, loading = null;
  function loadData() {
    if (loading) return loading;
    const tex = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = texW = img.naturalWidth; c.height = texH = img.naturalHeight;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        const px = new Uint32Array(cx.getImageData(0, 0, texW, texH).data.buffer);
        const raw = new Float32Array(texW * texH);
        for (let i = 0; i < px.length; i++) {
          const v = px[i], r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
          const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
          raw[i] = (b > r * 1.1 && b >= g * 0.95 && lum < 0.6) ? 0 : 1;
        }
        mask = new Float32Array(texW * texH);
        for (let y = 0; y < texH; y++) for (let x = 0; x < texW; x++) {
          let sum = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= texH) continue;
            for (let dx = -1; dx <= 1; dx++) { sum += raw[yy * texW + (x + dx + texW) % texW]; n++; }
          }
          mask[y * texW + x] = sum / n;
        }
        resolve();
      };
      img.onerror = reject;
      img.src = 'assets/globe/earth-equirect.webp';
    });
    const lines = fetch('assets/globe/borders.json').then(r => r.json()).then(d => {
      const k = 1 / (d.scale || 100);
      borders = (d.countries || []).map(l => { const a = new Float32Array(l.length); for (let i = 0; i < l.length; i++) a[i] = l[i] * k; return a; });
    }).catch(() => { /* 경계선이 없어도 지도는 쓸 수 있다 */ });
    loading = Promise.all([tex, lines]);
    return loading;
  }
  function maskAt(u, v) {
    const fx = u * texW - 0.5, fy = Math.max(0, Math.min(texH - 1.001, v * texH - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = (x0 + texW) % texW, xb = (x0 + 1 + texW) % texW, y1 = y0 + 1;
    const a = mask[y0 * texW + xa], b = mask[y0 * texW + xb], c = mask[y1 * texW + xa], d = mask[y1 * texW + xb];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }

  /** 두 지점 사이 대권 위의 점들 */
  function arc(a, b) {
    const vec = ([lat, lon]) => { const p = lat * D2R, l = lon * D2R; return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]; };
    const A = vec(a), B = vec(b);
    const w = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
    if (w < 1e-4) return [a, b];
    const n = Math.max(2, Math.ceil(w / (2 * D2R))), out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
      const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
      out.push([Math.atan2(z, Math.hypot(x, y)) / D2R, Math.atan2(y, x) / D2R]);
    }
    return out;
  }

  function create(el, stops, opts) {
    const placed = stops.map((s, i) => ({ ...s, i })).filter(s => s.coord);
    const missing = stops.length - placed.length;
    let mode = (opts && opts.mode) === 'map' ? 'map' : 'globe';
    let w = 0, h = 0, zi = 0, lon0 = 0, lat0 = 20, fitK = 2, picked = -1, raf = 0, drag = null, dead = false, justDragged = false;

    el.classList.add('rec-rmap');
    el.innerHTML = `
      <canvas class="rec-rmap__earth" aria-hidden="true"></canvas>
      <canvas class="rec-rmap__route" aria-hidden="true"></canvas>
      <div class="rec-rmap__stops">${placed.map(s => `
        <button type="button" class="rec-rmap__stop" data-stop="${s.i}" aria-label="${s.i + 1}번째, ${esc(s.name)}">
          <span class="rec-rmap__photo"><img src="${esc(s.cover)}" alt="" draggable="false"><b>${s.i + 1}</b></span>
          <span class="rec-rmap__name">${esc(s.name)}</span>
        </button>`).join('')}</div>
      <div class="rec-rmap__modes" role="group" aria-label="지도 모양">
        <button type="button" data-map-mode="globe">Globe</button><button type="button" data-map-mode="map">Map</button>
      </div>
      <div class="rec-rmap__zoom">
        <button type="button" data-map-zoom="1" aria-label="확대">+</button><button type="button" data-map-zoom="-1" aria-label="축소">−</button>
      </div>
      ${missing ? `<p class="rec-rmap__note">위치를 모르는 도시 ${missing}곳은 지도에서 빠졌어요.</p>` : ''}`;
    const earth = el.querySelector('.rec-rmap__earth'), route = el.querySelector('.rec-rmap__route');
    const ex = earth.getContext('2d'), rx = route.getContext('2d');
    const cards = [...el.querySelectorAll('.rec-rmap__stop')];
    const dpr = () => Math.min(2, window.devicePixelRatio || 1);

    /* 투영 */
    const radius = () => (Math.min(w, h) / 2 - 8) * ZOOMS.globe[zi];
    const k = () => fitK * ZOOMS.map[zi];
    function project(lat, lon) {
      if (mode === 'map') return { x: w / 2 + wrap(lon - lon0) * k(), y: h / 2 - (merc(lat) - merc(lat0)) * k(), front: true };
      const p = lat * D2R, l = (lon - lon0) * D2R, p0 = lat0 * D2R, R = radius();
      const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
      return { x: w / 2 + R * Math.cos(p) * Math.sin(l), y: h / 2 - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), front: cosc > 0.02 };
    }
    function fit() {
      zi = 0;
      if (!placed.length) { lon0 = 10; lat0 = 25; fitK = w / 360; return; }
      let x = 0, y = 0, z = 0;
      placed.forEach(({ coord: [a, b] }) => { const p = a * D2R, l = b * D2R; x += Math.cos(p) * Math.cos(l); y += Math.cos(p) * Math.sin(l); z += Math.sin(p); });
      lon0 = Math.atan2(y, x) / D2R;
      const lats = placed.map(s => s.coord[0]);
      const spanLon = Math.max(...placed.map(s => Math.abs(wrap(s.coord[1] - lon0))));
      const my = lats.map(merc);
      const spanLat = mode === 'map' ? (Math.max(...my) - Math.min(...my)) / 2 : (Math.max(...lats) - Math.min(...lats)) / 2;
      lat0 = mode === 'map' ? unmerc((Math.max(...my) + Math.min(...my)) / 2) : Math.max(-60, Math.min(60, Math.atan2(z, Math.hypot(x, y)) / D2R));
      const padX = CARD + 16, padY = CARD_H + 24;
      fitK = Math.max(w / 360, Math.min(24, (w - padX * 2) / Math.max(1, 2 * spanLon), (h - padY * 2) / Math.max(1, 2 * spanLat)));
    }

    /* 땅·바다 */
    function drawEarth() {
      if (!mask || !w || !h) return;
      const s = dpr() * (drag && drag.moved ? 0.5 : 1);
      const W = Math.round(w * s), H = Math.round(h * s);
      if (earth.width !== W || earth.height !== H) { earth.width = W; earth.height = H; }
      const img = ex.createImageData(W, H), out = new Uint32Array(img.data.buffer);
      const globe = mode === 'globe', R = radius() * s, r2 = R * R, K = k() * s;
      const p0 = lat0 * D2R, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
      for (let py = 0; py < H; py++) {
        const Y = H / 2 - py - 0.5;
        if (globe && Y * Y > r2) continue;
        for (let px = 0; px < W; px++) {
          const X = px + 0.5 - W / 2;
          let lat, lon, nz = 1;
          if (globe) {
            const d2 = X * X + Y * Y;
            if (d2 > r2) continue;
            const nx = X / R, ny = Y / R; nz = Math.sqrt(1 - d2 / r2);
            lat = Math.asin(Math.min(1, nz * sp0 + ny * cp0)) / D2R;
            lon = lon0 + Math.atan2(nx, nz * cp0 - ny * sp0) / D2R;
          } else { lat = unmerc(merc(lat0) + Y / K); lon = lon0 + X / K; }
          let v = OCEAN;
          let c = [v[0], v[1], v[2]];
          if (globe || (lat <= 85 && lat >= MAP_SOUTH)) {
            let u = (lon / 360 + 0.5) % 1; if (u < 0) u += 1;
            const m = maskAt(u, 0.5 - lat / 180), t = Math.max(0, Math.min(1, (m - 0.42) / 0.16));
            c = [OCEAN[0] + (LAND[0] - OCEAN[0]) * t, 0, 0]; c[1] = c[2] = c[0];
            if (t < 0.5) {
              const unit = globe ? D2R * R : K;
              const dl = Math.abs(lat - Math.round(lat / 30) * 30) * unit / (globe ? 1 : Math.cos(lat * D2R));
              const dn = Math.abs(lon - Math.round(lon / 30) * 30) * unit * (globe ? Math.cos(lat * D2R) : 1);
              if (Math.min(dl, dn) < 0.7) c = GRID.slice();
            }
            const edge = Math.abs(m - 0.5);
            if (edge < 0.05) { const e = 1 - edge / 0.05; c = c.map((x, i) => x + (COAST[i] - x) * e); }
          }
          const shade = globe ? 0.93 + 0.07 * nz : 1;
          const g = (c[0] * shade) & 255;
          out[py * W + px] = (255 << 24) | (g << 16) | (g << 8) | g;
        }
      }
      ex.putImageData(img, 0, 0);
      if (borders) {
        ex.save(); ex.scale(s, s); ex.beginPath();
        for (const l of borders) {
          let pen = false, last = null;
          for (let i = 0; i < l.length; i += 2) {
            if (mode === 'map' && l[i + 1] < MAP_SOUTH) { pen = false; last = null; continue; }
            const q = project(l[i + 1], l[i]);
            if (!q.front || (last && Math.abs(q.x - last.x) > w * 0.8 && mode === 'map')) { pen = false; last = q.front ? q : null; if (!q.front) continue; }
            if (pen) ex.lineTo(q.x, q.y); else { ex.moveTo(q.x, q.y); pen = true; }
            last = q;
          }
        }
        ex.strokeStyle = 'rgba(0, 0, 0, 0.24)'; ex.lineWidth = 0.7; ex.stroke(); ex.restore();
      }
    }

    /* 경로·사진 */
    function drawRoute() {
      const s = dpr();
      if (route.width !== Math.round(w * s) || route.height !== Math.round(h * s)) { route.width = Math.round(w * s); route.height = Math.round(h * s); }
      rx.setTransform(s, 0, 0, s, 0, 0);
      rx.clearRect(0, 0, w, h);
      rx.lineCap = rx.lineJoin = 'round';
      rx.beginPath();
      for (let n = 1; n < placed.length; n++) {
        let pen = false, last = null;
        for (const [lat, lon] of arc(placed[n - 1].coord, placed[n].coord)) {
          const q = project(lat, lon);
          if (!q.front) { pen = false; last = null; continue; }
          if (last && Math.abs(q.x - last.x) > w * 0.8) pen = false;
          if (pen) rx.lineTo(q.x, q.y); else { rx.moveTo(q.x, q.y); pen = true; }
          last = q;
        }
      }
      rx.strokeStyle = ROUTE; rx.lineWidth = 3; rx.stroke();
      const showNames = placed.length <= 6;
      const taken = [];
      const gapX = showNames ? 86 : CARD + 6;
      const free = (x, y) => !taken.some(t => Math.abs(t.x - x) < gapX && Math.abs(t.y - y) < CARD_H + 2);
      const inside = (x, y) => x >= 4 && y >= 4 && x + CARD <= w - 4 && y + CARD_H <= h - 4;
      const order = placed.map((p, n) => ({ p, n, q: project(p.coord[0], p.coord[1]) }));
      // 고른 도시가 가장 좋은 자리를 먼저 갖는다
      order.sort((a, b) => (b.p.i === picked) - (a.p.i === picked) || a.n - b.n);
      rx.lineWidth = 1.5; rx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      order.forEach(({ p, n, q }) => {
        const card = cards[n];
        const show = q.front && q.x > -8 && q.y > -8 && q.x < w + 8 && q.y < h + 8;
        card.hidden = !show;
        if (!show) return;
        const bx = q.x - CARD / 2, by = q.y - CARD_H - 10;
        let spot = null;
        for (let ring = 0; ring < 4 && !spot; ring++) {
          const d = ring * (gapX + 2), e = ring * (CARD_H + 4);
          for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, CARD_H + 20 + e], [d, CARD_H + 20], [-d, CARD_H + 20], [0, -e], [d, -e], [-d, -e]]) {
            const x = bx + dx, y = by + dy;
            if (inside(x, y) && free(x, y)) { spot = { x, y }; break; }
          }
        }
        if (!spot) spot = { x: Math.max(4, Math.min(w - CARD - 4, bx)), y: Math.max(4, Math.min(h - CARD_H - 4, by)) };
        taken.push(spot);
        card.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
        card.classList.toggle('is-picked', p.i === picked);
        card.classList.toggle('has-name', showNames || p.i === picked);
        rx.beginPath();
        rx.moveTo(q.x, q.y);
        rx.lineTo(spot.x + CARD / 2, spot.y + (spot.y > q.y ? 0 : CARD));
        rx.stroke();
      });
      order.forEach(({ p, q }) => {
        if (!q.front) return;
        rx.beginPath(); rx.arc(q.x, q.y, p.i === picked ? 6 : 4.5, 0, Math.PI * 2);
        rx.fillStyle = DOT; rx.fill();
        rx.lineWidth = 2; rx.strokeStyle = '#fff'; rx.stroke();
      });
    }
    function draw() { raf = 0; if (dead) return; drawEarth(); drawRoute(); }
    function request() { if (!raf && !dead) raf = requestAnimationFrame(draw); }

    function syncButtons() {
      const page = el.closest('.rec-route');
      if (page) page.classList.toggle('is-flat', mode === 'map');
      el.querySelectorAll('[data-map-mode]').forEach(b => {
        const on = b.dataset.mapMode === mode;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      el.querySelector('[data-map-zoom="1"]').disabled = zi === ZOOMS[mode].length - 1;
      el.querySelector('[data-map-zoom="-1"]').disabled = zi === 0;
    }
    function setMode(next) {
      mode = next;
      try { localStorage.setItem('steppy_route_mode', mode); } catch (e) { /* 사생활 모드 */ }
      fit(); syncButtons(); request();
    }
    function measure() {
      const nw = el.clientWidth, nh = el.clientHeight;
      if (!nw || !nh || (nw === w && nh === h)) return;
      const first = !w;
      w = nw; h = nh;
      if (first) fit();
      request();
    }

    /* 조작 */
    const onClick = (e) => {
      if (justDragged) { justDragged = false; e.stopPropagation(); e.preventDefault(); return; }
      const m = e.target.closest('[data-map-mode]');
      if (m) { e.stopPropagation(); setMode(m.dataset.mapMode); return; }
      const z = e.target.closest('[data-map-zoom]');
      if (z) { e.stopPropagation(); zi = Math.max(0, Math.min(ZOOMS[mode].length - 1, zi + Number(z.dataset.mapZoom))); syncButtons(); request(); }
    };
    const onDown = (e) => {
      if (e.target.closest('[data-map-mode], [data-map-zoom]')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lon: lon0, lat: lat0, moved: false };
    };
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      if (!drag.moved) { drag.moved = true; try { el.setPointerCapture(drag.id); } catch (err) { /* 무시 */ } }
      const per = mode === 'globe' ? 1 / (D2R * radius()) : 1 / k();
      lon0 = wrap(drag.lon - dx * per);
      lat0 = mode === 'map' ? Math.max(-55, Math.min(75, unmerc(merc(drag.lat) + dy * per))) : Math.max(-80, Math.min(80, drag.lat + dy * per));
      request();
    };
    const onUp = () => {
      if (!drag) return;
      if (drag.moved) { justDragged = true; setTimeout(() => { justDragged = false; }, 0); }
      drag = null;
      request();
    };
    el.addEventListener('click', onClick, true);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    syncButtons();
    loadData().then(request).catch(() => { /* 그림을 못 읽어도 경로와 사진은 보인다 */ });

    return {
      pick(i) {
        picked = i;
        const s = stops[i];
        // 뒤편이나 화면 밖에 있는 도시를 고르면 그 자리로 돌린다
        if (s && s.coord && w) {
          const q = project(s.coord[0], s.coord[1]);
          if (!q.front || q.x < 0 || q.y < 0 || q.x > w || q.y > h) { lat0 = Math.max(-70, Math.min(70, s.coord[0])); lon0 = s.coord[1]; }
        }
        request();
      },
      destroy() {
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener('click', onClick, true);
      }
    };
  }
  return { create };
})();
