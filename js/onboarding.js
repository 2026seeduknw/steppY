/**
 * 가입 직후 프로필 온보딩.
 *
 * 없을 때 무슨 일이 벌어지냐면 — 가입한 사용자가 GPA·학과가 빈 채로 홈에
 * 떨어지고, 학교 검색의 지원 가능 판정이 전 학교에서 "GPA 정보 필요"로 나온다.
 * 서비스의 핵심 기능이 첫 화면부터 동작하지 않는 셈이라, 가입 직후 최소한의
 * 정보를 받는다.
 *
 * 한 화면에 하나씩 묻는다(앱 온보딩 관습). 어학 성적은 아직 안 본 사람이 많아
 * 건너뛸 수 있게 하고, 상단 "나중에"로 전체를 건너뛸 수도 있다. 어느 쪽이든
 * markOnboarded()로 "물어봤다"는 사실을 남겨 다시 묻지 않는다.
 */
(function () {
  const SEASONS = ['봄학기', '여름학기', '가을학기', '겨울학기'];
  const LANG_TESTS = ['TOEFL', 'IELTS', 'HSK', 'JLPT', 'DELF'];
  const GPA_SCALES = [4.3, 4.5, 4.0];
  const THIS_YEAR = new Date().getFullYear();

  // 입력값을 모아뒀다가 마지막에 한 번에 저장한다 — 중간에 이탈하면
  // 반쯤 채워진 프로필이 남는 것보다 아무것도 안 남는 편이 낫다.
  const draft = {
    major: null,
    gpa: null,
    gpaScale: 4.3,
    langType: 'TOEFL',
    langScore: null,
    season: '가을학기',
    year: THIS_YEAR + 1
  };

  const STEPS = [
    {
      key: 'major',
      title: '어떤 학과에 재학 중인가요?',
      desc: '전공이 비슷한 해외 과목을 찾아드릴 때 씁니다.',
      render: majorStep,
      validate: () => draft.major ? null : '학과를 선택해 주세요.'
    },
    {
      key: 'gpa',
      title: '학점이 어떻게 되나요?',
      desc: '지원 가능한 학교를 가려내는 데 쓰입니다. 나중에 언제든 고칠 수 있어요.',
      render: gpaStep,
      validate: () => {
        if (draft.gpa === null || Number.isNaN(draft.gpa)) return '학점을 입력해 주세요.';
        if (draft.gpa < 0 || draft.gpa > draft.gpaScale) return `0 ~ ${draft.gpaScale} 사이로 입력해 주세요.`;
        return null;
      }
    },
    {
      key: 'lang',
      title: '어학 성적이 있나요?',
      desc: '아직 없다면 건너뛰어도 됩니다. 등록하면 어학 기준까지 함께 판정해요.',
      render: langStep,
      optional: true,
      validate: () => {
        if (draft.langScore === null || draft.langScore === '') return null;
        return Number.isNaN(Number(draft.langScore)) ? '점수를 숫자로 입력해 주세요.' : null;
      }
    },
    {
      key: 'term',
      title: '언제 교환학생을 가고 싶나요?',
      desc: '준비 일정과 마감을 이 시기에 맞춰 안내합니다.',
      render: termStep,
      validate: () => null
    }
  ];

  let current = 0;

  const el = {
    back: document.getElementById('obBack'),
    skip: document.getElementById('obSkip'),
    progress: document.getElementById('obProgress'),
    stepLabel: document.getElementById('obStepLabel'),
    title: document.getElementById('obTitle'),
    desc: document.getElementById('obDesc'),
    body: document.getElementById('obBody'),
    error: document.getElementById('obError'),
    next: document.getElementById('obNext')
  };

  /* ------------------------------------------------------------ 단계 렌더 */

  function majorStep(mount) {
    mount.innerHTML = '<div data-major-mount></div>';
    // 학과 목록은 Supabase에서 비동기로 온다. 아직이면 도착 후 다시 그린다.
    if (!MOCK.yonseiMajors.length) {
      mount.innerHTML = '<p class="ob__loading">학과 목록을 불러오는 중이에요…</p>';
      return;
    }
    const select = createSearchableSelect({
      items: MOCK.yonseiMajors.map(m => ({ value: m.majorName, label: m.majorName, group: m.college })),
      selected: draft.major,
      multiple: false,
      placeholder: '학과를 검색해서 선택하세요',
      onChange: (value) => { draft.major = value; clearError(); }
    });
    mount.querySelector('[data-major-mount]').replaceWith(select.el);
  }

  function gpaStep(mount) {
    mount.innerHTML = `
      <label class="field ob__field">
        <span>학점</span>
        <input type="number" inputmode="decimal" step="0.01" min="0" id="obGpa"
               value="${draft.gpa === null ? '' : draft.gpa}" placeholder="예: 3.62">
      </label>
      <label class="field ob__field">
        <span>기준</span>
        <select id="obScale">
          ${GPA_SCALES.map(v => `<option value="${v}" ${v === draft.gpaScale ? 'selected' : ''}>${v} 만점</option>`).join('')}
        </select>
      </label>`;
    const gpa = mount.querySelector('#obGpa');
    gpa.addEventListener('input', () => { draft.gpa = gpa.value === '' ? null : parseFloat(gpa.value); clearError(); });
    mount.querySelector('#obScale').addEventListener('change', e => { draft.gpaScale = parseFloat(e.target.value); });
    gpa.focus();
  }

  function langStep(mount) {
    mount.innerHTML = `
      <label class="field ob__field">
        <span>시험</span>
        <select id="obLangType">
          ${LANG_TESTS.map(t => `<option ${t === draft.langType ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label class="field ob__field">
        <span>점수</span>
        <input type="number" inputmode="numeric" id="obLangScore"
               value="${draft.langScore === null ? '' : draft.langScore}" placeholder="예: 96">
      </label>`;
    mount.querySelector('#obLangType').addEventListener('change', e => { draft.langType = e.target.value; });
    mount.querySelector('#obLangScore').addEventListener('input', e => {
      draft.langScore = e.target.value === '' ? null : e.target.value;
      clearError();
    });
  }

  function termStep(mount) {
    const years = [THIS_YEAR, THIS_YEAR + 1, THIS_YEAR + 2];
    mount.innerHTML = `
      <label class="field ob__field">
        <span>연도</span>
        <select id="obYear">
          ${years.map(y => `<option value="${y}" ${y === draft.year ? 'selected' : ''}>${y}년</option>`).join('')}
        </select>
      </label>
      <div class="field ob__field">
        <span>학기</span>
        <div class="ob__chips" id="obSeasons">
          ${SEASONS.map(s => `<button type="button" class="chip ${s === draft.season ? 'is-selected' : ''}" data-season="${s}">${s}</button>`).join('')}
        </div>
      </div>`;
    mount.querySelector('#obYear').addEventListener('change', e => { draft.year = parseInt(e.target.value, 10); });
    mount.querySelector('#obSeasons').addEventListener('click', e => {
      const btn = e.target.closest('[data-season]');
      if (!btn) return;
      draft.season = btn.dataset.season;
      mount.querySelectorAll('[data-season]').forEach(b => b.classList.toggle('is-selected', b === btn));
    });
  }

  /* ------------------------------------------------------------ 화면 제어 */

  function clearError() { el.error.hidden = true; }

  function showError(text) {
    el.error.textContent = text;
    el.error.hidden = false;
  }

  function render() {
    const step = STEPS[current];
    clearError();
    el.stepLabel.textContent = `${current + 1} / ${STEPS.length}`;
    el.title.textContent = step.title;
    el.desc.textContent = step.desc;
    el.back.hidden = current === 0;
    el.next.textContent = current === STEPS.length - 1 ? '시작하기' : '다음';
    el.progress.innerHTML = STEPS
      .map((_, i) => `<span class="ob__dot ${i <= current ? 'is-done' : ''}"></span>`).join('');
    el.progress.setAttribute('aria-valuenow', String(current + 1));
    step.render(el.body);
  }

  function goNext() {
    const step = STEPS[current];
    const problem = step.validate();
    if (problem) return showError(problem);
    if (current < STEPS.length - 1) {
      current += 1;
      render();
      window.scrollTo({ top: 0 });
      return;
    }
    finish();
  }

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
    const patch = {
      major: draft.major,
      gpa: draft.gpa,
      gpaScale: draft.gpaScale,
      exchangeTerm: { unit: 'semester', season: draft.season, year: draft.year }
    };
    if (draft.langScore !== null && draft.langScore !== '') {
      patch.languageTests = [{ type: draft.langType, score: Number(draft.langScore) }];
    }
    saveAndLeave(() => {
      AppState.updateProfile(patch);
      AppState.markOnboarded();
    });
  }

  function skip() {
    // 답은 저장하지 않되 "물어봤다"는 사실은 남긴다
    saveAndLeave(() => AppState.markOnboarded());
  }

  el.next.addEventListener('click', goNext);
  el.back.addEventListener('click', () => { if (current > 0) { current -= 1; render(); } });
  el.skip.addEventListener('click', skip);

  // 학과 목록이 늦게 도착하면 그 단계만 다시 그린다
  document.addEventListener('MOCK:updated', () => {
    if (STEPS[current].key === 'major') render();
  });

  Auth.init().then(() => {
    if (!Auth.isAuthed) { location.replace('auth.html'); return; }
    render();
  });
})();
