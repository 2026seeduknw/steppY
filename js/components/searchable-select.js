/**
 * 검색 가능한 드롭다운(콤보박스). 단일/다중 선택 모두 지원.
 *
 * createSearchableSelect({
 *   items: [{ value, label, group? }],
 *   selected: string | string[] | null,   // multiple이면 배열, 아니면 단일 값
 *   multiple: boolean,
 *   placeholder: string,
 *   onChange: (selected) => void          // multiple이면 배열, 아니면 단일 값(string|null)
 * }) -> { el, setSelected(v), getSelected() }
 */
function createSearchableSelect(opts) {
  const { items, multiple = false, placeholder = '선택' } = opts;
  const onChange = opts.onChange || (() => {});
  let selected = multiple ? new Set(opts.selected || []) : (opts.selected ?? null);
  let query = '';
  let open = false;

  const root = document.createElement('div');
  root.className = 'ss';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'ss__trigger';
  root.appendChild(trigger);

  const panel = document.createElement('div');
  panel.className = 'ss__panel';
  panel.hidden = true;

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'ss__search';
  searchInput.placeholder = '검색...';
  panel.appendChild(searchInput);

  const list = document.createElement('div');
  list.className = 'ss__list';
  panel.appendChild(list);
  root.appendChild(panel);

  function labelOf(value) {
    const item = items.find(i => i.value === value);
    return item ? item.label : value;
  }

  function triggerText() {
    if (multiple) {
      const n = selected.size;
      if (n === 0) return placeholder;
      const first = labelOf([...selected][0]);
      return n > 1 ? `${first} 외 ${n - 1}개` : first;
    }
    return selected ? labelOf(selected) : placeholder;
  }

  function isEmpty() { return multiple ? selected.size === 0 : !selected; }

  function renderTrigger() {
    trigger.innerHTML = '';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'ss__trigger-label' + (isEmpty() ? ' is-placeholder' : '');
    labelSpan.textContent = triggerText();
    const chevron = document.createElement('span');
    chevron.className = 'ss__chevron';
    chevron.textContent = '▾';
    trigger.appendChild(labelSpan);
    trigger.appendChild(chevron);
  }

  function renderList() {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(i => !q || i.label.toLowerCase().includes(q));
    list.innerHTML = '';
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'ss__empty';
      empty.textContent = '검색 결과가 없어요';
      list.appendChild(empty);
      return;
    }
    let lastGroup = null;
    filtered.forEach(item => {
      if (item.group && item.group !== lastGroup) {
        const groupEl = document.createElement('div');
        groupEl.className = 'ss__group';
        groupEl.textContent = item.group;
        list.appendChild(groupEl);
        lastGroup = item.group;
      }
      const isSel = multiple ? selected.has(item.value) : selected === item.value;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ss__option' + (isSel ? ' is-selected' : '');
      if (multiple) {
        const check = document.createElement('span');
        check.className = 'ss__check';
        check.textContent = isSel ? '✓' : '';
        btn.appendChild(check);
      }
      btn.appendChild(document.createTextNode(item.label));
      btn.addEventListener('click', () => {
        if (multiple) {
          if (selected.has(item.value)) selected.delete(item.value); else selected.add(item.value);
          renderList();
          renderTrigger();
          onChange([...selected]);
        } else {
          selected = item.value;
          closePanel();
          renderTrigger();
          onChange(selected);
        }
      });
      list.appendChild(btn);
    });
  }

  function onDocClick(e) { if (!root.contains(e.target)) closePanel(); }
  function onKeydown(e) { if (e.key === 'Escape') closePanel(); }

  /**
   * 목록이 다른 카드 뒤로 숨는 문제.
   *
   * 목록은 트리거 아래로 흘러넘쳐 다음 카드 위에 걸친다. 그런데 앱 화면의 카드는
   * backdrop-filter(유리)를 쓰고, backdrop-filter 는 그 자체로 새 쌓임 맥락을
   * 만든다. 그러면 뒤에 오는 카드가 통째로 앞 카드 위에 그려지고, 목록의
   * z-index:50 은 자기 카드 안에서만 유효해서 아무 소용이 없다.
   *
   * 그래서 열려 있는 동안만 이 셀렉트를 품은 카드를 통째로 위로 올린다.
   * (닫을 때 원래 값으로 되돌린다 — 계속 올려두면 이번엔 이 카드가 남을 가린다)
   */
  const HOST_SELECTOR = '.card, .target-major, .info-panel, .filter-panel';
  let raisedHost = null;
  function raiseHost() {
    const host = root.closest(HOST_SELECTOR);
    if (!host) return;
    raisedHost = { host, z: host.style.zIndex, pos: host.style.position };
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.zIndex = '60';
  }
  function restoreHost() {
    if (!raisedHost) return;
    raisedHost.host.style.zIndex = raisedHost.z;
    raisedHost.host.style.position = raisedHost.pos;
    raisedHost = null;
  }

  /**
   * 펼칠 방향과 높이. 학교 창 맨 아래(붙박이 바)처럼 아래 공간이 없는 곳에서는 목록이
   * 화면 밖으로 내려가 끝까지 스크롤할 수 없었다 — 아래가 좁으면 위로 펼치고,
   * 어느 쪽이든 남은 공간만큼만 높이를 잡아 목록 안에서 스크롤되게 한다.
   */
  function placePanel() {
    const r = trigger.getBoundingClientRect();
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const GAP = 6, EDGE = 12, MAX = 320;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const up = below < Math.min(MAX, 200) && above > below;
    panel.classList.toggle('ss__panel--up', up);
    panel.style.maxHeight = Math.max(140, Math.min(MAX, up ? above : below)) + 'px';
  }

  function openPanel() {
    if (open) return;
    open = true;
    raiseHost();
    panel.hidden = false;
    placePanel();
    query = '';
    searchInput.value = '';
    renderList();
    requestAnimationFrame(() => searchInput.focus());
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKeydown, true);
  }
  function closePanel() {
    if (!open) return;
    open = false;
    restoreHost();
    panel.hidden = true;
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKeydown, true);
  }

  trigger.addEventListener('click', () => { open ? closePanel() : openPanel(); });
  searchInput.addEventListener('input', () => { query = searchInput.value; renderList(); });

  renderTrigger();

  return {
    el: root,
    setSelected(v) {
      selected = multiple ? new Set(v || []) : (v ?? null);
      renderTrigger();
      if (open) renderList();
    },
    getSelected() { return multiple ? [...selected] : selected; }
  };
}
