/**
 * 오늘의 할 일 (§4.2) — F2/F4 공통, 최대 4개 노출 + 남은 개수 N/N 표시.
 */
function renderTodoCard(mount) {
  mount.innerHTML = todoCardTemplate();
  mount.querySelectorAll('[data-todo-check]').forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.toggleTodo(cb.dataset.todoCheck);
      renderTodoCard(mount);
    });
  });
}

function todoCardTemplate() {
  const todos = AppState.getTodos().slice(0, 4);
  const remaining = todos.filter(t => !t.done).length;
  return `
    <div class="section-title">
      <div><span class="eyebrow">TODAY</span><h2>오늘의 할 일</h2></div>
      <a href="calendar.html" class="badge badge--neutral tnum">${remaining}/${todos.length}</a>
    </div>
    <ul class="todo-list">
      ${todos.map(t => `
        <li class="todo-item ${t.done ? 'is-done' : ''}">
          <button class="todo-item__check" data-todo-check="${t.id}" aria-label="완료 처리">${t.done ? '✓' : ''}</button>
          <a class="todo-item__body" href="calendar.html">
            <span class="todo-item__title">${t.title}</span>
            <span class="todo-item__meta">${t.date} · ${t.tag}</span>
          </a>
        </li>
      `).join('')}
    </ul>
    <a class="btn--text" href="calendar.html">캘린더에서 전체 보기 →</a>
  `;
}
