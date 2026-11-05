/**
 * 기본 정보 입력 화면 — 처음 입력할 때도, 나중에 고칠 때도 이 화면을 쓴다(저장된 값으로 채워서 연다).
 *
 * 없을 때 무슨 일이 벌어지냐면 — 가입한 사용자가 GPA·학과가 빈 채로 홈에
 * 떨어지고, 학교 검색의 지원 가능 판정이 전 학교에서 "GPA 정보 필요"로 나온다.
 * 서비스의 핵심 기능이 동작하지 않는 셈이라, 최소한의 정보를 받는다.
 *
 * 다만 가입하자마자 이 화면으로 튕기지는 않는다. 무엇을 쓰는 앱인지 보기도
 * 전에 낯선 폼을 채우게 되기 때문이다 — 홈으로 먼저 들여보내고,
 * 인사말 아래 "기본 정보를 입력해 주세요" 버튼으로 본인이 눌러 들어온다
 * (js/home.js의 renderProfileCta). 학과·학점이 채워지면 버튼은 사라진다.
 *
 * 필수는 이름·학과·학점뿐이다. 나머지(전형·어학·학적)는 국제처 공통 자격과 배정 점수를
 * 판정하는 데 쓰인다(js/oia-rules.js). 비워 둬도 넘어갈 수 있고, 비어 있는 만큼
 * 학교 찾기의 '내 지원 자격'이 "입력하면 판정할 수 있어요"로 남는다.
 *
 * 순서가 중요하다 — 지원 전형(영어권/비영어권 언어)을 먼저 고른다. 어떤 시험을 받을지,
 * 점수인지 등급인지가 전형에 따라 달라진다.
 *
 * 상단 "나중에"로 건너뛰면 아무것도 저장하지 않고 홈으로 돌아간다.
 */
(function () {
  const SEASONS = ['봄학기', '여름학기', '가을학기', '겨울학기'];
  const NONE = '__none__';   // "아직 몰라요 / 아직 없어요"
  // 연세대 학점은 4.3 만점 하나라 기준을 고르게 하지 않는다
  const GPA_SCALE = 4.3;
  const THIS_YEAR = new Date().getFullYear();

  // 입력값을 모아뒀다가 마지막에 한 번에 저장한다 — 중간에 이탈하면
  // 반쯤 채워진 프로필이 남는 것보다 아무것도 안 남는 편이 낫다.
  const draft = {
    name: '',
    major: null,
    gpa: null,
    gpaScale: GPA_SCALE,
    season: '가을학기',
    year: THIS_YEAR + 1,
    length: 1,
    track: NONE,
    // 지금 고른 시험 하나 — { type, score, level, lang, date }
    test: null,
    tests: [],          // 저장돼 있던 다른 시험(전형을 바꿔도 지우지 않는다)
    academic: {}
  };

  const el = {
    skip: document.getElementById('obSkip'),
    name: document.getElementById('obName'),
    error: document.getElementById('obError'),
    next: document.getElementById('obNext'),
    majorMount: document.getElementById('obMajorMount'),
    gpa: document.getElementById('obGpa'),
    percentile: document.getElementById('obPercentile'),
    trackChips: document.getElementById('obTrackChips'),
    langMount: document.getElementById('obLangMount'),
    degreeChips: document.getElementById('obDegreeChips'),
    fieldRow: document.getElementById('obFieldRow'),
    fieldChips: document.getElementById('obFieldChips'),
    semesters: document.getElementById('obSemesters'),
    transferRow: document.getElementById('obTransferRow'),
    transferChips: document.getElementById('obTransferChips'),
    lastSemester: document.getElementById('obLastSemester'),
    year: document.getElementById('obYear'),
    seasons: document.getElementById('obSeasons'),
    lengthChips: document.getElementById('obLengthChips')
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const chip = (attr, value, label, selected) =>
    `<button type="button" class="chip${selected ? ' is-selected' : ''}" data-${attr}="${esc(value)}">${esc(label)}</button>`;

  /* -------------------------------------------------- 저장된 값으로 채우기 */

  function prefill() {
    const p = AppState.profile || {};
    const term = p.exchangeTerm || {};
    draft.major = p.major || null;
    draft.gpa = p.gpa == null ? null : p.gpa;
    if (term.year) draft.year = term.year;
    if (term.season) draft.season = term.season;
    draft.length = term.length === 2 ? 2 : 1;
    draft.track = term.track || NONE;
    draft.tests = (p.languageTests || []).slice();
    draft.academic = Object.assign({}, p.academic || {});
    pickTestForTrack();
    el.gpa.value = draft.gpa == null ? '' : draft.gpa;
    el.percentile.value = draft.academic.percentile == null ? '' : draft.academic.percentile;
    el.semesters.value = draft.academic.semesters == null ? '' : draft.academic.semesters;
    el.lastSemester.checked = !!draft.academic.lastSemester;
  }

  /** 전형을 고르면, 저장돼 있던 시험 중 그 전형에 맞는 것을 꺼내 온다. 없으면 첫 시험으로 새로 시작. */
  function pickTestForTrack() {
    if (draft.track === NONE) { draft.test = null; return; }
    const saved = draft.tests.find(t => OIA.testFitsTrack(t, draft.track));
    draft.test = saved ? Object.assign({}, saved) : { type: OIA.trackOf(draft.track).tests[0], lang: draft.track };
  }

  /* --------------------------------------------------------------- 렌더 */

  function renderMajor() {
    // 학과 목록은 Supabase에서 비동기로 온다. 아직이면 도착 후 다시 그린다.
    if (!MOCK.yonseiMajors.length) {
      el.majorMount.innerHTML = '<p class="ob__loading">학과 목록을 불러오는 중이에요…</p>';
      return;
    }
    el.majorMount.innerHTML = '';
    const select = createSearchableSelect({
      items: MOCK.yonseiMajors.map(m => ({ value: m.majorName, label: m.majorName, group: m.college })),
      selected: draft.major,
      multiple: false,
      placeholder: '학과를 검색해서 선택하세요',
      onChange: (value) => { draft.major = value; clearError(); }
    });
    el.majorMount.appendChild(select.el);
  }

  function renderTrack() {
    el.trackChips.innerHTML = OIA.TRACKS.map(t => chip('track', t.key, t.label, t.key === draft.track)).join('')
      + chip('track', NONE, '아직 몰라요', draft.track === NONE);
  }

  /** 어학 성적 — 전형에 맞는 시험만 고를 수 있다. 점수 시험은 숫자, 등급 시험은 등급을 고른다. */
  function renderLang() {
    if (draft.track === NONE) {
      el.langMount.innerHTML = '<p class="ob__hint">지원 전형을 고르면 그 언어의 시험 성적을 입력할 수 있어요.</p>';
      return;
    }
    const tr = OIA.trackOf(draft.track);
    const t = draft.test;
    const def = OIA.TESTS[t.type];
    const input = def.kind === 'score'
      ? `<input type="number" inputmode="numeric" min="0" max="${def.max}" step="${def.step}" id="obLangScore"
           value="${t.score == null ? '' : t.score}" placeholder="점수 (예: ${def.placeholder})" aria-label="${t.type} 점수">`
      : `<select id="obLangLevel" aria-label="${t.type} 등급">
           <option value="">등급 선택</option>
           ${def.levels.map(l => `<option ${l === t.level ? 'selected' : ''}>${l}</option>`).join('')}
         </select>`;
    el.langMount.innerHTML = `
      ${tr.tests.length > 1 ? `<div class="ob__chips" id="obTestChips">${tr.tests.map(x => chip('test', x, x, x === t.type)).join('')}</div>` : ''}
      <div class="ob__row ob__row--pair">
        ${input}
        <input type="month" id="obLangDate" value="${esc(t.date || '')}" aria-label="응시 연월">
      </div>
      <p class="ob__hint">${draft.track === 'english'
        ? `TOEFL iBT만 인정돼요. ${OIA.NOT_ACCEPTED}는 낼 수 없어요.`
        : `${tr.lang}는 ${tr.tests.join(' · ')} 성적을 40점 만점으로 환산해요.`} 응시 연월은 유효기간(파견 시작 2년 이내) 확인에 써요.</p>
      <label class="ob__check"><input type="checkbox" id="obExempt" ${draft.academic.langExempt ? 'checked' : ''}>
        어학 면제 대상이에요 <span>(${tr.lang} 모국어 또는 그 언어로 초·중등 12년 이수)</span></label>`;
  }

  function renderAcademic() {
    const a = draft.academic;
    el.degreeChips.innerHTML = OIA.DEGREES.map(d => chip('degree', d.key, d.label, (a.degree || 'undergrad') === d.key)).join('');
    const undergrad = (a.degree || 'undergrad') === 'undergrad';
    el.fieldRow.hidden = !undergrad;
    el.transferRow.hidden = !undergrad;
    el.fieldChips.innerHTML = OIA.FIELDS.map(f => chip('field', f.key, f.label, a.field === f.key)).join('');
    el.transferChips.innerHTML = [['', '아니요'], ['2', '2학년 편입'], ['3', '3학년 편입']]
      .map(([v, l]) => chip('transfer', v, l, (a.transfer || '') === v)).join('');
  }

  function renderYear() {
    el.year.innerHTML = [THIS_YEAR, THIS_YEAR + 1, THIS_YEAR + 2]
      .map(y => `<option value="${y}" ${y === draft.year ? 'selected' : ''}>${y}년</option>`).join('');
  }

  function renderSeasons() {
    el.seasons.innerHTML = SEASONS.map(s => chip('season', s, s, s === draft.season)).join('');
    el.lengthChips.innerHTML = [[1, '한 학기'], [2, '1년']].map(([v, l]) => chip('length', v, l, draft.length === v)).join('');
  }

  /* --------------------------------------------------------------- 검증 */

  function clearError() { el.error.hidden = true; }
  function showError(text, focus) {
    el.error.textContent = text;
    el.error.hidden = false;
    el.error.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (focus) focus.focus();
  }

  function validate() {
    if (!draft.name) return { msg: '이름을 입력해 주세요.', focus: el.name };
    if (!draft.major) return { msg: '학과를 선택해 주세요.' };
    if (draft.gpa === null || Number.isNaN(draft.gpa)) return { msg: '학점을 입력해 주세요.', focus: el.gpa };
    if (draft.gpa < 0 || draft.gpa > draft.gpaScale) {
      return { msg: `학점은 0 ~ ${draft.gpaScale} 사이로 입력해 주세요.`, focus: el.gpa };
    }
    const pct = draft.academic.percentile;
    if (pct != null && (pct < 0 || pct > 100)) return { msg: '백분위는 0 ~ 100 사이로 입력해 주세요.', focus: el.percentile };
    const t = draft.test;
    if (t && t.score != null) {
      const max = OIA.TESTS[t.type].max;
      if (Number.isNaN(Number(t.score)) || t.score < 0 || t.score > max) {
        return { msg: `${t.type} 점수는 0 ~ ${max} 사이로 입력해 주세요.`, focus: document.getElementById('obLangScore') };
      }
    }
    return null;
  }

  /* --------------------------------------------------------------- 저장 */

  /**
   * 저장이 서버에 반영된 뒤에 이동한다.
   * 낙관적 갱신이라 화면은 이미 맞지만, 여기서 바로 홈으로 넘어가면 홈이 새로
   * 읽은 onboarded_at이 아직 null이라 온보딩으로 도로 튕긴다.
   */
  async function saveAndLeave(writes, to = 'home.html') {
    AppState.lastWriteError = null;
    el.next.disabled = true;
    el.skip.disabled = true;
    const label = el.next.textContent;
    el.next.textContent = '저장 중…';

    writes();
    await AppState.flush();

    if (AppState.lastWriteError) {
      showError('저장에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요.');
      el.next.disabled = false;
      el.skip.disabled = false;
      el.next.textContent = label;
      return;
    }
    location.replace(to);
  }

  function finish() {
    const problem = validate();
    if (problem) return showError(problem.msg, problem.focus);

    const prevTerm = AppState.profile.exchangeTerm || {};
    const patch = {
      name: draft.name,
      major: draft.major,
      gpa: draft.gpa,
      gpaScale: draft.gpaScale,
      exchangeTerm: Object.assign({}, prevTerm, {
        unit: prevTerm.unit || 'semester', season: draft.season, year: draft.year,
        length: draft.length, track: draft.track === NONE ? null : draft.track
      }),
      academic: draft.academic
    };
    // 지금 고른 시험을 같은 전형의 예전 성적 자리에 넣는다. 다른 전형 성적은 지우지 않는다 —
    // 영어권으로 바꿨다가 다시 돌아와도 입력한 등급이 남아 있어야 한다.
    const t = draft.test;
    const filled = t && (t.score != null || t.level);
    const others = draft.tests.filter(x => !(draft.track !== NONE && OIA.testFitsTrack(x, draft.track)) && !OIA.TESTS[x.type]?.notAccepted);
    patch.languageTests = filled
      ? [Object.assign({ type: t.type }, t.score != null ? { score: Number(t.score) } : { level: t.level },
          t.type === 'FLEX' ? { lang: draft.track } : {}, t.date ? { date: t.date } : {})].concat(others)
      : others;
    // 점수를 받은 바로 그 값으로 무엇이 달라지는지 보여준다 — 홈으로 돌려보내면
    // 방금 채운 칸이 무슨 쓸모였는지 스스로 찾아가야 한다.
    saveAndLeave(() => {
      AppState.updateProfile(patch);
      AppState.markOnboarded();
      document.dispatchEvent(new CustomEvent('profile:updated'));
    }, 'search.html');
  }

  /* --------------------------------------------------------------- 이벤트 */

  (function prefillName() {
    const saved = (AppState.profile && AppState.profile.name) || '';
    const meta = (typeof Auth !== 'undefined' && Auth.user && Auth.user.user_metadata) || {};
    const initial = (meta.name || '').trim() || (saved === '회원' ? '' : saved);
    const emailId = (typeof Auth !== 'undefined' && Auth.email) ? Auth.email.split('@')[0] : '';
    draft.name = initial && initial !== emailId ? initial : (saved !== '회원' && saved !== emailId ? saved : '');
    el.name.value = draft.name;
  })();

  el.name.addEventListener('input', () => { draft.name = el.name.value.trim(); clearError(); });
  el.gpa.addEventListener('input', () => {
    draft.gpa = el.gpa.value === '' ? null : roundDecimals(el.gpa.value, 2);
    clearError();
  });
  el.percentile.addEventListener('input', () => {
    draft.academic.percentile = el.percentile.value === '' ? null : roundDecimals(el.percentile.value, 2);
    clearError();
  });
  el.semesters.addEventListener('input', () => {
    draft.academic.semesters = el.semesters.value === '' ? null : parseInt(el.semesters.value, 10);
  });
  el.lastSemester.addEventListener('change', () => { draft.academic.lastSemester = el.lastSemester.checked; });
  el.year.addEventListener('change', e => { draft.year = parseInt(e.target.value, 10); });

  el.trackChips.addEventListener('click', e => {
    const btn = e.target.closest('[data-track]');
    if (!btn) return;
    draft.track = btn.dataset.track;
    pickTestForTrack();
    renderTrack();
    renderLang();
    clearError();
  });

  // 어학 칸은 전형을 바꿀 때마다 다시 그려진다 — 바깥 상자에 한 번만 건다
  el.langMount.addEventListener('click', e => {
    const btn = e.target.closest('[data-test]');
    if (!btn) return;
    draft.test = { type: btn.dataset.test, lang: draft.track, date: draft.test && draft.test.date };
    renderLang();
  });
  el.langMount.addEventListener('input', e => {
    if (e.target.id === 'obLangScore') draft.test.score = e.target.value === '' ? null : Number(e.target.value);
    if (e.target.id === 'obLangDate') draft.test.date = e.target.value || null;
    clearError();
  });
  el.langMount.addEventListener('change', e => {
    if (e.target.id === 'obLangLevel') draft.test.level = e.target.value || null;
    if (e.target.id === 'obLangDate') draft.test.date = e.target.value || null;
    if (e.target.id === 'obExempt') draft.academic.langExempt = e.target.checked;
  });

  const academicChip = (attr, key) => (e) => {
    const btn = e.target.closest(`[data-${attr}]`);
    if (!btn) return;
    draft.academic[key] = btn.dataset[attr] || null;
    renderAcademic();
  };
  el.degreeChips.addEventListener('click', academicChip('degree', 'degree'));
  el.fieldChips.addEventListener('click', academicChip('field', 'field'));
  el.transferChips.addEventListener('click', academicChip('transfer', 'transfer'));

  el.seasons.addEventListener('click', e => {
    const btn = e.target.closest('[data-season]');
    if (!btn) return;
    draft.season = btn.dataset.season;
    renderSeasons();
  });
  el.lengthChips.addEventListener('click', e => {
    const btn = e.target.closest('[data-length]');
    if (!btn) return;
    draft.length = Number(btn.dataset.length);
    renderSeasons();
  });

  el.next.addEventListener('click', finish);
  // 답은 저장하지 않되 "물어봤다"는 사실은 남긴다
  el.skip.addEventListener('click', () => saveAndLeave(() => AppState.markOnboarded()));

  // 학과 목록이 늦게 도착하면 그 칸만 다시 그린다
  document.addEventListener('MOCK:updated', renderMajor);

  function renderAll() {
    renderYear();
    renderSeasons();
    renderTrack();
    renderLang();
    renderAcademic();
    renderMajor();
  }

  Auth.init().then(async () => {
    if (!Auth.isAuthed) { location.replace('auth.html'); return; }
    // 고치러 들어온 경우 저장된 값으로 채운다 — 서버 상태가 와야 값이 있다
    if (!AppState._hydrated) await new Promise(r => document.addEventListener('MOCK:updated', r, { once: true }));
    prefill();
    renderAll();
  });
})();
