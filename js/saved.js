/**
 * 내 저장 — 관심 학교 1:1 비교 + D-Day 체크리스트.
 *
 * 비교 대상은 최대 세 곳이다. 1~3지망을 먼저 채우고, 자리가 남으면 즐겨찾기(하트)한
 * 학교로 채운다 — 지망을 아직 안 정한 사람도 하트만 눌러 두면 비교표가 생긴다.
 * 체크리스트는 홈의 할 일(AppState.getTodos)을 날짜순으로 다시 보여주는 것이다.
 * 같은 할 일을 두 군데서 따로 관리하지 않는다.
 */
(function () {
  AppState.load();

  const compareMount = document.getElementById('savedCompare');
  const checklistMount = document.getElementById('savedChecklist');
  const DAY = 24 * 60 * 60 * 1000;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** 비교할 학교들. { school, tag } — tag 는 '1지망' 또는 '찜'. */
  function pickSchools() {
    const wishlist = AppState.getWishlist();
    const picked = [];
    [1, 2, 3].forEach((rank) => {
      const school = wishlist[rank] && MOCK.schools.find((s) => s.id === wishlist[rank]);
      if (school) picked.push({ school, tag: `${rank}지망` });
    });
    (AppState.load().favorites || []).forEach((id) => {
      if (picked.length >= 3 || picked.some((p) => p.school.id === id)) return;
      const school = MOCK.schools.find((s) => s.id === id);
      if (school) picked.push({ school, tag: '찜' });
    });
    return picked;
  }

  /** 그 줄에서 가장 유리한 칸의 인덱스들. 견줄 값이 둘 이상이고 서로 다를 때만 표시한다. */
  function bestIndexes(values, better) {
    const nums = values.filter((v) => v != null);
    if (nums.length < 2) return [];
    const best = better === 'max' ? Math.max(...nums) : Math.min(...nums);
    if (nums.every((v) => v === best)) return [];
    return values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  }

  function renderCompare() {
    const picked = pickSchools();
    if (!picked.length) {
      compareMount.innerHTML = `
        <div class="saved__head"><h2>관심 학교 1:1 비교</h2></div>
        <div class="saved-empty">
          <p class="saved-empty__title">아직 찜한 학교가 없어요</p>
          <p class="saved-empty__sub">학교 찾기에서 하트를 누르거나 지망 순위를 정하면 여기서 나란히 견줄 수 있어요</p>
          <a class="btn btn--accent saved-empty__btn" href="search.html">학교 찾기</a>
        </div>`;
      return;
    }

    const major = AppState.profile && AppState.profile.major;
    const creditMap = buildMajorCreditMap(major);
    const schools = picked.map((p) => p.school);

    // 한 줄 = 견주는 항목 하나. raw 는 비교용 숫자(없으면 null), text 는 화면에 찍는 글자.
    const rows = [
      { label: '슬롯', better: 'max', raw: (s) => (typeof s.slot === 'number' ? s.slot : null), text: (s) => (typeof s.slot === 'number' ? `${s.slot}명` : '-') },
      { label: '한 달 예산', better: 'min', raw: (s) => s.monthlyLivingCostKrw ?? null, text: (s) => (s.monthlyLivingCostKrw != null ? `약 ${Math.round(s.monthlyLivingCostKrw / 10000)}만` : '-') }
    ];
    // 전공을 입력한 사람에게만 인정 과목 줄을 둔다 — 셀 기준이 없으면 전부 '-' 다.
    if (major) rows.push({ label: '인정 과목', better: 'max', raw: (s) => creditMap.get(s.id) ?? null, text: (s) => (creditMap.get(s.id) ? `${creditMap.get(s.id)}개` : '-') });
    rows.push(
      { label: 'GPA 컷', better: 'min', raw: (s) => (typeof s.gpaCut === 'number' ? s.gpaCut : null), text: (s) => formatGpa(s.gpaCut) || s.gpaCut || '-' },
      // 어학 컷은 시험 종류가 같을 때만 숫자로 견줄 수 있다(TOEFL 85 와 IELTS 6.5 는 비교가 안 된다)
      { label: '어학 컷', better: 'min', sameType: true, raw: (s) => (typeof s.langTest.cut === 'number' ? s.langTest.cut : null), text: (s) => (s.langTest.cut != null ? `${s.langTest.type} ${s.langTest.cut}` : '-') }
    );

    const cols = `style="grid-template-columns: 76px repeat(${schools.length}, minmax(0, 1fr))"`;
    const body = rows.map((row) => {
      const comparable = !row.sameType || new Set(schools.map((s) => s.langTest.type)).size === 1;
      const best = comparable ? bestIndexes(schools.map(row.raw), row.better) : [];
      return `
        <div class="compare__row" ${cols}>
          <span class="compare__label">${row.label}</span>
          ${schools.map((s, i) => `<span class="compare__cell${best.includes(i) ? ' is-best' : ''}">${esc(row.text(s))}</span>`).join('')}
        </div>`;
    }).join('');

    compareMount.innerHTML = `
      <div class="saved__head">
        <h2>관심 학교 1:1 비교</h2>
        <span class="saved__meta">${schools.length}곳</span>
      </div>
      <div class="compare card">
        <div class="compare__row compare__row--head" ${cols}>
          <span></span>
          ${picked.map((p) => `
            <button type="button" class="compare__school" data-open-school="${p.school.id}">
              <span class="compare__flag" aria-hidden="true">${countryFlag(p.school.countryEn)}</span>
              <span class="compare__name">${esc(p.school.name)}</span>
              <span class="compare__tag">${p.tag}</span>
            </button>`).join('')}
        </div>
        ${body}
      </div>
      <p class="saved__note">${schools.length > 1 ? '옅게 칠한 칸이 그 줄에서 가장 유리한 학교예요. ' : ''}한 달 예산은 자동으로 모은 추정치예요</p>
      ${schools.length < 2 ? '<p class="saved__note">한 곳 더 찜하면 나란히 견줄 수 있어요 · <a href="search.html">학교 찾기</a></p>' : ''}`;

    compareMount.querySelectorAll('[data-open-school]').forEach((el) => {
      el.addEventListener('click', () => openSchoolModal(el.dataset.openSchool, { onChange: renderAll }));
    });
  }

  /** 'YYYY-MM-DD' → 오늘 기준 며칠 남았는지. 날짜가 없으면 null. */
  function daysLeft(iso) {
    if (!iso) return null;
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d)) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / DAY);
  }
  function ddayChip(todo) {
    if (todo.done) return '<span class="dday dday--done">완료</span>';
    const n = daysLeft(todo.date);
    if (n == null) return '<span class="dday dday--none">날짜 없음</span>';
    if (n < 0) return `<span class="dday dday--late">D+${-n}</span>`;
    if (n === 0) return '<span class="dday dday--soon">오늘</span>';
    return `<span class="dday ${n <= 30 ? 'dday--soon' : ''}">D-${n}</span>`;
  }

  function renderChecklist() {
    const info = typeof departureInfo === 'function' ? departureInfo() : { hasRange: false };
    const departure = info.hasRange && info.phase === DEPARTURE_PHASES.BEFORE ? `<span class="saved__dday">출국까지 D-${info.daysUntil}</span>` : '';
    // 안 한 일이 위로, 그 안에서는 가까운 날짜부터. 날짜 없는 일은 맨 뒤.
    const todos = [...AppState.getTodos()].sort((a, b) =>
      Number(a.done) - Number(b.done) || (a.date || '9999').localeCompare(b.date || '9999'));

    const list = todos.length
      ? `<ul class="checklist-dday card">
          ${todos.map((t) => `
            <li class="checklist-dday__item${t.done ? ' is-done' : ''}">
              <label>
                <input type="checkbox" data-todo="${esc(t.id)}" ${t.done ? 'checked' : ''}>
                <span class="checklist-dday__title">${esc(t.title)}</span>
              </label>
              ${ddayChip(t)}
            </li>`).join('')}
        </ul>`
      : `<div class="saved-empty">
          <p class="saved-empty__title">아직 할 일이 없어요</p>
          <p class="saved-empty__sub">비자 신청, 보험 가입처럼 날짜가 있는 일을 홈에서 추가하면 여기에 남은 날과 함께 모여요</p>
          <a class="btn btn--accent saved-empty__btn" href="home.html">홈에서 할 일 추가</a>
        </div>`;

    checklistMount.innerHTML = `
      <div class="saved__head">
        <h2>D-Day 체크리스트</h2>
        ${departure}
      </div>
      ${list}`;

    checklistMount.querySelectorAll('[data-todo]').forEach((box) => {
      box.addEventListener('change', () => { AppState.toggleTodo(box.dataset.todo); renderChecklist(); });
    });
  }

  function renderAll() { renderCompare(); renderChecklist(); }

  renderAll();
  // 로그인 직후에는 게스트 기본값으로 먼저 그려진다. 서버 데이터가 오면 다시 그린다.
  ['MOCK:updated', 'profile:updated'].forEach((ev) => document.addEventListener(ev, renderAll));
})();
