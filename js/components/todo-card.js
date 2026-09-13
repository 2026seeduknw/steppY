/**
 * 오늘의 할 일 (§4.2) — F2/F4 공통, 최대 4개 노출.
 *
 * 할 일 추가는 원래 캘린더 화면의 폼이 담당했는데, 캘린더를 없애면서 유일한
 * 추가 경로가 사라졌다. 그래서 이 카드 안으로 폼을 옮겼다 — 카드 헤더의
 * "+ 추가"를 누르면 인라인 폼이 열린다.
 */
function renderTodoCard(mount, options) {
  const adding = !!(options && options.adding);
  mount.innerHTML = todoCardTemplate(adding);

  mount.querySelectorAll('[data-todo-check]').forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.toggleTodo(cb.dataset.todoCheck);
      renderTodoCard(mount, { adding });
    });
  });

  const toggle = mount.querySelector('[data-todo-add-toggle]');
  toggle.addEventListener('click', () => renderTodoCard(mount, { adding: !adding }));

  const form = mount.querySelector('[data-todo-add-form]');
  if (!form) return;

  // 폼이 열리면 바로 입력할 수 있게 커서를 둔다
  form.elements.title.focus();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = (fd.get('title') || '').trim();
    const date = fd.get('date');
    if (!title || !date) return;
    AppState.addTodo({ title, date, tag: fd.get('tag') });
    renderTodoCard(mount, { adding: false });
    if (typeof showToast === 'function') showToast('할 일을 추가했어요');
  });
}

function todoCardTemplate(adding) {
  const todos = AppState.getTodos().slice(0, 4);
  const total = todos.length;
  const remaining = todos.filter(t => !t.done).length;
  const done = total - remaining;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return `
    <div class="section-title">
      <div><h2>오늘의 할 일</h2></div>
      <button type="button" class="btn--text" data-todo-add-toggle>${adding ? '취소' : '+ 추가'}</button>
    </div>
    <div class="todo-card__progress">
      ${progressRingHtml(percent, { size: 56, color: percent === 100 ? 'var(--mint-500)' : 'var(--sky-500)' })}
      <div class="todo-card__progress-text">
        <span class="todo-card__progress-count"><strong>${done}/${total}</strong> 완료</span>
        <span class="todo-card__progress-sub">오늘 남은 일 ${remaining}개</span>
      </div>
    </div>
    ${adding ? todoAddFormHtml() : ''}
    <ul class="todo-list">
      ${todos.map(t => `
        <li class="todo-item ${t.done ? 'is-done' : ''}">
          <button class="todo-item__check" data-todo-check="${t.id}" aria-label="완료 처리">${t.done ? '✓' : ''}</button>
          <div class="todo-item__body">
            <span class="todo-item__title">${t.title}</span>
            <span class="todo-item__meta">${t.date} · ${t.tag}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function todoAddFormHtml() {
  const tags = ['서류', '지원', '어학', '기타'];
  return `
    <form class="todo-add-form" data-todo-add-form>
      <input type="text" name="title" placeholder="할 일" required>
      <div class="todo-add-form__row">
        <input type="date" name="date" required>
        <select name="tag">${tags.map(t => `<option>${t}</option>`).join('')}</select>
      </div>
      <button type="submit" class="btn btn--primary btn--sm">추가하기</button>
    </form>
  `;
}
