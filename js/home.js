(function () {
  AppState.load();

  document.getElementById('greeting').textContent = `안녕하세요, ${AppState.profile.name}님`;
  document.getElementById('greetingSub').textContent =
    `${AppState.profile.exchangeTerm.year} ${AppState.profile.exchangeTerm.season} 파견을 준비하고 있어요`;

  renderProfileCard(document.getElementById('profileCard'));
  renderTodoCard(document.getElementById('todoCard'));
  renderWishlistRow();
  renderJourney();

  document.addEventListener('profile:updated', renderWishlistRow);
  document.addEventListener('MOCK:updated', () => { renderWishlistRow(); renderJourney(); });

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
  }

  function renderJourney() {
    const wishlist = AppState.getWishlist();
    const hasWishlist = Object.keys(wishlist).length > 0;
    const confirmed = AppState.getConfirmedSchool();
    const steps = [
      { label: '학교 탐색', sub: '조건에 맞는 학교 비교', done: hasWishlist || AppState.load().favorites.length > 0 },
      { label: '지망 선택', sub: '1~3지망 등록', done: hasWishlist },
      { label: '학교 확정', sub: "'학교 확정' 버튼 클릭", done: !!confirmed },
      { label: '지원 준비', sub: '서류·비자·생활 준비', done: false }
    ];
    const currentIdx = steps.findIndex(s => !s.done);
    document.getElementById('journeySteps').innerHTML = steps.map((s, i) => `
      <div class="journey-step ${s.done ? 'is-done' : ''} ${i === currentIdx ? 'is-current' : ''}">
        <div class="journey-step__dot">${s.done ? '✓' : i + 1}</div>
        <div><div class="journey-step__label">${s.label}</div><div class="journey-step__sub">${s.sub}</div></div>
      </div>
    `).join('');
  }
})();
