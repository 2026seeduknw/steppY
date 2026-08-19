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
      ${planeLogoSvg(26)}
      <span>날개가방</span>
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

function planeLogoSvg(size = 28) {
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="15" fill="var(--sky-100)"/>
    <path d="M8.5 19.5L13 18l1.3-3.2-4-.6.9-1.7 4.3.2 2-4.3c.3-.6 1.1-.8 1.6-.4.4.3.5.9.3 1.4l-1.8 4.2 3.9 1.8-1 1.5-4.1-1.1-2.3 3.9 1.2 3-1.7.5-1.6-3.4-3.5 1.2z" fill="var(--sky-700)"/>
    <rect x="17.5" y="17.5" width="4.4" height="5.2" rx="1" transform="rotate(18 17.5 17.5)" fill="var(--amber-500)"/>
  </svg>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page) { renderAppNav(page); renderMentorFloat(); }
});
