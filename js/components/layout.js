/**
 * 페이지 공통 셸(상단 내비게이션 · 멘토 플로팅 버튼) 렌더러.
 * 정적 다중 페이지 데모에서 동일 마크업 반복을 피하고,
 * 디자인 피드백 반영 시 한 곳만 고치면 되도록 함.
 */
// "prepare" 항목은 별도로 두지 않고, 확정 여부에 따라 "home" 항목의 라벨·href가
// 그 자리에서 통째로 바뀜(홈 4개 ↔ 교환 준비하기 4개, 절대 5개로 늘어나지 않음)
const LAYOUT_NAV_ITEMS = [
  { key: 'home', label: '홈', href: 'home.html' },
  { key: 'search', label: '학교 찾기', href: 'search.html' },
  { key: 'credits', label: '학점 인정', href: 'credits.html' },
  { key: 'calendar', label: '캘린더', href: 'calendar.html' }
];

function renderAppNav(activeKey) {
  const mount = document.getElementById('app-nav');
  if (!mount) return;
  const profile = AppState.profile;
  const initial = profile.name ? profile.name.slice(-2) : '학생';
  // 학교를 확정하면 "홈"의 역할과 라벨을 교환 준비하기(prepare.html)가 대신함
  const confirmed = !!AppState.getConfirmedSchool();
  const homeHref = confirmed ? 'prepare.html' : 'home.html';
  const homeLabel = confirmed ? '교환 준비하기' : '홈';
  mount.innerHTML = `
    <a class="app-nav__brand" href="${homeHref}">
      <img class="logo-mark" src="assets/logo-mark-circle.png" width="26" height="26" alt="">
      <span>steppY</span>
    </a>
    <nav class="app-nav__links">
      ${LAYOUT_NAV_ITEMS.map(item => {
        const isHomeSlot = item.key === 'home';
        const href = isHomeSlot ? homeHref : item.href;
        const label = isHomeSlot ? homeLabel : item.label;
        const isActive = activeKey === item.key || (isHomeSlot && activeKey === 'prepare');
        return `<a href="${href}" class="${isActive ? 'is-active' : ''}">${label}</a>`;
      }).join('')}
    </nav>
    <div class="app-nav__user">
      
      <div class="app-nav__avatar">${initial}</div>
    </div>
  `;
}

function renderMentorFloat() {
  const mount = document.getElementById('mentor-float');
  if (!mount) return;
  mount.innerHTML = `
    <a class="mentor-float" href="consult.html">
      <span class="mentor-float__icon">🐾</span>
      <span>
        <span class="mentor-float__label">Mentor's Step</span>
        <span class="mentor-float__sub">막막할 때 바로 물어보세요</span>
      </span>
    </a>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page) { renderAppNav(page); renderMentorFloat(); }
});

// Supabase 연동 시 MOCK.schools가 비동기로 실 데이터로 교체된 뒤에야
// getConfirmedSchool()이 정확한 값을 반환할 수 있어, "홈" 링크(prepare.html
// 전환 여부)가 최초 렌더 시점엔 틀렸을 수 있음 — 데이터 갱신 후 다시 그림.
document.addEventListener('MOCK:updated', () => {
  const page = document.body.dataset.page;
  if (page) renderAppNav(page);
});
