/**
 * 학교 상세 인포그래픽 모달 (F3 카드 클릭 시, F2/F4 지망·확정 카드 클릭 시 공통 사용).
 * §5 F3 "지망 선택 및 학교 확정" + §7.3 "확정 버튼은 재확인 모달 + 불이익 고지 필수" 반영.
 * 지역 패널은 OpenStreetMap 무료 임베드(iframe, API 키 불필요)를 사용합니다.
 * 날씨는 계절마다 한 줄씩, 서울 평년값과의 차이를 붙여 보여줍니다.
 */
const SEASON_ICON = { '봄학기': '🌸', '여름학기': '☀️', '가을학기': '🍁', '겨울학기': '❄️' };
const COMMERCE_LABEL = { high: '풍부', medium: '보통', low: '작음' };
const VISA_SOURCE_KIND_LABEL = {
  EMBASSY_CONSULATE_SEOUL: '주한 대사관·영사관',
  NATIONAL_IMMIGRATION_AUTHORITY: '현지 이민당국',
  KOREA_MOFA: '한국 외교부'
};

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
  scrim.innerHTML = schoolModalTemplate(school, opts);
  // 카드 제목의 알파벳을 로고 글씨체로 (js/wordmark-text.js)
  if (typeof paintWordmarkText === 'function') paintWordmarkText(scrim);
  wireModalCloseButtons(scrim);
  wireSchoolModalActions(scrim, school, opts);
  openModal(scrim);
}

/** UC 9개 캠퍼스를 한 화면에 늘어놓는 목록.
 *
 *  예전에는 검색 결과에서 카드 한 장으로 묶고 그 카드가 이 목록을 열었는데,
 *  묶어 두면 캠퍼스별 기후·물가·위치를 검색 결과에서 견줄 수가 없었다. 이제
 *  9곳이 각자 카드로 나오고, 이 목록은 UC 캠퍼스 상세 안의 버튼으로 들어온다
 *  ("UC는 한 곳만 고르는 게 아니라 9곳을 놓고 비교하는 것"이라는 맥락이
 *   필요한 자리가 거기다). */
function openUCGroupModal(onChange) {
  const campuses = MOCK.schools
    .filter(s => s.id.startsWith('university-of-california-'))
    .sort((a, b) => (a.qsRank || 9999) - (b.qsRank || 9999));
  if (!campuses.length) return;
  const scrim = ensureSchoolModalScrim();
  scrim.innerHTML = `
    <div class="modal-panel">
    <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
    <div class="uc-group-modal">
      <header class="uc-group-modal__header">
        <h2 class="school-modal__title">University of California</h2>
        <p class="info-panel__text">UC는 캠퍼스마다 위치·지원 요건·모집 인원이 달라요. 캠퍼스를 선택하면 상세 정보를 볼 수 있어요.</p>
      </header>
      <div class="uc-campus-list">
        ${campuses.map(c => `
          <button type="button" class="card card--interactive uc-campus-row" data-open-campus="${c.id}">
            ${SCHOOL_LOGOS[c.id]
              ? `<img class="uc-campus-row__logo" src="assets/school-logos/${SCHOOL_LOGOS[c.id]}" alt="${c.name}">`
              : `<span class="uc-campus-row__logo uc-campus-row__logo--fallback">${schoolInitials(c.name)}</span>`}
            <span class="uc-campus-row__body">
              <span class="uc-campus-row__name">${c.name.replace('University of California, ', '')}</span>
              <span class="uc-campus-row__meta">${c.campusCity || c.city}${c.qsRank ? ` · QS ${c.qsRank}` : ''}</span>
            </span>
          </button>
        `).join('')}
      </div>
    </div>
    </div>
  `;
  wireModalCloseButtons(scrim);
  scrim.querySelectorAll('[data-open-campus]').forEach(btn => {
    btn.addEventListener('click', () => openSchoolModal(btn.dataset.openCampus, { onChange }));
  });
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

/**
 * 모집 인원이 학교 하나가 아니라 묶음 전체에 걸린 경우.
 *
 * UC 9개 캠퍼스는 레코드가 따로지만 quota 는 전부 200 — 캠퍼스별 200명이 아니라
 * UC 전체로 200명이다. 그대로 "모집 200명"을 아홉 번 찍으면 1,800명처럼 읽힌다.
 */
const SHARED_QUOTA_GROUPS = [
  { test: (id) => id.startsWith('university-of-california-'), label: 'UC 전체' }
];

function quotaLabel(school) {
  const group = SHARED_QUOTA_GROUPS.find(g => g.test(school.id));
  return group ? `${group.label} ${school.slot}명 모집` : `모집 ${school.slot}명`;
}

/**
 * "미국 · Bellingham" — 카드 제목에 그 학교가 어디인지 바로 적는다.
 *
 * 도시 칸에 나라 이름이 그대로 들어 있는 행이 있다(홍콩은 '香港 Hong Kong',
 * 싱가포르는 'Singapore'). 그대로 이으면 "홍콩 · 香港 Hong Kong" 처럼 같은 말이
 * 두 번 나오므로, 도시가 나라 이름을 품고 있으면 나라만 남긴다.
 */
/**
 * 로고 글씨체로 조판할 지명. 아틀라스에 A–Z, a–z, ! 밖에 없어서 **아스키로 쓸 수
 * 있는 형태**만 남긴다.
 *   "香港 Hong Kong" → "Hong Kong"   (한자·영문이 같이 든 칸은 영문만)
 *   "München"       → "Munchen"     (분음 부호는 떼어 낸다 — 글자 하나만 본문
 *                                    글씨체로 튀어나오는 것보다 낫다)
 *   "臺北市"         → "Taiwan"      (남는 라틴 문자가 없으면 나라 이름으로)
 * 나라 이름(한글)을 앞에 붙이지 않는 이유는 제목 전체가 이 글씨체로 읽히게 하려고.
 */
function schoolPlaceEn(school) {
  const ascii = (school.campusCity || school.city || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // Göteborg → Goteborg
    .replace(/\([^)]*\)/g, ' ')                         // Amherst(MA) → Amherst
    .split('/')[0]                                      // Espoo/Helsinki → Espoo
    .replace(/[^A-Za-z -]/g, ' ')                       // 한자·마침표: Washington D.C. → Washington DC
    .replace(/\s+/g, ' ')
    .trim();
  // 값이 아닌 칸("N/A( , )", "(Inholland )")은 글자가 한두 개만 남는다
  return ascii.length >= 2 ? ascii : (school.countryEn || school.country || '');
}

function schoolPlaceLabel(school) {
  const country = school.country || '';
  const city = (school.city || '').trim();
  if (!city) return country || school.mapNote || '';
  if (!country) return city;

  const norm = (v) => v.toLowerCase().replace(/[\s·,]/g, '');
  const cityKey = norm(city);
  const sameAsCountry = [country, school.countryEn]
    .filter(Boolean)
    .some(c => cityKey === norm(c) || cityKey.includes(norm(c)));

  return sameAsCountry ? country : `${country} · ${city}`;
}

/**
 * 서울의 계절 평균기온 (기상청 평년값 1991~2020, 월평균을 계절로 묶어 반올림).
 * 파견교 기온을 "그래서 서울이랑 얼마나 다른데"로 바꿔 읽게 하는 기준점이다.
 * 파견교 데이터에는 한국이 없어서 이 값만 상수로 들고 있다.
 */
const SEOUL_SEASON_TEMP = { '봄학기': 12, '여름학기': 25, '가을학기': 14, '겨울학기': 0 };

/**
 * 서울의 계절 강수 — 월 평균 강수량(mm)과 비 오는 날 수.
 * 파견교와 같은 방식으로 뽑았다(Open-Meteo ERA5 2020~2024, 일 강수 1mm 이상을
 * 비 온 날로 셈). 파견교 목록에 한국이 없어서 이 값만 상수로 들고 있다.
 */
const SEOUL_SEASON_RAIN = {
  '봄학기': { mm: 80, days: 7 },
  '여름학기': { mm: 286, days: 17 },
  '가을학기': { mm: 113, days: 8 },
  '겨울학기': { mm: 26, days: 4 }
};
const SEASON_ORDER = ['봄학기', '여름학기', '가을학기', '겨울학기'];

/** "서울보다 4°C 따뜻" / "서울과 비슷" */
function seoulDeltaLabel(season, temp) {
  const base = SEOUL_SEASON_TEMP[season];
  if (base == null || typeof temp !== 'number') return '';
  const d = Math.round(temp - base);
  if (Math.abs(d) <= 1) return '서울과 비슷';
  return `서울보다 ${Math.abs(d)}°C ${d > 0 ? '따뜻' : '추움'}`;
}

/**
 * ② 날씨 — 계절마다 한 줄.
 *
 * 예전에는 학교 로고를 가운데 두고 계절 두 개만 칩으로 띄우는 궤도형
 * 인포그래픽이었다. 자리를 크게 먹으면서 정작 네 계절 중 둘만 보였고, 숫자를
 * 견줄 기준도 없어서 "평균 14°C"가 더운 건지 추운 건지 알 수 없었다.
 * 네 계절을 한 줄씩 세우고 서울과의 차이를 옆에 붙인다.
 *
 * 파견 시기를 등록한 사람에게는 그 계절 줄을 강조한다 — 실제로 가서 겪을
 * 날씨가 그 한 줄이다. (나머지도 지우지 않는다. 학기가 바뀌거나 여행을 가면
 * 다른 계절도 겪는다)
 */
function climatePanelHtml(school) {
  const temps = school.climateTemps || {};
  const rain = school.climatePrecip || {};
  const seasons = SEASON_ORDER.filter(s => typeof temps[s] === 'number');
  const term = (AppState.profile && AppState.profile.exchangeTerm) || {};
  const mySeason = term.season || null;

  if (!seasons.length) {
    return `
      <section class="info-panel info-panel--wide climate-panel">
        <h3 class="brand-head" data-wordmark="">Weather of ${schoolPlaceEn(school)} !</h3>
        <p class="info-panel__text">이 학교의 계절별 기온 자료가 아직 없어요.</p>
      </section>`;
  }

  const rows = seasons.map(season => {
    const t = temps[season];
    const r = rain[season];
    const mine = season === mySeason;
    return `
      <li class="climate-row${mine ? ' is-term' : ''}">
        <span class="climate-row__season">${SEASON_ICON[season] || '🌤️'} ${season.replace('학기', '')}</span>
        <span class="climate-row__temp tnum">${t}°C</span>
        <span class="climate-row__meta">
          <span class="climate-row__delta">${seoulDeltaLabel(season, t)}</span>
          ${r ? `<span class="climate-row__rain">☔ <strong class="tnum">${r.days}일</strong> · ${r.mm}mm</span>` : ''}
        </span>
      </li>`;
  }).join('');

  // 계절마다 "서울은 며칠"을 붙이면 같은 말이 네 번 반복된다 — 아래 한 줄로 모은다.
  const hasRain = seasons.some(s => rain[s]);
  const seoulRain = hasRain
    ? `<p class="climate-caption">☔ 는 한 달에 비 오는 날 수예요. 서울은 ${SEASON_ORDER
        .map(s => `${s.replace('학기', '')} ${SEOUL_SEASON_RAIN[s].days}일`)
        .join(' · ')}.</p>`
    : '';

  // '봄 서울보다 2도 따뜻' / '봄 서울과 비슷' 처럼 한 계절짜리 비교문이면 위 줄들과
  // 같은 말이다. 그런 형태가 아닐 때(편차가 크다는 주석 등)만 남긴다.
  const note = school.koreaComparison && !/서울(보다|과)/.test(school.koreaComparison)
    ? `<p class="info-panel__text info-panel__note">${school.koreaComparison}</p>` : '';
  const climateNote = school.climateNotes
    ? `<p class="info-panel__text info-panel__note">${school.climateNotes}</p>` : '';

  return `
    <section class="info-panel info-panel--wide climate-panel">
      <h3 class="brand-head" data-wordmark="">Weather of ${schoolPlaceEn(school)} !</h3>
      <ul class="climate-list">${rows}</ul>
      ${seoulRain}
      <p class="climate-caption">${mySeason && seasons.includes(mySeason)
        ? `표시된 <strong>${mySeason.replace('학기', '')}</strong>이 내 파견 시기예요 · `
        : ''}기온은 서울 평년값(기상청 1991~2020), 강수는 Open-Meteo 2020~2024 기준</p>
      ${climateNote}
      ${note}
    </section>`;
}

const HOUSING_BADGE = {
  Yes: { cls: 'badge--go', label: '기숙사 보장' },
  Partial: { cls: 'badge--amber', label: '기숙사 부분 보장' },
  No: { cls: 'badge--warn', label: '기숙사 미보장' }
};

/** 어학 자격증(TOEFL 외)·기숙사 보장 여부 — 기존 배지 줄 바로 아래에 별도 줄로 보여준다.
 * 둘 다 원본 데이터가 없는 학교가 많아(어학 62/271, 기숙사 103/271), 값이 있을 때만 렌더링. */
function extraInfoBadgesHtml(school) {
  const badges = [];
  if (!school.langTest.cut && school.langTest.level) {
    badges.push(`<span class="badge badge--neutral" title="${school.langTest.notes || ''}">${school.langTest.level} 이상</span>`);
  }
  const housing = HOUSING_BADGE[school.housing.guaranteed];
  if (housing) {
    badges.push(`<span class="badge ${housing.cls}" title="${school.housing.info || ''}">${housing.label}</span>`);
  }
  return badges.length ? `<div class="school-modal__badges school-modal__badges--extra">${badges.join('')}</div>` : '';
}

/** 통화 환산 팁. MENTAL_FX_RATES(js/currency-rates.js, 암산용 반올림 환율)로
 *  "1 통화 ≈ 대략 얼마원"을 보여준다. 특정 금액이 있으면(예: 기숙사비) 그 금액에
 *  곱한 예시까지 함께 보여주고, 없으면(② 날씨·생활 정보처럼 일반 안내용) 짧게 한 줄만. */
function mentalRateShortTipHtml(currency) {
  const rate = typeof MENTAL_FX_RATES !== 'undefined' ? MENTAL_FX_RATES[currency] : null;
  if (!rate) return '';
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  return `<p class="orbit-card__line" style="color:var(--ink-500);font-size:var(--fs-micro);">💡 이 학교 통화(${currency})는 ${rate.mentalUnit} ${currency} ≈ 대략 ${fmt(rate.mentalKrw)}원이에요.</p>`;
}

/** 기숙사비·월 생활비 안내 (⑤). schools.dorm_semester_avg_krw/monthly_living_cost_krw —
 *  둘 다 원본 없는 학교가 있어(기숙사비 187/271, 생활비 268/271) 있는 값만 보여준다. */
function mentalRateTipHtml(local, currency) {
  const rate = typeof MENTAL_FX_RATES !== 'undefined' ? MENTAL_FX_RATES[currency] : null;
  if (!rate || local == null) return '';
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  const approx = mentalToKrw(local, currency);
  return `<p class="info-panel__text" style="color:var(--ink-500);font-size:var(--fs-micro);">💡 환산 팁 — ${rate.mentalUnit} ${currency} ≈ 대략 ${fmt(rate.mentalKrw)}원이니, ${fmt(local)} ${currency} × ${fmt(rate.mentalKrw)}/${rate.mentalUnit} ≈ 약 ${fmt(approx)}원으로 어림잡을 수 있어요.</p>`;
}

function livingCostPanelHtml(school) {
  const dorm = school.housing.dormCost;
  const monthly = school.monthlyLivingCostKrw;
  if (!dorm && monthly == null) return '';
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  return `
    <section class="info-panel info-panel--wide">
      <h3 class="brand-head" data-wordmark="">Cost of living, 얼마나 들까 ?</h3>
      ${dorm ? `<p class="info-panel__text">기숙사비(학기당) — <strong class="tnum">${fmt(dorm.krw)}원</strong>${dorm.local != null && dorm.currency ? ` (현지 통화 ${fmt(dorm.local)} ${dorm.currency})` : ''}${dorm.confidence === 'LOW' ? ' <span class="badge badge--amber">추정치</span>' : ''}</p>` : ''}
      ${dorm ? mentalRateTipHtml(dorm.local, dorm.currency) : ''}
      ${monthly != null ? `<p class="info-panel__text">월 평균 생활비 — <strong class="tnum">${fmt(monthly)}원</strong></p>` : ''}
      <p class="info-panel__text" style="color:var(--ink-500);font-size:var(--fs-micro);">자동으로 모은 추정치예요. 여행을 얼마나 다니는지 같은 개인차에 따라 달라질 수 있어요</p>
    </section>`;
}

function schoolModalTemplate(school, opts = {}) {
  const profile = AppState.profile;
  const elig = computeEligibility(profile, school);
  const isFav = AppState.isFavorite(school.id);
  const wishlist = AppState.getWishlist();
  const myRank = Object.keys(wishlist).find(r => wishlist[r] === school.id);
  const confirmed = AppState.getConfirmedSchool();

  return `
    <div class="modal-panel">
    <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
    <button class="fav-btn school-modal__fav ${isFav ? 'is-active' : ''}" data-fav-toggle aria-label="즐겨찾기">
      <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.2C.5 7.8 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.5 3.8 4 7.3-2.5 4.6-10 9.2-10 9.2z"/></svg>
    </button>
    <div class="school-modal">
      <header class="school-modal__header">
        <div>
          <!-- 오른쪽 위 두 버튼(닫기·찜하기)이 차지하는 자리. 제목 첫 줄만
               이만큼 비켜 가고 둘째 줄부터는 폭을 다 쓴다 — 예전에는 헤더
               전체에 오른쪽 여백을 줘서 긴 학교 이름이 석 줄로 접혔다. -->
          <span class="school-modal__btnspace" aria-hidden="true"></span>
          <h2 class="school-modal__title">${school.name}</h2>
          <div class="school-modal__badges">
            ${eligibilityBadgeHtml(elig)}
            <span class="badge badge--neutral">${quotaLabel(school)}</span>
            <span class="badge badge--amber">GPA ${school.gpaCut}↑</span>
            ${typeof school.langTest.cut === 'number' ? `<span class="badge badge--amber">${school.langTest.type} ${school.langTest.cut}↑</span>` : ''}
          </div>
          ${extraInfoBadgesHtml(school)}
        </div>
      </header>

      ${SHARED_QUOTA_GROUPS.some(g => g.test(school.id)) ? `
      <button type="button" class="uc-siblings-link" id="ucSiblingsBtn">
        UC 9개 캠퍼스 한눈에 보기 →
      </button>` : ''}

      <section class="info-panel info-panel--map">
        <div class="map-embed">
          <iframe src="${mapEmbedUrl(school)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${school.name} 지도"></iframe>
        </div>
      </section>

      ${climatePanelHtml(school)}

      ${scoreCardHtml(school)}

      <div class="school-modal__grid">
        ${livingCostPanelHtml(school)}
      </div>

      <!-- 카드로 감쌀 만한 내용이 아니다. 링크 한 줄이라 한 줄로 둔다. -->
      <p class="school-modal__official">
        국제처 링크
        <a href="${school.officialLink}" target="_blank" rel="noopener">${school.officialLink.replace(/^https?:\/\//, '')} ↗</a>
      </p>

      ${AppState.isAuthed ? `
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
      </footer>` : `
      ${GUEST_MODAL_FOOTER}`}
    </div>
    </div>
  `;
}

function confirmWarningTemplate(school, overwriting) {
  return `
    <div class="confirm-warning">
      <p class="confirm-warning__title">⚠️ 학교 확정 전 꼭 확인하세요</p>
      <ul>
        ${overwriting ? `<li><strong>${overwriting.name}</strong>로 되어 있던 기존 확정이 <strong>${school.name}</strong>(으)로 바뀌어요.</li>` : ''}
        <li>배정이 확정되면 파견대학은 원칙적으로 바꿀 수 없어요. (§7.3)</li>
        <li>기한 안에는 취소할 수 있지만, 취소하면 패널티와 함께 <strong>앞으로 국제처 해외파견프로그램에 영원히 다시 지원할 수 없어요</strong>.</li>
      </ul>
      <div class="confirm-warning__actions">
        <button class="btn btn--ghost btn--sm" id="cancelConfirmBtn">다시 생각해볼게요</button>
        <button class="btn btn--accent btn--sm" id="finalConfirmBtn">내용 확인했어요, 확정할게요</button>
      </div>
    </div>
  `;
}

function wireSchoolModalActions(scrim, school, opts) {
  // UC 캠퍼스끼리 오가는 길. 모집 인원이 9곳에 걸쳐 하나라서, 한 곳만 보고
  // 정하기보다 9곳을 늘어놓고 견주는 편이 맞는 화면이다.
  const ucBtn = scrim.querySelector('#ucSiblingsBtn');
  if (ucBtn) ucBtn.addEventListener('click', () => openUCGroupModal(opts.onChange));

  scrim.querySelector('[data-fav-toggle]').addEventListener('click', (e) => {
    if (!AppState.isAuthed) {
      e.stopPropagation();
      if (typeof showToast === 'function') showToast('로그인하면 즐겨찾기를 저장할 수 있어요');
      return;
    }
    const active = AppState.toggleFavorite(school.id);
    e.currentTarget.classList.toggle('is-active', active);
    showToast(active ? '즐겨찾기에 추가했어요' : '즐겨찾기를 해제했어요');
    trackEvent('wishlist_toggle', { schoolId: school.id, active });
    if (opts.onChange) opts.onChange();
  });

  // 게스트 푸터에는 지망 칩도 확정 버튼도 없다 — 배선할 게 없으므로 건너뛴다
  if (!AppState.isAuthed) return;

  scrim.querySelectorAll('.rank-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const rank = btn.dataset.rank;
      const already = btn.classList.contains('is-selected');
      scrim.querySelectorAll('.rank-chip').forEach(b => b.classList.remove('is-selected'));
      AppState.setWishlistRank(rank, already ? null : school.id);
      if (!already) { btn.classList.add('is-selected'); showToast(`${rank}지망으로 등록했어요`); trackEvent('wishlist_rank_select', { schoolId: school.id, rank }); }
      else { showToast('지망 등록을 취소했어요'); }
      if (opts.onChange) opts.onChange();
    });
  });

  const confirmBtn = scrim.querySelector('#confirmSchoolBtn');
  confirmBtn.addEventListener('click', () => {
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
      trackEvent('school_confirm', { schoolId: school.id });
      closeModal(scrim);
      if (opts.onChange) opts.onChange();
      morphToPreparePage();
    });
  });
}

/** 로그인 전에는 저장할 계정이 없다. 지망·확정 대신 로그인 안내를 둔다. */
const GUEST_MODAL_FOOTER = `<footer class="school-modal__footer school-modal__footer--guest" id="modalFooter">
    <div class="guest-cta">
      <p class="guest-cta__text">로그인하면 이 학교를 <strong>1~3지망으로 담고 확정</strong>할 수 있어요</p>
      <a class="btn btn--primary btn--block" href="auth.html">로그인하고 담기</a>
    </div>
  </footer>`;

function schoolModalFooterOnly(school) {
  if (!AppState.isAuthed) return GUEST_MODAL_FOOTER;
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
