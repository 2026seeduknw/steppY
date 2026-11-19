/**
 * 할 일 — 가로로 긴 알약(pill) 요약 + 펼치면 목록.
 * ("오늘의"를 뗐다 — 목록에는 오늘 것만이 아니라 마감이 남은 항목이 전부 들어온다)
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
  if (typeof paintWordmarkText === 'function') paintWordmarkText(mount);
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

/**
 * 학교 확정 후 출국 전에는 기본 할 일이 '비자 및 서류 체크리스트'와 같은 항목이다.
 * 같은 목록을 두 번 보여 주지 않도록, 이때 To-Do는 '이번 주' 것만 남긴다:
 * 마감이 7일 안이거나 이미 지났는데 못 끝낸 것 + 직접 추가한 할 일.
 * 날짜 없는 항목은 체크리스트에서만 관리한다.
 */
function todoWeekView(all) {
  const weekly = all.some(t => String(t.id).startsWith('chk-'));
  if (!weekly) return { weekly: false, todos: all, next: null };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const today = ymd(now);
  const limit = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const todos = all.filter(t => {
    if (!t.date) return false;
    if (t.date < today) return !t.done;             // 지난 건 못 끝낸 것만
    if (t.date <= limit) return true;               // 이번 주 마감
    return !String(t.id).startsWith('chk-') && !t.done; // 직접 추가한 할 일은 남긴다
  });
  const next = all.find(t => t.date && t.date > limit && !t.done && !todos.includes(t)) || null;
  return { weekly: true, todos, next, today };
}

function todoDday(date) {
  const [y, m, d] = date.split('-').map(Number);
  const now = new Date();
  const diff = Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  return diff === 0 ? '오늘' : diff < 0 ? '지남' : `D-${diff}`;
}

function todoCardTemplate(adding, expanded) {
  // 예전엔 앞의 4개만 보여서, 새로 추가한(특히 기한이 늦거나 없는) 할 일이 목록에 안 나타났다
  const view = todoWeekView(AppState.getTodos());
  const todos = view.todos;
  const total = todos.length;
  const remaining = todos.filter(t => !t.done).length;
  const done = total - remaining;
  // 이번 주 마감이 없으면 이번 주 몫은 다 한 셈이라 100%
  const percent = total ? Math.round((done / total) * 100) : view.weekly ? 100 : 0;

  return `
    <div class="todo-pill${expanded ? ' is-expanded' : ''}">
      <button type="button" class="todo-pill__summary" data-todo-expand
              aria-expanded="${expanded}" aria-label="할 일 ${done}/${total} 완료">
        <span class="todo-pill__ring">
          ${progressRingHtml(percent, { size: 46, color: 'var(--key-500)' })}
        </span>
        <span class="todo-pill__text">
          <span class="todo-pill__label brand-head" data-wordmark="">To-Do</span>
          ${view.weekly && !total
            ? `<span class="todo-pill__empty">이번 주 마감 없음</span>`
            : `<span class="todo-pill__count"><strong>${done}</strong><span>/${total}</span></span>`}
          ${view.weekly && total ? `<span class="todo-pill__scope">이번 주</span>` : ''}
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
      <ul class="todo-list"${total ? "" : " hidden"}>
        ${todos.map(t => `
          <li class="todo-item ${t.done ? 'is-done' : ''}">
            <button class="todo-item__check" data-todo-check="${t.id}" aria-label="완료 처리">${t.done ? '✓' : ''}</button>
            <div class="todo-item__body">
              <span class="todo-item__title">${t.title}</span>
              <span class="todo-item__meta">${view.weekly && t.date ? `<b class="todo-item__dday${t.date < view.today ? ' is-past' : ''}">${todoDday(t.date)}</b> ` : ''}${t.date || '기한 없음'} · ${t.tag}</span>
            </div>
          </li>`).join('')}
      </ul>
      ${view.weekly ? `
      <p class="todo-panel__foot">
        ${total ? '' : '이번 주에 마감되는 일은 없어요.<br>'}${view.next ? `다음: ${view.next.title} <b>${todoDday(view.next.date)}</b><br>` : ''}<a href="prepare.html#checklistSection">전체 목록은 비자 및 서류 체크리스트에서 →</a>
      </p>` : ''}
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
