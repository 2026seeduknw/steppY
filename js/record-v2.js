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

  /**
   * 앱 안에서 그리는 확인창. window.confirm 은 앱 안 브라우저·일부 웹뷰에서 뜨지 않고
   * 바로 '취소'로 돌아와서 "지우기를 눌러도 아무 일이 없는" 문제가 있었다.
   * ask('지울까요?', '지우기').then(ok => …)
   */
  function ask(message, okLabel, danger) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'rec-ask';
      wrap.innerHTML = `<div class="rec-ask__box" role="alertdialog" aria-modal="true">
          <p class="rec-ask__msg">${esc(message).replace(/\n/g, '<br>')}</p>
          <div class="rec-ask__btns">
            <button type="button" data-ask="no">취소</button>
            <button type="button" data-ask="yes" class="${danger ? 'is-danger' : ''}">${esc(okLabel || '확인')}</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('is-open'));
      const done = (v) => { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ask]');
        if (b) done(b.dataset.ask === 'yes');
        else if (e.target === wrap) done(false);
      });
      wrap.querySelector('[data-ask="yes"]').focus();
    });
  }

  /**
   * 글 입력 — window.prompt 대신. prompt도 confirm처럼 앱 안 브라우저·일부 웹뷰에서 막혀 아무것도 안 뜬다.
   * 확인을 누르면 적은 글(앞뒤 공백 그대로), 취소·바깥을 누르면 null.
   */
  function askText(title, value, okLabel) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'rec-ask';
      wrap.innerHTML = `<form class="rec-ask__box rec-ask__box--input" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <p class="rec-ask__msg">${esc(title)}</p>
          <textarea class="rec-ask__input" rows="3" maxlength="200">${esc(value || '')}</textarea>
          <div class="rec-ask__btns">
            <button type="button" data-ask="no">취소</button>
            <button type="submit">${esc(okLabel || '넣기')}</button>
          </div>
        </form>`;
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('is-open'));
      const input = wrap.querySelector('textarea');
      const done = (v) => { wrap.remove(); resolve(v); };
      wrap.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); done(input.value); });
      wrap.addEventListener('click', (e) => {
        if (e.target.closest('[data-ask="no"]') || e.target === wrap) done(null);
      });
      // 엔터는 넣기, 줄바꿈은 Shift+엔터
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); done(input.value); } });
      setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 50);
    });
  }

  /* ------------------------------------------------------------ 저장 */
  const storeKey = () => `steppy_pages_v1_${(typeof Auth !== 'undefined' && Auth.userId) || 'guest'}`;
  function loadPages() { try { return JSON.parse(localStorage.getItem(storeKey()) || '{}') || {}; } catch (e) { return {}; } }
  function savePages(all) {
    try { localStorage.setItem(storeKey(), JSON.stringify(all)); return true; }
    catch (e) { toast('이 기기의 저장 공간이 부족해요. 올린 사진을 줄이거나 지운 뒤 다시 저장해 주세요.'); return false; }
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
    const loc = typeof placeEn === 'function' ? placeEn(e.location) : (e.location || {});
    return loc.city || loc.country || '';
  }
  function defaultPage(e) {
    const items = [];
    // fit: 사진이 도착하면 그 사진의 원래 비율로 높이를 맞춘다(칸 모양대로 잘리지 않게, fitPhotos)
    (e.photos || []).slice(0, 4).forEach((p, i) => items.push(Object.assign({ id: uid(), type: 'photo', path: p, fit: true }, PHOTO_SLOTS[i])));
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
      // 자른 사진은 사용자가 옮긴 자리(pos, %)를 보여 준다
      const pos = it.crop && it.pos ? ` style="object-position:${Number(it.pos.x) || 50}% ${Number(it.pos.y) || 50}%"` : '';
      return src ? `<img src="${esc(src)}" alt="" draggable="false"${pos}>` : '<span class="rec-it__ph" aria-hidden="true"></span>';
    }
    if (it.type === 'memo' || it.type === 'text') return `<span class="rec-it__text${it.font === 'hand' ? ' is-hand' : ''}" style="font-size:${(it.fs || (it.type === 'memo' ? 0.036 : 0.05)) * (it.font === 'hand' ? 1.25 : 1) * 100}cqw">${esc(it.text)}</span>`;
    if (it.type === 'art') {
      const src = typeof DiaryStickers !== 'undefined' ? DiaryStickers.url(it.art) : '';
      return src ? `<img src="${esc(src)}" alt="" draggable="false">` : '';
    }
    if (it.type === 'sticker') return `<span class="rec-it__emoji" style="font-size:${it.w * 72}cqw">${esc(it.emoji)}</span>`;
    if (it.type === 'place') return `<span class="rec-it__text">📍 ${esc(it.text)}</span>`;
    if (it.type === 'song') return `<span class="rec-it__lp" aria-hidden="true"></span><span class="rec-it__text"><b>${esc(it.name)}</b>${esc(it.artist)}</span>`;
    return '';
  }
  /** 속지 맨 위 작은 머리말 — NOVEMBER '26 · 제목 · @steppY. 다이어리는 기본으로 켜고, 하루 기록은 켤 때만 */
  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  function headStrip(page) {
    const meta = page.meta || {};
    const on = page.head === true || (page.head !== false && meta.start);
    if (!on) return '';
    const iso = meta.start || page.date || '';
    const left = iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} '${iso.slice(2, 4)}` : '';
    const title = meta.title || page.title || 'DIARY';
    return `<div class="rec-page__head" aria-hidden="true"><span>${esc(left)}</span><b>${esc(title)}</b><span>@steppY</span></div>`;
  }
  function pageHtml(page, extraClass) {
    const bgStyle = page.bg === 'upload' && page.bgImg ? ` style="background-image:url('${page.bgImg}')"` : '';
    return `
      <div class="rec-page rec-page--${esc(page.bg || 'cream')}${extraClass ? ' ' + extraClass : ''}"${bgStyle}>
        ${headStrip(page)}
        <div class="rec-page__items">
          ${page.items.map(it => {
            // 사진은 원래 비율 그대로(높이를 사진에 맡긴다). 템플릿으로 일부러 자른 사진(crop)만 칸 모양대로
            const fit = it.type === 'photo' && !it.crop;
            const style = fit ? itemStyle(it).replace(/height:[^;]*;/, '') : itemStyle(it);
            return `<div class="rec-it rec-it--${it.type}${it.type === 'photo' && it.frame === false ? ' is-noframe' : ''}${fit ? ' is-fit' : ''}" data-it="${esc(it.id)}" style="${style}">${itemInner(it)}</div>`;
          }).join('')}
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
        <h1 class="v2-head__title">Storage</h1>
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
  let folderView = null, folderNode = null, folderIndex = 0, folderMonth = '';
  function folderEntries() {
    const ym = folderNode && folderNode.type === 'monthly' ? monthOfNode(folderNode) : '';
    return DiaryArchive.entriesOfNode(folderNode).filter(e => !ym || e.date.startsWith(ym)).slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function metaLine(e) {
    const info = DiaryArchive.infoOf(e);
    const w = info.weather ? ` · ${info.weather.label}${info.weather.temp != null ? ` ${info.weather.temp}°` : ''}` : '';
    return `${e.date.replace(/-/g, '.')}${w}`;
  }
  /*
   * 폴더 안 — 폴더는 '사진을 모아 두는 곳'이라 담긴 사진을 격자로 보여 준다(누르면 크게 + 위치·날씨·노래).
   * Monthly는 한 달씩 넘기는 사진 달력. 그동안 간 도시를 잇는 경로는 따로(첫 화면 Recap → openRecap).
   */
  let folderShots = [];
  function renderFolder() {
    if (!folderView) return;
    const list = folderEntries();
    folderView.querySelector('.rec-top__title b').textContent = folderNode.name;
    const body = folderView.querySelector('.rec-layer__body');
    const ym = monthOfNode(folderNode);
    folderView.classList.toggle('rec-layer--photo', !!ym);
    folderShots = [];
    list.forEach(e => (e.photos || []).forEach(p => { const u = ctx.photoUrl(p); if (u) folderShots.push({ url: u, e }); }));
    if (ym) { body.innerHTML = monthCalendarHtml(ym, list, folderNode.type === 'monthly'); return; }
    const canPick = !(folderNode.type === 'monthly' || folderNode.virtual);
    if (!list.length && !ym) {
      body.innerHTML = `
        <div class="rec-fempty">
          ${DiaryArchive.folderIcon(folderNode, 'fe-' + folderNode.id)}
          <p class="rec-fempty__title">아직 담긴 사진이 없어요</p>
          <p class="rec-fempty__sub">${folderNode.type === 'monthly' ? '사진을 기록하면 달마다 자동으로 모여요.' : '사진 기록을 이 폴더에 담아 보세요.'}</p>
          ${canPick ? '<button type="button" class="rec-pill rec-pill--dark" data-pick>+ 사진 담기</button>' : ''}
        </div>`;
      return;
    }
    body.innerHTML = `
      <div class="rec-pgrid__bar">
        <span class="rec-pgrid__count">사진 ${folderShots.length}장</span>
        ${canPick ? '<button type="button" class="rec-pager__add" data-pick>+ 사진 담기</button>' : ''}
      </div>
      ${folderShots.length ? `<div class="rec-pgrid">${folderShots.map((x, i) => `
        <button type="button" class="rec-pgrid__item" data-shot="${i}" aria-label="${esc(x.e.date)} 사진 크게 보기">
          <img src="${esc(x.url)}" alt="" loading="lazy" draggable="false">
        </button>`).join('')}</div>` : '<p class="rec-mcal__empty">아직 담긴 사진이 없어요</p>'}`;
  }
  /** Monthly 아래 자동 폴더(이름 YYYY.MM)면 'YYYY-MM' */
  function monthOfNode(node) {
    if (!node) return '';
    if (node.virtual && /^\d{4}\.\d{2}$/.test(node.name)) return node.name.replace('.', '-');
    if (node.type !== 'monthly') return '';
    // Monthly 폴더는 한 달씩 넘겨 본다 — 처음엔 기록이 있는 가장 최근 달(없으면 이번 달)
    if (!folderMonth) {
      const dates = DiaryArchive.entriesOfNode(node).map(e => e.date).sort();
      const t = new Date();
      folderMonth = dates.length ? dates[dates.length - 1].slice(0, 7) : `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;
    }
    return folderMonth;
  }
  const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const firstPhoto = (e) => (e.photos || []).map(p => ctx.photoUrl(p)).find(Boolean) || '';
  const photoBg = (url) => `<div class="rec-photobg">${url ? `<img src="${esc(url)}" alt="" draggable="false">` : ''}</div>`;
  /** 칸 하나에서 여러 장을 크게 — 확대 화면은 사진마다 원본 비율이 필요해 나머지 장도 미리 읽어 넘긴다 */
  function openShots(shots, img) {
    const src = img.getAttribute('src');
    const k = Math.max(0, shots.findIndex(x => x.url === src));
    const thumbs = shots.map((x, i) => { if (i === k) return img; const t = new Image(); t.src = x.url; return t; });
    Promise.all(thumbs.map(t => (t.decode ? t.decode().catch(() => {}) : null))).then(() => {
      if (img.isConnected) DiaryArchive.openPhotos(shots, k, thumbs);
    });
  }
  /** 한 달 사진 달력 — 그달 사진을 배경에 깔고, 기록한 날 칸에 그날 첫 사진을 채운다(월요일 시작) */
  function monthCalendarHtml(ym, list, nav) {
    const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1;
    const byDay = {};
    list.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)))
      .forEach(e => { const u = firstPhoto(e); if (u && !byDay[e.date]) byDay[e.date] = u; });
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const last = new Date(y, m + 1, 0).getDate();
    const total = Math.ceil((lead + last) / 7) * 7;
    let cells = '';
    for (let i = 0; i < total; i++) {
      const d = i - lead + 1;
      if (d < 1 || d > last) { cells += '<span class="rec-pcal__day"></span>'; continue; }
      const iso = `${ym}-${pad(d)}`;
      cells += byDay[iso]
        ? `<button type="button" class="rec-pcal__day" data-day="${iso}" aria-label="${m + 1}월 ${d}일 사진 보기"><img src="${esc(byDay[iso])}" alt="" loading="lazy" draggable="false"><span>${d}</span></button>`
        : `<span class="rec-pcal__day"><span>${d}</span></span>`;
    }
    const count = Object.keys(byDay).length;
    const navBtn = (dir, label, ch) => nav ? `<button type="button" class="rec-pcal__nav" data-mnav="${dir}" aria-label="${label}">${ch}</button>` : '<span></span>';
    return `
      <section class="rec-pcal" aria-label="${y}년 ${m + 1}월 사진 달력">
        <div class="rec-pcal__head">
          ${navBtn(-1, '이전 달', '‹')}
          <h2>${MONTH_EN[m]} ${y}</h2>
          ${navBtn(1, '다음 달', '›')}
        </div>
        <div class="rec-pcal__week" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        <div class="rec-pcal__grid">${cells}</div>
        <p class="rec-pcal__sum">${count ? `${count}일의 기록` : '이 달에는 아직 사진이 없어요.'}</p>
      </section>`;
  }
  function openFolder(c, node) {
    ctx = c;
    folderNode = node; folderMonth = '';
    if (!folderView) {
      folderView = openLayer('rec-folderview', node.name);
      folderView.innerHTML = headHtml(node.name, '') + '<div class="rec-layer__body"></div>';
      folderView.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-close]')) { const f = folderView; folderView = null; closeLayer(f); return; }
        if (ev.target.closest('[data-pick]')) { if (!ctx.needLogin()) DiaryArchive.openPicker(folderNode); return; }
        const mn = ev.target.closest('[data-mnav]');
        if (mn) {
          const [yy, mm] = folderMonth.split('-').map(Number);
          const d = new Date(yy, mm - 1 + Number(mn.dataset.mnav), 1);
          folderMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
          renderFolder(); return;
        }
        const day = ev.target.closest('[data-day]');
        if (day) {
          const shots = folderShots.filter(x => x.e.date === day.dataset.day).reverse().map(x => ({ url: x.url, info: DiaryArchive.infoOf(x.e) }));
          const img = day.querySelector('img');
          if (shots.length && img) openShots(shots, img);
          return;
        }
        const shot = ev.target.closest('[data-shot]');
        if (shot) {
          const imgs = [...folderView.querySelectorAll('.rec-pgrid__item img')];
          DiaryArchive.openPhotos(folderShots.map(x => ({ url: x.url, info: DiaryArchive.infoOf(x.e) })), Number(shot.dataset.shot), imgs);
        }
      });
    }
    renderFolder();
  }

  /* ------------------------------------------------------------ Recap — 그동안 간 도시를 사진과 경로로
     GPS는 저장하지 않는다(diary-view.js stripCoords). 기록에 남은 도시 이름만 쓰고, 화면의 자리는 지도가 아니라
     방문 순서대로 지그재그로 놓는다. 거리는 도시 중심끼리의 직선거리이며 좌표를 모르는 구간은 적지 않는다. */
  const CITY_COORDS = {
    amsterdam: [52.37, 4.9], athens: [37.98, 23.73], auckland: [-36.85, 174.76], bangkok: [13.76, 100.5], barcelona: [41.39, 2.17],
    beijing: [39.9, 116.41], berlin: [52.52, 13.41], bern: [46.95, 7.45], bologna: [44.49, 11.34], boston: [42.36, -71.06],
    brisbane: [-27.47, 153.03], brussels: [50.85, 4.35], budapest: [47.5, 19.04], busan: [35.18, 129.08], cairo: [30.04, 31.24],
    chicago: [41.88, -87.63], copenhagen: [55.68, 12.57], dublin: [53.35, -6.26], edinburgh: [55.95, -3.19], florence: [43.77, 11.26],
    frankfurt: [50.11, 8.68], fukuoka: [33.59, 130.4], geneva: [46.2, 6.14], granada: [37.18, -3.6], hamburg: [53.55, 9.99],
    hanoi: [21.03, 105.85], helsinki: [60.17, 24.94], 'ho chi minh city': [10.82, 106.63], 'hong kong': [22.32, 114.17], honolulu: [21.31, -157.86],
    interlaken: [46.69, 7.86], istanbul: [41.01, 28.98], jakarta: [-6.21, 106.85], kyoto: [35.01, 135.77], 'kuala lumpur': [3.14, 101.69],
    lisbon: [38.72, -9.14], liverpool: [53.41, -2.98], london: [51.51, -0.13], 'los angeles': [34.05, -118.24], lyon: [45.76, 4.84],
    madrid: [40.42, -3.7], manchester: [53.48, -2.24], manila: [14.6, 120.98], marrakesh: [31.63, -8], melbourne: [-37.81, 144.96],
    miami: [25.76, -80.19], milan: [45.46, 9.19], montreal: [45.5, -73.57], munich: [48.14, 11.58], nagoya: [35.18, 136.91],
    naples: [40.85, 14.27], nice: [43.7, 7.27], 'new york': [40.71, -74.01], osaka: [34.69, 135.5], oslo: [59.91, 10.75],
    paris: [48.86, 2.35], perth: [-31.95, 115.86], porto: [41.15, -8.61], prague: [50.08, 14.44], reykjavik: [64.15, -21.94],
    rome: [41.9, 12.5], salzburg: [47.81, 13.05], 'san francisco': [37.77, -122.42], sapporo: [43.06, 141.35], seattle: [47.61, -122.33],
    seoul: [37.57, 126.98], seville: [37.39, -5.99], shanghai: [31.23, 121.47], singapore: [1.35, 103.82], stockholm: [59.33, 18.07],
    sydney: [-33.87, 151.21], taipei: [25.03, 121.57], tokyo: [35.68, 139.69], toronto: [43.65, -79.38], valencia: [39.47, -0.38],
    vancouver: [49.28, -123.12], venice: [45.44, 12.32], vienna: [48.21, 16.37], warsaw: [52.23, 21.01], zurich: [47.38, 8.54]
  };
  function cityCoord(key) {
    if (CITY_COORDS[key]) return CITY_COORDS[key];
    const sc = typeof MOCK !== 'undefined' ? (MOCK.schools || []).find(s => s.lat != null && s.lng != null
      && [s.city, s.campusCity].some(v => String(v || '').trim().toLowerCase() === key)) : null;
    return sc ? [Number(sc.lat), Number(sc.lng)] : null;
  }
  function distanceKm(a, b) {
    const pa = cityCoord(a), pb = cityCoord(b);
    if (!pa || !pb) return null;
    const rad = (v) => v * Math.PI / 180;
    const dLat = rad(pb[0] - pa[0]), dLng = rad(pb[1] - pa[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(pa[0])) * Math.cos(rad(pb[0])) * Math.sin(dLng / 2) ** 2;
    return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
  }
  /** 사진 기록을 시간순으로 훑어, 같은 도시가 이어지면 한 번의 방문으로 묶는다 */
  function routeStops(c) {
    const stops = [];
    c.entries().slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt))).forEach(e => {
      const urls = (e.photos || []).map(p => c.photoUrl(p)).filter(Boolean);
      if (!urls.length || typeof placeEn !== 'function') return;
      const loc = placeEn(e.location);
      const name = String(loc.city || loc.country || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      let stop = stops[stops.length - 1];
      if (!stop || stop.key !== key) { stop = { key, name, country: String(loc.country || '').trim(), from: e.date, to: e.date, cover: urls[0], shots: [] }; stops.push(stop); }
      stop.to = e.date;
      urls.forEach(url => stop.shots.push({ url, info: DiaryArchive.infoOf(e) }));
    });
    return stops;
  }
  function routeSummary(stops) {
    const cities = new Set(stops.map(s => s.key)).size;
    const legs = stops.slice(1).map((s, i) => distanceKm(stops[i].key, s.key));
    const km = legs.length && legs.every(v => v != null) ? legs.reduce((sum, v) => sum + v, 0) : null;
    const label = `${cities} ${cities === 1 ? 'city' : 'cities'}`;
    return { label, km, legs, text: km != null ? `${label} · ${km.toLocaleString('en-US')}km` : label };
  }
  const stopDates = (s) => {
    const from = s.from.replace(/-/g, '.');
    if (s.from === s.to) return from;
    return `${from} ~ ${s.to.slice(0, 4) === s.from.slice(0, 4) ? s.to.slice(5).replace('-', '.') : s.to.replace(/-/g, '.')}`;
  };
  const PIN = '<path d="M14 0a14 14 0 0 0-14 14c0 10 14 24 14 24s14-14 14-24A14 14 0 0 0 14 0Z"/><circle cx="14" cy="14" r="5"/>';
  /** 오간 나라를 방문 순서로 묶는다. 같은 나라를 다시 가면 다시 한 줄로 남겨 오간 흐름이 보이게 한다 */
  function countryVisits(stops) {
    const visits = [];
    stops.forEach(s => {
      let v = visits[visits.length - 1];
      if (!v || v.country !== s.country) { v = { country: s.country, from: s.from, to: s.to, cities: [] }; visits.push(v); }
      v.to = s.to;
      if (s.name !== s.country && !v.cities.includes(s.name)) v.cities.push(s.name);
    });
    return visits;
  }
  function countriesHtml(stops) {
    const visits = countryVisits(stops);
    const n = new Set(visits.map(v => v.country).filter(Boolean)).size;
    return `<div class="rec-route__countries" id="recRouteCountries" hidden>
      <p class="rec-route__chead">${n} ${n === 1 ? 'country' : 'countries'}</p>
      <ol>${visits.map((v, i) => `<li><i>${i + 1}</i><span><b>${esc(v.country || '나라 미상')}</b><small>${esc([v.cities.join(', '), stopDates(v)].filter(Boolean).join(' · '))}</small></span></li>`).join('')}</ol>
    </div>`;
  }
  function toggleCountries(open) {
    const panel = recapView && recapView.querySelector('.rec-route__countries');
    const pill = recapView && recapView.querySelector('.rec-route__pill');
    if (!panel || !pill) return;
    panel.hidden = !open;
    pill.setAttribute('aria-expanded', String(open));
  }
  function routeHtml(stops, W) {
    const sum = routeSummary(stops);
    const years = [...new Set([stops[0].from.slice(0, 4), stops[stops.length - 1].to.slice(0, 4)])].join(' ~ ');
    const cardW = Math.round(W * 0.29), cardH = Math.round(cardW * 1.22), side = 24;
    const rowH = cardH + 34, firstTop = 78;
    const spots = stops.map((s, i) => {
      const left = i % 2 === 0;
      const x = left ? side : W - side - cardW;
      const top = firstTop + i * rowH;
      return { s, i, left, x, top, cx: x + cardW / 2, tip: top - 8 };
    });
    const paths = [], kms = [];
    spots.slice(1).forEach((b, k) => {
      const a = spots[k], dir = b.cx > a.cx ? 1 : -1, reach = cardW / 2 + 12;
      const midX = W / 2 + (k % 2 ? -8 : 8), midY = a.tip + (b.tip - a.tip) * 0.5;
      paths.push(`<path pathLength="1" style="animation-delay:${Math.min(k * 0.18, 1)}s" d="M${a.cx} ${a.tip} L${a.cx + dir * reach} ${a.tip - 6} L${midX} ${midY} L${b.cx - dir * reach} ${b.tip - 6} L${b.cx} ${b.tip}"/>`);
      if (sum.legs[k] != null) kms.push(`<span class="rec-route__km" style="left:${Math.round(W / 2)}px;top:${Math.round(midY + 8)}px">${sum.legs[k].toLocaleString('en-US')}km</span>`);
    });
    const height = firstTop + (stops.length - 1) * rowH + cardH + 44;
    const marks = spots.map(p => p.i === 0
      ? `<span class="rec-route__start" style="left:${p.cx - 13}px;top:${p.tip - 26}px"></span>`
      : `<svg class="rec-route__pin" style="left:${p.cx - 14}px;top:${p.tip - 38}px" viewBox="0 0 28 38" aria-hidden="true">${PIN}</svg>`).join('');
    const cards = spots.map(p => `
      <button type="button" class="rec-route__stop ${p.left ? 'is-left' : 'is-right'}" data-stop="${p.i}" style="left:${p.x}px;top:${p.top}px;width:${cardW}px" aria-label="${esc(p.s.name)} 사진 ${p.s.shots.length}장">
        <span class="rec-route__photo" style="height:${cardH}px"><img src="${esc(p.s.cover)}" alt="" loading="lazy" draggable="false"><b>${p.s.shots.length}</b></span>
        <span class="rec-route__name">${esc(p.s.name)}</span>
      </button>`).join('');
    return `${photoBg(stops[stops.length - 1].cover)}
      <div class="rec-route">
        <div class="rec-route__top">
          <button type="button" class="rec-route__pill" data-countries aria-expanded="false" aria-controls="recRouteCountries" aria-label="${esc(sum.text)}, 다녀온 나라 보기"><svg width="14" height="18" viewBox="0 0 28 38" aria-hidden="true">${PIN}</svg><b>${esc(sum.text)}</b><em>${esc(years)}</em></button>
          ${countriesHtml(stops)}
        </div>
        <div class="rec-route__stage" style="height:${height}px">
          <svg class="rec-route__line" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" aria-hidden="true">${paths.join('')}</svg>
          ${marks}${kms.join('')}${cards}
        </div>
        <button type="button" class="rec-route__sheet" data-open-stop></button>
      </div>`;
  }
  function pickStop(i) {
    if (!recapView) return;
    const s = recapView._stops[i];
    const sheet = recapView.querySelector('.rec-route__sheet');
    if (!s || !sheet) return;
    recapView._picked = i;
    sheet.setAttribute('aria-label', `${s.name} 사진 보기`);
    sheet.innerHTML = `<img src="${esc(s.cover)}" alt="" draggable="false"><span><b>${esc(s.name)}</b><small>${esc(stopDates(s))} · 사진 ${s.shots.length}장</small></span><i aria-hidden="true">→</i>`;
  }
  let recapView = null;
  function renderRecap() {
    if (!recapView) return;
    const stops = routeStops(ctx);
    recapView._stops = stops;
    const body = recapView.querySelector('.rec-layer__body');
    if (!stops.length) {
      body.innerHTML = `${photoBg('')}<div class="rec-route rec-route--empty"><p>사진에 위치를 남기면<br>여행 경로가 그려져요.</p></div>`;
      return;
    }
    body.innerHTML = routeHtml(stops, recapView.clientWidth || 402);
    pickStop(stops.length - 1);
  }
  function openRecap(c) {
    ctx = c;
    if (!recapView) {
      recapView = openLayer('rec-recapview rec-layer--photo', 'Recap');
      recapView.innerHTML = headHtml('Recap', '') + '<div class="rec-layer__body"></div>';
      recapView.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-close]')) { const r = recapView; recapView = null; closeLayer(r); return; }
        const panel = recapView.querySelector('.rec-route__countries');
        if (ev.target.closest('[data-countries]')) { toggleCountries(!!(panel && panel.hidden)); return; }
        if (panel && !panel.hidden) { if (!ev.target.closest('.rec-route__countries')) toggleCountries(false); return; }
        const stop = ev.target.closest('[data-stop]');
        if (stop) { pickStop(Number(stop.dataset.stop)); return; }
        const open = ev.target.closest('[data-open-stop]');
        if (open) {
          const s = recapView._stops[recapView._picked];
          const img = open.querySelector('img');
          if (s && img) openShots(s.shots, img);
        }
      });
    }
    renderRecap();
  }
  /** 첫 화면 Recap 카드 — 최근에 간 도시 사진을 겹쳐 보여 준다 */
  function recapCardHtml(c) {
    ctx = c;
    const stops = routeStops(c);
    const thumbs = stops.slice(-3).reverse().map(s => s.cover);
    return `
      <button type="button" class="rec-recapcard" data-recap="route" aria-label="여행 경로 열기">
        <span class="rec-recapcard__text">
          <b class="rec-recapcard__title">My route</b>
          <small>${stops.length ? esc(routeSummary(stops).text) : '사진에 위치를 남기면 경로가 그려져요.'}</small>
        </span>
        <span class="rec-recapcard__thumbs" aria-hidden="true">${thumbs.map((u, i) => `<img src="${esc(u)}" alt="" style="--i:${i}" draggable="false">`).join('')}</span>
        <span class="rec-recapcard__arrow" aria-hidden="true">→</span>
      </button>`;
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
    { key: 'sticker', label: '스티커', icon: '✦' },
    { key: 'song', label: '노래', icon: '♪' },
    { key: 'template', label: '템플릿', icon: '▦' },
    { key: 'bg', label: '배경', icon: '▤' }
  ];

  function openEditor(entry, onSaved) {
    const el = openLayer('rec-editor', '페이지 꾸미기');
    ed = { el, entry, page: pageOf(entry), sel: null, tool: 'photo', hist: [], at: -1, dirty: false, onSaved };
    if (entry.meta) ed.page.meta = Object.assign({}, entry.meta);   // 다이어리 제목·기간을 페이지와 함께 저장
    if (entry.date) ed.page.date = entry.date;
    if (entry.title && !ed.page.title) ed.page.title = entry.title;
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
    fitPhotos();
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
    const isPhoto = /rec-it--photo/.test(node.className);
    const framed = isPhoto && item(ed.sel) && item(ed.sel).frame !== false;
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
          ${isPhoto ? '<button type="button" data-crop>자르기</button>' : ''}
          ${isPhoto ? `<button type="button" data-frame>${framed ? '테두리 빼기' : '테두리 넣기'}</button>` : ''}
        </span>
      </span>`);
  }
  /**
   * 기록 사진은 처음에 정해진 칸 크기로 놓여 칸 모양대로 잘려 보였다.
   * 크기 손잡이는 가로세로를 같이 늘리므로 사용자가 비율을 바꿀 길이 없다 — 그래서 사진 칸 비율이
   * 실제 사진과 다르면(기본 배치·템플릿 때문) 가로 폭은 두고 높이를 원래 비율로 맞춘다(가운데 기준).
   * 예전에 저장한 다이어리도 꾸미기를 열면 맞춰진다.
   */
  function fitPhotos() {
    if (!ed) return;
    const cur = ed;
    cur.page.items.filter(it => it.type === 'photo' && !it.crop).forEach(it => {
      const src = srcOf(it);
      if (!src) return;   // 사진 주소가 아직 없으면 다음에(record:photos) 다시
      const img = new Image();
      img.onload = () => {
        if (ed !== cur || !img.naturalWidth || !cur.page.items.includes(it)) return;
        const h = Math.min(1.1, it.w * img.naturalHeight / img.naturalWidth);
        delete it.fit;
        if (Math.abs(h - it.h) / it.h < 0.02) return;
        it.y = Math.max(0, it.y + (it.h - h) / 2);
        it.h = h;
        // 처음 배치를 고치는 것이라 되돌리기 기록은 새로 쌓지 않고 마지막 기록을 바꾼다
        cur.hist[cur.at] = JSON.stringify(cur.page);
        drawEditor();
      };
      img.src = src;
    });
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
        <button type="button" class="rec-opt rec-opt--wide" data-add-text="hand"><span class="rec-opt__hand">손글씨</span></button>
      </div>`;
    } else if (ed.tool === 'sticker') {
      const tab = ed.stickerTab || 'basic';
      const DS = typeof DiaryStickers !== 'undefined' ? DiaryStickers : null;
      const mine = DS ? DS.mine() : [];
      const grid = tab === 'basic'
        ? (DS ? DS.LIST.map(x => `<button type="button" class="rec-opt rec-opt--art" data-add-art="b:${x.key}" aria-label="${esc(x.label)} 스티커"><img src="${esc(DS.builtinUrl(x.key))}" alt="" draggable="false"></button>`).join('') : '')
        : `<button type="button" class="rec-opt rec-opt--upload" data-upload="sticker" aria-label="스티커 올리기">+</button>` +
          mine.map(x => `<span class="rec-opt rec-opt--art rec-opt--mine"><button type="button" data-add-art="u:${esc(x.id)}" aria-label="내 스티커 붙이기"><img src="${esc(x.src)}" alt="" draggable="false"></button><button type="button" class="rec-opt__x" data-del-mine="${esc(x.id)}" aria-label="내 스티커에서 지우기">×</button></span>`).join('');
      p.innerHTML = `<div class="rec-stabs" role="tablist">
          <button type="button" role="tab" data-stab="basic" aria-selected="${tab === 'basic'}">기본 스티커</button>
          <button type="button" role="tab" data-stab="mine" aria-selected="${tab === 'mine'}">내 스티커</button>
        </div>
        <div class="rec-opts rec-opts--scroll rec-opts--art">${grid}</div>
        ${tab === 'mine' ? '<p class="rec-songpick__hint">핀터레스트 등에서 받은 SVG·PNG(배경 투명)를 올리면<br>내 스티커가 되고 다른 다이어리에서도 쓸 수 있어요.</p>' : ''}`;
    } else if (ed.tool === 'song') {
      const sg = ed.page.song;
      const shown = ed.page.items.some(i => i.type === 'song');
      p.innerHTML = sg ? `<div class="rec-songpick">
          <span class="rec-songpick__now">♪ <b>${esc(sg.name)}</b> · ${esc(sg.artist)}</span>
          <button type="button" class="rec-songpick__clear" data-song-sticker aria-pressed="${shown}">${shown ? '스티커 숨기기' : '스티커 보이기'}</button>
          <button type="button" class="rec-songpick__clear" data-song-clear>빼기</button>
        </div>
        <p class="rec-songpick__hint">다이어리를 열면 이 노래가 재생돼요.<br>스티커를 숨겨도 노래는 그대로 재생돼요.</p>` : `<div class="rec-songpick">
          <input type="text" class="rec-songpick__input" id="recSongInput" placeholder="곡 제목이나 가수로 검색" autocomplete="off">
        </div>
        <ul class="rec-songpick__list" id="recSongList"></ul>`;
      const input = p.querySelector('#recSongInput');
      if (input && typeof SongEngine !== 'undefined') {
        let timer = 0;
        input.addEventListener('input', () => {
          clearTimeout(timer);
          timer = setTimeout(async () => {
            const q = input.value.trim();
            const list = p.querySelector('#recSongList');
            if (!q) { list.innerHTML = ''; return; }
            const found = await SongEngine.searchTracks(q);
            ed && (ed.songResults = found);
            list.innerHTML = found.slice(0, 6).map((m, i) => `<li><button type="button" data-pick-song="${i}"><b>${esc(m.name)}</b> · ${esc(m.artist)}</button></li>`).join('')
              || '<li class="rec-songpick__empty">찾는 노래가 없어요</li>';
          }, 300);
        });
      }
    } else if (ed.tool === 'template') {
      p.innerHTML = `<div class="rec-opts">${TEMPLATES.map(t => `
        <button type="button" class="rec-opt rec-opt--tpl" data-template="${t.key}"><span class="rec-tpl rec-tpl--${t.key}" aria-hidden="true"><i></i><i></i><i></i></span><small>${t.label}</small></button>`).join('')}</div>`;
    } else if (ed.tool === 'bg') {
      p.innerHTML = `<div class="rec-opts rec-opts--labeled">${BGS.map(b => `
        <button type="button" class="rec-opt rec-opt--bg${(ed.page.bg || 'cream') === b.key ? ' is-on' : ''}" data-bg="${b.key}" aria-pressed="${(ed.page.bg || 'cream') === b.key}">
          <span class="rec-bgsw rec-page--${b.key}"${b.key === 'upload' && ed.page.bgImg ? ` style="background-image:url('${ed.page.bgImg}')"` : ''}>${b.key === 'upload' && !ed.page.bgImg ? '+' : ''}</span>
          <small>${b.label}</small>
        </button>`).join('')}</div>
      <label class="rec-headtoggle"><input type="checkbox" data-head-toggle ${headStrip(ed.page) ? 'checked' : ''}> 맨 위에 날짜·제목 작게 표시</label>`;
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
      const leave = () => { const el = ed.el; ed = null; closeLayer(el); };
      if (ed.dirty) ask('꾸민 내용을 저장하지 않고 나갈까요?', '나가기').then(ok => { if (ok && ed) leave(); });
      else leave();
      return;
    }
    if (t.closest('[data-save]')) {
      const all = loadPages();
      all[ed.entry.id] = ed.page;
      if (!savePages(all)) return;
      const el = ed.el, done = ed.onSaved; ed = null; closeLayer(el);
      renderFolder();
      if (done) done();
      toast('저장했어요');
      return;
    }
    if (t.closest('[data-undo]')) { stepHist(-1); return; }
    if (t.closest('[data-redo]')) { stepHist(1); return; }
    const tool = t.closest('[data-tool]');
    if (tool) { ed.tool = tool.dataset.tool; drawPanel(); return; }
    const ph = t.closest('[data-add-photo]');
    if (ph) {
      const h = 0.5;
      addItem({ type: 'photo', path: ph.dataset.addPhoto, x: 0.25, y: centerY(h), w: 0.42, h, rot: 0, fit: true });
      fitPhotos();
      return;
    }
    const up = t.closest('[data-upload]');
    if (up) {
      const f = ed.el.querySelector('#recEdFile');
      f.dataset.for = up.dataset.upload;
      f.accept = up.dataset.upload === 'sticker' ? 'image/svg+xml,.svg,image/png,image/webp,image/gif' : 'image/*';
      f.click(); return;
    }
    const tx = t.closest('[data-add-text]');
    if (tx) {
      const memo = tx.dataset.addText === 'memo';
      const hand = tx.dataset.addText === 'hand';
      askText(memo ? '메모지에 적을 말' : '넣을 글자', '').then(text => {
        if (!ed || !text || !text.trim()) return;
        const h = memo ? 0.3 : hand ? 0.22 : 0.12;
        const it = { type: memo ? 'memo' : 'text', text: text.trim(), x: memo ? 0.3 : 0.15, y: centerY(h), w: memo ? 0.4 : 0.7, h, rot: memo ? -1.5 : 0 };
        if (hand) Object.assign(it, { font: 'hand', fs: 0.042 });
        addItem(it);
      });
      return;
    }
    const stab = t.closest('[data-stab]');
    if (stab) { ed.stickerTab = stab.dataset.stab; drawPanel(); return; }
    const art = t.closest('[data-add-art]');
    if (art) {
      const key = art.dataset.addArt;
      const r = typeof DiaryStickers !== 'undefined' ? DiaryStickers.ratioOf(key) : 1;
      const w = r > 1.5 ? 0.14 : r < 0.5 ? 0.5 : 0.26;
      const h = w * r;
      addItem({ type: 'art', art: key, x: 0.5 - w / 2, y: centerY(h), w, h, rot: 0 });
      return;
    }
    const dm = t.closest('[data-del-mine]');
    if (dm) {
      const id = dm.dataset.delMine;
      ask('이 스티커를 내 스티커에서 지울까요?\n이미 붙인 다이어리에서도 사라져요.', '지우기', true)
        .then(ok => { if (ok && ed) { DiaryStickers.removeMine(id); drawPanel(); drawEditor(); } });
      return;
    }
    const ht = t.closest('[data-head-toggle]');
    if (ht) { ed.page.head = ht.checked; pushHist(); drawEditor(); return; }
    const st = t.closest('[data-add-sticker]');
    if (st) { addItem({ type: 'sticker', emoji: st.dataset.addSticker, x: 0.44, y: centerY(0.12), w: 0.12, h: 0.12, rot: 0 }); return; }
    const ps = t.closest('[data-pick-song]');
    if (ps) {
      const m = (ed.songResults || [])[Number(ps.dataset.pickSong)];
      if (!m) return;
      ed.page.song = { name: m.name, artist: m.artist, preview: null };
      ed.page.items = ed.page.items.filter(i => i.type !== 'song');
      addItem({ type: 'song', name: m.name, artist: m.artist, x: 0.5, y: centerY(0.1), w: 0.44, h: 0.1, rot: -2 });
      drawPanel();
      // 열 때 바로 틀 수 있게 미리듣기 주소를 지금 받아 둔다(누른 순간 기다리면 휴대폰이 재생을 막는다)
      if (typeof SongEngine !== 'undefined') {
        const page = ed.page;
        SongEngine.fetchPreviewUrl(m.name, m.artist).then(u => { if (page.song && page.song.name === m.name) page.song.preview = u || null; });
      }
      return;
    }
    if (t.closest('[data-song-sticker]')) {
      const sg = ed.page.song;
      if (!sg) return;
      if (ed.page.items.some(i => i.type === 'song')) {
        ed.page.items = ed.page.items.filter(i => i.type !== 'song'); ed.sel = null;
        sg.hidden = true; pushHist(); drawEditor();
      } else {
        sg.hidden = false;
        addItem({ type: 'song', name: sg.name, artist: sg.artist, x: 0.5, y: centerY(0.1), w: 0.44, h: 0.1, rot: -2 });
      }
      drawPanel();
      return;
    }
    if (t.closest('[data-song-clear]')) {
      ed.page.song = null;
      ed.page.items = ed.page.items.filter(i => i.type !== 'song');
      pushHist(); drawEditor(); drawPanel();
      return;
    }
    const tp = t.closest('[data-template]');
    if (tp) { applyTemplate(tp.dataset.template); return; }
    const bg = t.closest('[data-bg]');
    if (bg) {
      if (bg.dataset.bg === 'upload' && !ed.page.bgImg) { const f = ed.el.querySelector('#recEdFile'); f.dataset.for = 'bg'; f.click(); return; }
      if (bg.dataset.bg === 'upload' && ed.page.bg === 'upload') { const f = ed.el.querySelector('#recEdFile'); f.dataset.for = 'bg'; f.click(); return; }
      ed.page.bg = bg.dataset.bg; pushHist(); drawEditor(); drawPanel(); return;
    }
    if (t.closest('[data-del]')) {
      // 노래 스티커를 지우면 노래는 남기고 스티커만 숨긴 것으로 친다(노래 도구의 '스티커 보이기'와 맞게)
      const gone = item(ed.sel);
      if (gone && gone.type === 'song' && ed.page.song) ed.page.song.hidden = true;
      ed.page.items = ed.page.items.filter(i => i.id !== ed.sel); ed.sel = null; pushHist(); drawEditor();
      if (gone && gone.type === 'song' && ed.tool === 'song') drawPanel();
      return;
    }
    if (t.closest('[data-front]')) { const it = item(ed.sel); if (it) { it.z = topZ(); pushHist(); drawEditor(); } return; }
    if (t.closest('[data-edit-text]')) { editText(item(ed.sel)); return; }
    if (t.closest('[data-crop]')) { cropPhoto(item(ed.sel)); return; }
    // 사진의 흰 테두리(필름·폴라로이드 느낌)는 사진마다 켜고 끈다
    if (t.closest('[data-frame]')) { const it = item(ed.sel); if (it) { it.frame = it.frame === false ? true : false; pushHist(); drawEditor(); } return; }
  }
  /**
   * 사진 자르기 — 원본 / 4:3 / 3:4 / 1:1 중에 고르고, 잘린 틀 안에서 사진을 끌어 보일 부분을 정한다.
   * 원본이면 자르지 않는다(crop 없음, 높이는 사진 비율). 자르면 it.crop = '4:3' 처럼 비율 이름, it.pos = {x,y}(%).
   */
  const CROPS = [{ key: '', label: '원본' }, { key: '4:3', r: 3 / 4 }, { key: '3:4', r: 4 / 3 }, { key: '1:1', r: 1 }];
  function cropPhoto(it) {
    if (!it || it.type !== 'photo') return;
    const src = srcOf(it);
    if (!src) return;
    const img0 = new Image();
    img0.onload = () => {
      const natural = img0.naturalHeight / img0.naturalWidth;
      // 템플릿이 정한 칸(crop:true)은 그 칸 비율 그대로 시작
      let key = typeof it.crop === 'string' ? it.crop : '';
      let custom = it.crop === true ? it.h / it.w : null;
      const pos = { x: it.pos ? Number(it.pos.x) : 50, y: it.pos ? Number(it.pos.y) : 50 };
      const ratioOf = () => (key ? CROPS.find(c => c.key === key).r : custom || natural);
      const wrap = document.createElement('div');
      wrap.className = 'rec-ask';
      wrap.innerHTML = `<div class="rec-ask__box rec-crop" role="dialog" aria-modal="true" aria-label="사진 자르기">
          <p class="rec-ask__msg">사진 자르기</p>
          <div class="rec-crop__chips" role="group" aria-label="비율">
            ${CROPS.map(c => `<button type="button" class="rec-chip" data-crop-key="${c.key}">${c.label || c.key}</button>`).join('')}
          </div>
          <div class="rec-crop__stage"><div class="rec-crop__frame"><img src="${esc(src)}" alt="" draggable="false"></div></div>
          <p class="rec-crop__hint"></p>
          <div class="rec-ask__btns">
            <button type="button" data-ask="no">취소</button>
            <button type="button" data-ask="yes">적용</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('is-open'));
      const frame = wrap.querySelector('.rec-crop__frame');
      const fimg = frame.querySelector('img');
      const hint = wrap.querySelector('.rec-crop__hint');
      const paint = () => {
        const r = ratioOf();
        // 무대(최대 260×300) 안에 들어가는 틀 크기
        const W = Math.min(260, 300 / r);
        frame.style.width = W + 'px'; frame.style.height = W * r + 'px';
        fimg.style.objectPosition = `${pos.x}% ${pos.y}%`;
        wrap.querySelectorAll('[data-crop-key]').forEach(b => b.classList.toggle('is-on', b.dataset.cropKey === key && !(custom && !key)));
        const cutting = !!key || !!custom;
        frame.classList.toggle('is-cut', cutting);
        hint.textContent = cutting ? '사진을 끌어 보일 부분을 정해요' : '사진 그대로 넣어요';
      };
      // 끌기 — 틀 안에서 사진을 옮긴다(손가락 방향대로 사진이 따라오게 %를 반대로)
      let drag = null;
      frame.addEventListener('pointerdown', (e) => {
        if (!key && !custom) return;
        drag = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
        frame.setPointerCapture(e.pointerId);
      });
      frame.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const fw = frame.clientWidth, fh = frame.clientHeight, r = ratioOf();
        // 넘치는 양(px) — 사진이 틀보다 큰 쪽으로만 움직일 수 있다
        const overX = natural < r ? fh / natural - fw : 0;
        const overY = natural > r ? fw * natural - fh : 0;
        if (overX > 0) pos.x = Math.max(0, Math.min(100, drag.px - (e.clientX - drag.x) / overX * 100));
        if (overY > 0) pos.y = Math.max(0, Math.min(100, drag.py - (e.clientY - drag.y) / overY * 100));
        fimg.style.objectPosition = `${pos.x}% ${pos.y}%`;
      });
      const endDrag = () => { drag = null; };
      frame.addEventListener('pointerup', endDrag);
      frame.addEventListener('pointercancel', endDrag);
      const close = () => wrap.remove();
      wrap.addEventListener('click', (e) => {
        const c = e.target.closest('[data-crop-key]');
        if (c) { key = c.dataset.cropKey; custom = null; pos.x = 50; pos.y = 50; paint(); return; }
        const b = e.target.closest('[data-ask]');
        if (!b && e.target !== wrap) return;
        if (b && b.dataset.ask === 'yes' && ed) {
          const r = ratioOf();
          const h = Math.min(1.1, it.w * r);
          it.y = Math.max(0, it.y + (it.h - h) / 2);
          it.h = h;
          if (key) { it.crop = key; it.pos = { x: Math.round(pos.x), y: Math.round(pos.y) }; }
          else if (custom) { it.crop = true; it.pos = { x: Math.round(pos.x), y: Math.round(pos.y) }; }
          else { delete it.crop; delete it.pos; }
          pushHist(); drawEditor();
        }
        close();
      });
      paint();
    };
    img0.src = src;
  }

  function editText(it) {
    if (!it) return;
    askText('글 고치기 (다 지우면 이 글이 빠져요)', it.text || '', '고치기').then(text => {
      if (text == null || !ed) return;
      if (!text.trim()) { ed.page.items = ed.page.items.filter(i => i.id !== it.id); ed.sel = null; }
      else it.text = text.trim();
      pushHist(); drawEditor();
    });
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
  /** 내 스티커 올리기 — SVG는 그대로(작을 때만), 그림 파일은 투명함을 살려 PNG로 줄인다 */
  function addMySticker(file) {
    const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
    const done = (src, ratio) => {
      const s = DiaryStickers.addMine(src, ratio);
      if (!s) { toast('이 기기의 저장 공간이 부족해요. 쓰지 않는 내 스티커를 지운 뒤 다시 올려 주세요.'); return; }
      ed.stickerTab = 'mine'; drawPanel();
      const w = ratio > 1.5 ? 0.18 : 0.3;
      addItem({ type: 'art', art: 'u:' + s.id, x: 0.5 - w / 2, y: centerY(w * ratio), w, h: w * ratio, rot: 0 });
    };
    if (isSvg) {
      if (file.size > 300 * 1024) { toast('SVG가 너무 커요(300KB까지). 더 단순한 파일로 올려 주세요.'); return; }
      const rd = new FileReader();
      rd.onload = () => {
        const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(String(rd.result))));
        const img = new Image();
        img.onload = () => done(src, img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : 1);
        img.onerror = () => toast('SVG를 읽지 못했어요. 다른 파일로 해 볼까요?');
        img.src = src;
      };
      rd.readAsText(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      done(c.toDataURL('image/png'), c.height / c.width);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('그림을 읽지 못했어요. 다른 파일로 해 볼까요?'); };
    img.src = url;
  }
  async function onFile(ev) {
    const input = ev.target;
    const file = input.files && input.files[0];
    const target = input.dataset.for;
    input.value = '';
    if (!file || !ed) return;
    let ready = file;
    try { if (window.HeicFix) ready = await HeicFix.prepare(file); }   // 아이폰 HEIC → JPEG(필요할 때만)
    catch (e) { toast('아이폰 사진(HEIC)을 바꾸지 못했어요. JPG·PNG로 올려 주세요.'); return; }
    if (target === 'sticker') { addMySticker(ready); return; }
    try {
      const { data, ratio } = await shrink(ready, 900);
      if (target === 'bg') { ed.page.bg = 'upload'; ed.page.bgImg = data; pushHist(); drawEditor(); drawPanel(); return; }
      const w = 0.46, h = Math.min(0.9, w * ratio);
      addItem({ type: 'photo', src: data, x: 0.27, y: centerY(h), w, h, rot: 0 });
    } catch (e) { toast('사진을 읽지 못했어요. 다른 사진으로 해 볼까요?'); }
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
      p.crop = true;   // 템플릿은 일부러 칸 모양대로 자른다 — fitPhotos가 되돌리지 않게
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
      node.style.cssText = node.classList.contains('is-fit') ? itemStyle(it).replace(/height:[^;]*;/, '') : itemStyle(it);
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
  document.addEventListener('record:photos', () => { if (storage) renderStorage(); if (folderView && !ed) renderFolder(); if (ed) { drawEditor(); fitPhotos(); } });
  document.addEventListener('archive:changed', () => { if (storage) renderStorage(); if (folderView && !ed) renderFolder(); if (recapView) renderRecap(); });

  /* ------------------------------------------------------------ 다이어리 (Recent 밑 'Diary')
   * 다이어리 한 장 = 인상 깊었던 하루 또는 기간(여행 등). 제목과 날짜(하루 / 시작~끝)를 받고,
   * 그 기간에 남긴 기록의 사진·글로 첫 배치를 만든다. 꾸미기에서 사진·글·스티커·노래를 얹고, 열면 노래가 재생된다.
   * 저장은 페이지 저장소에 'diary:<id>' 키로(이 기기). page.meta = { title, start, end }.
   * 예전 'day:YYYY-MM-DD' 다이어리도 하루짜리로 그대로 읽는다. */
  const isDiaryKey = (k) => k.startsWith('diary:') || k.startsWith('day:');
  function metaOf(key, page) {
    if (page && page.meta) return page.meta;
    const d = key.startsWith('day:') ? key.slice(4) : '';
    return { title: '', start: d, end: d };
  }
  function rangeEntry(c, key, meta) {
    const items = (c.entries() || []).filter(e => e.date >= meta.start && e.date <= meta.end)
      .sort((x, y) => x.date.localeCompare(y.date) || String(x.createdAt).localeCompare(String(y.createdAt)));
    const first = items.find(e => (e.body || '').trim()) || items[0] || {};
    return { id: key, date: meta.start, meta, photos: items.flatMap(e => e.photos || []), body: first.body || '', location: first.location || null, title: meta.title || first.title || '' };
  }
  function listDiaries() {
    const all = loadPages();
    return Object.keys(all).filter(isDiaryKey).map(k => ({ key: k, page: all[k], meta: metaOf(k, all[k]) }))
      .sort((a, b) => (b.meta.end || '').localeCompare(a.meta.end || '') || (b.meta.start || '').localeCompare(a.meta.start || ''));
  }
  const shortD = (iso) => iso ? `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}` : '';
  function rangeLabel(meta) {
    if (!meta.start) return '';
    if (!meta.end || meta.end === meta.start) return shortD(meta.start);
    return `${shortD(meta.start)}–${shortD(meta.end)}`;
  }
  function diaryThumbHtml(c, d) { ctx = c; return pageHtml(d.page, 'rec-page--thumb'); }

  /** 새 다이어리 — 제목 + 하루/기간을 받는 작은 시트. 만들면 바로 꾸미기로 */
  function createDiary(c, today, onSaved) {
    ctx = c;
    const el = openLayer('rec-diarynew', '다이어리 만들기');
    let mode = 'day';
    el.innerHTML = headHtml('다이어리 만들기', '') + `
      <div class="rec-layer__body">
        <form class="rec-dnew" id="recDNew">
          <label class="rec-dnew__field"><span>제목</span>
            <input type="text" name="title" maxlength="30" placeholder="예: 파리 여행, 첫 수업 날, 생일" autocomplete="off">
          </label>
          <div class="rec-dnew__field"><span>날짜</span>
            <div class="rec-chips rec-dnew__mode" role="group" aria-label="하루 또는 기간">
              <button type="button" class="rec-chip is-on" data-mode="day" aria-pressed="true">하루</button>
              <button type="button" class="rec-chip" data-mode="range" aria-pressed="false">기간</button>
            </div>
            <div class="rec-dnew__dates">
              <input type="date" name="start" value="${today}" max="${today}" required aria-label="날짜">
              <span class="rec-dnew__tilde" hidden>~</span>
              <input type="date" name="end" value="${today}" max="${today}" aria-label="끝 날짜" hidden>
            </div>
          </div>
          <p class="rec-dnew__hint">그 날짜에 남긴 사진과 글로 첫 장을 만들어 드려요.<br>사진·글·스티커·노래는 꾸미기에서 더할 수 있어요.</p>
          <button type="submit" class="rec-dnew__go">만들고 꾸미기</button>
        </form>
      </div>`;
    const form = el.querySelector('#recDNew');
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) { closeLayer(el); return; }
      const m = ev.target.closest('[data-mode]');
      if (!m) return;
      mode = m.dataset.mode;
      el.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
      form.elements.end.hidden = mode === 'day';
      el.querySelector('.rec-dnew__tilde').hidden = mode === 'day';
      form.elements.start.setAttribute('aria-label', mode === 'day' ? '날짜' : '시작 날짜');
    });
    form.elements.start.addEventListener('change', () => { if (form.elements.end.value < form.elements.start.value) form.elements.end.value = form.elements.start.value; form.elements.end.min = form.elements.start.value; });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const start = form.elements.start.value || today;
      const end = mode === 'range' ? (form.elements.end.value || start) : start;
      const meta = { title: form.elements.title.value.trim(), start, end: end < start ? start : end };
      const key = 'diary:' + uid();
      closeLayer(el);
      openEditor(rangeEntry(c, key, meta), onSaved);
    });
    setTimeout(() => form.elements.title.focus(), 350);
  }

  /** 26.11.15 — 연도까지(기간이 해를 넘길 수도 있다) */
  const fullD = (iso) => iso ? `${iso.slice(2, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)}` : '';
  /** Nov.16 — 기간 끝이 같은 달이면 날짜만(Nov.10 – 16), 다른 달이면 Dec.2 */
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function enD(iso, from) {
    if (!iso) return '';
    const d = Number(iso.slice(8, 10)), m = Number(iso.slice(5, 7)) - 1;
    if (from && from.slice(0, 7) === iso.slice(0, 7)) return String(d);
    return `${MON3[m]}.${d}`;
  }
  /** 날짜 칸 아래 작은 줄 — 하루면 요일(영어), 기간이면 며칠인지 */
  function dayWord(meta) {
    if (!meta.start) return '';
    const a = new Date(meta.start + 'T00:00:00'), b = new Date((meta.end || meta.start) + 'T00:00:00');
    const days = Math.round((b - a) / 864e5) + 1;
    if (days > 1) return `${days} days`;
    return a.toLocaleDateString('en-US', { weekday: 'long' });
  }
  let diaryAudio = null;
  function stopDiarySong() { if (diaryAudio) { diaryAudio.pause(); diaryAudio = null; } }
  function openDiary(c, key, onChange) {
    ctx = c;
    if (!loadPages()[key]) return;
    const el = openLayer('rec-diaryview', '다이어리');
    const draw = () => {
      const pg = loadPages()[key];
      if (!pg) return null;
      const meta = metaOf(key, pg);
      const sg = pg.song;
      el.innerHTML = headHtml('Diary', '<button type="button" class="rec-top__action rec-top__action--edit" data-edit-day aria-label="수정하기"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg></button>') + `
        <div class="rec-layer__body">
          <!-- 위: 날짜 | 제목 | 노래 세 칸 -->
          <div class="rec-dtop${sg ? '' : ' is-nosong'}">
            <div class="rec-dtop__date">
              <b>${enD(meta.start)}${meta.end && meta.end !== meta.start ? `<i> – ${enD(meta.end, meta.start)}</i>` : ''}</b>
              <small>${(meta.start || '').slice(0, 4)}${dayWord(meta) ? ` · ${dayWord(meta)}` : ''}</small>
            </div>
            <strong class="rec-dtop__title">${esc(meta.title || rangeLabel(meta))}</strong>
            ${sg ? `<button type="button" class="rec-songbar" data-song-toggle aria-label="노래 재생·멈춤">
              <span class="rec-songbar__lp" aria-hidden="true"></span>
              <span class="rec-songbar__t"><b>${esc(sg.name)}</b>${esc(sg.artist)}</span>
              <span class="rec-songbar__ic" data-song-ic>▶</span>
            </button>` : ''}
          </div>
          <div class="rec-diaryview__page">${pageHtml(pg)}</div>
          <button type="button" class="rec-diaryview__del" data-del-diary>이 다이어리 지우기</button>
        </div>`;
      return sg;
    };
    const setPlaying = (on) => { const b = el.querySelector('.rec-songbar'); if (!b) return; b.classList.toggle('is-playing', on); b.querySelector('[data-song-ic]').textContent = on ? '❚❚' : '▶'; };
    const play = (sg) => {
      stopDiarySong();
      if (!sg) return;
      const start = (url) => {
        if (!url) return;
        diaryAudio = new Audio(url);
        diaryAudio.addEventListener('ended', () => setPlaying(false));
        diaryAudio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      };
      // 미리 받아 둔 주소가 있으면 누른 그 순간 바로 튼다(휴대폰은 기다린 뒤의 재생을 막는다)
      if (sg.preview) start(sg.preview);
      else if (typeof SongEngine !== 'undefined') SongEngine.fetchPreviewUrl(sg.name, sg.artist).then(start);
    };
    play(draw());
    // 노래 스티커를 누르면 그 자리에서 숨기거나 노래를 뺄 수 있다(꾸미기에 들어가지 않아도)
    const closeSongMenu = () => el.querySelectorAll('.rec-songmenu').forEach(n => n.remove());
    const updateSong = (fn) => {
      const all = loadPages(); const pg = all[key]; if (!pg) return;
      fn(pg); savePages(all); draw(); if (onChange) onChange();
    };
    el.addEventListener('click', (ev) => {
      const menuBtn = ev.target.closest('[data-songmenu]');
      if (menuBtn) {
        const act = menuBtn.dataset.songmenu;
        closeSongMenu();
        if (act === 'hide') {
          const wasPlaying = diaryAudio && !diaryAudio.paused;
          updateSong(pg => { pg.items = (pg.items || []).filter(i => i.type !== 'song'); if (pg.song) pg.song.hidden = true; });
          setPlaying(!!wasPlaying);
        } else if (act === 'remove') {
          ask('이 다이어리에서 노래를 뺄까요?', '빼기', true).then(ok => {
            if (!ok) return;
            stopDiarySong();
            updateSong(pg => { pg.items = (pg.items || []).filter(i => i.type !== 'song'); pg.song = null; });
          });
        }
        return;
      }
      const sticker = ev.target.closest('.rec-diaryview__page .rec-it--song');
      if (sticker) {
        const had = sticker.querySelector('.rec-songmenu');
        closeSongMenu();
        if (!had) sticker.insertAdjacentHTML('beforeend', `<span class="rec-songmenu">
          <button type="button" data-songmenu="hide">스티커 숨기기</button>
          <button type="button" data-songmenu="remove">노래 빼기</button>
        </span>`);
        return;
      }
      closeSongMenu();
      if (ev.target.closest('[data-close]')) { stopDiarySong(); closeLayer(el); if (onChange) onChange(); return; }
      if (ev.target.closest('[data-song-toggle]')) {
        if (diaryAudio && !diaryAudio.paused) { diaryAudio.pause(); setPlaying(false); }
        else if (diaryAudio) { diaryAudio.play().then(() => setPlaying(true)).catch(() => {}); }
        else play((loadPages()[key] || {}).song);
        return;
      }
      if (ev.target.closest('[data-del-diary]')) {
        ask('이 다이어리를 지울까요?\n기록과 사진은 그대로 남아요.', '지우기', true).then(ok => {
          if (!ok) return;
          stopDiarySong();
          const all = loadPages(); delete all[key]; savePages(all);
          closeLayer(el); if (onChange) onChange();
        });
        return;
      }
      if (ev.target.closest('[data-edit-day]')) {
        stopDiarySong(); setPlaying(false);
        const pg = loadPages()[key];
        openEditor(rangeEntry(c, key, metaOf(key, pg)), () => { draw(); if (onChange) onChange(); });
      }
    });
  }

  global.RecordV2 = { openStorage, openFolder, openRecap, recapCardHtml, chooseFolder, listDiaries, diaryThumbHtml, createDiary, openDiary, rangeLabel };
})(window);
