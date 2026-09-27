/**
 * F6 국가별 후기.
 *
 * 학교별 후기(MOCK.schoolReviews, school_exchange_reports 문장 단위 태깅)는 이미
 * 있었지만 학교 상세 모달을 열어야만 보였다 — 어느 학교로 갈지 못 정한 사람은
 * "그 나라는 대체로 어때?"가 먼저 궁금한데 그 질문에 답하는 자리가 없었다.
 * 같은 나라 학교들의 후기를 모아, 나라 단위로 먼저 보여주고 고르면 후기
 * 목록으로 들어가게 한다.
 *
 * 국가가 32개라 한 화면에 다 늘어놓으면 훑어보기 전에 스크롤부터 하게 된다.
 * 학교 찾기 필터가 이미 나라를 대륙(region: 미주/유럽/아시아·오세아니아/기타)
 * 으로 묶어 두고 있어서(js/search.js의 uniq('region')과 같은 필드), 그 값을
 * 그대로 재사용해 대륙 → 나라 → 후기 3단으로 들어가게 했다.
 *
 * 나라 목록은 후기가 있는 나라만 추리지 않는다 — 후기가 아직 0건인 나라도
 * "여기는 아직 없구나"를 확인할 수 있어야 한다.
 */
(function () {
  AppState.load();

  const mount = document.getElementById('reviewsMount');
  if (!mount) return;

  const REGION_ICON = { '미주': '🌎', '유럽': '🌍', '아시아/오세아니아': '🌏', '기타': '🌐' };
  // 화면에는 영문 이름만 보여준다 — 나라 이름은 이미 school.countryEn이 있고,
  // 대륙은 그 값이 없어 여기서 따로 영문 라벨을 붙인다. 묶는 기준(키)은 그대로
  // 한글 필드(country/region)를 쓴다 — 학교 찾기 필터와 같은 값으로 묶여야
  // 나중에 필터 결과와 이 화면의 그룹이 어긋나지 않는다.
  const REGION_LABEL_EN = { '미주': 'Americas', '유럽': 'Europe', '아시아/오세아니아': 'Asia/Oceania', '기타': 'Other' };

  let regions = [];
  let activeRegion = null;
  let activeCountry = null;
  let activeTag = null;

  function buildRegions() {
    const countryMap = new Map();
    (MOCK.schools || []).forEach(school => {
      const key = school.country;
      if (!key) return;
      if (!countryMap.has(key)) {
        countryMap.set(key, { country: key, countryEn: school.countryEn, region: school.region || '기타', schoolIds: new Set(), reviews: [] });
      }
      const entry = countryMap.get(key);
      entry.schoolIds.add(school.id);
      const reviews = (MOCK.schoolReviews || {})[school.id];
      if (reviews && reviews.length) {
        reviews.forEach(r => entry.reviews.push({
          schoolId: school.id,
          schoolName: school.nameKo || school.name,
          tag: r.tag, author: r.author, text: r.text
        }));
      }
    });
    const countries = [...countryMap.values()]
      .map(v => ({ country: v.country, countryEn: v.countryEn, region: v.region, schoolCount: v.schoolIds.size, reviews: v.reviews }))
      .sort((a, b) => (b.reviews.length - a.reviews.length) || (a.countryEn || a.country).localeCompare(b.countryEn || b.country));

    const regionMap = new Map();
    countries.forEach(c => {
      if (!regionMap.has(c.region)) regionMap.set(c.region, { region: c.region, countries: [], countryCount: 0, schoolCount: 0, reviewCount: 0 });
      const r = regionMap.get(c.region);
      r.countries.push(c);
      r.countryCount += 1;
      r.schoolCount += c.schoolCount;
      r.reviewCount += c.reviews.length;
    });
    return [...regionMap.values()].sort((a, b) => b.schoolCount - a.schoolCount);
  }

  function countText(count, unit) { return count ? `${unit} ${count}건` : `${unit} 준비 중`; }

  function regionGridHtml() {
    if (!regions.length) return `<p class="review-empty">아직 등록된 학교가 없어요.</p>`;
    return `
      <div class="review-country-grid">
        ${regions.map(r => `
          <button type="button" class="review-country-card" data-region="${r.region}">
            <span class="review-country-card__flag">${REGION_ICON[r.region] || '🌐'}</span>
            <span class="review-country-card__name review-en">${REGION_LABEL_EN[r.region] || r.region}</span>
            <span class="review-country-card__meta">${r.countryCount}개국 · ${countText(r.reviewCount, '후기')}</span>
          </button>
        `).join('')}
      </div>`;
  }

  function countryGridHtml(region) {
    return `
      <button type="button" class="review-back" id="reviewBackToRegions">← 대륙 전체</button>
      <div class="review-detail-head">
        <span class="review-detail-head__flag">${REGION_ICON[region.region] || '🌐'}</span>
        <div>
          <h2 class="review-en">${REGION_LABEL_EN[region.region] || region.region}</h2>
          <p>${region.countryCount}개국 · ${countText(region.reviewCount, '후기')}</p>
        </div>
      </div>
      <div class="review-country-grid">
        ${region.countries.map(c => `
          <button type="button" class="review-country-card" data-country="${c.country}">
            <span class="review-country-card__flag">${countryFlag(c.countryEn) || '🌍'}</span>
            <span class="review-country-card__name review-en">${c.countryEn || c.country}</span>
            <span class="review-country-card__meta">${c.schoolCount}개 학교 · ${countText(c.reviews.length, '후기')}</span>
          </button>
        `).join('')}
      </div>`;
  }

  function countryDetailHtml(c) {
    const tags = [...new Set(c.reviews.map(r => r.tag))];
    const filtered = activeTag ? c.reviews.filter(r => r.tag === activeTag) : c.reviews;
    return `
      <button type="button" class="review-back" id="reviewBackToCountries">← <span class="review-en">${REGION_LABEL_EN[c.region] || c.region}</span> 나라 목록</button>
      <div class="review-detail-head">
        <span class="review-detail-head__flag">${countryFlag(c.countryEn) || '🌍'}</span>
        <div>
          <h2 class="review-en">${c.countryEn || c.country}</h2>
          <p>${c.schoolCount}개 학교 · ${countText(c.reviews.length, '후기')}</p>
        </div>
      </div>
      ${tags.length > 1 ? `
      <div class="chip-group review-tag-filter" role="group" aria-label="주제로 거르기">
        <button type="button" class="chip ${!activeTag ? 'is-selected' : ''}" data-tag="">전체</button>
        ${tags.map(t => `<button type="button" class="chip ${activeTag === t ? 'is-selected' : ''}" data-tag="${t}">${t}</button>`).join('')}
      </div>` : ''}
      ${filtered.length ? `
      <ul class="review-list--page">
        ${filtered.map(r => `
          <li class="review-item">
            <div class="review-item__top">
              <span class="badge badge--neutral">${r.tag}</span>
              <button type="button" class="review-item__school" data-open-school="${r.schoolId}">${r.schoolName}</button>
            </div>
            <p class="review-item__text">${r.text}</p>
            <span class="review-item__author">${r.author}</span>
          </li>`).join('')}
      </ul>` : `<p class="review-empty"><span class="review-en">${c.countryEn || c.country}</span>에는 아직 등록된 선배 후기가 없어요.</p>`}`;
  }

  function findRegion(key) { return regions.find(r => r.region === key) || null; }
  function findCountry(region, key) { return region && region.countries.find(c => c.country === key); }

  function render() {
    regions = buildRegions();
    const region = activeRegion && findRegion(activeRegion);
    if (!region) { activeRegion = null; activeCountry = null; }
    const country = region && activeCountry && findCountry(region, activeCountry);
    if (activeCountry && !country) activeCountry = null;

    mount.innerHTML = country
      ? countryDetailHtml(country)
      : region
        ? countryGridHtml(region)
        : regionGridHtml();
    wire();
  }

  function wire() {
    mount.querySelectorAll('[data-region]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeRegion = btn.dataset.region;
        activeCountry = null;
        activeTag = null;
        render();
        mount.scrollIntoView({ block: 'start' });
      });
    });
    mount.querySelectorAll('[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCountry = btn.dataset.country;
        activeTag = null;
        render();
        mount.scrollIntoView({ block: 'start' });
      });
    });
    const backToRegions = mount.querySelector('#reviewBackToRegions');
    if (backToRegions) backToRegions.addEventListener('click', () => { activeRegion = null; render(); });
    const backToCountries = mount.querySelector('#reviewBackToCountries');
    if (backToCountries) backToCountries.addEventListener('click', () => { activeCountry = null; render(); });
    mount.querySelectorAll('[data-tag]').forEach(btn => {
      btn.addEventListener('click', () => { activeTag = btn.dataset.tag || null; render(); });
    });
    mount.querySelectorAll('[data-open-school]').forEach(btn => {
      btn.addEventListener('click', () => openSchoolModal(btn.dataset.openSchool));
    });
  }

  render();
  document.addEventListener('MOCK:updated', render);
})();
