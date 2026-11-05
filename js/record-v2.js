/**
 * 기록하기 v2 — 저장소 · 폴더 안(다이어리 페이지) · 페이지 꾸미기.
 *
 * Figma "기록하기 탭 시안"(저장소 / 폴더 안(보기) / 폴더 안(꾸미기) / 꾸미기·배경)을 옮긴 것.
 * 폴더 데이터와 아이콘, 폴더 꾸미기 시트는 js/diary-archive.js(DiaryArchive)를 그대로 쓴다.
 *
 * 다이어리 페이지 한 장 = 기록(user_journal 행) 하나. 페이지에 붙인 사진·글·스티커의 자리와
 * 배경은 이 기기(localStorage)에만 저장한다 — 서버 테이블은 아직 없다. 꾸민 적이 없는 기록은
 * 기록 내용(사진·본문·위치)으로 기본 배치를 만들어 보여준다.
 *
 * 좌표는 모두 "페이지 너비 = 1" 단위다. 페이지 높이는 너비의 PAGE_RATIO 배.
 */
(function (global) {
  const PAGE_RATIO = 600 / 362;   // 시안의 페이지 362 × 600
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pad = (n) => String(n).padStart(2, '0');
  const STICKERS = ['🌊', '⭐', '✈️', '🚲', '☕', '📍', '🍂', '🌸', '🍀', '🎵', '📸', '💌', '🌙', '☀️', '🍰', '🎞️'];
  const BGS = [
    { key: 'white', label: '흰색' },
    { key: 'cream', label: '크림' },
    { key: 'grid', label: '모눈' },
    { key: 'lined', label: '유선' },
    { key: 'upload', label: '업로드' }
  ];
  const TEMPLATES = [
    { key: 'collage', label: '콜라주' },
    { key: 'hero', label: '한 장 크게' },
    { key: 'pair', label: '나란히' },
    { key: 'film', label: '필름' }
  ];

  let ctx = null;

  /* ------------------------------------------------------------ 저장 */
  const storeKey = () => `steppy_pages_v1_${(typeof Auth !== 'undefined' && Auth.userId) || 'guest'}`;
  function loadPages() { try { return JSON.parse(localStorage.getItem(storeKey()) || '{}') || {}; } catch (e) { return {}; } }
  function savePages(all) {
    try { localStorage.setItem(storeKey(), JSON.stringify(all)); return true; }
    catch (e) { window.alert('이 기기의 저장 공간이 부족해요. 올린 사진을 줄이거나 지운 뒤 다시 저장해 주세요.'); return false; }
  }
  // 방금 만든 기록은 서버 uuid가 도착하면 id가 바뀐다 — 꾸며 둔 페이지도 따라 옮긴다
  document.addEventListener('journal:idchanged', (ev) => {
    const { from, to } = ev.detail || {};
    if (!from || !to) return;
    const all = loadPages();
    if (all[from]) { all[to] = all[from]; delete all[from]; savePages(all); }
  });

  /* ------------------------------------------------------------ 기본 배치 */
  const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const PHOTO_SLOTS = [
    { x: 0.066, y: 0.077, w: 0.541, h: 0.652, rot: -2 },
    { x: 0.558, y: 0.249, w: 0.376, h: 0.470, rot: 3 },
    { x: 0.486, y: 0.823, w: 0.442, h: 0.331, rot: -1 },
    { x: 0.090, y: 1.200, w: 0.380, h: 0.280, rot: 2 }
  ];
  function placeOf(e) {
    const loc = e.location || {};
    return loc.city || loc.place || loc.name || loc.country || '';
  }
  function defaultPage(e) {
    const items = [];
    (e.photos || []).slice(0, 4).forEach((p, i) => items.push(Object.assign({ id: uid(), type: 'photo', path: p }, PHOTO_SLOTS[i])));
    const text = (e.body || '').trim();
    if (text) items.push({ id: uid(), type: 'memo', text: text.length > 70 ? text.slice(0, 68) + '…' : text, x: 0.066, y: 0.818, w: 0.387, h: 0.354, rot: -1.5 });
    const place = placeOf(e);
    if (place) items.push({ id: uid(), type: 'place', text: place, x: 0.066, y: 1.431, w: 0.36, h: 0.083, rot: 0 });
    items.forEach((it, i) => { it.z = i + 1; });
    return { bg: 'cream', bgImg: '', items };
  }
  function pageOf(e) {
    const saved = loadPages()[e.id] || (e.tempId && loadPages()[e.tempId]);
    return saved ? JSON.parse(JSON.stringify(saved)) : defaultPage(e);
  }

  /* ------------------------------------------------------------ 페이지 그리기 */
  function srcOf(it) { return it.src || (it.path && ctx ? ctx.photoUrl(it.path) : '') || ''; }
  function itemStyle(it) {
    return `left:${it.x * 100}%;top:${(it.y / PAGE_RATIO) * 100}%;width:${it.w * 100}%;height:${(it.h / PAGE_RATIO) * 100}%;` +
      `transform:rotate(${it.rot || 0}deg);z-index:${it.z || 1};`;
  }
  function itemInner(it) {
    if (it.type === 'photo') {
      const src = srcOf(it);
      return src ? `<img src="${esc(src)}" alt="" draggable="false">` : '<span class="rec-it__ph" aria-hidden="true"></span>';
    }
    if (it.type === 'memo' || it.type === 'text') return `<span class="rec-it__text" style="font-size:${(it.fs || (it.type === 'memo' ? 0.036 : 0.05)) * 100}cqw">${esc(it.text)}</span>`;
    if (it.type === 'sticker') return `<span class="rec-it__emoji" style="font-size:${it.w * 72}cqw">${esc(it.emoji)}</span>`;
    if (it.type === 'place') return `<span class="rec-it__text">📍 ${esc(it.text)}</span>`;
    return '';
  }
  function pageHtml(page, extraClass) {
    const bgStyle = page.bg === 'upload' && page.bgImg ? ` style="background-image:url('${page.bgImg}')"` : '';
    return `
      <div class="rec-page rec-page--${esc(page.bg || 'cream')}${extraClass ? ' ' + extraClass : ''}"${bgStyle}>
        <div class="rec-page__items">
          ${page.items.map(it => `<div class="rec-it rec-it--${it.type}" data-it="${esc(it.id)}" style="${itemStyle(it)}">${itemInner(it)}</div>`).join('')}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------ 레이어(전체 화면) 공통 */
  const layers = [];
  function openLayer(cls, label) {
    const el = document.createElement('div');
    el.className = `rec-layer ${cls}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', label);
    document.body.appendChild(el);
    document.body.classList.add('is-sheet-open');
    layers.push(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
    return el;
  }
  function closeLayer(el) {
    const i = layers.indexOf(el);
    if (i >= 0) layers.splice(i, 1);
    el.classList.remove('is-open');
    if (!layers.length) document.body.classList.remove('is-sheet-open');
    setTimeout(() => el.remove(), 320);
  }
  const headHtml = (title, right) => `
    <div class="rec-top">
      <button type="button" class="rec-top__back" data-close aria-label="뒤로">‹</button>
      <div class="rec-top__title"><b>${esc(title)}</b><small>steppY</small></div>
      <div class="rec-top__right">${right || ''}</div>
    </div>`;

  /* ------------------------------------------------------------ 저장소 */
  let storage = null, sortKey = 'recent';
  function latestDate(f) { return DiaryArchive.entriesOfNode(f).reduce((m, e) => (e.date > m ? e.date : m), ''); }
  function sortedFolders() {
    const list = DiaryArchive.folders().map((f, i) => ({ f, i }));
    if (sortKey === 'name') list.sort((a, b) => a.f.name.localeCompare(b.f.name, 'ko'));
    else if (sortKey === 'count') list.sort((a, b) => DiaryArchive.itemsOf(b.f).length - DiaryArchive.itemsOf(a.f).length || a.i - b.i);
    else list.sort((a, b) => latestDate(b.f).localeCompare(latestDate(a.f)) || a.i - b.i);
    return list.map(x => x.f);
  }
  function folderTile(f, scope) {
    return `
      <button type="button" class="rec-folder" data-folder="${esc(f.id)}" aria-label="${esc(f.name)} 폴더 열기, 길게 누르면 꾸미기">
        ${DiaryArchive.folderIcon(f, scope + '-' + f.id)}
        <span class="rec-folder__name">${esc(f.name)}</span>
        <span class="rec-folder__meta">${f.type === 'monthly' ? '자동' : DiaryArchive.itemsOf(f).length + '장'}</span>
      </button>`;
  }
  function renderStorage() {
    if (!storage) return;
    const SORTS = [['recent', '최근'], ['name', '이름순'], ['count', '사진 많은 순']];
    storage.querySelector('.rec-layer__body').innerHTML = `
      <header class="v2-head rec-head">
        <p class="v2-head__eyebrow">Your</p>
        <h1 class="v2-head__title">STORAGE</h1>
      </header>
      <div class="rec-chips">
        ${SORTS.map(([k, l]) => `<button type="button" class="rec-chip${k === sortKey ? ' is-on' : ''}" data-sort="${k}" aria-pressed="${k === sortKey}">${l}</button>`).join('')}
        <button type="button" class="rec-chip rec-chip--add" data-new>+ 폴더</button>
      </div>
      <div class="rec-grid">${sortedFolders().map(f => folderTile(f, 'st')).join('')}</div>`;
  }
  function openStorage(c) {
    ctx = c;
    if (storage) return;
    storage = openLayer('rec-storage', '저장소');
    storage.innerHTML = headHtml('저장소') + '<div class="rec-layer__body"></div>';
    renderStorage();
    storage.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) { const s = storage; storage = null; closeLayer(s); return; }
      const so = ev.target.closest('[data-sort]');
      if (so) { sortKey = so.dataset.sort; renderStorage(); return; }
      if (ev.target.closest('[data-new]')) { if (!ctx.needLogin()) DiaryArchive.createFolder(); return; }
      const b = ev.target.closest('[data-folder]');
      if (b && !b._long) { const hit = DiaryArchive.findNode(b.dataset.folder); if (hit) openFolder(ctx, hit.node); }
    });
    wireLongPress(storage);
  }
  /** 폴더를 길게 누르면(또는 우클릭) 폴더 꾸미기 시트 */
  function wireLongPress(scope) {
    let timer = null;
    scope.addEventListener('pointerdown', (ev) => {
      const b = ev.target.closest('[data-folder]');
      if (!b) return;
      b._long = false;
      const sx = ev.clientX, sy = ev.clientY;
      timer = setTimeout(() => {
        b._long = true;
        const hit = DiaryArchive.findNode(b.dataset.folder);
        if (hit && !ctx.needLogin()) DiaryArchive.editFolder(hit.node);
      }, 520);
      const cancel = (e2) => {
        if (e2.type === 'pointermove' && Math.hypot(e2.clientX - sx, e2.clientY - sy) < 8) return;
        clearTimeout(timer);
        scope.removeEventListener('pointermove', cancel);
        scope.removeEventListener('pointerup', cancel);
        scope.removeEventListener('pointercancel', cancel);
      };
      scope.addEventListener('pointermove', cancel);
      scope.addEventListener('pointerup', cancel);
      scope.addEventListener('pointercancel', cancel);
    });
    scope.addEventListener('contextmenu', (ev) => {
      const b = ev.target.closest('[data-folder]');
      if (!b) return;
      ev.preventDefault();
      b._long = true;
      const hit = DiaryArchive.findNode(b.dataset.folder);
      if (hit && !ctx.needLogin()) DiaryArchive.editFolder(hit.node);
    });
  }

  /* ------------------------------------------------------------ 폴더 안(다이어리 보기) */
  let folderView = null, folderNode = null, folderIndex = 0;
  function folderEntries() {
    return DiaryArchive.entriesOfNode(folderNode).slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function metaLine(e) {
    const info = DiaryArchive.infoOf(e);
    const w = info.weather ? ` · ${info.weather.label}${info.weather.temp != null ? ` ${info.weather.temp}°` : ''}` : '';
    return `${e.date.replace(/-/g, '.')}${w}`;
  }
  function renderFolder() {
    if (!folderView) return;
    const list = folderEntries();
    folderIndex = Math.min(folderIndex, Math.max(0, list.length - 1));
    folderView.querySelector('.rec-top__title b').textContent = folderNode.name;
    const editBtn = folderView.querySelector('[data-decorate]');
    editBtn.hidden = !list.length;
    const body = folderView.querySelector('.rec-layer__body');
    if (!list.length) {
      body.innerHTML = `
        <div class="rec-fempty">
          ${DiaryArchive.folderIcon(folderNode, 'fe-' + folderNode.id)}
          <p class="rec-fempty__title">아직 담긴 기록이 없어요</p>
          <p class="rec-fempty__sub">${folderNode.type === 'monthly' ? '사진을 기록하면 날짜순으로 자동으로 모여요' : '사진 기록을 이 폴더에 담으면 한 장씩 다이어리 페이지가 돼요'}</p>
          ${folderNode.type === 'monthly' || folderNode.virtual ? '' : '<button type="button" class="rec-pill rec-pill--dark" data-pick>+ 기록 담기</button>'}
        </div>`;
      return;
    }
    body.innerHTML = `
      <div class="rec-ftitle">
        <h2 class="rec-ftitle__h" id="recFTitle"></h2>
        <p class="rec-ftitle__meta" id="recFMeta"></p>
      </div>
      <div class="rec-pages" id="recPages">
        ${list.map((e, i) => `<div class="rec-pages__slot" data-i="${i}">${pageHtml(pageOf(e))}</div>`).join('')}
      </div>
      <div class="rec-pager">
        <span class="rec-pager__num" id="recPagerNum"></span>
        <span class="rec-pager__dots" id="recPagerDots">${list.length > 1 ? list.map((_, i) => `<i data-i="${i}"></i>`).join('') : ''}</span>
        ${folderNode.type === 'monthly' || folderNode.virtual ? '' : '<button type="button" class="rec-pager__add" data-pick>+ 기록 담기</button>'}
      </div>`;
    const track = body.querySelector('#recPages');
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== folderIndex) { folderIndex = i; syncPager(); }
    }, { passive: true });
    requestAnimationFrame(() => { track.scrollLeft = folderIndex * track.clientWidth; syncPager(); });
    syncPager();
  }
  function syncPager() {
    const list = folderEntries();
    const e = list[folderIndex];
    if (!e || !folderView) return;
    const t = folderView.querySelector('#recFTitle');
    if (!t) return;
    t.textContent = e.title || placeOf(e) || '그날의 기록';
    folderView.querySelector('#recFMeta').textContent = metaLine(e);
    folderView.querySelector('#recPagerNum').textContent = `${folderIndex + 1} / ${list.length}`;
    folderView.querySelectorAll('#recPagerDots i').forEach((d, i) => d.classList.toggle('is-on', i === folderIndex));
  }
  function openFolder(c, node) {
    ctx = c;
    folderNode = node; folderIndex = 0;
    if (!folderView) {
      folderView = openLayer('rec-folderview', node.name);
      folderView.innerHTML = headHtml(node.name, '<button type="button" class="rec-top__action" data-decorate>꾸미기</button>') + '<div class="rec-layer__body"></div>';
      folderView.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-close]')) { const f = folderView; folderView = null; closeLayer(f); return; }
        if (ev.target.closest('[data-pick]')) { if (!ctx.needLogin()) DiaryArchive.openPicker(folderNode); return; }
        if (ev.target.closest('[data-decorate]')) {
          if (ctx.needLogin()) return;
          const e = folderEntries()[folderIndex];
          if (e) openEditor(e);
          return;
        }
        const dot = ev.target.closest('#recPagerDots [data-i]');
        if (dot) { const tr = folderView.querySelector('#recPages'); tr.scrollTo({ left: Number(dot.dataset.i) * tr.clientWidth, behavior: 'smooth' }); return; }
        const img = ev.target.closest('.rec-it--photo img');
        if (img) {
          const e = folderEntries()[folderIndex];
          const imgs = [...img.closest('.rec-page').querySelectorAll('.rec-it--photo img')];
          const info = DiaryArchive.infoOf(e);
          DiaryArchive.openPhotos(imgs.map(im => ({ url: im.src, info })), imgs.indexOf(img), imgs);
        }
      });
    }
    renderFolder();
  }

  /* ------------------------------------------------------------ 폴더 고르기(+ 폴더에 담기) */
  function chooseFolder(c, entryIds) {
    ctx = c;
    const list = DiaryArchive.folders().filter(f => f.type !== 'monthly');
    const el = document.createElement('div');
    el.className = 'arc-sheet';
    el.innerHTML = `
      <div class="arc-sheet__scrim" data-close></div>
      <div class="arc-sheet__panel rec-fsheet" role="dialog" aria-label="담을 폴더 고르기">
        <div class="arc-sheet__grip"></div>
        <h3 class="rec-fsheet__title">어느 폴더에 담을까요?</h3>
        <p class="rec-fsheet__sub">오늘 기록 ${entryIds.length}개를 담아요</p>
        <div class="rec-grid rec-grid--sheet">${list.map(f => folderTile(f, 'ch')).join('')}</div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-on')));
    const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 340); };
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) { close(); return; }
      const b = ev.target.closest('[data-folder]');
      if (!b) return;
      const hit = DiaryArchive.findNode(b.dataset.folder);
      if (!hit) return;
      const added = DiaryArchive.addEntries(hit.node, entryIds);
      close();
      toast(added ? `‘${hit.node.name}’에 담았어요` : `이미 ‘${hit.node.name}’에 있어요`);
    });
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'rec-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-on'));
    setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => t.remove(), 300); }, 1800);
  }

  /* ------------------------------------------------------------ 페이지 꾸미기 */
  let ed = null;   // { el, entry, page, sel, tool, hist, at, dirty }
  const TOOLS = [
    { key: 'photo', label: '사진 추가', icon: '+' },
    { key: 'text', label: '텍스트', icon: '✎' },
    { key: 'sticker', label: '스티커', icon: '☺' },
    { key: 'template', label: '템플릿', icon: '▦' },
    { key: 'bg', label: '배경', icon: '▤' }
  ];

  function openEditor(entry) {
    const el = openLayer('rec-editor', '페이지 꾸미기');
    ed = { el, entry, page: pageOf(entry), sel: null, tool: 'sticker', hist: [], at: -1, dirty: false };
    el.innerHTML = `
      <div class="rec-etop">
        <button type="button" class="rec-etop__cancel" data-cancel>취소</button>
        <div class="rec-etop__hist">
          <button type="button" data-undo aria-label="되돌리기">↶</button>
          <button type="button" data-redo aria-label="다시 하기">↷</button>
        </div>
        <button type="button" class="rec-etop__save" data-save>저장</button>
      </div>
      <div class="rec-ecanvas"><div class="rec-ecanvas__page" id="recEdPage"></div></div>
      <div class="rec-etools">
        <div class="rec-etools__row">${TOOLS.map(t => `
          <button type="button" class="rec-tool" data-tool="${t.key}">
            <span class="rec-tool__ic" aria-hidden="true">${t.icon}</span>
            <span class="rec-tool__lb">${t.label}</span>
          </button>`).join('')}</div>
        <div class="rec-etools__panel" id="recEdPanel"></div>
      </div>
      <input type="file" accept="image/*" id="recEdFile" hidden>`;
    pushHist();
    drawEditor();
    drawPanel();
    el.addEventListener('click', onEditorClick);
    el.querySelector('#recEdFile').addEventListener('change', onFile);
    wireCanvas(el.querySelector('#recEdPage'));
  }

  function pushHist() {
    ed.hist = ed.hist.slice(0, ed.at + 1);
    ed.hist.push(JSON.stringify(ed.page));
    if (ed.hist.length > 60) ed.hist.shift();
    ed.at = ed.hist.length - 1;
    if (ed.hist.length > 1) ed.dirty = true;
    syncHist();
  }
  function syncHist() {
    ed.el.querySelector('[data-undo]').disabled = ed.at <= 0;
    ed.el.querySelector('[data-redo]').disabled = ed.at >= ed.hist.length - 1;
  }
  function stepHist(d) {
    const n = ed.at + d;
    if (n < 0 || n >= ed.hist.length) return;
    ed.at = n;
    ed.page = JSON.parse(ed.hist[n]);
    if (ed.sel && !ed.page.items.some(i => i.id === ed.sel)) ed.sel = null;
    drawEditor(); drawPanel(); syncHist();
  }

  function drawEditor() {
    const host = ed.el.querySelector('#recEdPage');
    host.innerHTML = pageHtml(ed.page, 'is-editing') + '<span class="rec-guide" aria-hidden="true"></span>';
    if (ed.sel) markSelected();
  }
  function markSelected() {
    const host = ed.el.querySelector('#recEdPage');
    host.querySelectorAll('.rec-sel').forEach(n => n.remove());
    host.querySelectorAll('.is-selected').forEach(n => n.classList.remove('is-selected'));
    const node = ed.sel && host.querySelector(`[data-it="${ed.sel}"]`);
    if (!node) return;
    node.classList.add('is-selected');   // 고르는 동안은 맨 위로 — 손잡이와 삭제 막대가 다른 것에 가리지 않게
    const editable = /memo|text|place/.test(node.className);
    node.insertAdjacentHTML('beforeend', `
      <span class="rec-sel" aria-hidden="true">
        <span class="rec-sel__stem"></span>
        <span class="rec-sel__rot" data-h="rot">↻</span>
        <span class="rec-sel__h rec-sel__h--tl" data-h="scale"></span>
        <span class="rec-sel__h rec-sel__h--tr" data-h="scale"></span>
        <span class="rec-sel__h rec-sel__h--bl" data-h="scale"></span>
        <span class="rec-sel__h rec-sel__h--br" data-h="scale"></span>
        <span class="rec-sel__bar">
          <button type="button" data-del>삭제</button>
          <button type="button" data-front>맨 앞으로</button>
          ${editable ? '<button type="button" data-edit-text>글 고치기</button>' : ''}
        </span>
      </span>`);
  }
  const item = (id) => ed.page.items.find(i => i.id === id);
  const topZ = () => ed.page.items.reduce((m, i) => Math.max(m, i.z || 0), 0) + 1;

  function drawPanel() {
    ed.el.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('is-on', b.dataset.tool === ed.tool));
    const p = ed.el.querySelector('#recEdPanel');
    if (ed.tool === 'photo') {
      const photos = (ed.entry.photos || []).map(path => ({ path, url: ctx.photoUrl(path) })).filter(x => x.url);
      p.innerHTML = `<div class="rec-opts">
        ${photos.map(x => `<button type="button" class="rec-opt rec-opt--img" data-add-photo="${esc(x.path)}" aria-label="이 기록의 사진 붙이기"><img src="${esc(x.url)}" alt="" draggable="false"></button>`).join('')}
        <button type="button" class="rec-opt rec-opt--upload" data-upload="photo" aria-label="앨범에서 사진 올리기">+</button>
      </div>`;
    } else if (ed.tool === 'text') {
      p.innerHTML = `<div class="rec-opts">
        <button type="button" class="rec-opt rec-opt--wide" data-add-text="memo"><span class="rec-opt__memo">메모지</span></button>
        <button type="button" class="rec-opt rec-opt--wide" data-add-text="text"><span class="rec-opt__plain">Aa 글자</span></button>
      </div>`;
    } else if (ed.tool === 'sticker') {
      p.innerHTML = `<div class="rec-opts rec-opts--scroll">${STICKERS.map(s => `<button type="button" class="rec-opt" data-add-sticker="${s}">${s}</button>`).join('')}</div>`;
    } else if (ed.tool === 'template') {
      p.innerHTML = `<div class="rec-opts">${TEMPLATES.map(t => `
        <button type="button" class="rec-opt rec-opt--tpl" data-template="${t.key}"><span class="rec-tpl rec-tpl--${t.key}" aria-hidden="true"><i></i><i></i><i></i></span><small>${t.label}</small></button>`).join('')}</div>`;
    } else if (ed.tool === 'bg') {
      p.innerHTML = `<div class="rec-opts rec-opts--labeled">${BGS.map(b => `
        <button type="button" class="rec-opt rec-opt--bg${(ed.page.bg || 'cream') === b.key ? ' is-on' : ''}" data-bg="${b.key}" aria-pressed="${(ed.page.bg || 'cream') === b.key}">
          <span class="rec-bgsw rec-page--${b.key}"${b.key === 'upload' && ed.page.bgImg ? ` style="background-image:url('${ed.page.bgImg}')"` : ''}>${b.key === 'upload' && !ed.page.bgImg ? '+' : ''}</span>
          <small>${b.label}</small>
        </button>`).join('')}</div>`;
    }
  }

  function addItem(it) {
    it.id = uid(); it.z = topZ();
    ed.page.items.push(it);
    ed.sel = it.id;
    pushHist(); drawEditor();
    return it;
  }
  /** 화면 가운데쯤(지금 보이는 자리)에 붙인다 */
  function centerY(h) {
    const scroller = ed.el.querySelector('.rec-ecanvas');
    const page = ed.el.querySelector('.rec-page');
    const W = page.clientWidth;
    const midPx = scroller.scrollTop + scroller.clientHeight / 2 - page.offsetTop;
    return Math.max(0.02, Math.min(PAGE_RATIO - h - 0.02, midPx / W - h / 2));
  }

  function onEditorClick(ev) {
    const t = ev.target;
    if (t.closest('[data-cancel]')) {
      if (ed.dirty && !window.confirm('꾸민 내용을 저장하지 않고 나갈까요?')) return;
      const el = ed.el; ed = null; closeLayer(el); return;
    }
    if (t.closest('[data-save]')) {
      const all = loadPages();
      all[ed.entry.id] = ed.page;
      if (!savePages(all)) return;
      const el = ed.el; ed = null; closeLayer(el);
      renderFolder();
      toast('저장했어요');
      return;
    }
    if (t.closest('[data-undo]')) { stepHist(-1); return; }
    if (t.closest('[data-redo]')) { stepHist(1); return; }
    const tool = t.closest('[data-tool]');
    if (tool) { ed.tool = tool.dataset.tool; drawPanel(); return; }
    const ph = t.closest('[data-add-photo]');
    if (ph) { const h = 0.5; addItem({ type: 'photo', path: ph.dataset.addPhoto, x: 0.25, y: centerY(h), w: 0.42, h, rot: 0 }); return; }
    const up = t.closest('[data-upload]');
    if (up) { const f = ed.el.querySelector('#recEdFile'); f.dataset.for = up.dataset.upload; f.click(); return; }
    const tx = t.closest('[data-add-text]');
    if (tx) {
      const memo = tx.dataset.addText === 'memo';
      const text = window.prompt(memo ? '메모지에 적을 말' : '넣을 글자', '');
      if (!text || !text.trim()) return;
      const h = memo ? 0.3 : 0.12;
      addItem({ type: memo ? 'memo' : 'text', text: text.trim(), x: memo ? 0.3 : 0.15, y: centerY(h), w: memo ? 0.4 : 0.7, h, rot: memo ? -1.5 : 0 });
      return;
    }
    const st = t.closest('[data-add-sticker]');
    if (st) { addItem({ type: 'sticker', emoji: st.dataset.addSticker, x: 0.44, y: centerY(0.12), w: 0.12, h: 0.12, rot: 0 }); return; }
    const tp = t.closest('[data-template]');
    if (tp) { applyTemplate(tp.dataset.template); return; }
    const bg = t.closest('[data-bg]');
    if (bg) {
      if (bg.dataset.bg === 'upload' && !ed.page.bgImg) { const f = ed.el.querySelector('#recEdFile'); f.dataset.for = 'bg'; f.click(); return; }
      if (bg.dataset.bg === 'upload' && ed.page.bg === 'upload') { const f = ed.el.querySelector('#recEdFile'); f.dataset.for = 'bg'; f.click(); return; }
      ed.page.bg = bg.dataset.bg; pushHist(); drawEditor(); drawPanel(); return;
    }
    if (t.closest('[data-del]')) {
      ed.page.items = ed.page.items.filter(i => i.id !== ed.sel); ed.sel = null; pushHist(); drawEditor(); return;
    }
    if (t.closest('[data-front]')) { const it = item(ed.sel); if (it) { it.z = topZ(); pushHist(); drawEditor(); } return; }
    if (t.closest('[data-edit-text]')) { editText(item(ed.sel)); return; }
  }
  function editText(it) {
    if (!it) return;
    const text = window.prompt('글 고치기', it.text || '');
    if (text == null) return;
    if (!text.trim()) { ed.page.items = ed.page.items.filter(i => i.id !== it.id); ed.sel = null; }
    else it.text = text.trim();
    pushHist(); drawEditor();
  }

  /** 올린 사진은 긴 변 900px JPEG로 줄여서 이 기기에 넣는다 */
  function shrink(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ data: c.toDataURL('image/jpeg', 0.82), ratio: c.height / c.width });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  async function onFile(ev) {
    const input = ev.target;
    const file = input.files && input.files[0];
    const target = input.dataset.for;
    input.value = '';
    if (!file || !ed) return;
    try {
      const { data, ratio } = await shrink(file, 900);
      if (target === 'bg') { ed.page.bg = 'upload'; ed.page.bgImg = data; pushHist(); drawEditor(); drawPanel(); return; }
      const w = 0.46, h = Math.min(0.9, w * ratio);
      addItem({ type: 'photo', src: data, x: 0.27, y: centerY(h), w, h, rot: 0 });
    } catch (e) { window.alert('사진을 읽지 못했어요. 다른 사진으로 해 볼까요?'); }
  }

  /** 템플릿 — 사진·메모 자리를 정해진 배치로 다시 놓는다(스티커·글자는 그대로) */
  function applyTemplate(key) {
    const photos = ed.page.items.filter(i => i.type === 'photo');
    const memo = ed.page.items.find(i => i.type === 'memo');
    const SLOTS = {
      collage: PHOTO_SLOTS,
      hero: [{ x: 0.08, y: 0.08, w: 0.84, h: 0.95, rot: 0 }, { x: 0.52, y: 1.12, w: 0.4, h: 0.4, rot: 3 }, { x: 0.08, y: 1.12, w: 0.4, h: 0.4, rot: -3 }],
      pair: [{ x: 0.06, y: 0.12, w: 0.43, h: 0.6, rot: -2 }, { x: 0.51, y: 0.16, w: 0.43, h: 0.6, rot: 2 }, { x: 0.06, y: 0.86, w: 0.43, h: 0.45, rot: 1 }, { x: 0.51, y: 0.86, w: 0.43, h: 0.45, rot: -1 }],
      film: [{ x: 0.2, y: 0.05, w: 0.6, h: 0.42, rot: 0 }, { x: 0.2, y: 0.53, w: 0.6, h: 0.42, rot: 0 }, { x: 0.2, y: 1.01, w: 0.6, h: 0.42, rot: 0 }, { x: 0.2, y: 1.49, w: 0.6, h: 0.1, rot: 0 }]
    }[key];
    const MEMO = { collage: { x: 0.066, y: 0.818, w: 0.387, h: 0.354, rot: -1.5 }, hero: { x: 0.3, y: 1.25, w: 0.4, h: 0.3, rot: -1 }, pair: { x: 0.3, y: 1.36, w: 0.4, h: 0.24, rot: -1 }, film: { x: 0.62, y: 1.3, w: 0.34, h: 0.28, rot: 3 } }[key];
    photos.forEach((p, i) => {
      const s = SLOTS[i];
      if (s) Object.assign(p, s);
      else Object.assign(p, { x: 0.1 + (i % 3) * 0.28, y: 1.3, w: 0.26, h: 0.2, rot: (i % 2 ? 3 : -3) });
    });
    if (memo && MEMO) Object.assign(memo, MEMO);
    if (key === 'film') ed.page.bg = 'white';
    pushHist(); drawEditor(); drawPanel();
  }

  /* ---- 캔버스: 끌기 · 모서리로 크기 · 고리로 회전 · 두 손가락으로 크기와 회전 ---- */
  function wireCanvas(host) {
    const pts = new Map();
    let g = null;   // 지금 하는 동작
    const pageRect = () => host.querySelector('.rec-page').getBoundingClientRect();
    const toPage = (cx, cy) => { const r = pageRect(); return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.width, W: r.width }; };
    const center = (it) => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 });
    const guide = (on) => { const gl = host.querySelector('.rec-guide'); if (gl) gl.classList.toggle('is-on', on); };
    const applyTo = (it) => {
      const node = host.querySelector(`[data-it="${it.id}"]`);
      if (!node) return;
      node.style.cssText = itemStyle(it);
      const emo = node.querySelector('.rec-it__emoji');
      if (emo) emo.style.fontSize = `${it.w * 72}cqw`;
    };

    host.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.rec-sel__bar')) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      // 두 번째 손가락 — 고른 것의 크기·회전
      if (pts.size === 2 && ed.sel) {
        const it = item(ed.sel);
        const [a, b] = [...pts.values()];
        g = { kind: 'pinch', it, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), w0: it.w, h0: it.h, r0: it.rot || 0, c0: center(it) };
        return;
      }
      const h = ev.target.closest('[data-h]');
      const node = ev.target.closest('[data-it]');
      if (h && ed.sel) {
        const it = item(ed.sel);
        const p = toPage(ev.clientX, ev.clientY);
        const c = center(it);
        g = { kind: h.dataset.h, it, c, d0: Math.hypot(p.x - c.x, p.y - c.y), a0: Math.atan2(p.y - c.y, p.x - c.x), w0: it.w, h0: it.h, r0: it.rot || 0, moved: false };
        host.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        return;
      }
      if (node) {
        const id = node.dataset.it;
        if (ed.sel !== id) { ed.sel = id; markSelected(); }
        const it = item(id);
        const p = toPage(ev.clientX, ev.clientY);
        g = { kind: 'move', it, dx: p.x - it.x, dy: p.y - it.y, moved: false };
        host.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        return;
      }
      if (ed.sel) { ed.sel = null; markSelected(); }
      g = null;
    });
    host.addEventListener('pointermove', (ev) => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!g) return;
      const it = g.it;
      if (g.kind === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const s = Math.max(0.25, Math.min(4, Math.hypot(b.x - a.x, b.y - a.y) / g.d0));
        it.w = Math.max(0.06, g.w0 * s); it.h = Math.max(0.04, g.h0 * s);
        it.rot = g.r0 + (Math.atan2(b.y - a.y, b.x - a.x) - g.a0) * 180 / Math.PI;
        it.x = g.c0.x - it.w / 2; it.y = g.c0.y - it.h / 2;
        g.moved = true; applyTo(it); return;
      }
      const p = toPage(ev.clientX, ev.clientY);
      if (g.kind === 'move') {
        let x = p.x - g.dx;
        const y = Math.max(-it.h * 0.5, Math.min(PAGE_RATIO - it.h * 0.5, p.y - g.dy));
        x = Math.max(-it.w * 0.5, Math.min(1 - it.w * 0.5, x));
        // 가운데선 가까이 오면 붙는다(시안의 가운데 안내선)
        const snap = Math.abs(x + it.w / 2 - 0.5) < 0.015;
        if (snap) x = 0.5 - it.w / 2;
        guide(snap);
        it.x = x; it.y = y; g.moved = true; applyTo(it); return;
      }
      if (g.kind === 'scale') {
        const s = Math.max(0.25, Math.min(4, Math.hypot(p.x - g.c.x, p.y - g.c.y) / g.d0));
        it.w = Math.max(0.06, g.w0 * s); it.h = Math.max(0.04, g.h0 * s);
        it.x = g.c.x - it.w / 2; it.y = g.c.y - it.h / 2;
        g.moved = true; applyTo(it); return;
      }
      if (g.kind === 'rot') {
        let r = g.r0 + (Math.atan2(p.y - g.c.y, p.x - g.c.x) - g.a0) * 180 / Math.PI;
        const near = Math.round(r / 90) * 90;
        if (Math.abs(r - near) < 4) r = near;   // 똑바로(0·90°) 근처에서는 붙는다
        it.rot = r; g.moved = true; applyTo(it);
      }
    });
    const end = (ev) => {
      pts.delete(ev.pointerId);
      guide(false);
      if (g && g.moved) { pushHist(); markSelected(); }
      if (pts.size === 0) g = null;
      else if (g && g.kind === 'pinch') g = null;
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    host.addEventListener('dblclick', (ev) => {
      const node = ev.target.closest('.rec-it--memo, .rec-it--text, .rec-it--place');
      if (node) editText(item(node.dataset.it));
    });
  }

  // 사진 주소가 늦게 도착하면 열려 있는 화면을 다시 그린다
  document.addEventListener('record:photos', () => { if (storage) renderStorage(); if (folderView && !ed) renderFolder(); });
  document.addEventListener('archive:changed', () => { if (storage) renderStorage(); if (folderView && !ed) renderFolder(); });

  global.RecordV2 = { openStorage, openFolder, chooseFolder };
})(window);
