/**
 * 인트로 스플래시 — 글자가 흩어진 배치로 떨어졌다가, 제목의 제자리로 낙하한다.
 *
 * 자리를 어떻게 맞추나
 *   목표 좌표를 눈으로 맞추지 않는다. 화면에 이미 놓여 있는 **진짜 워드마크의
 *   getBoundingClientRect() 를 재서** 거기로 보낸다. 글자 하나하나의 자리는
 *   tools/make-splash.py 가 뽑아 둔 비율(hx/hy/hw/hh)로 나눈다.
 *   그래서 문구·글자 크기·화면 폭이 바뀌어도 따로 손댈 것이 없다.
 *
 * 진짜 글자는 끝날 때까지 숨긴다
 *   떨어지는 글자 밑에 진짜 워드마크가 비쳐 보이면 두 겹으로 보인다.
 *   <html class="is-splashing"> 동안 숨겼다가, 착지한 순간 바꿔 끼운다.
 *   JS 가 안 돌면 이 클래스가 안 붙으므로 워드마크는 그냥 보인다.
 *
 * 왜 CSS transition 이 아니라 rAF 인가
 *   "떨어진다"는 등속이 아니다. 가속해서 내려오다 바닥에서 살짝 눌리고(스쿼시)
 *   한 번 튀어 올랐다 앉는다. transition 하나로는 그 곡선이 안 나온다.
 */
(function () {
  /* 언제 다시 보여줄지
     처음에는 sessionStorage 로 "이번 세션에 한 번"이었는데, Capacitor 의
     WKWebView 는 앱을 껐다 켜도 그 저장소가 그대로 살아 있다. 그래서
     네이티브에서는 평생 한 번만 나왔다. 대신 **마지막으로 보여준 시각**을
     남기고, 그로부터 QUIET 가 지났으면 다시 보여준다. 랜딩을 오갈 때는
     반복되지 않고, 다음에 앱을 열면 다시 나온다. */
  const KEY = 'steppy:splash-at';
  // TODO(출시 전): 20 * 60 * 1000 (20분) 으로 되돌릴 것.
  //   지금은 UI 를 잡는 중이라 열 때마다 보이도록 0 으로 둔다.
  const QUIET = 0;
  const root = document.getElementById('introSplash');
  if (!root || typeof SPLASH_LETTERS === 'undefined') return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let recent = false;
  try {
    const last = Number(localStorage.getItem(KEY) || 0);
    recent = last > 0 && Date.now() - last < QUIET;
  } catch (e) { /* 사생활 모드 — 그냥 보여준다 */ }
  if (reduced || recent) { root.remove(); return; }

  const hero = document.querySelector('.intro__heading .wordmark-svg:not(.wordmark-svg--bang)');
  const bang = document.querySelector('.intro__heading .wordmark-svg--bang');
  const stage = root.querySelector('.splash__stage');
  if (!hero) { root.remove(); return; }

  document.documentElement.classList.add('is-splashing', 'is-splash-lock');
  try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* 무시 */ }

  /* ---- 타이밍 (ms) ---- */
  const TL = {
    enterStagger: 110,   // 글자가 하나씩 등장하는 간격
    enterDur: 500,       // 등장에 걸리는 시간
    // 마지막 글자가 다 나타난 뒤(110×6 + 500 = 1160ms)에도 잠깐 머물러야
    // "흩어진 배치"가 한 장면으로 읽힌다. 전에는 1160ms 보다 먼저 낙하가
    // 시작돼서 배치를 볼 새도 없이 지나갔다.
    hold: 1450,
    // 첫 글자가 떨어지기 시작해서 마지막 글자가 앉을 때까지 = 110×6 + 1330 = 1990ms
    dropStagger: 110,    // 제자리로 떨어지기 시작하는 간격
    dropDur: 1330        // 글자 하나가 낙하하는 데 걸리는 시간
  };
  const LAST = TL.hold + TL.dropStagger * (SPLASH_LETTERS.length - 1) + TL.dropDur;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /**
   * 제자리로 가는 곡선.
   *
   * 예전에는 자유낙하 곡선(앞이 t², 끝에서 한 번 튐)을 세로에 그대로 썼다.
   * 그런데 흩어진 배치를 화면 아래쪽으로 내리면서 목표가 **위**가 됐고,
   * 아래에서 위로 가는 글자가 "가속해서 떨어지다 천장에서 튕기는" 꼴이 됐다.
   *
   * 그래서 방향과 무관한 곡선으로 바꾼다 — 부드럽게 출발해 목표를 아주 살짝
   * 지나쳤다가 제자리에 앉는다(ease-out-back). 위로 가든 아래로 가든 자연스럽다.
   */
  function settle(p) {
    /* 표준 ease-out-back. 계수 두 개는 **c3 = c1 + 1** 이어야 한다 —
       그래야 t=1(=출발점)에서 1 - c3 + c1 = 0 이 된다.

       예전 식 `1 + 1.9t³ - 2.5t⁴` 는 이 조건을 안 지켰다. 출발점 값이 0 이
       아니라 0.4 여서, 낙하가 시작되는 첫 프레임에 글자가 목표 쪽으로 **40%
       를 순간이동**했다. 게다가 dP 0.2 에서 이미 94% 라 실제 낙하는 270ms 만에
       끝나고 남은 1초는 제자리 떨림이었다. 떨어지는 게 아니라 튀는 것처럼
       보이던 게 이것 때문이다. */
    const c1 = 1.1, c3 = c1 + 1;
    const t = 1 - p;
    return 1 - c3 * t * t * t + c1 * t * t;
  }
  /** 도착 순간 눌렸다 돌아온다. 실제로 **내려앉을 때만** 준다. */
  function squash(p) {
    if (p < 0.72 || p > 0.93) return 0;
    return Math.sin(((p - 0.72) / 0.21) * Math.PI) * 0.14;
  }

  /* ---- 흩어진 배치 만들기 ----
     폭을 꽉 채우면 기울어진 글자(±13°)의 모서리가 화면 밖으로 잘린다.
     양옆에 숨 쉴 자리를 남긴다. */
  const LW = Math.min(innerWidth * 0.80, 560);
  const LH = LW / SPLASH_LAYOUT_RATIO;
  stage.style.width = LW + 'px';
  stage.style.height = LH + 'px';

  const nodes = SPLASH_LETTERS.map((d, i) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#sp-' + i);
    el.appendChild(use);
    el.setAttribute('class', 'splash__letter');
    el.style.width = (d.sw * LW) + 'px';
    stage.appendChild(el);
    // 심볼의 viewBox 높이 — stroke-width 를 화면 px 로 환산할 때 필요하다
    const sym = document.getElementById('sp-' + i);
    const vbH = sym ? parseFloat(sym.getAttribute('viewBox').split(/\s+/)[3]) : 1;
    return { el, d, vbH };
  });

  let starts = [], targets = [], raf = 0, t0 = 0, done = false;
  /* 진짜 워드마크의 테두리 비율 — viewBox 1300 단위에 stroke 45 단위.
     (CSS 의 stroke-width:450 은 scale(0.1) 안쪽 좌표라 화면에서는 45다) */
  const HERO_STROKE_RATIO = 45 / 1300;
  let heroH = 0;

  /**
   * 목표는 **매 프레임 다시 잰다.**
   *
   * 한 번만 재면 그 사이에 레이아웃이 조금이라도 움직였을 때 글자가 빈자리에
   * 앉는다. 실제로 그랬다 — 스크롤 잠금이 풀리면서 폭이 줄고 제목이 4px
   * 올라갔는데, 목표는 옛 좌표 그대로였다. 읽는 건 사각형 두 개뿐이라 값싸고,
   * 프레임 맨 앞에서 한 번에 읽으므로 transform 쓰기와 엇갈리지도 않는다.
   */
  function measureTargets() {
    const hr = hero.getBoundingClientRect();
    if (!hr.width) return false;
    const br = bang && bang.getBoundingClientRect();
    heroH = hr.height;
    targets = nodes.map(({ d }) => {
      if (d.hx == null) {                       // 느낌표는 제목 끝 느낌표 자리로
        if (!br || !br.width) return null;
        return { cx: br.left + br.width / 2, cy: br.top + br.height / 2, w: br.width };
      }
      return { cx: hr.left + (d.hx + d.hw / 2) * hr.width,
               cy: hr.top + (d.hy + d.hh / 2) * hr.height,
               w: d.hw * hr.width };
    });
    return true;
  }

  /** 출발 자리는 낙하가 시작되기 전까지만 다시 잰다 — 도중에 바꾸면 글자가 튄다. */
  function measureStarts() {
    const sr = stage.getBoundingClientRect();
    starts = nodes.map(({ el, d }) => {
      const r = el.getBoundingClientRect();
      return { cx: sr.left + d.sx * LW + r.width / 2,
               cy: sr.top + d.sy * LH + r.height / 2,
               w: r.width, h: r.height };
    });
  }

  function measure() {
    if (!measureTargets()) return false;
    measureStarts();
    return true;
  }

  function unlockScroll() {
    document.documentElement.classList.remove('is-splash-lock');
  }

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    unlockScroll();
    // 떨어진 글자를 지우는 것과 진짜 워드마크를 켜는 것이 같은 프레임에 일어나야
    // 한 겹으로 이어진다. 자리가 같으니 위치는 안 튀고, 테두리만 짧게 차오른다.
    root.style.backgroundColor = 'transparent';
    document.documentElement.classList.remove('is-splashing');
    root.classList.add('is-gone');
    // 숫자 세어 올리기처럼 "화면이 드러난 다음"에 시작해야 하는 것들이 있다
    document.dispatchEvent(new CustomEvent('splash:done'));
    setTimeout(() => root.remove(), 260);
  }

  function frame(now) {
    if (!t0) t0 = now;
    const ms = now - t0;

    /* 잠금은 **낙하가 시작되기 한참 전에** 푼다. 풀리는 순간 레이아웃이 조금이라도
       움직이면 목표가 옮겨지는데, 그때 이미 착지해 있던 글자는 한 프레임에
       그만큼 순간이동한다. 등장 중(f=0)에 풀면 그 보정이 공짜다.
       스플래시는 화면 전체를 덮고 아무 데나 누르면 끝나므로, 이 시점에 잠금이
       풀려도 사용자가 랜딩을 스크롤할 수는 없다. */
    if (ms > 300) unlockScroll();

    measureTargets();
    if (ms < TL.hold) measureStarts();

    nodes.forEach(({ el }, i) => {
      const s = starts[i], tg = targets[i];
      if (!s) return;

      const ang = nodes[i].d.angle;
      const eE = easeOutCubic(clamp01((ms - i * TL.enterStagger) / TL.enterDur));
      const dP = clamp01((ms - (TL.hold + i * TL.dropStagger)) / TL.dropDur);

      if (!tg) {                                  // 갈 자리가 없으면 옅어지며 빠진다
        el.style.opacity = String(eE * (1 - dP));
      } else {
        el.style.opacity = String(eE);
      }

      // 위로 올라가는 글자는 "내려앉는" 것이 아니므로 스쿼시를 주지 않는다
      const goingDown = tg ? tg.cy > s.cy : false;
      const f = dP > 0 ? settle(dP) : 0;
      const glide = easeInOutCubic(clamp01(dP * 1.02));
      const scaleTo = tg ? tg.w / s.w : 1;

      // 등장할 때는 위에서 내려오고, 낙하가 시작되면 목표를 향해 간다
      const cx = s.cx + (tg ? (tg.cx - s.cx) * glide : 0);
      const cy = s.cy + (1 - eE) * -70 + (tg ? (tg.cy - s.cy) * f : 0);
      const sc = (0.88 + 0.12 * eE) * (1 + (scaleTo - 1) * glide);
      const sq = goingDown ? squash(dP) : 0;
      // 흩어진 배치의 기울기는 낙하하면서 0으로 풀린다
      const rot = ang * (1 - glide) + (1 - eE) * (i % 2 ? 8 : -8);

      // transform-origin 이 글자 아래(50% 100%)다 — 착지 순간 바닥을 딛고
      // 눌리게 하려고. 그래서 scale 이 아래 모서리를 기준으로 일어나고,
      // 중심을 그냥 (cx, cy) 에 두면 축소한 만큼 아래로 밀린다.
      //   변형 뒤 중심 y = ty + h - h*sy/2  →  ty = cy - h + h*sy/2
      // 가로는 기준점이 한가운데(50%)라 보정이 필요 없다.
      /* 착지 직전에 테두리가 차오른다. 글자가 작아지면서 테두리까지 같이
         줄면 진짜 워드마크와 두께가 어긋나므로, 지금 배율로 나눠 보정해
         화면에서 보이는 굵기가 늘 일정하게 한다. */
      if (tg) {
        const ramp = clamp01((dP - 0.5) / 0.38);
        const targetPx = HERO_STROKE_RATIO * heroH;
        const pxPerUnit = (s.h * sc) / nodes[i].vbH;
        el.style.strokeWidth = String((targetPx / pxPerUnit) * 10 * ramp);
      }

      const sy = sc * (1 + sq * 0.9);
      const tx = cx - s.w / 2;
      const ty = cy - s.h + (s.h * sy) / 2;
      el.style.transform =
        `translate3d(${tx}px, ${ty}px, 0)` +
        ` rotate(${rot}deg) scale(${sc * (1 - sq)}, ${sy})`;
    });

    // 낙하가 시작되면 흰 배경을 서서히 걷는다. 끝까지 흰 판을 들고 있다가
    // 한 번에 치우면 랜딩이 "튀어나오는" 것처럼 보인다. 떨어지는 동안 뒤가
    // 조금씩 비치면 글자가 그 화면 속으로 들어가는 것으로 읽힌다.
    // 제목의 steppY 자리는 비어 있다가 떨어지는 글자가 그 칸을 채운다.
    const fadeFrom = TL.hold + TL.dropDur * 0.15;
    const fadeTo = LAST - TL.dropDur * 0.12;
    const veil = 1 - easeInOutCubic(clamp01((ms - fadeFrom) / (fadeTo - fadeFrom)));
    root.style.backgroundColor = 'rgba(255,255,255,' + veil.toFixed(3) + ')';

    if (ms >= LAST + 60) return finish();
    raf = requestAnimationFrame(frame);
  }

  function boot() {
    if (!measure()) { finish(); return; }
    // 글자는 지금까지 문서 흐름에 놓여 있었다. 좌표를 다 쟀으니 화면 기준으로 띄운다.
    nodes.forEach(({ el }) => { el.style.position = 'fixed'; el.style.left = '0'; el.style.top = '0'; });
    raf = requestAnimationFrame(frame);
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else boot();

  // 기다리기 싫은 사람은 아무 데나 누르면 건너뛴다
  addEventListener('pointerdown', finish, { once: true });
  addEventListener('keydown', finish, { once: true });
})();
