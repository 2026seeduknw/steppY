/**
 * 가입 직후 프로필 온보딩.
 *
 * 없을 때 무슨 일이 벌어지냐면 — 가입한 사용자가 GPA·학과가 빈 채로 홈에
 * 떨어지고, 학교 검색의 지원 가능 판정이 전 학교에서 "GPA 정보 필요"로 나온다.
 * 서비스의 핵심 기능이 첫 화면부터 동작하지 않는 셈이라, 가입 직후 최소한의
 * 정보를 받는다.
 *
 * 한 화면에서 네 가지를 다 받는다. 예전에는 한 단계씩 넘기는 방식이었는데,
 * 물어보는 것이 넷뿐이고 전부 짧은 입력이라 넘기는 동작이 입력보다 오래 걸렸다.
 * 한 화면이면 무엇을 묻는지 한눈에 보이고, 앞 답을 고치러 되돌아갈 필요도 없다.
 *
 * 상단 "나중에"로 전체를 건너뛸 수 있다. 어느 쪽이든 markOnboarded()로
 * "물어봤다"는 사실을 남겨 다시 묻지 않는다.
 */
(function () {
  const SEASONS = ['봄학기', '여름학기', '가을학기', '겨울학기'];
  const LANG_TESTS = ['TOEFL', 'IELTS', 'HSK', 'JLPT', 'DELF'];
  const LANG_NONE = '__none__';   // "아직 없어요"
  const GPA_SCALES = [4.3, 4.5, 4.0];
  const THIS_YEAR = new Date().getFullYear();

  // 입력값을 모아뒀다가 마지막에 한 번에 저장한다 — 중간에 이탈하면
  // 반쯤 채워진 프로필이 남는 것보다 아무것도 안 남는 편이 낫다.
  const draft = {
    // 가입할 때 이름은 선택이었다. 안 적으면 홈 인사가 메일 아이디(hslee_819님)로
    // 굳고 고칠 데가 없었다 — 첫 화면에서 한 번 묻는다.
    name: '',
    major: null,
    gpa: null,
    gpaScale: 4.3,
    // 어학은 기본이 "아직 없어요". 교환을 준비하기 시작한 시점에는 아직 시험을
    // 안 본 사람이 더 많고, 그 사람들이 아무것도 건드리지 않아도 넘어가야 한다.
    langType: LANG_NONE,
    langScore: null,
    season: '가을학기',
    year: THIS_YEAR + 1
  };

  const el = {
    skip: document.getElementById('obSkip'),
    name: document.getElementById('obName'),
    error: document.getElementById('obError'),
    next: document.getElementById('obNext'),
    majorMount: document.getElementById('obMajorMount'),
    gpa: document.getElementById('obGpa'),
    scale: document.getElementById('obScale'),
    langChips: document.getElementById('obLangChips'),
    scoreRow: document.getElementById('obScoreRow'),
    langScore: document.getElementById('obLangScore'),
    year: document.getElementById('obYear'),
    seasons: document.getElementById('obSeasons')
  };

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

  function renderLangChips() {
    const opts = [...LANG_TESTS, LANG_NONE];
    el.langChips.innerHTML = opts.map(t => `
      <button type="button" class="chip${t === draft.langType ? ' is-selected' : ''}" data-lang="${t}">
        ${t === LANG_NONE ? '아직 없어요' : t}
      </button>`).join('');
    syncScoreRow();
  }

  /** "아직 없어요"를 고르면 점수 칸을 숨긴다 — 비워두라고 안내하는 것보다 확실하다. */
  function syncScoreRow() {
    const none = draft.langType === LANG_NONE;
    el.scoreRow.hidden = none;
    if (none) { draft.langScore = null; el.langScore.value = ''; }
  }

  function renderScale() {
    el.scale.innerHTML = GPA_SCALES
      // 4.0은 그냥 찍으면 "4 만점"이 된다 — 만점 표기는 소수점 한 자리로 고정한다
      .map(v => `<option value="${v}" ${v === draft.gpaScale ? 'selected' : ''}>${v.toFixed(1)} 만점</option>`).join('');
  }

  function renderYear() {
    el.year.innerHTML = [THIS_YEAR, THIS_YEAR + 1, THIS_YEAR + 2]
      .map(y => `<option value="${y}" ${y === draft.year ? 'selected' : ''}>${y}년</option>`).join('');
  }

  function renderSeasons() {
    el.seasons.innerHTML = SEASONS
      .map(s => `<button type="button" class="chip${s === draft.season ? ' is-selected' : ''}" data-season="${s}">${s}</button>`).join('');
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
    // 시험을 골랐으면 점수가 있어야 한다. 점수 없이 시험만 고르면 판정에 쓸 수 없다.
    if (draft.langType !== LANG_NONE) {
      if (draft.langScore === null || draft.langScore === '') {
        return { msg: `${draft.langType} 점수를 입력하거나 "아직 없어요"를 선택해 주세요.`, focus: el.langScore };
      }
      if (Number.isNaN(Number(draft.langScore))) {
        return { msg: '어학 점수를 숫자로 입력해 주세요.', focus: el.langScore };
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
  async function saveAndLeave(writes) {
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
    location.replace('home.html');
  }

  function finish() {
    const problem = validate();
    if (problem) return showError(problem.msg, problem.focus);

    const patch = {
      name: draft.name,
      major: draft.major,
      gpa: draft.gpa,
      gpaScale: draft.gpaScale,
      exchangeTerm: { unit: 'semester', season: draft.season, year: draft.year }
    };
    // "아직 없어요"면 languageTests를 건드리지 않는다. 빈 배열을 넣으면 나중에
    // 성적을 추가했을 때와 구분이 안 된다.
    if (draft.langType !== LANG_NONE && draft.langScore !== null && draft.langScore !== '') {
      patch.languageTests = [{ type: draft.langType, score: Number(draft.langScore) }];
    }
    saveAndLeave(() => {
      AppState.updateProfile(patch);
      AppState.markOnboarded();
    });
  }

  /* --------------------------------------------------------------- 연결 */

  // 가입할 때 이름을 적었거나 예전에 저장해 둔 값이 있으면 채워 둔다.
  // 메일 아이디를 그대로 끌어오지는 않는다 — 그건 이름이 아니라 계정 식별자다.
  (function prefillName() {
    const saved = (AppState.profile && AppState.profile.name) || '';
    const meta = (typeof Auth !== 'undefined' && Auth.user && Auth.user.user_metadata) || {};
    const initial = (meta.name || '').trim() || (saved === '회원' ? '' : saved);
    const emailId = (typeof Auth !== 'undefined' && Auth.email) ? Auth.email.split('@')[0] : '';
    draft.name = initial && initial !== emailId ? initial : '';
    el.name.value = draft.name;
  })();

  el.name.addEventListener('input', () => {
    draft.name = el.name.value.trim();
    clearError();
  });

  el.gpa.addEventListener('input', () => {
    draft.gpa = el.gpa.value === '' ? null : parseFloat(el.gpa.value);
    clearError();
  });
  el.scale.addEventListener('change', e => { draft.gpaScale = parseFloat(e.target.value); });
  el.langScore.addEventListener('input', e => {
    draft.langScore = e.target.value === '' ? null : e.target.value;
    clearError();
  });
  el.year.addEventListener('change', e => { draft.year = parseInt(e.target.value, 10); });

  el.langChips.addEventListener('click', e => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    draft.langType = btn.dataset.lang;
    renderLangChips();
    clearError();
    if (draft.langType !== LANG_NONE) el.langScore.focus();
  });

  el.seasons.addEventListener('click', e => {
    const btn = e.target.closest('[data-season]');
    if (!btn) return;
    draft.season = btn.dataset.season;
    el.seasons.querySelectorAll('[data-season]').forEach(b => b.classList.toggle('is-selected', b === btn));
  });

  el.next.addEventListener('click', finish);
  // 답은 저장하지 않되 "물어봤다"는 사실은 남긴다
  el.skip.addEventListener('click', () => saveAndLeave(() => AppState.markOnboarded()));

  // 학과 목록이 늦게 도착하면 그 칸만 다시 그린다
  document.addEventListener('MOCK:updated', renderMajor);

  Auth.init().then(() => {
    if (!Auth.isAuthed) { location.replace('auth.html'); return; }
    renderScale();
    renderYear();
    renderSeasons();
    renderLangChips();
    renderMajor();
  });
})();
