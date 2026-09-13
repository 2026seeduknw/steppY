/**
 * 앱 셸 렌더러 — 상단 앱바 + 하단 탭바.
 *
 * 웹 버전(App/responsive)의 상단 가로 내비게이션 대신, 이 브랜치는 네이티브 앱
 * 관습을 따른다: 화면 전환은 하단 탭바가 담당하고, 상단은 현재 화면의 제목과
 * 프로필만 얹는 얇은 바가 된다.
 *
 * 기존 페이지 HTML을 고치지 않기 위해 마운트 지점을 그대로 재사용한다.
 *   #app-nav      → 상단 앱바
 *   #mentor-float → 하단 탭바 (웹 버전의 플로팅 멘토 버튼 자리. 멘토는 탭이 됐다)
 * 덕분에 각 페이지 컨트롤러(js/home.js 등)와 렌더 타깃 ID는 전혀 건드리지 않는다.
 */

const TAB_ICONS = {
  home: '<path d="M3 10.6 12 3.2l9 7.4V20a1 1 0 0 1-1 1h-4.6v-5.8H8.6V21H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="6.6"/><path d="m20.4 20.4-4.1-4.1"/>',
  credits: '<path d="M6.2 2.8h8l4 4v14.4h-12z"/><path d="m9.3 13.2 1.9 1.9 3.8-3.8"/>',
  consult: '<path d="M4 5.2h16v10.4H9.4L4 19.8z"/>'
};

// 웹 버전은 상단 4개 + 플로팅 멘토였다. 앱에서는 멘토를 탭으로 끌어올렸다.
// (캘린더는 제거 — 할 일 추가는 홈/준비하기의 "오늘의 할 일" 카드로 옮겼다)
const APP_TABS = [
  { key: 'home', label: '홈', href: 'home.html' },
  { key: 'search', label: '학교 찾기', href: 'search.html' },
  { key: 'credits', label: '학점 인정', href: 'credits.html' },
  { key: 'consult', label: '멘토', href: 'consult.html' }
];

const PAGE_TITLES = {
  home: '홈',
  search: '학교 찾기',
  prepare: '교환 준비하기',
  credits: '학점 인정',
  'major-matching': '전공 매칭',
  consult: "Mentor's Step"
};

/** 학교를 확정하면 "홈" 탭의 라벨·목적지가 교환 준비하기로 통째로 바뀐다(탭은 5개 유지). */
function homeSlot() {
  const confirmed = !!AppState.getConfirmedSchool();
  return {
    href: confirmed ? 'prepare.html' : 'home.html',
    label: confirmed ? '준비하기' : '홈'
  };
}

function renderAppBar(activeKey) {
  const mount = document.getElementById('app-nav');
  if (!mount) return;
  const authed = typeof Auth !== 'undefined' && Auth.isAuthed;
  const profile = AppState.profile;
  const initial = profile.name ? profile.name.slice(-2) : '학생';
  mount.innerHTML = `
    <div class="appbar__lead">
      <img class="appbar__mark" src="assets/logo-mark-circle.png" width="26" height="26" alt="">
      <h1 class="appbar__title">${PAGE_TITLES[activeKey] || 'steppY'}</h1>
    </div>
    ${authed
      ? `<button type="button" class="appbar__avatar" id="appbarAccount" aria-haspopup="dialog" aria-label="계정">${initial}</button>`
      : `<a class="appbar__login" href="auth.html">로그인</a>`}
  `;
  const account = document.getElementById('appbarAccount');
  if (account) account.addEventListener('click', openAccountSheet);
}

/**
 * 계정 시트 — 로그인한 이메일 확인과 로그아웃.
 * 로그아웃하면 AppState가 'auth:changed'를 받아 게스트 상태로 다시 읽는다.
 */
function openAccountSheet() {
  document.querySelectorAll('.app-sheet--account').forEach(el => el.remove());

  const sheet = document.createElement('div');
  sheet.className = 'app-sheet app-sheet--account';
  sheet.innerHTML = `
    <div class="app-sheet__scrim" data-close></div>
    <div class="app-sheet__panel" role="dialog" aria-modal="true" aria-label="계정">
      <div class="app-sheet__grip" data-close></div>
      <div class="app-sheet__body">
        <div class="account-sheet">
          <p class="account-sheet__label">로그인 계정</p>
          <p class="account-sheet__email">${Auth.email || ''}</p>
          <section class="card card-pad account-sheet__profile" id="accountProfileCard"></section>
          <button type="button" class="btn btn--ghost btn--block" id="signOutBtn">로그아웃</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(sheet);

  // 기본 정보(GPA·어학·교환시기·학과) 수정은 여기서 한다. 홈 화면에서 뺐다.
  // 프로필 카드 컴포넌트를 안 불러온 화면에서는 조용히 건너뛴다.
  if (typeof renderProfileCard === 'function') {
    renderProfileCard(sheet.querySelector('#accountProfileCard'));
  } else {
    sheet.querySelector('#accountProfileCard').remove();
  }
  // 삽입 직후 바로 is-open을 주면 transition 시작 상태가 없어 슬라이드가 생략된다
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  document.body.classList.add('is-sheet-open');

  const close = () => {
    sheet.classList.remove('is-open');
    document.body.classList.remove('is-sheet-open');
    setTimeout(() => sheet.remove(), 300);
  };
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  sheet.querySelector('#signOutBtn').addEventListener('click', async () => {
    await Auth.signOut();
    close();
    location.replace('home.html');
  });
}

function renderTabBar(activeKey) {
  const mount = document.getElementById('mentor-float');
  if (!mount) return;
  const slot = homeSlot();
  mount.innerHTML = `
    <nav class="tabbar" role="navigation" aria-label="주요 화면">
      ${APP_TABS.map(tab => {
        const isHomeSlot = tab.key === 'home';
        const href = isHomeSlot ? slot.href : tab.href;
        const label = isHomeSlot ? slot.label : tab.label;
        // 교환 준비하기/전공 매칭은 각각 홈/학점 인정 탭 자리에서 열린다
        const isActive = activeKey === tab.key
          || (isHomeSlot && activeKey === 'prepare')
          || (tab.key === 'credits' && activeKey === 'major-matching');
        // 라벨은 화면에 쓰지 않는다(아이콘만). 이름은 aria-label로만 남겨
        // 스크린리더와 접근성 검사에서는 계속 읽히게 한다.
        return `
          <a class="tabbar__item${isActive ? ' is-active' : ''}" href="${href}"
             aria-label="${label}"${isActive ? ' aria-current="page"' : ''}>
            <svg class="tabbar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${TAB_ICONS[tab.key]}
            </svg>
          </a>`;
      }).join('')}
    </nav>
  `;
}

/**
 * 학교 찾기 화면의 필터 사이드바를 바텀시트로 옮긴다.
 *
 * 필터 그룹의 컨테이너 id(countryFilters 등)는 그대로 둔 채 .filter-panel 엘리먼트만
 * 통째로 이동시키므로, js/search.js는 자기 렌더 타깃이 옮겨진 걸 알 필요가 없다.
 */
function mountFilterSheet() {
  const panel = document.querySelector('.filter-panel');
  const toolbar = document.querySelector('.search-toolbar');
  if (!panel || !toolbar) return;

  const sheet = document.createElement('div');
  sheet.className = 'app-sheet';
  sheet.innerHTML = `
    <div class="app-sheet__scrim" data-close></div>
    <div class="app-sheet__panel" role="dialog" aria-modal="true" aria-label="검색 필터">
      <div class="app-sheet__grip" data-close></div>
      <div class="app-sheet__head">
        <h2>필터</h2>
        <button type="button" class="app-sheet__done" data-close>완료</button>
      </div>
      <div class="app-sheet__body"></div>
    </div>
  `;
  sheet.querySelector('.app-sheet__body').appendChild(panel);
  document.body.appendChild(sheet);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'filter-trigger';
  trigger.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4"/>
    </svg>
    <span>필터</span>`;
  toolbar.appendChild(trigger);

  const open = () => { sheet.classList.add('is-open'); document.body.classList.add('is-sheet-open'); };
  const close = () => { sheet.classList.remove('is-open'); document.body.classList.remove('is-sheet-open'); };
  trigger.addEventListener('click', open);
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (!page) return;
  // OAuth 실패는 redirectTo로 지정한 화면(home.html)으로 돌아온다. 그냥 두면
  // 아무 안내 없이 비로그인 상태의 홈이 떠서 사용자가 이유를 알 수 없다.
  Auth.init().then(() => {
    if (Auth.redirectError) {
      if (typeof showToast === 'function') showToast(Auth.message({ message: Auth.redirectError }));
      Auth.redirectError = null;
    }
  });
  renderAppBar(page);
  renderTabBar(page);
  if (page === 'search') mountFilterSheet();
});

// Supabase 응답이 도착해야 getConfirmedSchool()이 정확해진다 — 홈 탭의 목적지가
// prepare.html로 바뀌어야 하는 경우가 있어 데이터 갱신 후 탭바만 다시 그린다.
document.addEventListener('MOCK:updated', () => {
  const page = document.body.dataset.page;
  if (!page) return;

  // 아직 온보딩을 안내한 적 없는 계정이면 프로필부터 받는다.
  // needsOnboarding은 하이드레이션이 끝나야 true가 되므로, data-source.js가
  // 먼저 쏘는 MOCK:updated에는 걸리지 않는다. onboarding.html은 layout.js를
  // 불러오지 않아 순환 리다이렉트도 생기지 않는다.
  if (AppState.needsOnboarding) {
    location.replace('onboarding.html');
    return;
  }

  // 프로필 이름(아바타 이니셜)과 확정 여부(홈 탭 목적지)가 하이드레이션 후에
  // 확정되므로 앱바와 탭바를 함께 다시 그린다.
  renderAppBar(page);
  renderTabBar(page);
});

// 로그인/로그아웃 직후에는 아직 서버 상태를 못 받았어도 앱바 표시는 즉시 바꾼다.
document.addEventListener('auth:changed', () => {
  const page = document.body.dataset.page;
  if (page) renderAppBar(page);
});
