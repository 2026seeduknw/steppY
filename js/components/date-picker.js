/**
 * 페이지 안 달력 — <input type="date|month"> 를 누르면 휴대폰 기본 달력(iOS 휠·팝업) 대신 칸 바로 아래로 달력을 편다.
 * 페이지 안 드롭다운(dropdown.js)과 같은 방식이다: input 자체는 그대로 두고 "눌렀을 때 무엇이 열리느냐"만 바꾼다.
 * 고르면 input.value(YYYY-MM-DD / YYYY-MM)를 바꾸고 input·change 를 보내므로 화면마다의 기존 코드는 그대로 동작한다.
 *
 * - 날짜: 위에 "‹ 2027년 9월 ›", 가운데를 누르면 그 해의 열두 달로 바뀐다(먼 달로 빨리 가기).
 * - 연월(type=month): 처음부터 열두 달.
 * - min / max 를 지킨다. required 가 아니면 "지우기"가 있다.
 * 바꾸지 않으려면 <input type="date" data-native="true">.
 */
(function () {
  if (window.__steppyDatePicker) return;
  window.__steppyDatePicker = true;

  const isCustom = (el) => el && el.tagName === 'INPUT' && (el.type === 'date' || el.type === 'month')
    && el.dataset.native !== 'true' && !el.disabled;
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  let cur = null;   // { input, panel, y, m, view }

  function todayParts() { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; }
  function parse(v, kind) {
    const m = kind === 'month' ? /^(\d{4})-(\d{2})$/.exec(v || '') : /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: kind === 'month' ? 1 : +m[3] } : null;
  }
  const inRange = (val, input) => (!input.min || val >= input.min) && (!input.max || val <= input.max);

  function open(input) {
    close();
    const kind = input.type;
    const sel = parse(input.value, kind);
    const base = sel || parse(input.min, kind) || todayParts();
    const panel = document.createElement('div');
    panel.className = 'dp__panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', input.getAttribute('aria-label') || (kind === 'month' ? '연월 고르기' : '날짜 고르기'));
    document.body.appendChild(panel);
    cur = { input, panel, kind, y: base.y, m: base.m, view: kind === 'month' ? 'months' : 'days' };
    draw();
    place();
    input.classList.add('dp--open');
    requestAnimationFrame(() => panel.classList.add('is-open'));
    panel.addEventListener('click', onPanelClick);
  }

  function draw() {
    const { input, panel, kind, y, m, view } = cur;
    const sel = parse(input.value, kind);
    const t = todayParts();
    let body;
    if (view === 'months') {
      body = `<div class="dp__months">${Array.from({ length: 12 }, (_, i) => {
        const val = kind === 'month' ? `${y}-${pad(i + 1)}` : iso(y, i, 1).slice(0, 7);
        const ok = kind === 'month' ? inRange(val, input) : (!input.min || val >= input.min.slice(0, 7)) && (!input.max || val <= input.max.slice(0, 7));
        const on = sel && sel.y === y && sel.m === i;
        return `<button type="button" class="dp__cell dp__cell--month${on ? ' is-on' : ''}${t.y === y && t.m === i ? ' is-today' : ''}" data-month="${i}" ${ok ? '' : 'disabled'}>${i + 1}월</button>`;
      }).join('')}</div>`;
    } else {
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      let cells = '';
      for (let i = 0; i < first; i++) cells += '<span class="dp__cell is-blank"></span>';
      for (let d = 1; d <= days; d++) {
        const val = iso(y, m, d);
        const on = sel && sel.y === y && sel.m === m && sel.d === d;
        cells += `<button type="button" class="dp__cell${on ? ' is-on' : ''}${t.y === y && t.m === m && t.d === d ? ' is-today' : ''}" data-day="${d}" ${inRange(val, input) ? '' : 'disabled'}>${d}</button>`;
      }
      body = `<div class="dp__week">${WD.map(w => `<span>${w}</span>`).join('')}</div><div class="dp__days">${cells}</div>`;
    }
    const title = view === 'months' ? `${y}년` : `${y}년 ${m + 1}월`;
    panel.innerHTML = `
      <div class="dp__head">
        <button type="button" class="dp__nav" data-nav="-1" aria-label="${view === 'months' ? '이전 해' : '이전 달'}">‹</button>
        <button type="button" class="dp__title" data-title ${kind === 'month' ? 'disabled' : ''} aria-label="${view === 'months' ? '달력으로' : '달 고르기'}">${title}${kind === 'month' ? '' : ' <span aria-hidden="true">▾</span>'}</button>
        <button type="button" class="dp__nav" data-nav="1" aria-label="${view === 'months' ? '다음 해' : '다음 달'}">›</button>
      </div>
      ${body}
      <div class="dp__foot">
        ${input.required ? '<span></span>' : '<button type="button" class="dp__link" data-clear>지우기</button>'}
        <button type="button" class="dp__link" data-today>${kind === 'month' ? '이번 달' : '오늘'}</button>
      </div>`;
  }

  function place() {
    const { input, panel } = cur;
    const r = input.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, gap = 6, edge = 8;
    const w = Math.min(320, vw - edge * 2);
    panel.style.width = w + 'px';
    const h = panel.offsetHeight;
    const up = vh - r.bottom - gap < h + 12 && r.top - gap > vh - r.bottom;
    panel.style.left = Math.max(edge, Math.min(r.left, vw - w - edge)) + 'px';
    if (up) { panel.style.top = ''; panel.style.bottom = (vh - r.top + gap) + 'px'; }
    else { panel.style.bottom = ''; panel.style.top = Math.min(r.bottom + gap, vh - h - edge) + 'px'; }
  }

  function commit(value) {
    const { input } = cur;
    if (input.value !== value) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
  }

  function onPanelClick(e) {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.nav) {
      const k = Number(b.dataset.nav);
      if (cur.view === 'months') cur.y += k;
      else { cur.m += k; if (cur.m < 0) { cur.m = 11; cur.y--; } if (cur.m > 11) { cur.m = 0; cur.y++; } }
      draw(); return;
    }
    if (b.hasAttribute('data-title')) { cur.view = cur.view === 'days' ? 'months' : 'days'; draw(); place(); return; }
    if (b.dataset.month) {
      const mi = Number(b.dataset.month);
      if (cur.kind === 'month') { commit(`${cur.y}-${pad(mi + 1)}`); return; }
      cur.m = mi; cur.view = 'days'; draw(); place(); return;
    }
    if (b.dataset.day) { commit(iso(cur.y, cur.m, Number(b.dataset.day))); return; }
    if (b.hasAttribute('data-clear')) { commit(''); return; }
    if (b.hasAttribute('data-today')) {
      const t = todayParts();
      const v = cur.kind === 'month' ? `${t.y}-${pad(t.m + 1)}` : iso(t.y, t.m, t.d);
      if (inRange(v, cur.input)) commit(v); else { cur.y = t.y; cur.m = t.m; draw(); }
    }
  }

  function close() {
    if (!cur) return;
    cur.input.classList.remove('dp--open');
    cur.panel.remove();
    cur = null;
  }

  // 기본 달력이 뜨는 길목(누름·터치·키보드)을 막고 그 자리에서 달력을 연다(dropdown.js와 같은 방식)
  const toggle = (input) => { if (cur && cur.input === input) close(); else open(input); };
  document.addEventListener('mousedown', (e) => {
    if (!isCustom(e.target)) return;
    e.preventDefault();
    toggle(e.target);
  }, true);
  document.addEventListener('touchend', (e) => {
    if (!isCustom(e.target)) return;
    e.preventDefault();
    toggle(e.target);
  }, { capture: true, passive: false });
  // 키보드로 들어와도 직접 타이핑 대신 달력
  document.addEventListener('keydown', (e) => {
    if (isCustom(e.target) && [' ', 'Enter', 'ArrowDown'].includes(e.key)) { e.preventDefault(); open(e.target); return; }
    if (e.key === 'Escape' && cur) { const i = cur.input; close(); i.focus(); }
  }, true);
  // 포커스만으로 기본 달력이 뜨는 브라우저가 있어 click 도 막는다
  document.addEventListener('click', (e) => {
    if (isCustom(e.target)) { e.preventDefault(); return; }
    if (cur && !cur.panel.contains(e.target)) close();
  }, true);
  window.addEventListener('scroll', (e) => { if (cur && !cur.panel.contains(e.target)) close(); }, true);
  window.addEventListener('resize', close);
})();
