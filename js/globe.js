/**
 * 랜딩 배경의 지구 — 진짜로 자전한다.
 *
 * 왜 사진 여러 장이 아니라 이 방식인가
 *   처음에는 각도가 다른 사진 5컷을 겹쳐 넘겼다. 5컷으로는 대륙이 옆으로
 *   흐르지 않고 다른 면으로 "녹아드는" 디졸브로 보인다. 컷을 늘리면 용량이
 *   붙고, 그래도 단계가 보인다.
 *
 *   그래서 정사각도법 세계 지도 한 장(assets/globe/earth-equirect.webp)을
 *   구면에 입히고 정사영으로 직접 그린다. 경도만 계속 더해 주면 끊김 없이
 *   무한히 돈다. 텍스처는 37KB 한 장뿐이다.
 *
 * 비싸지 않은 이유
 *   회전은 경도만 바꾸는 일이라, 출력 픽셀 하나가 텍스처의 **몇 번째 행**과
 *   **중심에서 몇 칸 떨어진 열**을 보는지는 처음에 한 번만 구하면 끝난다.
 *   매 프레임은 그 표를 보고 열을 shift 하며 복사하는 것뿐이다(곱셈·삼각함수 없음).
 */
(function () {
  const host = document.getElementById('heroGlobe');
  if (!host) return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SIZE = 360;              // 그리는 해상도. 배경이라 이 정도면 충분하다
  const PERIOD = 55;             // 한 바퀴에 걸리는 시간(초)
  const FPS = 30;                // 배경에 60fps 를 쓸 이유가 없다

  /* 마퀴에 흘러가는 나라들이 실제로 어디에 있는지 지구 위에 불을 켠다.
     좌표는 나라 중심점(대략). 뒤로 넘어간 나라는 저절로 안 보인다. */
  const PINS = [
    ['UNITED STATES',   39.8,  -98.6],
    ['CANADA',          56.1, -106.3],
    ['UNITED KINGDOM',  54.0,   -2.0],
    ['FRANCE',          46.6,    2.5],
    ['GERMANY',         51.2,   10.5],
    ['SWITZERLAND',     46.8,    8.2],
    ['JAPAN',           36.2,  138.3],
    ['SINGAPORE',        1.4,  103.8],
    ['AUSTRALIA',      -25.3,  133.8]
  ];

  /* 발자국이 걸어가는 길 — 대한민국에서 출발해 불 켜진 나라를 차례로 지난다.
     경도가 계속 **작아지는** 순서다. 지구는 표면이 왼쪽으로 흐르게 도는데,
     같은 쪽으로 걸어야 "회전을 따라간다"로 보인다.
     한 바퀴를 넘길 때 +138° 로 튀지 않도록 360 을 빼서 이어 붙였다. */
  const TOUR = [
    [37.5,  127.0],        // 대한민국 — 출발
    [ 1.4,  103.8],        // 싱가포르
    [51.2,   10.5],        // 독일
    [46.8,    8.2],        // 스위스
    [46.6,    2.5],        // 프랑스
    [54.0,   -2.0],        // 영국
    [39.8,  -98.6],        // 미국
    [56.1, -106.3],        // 캐나다
    [36.2,  138.3 - 360],  // 일본
    [-25.3, 133.8 - 360],  // 호주
    [37.5,  127.0 - 360]   // 다시 대한민국
  ];
  const TOUR_PERIOD = 150;   // 한 바퀴 도는 데 걸리는 시간(초)
  const PRINTS = 22;         // 뒤에 남는 발자국 수
  const PRINT_GAP = 0.0055;  // 발자국 사이 간격(전체 경로 대비 비율)

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.className = 'intro__earth-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '교환학생들이 향하는 세계 지도');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  /* 불빛은 지구와 따로 그린다 — 지구는 배경이라 투명도를 많이 낮추는데,
     불빛까지 같이 흐려지면 켜진 티가 안 난다. */
  const pinCanvas = document.createElement('canvas');
  pinCanvas.width = pinCanvas.height = SIZE;
  pinCanvas.className = 'intro__earth-pins';
  pinCanvas.setAttribute('aria-hidden', 'true');
  host.appendChild(pinCanvas);
  const pctx = pinCanvas.getContext('2d');

  const img = new Image();
  img.decoding = 'async';
  img.src = 'assets/globe/earth-equirect.webp';
  img.onload = () => { try { start(); } catch (e) { fallback(); } };
  img.onerror = fallback;

  /** 텍스처를 못 받으면 캔버스를 걷어낸다 — 배경이라 없어도 화면은 멀쩡하다. */
  function fallback() { canvas.remove(); }

  function start() {
    const tw = img.naturalWidth, th = img.naturalHeight;
    const tc = document.createElement('canvas');
    tc.width = tw; tc.height = th;
    tc.getContext('2d').drawImage(img, 0, 0);
    const tex = tc.getContext('2d').getImageData(0, 0, tw, th).data;

    const out = ctx.createImageData(SIZE, SIZE);
    const px = out.data;

    // 픽셀마다: 텍스처의 몇 번째 행인지(row), 중심 경도에서 몇 칸인지(colOff),
    // 그리고 구면 음영(shade). 원 밖은 -1 로 표시해 건너뛴다.
    const row = new Int32Array(SIZE * SIZE);
    const colOff = new Int32Array(SIZE * SIZE);
    const shade = new Float32Array(SIZE * SIZE);
    const R = SIZE / 2 * 0.94;   // 사진판과 크기를 맞추려고 둘레에 여백을 둔다

    for (let y = 0; y < SIZE; y++) {
      const ny = (y + 0.5 - R) / R;                 // -1 .. 1 (아래가 +)
      for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        const nx = (x + 0.5 - SIZE / 2) / R;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) { row[i] = -1; continue; }
        const nz = Math.sqrt(1 - r2);               // 구면 앞쪽

        // 정사영 역변환 (중심 위도 0)
        const lat = Math.asin(-ny);                 // 화면 위가 북쪽
        const lon = Math.atan2(nx, nz);             // -π/2 .. π/2

        row[i] = Math.min(th - 1, ((0.5 - lat / Math.PI) * th) | 0);
        colOff[i] = Math.round((lon / (2 * Math.PI)) * tw);

        // 왼쪽 위에서 빛이 오는 램버트 음영 + 가장자리 어둡게(림 다크닝).
        // 배경이 투명도 16% 라 너무 어둡게 깎으면 통째로 회색 원이 된다 —
        // 바닥값을 높게 잡아 대륙이 보일 만큼만 입체감을 준다.
        const lambert = Math.max(0, (-nx * 0.42) + (-ny * 0.42) + nz * 0.80);
        const limb = Math.pow(nz, 0.30);
        shade[i] = Math.min(1.08, 0.52 + 0.70 * lambert) * (0.74 + 0.26 * limb);

        // 가장자리 한 픽셀은 반투명하게 — 계단이 보이지 않게
        px[i * 4 + 3] = r2 > 0.985 ? Math.round(255 * (1 - r2) / 0.015) : 255;
      }
    }

    let raf = 0, last = -1e9;
    const t0 = performance.now();
    /* 발자국이 대한민국에서 출발하는데 시작 화면에서 한국이 뒤편이면
       한참 동안 아무것도 안 보인다. 처음에 한국(127°E)이 정면에 오도록
       회전을 미리 돌려 둔다. */
    const START_SHIFT = Math.round(((127 + 180) / 360) * tw);

    function draw(now) {
      raf = requestAnimationFrame(draw);
      if (now - last < 1000 / FPS) return;
      last = now;

      // 서쪽으로 흐르게(= 지구 자전 방향) 경도를 계속 더한다
      const shift = (START_SHIFT + Math.round(((now - t0) / 1000 / PERIOD) * tw)) % tw;

      for (let i = 0; i < SIZE * SIZE; i++) {
        const r = row[i];
        if (r < 0) continue;
        let c = (colOff[i] + shift) % tw;
        if (c < 0) c += tw;
        const s = (r * tw + c) * 4;
        const k = shade[i];
        const o = i * 4;
        px[o]     = Math.min(255, tex[s] * k);
        px[o + 1] = Math.min(255, tex[s + 1] * k);
        px[o + 2] = Math.min(255, tex[s + 2] * k);
      }
      ctx.putImageData(out, 0, 0);
      drawPins(shift, now);
      drawSteps(shift, now);
    }

    /** 경로 위 진행도 t(0~1) 에서의 위도·경도. 구간 사이는 그냥 선형 보간한다. */
    function tourAt(t) {
      const n = TOUR.length - 1;
      const f = ((t % 1) + 1) % 1 * n;
      const i = Math.min(n - 1, Math.floor(f));
      const u = f - i;
      return [TOUR[i][0] + (TOUR[i + 1][0] - TOUR[i][0]) * u,
              TOUR[i][1] + (TOUR[i + 1][1] - TOUR[i][1]) * u];
    }

    /** 위도·경도 → 화면 좌표. 뒤편이면 null. */
    function project(lat, lon, shift) {
      const la = lat * Math.PI / 180;
      const colOfL = ((((lon % 360) + 540) % 360) / 360) * tw;
      let lonS = ((colOfL - shift) / tw) * Math.PI * 2;
      lonS = ((lonS + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const nz = Math.cos(la) * Math.cos(lonS);
      if (nz <= 0.04) return null;
      return [SIZE / 2 + Math.cos(la) * Math.sin(lonS) * R,
              SIZE / 2 - Math.sin(la) * R,
              nz];
    }

    /**
     * 발자국 — 걷는 사람 뒤로 자국이 남았다가 옅어진다.
     *
     * 상태를 들고 있지 않는다. j 번째 자국은 "지금 진행도에서 j 칸 뒤"라고
     * 정하면 매 프레임 다시 계산해도 같은 자리에 찍힌다. 탭을 껐다 켜도
     * 자국이 엉키지 않는다.
     */
    function drawSteps(shift, now) {
      const t = (now / 1000) / TOUR_PERIOD;
      for (let jj = PRINTS - 1; jj >= 0; jj--) {
        const tp = t - jj * PRINT_GAP;
        const [lat, lon] = tourAt(tp);
        const p = project(lat, lon, shift);
        if (!p) continue;
        const [x, y, nz] = p;

        // 진행 방향 — 살짝 앞선 지점과의 차이로 구한다(발끝이 갈 길을 본다)
        const [lat2, lon2] = tourAt(tp + 0.0012);
        const p2 = project(lat2, lon2, shift);
        const ang = p2 ? Math.atan2(p2[1] - y, p2[0] - x) : 0;

        // 왼발 오른발 — 진행 방향의 직각으로 조금씩 엇갈리게
        const side = (jj % 2 ? 1 : -1) * 3.4;
        const ox = Math.cos(ang + Math.PI / 2) * side;
        const oy = Math.sin(ang + Math.PI / 2) * side;

        const fade = (1 - jj / PRINTS) * Math.min(1, nz / 0.3);
        pctx.save();
        pctx.translate(x + ox, y + oy);
        pctx.rotate(ang + Math.PI / 2);
        /* 흰 발자국은 지구의 밝은 구름·대륙에 그대로 섞여 버린다.
           하늘색 테를 둘러야 바탕과 분리돼 보인다 — 불빛과 같은 이유다. */
        pctx.beginPath();
        pctx.ellipse(0, 0, 2.2, 3.6, 0, 0, Math.PI * 2);
        pctx.fillStyle = `rgba(255,255,255,${0.95 * fade})`;
        pctx.fill();
        pctx.lineWidth = 1.3;
        pctx.strokeStyle = `rgba(18,229,226,${0.85 * fade})`;
        pctx.stroke();
        pctx.restore();
      }
    }

    /**
     * 나라 위치에 불을 켠다.
     *
     * 화면 좌표 구하기 — 렌더 루프의 역변환을 그대로 뒤집은 것이다.
     *   텍스처에서 경도 L 이 있는 열 = ((L+180)/360)·tw
     *   그 열이 화면에 오려면  colOff = 그 열 − shift  여야 하고,
     *   colOff 는 화면 경도를 뜻하므로  lonScreen = colOff/tw · 2π.
     *   |lonScreen| > 90° 면 지구 뒤편이라 안 그린다.
     */
    function drawPins(shift, now) {
      pctx.clearRect(0, 0, SIZE, SIZE);
      const C = SIZE / 2;
      for (let k = 0; k < PINS.length; k++) {
        const lat = PINS[k][1] * Math.PI / 180;
        const colOfL = ((PINS[k][2] + 180) / 360) * tw;
        let lonScreen = ((colOfL - shift) / tw) * Math.PI * 2;
        lonScreen = ((lonScreen + Math.PI * 3) % (Math.PI * 2)) - Math.PI;   // -π..π
        const nz = Math.cos(lat) * Math.cos(lonScreen);
        if (nz <= 0.06) continue;                       // 뒤편이거나 가장자리에 걸침

        const nx = Math.cos(lat) * Math.sin(lonScreen);
        const ny = -Math.sin(lat);
        const x = C + nx * R, y = C + ny * R;

        // 가장자리로 갈수록 옅어진다 — 구체 표면에 붙어 있는 것처럼 보이게
        const edge = Math.min(1, nz / 0.35);
        // 나라마다 다른 박자로 천천히 깜빡인다
        const pulse = 0.90 + 0.10 * Math.sin(now / 1000 * 1.1 + k * 1.7);
        const a = edge * pulse;

        /* 심지는 흰색, 둘레는 하늘색.
           흰색만으로는 밝은 지구 위에서 묻힌다 — 하늘색 테가 흰 점을 띄워 준다.
           번짐은 좁게 잡는다. 넓으면 불이 아니라 얼룩으로 보인다. */
        const R1 = 18;
        const halo = pctx.createRadialGradient(x, y, 0, x, y, R1);
        halo.addColorStop(0,    `rgba(18,229,226,${0.40 * a})`);
        halo.addColorStop(0.45, `rgba(18,229,226,${0.14 * a})`);
        halo.addColorStop(1,     'rgba(18,229,226,0)');
        pctx.fillStyle = halo;
        pctx.beginPath(); pctx.arc(x, y, R1, 0, Math.PI * 2); pctx.fill();

        pctx.fillStyle = `rgba(18,229,226,${0.92 * a})`;      // 하늘색 테
        pctx.beginPath(); pctx.arc(x, y, 5.8, 0, Math.PI * 2); pctx.fill();

        /* 흰 심지는 'lighter'(가산 합성)로 얹는다. 보통 합성은 아래 색을
           덮기만 해서 흰색이 더 밝아질 수가 없다 — 가산이라야 실제로 탄다. */
        pctx.globalCompositeOperation = 'lighter';
        const core = pctx.createRadialGradient(x, y, 0, x, y, 6.4);
        core.addColorStop(0,    `rgba(255,255,255,${a})`);
        core.addColorStop(0.42, `rgba(255,255,255,${0.62 * a})`);
        core.addColorStop(1,     'rgba(255,255,255,0)');
        pctx.fillStyle = core;
        pctx.beginPath(); pctx.arc(x, y, 6.4, 0, Math.PI * 2); pctx.fill();

        pctx.fillStyle = `rgba(255,255,255,${a})`;
        pctx.beginPath(); pctx.arc(x, y, 3.2, 0, Math.PI * 2); pctx.fill();
        pctx.globalCompositeOperation = 'source-over';
      }
    }

    if (REDUCED) { draw(performance.now()); cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(draw);

    // 탭이 가려져 있으면 그릴 이유가 없다 — 배터리를 그냥 태우는 셈이다
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = -1e9; raf = requestAnimationFrame(draw); }
    });
  }
})();
