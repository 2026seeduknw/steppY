/**
 * 앱 받기 배너 — 웹으로 들어온 iPhone·iPad 사용자에게만 App Store로 가는 카드를 띄운다.
 *
 * 왜 iOS 전체인가 (Safari만이 아니라)
 *   앱은 App Store에만 올라가니 안드로이드·PC에는 보여 줄 게 없다. 반대로 iPhone에서는
 *   홍보 링크가 카카오톡·인스타그램·에타 안의 브라우저로 열리는 일이 많은데, 그 브라우저도
 *   모두 Safari와 같은 엔진(WebKit)이고 App Store로 넘어갈 수 있다. 그래서 "iOS 기기"로 가른다.
 *   (Apple의 Smart App Banner 메타 태그는 Safari에서만 떠서, 인앱 브라우저 사용자를 놓친다.
 *    이 배너와 같이 쓰면 Safari에서 배너가 두 개가 되니 붙이지 않는다.)
 *
 * 안 띄우는 경우
 *   - 앱 안(Capacitor) — 이미 앱이다
 *   - 홈 화면에 추가한 웹앱(standalone)
 *   - AppLinks.APP_STORE_URL이 아직 자리표시자일 때(…/id숫자 가 없음) — 누를 곳이 없는
 *     버튼은 두지 않는다(app_ui.md 6. 아직 안 되는 기능은 감춘다)
 *   - 닫은 뒤 7일
 *   미리 보려면 주소 뒤에 ?appbanner=1 — 기기·스토어 주소 조건을 건너뛴다.
 *
 * 이 파일은 app-links.js 뒤에 실려야 한다. 클릭은 trackEvent('app_banner_click')로 센다.
 */
(function () {
  const DISMISS_KEY = 'steppy.appBanner.dismissedAt';
  const HIDE_DAYS = 7;
  const force = /[?&]appbanner=1\b/.test(location.search);

  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) return;
  if (navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) return;
  if (typeof AppLinks === 'undefined') return;

  const ua = navigator.userAgent;
  // iPadOS는 데스크톱 Safari처럼 "Macintosh"로 자기를 소개한다 — 터치 지점 수로 가른다
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const storeReady = /\/id\d+/.test(AppLinks.APP_STORE_URL);
  if (!force && (!isIOS || !storeReady)) return;

  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    if (!force && at && Date.now() - at < HIDE_DAYS * 864e5) return;
  } catch (e) { /* 사생활 보호 모드 — 저장 못 해도 띄운다 */ }

  function track(name) {
    if (typeof trackEvent === 'function') trackEvent(name, { page: document.body.dataset.page || location.pathname });
  }

  function mount() {
    const el = document.createElement('aside');
    el.className = 'app-banner';
    el.setAttribute('aria-label', 'steppY 앱 받기');
    el.innerHTML = `
      <img class="app-banner__icon" src="assets/app-icon-120.png" alt="" width="40" height="40">
      <div class="app-banner__text">
        <strong class="app-banner__title">steppY 앱</strong>
        <span class="app-banner__sub">App Store에서 무료로 받기</span>
      </div>
      <a class="app-banner__get" href="${AppLinks.APP_STORE_URL}">받기</a>
      <button type="button" class="app-banner__close" aria-label="닫기">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>`;
    el.querySelector('.app-banner__get').addEventListener('click', () => track('app_banner_click'));
    el.querySelector('.app-banner__close').addEventListener('click', () => {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      track('app_banner_dismiss');
      el.remove();
    });
    document.body.appendChild(el);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
