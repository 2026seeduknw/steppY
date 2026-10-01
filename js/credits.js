/**
 * F5. 학점 인정 — "학점인정 과목 찾기"(course_matches) / "전공 매칭 찾기"(major_matches)
 * 두 모드를 한 페이지에서 토글로 전환한다. 예전엔 전공 매칭이 major-matching.html이라는
 * 별도 페이지였는데, 홈 배너 자리를 다른 용도로 바꾸면서 이 페이지 안의 모드 버튼으로
 * 진입하도록 옮겼다(major-matching.html 자체는 그대로 남아있음).
 */
(function () {
  AppState.load();
  let selectedMajor = AppState.profile.major;
  // 확정 학교에서 신청한 전공(현지 학과명). 연세 전공과는 다른 값이라 따로 둔다.
  let selectedTargetMajor = AppState.profile.targetMajor || '';
  let selectedCountry = '';   // '' = 전체
  let selectedRegion = '';    // '' = 전체 대륙. 국가를 안 골라도 이 값만으로 거를 수 있다.
  let selectedRelevance = '';  // '' = 전체 | 'high' | 'mid' | 'low'
  let mode = 'course'; // 'course' | 'major'

  // Mentor's Step(js/consult.js)와 같은 대륙 묶음 — 국가가 많아(최대 30여 개) 한 줄에
  // 다 늘어놓으면 칩이 너무 많아 보인다. 대륙으로 먼저 좁히고, 그 안에서 국가를 고른다.
  const REGION_ICON = { '미주': '🌎', '유럽': '🌍', '아시아/오세아니아': '🌏', '기타': '🌐' };
  // 칩 글자는 영어로 보여준다 — data-region 값(필터링 키)은 그대로 한글이다.
  const REGION_LABEL_EN = { '미주': 'Americas', '유럽': 'Europe', '아시아/오세아니아': 'Asia/Oceania', '기타': 'Other' };

  function renderMajorFilter() {
    const mount = document.getElementById('majorFilterMount');
    mount.innerHTML = '';
    const items = MOCK.yonseiMajors.map(m => ({ value: m.majorName, label: m.majorName, group: m.college }));
    const select = createSearchableSelect({
      items,
      selected: selectedMajor,
      multiple: false,
      placeholder: '전공 검색',
      onChange: (value) => { selectedMajor = value; renderMatches(); }
    });
    mount.appendChild(select.el);
  }

  /** 홈에서 고른 신청 전공의 과목만 남긴다. 여기서는 고르지 않고 읽기만 한다. */
  function byTargetMajor(matches) {
    if (!selectedTargetMajor) return matches;
    return matches.filter(m => (m.matchedTopics || []).includes(selectedTargetMajor));
  }

  /**
   * course_matches.note는 DB에 완성된 문장으로 저장돼 있고, 원본 단위 표기가
   * 숫자에 붙어 있다("6.0credit points", "3.0units", "6.0ECTS").
   * 화면에서만 떼어 읽는다 — 원본 데이터는 건드리지 않는다.
   *
   * '학점:' 구간에만 적용한다. 과목코드에는 "204B" 같은 표기가 있을 수 있어
   * 문장 전체에 숫자-문자 규칙을 걸면 엉뚱한 곳이 벌어진다.
   */
  function formatNote(note) {
    if (!note) return '';
    return note.split(' · ')
      // "관련도: 보통"은 이제 카드 우측 상단 배지가 말한다. 한 카드에서 두 번
      // 말하면 둘이 어긋났을 때 어느 쪽이 맞는지 알 수 없다.
      .filter(part => !part.startsWith('관련도:'))
      .map(part => part.startsWith('학점:') ? part.replace(/(\d)([A-Za-z])/g, '$1 $2') : part)
      .join(' · ');
  }

  // 이 카드 저 카드 다 이 길이를 넘어가면 카드 하나가 화면 두어 개 높이를 먹는다 —
  // 짧은 note는 그대로, 긴 note만 두 줄로 접고 "더보기"를 붙인다.
  const NOTE_CLAMP_THRESHOLD = 90;
  function noteBlock(text) {
    if (!text) return '';
    const isLong = text.length > NOTE_CLAMP_THRESHOLD;
    return `
      <div class="match-card__note${isLong ? ' is-clamped' : ''}">${text}</div>
      ${isLong ? '<button type="button" class="match-card__note-toggle" data-note-toggle>더보기</button>' : ''}`;
  }

  function schoolDisplay(schoolId) {
    const school = MOCK.schools.find(s => s.id === schoolId);
    return {
      // 학교 상세를 열 수 있는지. 매칭 데이터에만 있고 schools 에는 없는 id가
      // 섞여 있어서, 없는 학교 카드를 눌리게 해두면 아무 일도 안 일어난다.
      exists: !!school,
      name: school ? (school.nameKo || school.name) : schoolId,
      country: school ? school.country : '',
      countryEn: school ? school.countryEn : '',
      logo: SCHOOL_LOGOS[schoolId]
    };
  }

  /**
   * 매칭 카드 클릭 — 예전엔 카드 아무 데나 눌러도 학교가 열렸는데, 그러면 전공/주제
   * 칩을 누르려다 학교가 열리는 일이 잦았다. 이제 학교 상세는 학교 이름(로고+이름) 줄만
   * 열고, 주제 칩은 "전공 매칭 찾기" 쪽의 같은 학교·같은 전공 카드로 건너뛴다.
   * 목록이 자주 다시 그려지므로 위임.
   */
  function wireMatchCardTaps() {
    const list = document.getElementById('matchList');
    if (!list || list.dataset.tapWired) return;
    list.dataset.tapWired = 'true';
    list.addEventListener('click', (e) => {
      // note는 카드 원본 데이터(course_matches.note)가 단위 환산까지 설명하는
      // 완성된 문장이라 길다 — 카드를 다 채우지 않도록 접어 두고 눌러서 편다.
      const toggle = e.target.closest('[data-note-toggle]');
      if (toggle) {
        e.stopPropagation();
        const note = toggle.previousElementSibling;
        const clamped = note.classList.toggle('is-clamped');
        toggle.textContent = clamped ? '더보기' : '접기';
        return;
      }
      const unlock = e.target.closest('[data-unlock]');
      if (unlock) { unlockMore(unlock); return; }
      const chip = e.target.closest('[data-topic-jump]');
      if (chip) {
        e.stopPropagation();
        const schoolId = chip.closest('.match-card').dataset.school;
        jumpToMajorMatch(schoolId, chip.textContent.trim());
        return;
      }
      const school = e.target.closest('[data-open-school]');
      if (!school) return;
      openSchoolModal(school.dataset.openSchool, { onChange: renderMatches });
    });
  }

  /**
   * 전공 미선택 안내 — 토스트(화면 아래, 2.2초 뒤 자동으로 사라짐)로는 "로그인하고
   * 전공부터 채워야 한다"는 다음 행동까지 안내하기 좁고, 읽기 전에 사라질 수도
   * 있다. 화면 가운데 뜨는 작은 팝업으로 바꾸고, 유저가 직접 닫거나(✕/바깥 클릭/ESC —
   * wireModalDismiss) 로그인 화면으로 넘어갈 수 있게 한다.
   */
  function showMajorNeededPopup() {
    let scrim = document.getElementById('majorNeededScrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'majorNeededScrim';
      scrim.className = 'modal-scrim';
      document.body.appendChild(scrim);
      scrim.innerHTML = `
        <div class="modal-panel major-needed-popup">
          <button type="button" class="modal-close" data-modal-close aria-label="닫기">✕</button>
          <p class="major-needed-popup__text">먼저 내 전공을 선택하면 전공 매칭 카드로 바로 갈 수 있어요.</p>
          <a class="major-needed-popup__login" href="auth.html">로그인하기 →</a>
        </div>`;
      wireModalDismiss(scrim);
    }
    openModal(scrim);
  }

  /** 과목 카드의 주제 칩 → "전공 매칭 찾기"의 같은 학교·같은 전공(주제) 카드로 이동. */
  function jumpToMajorMatch(schoolId, topic) {
    trackEvent('credits_topic_jump', { school: schoolId, topic });
    if (mode !== 'major') { mode = 'major'; applyModeUI(); }
    // 이전 탭에서 걸어둔 국가/관련도 필터가 이 학교를 걸러내면 카드를 못 찾은 것처럼
    // 보인다 — 건너뛸 땐 "이 학교의 이 전공"이 최우선이라 필터를 푼다.
    selectedCountry = ''; selectedRegion = ''; selectedRelevance = '';
    renderMatches();
    if (!selectedMajor) { showMajorNeededPopup(); return; }
    const target = MOCK.majorMatches.find(m => m.school === schoolId && m.homeMajor === selectedMajor &&
      ((m.matchedTopics || []).includes(topic) || m.targetMajor === topic));
    if (!target) { showToast('연결된 전공 매칭 카드를 찾지 못했어요.'); return; }
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-match-id="${CSS.escape(String(target.id))}"]`);
      if (!el) {
        // 필터는 풀었으니 안 보이면 잠긴 뒤쪽에 있는 카드다 — 잠금 줄로 데려간다
        const lock = document.querySelector('.match-lock');
        if (lock) {
          lock.scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast('그 카드는 잠긴 목록 안에 있어요 · 크레딧으로 더 볼 수 있어요');
        }
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('is-jumped');
      setTimeout(() => el.classList.remove('is-jumped'), 1600);
    });
  }

  /** 카드에 붙는 국가 태그(국기 + 한글 국가명). 국가를 모르면 아무것도 안 만든다. */
  function countryTag(school) {
    if (!school.country) return '';
    const flag = countryFlag(school.countryEn);
    return `<span class="match-card__country">${flag ? flag + ' ' : ''}${school.country}</span>`;
  }

  /**
   * 관련도 상/중/하.
   *
   * course_matches.note에 "관련도: 높음/보통/낮음"이 문장으로 들어 있는데, 그 구간이
   * similarity와 정확히 맞물린다(높음 80~84 · 보통 75~80 · 낮음 71~75).
   * 문장을 파싱하는 대신 similarity로 나눈다 — major_matches에는 그 문장이 아예
   * 없어서(전부 null), 같은 기준을 쓰려면 숫자로 가는 수밖에 없다.
   */
  const RELEVANCE_BANDS = [
    { key: 'high', label: '상', test: v => v >= 80 },
    { key: 'mid', label: '중', test: v => v >= 75 && v < 80 },
    { key: 'low', label: '하', test: v => v < 75 }
  ];

  function bandOf(similarity) {
    const band = RELEVANCE_BANDS.find(b => b.test(similarity));
    return band ? band.key : '';
  }

  /**
   * 카드 우측 상단의 관련도 배지. 예전에 퍼센티지가 있던 자리다.
   * 위쪽 필터 칩과 같은 bandOf()를 쓰므로 "상"으로 거른 목록에 "중" 카드가
   * 섞이는 일이 생기지 않는다.
   */
  function relevanceBadge(similarity) {
    const band = RELEVANCE_BANDS.find(b => b.test(similarity));
    if (!band) return '';
    return `<span class="match-card__relevance match-card__relevance--${band.key}"
                  title="관련도 ${band.label}">${band.label}</span>`;
  }

  function renderRelevanceFilter(matches) {
    const mount = document.getElementById('relevanceFilterMount');
    if (!mount) return;

    // 상/중/하는 익숙한 고정 척도라 항상 같은 자리에 둔다. 결과가 없는 구간은
    // 숨기지 않고 흐리게 잠근다 — 칩이 사라졌다 나타나면 어디 갔나 찾게 된다.
    const counts = RELEVANCE_BANDS.map(b => matches.filter(m => b.test(m.similarity)).length);
    if (selectedRelevance) {
      const idx = RELEVANCE_BANDS.findIndex(b => b.key === selectedRelevance);
      if (idx >= 0 && counts[idx] === 0) selectedRelevance = '';
    }

    mount.innerHTML = `
      <div class="relevance-filter" role="group" aria-label="관련도 필터">
        <span class="relevance-filter__label">관련도</span>
        <button type="button" class="chip${selectedRelevance === '' ? ' is-selected' : ''}" data-relevance="">전체</button>
        ${RELEVANCE_BANDS.map((b, i) => `
          <button type="button" class="chip${selectedRelevance === b.key ? ' is-selected' : ''}"
                  data-relevance="${b.key}" ${counts[i] ? '' : 'disabled'}
                  title="${counts[i]}건">${b.label}</button>`).join('')}
      </div>`;

    mount.querySelectorAll('[data-relevance]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRelevance = btn.dataset.relevance;
        trackEvent('credits_relevance_filter', { band: selectedRelevance || 'all', mode });
        renderMatches();
      });
    });
  }

  function byRelevance(matches) {
    if (!selectedRelevance) return matches;
    return matches.filter(m => bandOf(m.similarity) === selectedRelevance);
  }

  /**
   * 국가 필터.
   *
   * 후보는 고정 목록이 아니라 "지금 이 모드·전공에서 실제로 결과가 있는 국가"로
   * 만든다. 271개교 전체 국가를 늘어놓으면 골라도 결과가 0건인 선택지가 대부분이
   * 되기 때문이다. 그래서 국가 필터를 적용하기 "전"의 목록에서 국가를 뽑는다.
   */
  function countryOptions(matches) {
    const seen = new Map();
    matches.forEach(m => {
      const school = schoolDisplay(m.school);
      if (school.country && !seen.has(school.country)) seen.set(school.country, school.countryEn);
    });
    return [...seen.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
      // country는 필터링 키(schoolDisplay().country와 맞춰야 해서 한글 그대로),
      // 칩에 보이는 글자는 countryEn(영어 국가명) — 둘을 분리해 값은 안 건드리고 표시만 바꾼다.
      .map(([country, en]) => ({ country, countryEn: en || country, flag: countryFlag(en) }));
  }

  /** 국가 한글명 → 대륙. MOCK.schools에서 같은 국가명을 쓰는 아무 학교나 찾아 그 region을 읽는다. */
  function regionOf(countryKo) {
    const school = MOCK.schools.find(s => s.country === countryKo);
    return (school && school.region) || '기타';
  }

  /** 국가 목록을 대륙별로 묶는다. 대륙 칩 자체도 "이 대륙 전체"로 고를 수 있어야 해서
   *  국가 수까지 같이 들고 있는다(칩에 몇 개국인지 보여주려는 게 아니라, 이 대륙만으로도
   *  결과가 있다는 걸 렌더 전에 확인하기 위해서다). */
  function regionOptions(options) {
    const map = new Map();
    options.forEach(o => {
      const region = regionOf(o.country);
      if (!map.has(region)) map.set(region, []);
      map.get(region).push(o);
    });
    return [...map.entries()]
      .map(([region, countries]) => ({ region, countries }))
      .sort((a, b) => b.countries.length - a.countries.length);
  }

  function renderCountryFilter(matches) {
    const mount = document.getElementById('countryFilterMount');
    if (!mount) return;
    const options = countryOptions(matches);

    // 고를 수 있는 국가가 하나뿐이면 필터가 하는 일이 없다
    if (options.length < 2) { mount.innerHTML = ''; return; }

    const regions = regionOptions(options);
    // 전공을 바꿔서 지금 고른 국가/대륙에 결과가 없어지면 선택을 푼다
    if (selectedCountry && !options.some(o => o.country === selectedCountry)) selectedCountry = '';
    if (selectedRegion && !regions.some(r => r.region === selectedRegion)) { selectedRegion = ''; selectedCountry = ''; }

    // 대륙이 하나뿐이면(예: 결과가 전부 유럽) 대륙 줄도 필터가 할 일이 없다 — 국가 줄만 보여준다
    const showRegionRow = regions.length > 1;
    const activeRegion = regions.find(r => r.region === selectedRegion);
    const subOptions = activeRegion ? activeRegion.countries : (showRegionRow ? null : options);

    mount.innerHTML = `
      ${showRegionRow ? `
      <div class="country-filter" role="group" aria-label="대륙 필터">
        <button type="button" class="chip${selectedRegion === '' ? ' is-selected' : ''}" data-region="">All</button>
        ${regions.map(r => `
          <button type="button" class="chip${selectedRegion === r.region ? ' is-selected' : ''}" data-region="${r.region}">
            ${REGION_ICON[r.region] || '🌐'} ${REGION_LABEL_EN[r.region] || r.region}
          </button>`).join('')}
      </div>` : ''}
      ${subOptions ? `
      <div class="country-filter country-filter--sub" role="group" aria-label="국가 필터">
        <button type="button" class="chip chip--sm${selectedCountry === '' ? ' is-selected' : ''}" data-country="">${activeRegion ? `All ${REGION_LABEL_EN[activeRegion.region] || activeRegion.region}` : 'All'}</button>
        ${subOptions.map(o => `
          <button type="button" class="chip chip--sm${selectedCountry === o.country ? ' is-selected' : ''}" data-country="${o.country}">
            ${o.flag ? o.flag + ' ' : ''}${o.countryEn}
          </button>`).join('')}
      </div>` : ''}`;

    // 대륙 칩 — 누르면 그 대륙 전체로 거르는 동시에 밑에 국가 줄이 열린다. 이미 열려 있는
    // 대륙을 다시 누르면 전체로 되돌아간다(Americas만 보고 싶은 사람도, 다시 접고 싶은
    // 사람도 있을 수 있어서 한 번 더 누르면 닫히게 했다).
    mount.querySelectorAll('[data-region]').forEach(btn => {
      btn.addEventListener('click', () => {
        const region = btn.dataset.region;
        selectedRegion = (selectedRegion === region) ? '' : region;
        selectedCountry = '';
        trackEvent('credits_region_filter', { region: selectedRegion || 'all', mode });
        renderMatches();
      });
    });
    mount.querySelectorAll('[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCountry = btn.dataset.country;
        trackEvent('credits_country_filter', { country: selectedCountry || 'all', mode });
        renderMatches();
      });
    });
  }

  function byCountry(matches) {
    if (selectedCountry) return matches.filter(m => schoolDisplay(m.school).country === selectedCountry);
    if (selectedRegion) return matches.filter(m => regionOf(schoolDisplay(m.school).country) === selectedRegion);
    return matches;
  }

  /** targetCourse 원본 문자열 끝에 "(대학명)"이 그대로 붙어 있고, 이게 실제 캠퍼스명과
   * 다를 때가 있다(예: "First Year Korean (University of California)"인데 실제로는
   * UC Santa Barbara). 아래에서 정확한 학교명을 따로 보여주므로 중복/부정확한 접미사는 뗀다. */
  function stripSchoolSuffix(courseName) {
    return courseName.replace(/\s*\([^)]*\)\s*$/, '');
  }

  /* ------------------------------------------------ 처음 3개 무료, 나머지는 크레딧으로
     목록 키는 "어떤 목록인가"만 담는다(모드 · 연세 전공 · 확정 학교 · 신청 전공).
     국가·관련도 필터는 같은 목록을 거르는 것이라 키에 넣지 않는다 — 한 번 푼
     목록은 필터를 바꿔도 풀린 채로 남는다. 서버 쪽은 supabase/bm_unlocks.sql. */
  function matchListKey() {
    const school = AppState.getConfirmedSchool();
    return [mode, selectedMajor || '-', school ? school.id : '-', mode === 'course' ? (selectedTargetMajor || '-') : '-'].join('|');
  }

  function lockRowHtml(hiddenCount) {
    const cta = AppState.isAuthed
      ? `<button type="button" class="btn btn--primary btn--sm match-lock__btn" data-unlock>🪙 ${BM.MATCH_UNLOCK_COST}으로 ${BM.MATCH_UNLOCK_STEP}개 더 보기</button>`
      : `<a class="btn btn--primary btn--sm match-lock__btn" href="auth.html">로그인하고 더 보기</a>`;
    return `
      <div class="match-lock">
        <p class="match-lock__text">🔒 <b>${hiddenCount}개</b>가 더 있어요</p>
        ${cta}
      </div>`;
  }

  /** 보여줄 만큼 자르고, 남은 게 있으면 잠금 줄을 붙인다. */
  function withLock(matches, cardHtml) {
    const limit = AppState.visibleMatchCount(matchListKey());
    const cards = matches.slice(0, limit).map(cardHtml).join('');
    return matches.length > limit ? cards + lockRowHtml(matches.length - limit) : cards;
  }

  async function unlockMore(btn) {
    const key = matchListKey();
    if (AppState.getCredits() < BM.MATCH_UNLOCK_COST) {
      openPaywall({ reason: 'match', need: BM.MATCH_UNLOCK_COST });
      return;
    }
    btn.disabled = true;
    const res = await AppState.unlockMatches(key);
    if (!res.ok) {
      btn.disabled = false;
      if (res.error && /insufficient_credits/.test(res.error.message || '')) openPaywall({ reason: 'match', need: BM.MATCH_UNLOCK_COST });
      else showToast('지금은 열 수 없어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    trackEvent('credits_match_unlock', { mode, steps: AppState.visibleMatchCount(key) });
    renderMatches();
    showToast(`🪙 ${BM.MATCH_UNLOCK_COST} 크레딧으로 ${BM.MATCH_UNLOCK_STEP}개를 더 열었어요`);
  }

  function renderCourseMatches() {
    const confirmed = AppState.getConfirmedSchool();
    const note = document.getElementById('confirmedSchoolNote');

    // 학교를 확정했으면 그 학교 과목만 본다. 갈 곳이 정해진 뒤에 다른 학교 과목은
    // 고를 수 없는 선택지라 목록만 길어진다.
    // 예전엔 확정 학교에 과목 데이터가 없으면 전체를 예시로 보여줬는데, 확정한
    // 학교가 아닌 카드가 자기 결과인 것처럼 섞여 보였다 — 이제 비었다고 말한다.
    let matches = MOCK.courseMatches;
    if (confirmed) {
      matches = matches.filter(m => m.school === confirmed.id);

      // 학교는 정했는데 내 전공을 아직 안 골랐다면 목록을 내보내지 않는다.
      // 전공을 모르는 채로 그 학교 과목 전부를 늘어놓으면(수백 개) 무엇이 내
      // 학점으로 인정되는지 판단할 수 없다.
      if (!selectedMajor && matches.length) {
        renderRelevanceFilter([]);
        renderCountryFilter([]);
        note.hidden = true;
        document.getElementById('matchList').innerHTML = `
          <div class="info-panel">
            <p class="info-panel__text">
              먼저 <strong>내 전공</strong>을 고르면 ${confirmed.nameKo || confirmed.name}에서
              그 전공으로 인정되는 과목만 모아서 보여드려요.
            </p>
          </div>`;
        return;
      }

      if (selectedMajor) {
        matches = matches.filter(m => m.homeMajor === selectedMajor);
      }

      // 같은 학교·같은 내 전공이라도 후보 학과(현지 학과)가 둘 이상으로 갈리는 경우에만
      // 신청 전공으로 좁히게 한다 — 보통은 전공당 학과가 하나라 이 단계를 안 거친다.
      const targetOptions = [...new Set(matches.flatMap(m => m.matchedTopics || []))];
      if (!selectedTargetMajor && matches.length && targetOptions.length > 1) {
        renderRelevanceFilter([]);
        renderCountryFilter([]);
        note.hidden = true;
        document.getElementById('matchList').innerHTML = `
          <div class="info-panel">
            <p class="info-panel__text">
              ${confirmed.nameKo || confirmed.name}에서 <strong>신청한 전공</strong>을 알려 주시면
              그 전공 과목만 모아서 보여드려요.
            </p>
            <a class="btn btn--primary btn--sm" href="home.html">홈에서 신청 전공 고르기</a>
          </div>`;
        return;
      }

      note.hidden = false;
      note.textContent = selectedTargetMajor
        ? `확정하신 ${confirmed.nameKo || confirmed.name} · ${selectedTargetMajor} 기준이에요.`
        : `확정하신 ${confirmed.nameKo || confirmed.name}의 ${selectedMajor} 인정 과목이에요.`;
    } else {
      note.hidden = true;
      if (selectedMajor) {
        matches = matches.filter(m => m.homeMajor === selectedMajor);
      }
    }

    matches = byTargetMajor(matches);

    renderRelevanceFilter(matches);
    matches = byRelevance(matches);
    // 국가 후보는 관련도까지 적용한 뒤 뽑는다 — 그래야 골라도 0건인 국가가 안 뜬다
    renderCountryFilter(matches);
    matches = byCountry(matches);

    document.getElementById('matchList').innerHTML = matches.length ? withLock(matches, m => {
      const school = schoolDisplay(m.school);
      return `
      <div class="card match-card" data-school="${m.school}">
        <div class="match-card__head">
          <h3 class="match-card__headline">${stripSchoolSuffix(m.targetCourse)}</h3>
          ${relevanceBadge(m.similarity)}
        </div>
        <div class="match-card__school${school.exists ? ' match-card__school--clickable' : ''}"
             ${school.exists ? `data-open-school="${m.school}" role="button" tabindex="0"` : ''}>
          ${school.logo ? `<img class="match-card__school-logo" src="assets/school-logos/${school.logo}" alt="">` : ''}
          <span class="match-card__school-name">${school.name}</span>
          ${countryTag(school)}
        </div>
        ${m.matchedTopics.length ? `
        <div class="match-card__topics">${m.matchedTopics.map(t => `<button type="button" class="chip" data-topic-jump>${t}</button>`).join('')}</div>` : ''}
        ${noteBlock(formatNote(m.note))}
      </div>
    `;
    }) : `<p class="info-panel__text">${
      selectedCountry || selectedRelevance || selectedTargetMajor
        ? '조건에 맞는 과목이 없어요. 관련도를 바꿔보세요.'
        : confirmed
          ? `${confirmed.nameKo || confirmed.name}의 학점 인정 과목 자료가 아직 없어요.`
          : '서비스 준비 중이에요.'
    }</p>`;
  }

  function renderMajorMatches() {
    const confirmed = AppState.getConfirmedSchool();
    const note = document.getElementById('confirmedSchoolNote');

    if (!selectedMajor) {
      document.getElementById('matchList').innerHTML = `<p class="info-panel__text">전공을 선택하면 매칭 결과를 보여드려요.</p>`;
      note.hidden = true;
      return;
    }

    let all = MOCK.majorMatches.filter(m => m.homeMajor === selectedMajor);
    // 과목 탭과 같은 이유로 확정 학교만 남긴다
    if (confirmed) all = all.filter(m => m.school === confirmed.id);
    renderRelevanceFilter(all);
    const byBand = byRelevance(all);
    renderCountryFilter(byBand);
    const matches = byCountry(byBand);

    if (confirmed) {
      note.hidden = false;
      note.textContent = `확정하신 ${confirmed.nameKo || confirmed.name}의 전공만 보여드려요.`;
    } else {
      note.hidden = true;
    }

    document.getElementById('matchList').innerHTML = matches.length ? withLock(matches, m => {
      const school = schoolDisplay(m.school);
      // 목록이 전부 확정 학교라 따로 표시할 것이 없다
      return `
      <div class="card match-card" data-school="${m.school}" data-match-id="${m.id}">
        <div class="match-card__head">
          <h3 class="match-card__headline">${m.targetMajor}</h3>
          ${relevanceBadge(m.similarity)}
        </div>
        <div class="match-card__school${school.exists ? ' match-card__school--clickable' : ''}"
             ${school.exists ? `data-open-school="${m.school}" role="button" tabindex="0"` : ''}>
          ${school.logo ? `<img class="match-card__school-logo" src="assets/school-logos/${school.logo}" alt="">` : ''}
          <span class="match-card__school-name">${school.name}</span>
          ${countryTag(school)}
        </div>
        ${m.matchedTopics.length ? `
        <div class="match-card__topics">${m.matchedTopics.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
        ${noteBlock(m.note || '')}
      </div>
    `;
    }) : `<p class="info-panel__text">${selectedCountry || selectedRelevance ? '조건에 맞는 전공이 없어요. 관련도를 바꿔보세요.' : confirmed ? `${confirmed.nameKo || confirmed.name}에는 이 전공과 맞는 결과가 아직 없어요.` : '이 전공은 아직 뚜렷한 매칭 결과가 없어요.'}</p>`;
  }

  function renderMatches() {
    if (mode === 'major') renderMajorMatches();
    else renderCourseMatches();
    wireMatchCardTaps();
  }

  function applyModeUI() {
    document.getElementById('creditsPageTitle').textContent = mode === 'major' ? '내 전공과 잘 맞는 해외 전공' : '학점 인정 사전 확인';
    document.getElementById('downloadReportBtn').style.display = mode === 'major' ? 'none' : '';
    document.querySelectorAll('.mode-toggle__btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === mode);
    });
  }

  document.getElementById('modeToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn || btn.dataset.mode === mode) return;
    mode = btn.dataset.mode;
    applyModeUI();
    renderMatches();
    trackEvent('credits_mode_switch', { mode });
  });

  document.getElementById('downloadReportBtn').addEventListener('click', () => {
    showToast('인쇄 화면에서 PDF로 저장할 수 있어요.');
    setTimeout(() => window.print(), 400);
  });

  applyModeUI();
  renderMajorFilter();
  renderMatches();

  document.addEventListener('MOCK:updated', () => {
    // 이 IIFE는 AppState 하이드레이션보다 먼저 돈다. 로그인 사용자의 전공은 그때
    // 서버에서 도착하므로, 아직 고른 게 없으면 그 값으로 채워 자기 전공 결과부터
    // 보게 한다(사용자가 직접 고른 뒤에는 덮어쓰지 않는다).
    if (!selectedMajor && AppState.profile.major) selectedMajor = AppState.profile.major;
    if (!selectedTargetMajor && AppState.profile.targetMajor) selectedTargetMajor = AppState.profile.targetMajor;
    renderMajorFilter();
    renderMatches();
  });
})();
