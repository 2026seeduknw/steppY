/**
 * 기록하기 — 출국 준비부터 교환 중까지 이어 쓰는 개인 기록.
 *
 * 저장은 Supabase user_journal(소유자 전용 RLS). AppState가 낙관적으로 먼저
 * 화면에 반영하고 쓰기 큐로 서버에 올리므로, 여기서는 서버 응답을 기다리지 않는다.
 *
 * 게스트에게는 입력창을 주지 않는다. 남길 계정이 없어서 새로고침하면 사라지고,
 * 그건 "기록했다"는 이 화면의 약속을 깨는 쪽이다 — 대신 로그인 안내를 둔다.
 */
(function () {
  AppState.load();

  const PHASES = [
    { key: 'prepare', label: '출국 준비' },
    { key: 'abroad', label: '교환 중' }
  ];

  const rootMount = document.getElementById('journalRoot');
  const ledeMount = document.getElementById('journalLede');
  let composeMount = document.getElementById('journalCompose');
  let listMount = document.getElementById('journalList');

  /**
   * 학교를 확정하면 이 탭은 사진 다이어리로 바뀐다(js/diary-view.js).
   * 확정 전에는 아래의 글 기록 화면 그대로다 — 아직 파견 기간도, 찍을 사진도 없고
   * 준비하면서 적어두는 메모가 필요한 시기라서다.
   * 기록은 둘 다 같은 user_journal에 쌓이므로 출국 후에도 준비 때 쓴 글이 남는다.
   */
  function wantsDiary() { return AppState.isAuthed && !!AppState.getConfirmedSchool(); }

  // 마지막으로 고른 단계를 이어 쓴다 — 교환을 떠난 뒤 매번 '교환 중'으로
  // 바꿔야 하면 번거롭다. 이 기기에만 남는 값이라 서버에는 올리지 않는다.
  let phase = localStorage.getItem('steppy_journal_phase') === 'abroad' ? 'abroad' : 'prepare';
  let editingId = null;

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${m}월 ${d}일 (${weekday})`;
  }

  /**
   * 방금 만든 기록은 서버 uuid가 도착하는 순간 id가 바뀐다. 그때 편집 중이었다면
   * 화면이 들고 있던 임시 id로는 더 이상 못 찾으므로, 옛 id로도 찾아준다.
   */
  function findEntry(id) {
    return AppState.getJournal().find(e => e.id === id || e.tempId === id) || null;
  }

  function phaseLabel(key) {
    const found = PHASES.find(p => p.key === key);
    return found ? found.label : PHASES[0].label;
  }

  /* ------------------------------------------------------------- 입력창 */

  function renderCompose() {
    if (!AppState.isAuthed) {
      composeMount.innerHTML = `
        <section class="card card-pad">
          <div class="guest-cta">
            <p class="guest-cta__text">로그인하면 준비 과정과 교환 생활을 <strong>계정에 기록</strong>할 수 있어요</p>
            <a class="btn btn--primary btn--block" href="auth.html">로그인하고 기록 시작하기</a>
          </div>
        </section>`;
      return;
    }

    const editing = editingId ? findEntry(editingId) : null;
    // 찾았으면 최신 id로 갈아끼워, 저장할 때 서버 행을 정확히 가리키게 한다
    if (editing) editingId = editing.id;
    else editingId = null;

    composeMount.innerHTML = `
      <section class="card card-pad journal-compose">
        <div class="journal-compose__head">
          <div class="journal-phase" role="group" aria-label="기록 시점">
            ${PHASES.map(p => `
              <button type="button" class="journal-phase__chip${p.key === phase ? ' is-active' : ''}"
                      data-phase="${p.key}" aria-pressed="${p.key === phase}">${p.label}</button>`).join('')}
          </div>
          <input type="date" class="journal-compose__date" id="journalDate"
                 value="${esc(editing ? editing.date : todayISO())}" aria-label="날짜">
        </div>

        <input type="text" class="journal-compose__title" id="journalTitle"
               placeholder="제목 (선택)" maxlength="80" value="${esc(editing ? editing.title : '')}">
        <textarea class="journal-compose__body" id="journalBody" rows="4"
                  placeholder="오늘 준비하면서 있었던 일, 알게 된 것, 남기고 싶은 말을 적어보세요">${esc(editing ? editing.body : '')}</textarea>

        <div class="journal-compose__actions">
          ${editing ? `<button type="button" class="btn btn--ghost" id="journalCancel">취소</button>` : ''}
          <button type="button" class="btn btn--primary" id="journalSave">${editing ? '수정 저장' : '기록 남기기'}</button>
        </div>
      </section>`;

    composeMount.querySelectorAll('[data-phase]').forEach(btn => {
      btn.addEventListener('click', () => {
        phase = btn.dataset.phase;
        localStorage.setItem('steppy_journal_phase', phase);
        renderCompose();
      });
    });

    const cancel = document.getElementById('journalCancel');
    if (cancel) cancel.addEventListener('click', () => { editingId = null; renderAll(); });

    document.getElementById('journalSave').addEventListener('click', save);
  }

  function save() {
    const date = document.getElementById('journalDate').value || todayISO();
    const title = document.getElementById('journalTitle').value.trim();
    const body = document.getElementById('journalBody').value.trim();

    // 제목만 있고 본문이 없는 기록도 허용한다 — "여권 신청함" 한 줄이 제목에
    // 들어가는 경우가 흔하다. 다만 둘 다 비면 저장할 내용이 없다.
    if (!title && !body) {
      document.getElementById('journalBody').focus();
      return;
    }

    const editing = editingId ? findEntry(editingId) : null;
    if (editing) {
      AppState.updateJournalEntry(editing.id, { date, phase, title, body });
      editingId = null;
    } else {
      AppState.addJournalEntry({ date, phase, title, body });
    }
    renderAll();
  }

  /* --------------------------------------------------------------- 목록 */

  function renderList() {
    const entries = AppState.getJournal();

    if (!entries.length) {
      listMount.innerHTML = AppState.isAuthed
        ? `<section class="card card-pad journal-empty">
             <p class="journal-empty__title">아직 남긴 기록이 없어요</p>
             <p class="journal-empty__desc">서류를 준비한 날, 비자가 나온 날, 도착한 첫날 —<br>나중에 다시 읽고 싶을 순간을 적어두면 돼요</p>
           </section>`
        : '';
      return;
    }

    // 날짜별로 묶어 하루에 여러 번 쓴 기록이 같은 머리글 아래 모이게 한다
    const groups = [];
    entries.forEach(e => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    });

    listMount.innerHTML = groups.map(g => `
      <section class="journal-group">
        <h2 class="journal-group__date">${formatDate(g.date)}</h2>
        ${g.items.map(e => `
          <article class="card card-pad journal-entry" data-id="${esc(e.id)}">
            <div class="journal-entry__head">
              <span class="journal-entry__phase journal-entry__phase--${esc(e.phase)}">${phaseLabel(e.phase)}</span>
              <div class="journal-entry__tools">
                <button type="button" class="journal-entry__tool" data-edit="${esc(e.id)}">수정</button>
                <button type="button" class="journal-entry__tool" data-delete="${esc(e.id)}">삭제</button>
              </div>
            </div>
            ${e.title ? `<h3 class="journal-entry__title">${esc(e.title)}</h3>` : ''}
            ${e.body ? `<p class="journal-entry__body">${esc(e.body)}</p>` : ''}
          </article>`).join('')}
      </section>`).join('');

    listMount.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        editingId = btn.dataset.edit;
        const entry = findEntry(editingId);
        if (entry) phase = entry.phase;
        renderAll();
        composeMount.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    listMount.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
        if (editingId === btn.dataset.delete) editingId = null;
        AppState.deleteJournalEntry(btn.dataset.delete);
        renderAll();
      });
    });
  }

  function renderAll() {
    if (wantsDiary()) {
      ledeMount.hidden = true;
      if (!diaryViewIsMounted()) mountDiaryView(rootMount);
      return;
    }

    // 다이어리에서 글 기록으로 돌아온 경우(학교 확정 취소) 뼈대를 되살린다
    if (diaryViewIsMounted()) {
      unmountDiaryView();
      rootMount.classList.remove('diary-view');
      rootMount.innerHTML = '<div id="journalCompose"></div><div id="journalList"></div>';
      composeMount = document.getElementById('journalCompose');
      listMount = document.getElementById('journalList');
    }
    ledeMount.hidden = false;
    renderCompose();
    renderList();
  }

  renderAll();

  // 서버 기록은 하이드레이션 후에, 방금 만든 기록의 진짜 id는 저장 직후에 도착한다.
  // 둘 다 MOCK:updated로 오는데, 그때마다 입력창을 다시 그리면 쓰던 글이 날아간다.
  // 포커스로 판단하면 안 된다 — 적다가 잠깐 다른 곳을 눌러도 포커스는 떠난다.
  // 적어둔 내용이 있으면 입력창은 그대로 두고 목록만 갱신한다.
  function composeHasInput() {
    const title = document.getElementById('journalTitle');
    const body = document.getElementById('journalBody');
    if (!title || !body) return false;
    return !!(title.value.trim() || body.value.trim());
  }

  document.addEventListener('MOCK:updated', () => {
    if (wantsDiary()) {
      // 하이드레이션으로 기록이 늘었을 수 있다. 이미 떠 있으면 사진만 다시 채운다.
      if (diaryViewIsMounted()) { diaryRefreshPhotos(); return; }
      renderAll();
      return;
    }
    if (composeHasInput()) { renderList(); return; }
    renderAll();
  });
})();
