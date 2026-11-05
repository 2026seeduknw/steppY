/**
 * 페이지 안 드롭다운 — <select> 를 누르면 휴대폰 기본 선택창 대신 칸 바로 아래로 목록을 편다.
 *
 * 기본 선택창(iOS 휠, 안드로이드 팝업)은 화면을 통째로 가리고 앱과 모양이 따로 놀았다.
 * <select> 자체는 그대로 둔다 — 칸 모양·폭·고른 값 표시는 각 화면의 CSS 와 브라우저가 그대로 하고,
 * 여기서는 "눌렀을 때 무엇이 열리느냐"만 바꾼다. 고르면 select.value 를 바꾸고 change 를 보내므로
 * 각 화면의 기존 코드(change 리스너, FormData)는 손대지 않아도 된다.
 *
 * (처음에는 select 를 숨기고 그 자리에 버튼을 새로 만들었다. 그러자 화면마다 `select` 에 걸어 둔
 *  폭 규칙이 버튼에는 하나도 안 걸려, 학교 찾기의 빠른 필터 셋이 각각 360px로 늘어나 화면 밖으로 밀렸다.)
 *
 * 바꾸지 않으려면 <select data-native="true">. 여러 개 고르는 select(multiple)는 그대로 둔다.
 */
(function () {
  if (window.__steppyDropdown) return;
  window.__steppyDropdown = true;

  let current = null;   // { select, panel }
  const isCustom = (el) => el && el.tagName === 'SELECT' && !el.multiple && el.dataset.native !== 'true' && !el.disabled;

  function open(select) {
    close();
    const panel = document.createElement('div');
    panel.className = 'dd__panel';
    panel.setAttribute('role', 'listbox');
    if (select.getAttribute('aria-label')) panel.setAttribute('aria-label', select.getAttribute('aria-label'));
    const rows = [];
    const addOption = (opt) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'dd__option';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', opt.index === select.selectedIndex ? 'true' : 'false');
      row.disabled = opt.disabled;
      row.innerHTML = '<span class="dd__option-text"></span><span class="dd__check" aria-hidden="true"></span>';
      row.querySelector('.dd__option-text').textContent = opt.textContent.trim();
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (select.selectedIndex !== opt.index) {
          select.selectedIndex = opt.index;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        close();
        select.focus({ preventScroll: true });
      });
      panel.appendChild(row);
      rows.push(row);
    };
    [...select.children].forEach((child) => {
      if (child.tagName === 'OPTGROUP') {
        const head = document.createElement('div');
        head.className = 'dd__group';
        head.textContent = child.label;
        panel.appendChild(head);
        [...child.children].forEach(addOption);
      } else if (child.tagName === 'OPTION') addOption(child);
    });
    document.body.appendChild(panel);

    // 칸 바로 아래에, 아래 자리가 모자라면 위로. 화면 밖으로 나가지 않게 좌우를 붙잡는다
    const r = select.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, gap = 6, edge = 8;
    panel.style.minWidth = Math.min(r.width, vw - edge * 2) + 'px';
    panel.style.maxWidth = (vw - edge * 2) + 'px';
    const below = vh - r.bottom - gap - 12, above = r.top - gap - 12;
    const up = below < 220 && above > below;
    panel.style.maxHeight = Math.max(160, Math.min(360, up ? above : below)) + 'px';
    const pw = panel.offsetWidth;
    panel.style.left = Math.max(edge, Math.min(r.left, vw - pw - edge)) + 'px';
    if (up) panel.style.bottom = (vh - r.top + gap) + 'px';
    else panel.style.top = (r.bottom + gap) + 'px';

    select.classList.add('dd--open');
    select.setAttribute('aria-expanded', 'true');
    current = { select, panel };
    const on = rows.find(rw => rw.getAttribute('aria-selected') === 'true');
    if (on) on.scrollIntoView({ block: 'nearest' });
    requestAnimationFrame(() => panel.classList.add('is-open'));

    panel.addEventListener('keydown', (e) => {
      const i = rows.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (rows[i + 1] || rows[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (rows[i - 1] || rows[rows.length - 1]).focus(); }
    });
  }

  function close() {
    if (!current) return;
    current.select.classList.remove('dd--open');
    current.select.setAttribute('aria-expanded', 'false');
    current.panel.remove();
    current = null;
  }

  // 기본 선택창이 뜨는 길목(누름·터치·키보드)을 막고 그 자리에서 목록을 연다
  const toggle = (select) => { if (current && current.select === select) close(); else open(select); };
  document.addEventListener('mousedown', (e) => {
    if (!isCustom(e.target)) return;
    e.preventDefault();
    toggle(e.target);
  }, true);
  // iOS 는 mousedown 을 막아도 터치 끝에서 휠을 띄운다 — 터치 끝도 막는다(그 뒤 mousedown 은 오지 않는다)
  document.addEventListener('touchend', (e) => {
    if (!isCustom(e.target)) return;
    e.preventDefault();
    toggle(e.target);
  }, { capture: true, passive: false });
  document.addEventListener('keydown', (e) => {
    if (isCustom(e.target) && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open(e.target);
      return;
    }
    if (e.key === 'Escape' && current) { const s = current.select; close(); s.focus(); }
  }, true);
  document.addEventListener('click', (e) => {
    if (!current) return;
    if (current.panel.contains(e.target) || e.target === current.select) return;
    close();
  });
  // 화면이 움직이면 목록이 칸에서 떨어져 보인다 — 닫는다(목록 안 스크롤은 제외)
  window.addEventListener('scroll', (e) => { if (current && !current.panel.contains(e.target)) close(); }, true);
  window.addEventListener('resize', close);
})();
