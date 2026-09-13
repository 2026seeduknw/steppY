(function () {
  AppState.load();

  // 학교를 확정한 뒤에는 홈 대시보드 대신 교환 준비하기 화면을 보여줌.
  // Supabase 연동 시 MOCK.schools가 비동기로 실 데이터로 교체되는데, 이 IIFE는
  // 그보다 먼저 동기적으로 실행돼 getConfirmedSchool()이 아직 null일 수 있음 —
  // 그래서 최초 체크 + 'MOCK:updated' 이후 재체크 두 군데서 모두 확인함
  // (consult.js의 tryPreselect()와 동일한 패턴).
  function redirectIfConfirmed() {
    if (AppState.getConfirmedSchool()) {
      morphToPreparePage();
      return true;
    }
    return false;
  }

  if (redirectIfConfirmed()) return;

  // 로그인 상태에서는 AppState가 서버에서 채워지기 전에 이 IIFE가 먼저 돌아,
  // 최초 1회는 게스트 기본값으로 그려진다. 하이드레이션이 끝나면 'MOCK:updated'가
  // 오므로 그때 아래 네 가지를 통째로 다시 그린다(renderAll).
  function renderGreeting() {
    const p = AppState.profile;
    const term = p.exchangeTerm || {};
    document.getElementById('greeting').textContent = `안녕하세요, ${p.name || '회원'}님`;
    document.getElementById('greetingSub').textContent = term.year
      ? `${term.year} ${term.season} 파견을 준비하고 있어요`
      : '교환 시기를 등록하면 준비 일정을 정리해 드려요';
  }

  function renderAll() {
    renderGreeting();
    renderProfileCard(document.getElementById('profileCard'));
    renderTodoCard(document.getElementById('todoCard'));
    renderWishlistRow();
    renderJourney();
  }

  renderAll();

  // 제휴 업체(보험/어학원/여행) 배너 — 아직 실제 제휴처가 없는 더미 CTA.
  // 클릭 수만 세어 실제 수요가 있는지 검증하는 용도라 트래킹이 핵심이다.
  document.getElementById('partnerPromoBanner').addEventListener('click', () => {
    trackEvent('partner_promo_click');
    showToast('서비스 준비중입니다. 관심 가져주셔서 감사해요 — 곧 찾아뵐게요!');
  });

  document.addEventListener('profile:updated', renderWishlistRow);
  document.addEventListener('MOCK:updated', () => {
    if (redirectIfConfirmed()) return;
    renderAll();
  });

  // 본문(위시리스트+여정+CTA배너)과 아사이드(프로필+할일)는 각자 콘텐츠양에 따라
  // 높이가 유동적임. 아사이드가 본문보다 길어지면 그 차이만큼 할일 목록에
  // max-height를 씌워 "내 스펙에 맞는 학교를 더 찾아볼까요" 배너 하단과
  // 정확히 같은 지점에서 끝나도록 맞춤(넘치는 항목은 목록 내부 스크롤로 처리).
  function syncAsideHeight() {
    const main = document.querySelector('.home-main');
    const aside = document.querySelector('.home-aside');
    const todoList = document.querySelector('#todoCard .todo-list');
    if (!main || !aside || !todoList) return;
    todoList.style.maxHeight = '';
    todoList.style.overflowY = '';
    const overflow = aside.getBoundingClientRect().height - main.getBoundingClientRect().height;
    if (overflow > 1) {
      const listHeight = todoList.getBoundingClientRect().height;
      todoList.style.maxHeight = `${Math.max(0, listHeight - overflow)}px`;
      todoList.style.overflowY = 'auto';
    }
  }

  requestAnimationFrame(syncAsideHeight);
  window.addEventListener('resize', () => requestAnimationFrame(syncAsideHeight));
  if (window.ResizeObserver) {
    const resizeSync = new ResizeObserver(() => requestAnimationFrame(syncAsideHeight));
    resizeSync.observe(document.querySelector('.home-main'));
    resizeSync.observe(document.getElementById('profileCard'));
  }

  function renderWishlistRow() {
    const wishlist = AppState.getWishlist();
    const confirmed = AppState.getConfirmedSchool();
    const mount = document.getElementById('wishlistRow');
    mount.innerHTML = [1, 2, 3].map(rank => {
      const schoolId = wishlist[rank];
      const school = schoolId ? MOCK.schools.find(s => s.id === schoolId) : null;
      if (!school) {
        return `
          <div class="wishlist-slot">
            <div class="wishlist-slot__empty">
              <div class="wishlist-slot__rank">${rank}지망</div>
              아직 선택하지 않았어요<br>
              <a href="search.html">학교 찾기 →</a>
            </div>
          </div>`;
      }
      const elig = computeEligibility(AppState.profile, school);
      return `
        <button type="button" class="wishlist-slot is-filled" data-school="${school.id}">
          <div class="wishlist-slot__rank">${rank}지망 ${confirmed && confirmed.id === school.id ? '· 확정됨' : ''}</div>
          <div>
            <div class="wishlist-slot__name">${school.name}</div>
            <div class="wishlist-slot__meta">${school.country}${school.qsRank ? ` · QS ${school.qsRank}` : ''}</div>
          </div>
          ${eligibilityBadgeHtml(elig)}
        </button>`;
    }).join('');

    mount.querySelectorAll('[data-school]').forEach(el => {
      el.addEventListener('click', () => openSchoolModal(el.dataset.school, { onChange: renderWishlistRow }));
    });

    attachCarouselDots(mount);
  }

  function renderJourney() {
    const wishlist = AppState.getWishlist();
    const hasWishlist = Object.keys(wishlist).length > 0;
    const confirmed = AppState.getConfirmedSchool();
    const steps = [
      { label: '학교 탐색', sub: '조건에 맞는 학교 비교', done: hasWishlist || AppState.load().favorites.length > 0 },
      { label: '지망 선택', sub: '1~3지망 등록', done: hasWishlist },
      { label: '학교 확정', sub: "'학교 확정' 버튼 클릭", done: !!confirmed },
      { label: '교환 준비', sub: '서류·비자·생활 준비', done: false }
    ];
    const currentIdx = steps.findIndex(s => !s.done);

    const track = document.getElementById('journeySteps');
    track.innerHTML = steps.map((s, i) => `
      <div class="journey-card ${s.done ? 'is-done' : ''} ${i === currentIdx ? 'is-current' : ''}" data-step="${i}">
        <div class="journey-card__dot">${s.done ? '✓' : i + 1}</div>
        <div class="journey-card__body">
          <div class="journey-card__label">${s.label}</div>
          <div class="journey-card__sub">${s.sub}</div>
        </div>
      </div>
    `).join('');

    const cards = [...track.querySelectorAll('.journey-card')];
    const focusStep = (idx) => cards.forEach((c, i) => c.classList.toggle('is-focused', i === idx));

    track.addEventListener('mousemove', (e) => {
      const rect = track.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const idx = Math.min(steps.length - 1, Math.max(0, Math.floor(ratio * steps.length)));
      focusStep(idx);
    });
    track.addEventListener('mouseleave', () => focusStep(currentIdx >= 0 ? currentIdx : steps.length - 1));

    attachCarouselDots(track);
  }
})();
