/**
 * 학교 상세 인포그래픽 모달 (F3 카드 클릭 시, F2/F4 지망·확정 카드 클릭 시 공통 사용).
 * §5 F3 "지망 선택 및 학교 확정" + §7.3 "확정 버튼은 재확인 모달 + 불이익 고지 필수" 반영.
 * 지역 패널은 OpenStreetMap 무료 임베드(iframe, API 키 불필요)를 사용합니다.
 * 날씨 · 생활 정보(후기)는 학교 이니셜을 중심에 둔 하나의 궤도형 인포그래픽으로 묶어 표현합니다.
 */
const ORBIT_POS = { tl: { x: 14, y: 12 }, tr: { x: 86, y: 12 }, bl: { x: 16, y: 88 }, br: { x: 84, y: 88 } };
const ORBIT_ORDER = ['tl', 'tr', 'bl', 'br'];
const SEASON_ICON = { '봄학기': '🌸', '여름학기': '☀️', '가을학기': '🍁', '겨울학기': '❄️' };
const COMMERCE_LABEL = { high: '풍부', medium: '보통', low: '작음' };

function ensureSchoolModalScrim() {
  let scrim = document.getElementById('schoolModalScrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.id = 'schoolModalScrim';
    scrim.className = 'modal-scrim';
    document.body.appendChild(scrim);
    scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(scrim); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && scrim.classList.contains('is-open')) closeModal(scrim); });
  }
  return scrim;
}

function openSchoolModal(schoolId, opts = {}) {
  const school = MOCK.schools.find(s => s.id === schoolId);
  if (!school) return;
  const scrim = ensureSchoolModalScrim();
  scrim.innerHTML = schoolModalTemplate(school);
  wireModalCloseButtons(scrim);
  wireSchoolModalActions(scrim, school, opts);
  openModal(scrim);
}

/** "National University of Singapore" → "NUS" 처럼 관사/전치사를 제외한 이니셜 생성 */
function schoolInitials(name) {
  const stop = new Set(['of', 'the', 'and', '&']);
  const parts = name.split(/\s+/).filter(w => !stop.has(w.toLowerCase()));
  return parts.map(w => w[0]).join('').slice(0, 4).toUpperCase();
}

function mapEmbedUrl(school) {
  const dx = 0.035, dy = 0.024;
  const bbox = [school.lng - dx, school.lat - dy, school.lng + dx, school.lat + dy].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${school.lat}%2C${school.lng}`;
}

function orbitCardHtml({ title, initials, chips, body }) {
  const lines = chips.map(c => {
    const p = ORBIT_POS[c.pos];
    return `<line x1="50" y1="46" x2="${p.x}" y2="${p.y}" />`;
  }).join('');
  const chipsHtml = chips.map(c => `
    <div class="orbit-chip orbit-chip--${c.pos}">
      <span class="orbit-chip__icon">${c.icon}</span>
      <span class="orbit-chip__text"><span class="orbit-chip__label">${c.label}</span><strong class="orbit-chip__value">${c.value}</strong></span>
    </div>`).join('');
  return `
    <div class="orbit-card orbit-card--wide">
      <div class="orbit-stage">
        <svg class="orbit-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        ${chipsHtml}
        <div class="orbit-card__center">
          <span class="orbit-ring orbit-ring--outer"></span>
          <span class="orbit-ring orbit-ring--inner"></span>
          <span class="orbit-avatar">${initials}</span>
        </div>
      </div>
      <div class="orbit-card__content">
        <h3 class="orbit-card__title">${title}</h3>
        <div class="orbit-card__desc">${body}</div>
      </div>
    </div>`;
}

/** 날씨 + 치안 + 생활 정보(후기)를 한 인포그래픽으로 묶어서 렌더링 */
function lifeOrbitCard(school, initials) {
  const seasonEntries = Object.entries(school.climate);
  const chipDefs = seasonEntries.slice(0, 2).map(([season, text]) => ({
    icon: SEASON_ICON[season] || '🌤️',
    label: season.replace('학기', ''),
    value: text.split(/[,.]/)[0]
  }));
  chipDefs.push({ icon: '🚉', label: '상권', value: COMMERCE_LABEL[school.commerceLevel] || '보통' });
  const chips = chipDefs.slice(0, 4).map((c, i) => Object.assign({ pos: ORBIT_ORDER[i] }, c));

  const weatherLine = seasonEntries.map(([season, text]) => `<strong>${season}</strong> — ${text}`).join(' · ');
  const body = `
    <p class="orbit-card__line"><strong>날씨</strong> — ${weatherLine}</p>
    <p class="orbit-card__line"><strong>생활 정보 (후기)</strong></p>
    <ul class="review-list">${school.reviews.map(r => `<li>${r}</li>`).join('')}</ul>
    <a class="btn--text" href="consult.html?school=${school.id}">멘토 없는 멘토 상담에서 더 물어보기 →</a>
  `;
  return orbitCardHtml({ title: '② 날씨 · 생활 정보', initials, chips, body });
}

function schoolModalTemplate(school) {
  const profile = AppState.profile;
  const elig = computeEligibility(profile, school);
  const isFav = AppState.isFavorite(school.id);
  const wishlist = AppState.getWishlist();
  const myRank = Object.keys(wishlist).find(r => wishlist[r] === school.id);
  const confirmed = AppState.getConfirmedSchool();
  const initials = schoolInitials(school.name);

  return `
    <div class="modal-panel">
    <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
    <div class="school-modal">
      <header class="school-modal__header">
        <div>
          <p class="eyebrow">${school.country} · ${school.city}${school.qsRank ? ` · QS ${school.qsRank}` : ''}</p>
          <h2 class="school-modal__title">${school.name}</h2>
          <div class="school-modal__badges">
            ${eligibilityBadgeHtml(elig)}
            <span class="badge badge--neutral">모집 ${school.slot}명</span>
            <span class="badge badge--amber">GPA ${school.gpaCut}↑</span>
            ${typeof school.langTest.cut === 'number' ? `<span class="badge badge--amber">${school.langTest.type} ${school.langTest.cut}↑</span>` : ''}
          </div>
        </div>
        <button class="fav-btn ${isFav ? 'is-active' : ''}" data-fav-toggle aria-label="즐겨찾기">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.2C.5 7.8 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.5 3.8 4 7.3-2.5 4.6-10 9.2-10 9.2z"/></svg>
        </button>
      </header>

      <section class="info-panel info-panel--map">
        <h3>① 지역</h3>
        <div class="map-embed">
          <iframe src="${mapEmbedUrl(school)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${school.name} 지도"></iframe>
        </div>
        <p class="map-caption">${school.mapNote}</p>
      </section>

      ${lifeOrbitCard(school, initials)}

      ${scoreCardHtml(school)}

      <div class="school-modal__grid">
        <section class="info-panel info-panel--wide">
          <h3>④ 학점 인정 추천 과목</h3>
          <div class="tag-row">${school.creditRecommend.map(c => `<span class="chip">${c}</span>`).join('')}</div>
        </section>

        <section class="info-panel">
          <h3>⑤ 지망 통계</h3>
          <p class="info-panel__text">1지망으로 <strong class="tnum">${school.wishlistCount.rank1}명</strong>이 선택했어요</p>
          <p class="info-panel__text">1~3지망 합계 <strong class="tnum">${school.wishlistCount.total}명</strong>이 선택했어요</p>
        </section>

        <section class="info-panel">
          <h3>⑥ 공식 링크</h3>
          <a class="btn--text" href="${school.officialLink}" target="_blank" rel="noopener">${school.officialLink.replace('https://', '')} ↗</a>
        </section>
      </div>

      <footer class="school-modal__footer" id="modalFooter">
        <div class="school-modal__rank">
          <span class="school-modal__rank-label">지망 순위</span>
          <div class="chip-group" role="group" aria-label="지망 순위 선택">
            ${[1, 2, 3].map(r => `<button type="button" class="chip rank-chip ${String(myRank) === String(r) ? 'is-selected' : ''}" data-rank="${r}">${r}지망</button>`).join('')}
          </div>
        </div>
        <button class="btn btn--primary" id="confirmSchoolBtn">
          ${confirmed && confirmed.id === school.id ? '확정된 학교예요 ✓' : '이 학교로 확정하기'}
        </button>
      </footer>
    </div>
    </div>
  `;
}

function confirmWarningTemplate(school, overwriting) {
  return `
    <div class="confirm-warning">
      <p class="confirm-warning__title">⚠️ 학교 확정 전 꼭 확인하세요</p>
      <ul>
        ${overwriting ? `<li><strong>${overwriting.name}</strong>로 되어 있던 기존 확정이 <strong>${school.name}</strong>(으)로 덮어써져요.</li>` : ''}
        <li>배정 확정 이후 파견대학 변경은 원칙적으로 불가해요. (§7.3)</li>
        <li>정해진 기한 내 취소는 가능하지만, 취소 시 패널티와 함께 <strong>향후 모든 국제처 해외파견프로그램 영구 재지원 불가</strong> 조치가 따라요.</li>
      </ul>
      <div class="confirm-warning__actions">
        <button class="btn btn--ghost btn--sm" id="cancelConfirmBtn">다시 생각해볼게요</button>
        <button class="btn btn--accent btn--sm" id="finalConfirmBtn">내용 확인했어요, 확정합니다</button>
      </div>
    </div>
  `;
}

function wireSchoolModalActions(scrim, school, opts) {
  scrim.querySelector('[data-fav-toggle]').addEventListener('click', (e) => {
    const active = AppState.toggleFavorite(school.id);
    e.currentTarget.classList.toggle('is-active', active);
    showToast(active ? '즐겨찾기에 추가했어요' : '즐겨찾기를 해제했어요');
    if (opts.onChange) opts.onChange();
  });

  scrim.querySelectorAll('.rank-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const rank = btn.dataset.rank;
      const already = btn.classList.contains('is-selected');
      scrim.querySelectorAll('.rank-chip').forEach(b => b.classList.remove('is-selected'));
      AppState.setWishlistRank(rank, already ? null : school.id);
      if (!already) { btn.classList.add('is-selected'); showToast(`${rank}지망으로 등록했어요`); }
      else { showToast('지망 등록을 취소했어요'); }
      if (opts.onChange) opts.onChange();
    });
  });

  const confirmBtn = scrim.querySelector('#confirmSchoolBtn');
  confirmBtn.addEventListener('click', () => {
    if (!AppState.isLoggedIn()) { openAuthModal('학교를 확정하려면 로그인이 필요해요'); return; }
    const confirmed = AppState.getConfirmedSchool();
    if (confirmed && confirmed.id === school.id) { showToast('이미 확정된 학교예요'); return; }
    const footer = scrim.querySelector('#modalFooter');
    footer.outerHTML = `<footer class="school-modal__footer school-modal__footer--warning" id="modalFooter">${confirmWarningTemplate(school, confirmed)}</footer>`;
    scrim.querySelector('#cancelConfirmBtn').addEventListener('click', () => {
      scrim.querySelector('#modalFooter').outerHTML = schoolModalFooterOnly(school);
      wireSchoolModalActions(scrim, school, opts);
    });
    scrim.querySelector('#finalConfirmBtn').addEventListener('click', () => {
      AppState.confirmSchool(school.id);
      closeModal(scrim);
      if (opts.onChange) opts.onChange();
      morphToPreparePage();
    });
  });
}

function schoolModalFooterOnly(school) {
  const wishlist = AppState.getWishlist();
  const myRank = Object.keys(wishlist).find(r => wishlist[r] === school.id);
  const confirmed = AppState.getConfirmedSchool();
  return `<footer class="school-modal__footer" id="modalFooter">
    <div class="school-modal__rank">
      <span class="school-modal__rank-label">지망 순위</span>
      <div class="chip-group" role="group" aria-label="지망 순위 선택">
        ${[1, 2, 3].map(r => `<button type="button" class="chip rank-chip ${String(myRank) === String(r) ? 'is-selected' : ''}" data-rank="${r}">${r}지망</button>`).join('')}
      </div>
    </div>
    <button class="btn btn--primary" id="confirmSchoolBtn">${confirmed && confirmed.id === school.id ? '확정된 학교예요 ✓' : '이 학교로 확정하기'}</button>
  </footer>`;
}
