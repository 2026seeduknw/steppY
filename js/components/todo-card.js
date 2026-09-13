/**
 * 오늘의 할 일 — 가로로 긴 알약(pill) 요약 + 펼치면 목록.
 *
 * 홈 첫 화면에서는 "몇 개 중 몇 개 했는지"만 알면 된다. 목록까지 항상 펼쳐두면
 * 정작 아래의 지망 학교가 화면 밖으로 밀린다. 그래서 기본은 접어두고, 알약을
 * 누르면 목록이 열린다. 오른쪽 + 는 추가 폼을 연다(캘린더를 없애면서 유일한
 * 추가 경로가 이 카드로 들어왔다).
 */
function renderTodoCard(mount, options) {
  const opts = options || {};
  const adding = !!opts.adding;
  const expanded = !!opts.expanded;

  mount.innerHTML = todoCardTemplate(adding, expanded);
  const rerender = (next) => renderTodoCard(mount, Object.assign({ adding, expanded }, next));

  mount.querySelector('[data-todo-expand]').addEventListener('click', () => {
    rerender({ expanded: !expanded, adding: false });
  });

  const addToggle = mount.querySelector('[data-todo-add-toggle]');
  if (addToggle) {
    addToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      rerender({ adding: !adding, expanded: true });
    });
  }

  mount.querySelectorAll('[data-todo-check]').forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.toggleTodo(cb.dataset.todoCheck);
      rerender({});
    });
  });

  const form = mount.querySelector('[data-todo-add-form]');
  if (!form) return;
  form.elements.title.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = (fd.get('title') || '').trim();
    const date = fd.get('date');
    if (!title || !date) return;
    AppState.addTodo({ title, date, tag: fd.get('tag') });
    rerender({ adding: false, expanded: true });
    if (typeof showToast === 'function') showToast('할 일을 추가했어요');
  });
}

function todoCardTemplate(adding, expanded) {
  const todos = AppState.getTodos().slice(0, 4);
  const total = todos.length;
  const remaining = todos.filter(t => !t.done).length;
  const done = total - remaining;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return `
    <div class="todo-pill${expanded ? ' is-expanded' : ''}">
      <button type="button" class="todo-pill__summary" data-todo-expand
              aria-expanded="${expanded}" aria-label="오늘의 할 일 ${done}/${total} 완료">
        <span class="todo-pill__ring">
          ${progressRingHtml(percent, { size: 46, color: percent === 100 ? 'var(--mint-500)' : 'var(--sky-500)' })}
        </span>
        <span class="todo-pill__text">
          <span class="todo-pill__count"><strong>${done}</strong><span>/${total}</span></span>
          <span class="todo-pill__label">오늘의 할 일</span>
        </span>
        <span class="todo-pill__caret" aria-hidden="true">${expanded ? '⌃' : '⌄'}</span>
      </button>
      ${AppState.isAuthed ? `
      <button type="button" class="todo-pill__add" data-todo-add-toggle
              aria-label="${adding ? '할 일 추가 취소' : '할 일 추가'}">${adding ? '×' : '+'}</button>` : `
      <a class="todo-pill__add" href="auth.html" aria-label="로그인하고 할 일 추가">+</a>`}
    </div>

    ${expanded ? `
    <div class="todo-panel">
      ${AppState.isAuthed ? '' : `
      <p class="todo-panel__guest">로그인하면 준비 일정을 저장하고 어느 기기에서든 이어서 볼 수 있어요.
        <a href="auth.html">로그인하기 →</a></p>`}
      ${adding ? todoAddFormHtml() : ''}
      <ul class="todo-list">
        ${todos.map(t => `
          <li class="todo-item ${t.done ? 'is-done' : ''}">
            <button class="todo-item__check" data-todo-check="${t.id}" aria-label="완료 처리">${t.done ? '✓' : ''}</button>
            <div class="todo-item__body">
              <span class="todo-item__title">${t.title}</span>
              <span class="todo-item__meta">${t.date} · ${t.tag}</span>
            </div>
          </li>`).join('')}
      </ul>
    </div>` : ''}
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
    </form>`;
}
