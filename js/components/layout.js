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
  calendar: '<rect x="3.6" y="5.4" width="16.8" height="15.2" rx="1.6"/><path d="M3.6 10.2h16.8M8.2 3v4M15.8 3v4"/>',
  consult: '<path d="M4 5.2h16v10.4H9.4L4 19.8z"/>'
};

// 웹 버전은 상단 4개 + 플로팅 멘토였다. 앱에서는 멘토까지 5개 탭으로 합친다.
// (탭바는 5개가 상한선 — 그 이상은 터치 타깃이 44px 아래로 떨어진다)
const APP_TABS = [
  { key: 'home', label: '홈', href: 'home.html' },
  { key: 'search', label: '학교 찾기', href: 'search.html' },
  { key: 'credits', label: '학점 인정', href: 'credits.html' },
  { key: 'calendar', label: '캘린더', href: 'calendar.html' },
  { key: 'consult', label: '멘토', href: 'consult.html' }
];

const PAGE_TITLES = {
  home: '홈',
  search: '학교 찾기',
  prepare: '교환 준비하기',
  credits: '학점 인정',
  'major-matching': '전공 매칭',
  calendar: '캘린더',
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
  const profile = AppState.profile;
  const initial = profile.name ? profile.name.slice(-2) : '학생';
  mount.innerHTML = `
    <div class="appbar__lead">
      <img class="appbar__mark" src="assets/logo-mark-circle.png" width="26" height="26" alt="">
      <h1 class="appbar__title">${PAGE_TITLES[activeKey] || 'steppY'}</h1>
    </div>
    <div class="appbar__avatar">${initial}</div>
  `;
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
        return `
          <a class="tabbar__item${isActive ? ' is-active' : ''}" href="${href}"${isActive ? ' aria-current="page"' : ''}>
            <svg class="tabbar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${TAB_ICONS[tab.key]}
            </svg>
            <span class="tabbar__label">${label}</span>
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
  renderAppBar(page);
  renderTabBar(page);
  if (page === 'search') mountFilterSheet();
});

// Supabase 응답이 도착해야 getConfirmedSchool()이 정확해진다 — 홈 탭의 목적지가
// prepare.html로 바뀌어야 하는 경우가 있어 데이터 갱신 후 탭바만 다시 그린다.
document.addEventListener('MOCK:updated', () => {
  const page = document.body.dataset.page;
  if (page) renderTabBar(page);
});
