/**
 * 광고(Google AdMob) — 본문 안 한 자리에 붙어 스크롤하면 보이는 배너 하나.
 *
 * 어디에 붙나
 *   학교 확정 전  학교 찾기(페이지 넘기기 아래) · 학점 인정/전공 매칭(목록 아래) ·
 *                 Mentor's Step(질문 목록 아래)
 *   학교 확정 후  준비하기에서 보험·항공권 항목을 펼치면 그 설명 맨 아래
 *   프리미엄 구독 중이면 어디에도 붙지 않는다("광고 없이" 혜택).
 *
 * 어떻게 본문에 붙나
 *   배너는 웹 요소가 아니라 웹뷰 위에 얹히는 네이티브 뷰다. 그래서 본문에는 빈
 *   자리(.ad-slot)만 만들고, 그 자리의 좌표를 네이티브(ios/App/App/InlineAdPlugin.swift)에
 *   넘긴다. 네이티브가 스크롤에 맞춰 배너를 같이 옮기므로 본문에 붙어 있는 것처럼
 *   보인다. 자리는 광고가 실제로 실렸을 때만 높이를 갖는다 — 광고가 없으면 빈칸도 없다.
 *
 * 화면을 옮겨도 네이티브 배너는 남는다
 *   탭 이동은 페이지를 새로 여는 것이라 이 스크립트의 상태는 사라지지만 배너 뷰는
 *   그대로다. 그래서 화면을 떠날 때 숨기고, 열릴 때마다 자리를 다시 맞춘다.
 *
 * 웹(브라우저)에서는 플러그인이 없어 아무 일도 하지 않는다.
 * 이 파일은 state.js·layout.js 뒤에 실려야 한다.
 */
const Ads = {
  /**
   * 광고 단위 ID. 지금 값은 Google이 공개한 테스트용 ID다 — 개발 중에 실제 광고를
   * 우리가 보거나 누르면 무효 트래픽으로 계정이 정지될 수 있다.
   * AdMob에서 광고 단위를 만든 뒤 실제 ID로 바꾸고, ios/App/App/Info.plist의
   * GADApplicationIdentifier(앱 ID)도 함께 바꾼다.
   */
  UNITS: { banner: 'ca-app-pub-3940256099942544/2435281174' },

  /** 학교 확정 전 — 화면(body[data-page])마다 이 요소 바로 뒤에 광고 자리를 둔다 */
  SLOT_AFTER: {
    search: '#schoolPager',
    credits: '#matchList',
    'major-matching': '#matchList',
    // 로그인 전에는 목록 대신 잠금 미리보기가 그려진다 — 그 아래에 둔다
    consult: '#mentorList, #mentorQaPanel .mentor-preview'
  },
  /** 학교 확정 후 준비하기 — 펼쳐진 항목의 설명 맨 아래에 둔다. 체크리스트의 보험·항공권, 생활 준비의 보험 */
  PREPARE_SLOT_IN: [
    '.step-item[data-id="insurance"].is-expanded .step-item__detail',
    '.step-item[data-id="flight"].is-expanded .step-item__detail',
    '.living-card[data-living="insurance"].is-expanded .living-card__detail'
  ].join(', '),
  /** 시트·모달은 화면을 덮는데 네이티브 배너는 그 위에 뜬다 — 열려 있는 동안은 숨긴다 */
  OVERLAYS: '.modal-scrim.is-open, .app-sheet.is-open, body.is-sheet-open',

  _slot: null,
  _sent: '',
  _height: 0,
  _initialized: false,

  get plugin() {
    const cap = window.Capacitor;
    if (!RELEASE.ads || !cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.InlineAd) || null;
  },

  /** 광고 자리가 들어갈 곳 — { parent, before } 또는 없으면 null. 서버 상태가 오기 전에는 정하지 않는다 */
  _place() {
    if (!AppState._hydrated || AppState.isPremium()) return null;
    const page = document.body.dataset.page;
    if (page === 'prepare') {
      const detail = document.querySelector(this.PREPARE_SLOT_IN);
      return detail ? { parent: detail, before: null } : null;
    }
    const anchor = this.SLOT_AFTER[page] && document.querySelector(this.SLOT_AFTER[page]);
    if (!anchor || AppState.getConfirmedSchool()) return null;
    return { parent: anchor.parentNode, before: anchor.nextSibling };
  },

  _init(plugin) {
    if (this._initialized) return;
    this._initialized = true;
    plugin.addListener('loaded', ({ height }) => this._setHeight(height));
    // SDK 초기화는 커뮤니티 플러그인에 맡긴다(전면·보상형을 붙일 때도 같은 플러그인을 쓴다)
    const admob = window.Capacitor.Plugins.AdMob;
    if (admob) admob.initialize({}).catch(e => console.warn('[ads]', e));
  },

  _setHeight(height) {
    this._height = height || 0;
    if (this._slot) this._fill(this._slot);
    this.sync();
  },

  /** 광고가 실렸을 때만 자리가 높이(와 위 여백)를 갖는다 */
  _fill(slot) {
    slot.style.height = this._height ? `${this._height}px` : '';
    slot.classList.toggle('is-filled', !!this._height);
  },

  _hide(plugin) {
    if (this._slot) { this._slot.remove(); this._slot = null; }
    if (this._sent !== 'hidden') { this._sent = 'hidden'; plugin.hide(); }
  },

  sync() {
    const plugin = this.plugin;
    if (!plugin) return;
    const place = this._place();
    if (!place) { this._hide(plugin); return; }

    if (!this._slot) {
      this._slot = document.createElement('div');
      this._slot.className = 'ad-slot';
      this._slot.setAttribute('aria-hidden', 'true');
      this._fill(this._slot);
    }
    if (this._slot.parentNode !== place.parent || this._slot.nextSibling !== place.before) {
      if (place.before !== this._slot) place.parent.insertBefore(this._slot, place.before);
    }

    // 자리는 남겨 두되(본문이 들썩이지 않게) 시트·모달이 열려 있는 동안 배너만 감춘다
    if (document.querySelector(this.OVERLAYS)) {
      if (this._sent !== 'hidden') { this._sent = 'hidden'; plugin.hide(); }
      return;
    }

    const rect = this._slot.getBoundingClientRect();
    const nav = document.getElementById('app-nav');
    const tabbar = document.querySelector('.tabbar');
    const args = {
      adId: this.UNITS.banner,
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      // 앱바 아래 ~ 탭바 위. 이 밖으로 나간 부분은 네이티브가 잘라낸다
      clipTop: Math.round(nav ? nav.getBoundingClientRect().bottom : 0),
      clipBottom: Math.round(tabbar ? tabbar.getBoundingClientRect().top : window.innerHeight)
    };
    if (!args.width) return;
    const key = JSON.stringify(args);
    if (key === this._sent) return;
    this._sent = key;
    this._init(plugin);
    plugin.show(args).then(res => {
      if (res && res.height && res.height !== this._height) this._setHeight(res.height);
    }).catch(e => console.warn('[ads]', e));
  },

  start() {
    const plugin = this.plugin;
    if (!plugin) return;
    this.sync();
    document.addEventListener('MOCK:updated', () => this.sync());
    window.addEventListener('pagehide', () => plugin.hide());
    // 항목을 펼치고 접는 것, 목록이 다시 그려지는 것, 시트가 열리는 것 모두 자리의 위치를 바꾼다
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; this.sync(); });
    };
    new MutationObserver(schedule).observe(document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-page']
    });
    new ResizeObserver(schedule).observe(document.body);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Ads.start());
} else {
  Ads.start();
}
