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

  function openPanel() {
    if (open) return;
    open = true;
    panel.hidden = false;
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
