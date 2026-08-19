(function () {
  AppState.load();
  const todayStr = new Date().toISOString ? null : null; // placeholder, real "today" computed below
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const view = { year: now.getFullYear(), month: now.getMonth(), selected: todayIso };

  function todosByDate() {
    const map = {};
    AppState.getTodos().forEach(t => { (map[t.date] = map[t.date] || []).push(t); });
    return map;
  }

  function renderMonth() {
    const map = todosByDate();
    document.getElementById('calTitle').textContent = `${view.year}년 ${view.month + 1}월`;
    const first = new Date(view.year, view.month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-day is-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = map[iso] || [];
      const isToday = iso === todayIso;
      const isSelected = iso === view.selected;
      cells += `
        <button type="button" class="cal-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${iso}">
          <span class="cal-day__num">${d}</span>
          <span class="cal-day__dots">${items.slice(0, 4).map(t => `<span class="cal-day__dot" style="${t.done ? 'opacity:.35' : ''}"></span>`).join('')}</span>
        </button>`;
    }
    document.getElementById('calMonth').innerHTML = cells;
    document.querySelectorAll('.cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => { view.selected = el.dataset.date; renderMonth(); renderSide(); });
    });
  }

  function renderSide() {
    const map = todosByDate();
    const items = (map[view.selected] || []).slice().sort((a, b) => a.title.localeCompare(b.title));
    document.getElementById('calSideDate').textContent = view.selected;
    document.getElementById('calSideList').innerHTML = items.length
      ? items.map(t => `
        <li class="todo-item ${t.done ? 'is-done' : ''}">
          <button class="todo-item__check" data-side-check="${t.id}">${t.done ? '✓' : ''}</button>
          <span class="todo-item__body"><span class="todo-item__title">${t.title}</span><span class="todo-item__meta">${t.tag}</span></span>
        </li>`).join('')
      : `<li class="info-panel__text">이 날짜에는 할 일이 없어요</li>`;

    document.querySelectorAll('[data-side-check]').forEach(btn => {
      btn.addEventListener('click', () => { AppState.toggleTodo(btn.dataset.sideCheck); renderMonth(); renderSide(); });
    });
  }

  document.getElementById('calPrev').addEventListener('click', () => {
    view.month -= 1; if (view.month < 0) { view.month = 11; view.year -= 1; } renderMonth();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    view.month += 1; if (view.month > 11) { view.month = 0; view.year += 1; } renderMonth();
  });

  document.getElementById('addTodoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const date = fd.get('date');
    if (!date) return;
    AppState.addTodo({ title: fd.get('title'), date, tag: fd.get('tag') });
    e.target.reset();
    view.year = parseInt(date.slice(0, 4), 10);
    view.month = parseInt(date.slice(5, 7), 10) - 1;
    view.selected = date;
    renderMonth(); renderSide();
    showToast('할 일을 추가했어요');
  });

  renderMonth();
  renderSide();
})();
