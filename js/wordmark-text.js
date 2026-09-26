/**
 * 문장 안의 알파벳만 로고 글꼴(SB 어그로 볼드 + 키 컬러, css/components.css의
 * .wm-text)로 바꿔 끼운다.
 *
 * 왜 이렇게 하냐
 *   이 앱의 제목은 "Weather of 미국 · Chapel Hill!" 처럼 한글과 섞여 있다.
 *   문장을 통째로 바꾸지 않고 **라틴 문자가 이어지는 구간만** 잘라 감싸고,
 *   한글과 나머지 문장부호는 본문 글씨체로 남긴다. 결과적으로 라틴 문자는
 *   전부 로고 색, 한글은 전부 본문 남색으로 갈려서 규칙이 눈에 보인다.
 *
 * 쓰는 법
 *   <h3 class="brand-head" data-wordmark>Weather of 미국 · Chapel Hill!</h3>
 *   를 그려 놓고, 그 조각을 DOM 에 붙인 뒤 paintWordmarkText(root) 를 부른다.
 *
 * 왜 자동(MutationObserver)이 아니냐
 *   이 제목이 나오는 곳은 몇 군데뿐이다. 화면 전체를 감시하는 것보다
 *   그린 쪽에서 한 줄 부르는 편이 언제 칠해지는지 읽힌다.
 */
(function () {
  // 로고 색을 입힐 문자 — A–Z, a–z, ! (원래 패스 아틀라스에 있던 범위와 같다).
  // ?·쉼표 등은 감싸지 않는다 — "로고 쪽 문장부호"라 앞 글자와 같은 색이어야
  // 하는데, 부모(.brand-head)의 기본 색이 이미 그 값이라 감싸지 않아도 맞는다.
  const LATIN = /[A-Za-z!]/;

  function escapeText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * 문자열을 [로고 색 구간 | 나머지] 로 가른다.
   * 띄어쓰기는 구간 **안에서만** 자간으로 쓰고, 구간 양끝의 공백은 바깥 텍스트로
   * 돌려보낸다 — 한글과 붙는 쪽 간격을 본문 글씨체 기준으로 두려고.
   */
  function segments(text) {
    const out = [];
    let buf = '', run = '';
    const flushRun = () => { if (run) { out.push({ wm: true, s: run }); run = ''; } };
    const flushBuf = () => { if (buf) { out.push({ wm: false, s: buf }); buf = ''; } };

    for (const ch of text) {
      if (LATIN.test(ch)) {
        flushBuf();
        run += ch;
      } else if (ch === ' ' && run) {
        run += ch;                     // 구간이 여기서 끝날 수도 있어 일단 담는다
      } else {
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

  /**
   * 로고 색을 못 받는 구간 중 **한글만** 따로 감싼다.
   *
   * "Cost of living, 얼마나 들까 ?" 에서 앞은 로고 색인데 한글까지 로고 색이면
   * 로고가 아니라 그냥 옅은 문장으로 읽힌다. 한글은 본문 남색으로 떨어뜨려
   * "브랜드가 말을 걸고, 뜻은 본문이 받는" 두 층으로 나눈다.
   */
  const HANGUL = /[가-힣ㄱ-ㆎ]+/g;
  function withHangulSpans(s) {
    let out = '', last = 0, m;
    HANGUL.lastIndex = 0;
    while ((m = HANGUL.exec(s))) {
      out += escapeText(s.slice(last, m.index)) + '<span class="wm-ko">' + escapeText(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + escapeText(s.slice(last));
  }

  function paint(el) {
    const text = el.textContent;
    const segs = segments(text);
    if (!segs.some(s => s.wm)) { el.dataset.wordmark = 'skip'; return; }
    el.innerHTML = segs
      .map(s => (s.wm ? `<span class="wm-text">${escapeText(s.s)}</span>` : withHangulSpans(s.s)))
      .join('');
    el.dataset.wordmark = 'done';
    // 스크린 리더에는 원문 한 줄로 읽힌다 — 조각난 aria-label 이 겹쳐 읽히지 않게.
    el.setAttribute('aria-label', text);
  }

  /** root 안의 아직 안 칠한 [data-wordmark] 를 로고 색으로 바꾼다. */
  window.paintWordmarkText = function (root) {
    const scope = root || document;
    scope.querySelectorAll('[data-wordmark=""]').forEach(paint);
  };

  // 정적 HTML 에 박혀 있는 것(홈의 'Your Step !')은 알아서 칠한다.
  // 나중에 그려지는 조각은 그린 쪽에서 paintWordmarkText(mount) 를 부른다.
  const sweep = () => window.paintWordmarkText(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sweep);
  else sweep();
})();
