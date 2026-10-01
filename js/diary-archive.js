/**
 * 기록하기 — 아카이브 홈: 주제별 폴더 + 친구들 최근 기록 + 사진 확대(위치·날씨·노래).
 *
 * _mock/journal-archive.html 프로토타입을 앱 구조에 맞춰 옮긴 것.
 *   - 폴더는 맥 폴더 아이콘 모양. 안에 뭐가 들었는지는 겉으로 보이지 않고, 열면 사진이 가로로 쭉 나열된다.
 *   - 폴더 안에 폴더를 만들 수 있고, 이름·색·패턴·스티커를 직접 꾸민다. Monthly는 날짜로 YYYY.MM 폴더를 자동으로 만든다.
 *   - 사진을 누르면 살짝 커지고 뒤는 블러, 빈 자리에 위치·날씨·노래가 나온다.
 *
 * 폴더 구조와 꾸밈은 이 기기(localStorage)에만 저장한다 — 서버 테이블은 아직 없다.
 * 폴더에 "담는" 단위는 기록(user_journal 행)이고, 폴더 안에서는 그 기록의 사진들이 펼쳐진다.
 *
 * diary-view.js가 render(root, ctx)로 불러준다. ctx = { entries(), photoUrl(path), needLogin() }.
 */
(function (global) {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pad = (n) => String(n).padStart(2, '0');

  /* ------------------------------------------------------------ 꾸밈 팔레트 */
  const COLORS = {
    beige:    { back: '#cdc2b3', f1: '#e8e0d4', f2: '#ddd3c5', dot: '#8a7a68', sw: '#e3d9cb' },
    pink:     { back: '#ecc0c8', f1: '#fde7eb', f2: '#f7d4db', dot: '#5a1f1f', sw: '#f7d4db' },
    lavender: { back: '#c7c1df', f1: '#e9e5f6', f2: '#dad4ee', dot: '#5b4f86', sw: '#dad4ee' },
    mint:     { back: '#b6d6c6', f1: '#e2f3ea', f2: '#d0e9dd', dot: '#2f6b55', sw: '#d0e9dd' },
    sky:      { back: '#b3cde2', f1: '#deecf8', f2: '#cbdff0', dot: '#3b6285', sw: '#cbdff0' },
    butter:   { back: '#ead798', f1: '#fbf2cf', f2: '#f4e5b0', dot: '#7a6420', sw: '#f4e5b0' },
    peach:    { back: '#efc2a6', f1: '#fee6d6', f2: '#f9d5bd', dot: '#8a4a2a', sw: '#f9d5bd' },
    graphite: { back: '#a7a6a3', f1: '#d2d1ce', f2: '#c0bfbc', dot: '#3b3a38', sw: '#bfbebb' }
  };
  const PATTERNS = { none: '없음', dots: '물방울', stripes: '줄무늬', grid: '격자', checks: '체크' };
  const EMOJIS = ['', '📸', '☕', '🍽️', '✈️', '🏫', '👭', '📄', '🎵', '🌿', '⭐', '🛍️', '🌆', '💌', '🎞️'];

  const defaults = () => [
    { id: 'daily',   name: 'Daily',    color: 'beige',    pattern: 'none',    emoji: '', type: 'manual',  entryIds: [], children: [] },
    { id: 'trip',    name: 'Trip',     color: 'sky',      pattern: 'none',    emoji: '', type: 'manual',  entryIds: [], children: [] },
    { id: 'campus',  name: 'Campus',   color: 'mint',     pattern: 'stripes', emoji: '', type: 'manual',  entryIds: [], children: [] },
    { id: 'friends', name: 'Friends',  color: 'butter',   pattern: 'checks',  emoji: '', type: 'manual',  entryIds: [], children: [] },
    { id: 'korea',   name: 'In Korea', color: 'pink',     pattern: 'dots',    emoji: '', type: 'manual',  entryIds: [], children: [] },
    { id: 'monthly', name: 'Monthly',  color: 'lavender', pattern: 'none',    emoji: '', type: 'monthly', entryIds: [], children: [] }
  ];

  /* ------------------------------------------------------------ 상태 / 저장 */
  let ctx = null, root = null;
  let FOLDERS = [];
  let stack = [];          // 열려 있는 폴더 경로. 비어 있으면 홈.
  let editing = false;
  let page = null;         // 폴더 페이지(전체 화면 레이어)

  const storeKey = () => `steppy_archive_v1_${(typeof Auth !== 'undefined' && Auth.userId) || 'guest'}`;
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey()) || 'null');
      if (Array.isArray(saved) && saved.length) { FOLDERS = saved; return; }
    } catch (e) { /* 저장소를 못 읽으면 기본값 */ }
    FOLDERS = defaults();
  }
  function save() { try { localStorage.setItem(storeKey(), JSON.stringify(FOLDERS)); } catch (e) { /* 무시 */ } }

  // 방금 만든 기록의 id는 서버 uuid가 도착하면 바뀐다(state.js) — 폴더에 담아 둔 id도 같이 바꾼다
  document.addEventListener('journal:idchanged', (ev) => {
    const { from, to } = ev.detail || {};
    if (!from || !to) return;
    let changed = false;
    (function walk(list) {
      list.forEach(f => {
        const i = (f.entryIds || []).indexOf(from);
        if (i >= 0) { f.entryIds[i] = to; changed = true; }
        walk(f.children || []);
      });
    })(FOLDERS);
    if (changed) save();
  });

  /* ------------------------------------------------------------ 데이터 → 화면용 */
  const allEntries = () => (ctx ? ctx.entries() : []);
  const withPhotos = (e) => (e.photos || []).some(p => ctx.photoUrl(p));

  function entriesOfNode(node) {
    const all = allEntries().filter(withPhotos);
    if (node.type === 'monthly') return all;
    const ids = new Set(node.entryIds || []);
    return all.filter(e => ids.has(e.id) || (e.tempId && ids.has(e.tempId)));
  }
  /** 폴더 안의 사진들 — 기록마다 사진이 여러 장이면 모두 펼친다 */
  function itemsOf(node) {
    return entriesOfNode(node).flatMap(e => (e.photos || []).map(p => ({ entry: e, url: ctx.photoUrl(p) })).filter(x => x.url));
  }
  /** Monthly 폴더의 하위 폴더 — 기록 날짜로 YYYY.MM 을 자동으로 만든다(저장하지 않는 가상 폴더) */
  function monthNodes(node) {
    const groups = {};
    entriesOfNode(node).forEach(e => { const m = e.date.slice(0, 7).replace('-', '.'); (groups[m] = groups[m] || []).push(e.id); });
    return Object.keys(groups).sort().reverse().map(m => ({ id: `m-${node.id}-${m}`, name: m, color: 'beige', pattern: 'none', emoji: '', type: 'manual', entryIds: groups[m], children: [], virtual: true }));
  }
  const kidsOf = (node) => (node.type === 'monthly' ? monthNodes(node) : (node.children || []));
  function findNode(id, list = FOLDERS, parent = null) {
    for (const f of list) {
      if (f.id === id) return { node: f, list, parent };
      const r = findNode(id, kidsOf(f), f);
      if (r) return r;
    }
    return null;
  }

  /* ------------------------------------------------------------ 폴더 아이콘(SVG) */
  const BACK = 'M8 28 C8 15 16 8 30 8 H70 C80 8 86 12 92 20 C97 27 103 31 114 31 H178 C190 31 196 39 196 52 V136 C196 149 190 155 178 155 H26 C13 155 8 149 8 136 Z';
  function patternDef(kind, uid, dot) {
    const id = `arc-p-${uid}`;
    if (kind === 'dots')    return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="2.1" fill="${dot}"/><circle cx="16.5" cy="16.5" r="2.1" fill="${dot}"/></pattern>`;
    if (kind === 'stripes') return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="14" fill="${dot}" opacity=".28"/></pattern>`;
    if (kind === 'grid')    return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="${dot}" stroke-opacity=".3" stroke-width="1.2"/></pattern>`;
    if (kind === 'checks')  return `<pattern id="${id}" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${dot}" opacity=".16"/><rect x="12" y="12" width="12" height="12" fill="${dot}" opacity=".16"/></pattern>`;
    return '';
  }
  /** 뒤판(탭) 위에 살짝 내려앉은 앞판. id가 겹치면 그림이 서로 바뀌어 보여서 쓰는 곳마다 uid를 다르게 준다. */
  function folderIcon(f, uid) {
    const c = COLORS[f.color] || COLORS.beige;
    const pat = patternDef(f.pattern, uid, c.dot);
    return `
      <div class="arc-icon">
        <svg viewBox="0 0 204 168" aria-hidden="true">
          <defs>
            <linearGradient id="arc-g-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.f1}"/><stop offset="1" stop-color="${c.f2}"/></linearGradient>
            <filter id="arc-s-${uid}" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".28"/></filter>
            ${pat}
          </defs>
          <g filter="url(#arc-s-${uid})">
            <path d="${BACK}" fill="${c.back}"/>
            <rect x="4" y="46" width="188" height="109" rx="16" fill="url(#arc-g-${uid})"/>
            ${pat ? `<rect x="4" y="46" width="188" height="109" rx="16" fill="url(#arc-p-${uid})"/>` : ''}
            <rect x="4.6" y="46.6" width="186.8" height="107.8" rx="15.4" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>
            <rect x="4" y="140" width="188" height="15" rx="9" fill="#000" opacity=".035"/>
          </g>
        </svg>
        ${f.emoji ? `<span class="arc-icon__emoji">${f.emoji}</span>` : ''}
      </div>`;
  }

  function folderCard(f, scope) {
    const n = kidsOf(f).length;
    const photos = itemsOf(f).length;
    const meta = f.type === 'monthly' ? `${n} months` : `${photos}장${n ? ` · ${n}` : ''}`;
    return `
      <button type="button" class="arc-folder${f.virtual ? ' is-virtual' : ''}" data-id="${esc(f.id)}" aria-label="${esc(f.name)} 폴더">
        ${folderIcon(f, `${scope}-${f.id}`)}
        <span class="arc-folder__pen" aria-hidden="true">✎</span>
        <span class="arc-folder__name">${esc(f.name)}</span>
        <span class="arc-folder__meta">${meta}</span>
      </button>`;
  }
  const newTile = () => `
    <button type="button" class="arc-folder arc-folder--new" data-new aria-label="새 폴더 만들기">
      <div class="arc-icon">＋</div>
      <span class="arc-folder__name">새 폴더</span>
    </button>`;

  /* ------------------------------------------------------------ 홈: 폴더 / 친구들 */
  let friendsLoadedFor = null;

  function render(rootEl, c) {
    ctx = c; root = rootEl;
    if (!FOLDERS.length || render._uid !== storeKey()) { render._uid = storeKey(); load(); }
    const grid = root.querySelector('#archiveFolders');
    if (grid) {
      grid.innerHTML = FOLDERS.map(f => folderCard(f, 'h')).join('') + newTile();
      if (!grid._wired) { grid._wired = true; grid.addEventListener('click', onFolderClick); }
    }
    const edit = root.querySelector('#archiveEdit');
    if (edit && !edit._wired) {
      edit._wired = true;
      edit.addEventListener('click', () => { editing = !editing; root.classList.toggle('is-arc-edit', editing); edit.textContent = editing ? '완료' : '꾸미기'; });
    }
    renderFriends();
    if (page) renderPage();
  }

  function onFolderClick(e) {
    if (e.target.closest('[data-new]')) { createFolder(stack.length ? stack[stack.length - 1].children : FOLDERS); return; }
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const hit = findNode(b.dataset.id);
    if (!hit) return;
    if (editing && !hit.node.virtual && !page) openSheet(hit.node, hit.list, false);
    else openFolder(hit.node);
  }

  /* ---- 친구들 ---- */
  async function renderFriends() {
    const slot = root && root.querySelector('#archiveFriends');
    if (!slot) return;
    const uid = (typeof Auth !== 'undefined' && Auth.userId) || null;
    if (!uid || typeof Friends === 'undefined' || !Friends.recentPosts) {
      slot.innerHTML = friendsEmpty();
      return;
    }
    if (friendsLoadedFor === uid && slot._posts) { drawFriends(slot, slot._posts); return; }
    slot.innerHTML = `<p class="arc-note">불러오는 중…</p>`;
    const res = await Friends.recentPosts(12);
    friendsLoadedFor = uid;
    slot._posts = res.posts || [];
    drawFriends(slot, slot._posts);
  }
  const friendsEmpty = () => `
    <div class="arc-friends-empty">
      <p><b>함께 교환학생 간 친구를 초대해 보세요</b><br>링크를 누르면 바로 친구가 되고, 서로의 기록을 나눌 수 있어요.</p>
      <div class="arc-friends-empty__actions">
        <button type="button" class="arc-btn arc-btn--sm" data-invite-share>친구 초대하기</button>
        <button type="button" class="arc-link" data-open-friends>코드로 추가하기</button>
      </div>
    </div>`;
  function drawFriends(slot, posts) {
    if (!posts.length) { slot.innerHTML = friendsEmpty(); return; }
    slot.innerHTML = `<div class="arc-friends">${posts.map((p, i) => `
      <article class="arc-fcard" data-i="${i}">
        <img class="arc-fcard__img" src="${esc(p.url)}" alt="${esc(p.cap)}" draggable="false">
        <div class="arc-fcard__who"><span class="arc-fcard__av">${esc(p.who[0] || '?')}</span><b>${esc(p.who)}</b></div>
        <div class="arc-fcard__sub">${p.school ? `🎓 ${esc(p.school)}<br>` : ''}${p.city ? `📍 ${esc(p.city)}` : ''}</div>
      </article>`).join('')}</div>`;
  }
  document.addEventListener('click', (e) => {
    const share = e.target.closest('#archiveFriends [data-invite-share]');
    if (share) { if (ctx && ctx.needLogin && ctx.needLogin()) return; if (typeof Friends !== 'undefined') Friends.shareInvite(); return; }
    const open = e.target.closest('#archiveFriends [data-open-friends]');
    if (open) { if (ctx && ctx.needLogin && ctx.needLogin()) return; if (typeof Friends !== 'undefined') Friends.openManager(); return; }
    const img = e.target.closest('#archiveFriends .arc-fcard__img');
    if (img) {
      const slot = img.closest('#archiveFriends');
      const posts = slot._posts || [];
      const i = Number(img.closest('.arc-fcard').dataset.i);
      openLightbox(posts.map(p => ({ url: p.url, info: p.info })), i, [...slot.querySelectorAll('.arc-fcard__img')]);
    }
  });

  /* ------------------------------------------------------------ 폴더 페이지(전체 화면) */
  function openFolder(node) {
    stack.push(node);
    if (!page) {
      page = document.createElement('div');
      page.className = 'arc-page';
      page.setAttribute('role', 'dialog');
      page.setAttribute('aria-modal', 'true');
      page.addEventListener('click', onPageClick);
      document.body.appendChild(page);
      document.body.classList.add('is-sheet-open');
      requestAnimationFrame(() => page && page.classList.add('is-open'));
      setTimeout(() => page && page.classList.add('is-open'), 30);
    }
    renderPage();
  }
  function closePage() {
    if (!page) return;
    const p = page; page = null; stack = [];
    p.classList.remove('is-open');
    document.body.classList.remove('is-sheet-open');
    setTimeout(() => p.remove(), 300);
  }
  function renderPage() {
    if (!page) return;
    const node = stack[stack.length - 1];
    if (!node) { closePage(); return; }
    const parent = stack[stack.length - 2];
    const items = itemsOf(node);
    page.setAttribute('aria-label', node.name);
    page.innerHTML = `
      <div class="arc-page__head">
        <button type="button" class="arc-back" data-back>‹ ${esc(parent ? parent.name : 'Folders')}</button>
        ${node.virtual ? '' : `<button type="button" class="arc-edit" data-edit-self>꾸미기</button>`}
      </div>
      <div class="arc-page__body">
        ${stack.length > 1 ? `<div class="arc-crumbs">${stack.map((n, i) => i === stack.length - 1 ? `<b>${esc(n.name)}</b>` : esc(n.name)).join(' / ')}</div>` : ''}
        <h2 class="arc-page__title">${node.emoji ? esc(node.emoji) + ' ' : ''}${esc(node.name)}</h2>
        <div class="arc-subfolders">${kidsOf(node).map(f => folderCard(f, 'p')).join('')}${node.type === 'monthly' || node.virtual ? '' : newTile()}</div>
        <div class="arc-sec">
          <span class="arc-sec__label">Photos <span>${items.length}</span></span>
          ${node.type === 'monthly' || node.virtual ? '' : `<button type="button" class="arc-btn arc-btn--ghost arc-btn--sm" data-pick>＋ 사진 담기</button>`}
        </div>
        ${items.length
          ? `<div class="arc-strip" id="arcStrip">${items.map((it, k) => `
              <figure class="arc-shot">
                <img class="arc-shot__img" src="${esc(it.url)}" alt="${esc(it.entry.title || '')}" data-k="${k}" draggable="false">
                <figcaption><i>/${pad(k + 1)}</i><span>${esc(it.entry.title || it.entry.body || '')}</span></figcaption>
              </figure>`).join('')}</div>
             <p class="arc-hint">옆으로 밀어서 보고, 사진을 누르면 크게 볼 수 있어요</p>`
          : `<div class="arc-empty">아직 사진이 없어요<br>${node.type === 'monthly' || node.virtual ? '기록을 남기면 날짜별로 자동으로 모여요' : '‘사진 담기’로 기록을 이 폴더에 담아 보세요'}</div>`}
      </div>`;
  }
  function onPageClick(e) {
    if (e.target.closest('[data-back]')) { stack.pop(); stack.length ? renderPage() : closePage(); return; }
    if (e.target.closest('[data-edit-self]')) {
      const node = stack[stack.length - 1];
      const hit = findNode(node.id);
      if (hit) openSheet(hit.node, hit.list, false);
      return;
    }
    if (e.target.closest('[data-new]')) { createFolder(stack[stack.length - 1].children); return; }
    if (e.target.closest('[data-pick]')) { openPicker(stack[stack.length - 1]); return; }
    const img = e.target.closest('.arc-shot__img');
    if (img) {
      const items = itemsOf(stack[stack.length - 1]);
      openLightbox(items.map(it => ({ url: it.url, info: infoOf(it.entry) })), Number(img.dataset.k), [...page.querySelectorAll('.arc-shot__img')]);
      return;
    }
    const b = e.target.closest('[data-id]');
    if (b) { const hit = findNode(b.dataset.id); if (hit) openFolder(hit.node); }
  }

  /* ------------------------------------------------------------ 폴더 만들기 / 꾸미기 시트 */
  let draft = null, draftTarget = null, draftList = null, isNew = false;
  let sheet = null;
  function ensureSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'arc-sheet';
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="arc-sheet__scrim" data-cancel></div>
      <div class="arc-sheet__panel" role="dialog" aria-label="폴더 꾸미기">
        <div class="arc-sheet__grip"></div>
        <div class="arc-sheet__preview" id="arcPreview"></div>
        <div class="arc-field"><label for="arcName">이름</label><input class="arc-input" id="arcName" maxlength="14" autocomplete="off"></div>
        <div class="arc-field"><span class="arc-lab">정리 방식</span>
          <div class="arc-seg" id="arcType"><button type="button" data-type="manual">직접 담기</button><button type="button" data-type="monthly">Monthly</button></div>
          <p class="arc-segnote" id="arcTypeNote"></p></div>
        <div class="arc-field"><span class="arc-lab">색</span><div class="arc-swatches" id="arcColors"></div></div>
        <div class="arc-field"><span class="arc-lab">패턴</span><div class="arc-pats" id="arcPats"></div></div>
        <div class="arc-field"><span class="arc-lab">스티커 (선택)</span><div class="arc-emojis" id="arcEmojis"></div></div>
        <div class="arc-sheet__actions">
          <button type="button" class="arc-btn arc-btn--danger" id="arcDelete">폴더 삭제</button>
          <button type="button" class="arc-btn arc-btn--ghost" data-cancel>취소</button>
          <button type="button" class="arc-btn" id="arcSave">저장</button>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('[data-cancel]')) { closeSheet(true); return; }
      const c = e.target.closest('[data-color]'); if (c) { draft.color = c.dataset.color; syncSheet(); return; }
      const p = e.target.closest('[data-pat]'); if (p) { draft.pattern = p.dataset.pat; syncSheet(); return; }
      const m = e.target.closest('[data-emo]'); if (m) { draft.emoji = m.dataset.emo; syncSheet(); return; }
      const t = e.target.closest('[data-type]'); if (t) { draft.type = t.dataset.type; syncSheet(); return; }
      if (e.target.closest('#arcSave')) {
        Object.assign(draftTarget, { name: (draft.name || '').trim() || 'Untitled', color: draft.color, pattern: draft.pattern, emoji: draft.emoji, type: draft.type });
        save(); closeSheet(false); refresh(); return;
      }
      if (e.target.closest('#arcDelete')) {
        const extra = (draftTarget.children || []).length ? ' 안의 폴더도 함께 사라져요.' : '';
        if (window.confirm(`'${draftTarget.name}' 폴더를 삭제할까요?${extra} 사진(기록)은 지워지지 않아요.`)) {
          const i = draftList.indexOf(draftTarget); if (i >= 0) draftList.splice(i, 1);
          // 지운 폴더를 보고 있었다면 경로에서도 뺀다
          const si = stack.indexOf(draftTarget); if (si >= 0) stack.length = si;
          save(); closeSheet(false); refresh();
        }
      }
    });
    sheet.querySelector('#arcName').addEventListener('input', (e) => { draft.name = e.target.value; syncSheet(); });
    return sheet;
  }
  const TYPE_NOTE = { manual: '기록을 직접 골라 담고, 폴더 안에 폴더를 만들 수 있어요.', monthly: '기록을 날짜 기준으로 YYYY.MM 폴더에 자동으로 정리해요.' };
  function patThumb(k) {
    const d = '#8a7a68';
    const svg = {
      dots: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='4' cy='4' r='1.6' fill='${d}'/><circle cx='12' cy='12' r='1.6' fill='${d}'/></svg>`,
      stripes: `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><path d='M-1 9L9 -1M3 11L11 3' stroke='${d}' stroke-opacity='.5' stroke-width='2'/></svg>`,
      grid: `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><path d='M12 0H0V12' fill='none' stroke='${d}' stroke-opacity='.5'/></svg>`,
      checks: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='8' height='8' fill='${d}' opacity='.3'/><rect x='8' y='8' width='8' height='8' fill='${d}' opacity='.3'/></svg>`
    }[k];
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }
  function syncSheet() {
    const s = ensureSheet();
    s.querySelector('#arcPreview').innerHTML = `<div class="arc-folder arc-folder--preview">${folderIcon(draft, 'pv')}<span class="arc-folder__name">${esc(draft.name || '이름 없음')}</span></div>`;
    s.querySelectorAll('#arcColors [data-color]').forEach(b => b.classList.toggle('is-sel', b.dataset.color === draft.color));
    s.querySelectorAll('#arcPats [data-pat]').forEach(b => b.classList.toggle('is-sel', b.dataset.pat === draft.pattern));
    s.querySelectorAll('#arcEmojis [data-emo]').forEach(b => b.classList.toggle('is-sel', b.dataset.emo === draft.emoji));
    s.querySelectorAll('#arcType [data-type]').forEach(b => b.classList.toggle('is-sel', b.dataset.type === draft.type));
    s.querySelector('#arcTypeNote').textContent = TYPE_NOTE[draft.type];
  }
  function openSheet(node, list, fresh) {
    const s = ensureSheet();
    draftTarget = node; draftList = list; isNew = fresh;
    draft = { ...node, type: node.type || 'manual' };
    s.querySelector('#arcName').value = draft.name;
    s.querySelector('#arcColors').innerHTML = Object.entries(COLORS).map(([k, c]) => `<button type="button" class="arc-swatch" data-color="${k}" style="background:${c.sw}" aria-label="${k}"></button>`).join('');
    s.querySelector('#arcPats').innerHTML = Object.entries(PATTERNS).map(([k, label]) => `<button type="button" class="arc-pat" data-pat="${k}" style="${k === 'none' ? '' : `background-image:${patThumb(k)}`}">${k === 'none' ? label : ''}</button>`).join('');
    s.querySelector('#arcEmojis').innerHTML = EMOJIS.map(e => `<button type="button" class="arc-emo" data-emo="${e}">${e || '–'}</button>`).join('');
    s.querySelector('#arcDelete').hidden = fresh;
    syncSheet();
    s.hidden = false;
    void s.offsetWidth;
    setTimeout(() => s.classList.add('is-on'), 20);
  }
  function closeSheet(discardNew) {
    if (!sheet) return;
    sheet.classList.remove('is-on');
    if (discardNew && isNew) { const i = draftList.indexOf(draftTarget); if (i >= 0) draftList.splice(i, 1); }
    isNew = false;
    setTimeout(() => { if (sheet) sheet.hidden = true; }, 340);
    refresh();
  }
  function createFolder(list) {
    if (ctx && ctx.needLogin && ctx.needLogin()) return;
    const f = { id: 'f' + Date.now(), name: 'New folder', color: 'beige', pattern: 'none', emoji: '', type: 'manual', entryIds: [], children: [] };
    list.push(f);
    openSheet(f, list, true);
  }
  function refresh() { if (root && ctx) render(root, ctx); }

  /* ------------------------------------------------------------ 사진 담기(기록 고르기) */
  let picker = null;
  function openPicker(node) {
    const entries = allEntries().filter(withPhotos).slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
    const chosen = new Set(node.entryIds || []);
    picker = document.createElement('div');
    picker.className = 'arc-sheet is-on';
    picker.innerHTML = `
      <div class="arc-sheet__scrim" data-close></div>
      <div class="arc-sheet__panel" role="dialog" aria-label="사진 담기">
        <div class="arc-sheet__grip"></div>
        <h3 class="arc-sheet__title">‘${esc(node.name)}’에 담을 기록</h3>
        ${entries.length ? `<div class="arc-pick">${entries.map(e => {
          const url = ctx.photoUrl((e.photos || []).find(p => ctx.photoUrl(p)));
          const on = chosen.has(e.id) || (e.tempId && chosen.has(e.tempId));
          return `<button type="button" class="arc-pick__item${on ? ' is-on' : ''}" data-eid="${esc(e.id)}"><img src="${esc(url)}" alt="" draggable="false"><i>${esc(e.date.slice(5).replace('-', '.'))}</i><b aria-hidden="true">✓</b></button>`;
        }).join('')}</div>` : `<p class="arc-note">아직 사진이 있는 기록이 없어요</p>`}
        <div class="arc-sheet__actions"><button type="button" class="arc-btn" data-close>완료</button></div>
      </div>`;
    document.body.appendChild(picker);
    picker.addEventListener('click', (e) => {
      const it = e.target.closest('[data-eid]');
      if (it) {
        const id = it.dataset.eid;
        const list = node.entryIds = node.entryIds || [];
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1); else list.push(id);
        it.classList.toggle('is-on', i < 0);
        save();
        return;
      }
      if (e.target.closest('[data-close]')) { picker.remove(); picker = null; refresh(); }
    });
  }

  /* ------------------------------------------------------------ 확대: 사진 + 위치·날씨·노래 */
  function infoOf(e) {
    const loc = e.location || {};
    const place = loc.city || loc.country ? [loc.city || loc.country, loc.city && loc.country ? loc.country : ''] : null;
    let weather = null;
    if (e.weather && typeof e.weather.code === 'number' && typeof SongEngine !== 'undefined') {
      const w = SongEngine.weatherLabel(e.weather.code);
      if (w) weather = { emoji: w.emoji, label: w.ko, temp: typeof e.weather.temp === 'number' ? Math.round(e.weather.temp) : null };
    }
    const song = e.song || e.nowPlaying || null;
    const t = e.createdAt ? new Date(e.createdAt) : null;
    const date = `${e.date.replace(/-/g, '.')}${t && !isNaN(t) ? ` · ${pad(t.getHours())}:${pad(t.getMinutes())}` : ''}`;
    return { cap: e.title || e.body || '', date, place, weather, song };
  }

  /*
   * 확대 화면 — 가운데 사진이 살짝 커지고, 이전·다음 사진이 양옆에 어둡게 비친다(누르거나 쓸어서 넘긴다).
   * 사진마다 <img>를 하나씩 두고 위치(left/top/width/height)만 바꿔서 넘길 때 미끄러지듯 움직이게 한다.
   * 같은 날 사진은 먼저 찍은 것이 왼쪽 — shots 순서가 곧 왼쪽→오른쪽이다.
   */
  let lb = null, lbCtx = { shots: [], thumbs: [] }, lbIndex = 0, lbThumb = null;
  const lbImgs = new Map();   // 사진 번호 → <img>
  function ensureLb() {
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'arc-lb';
    lb.hidden = true;
    lb.innerHTML = `
      <div class="arc-lb__bg"></div>
      <button type="button" class="arc-lb__close" aria-label="닫기">✕</button>
      <button type="button" class="arc-lb__nav arc-lb__nav--prev" aria-label="이전 사진">‹</button>
      <button type="button" class="arc-lb__nav arc-lb__nav--next" aria-label="다음 사진">›</button>
      <div class="arc-lb__info arc-lb__info--1"></div>
      <div class="arc-lb__info arc-lb__info--2"></div>
      <div class="arc-lb__info arc-lb__info--3"></div>`;
    document.body.appendChild(lb);
    lb.querySelector('.arc-lb__bg').addEventListener('click', closeLightbox);
    lb.querySelector('.arc-lb__close').addEventListener('click', closeLightbox);
    lb.querySelector('.arc-lb__nav--prev').addEventListener('click', () => goTo(lbIndex - 1));
    lb.querySelector('.arc-lb__nav--next').addEventListener('click', () => goTo(lbIndex + 1));
    // 옆에 비친 사진을 누르면 그 사진으로 / 좌우로 쓸어도 넘어간다
    let sx = 0, sy = 0;
    lb.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    lb.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { goTo(lbIndex + (dx < 0 ? 1 : -1)); return; }
      const side = e.target.closest && e.target.closest('.arc-lb__img.is-side');
      if (side && Math.abs(dx) < 8 && Math.abs(dy) < 8) goTo(Number(side.dataset.i));
    });
    document.addEventListener('keydown', (e) => {
      if (!lb || lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goTo(lbIndex - 1);
      if (e.key === 'ArrowRight') goTo(lbIndex + 1);
    });
    return lb;
  }
  const q = (sel) => lb.querySelector(sel);
  function fitSize(nw, nh) {
    const maxW = Math.min(innerWidth * 0.8, 360), maxH = innerHeight * 0.46;
    const r = nw / nh;
    let w = maxW, h = w / r;
    if (h > maxH) { h = maxH; w = h * r; }
    return { w, h };
  }
  const natural = (i) => {
    const t = lbCtx.thumbs[i];
    const r = t.getBoundingClientRect();
    return { nw: t.naturalWidth || r.width || 1, nh: t.naturalHeight || r.height || 1 };
  };
  /** 가운데 사진의 자리와, 양옆 사진(조금 작게, 가운데 높이에 맞춰)의 자리 */
  function layout(c) {
    const { nw, nh } = natural(c);
    const { w, h } = fitSize(nw, nh);
    const left = (innerWidth - w) / 2, top = (innerHeight - h) / 2 - 8;
    const out = { [c]: { left, top, width: w, height: h } };
    const gap = 12;
    [[c - 1, -1], [c + 1, 1]].forEach(([i, dir]) => {
      if (i < 0 || i >= lbCtx.shots.length) return;
      const d = natural(i);
      const sh = h * 0.86, sw = Math.min(sh * (d.nw / d.nh), innerWidth * 0.8);
      out[i] = { left: dir < 0 ? left - gap - sw : left + w + gap, top: top + (h - sh) / 2, width: sw, height: sh };
    });
    return out;
  }
  const px = (r) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  function makeImg(i, rect, role) {
    const img = document.createElement('img');
    img.className = `arc-lb__img is-${role}`;
    img.dataset.i = i;
    img.alt = '';
    img.draggable = false;
    img.src = lbCtx.shots[i].url;
    Object.assign(img.style, px(rect));
    lb.insertBefore(img, q('.arc-lb__info--1'));
    lbImgs.set(i, img);
    return img;
  }
  /** c번을 가운데로 — 이미 있는 사진은 미끄러져 움직이고, 새로 필요한 사진은 그 자리에서 나타난다 */
  function show(c, fromRect) {
    const rects = layout(c);
    lbIndex = c;
    [...lbImgs.keys()].forEach(i => {
      if (!(i in rects)) { const el = lbImgs.get(i); lbImgs.delete(i); el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }
    });
    Object.keys(rects).map(Number).forEach(i => {
      const role = i === c ? 'center' : 'side';
      let el = lbImgs.get(i);
      if (!el) {
        el = makeImg(i, i === c && fromRect ? fromRect : rects[i], role);
        if (!(i === c && fromRect)) { el.style.opacity = '0'; void el.offsetWidth; }
      }
      el.className = `arc-lb__img is-${role}`;
      void el.offsetWidth;
      Object.assign(el.style, px(rects[i]));
      el.style.opacity = '';
    });
    placeInfo(rects[c]);
    syncNav();
    return rects[c];
  }
  function fillInfo(info) {
    const place = info && info.place;
    q('.arc-lb__info--1').innerHTML = info
      ? `${info.who ? `<span class="arc-lb__who">🎓 ${esc(info.who)}${info.school ? ' · ' + esc(info.school) : ''}</span>` : ''}
         <div class="arc-lb__place">${place ? esc(place[0]) : esc(info.cap || '')}<small>${place && place[1] ? esc(place[1]) + ' · ' : ''}${esc(info.date)}</small></div>` : '';
    q('.arc-lb__info--2').innerHTML = info && info.weather
      ? `<span class="arc-pill"><span>${info.weather.emoji}</span><b>${esc(info.weather.label)}</b>${info.weather.temp != null ? `<small>${info.weather.temp}°</small>` : ''}</span>` : '';
    const s = info && info.song;
    q('.arc-lb__info--3').innerHTML = s
      ? `<div class="arc-song">${s.art ? `<img class="arc-song__art" src="${esc(s.art)}" alt="">` : `<span class="arc-song__art arc-song__art--empty">🎵</span>`}
         <span class="arc-song__txt"><b>${esc(s.name)}</b><small>${esc(s.artist)}</small></span></div>` : '';
  }
  function placeInfo(rect) {
    const els = [q('.arc-lb__info--1'), q('.arc-lb__info--2'), q('.arc-lb__info--3')];
    els.forEach(el => { el.style.left = rect.left + 'px'; el.style.width = rect.width + 'px'; });
    els[0].style.top = Math.max(60, rect.top - els[0].offsetHeight - 16) + 'px';
    els[1].style.top = (rect.top + rect.height + 18) + 'px';
    els[2].style.top = (rect.top + rect.height + 18 + els[1].offsetHeight + (els[1].offsetHeight ? 14 : 0)) + 'px';
  }
  function openLightbox(shots, k, thumbs) {
    ensureLb();
    lbCtx = { shots, thumbs };
    lbThumb = thumbs[k];
    lbImgs.forEach(el => el.remove()); lbImgs.clear();
    lb.hidden = false;
    fillInfo(shots[k].info);
    lbThumb.style.visibility = 'hidden';
    const r = lbThumb.getBoundingClientRect();
    void lb.offsetWidth;   // 시작 위치를 먼저 확정한 뒤 목표로 옮겨야 전환이 걸린다
    setTimeout(() => { show(k, { left: r.left, top: r.top, width: r.width, height: r.height }); lb.classList.add('is-on'); }, 30);
    // show()가 시작 위치에서 목표로 옮기려면 시작 위치로 만들어진 뒤여야 해서, 한 번 더 만들어 둔다
    makeStart(k, r);
  }
  /** 눌린 사진의 자리에서 시작하는 가운데 사진을 미리 만들어 둔다(show가 이걸 목표 위치로 옮긴다) */
  function makeStart(k, r) {
    const img = makeImg(k, { left: r.left, top: r.top, width: r.width, height: r.height }, 'center');
    img.style.transition = 'none';
    void img.offsetWidth;
    img.style.transition = '';
  }
  function closeLightbox() {
    if (!lb || lb.hidden) return;
    const r = lbThumb.getBoundingClientRect();
    const th = lbThumb;
    lb.classList.remove('is-on');
    lbImgs.forEach((el, i) => {
      if (i === lbIndex) Object.assign(el.style, px(r));
      else el.style.opacity = '0';
    });
    setTimeout(() => { lb.hidden = true; th.style.visibility = ''; lbImgs.forEach(el => el.remove()); lbImgs.clear(); }, 430);
  }
  function goTo(n) {
    if (n < 0 || n >= lbCtx.shots.length || n === lbIndex) return;
    lbThumb.style.visibility = '';
    lbThumb = lbCtx.thumbs[n];
    lbThumb.style.visibility = 'hidden';
    if (lbThumb.scrollIntoView) lbThumb.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
    // 정보는 잠깐 사라졌다가 새 사진의 것으로 다시 나타난다
    const infoEls = lb.querySelectorAll('.arc-lb__info');
    infoEls.forEach(el => { el.style.transition = 'opacity 140ms ease'; el.style.opacity = '0'; });
    const rect = show(n);
    setTimeout(() => {
      fillInfo(lbCtx.shots[n].info);
      placeInfo(rect);
      infoEls.forEach(el => { el.style.opacity = ''; el.style.transition = ''; });
    }, 160);
  }
  function syncNav() {
    q('.arc-lb__nav--prev').disabled = lbIndex <= 0;
    q('.arc-lb__nav--next').disabled = lbIndex >= lbCtx.shots.length - 1;
  }

  /** 다른 화면(최근 사진 캐러셀·날짜 팝업)에서 같은 확대 화면을 쓴다. shots = [{ url, info }], thumbs = 눌린 사진 요소들 */
  /** 친구가 새로 생겼을 때(초대 링크 등) 친구들 줄을 다시 읽는다 */
  function reloadFriends() { friendsLoadedFor = null; const slot = root && root.querySelector('#archiveFriends'); if (slot) slot._posts = null; renderFriends(); }
  global.DiaryArchive = { render, refresh, reloadFriends, infoOf, openPhotos: (shots, k, thumbs) => openLightbox(shots, k, thumbs) };
})(window);
