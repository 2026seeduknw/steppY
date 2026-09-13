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
  let selectedRelevance = '';  // '' = 전체 | 'high' | 'mid' | 'low'
  let mode = 'course'; // 'course' | 'major'

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

  /**
   * "신청 전공" 드롭다운 — 확정한 학교에서 어떤 전공으로 신청했는지.
   *
   * 후보는 그 학교 과목 매칭의 matched_topics(현지 학과명)에서 뽑는다. 목록에 없는
   * 학과를 넣어봐야 걸리는 과목이 없어서다. 확정 전에는 고를 대상이 없으니 아예
   * 띄우지 않는다.
   *
   * 고른 값은 프로필에 저장한다 — 매번 다시 고르게 하면 드롭다운이 아니라 필터다.
   */
  function renderTargetMajorFilter() {
    const mount = document.getElementById('targetMajorMount');
    if (!mount) return;
    const confirmed = AppState.getConfirmedSchool();
    if (!confirmed) { mount.innerHTML = ''; return; }

    const topics = [...new Set(
      MOCK.courseMatches
        .filter(m => m.school === confirmed.id)
        .flatMap(m => m.matchedTopics || [])
    )].sort((a, b) => a.localeCompare(b));

    if (!topics.length) { mount.innerHTML = ''; return; }

    // 저장해둔 값이 이 학교에 없는 학과면(학교를 바꿨을 때) 선택을 푼다
    if (selectedTargetMajor && !topics.includes(selectedTargetMajor)) selectedTargetMajor = '';

    mount.innerHTML = '';
    const select = createSearchableSelect({
      items: topics.map(t => ({ value: t, label: t })),
      selected: selectedTargetMajor,
      multiple: false,
      placeholder: '신청 전공 선택',
      onChange: (value) => {
        selectedTargetMajor = value || '';
        AppState.updateProfile({ targetMajor: selectedTargetMajor || null });
        trackEvent('credits_target_major', { major: selectedTargetMajor || 'all' });
        renderMatches();
      }
    });
    mount.appendChild(select.el);
  }

  /** 신청 전공을 골랐으면 그 학과 과목만 남긴다. */
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

  function schoolDisplay(schoolId) {
    const school = MOCK.schools.find(s => s.id === schoolId);
    return {
      name: school ? (school.nameKo || school.name) : schoolId,
      country: school ? school.country : '',
      countryEn: school ? school.countryEn : '',
      logo: SCHOOL_LOGOS[schoolId]
    };
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
      .map(([country, en]) => ({ country, flag: countryFlag(en) }));
  }

  function renderCountryFilter(matches) {
    const mount = document.getElementById('countryFilterMount');
    if (!mount) return;
    const options = countryOptions(matches);

    // 고를 수 있는 국가가 하나뿐이면 필터가 하는 일이 없다
    if (options.length < 2) { mount.innerHTML = ''; return; }

    // 전공을 바꿔서 지금 고른 국가에 결과가 없어지면 선택을 푼다
    if (selectedCountry && !options.some(o => o.country === selectedCountry)) selectedCountry = '';

    mount.innerHTML = `
      <div class="country-filter" role="group" aria-label="국가 필터">
        <button type="button" class="chip${selectedCountry === '' ? ' is-selected' : ''}" data-country="">전체</button>
        ${options.map(o => `
          <button type="button" class="chip${selectedCountry === o.country ? ' is-selected' : ''}" data-country="${o.country}">
            ${o.flag ? o.flag + ' ' : ''}${o.country}
          </button>`).join('')}
      </div>`;

    mount.querySelectorAll('[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCountry = btn.dataset.country;
        trackEvent('credits_country_filter', { country: selectedCountry || 'all', mode });
        renderMatches();
      });
    });
  }

  function byCountry(matches) {
    if (!selectedCountry) return matches;
    return matches.filter(m => schoolDisplay(m.school).country === selectedCountry);
  }

  /** targetCourse 원본 문자열 끝에 "(대학명)"이 그대로 붙어 있고, 이게 실제 캠퍼스명과
   * 다를 때가 있다(예: "First Year Korean (University of California)"인데 실제로는
   * UC Santa Barbara). 아래에서 정확한 학교명을 따로 보여주므로 중복/부정확한 접미사는 뗀다. */
  function stripSchoolSuffix(courseName) {
    return courseName.replace(/\s*\([^)]*\)\s*$/, '');
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
      note.hidden = false;
      note.textContent = `확정하신 ${confirmed.nameKo || confirmed.name}의 과목만 보여드려요.`;
    } else {
      note.hidden = true;
    }

    if (selectedMajor) {
      matches = matches.filter(m => m.homeMajor === selectedMajor);
    }

    renderTargetMajorFilter();
    matches = byTargetMajor(matches);

    renderRelevanceFilter(matches);
    matches = byRelevance(matches);
    // 국가 후보는 관련도까지 적용한 뒤 뽑는다 — 그래야 골라도 0건인 국가가 안 뜬다
    renderCountryFilter(matches);
    matches = byCountry(matches);

    document.getElementById('matchList').innerHTML = matches.length ? matches.map(m => {
      const school = schoolDisplay(m.school);
      return `
      <div class="card match-card">
        <div class="match-card__head">
          <h3 class="match-card__headline">${stripSchoolSuffix(m.targetCourse)}</h3>
          ${relevanceBadge(m.similarity)}
        </div>
        <div class="match-card__school">
          ${school.logo ? `<img class="match-card__school-logo" src="assets/school-logos/${school.logo}" alt="">` : ''}
          <span class="match-card__school-name">${school.name}</span>
          ${countryTag(school)}
        </div>
        ${m.matchedTopics.length ? `
        <div class="match-card__topics">${m.matchedTopics.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
        <div class="match-card__note">${formatNote(m.note)}</div>
      </div>
    `;
    }).join('') : `<p class="info-panel__text">${
      selectedCountry || selectedRelevance || selectedTargetMajor
        ? '조건에 맞는 과목이 없어요. 신청 전공이나 관련도를 바꿔보세요.'
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

    const tm = document.getElementById('targetMajorMount');
    if (tm) tm.innerHTML = '';   // 이 탭은 전공을 고르는 화면이라 신청 전공 필터가 겹친다
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

    document.getElementById('matchList').innerHTML = matches.length ? matches.map(m => {
      const school = schoolDisplay(m.school);
      // 목록이 전부 확정 학교라 따로 표시할 것이 없다
      return `
      <div class="card match-card">
        <div class="match-card__head">
          <h3 class="match-card__headline">${m.targetMajor}</h3>
          ${relevanceBadge(m.similarity)}
        </div>
        <div class="match-card__school">
          ${school.logo ? `<img class="match-card__school-logo" src="assets/school-logos/${school.logo}" alt="">` : ''}
          <span class="match-card__school-name">${school.name}</span>
          ${countryTag(school)}
        </div>
        ${m.matchedTopics.length ? `
        <div class="match-card__topics">${m.matchedTopics.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
        <div class="match-card__note">${m.note || ''}</div>
      </div>
    `;
    }).join('') : `<p class="info-panel__text">${selectedCountry || selectedRelevance ? '조건에 맞는 전공이 없어요. 관련도를 바꿔보세요.' : confirmed ? `${confirmed.nameKo || confirmed.name}에는 이 전공과 맞는 결과가 아직 없어요.` : '이 전공은 아직 뚜렷한 매칭 결과가 없어요.'}</p>`;
  }

  function renderMatches() {
    if (mode === 'major') renderMajorMatches();
    else renderCourseMatches();
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
    showToast('실제 서비스에서는 PDF 리포트로 다운로드돼요. 지금은 인쇄 미리보기로 보여드려요.');
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
