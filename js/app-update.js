/**
 * 업데이트 안내 — 앱(iOS)이 https://mysteppy.com/app-version.json 을 읽어
 * 지금 버전이 낮으면 App Store로 보낸다.
 *
 * app-version.json (저장소 루트, Vercel 배포로 바뀐다 — 앱 심사 없이)
 *   minimum   이보다 낮으면 "업데이트가 필요해요" — 닫을 수 없다. 옛 앱이 서버 변경으로
 *             깨질 때만 올린다
 *   latest    이보다 낮으면 "새 버전이 나왔어요" — 나중에를 누르면 그 버전은 다시 묻지 않는다
 *   store_url 비워 두면 AppLinks.APP_STORE_URL. 이미 깔린 옛 앱의 주소를 바꿀 길은 이것뿐이다
 *
 * 버전은 Xcode의 MARKETING_VERSION(예: 1.0, 1.0.1, 1.1)과 같은 형식으로 쓴다.
 *
 * 앱 안에서만 동작한다(웹은 늘 최신이다). 파일은 한 시간에 한 번만 받아 오고,
 * 못 받으면(오프라인) 마지막으로 받은 값으로 판단한다 — 처음부터 못 받았으면 아무것도 안 한다.
 * 미리 보기: 주소 뒤에 ?appupdate=force 또는 ?appupdate=soft (웹에서도 뜬다)
 *
 * 이 파일은 app-links.js 뒤에 실려야 한다.
 */
(function () {
  const CACHE_KEY = 'steppy.appVersion';
  const SKIP_KEY = 'steppy.appVersion.skipped';
  const MAX_AGE = 60 * 60 * 1000;
  const preview = (location.search.match(/[?&]appupdate=(force|soft)\b/) || [])[1];

  const cap = window.Capacitor;
  const native = cap && cap.isNativePlatform && cap.isNativePlatform();
  if (!native && !preview) return;
  if (typeof AppLinks === 'undefined') return;

  /** '1.0.2' vs '1.1' → 음수·0·양수 */
  function compare(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch (e) { return null; }
  }

  async function loadConfig() {
    const cached = readCache();
    if (cached && Date.now() - cached.at < MAX_AGE) return cached.data;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${AppLinks.INVITE_BASE}/app-version.json`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) {}
      return data;
    } catch (e) {
      return cached ? cached.data : null;
    }
  }

  async function currentVersion() {
    const App = cap && cap.Plugins && cap.Plugins.App;
    if (!App || !App.getInfo) return null;
    try { return (await App.getInfo()).version; } catch (e) { return null; }
  }

  function show({ force, storeUrl, latest }) {
    if (document.querySelector('.app-update')) return;
    const el = document.createElement('div');
    el.className = 'app-update';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'appUpdateTitle');
    el.innerHTML = `
      <div class="app-update__panel">
        <img class="app-update__icon" src="assets/app-icon-120.png" alt="" width="56" height="56">
        <h2 class="app-update__title" id="appUpdateTitle">${force ? '업데이트가 필요해요' : '새 버전이 나왔어요'}</h2>
        <p class="app-update__body">${force
          ? '지금 버전으로는 steppY를 계속 쓸 수 없어요.<br>App Store에서 새 버전을 받아 주세요.'
          : 'App Store에서 새 버전을 받을 수 있어요.'}</p>
        <a class="btn btn--primary btn--block app-update__go" href="${storeUrl}">업데이트</a>
        ${force ? '' : '<button type="button" class="app-update__later">나중에</button>'}
      </div>`;
    el.querySelector('.app-update__go').addEventListener('click', () => {
      if (typeof trackEvent === 'function') trackEvent('app_update_click', { force });
    });
    const later = el.querySelector('.app-update__later');
    if (later) later.addEventListener('click', () => {
      try { localStorage.setItem(SKIP_KEY, latest); } catch (e) {}
      el.remove();
    });
    document.body.appendChild(el);
  }

  async function run() {
    if (preview) {
      show({ force: preview === 'force', storeUrl: AppLinks.APP_STORE_URL, latest: '0' });
      return;
    }
    const [config, version] = await Promise.all([loadConfig(), currentVersion()]);
    if (!config || !version) return;
    const storeUrl = config.store_url || AppLinks.APP_STORE_URL;
    if (config.minimum && compare(version, config.minimum) < 0) {
      show({ force: true, storeUrl, latest: config.latest });
      return;
    }
    if (config.latest && compare(version, config.latest) < 0) {
      let skipped = null;
      try { skipped = localStorage.getItem(SKIP_KEY); } catch (e) {}
      if (skipped !== config.latest) show({ force: false, storeUrl, latest: config.latest });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
