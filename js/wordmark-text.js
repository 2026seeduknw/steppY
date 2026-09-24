/**
 * 문장 안의 알파벳만 로고 글씨체로 바꿔 끼운다.
 *
 * 왜 이렇게 하냐
 *   로고 글씨체는 폰트 파일이 아니라 **패스 아틀라스**다(assets/wordmark-glyphs.json,
 *   tools/wordmark.py 가 만든다). 그래서 CSS font-family 로는 못 쓰고, 글자 모양을
 *   하나씩 붙여 SVG 를 만들어야 한다.
 *
 *   아틀라스에 있는 글자는 A–Z, a–z, ! 뿐이다. 한글도 물음표도 없다. 그런데 이 앱의
 *   제목은 "Weather of 미국 · Chapel Hill!" 처럼 섞여 있다. 그래서 문장을 통째로
 *   바꾸지 않고 **알파벳이 이어지는 구간만** 잘라서 SVG 로 갈아 끼우고, 한글과
 *   문장부호는 Pretendard 로 남긴다. 결과적으로 라틴 문자는 전부 로고 글씨체,
 *   한글은 전부 본문 글씨체로 갈려서 규칙이 눈에 보인다.
 *
 * 쓰는 법
 *   <h3 class="brand-head" data-wordmark>Weather of 미국 · Chapel Hill!</h3>
 *   를 그려 놓고, 그 조각을 DOM 에 붙인 뒤 paintWordmarkText(root) 를 부른다.
 *
 * 왜 자동(MutationObserver)이 아니냐
 *   이 제목이 나오는 곳은 학교 상세 모달 하나뿐이다. 화면 전체를 감시하는 것보다
 *   그린 쪽에서 한 줄 부르는 편이 언제 칠해지는지 읽힌다.
 */
(function () {
  const SRC = 'assets/wordmark-glyphs.json';

  // tools/wordmark.py 의 compose() 와 **같은 값이어야 한다**. 세로 상자를 단어마다
  // 다르게 잡지 않는 이유도 거기에 적혀 있다 — 같은 height 로 놓았을 때 STEP 과
  // step 의 글자 크기가 달라 보이지 않게 하려고 모든 단어가 한 자를 공유한다.
  const CAP = 700, ASCENT = 1000, DESCENT = 300, PAD = CAP * 0.04;

  let atlas = null;
  let loading = null;

  function loadAtlas() {
    if (atlas) return Promise.resolve(atlas);
    if (!loading) {
      loading = fetch(SRC)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
        .then(a => (atlas = a))
        .catch(() => (atlas = null));   // 못 읽으면 그냥 본문 글씨체로 남는다
    }
    return loading;
  }

  /** 한 구간을 SVG 로. 좌표 규약은 compose() 와 동일하다(베이스라인이 y=ASCENT). */
  function runSvg(run, A) {
    const G = A.glyphs;
    let x = PAD;
    const parts = [];
    for (let i = 0; i < run.length; i++) {
      const ch = run[i];
      if (ch === ' ') { x += A.space; continue; }
      if (i && run[i - 1] !== ' ') x += A.gap;
      const g = G[ch];
      parts.push(
        `<g transform="translate(${x.toFixed(2)},${(ASCENT + g.top + g.ih).toFixed(2)}) ` +
        `scale(0.1,-0.1)"><path d="${g.d}"/></g>`);
      x += g.w;
    }
    const w = (x + PAD).toFixed(2);
    return `<svg class="wm-text" viewBox="0 0 ${w} ${ASCENT + DESCENT}" ` +
           `role="img" aria-label="${run.replace(/"/g, '&quot;')}" focusable="false">` +
           `<g fill="currentColor">${parts.join('')}</g></svg>`;
  }

  /**
   * 문자열을 [글자가 있는 구간 | 나머지] 로 가른다.
   * 띄어쓰기는 구간 **안에서만** 자간으로 쓰고, 구간 양끝의 공백은 바깥 텍스트로
   * 돌려보낸다 — 한글과 붙는 쪽 간격을 본문 글씨체 기준으로 두려고.
   */
  function segments(text, G) {
    const out = [];
    let buf = '', run = '';
    const flushRun = () => { if (run) { out.push({ wm: true, s: run }); run = ''; } };
    const flushBuf = () => { if (buf) { out.push({ wm: false, s: buf }); buf = ''; } };

    for (const ch of text) {
      if (G[ch]) {
        flushBuf();
        run += ch;
      } else if (ch === ' ' && run) {
        run += ch;                     // 구간이 여기서 끝날 수도 있어 일단 담는다
      } else {
        // 구간 끝에 매달린 공백은 바깥으로
        const m = run.match(/ +$/);
        if (m) { run = run.slice(0, -m[0].length); buf += m[0]; }
        flushRun();
        buf += ch;
      }
    }
    const m = run.match(/ +$/);
    if (m) { run = run.slice(0, -m[0].length); }
    flushRun();
    if (m) buf = m[0] + buf;
    flushBuf();
    return out;
  }

  function escapeText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * 로고 글씨체로 못 쓰는 구간 중 **한글만** 따로 감싼다.
   *
   * "Cost of living, 얼마나 들까 ?" 에서 앞은 로고 글씨체 하늘색인데 한글까지
   * 하늘색이면 로고가 아니라 그냥 옅은 문장으로 읽힌다. 한글은 본문 남색으로
   * 떨어뜨려 "브랜드가 말을 걸고, 뜻은 본문이 받는" 두 층으로 나눈다.
   * 쉼표·물음표는 감싸지 않는다 — 로고 쪽 문장부호라 앞 글자와 같은 색이어야 한다.
   */
  const HANGUL = /[\uAC00-\uD7A3\u3131-\u318E]+/g;
  function withHangulSpans(s) {
    let out = '', last = 0, m;
    HANGUL.lastIndex = 0;
    while ((m = HANGUL.exec(s))) {
      out += escapeText(s.slice(last, m.index)) + '<span class="wm-ko">' + escapeText(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + escapeText(s.slice(last));
  }

  function paint(el, A) {
    const text = el.textContent;
    const segs = segments(text, A.glyphs);
    if (!segs.some(s => s.wm)) { el.dataset.wordmark = 'skip'; return; }
    el.innerHTML = segs.map(s => (s.wm ? runSvg(s.s, A) : withHangulSpans(s.s))).join('');
    el.dataset.wordmark = 'done';
    // 스크린 리더에는 원문 한 줄로 읽힌다 — 조각난 aria-label 이 겹쳐 읽히지 않게.
    el.setAttribute('aria-label', text);
  }

  /** root 안의 아직 안 칠한 [data-wordmark] 를 로고 글씨체로 바꾼다. */
  window.paintWordmarkText = function (root) {
    const scope = root || document;
    const targets = [...scope.querySelectorAll('[data-wordmark=""]')];
    if (!targets.length) return;
    loadAtlas().then(A => { if (A) targets.forEach(el => paint(el, A)); });
  };

  // 정적 HTML 에 박혀 있는 것(홈의 'Your Step !')은 알아서 칠한다.
  // 나중에 그려지는 조각은 그린 쪽에서 paintWordmarkText(mount) 를 부른다.
  const sweep = () => window.paintWordmarkText(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sweep);
  else sweep();

  // 모달이 열리는 순간 받아오면 제목이 한 번 깜빡인다. 화면이 한가할 때 미리 받아 둔다.
  const warm = () => loadAtlas();
  if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1200);
})();
