/**
 * 페이지 공통 셸(상단 내비게이션 · 멘토 플로팅 버튼) 렌더러.
 * 정적 다중 페이지 데모에서 동일 마크업 반복을 피하고,
 * 디자인 피드백 반영 시 한 곳만 고치면 되도록 함.
 */
const LAYOUT_NAV_ITEMS = [
  { key: 'home', label: '홈', href: 'home.html' },
  { key: 'search', label: '학교 찾기', href: 'search.html' },
  { key: 'prepare', label: '지원 준비하기', href: 'prepare.html' },
  { key: 'credits', label: '학점 인정', href: 'credits.html' },
  { key: 'calendar', label: '캘린더', href: 'calendar.html' }
];

function renderAppNav(activeKey) {
  const mount = document.getElementById('app-nav');
  if (!mount) return;
  const profile = AppState.profile;
  const initial = profile.name ? profile.name.slice(-2) : '학생';
  mount.innerHTML = `
    <a class="app-nav__brand" href="home.html">
      <img class="logo-mark" src="assets/logo-mark-circle.png" width="26" height="26" alt="">
      <span>steppY</span>
    </a>
    <nav class="app-nav__links">
      ${LAYOUT_NAV_ITEMS.map(item => `<a href="${item.href}" class="${item.key === activeKey ? 'is-active' : ''}">${item.label}</a>`).join('')}
    </nav>
    <div class="app-nav__user">
      <span class="eyebrow tnum">D-DAY 확인 필요</span>
      <div class="app-nav__avatar">${initial}</div>
    </div>
  `;
}

function renderMentorFloat() {
  const mount = document.getElementById('mentor-float');
  if (!mount) return;
  mount.innerHTML = `
    <a class="mentor-float" href="consult.html">
      <span class="mentor-float__icon">💬</span>
      <span>
        <span class="mentor-float__label">멘토 없는 멘토 상담</span>
        <span class="mentor-float__sub">막막할 때 바로 물어보세요</span>
      </span>
    </a>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page) { renderAppNav(page); renderMentorFloat(); }
});
