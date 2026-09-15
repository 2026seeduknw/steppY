/**
 * 기록하기 — 학교를 확정한 뒤의 사진 다이어리.
 *
 * steppy-record-v6의 diary.html을 이 앱으로 옮긴 것. 원본은 localStorage에 사진을
 * base64로 넣는 데모였고, 여기서는 Supabase에 실제로 저장한다:
 *   글·태그·위치 → user_journal 행
 *   사진        → Storage(diary-photos, 비공개) + 행에는 경로만
 *
 * 화면 구성은 원본 그대로다. 연속 기록 → Day N 진행 바 → 월 캘린더(사진 썸네일)
 * → 고른 날짜의 기록. 아래 FAB 두 개로 사진을 고르거나 바로 찍는다.
 */
(function (global) {

  // 항목 정의는 js/report-categories.js에 있다(보고서 페이지와 공유)

  const now = new Date();
  const todayIso = toIso(now);
  const view = { year: now.getFullYear(), month: now.getMonth(), selected: todayIso };

  // 비공개 버킷이라 경로 → 서명 URL 변환이 필요하다. 받아온 것은 여기 모아둔다.
  const photoUrls = {};
  let pendingPhotos = [];   // { path, url } — 모달에서 올린 뒤 저장 전까지
  let pendingLocation = null;
  let lastStreak = null;
  let root = null;

  function toIso(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function entries() { return AppState.getJournal().slice().sort((a, b) => a.date.localeCompare(b.date)); }
  function photoUrl(path) { return photoUrls[path] || ''; }
  function tagChip(id) {
    const c = CATEGORY_MAP[id];
    return c ? `<span class="tag-chip" style="--chip-color:${c.color}">${c.ko}</span>` : '';
  }

  /* --------------------------------------------------------------- 뼈대 */

  const MARKUP = `
    <header class="diary-header">
      <h1 class="diary-header__title">기록</h1>
      <div class="diary-streak" id="streakBadge">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2c1 3-3 4-3 7.5A3.5 3.5 0 0 0 12 13a3.5 3.5 0 0 0 3-5c1.5 1.5 2 3.3 2 5a5 5 0 0 1-10 0c0-4 3-5.5 3-9 0-.7.5-1.3 2-2z"/>
        </svg>
        <span class="diary-streak__num" id="streakNum">0</span>
        <span class="diary-streak__label">일 연속</span>
      </div>
    </header>

    <div id="diaryHeroSlot"></div>

    <section class="diary-cal-section">
      <div class="diary-cal-nav">
        <h2 class="diary-cal-nav__title" id="calTitle"></h2>
        <div class="diary-cal-nav__btns">
          <button type="button" class="diary-icon-btn" id="openWrapup" aria-label="이번 달 정리" title="이번 달 정리">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>
          </button>
          <button type="button" class="diary-icon-btn" id="openReport" aria-label="경험보고서 미리보기" title="경험보고서 미리보기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 13h6M9 17h6"/></svg>
          </button>
          <span class="diary-cal-nav__divider"></span>
          <button type="button" class="diary-icon-btn" id="calPrev" aria-label="이전 달">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button type="button" class="diary-icon-btn" id="calNext" aria-label="다음 달">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div class="diary-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
      <div class="diary-month" id="calMonth"></div>
    </section>

    <section class="diary-side">
      <h2 id="sideDate"></h2>
      <div class="diary-entry-list" id="entryList"></div>
    </section>
  `;

  const FAB_MARKUP = `
    <button type="button" class="diary-fab diary-fab--edit" id="fabEdit" aria-label="찍어둔 사진으로 기록하기">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
    </button>
    <label class="diary-fab diary-fab--camera" id="fabCameraLabel" tabindex="0" role="button" aria-label="바로 사진 찍기">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/></svg>
      <input type="file" accept="image/*" capture="environment" id="fabCameraInput" tabindex="-1">
    </label>
  `;

  /* --------------------------------------------------------------- 파견 기간 */

  function renderHero() {
    const slot = root.querySelector('#diaryHeroSlot');
    const info = departureInfo();
    const recordedDays = new Set(entries().map(e => e.date)).size;
    const recorded = recordedDays ? `지금까지 ${recordedDays}일 기록했어요` : '오늘의 순간을 기록해보세요';

    // 날짜를 모르면 여기서 받지 않고 홈으로 보낸다 — 입력 자리가 두 곳이면
    // 한쪽에서 고친 값이 다른 쪽에 안 보이는 것처럼 느껴진다.
    if (!info.hasRange) {
      slot.innerHTML = `
        <a class="diary-hero diary-hero--setup" href="home.html">
          <span class="diary-hero__eyebrow">MY JOURNEY</span>
          <p class="diary-setup__desc">홈에서 출국일을 입력하면 남은 날과 파견 며칠째인지 여기에 표시돼요</p>
          <span class="diary-hero__cta">홈에서 출국일 입력하기 →</span>
        </a>`;
      return;
    }

    // 출국 전 — 남은 날을 세고, 떠나기 전 기억을 남기도록 권한다.
    if (info.phase === DEPARTURE_PHASES.BEFORE) {
      slot.innerHTML = `
        <div class="diary-hero diary-hero--before">
          <div class="diary-hero__top">
            <span class="diary-hero__eyebrow">출국까지</span>
            <span class="diary-hero__daycount">D-${info.daysUntil}</span>
          </div>
          <p class="diary-hero__lede">배웅해준 친구들, 짐 싸던 밤. 떠나기 전 지금도 나중에 꺼내 볼 기억이 돼요.</p>
          <div class="diary-hero__dates">
            <span>오늘</span>
            <span>${info.start} 출국</span>
          </div>
          <p class="diary-hero__sub">${recorded}</p>
        </div>`;
      return;
    }

    // 파견 중 / 귀국 후 — 기간 위에서 지금 어디쯤인지 보여준다.
    const isAfter = info.phase === DEPARTURE_PHASES.AFTER;
    slot.innerHTML = `
      <div class="diary-hero">
        <div class="diary-hero__top">
          <span class="diary-hero__eyebrow">MY JOURNEY</span>
          <span class="diary-hero__daycount">${isAfter ? '교환 종료' : `Day ${info.dayNum}`}</span>
        </div>
        <div class="diary-hero__track">
          <span class="diary-hero__pin diary-hero__pin--start" aria-hidden="true"></span>
          <div class="diary-hero__line">
            <div class="diary-hero__fill" style="width:${info.pct}%"></div>
            <div class="diary-hero__plane" style="left:${info.pct}%" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/></svg>
            </div>
          </div>
          <span class="diary-hero__pin diary-hero__pin--end" aria-hidden="true">🏁</span>
        </div>
        <div class="diary-hero__dates">
          <span>${info.start}</span>
          <span>${info.end}</span>
        </div>
        <p class="diary-hero__sub">${isAfter ? recorded : `귀국까지 ${info.daysLeft}일 · ${recorded}`}</p>
      </div>`;
  }

  /* --------------------------------------------------------------- 연속 기록 */

  function renderStreak() {
    const days = new Set(entries().map(e => e.date));
    let streak = 0;
    const cursor = new Date(now);
    if (!days.has(todayIso)) cursor.setDate(cursor.getDate() - 1);
    while (days.has(toIso(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

    const el = root.querySelector('#streakNum');
    el.textContent = streak;
    if (lastStreak !== null && streak > lastStreak) {
      const badge = root.querySelector('#streakBadge');
      badge.classList.remove('is-bumping');
      void badge.offsetWidth;
      badge.classList.add('is-bumping');
    }
    lastStreak = streak;
  }

  /* --------------------------------------------------------------- 캘린더 */

  function byDate() {
    const map = {};
    entries().forEach(e => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }

  function renderMonth() {
    const map = byDate();
    root.querySelector('#calTitle').textContent = `${view.year}년 ${view.month + 1}월`;
    const startWeekday = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += `<div class="diary-day is-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = map[iso] || [];
      const withPhoto = items.find(e => e.photos && e.photos.length && photoUrl(e.photos[0]));
      const dayTags = [...new Set(items.flatMap(e => e.tags || []))];
      const shown = dayTags.slice(0, 3);
      const overflow = dayTags.length - shown.length;
      const dots = shown.map(t => `<span class="diary-day__dot" style="background:${(CATEGORY_MAP[t] || {}).color || '#ccc'}"></span>`).join('')
        + (overflow > 0 ? `<span class="diary-day__dot-more">+${overflow}</span>` : '');
      const hasText = !withPhoto && items.length;
      const classes = ['diary-day',
        iso === todayIso && 'is-today',
        iso === view.selected && 'is-selected',
        withPhoto && 'has-photo'].filter(Boolean).join(' ');
      const names = dayTags.map(t => (CATEGORY_MAP[t] || {}).ko).filter(Boolean);
      const label = [`${view.year}년 ${view.month + 1}월 ${d}일`,
        iso === todayIso && '오늘',
        names.length ? names.join(', ') : (items.length ? '기록 있음' : '기록 없음')].filter(Boolean).join(', ');

      cells += `
        <button type="button" class="${classes}" data-date="${iso}" aria-label="${label}">
          ${withPhoto ? `<span class="diary-day__photo" style="background-image:url('${photoUrl(withPhoto.photos[0])}')"></span>` : ''}
          <span class="diary-day__num">${d}</span>
          ${!withPhoto ? `<span class="diary-day__dots">${dots}${hasText && !dots ? '<span class="diary-day__dot diary-day__dot--plain"></span>' : ''}</span>` : ''}
        </button>`;
    }

    const mount = root.querySelector('#calMonth');
    mount.innerHTML = cells;
    mount.querySelectorAll('.diary-day[data-date]').forEach(el => {
      el.addEventListener('click', () => { view.selected = el.dataset.date; renderMonth(); renderSide(); });
    });
  }

  /* --------------------------------------------------------------- 날짜별 기록 */

  function renderSide() {
    const items = byDate()[view.selected] || [];
    root.querySelector('#sideDate').textContent = view.selected;
    const list = root.querySelector('#entryList');

    const timeLabel = (iso) => {
      const d = new Date(iso);
      return isNaN(d) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    };
    const locText = (loc) => (loc && (loc.city || loc.country))
      ? [loc.city, loc.country].filter(Boolean).join(', ') : '';

    const photoBlock = (e) => {
      const urls = (e.photos || []).map(photoUrl).filter(Boolean);
      if (!urls.length) return '';
      const alt = esc(e.caption || e.title || `${e.date} 기록 사진`);
      if (urls.length === 1) return `<div class="diary-entry__photo-wrap"><img class="diary-entry__photo-single" src="${urls[0]}" alt="${alt}"></div>`;
      const extra = urls.length - 2;
      return `<div class="diary-entry__photo-wrap diary-entry__photo-wrap--dual">
        <img class="diary-entry__photo-main" src="${urls[0]}" alt="${alt}">
        <img class="diary-entry__photo-inset" src="${urls[1]}" alt="${e.date} 추가 사진">
        ${extra > 0 ? `<span class="diary-entry__photo-more">+${extra}</span>` : ''}
      </div>`;
    };

    const metaHtml = (e, hasPhoto) => `
      ${e.title ? `<p class="diary-entry__title">${esc(e.title)}</p>` : ''}
      ${e.body ? `<p class="diary-entry__caption">${esc(e.body)}</p>` : ''}
      <div class="diary-entry__meta">
        <span class="diary-entry__time">${timeLabel(e.createdAt)}</span>
        ${!hasPhoto && locText(e.location) ? `<span class="diary-entry__location">📍 ${esc(locText(e.location))}</span>` : ''}
        ${(hasPhoto ? (e.tags || []).slice(1) : (e.tags || [])).map(tagChip).join('')}
      </div>`;

    const topPills = (e) => {
      const urls = (e.photos || []).map(photoUrl).filter(Boolean);
      if (!urls.length) return '';
      const primary = e.tags && e.tags[0] ? CATEGORY_MAP[e.tags[0]] : null;
      const tagPill = primary ? `<span class="diary-entry__tag-pill" style="--chip-color:${primary.color}">${primary.ko}</span>` : '';
      const lt = locText(e.location);
      const locPill = lt ? `<span class="diary-entry__loc-pill">📍 ${esc(lt)}</span>` : '';
      return (tagPill || locPill) ? `<div class="diary-entry__top-pills">${tagPill}${locPill}</div>` : '';
    };

    list.innerHTML = items.length
      ? items.map(e => {
          const hasPhoto = (e.photos || []).some(p => photoUrl(p));
          return `
          <div class="diary-entry" data-id="${esc(e.id)}">
            ${photoBlock(e)}
            ${topPills(e)}
            ${hasPhoto ? `<div class="diary-entry__overlay">${metaHtml(e, true)}</div>` : metaHtml(e, false)}
            <button type="button" class="diary-entry__del" data-del="${esc(e.id)}" aria-label="이 기록 삭제">✕</button>
          </div>`;
        }).join('')
      : `<div class="diary-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke-dasharray="3 3"/><circle cx="12" cy="13.5" r="3.4" stroke-dasharray="3 3"/></svg>
          <p>이 날짜엔 아직 기록이 없어요<br>아래 카메라로 남겨보세요</p>
        </div>`;

    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
        AppState.deleteJournalEntry(btn.dataset.del);
        renderAll();
      });
    });
  }

  /* --------------------------------------------------------------- 사진 */

  /** 900px·JPEG 75%로 줄여서 올린다. 원본 그대로면 한 장에 수 MB라 업로드가 오래 걸린다. */
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('파일을 읽지 못했어요'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('이미지를 열지 못했어요'));
        img.onload = () => {
          const maxDim = 900;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('변환에 실패했어요')), 'image/jpeg', 0.75);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addPendingPhoto(file) {
    const blob = await resizeImage(file);
    const path = await AppState.uploadDiaryPhoto(blob);
    const url = URL.createObjectURL(blob);   // 방금 올린 건 서명 URL을 기다릴 것 없이 바로 보여준다
    photoUrls[path] = url;
    pendingPhotos.push({ path, url });
    return path;
  }

  /** 서명 URL을 받아 채운 뒤 다시 그린다. 사진 수만큼 왕복하지 않도록 한 번에 묶어 받는다. */
  async function refreshPhotoUrls() {
    const paths = entries().flatMap(e => e.photos || []).filter(p => !photoUrls[p]);
    if (!paths.length) return;
    const map = await AppState.signPhotoPaths(paths);
    Object.assign(photoUrls, map);
    renderMonth();
    renderSide();
  }

  /* --------------------------------------------------------------- 기록 모달 */

  function ensureScrim(id) {
    let scrim = document.getElementById(id);
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = id;
      scrim.className = 'modal-scrim';
      document.body.appendChild(scrim);
    }
    return scrim;
  }

  function openEntryModal(initialFile) {
    // 원본은 파견 기간 밖을 막았지만, 여기서는 출국 전 기록이 핵심 용도라 막지 않는다.
    const targetDate = view.selected || todayIso;
    pendingPhotos = [];
    pendingLocation = null;

    const scrim = ensureScrim('entryModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel modal-panel--sm diary-modal-pad diary-sheet">
        <div class="diary-sheet__handle"></div>
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header">
          <h2>${targetDate}</h2>
          <p class="diary-modal-header__note">${departurePhaseFor(targetDate) === 'abroad' ? '파견 중 기록' : '출국 전 기록'}</p>
        </div>
        <form class="diary-form" id="entryForm">
          <div class="diary-photo-picker" id="photoPicker">
            <label class="diary-photo-picker__add">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <input type="file" accept="image/*" multiple id="photoInput" style="display:none;">
            </label>
          </div>
          <input type="text" name="title" class="diary-form__title" placeholder="제목 (선택)" maxlength="80">
          <textarea name="caption" placeholder="오늘 하루는 어땠나요? (선택)"></textarea>
          <div>
            <span class="diary-form__label">태그 (여러 개 선택 가능)</span>
            <div class="diary-tag-grid" id="tagGrid">
              ${REPORT_CATEGORIES.map(c => `<button type="button" class="tag-chip" data-tag="${c.id}" style="--chip-color:${c.color}" aria-pressed="false">${c.ko}</button>`).join('')}
            </div>
          </div>
          <span class="diary-location-note" id="locationNote">📍 위치 확인 중…</span>
          <input type="hidden" name="date" value="${targetDate}">
          <button type="submit" class="btn btn--primary btn--block" id="entrySubmit">기록 저장</button>
        </form>
      </div>`;

    wireModalDismiss(scrim);
    openModal(scrim);
    wireEntryForm(scrim);
    renderPhotoPicker(scrim);
    requestLocation();

    if (initialFile) {
      addPendingPhoto(initialFile)
        .then(() => renderPhotoPicker(scrim))
        .catch(err => showToast(err.message || '사진을 올리지 못했어요'));
    }
  }

  function renderPhotoPicker(scrim) {
    const picker = scrim.querySelector('#photoPicker');
    const addBtn = picker.querySelector('.diary-photo-picker__add');
    picker.querySelectorAll('.diary-photo-thumb').forEach(el => el.remove());
    pendingPhotos.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'diary-photo-thumb';
      div.innerHTML = `<img src="${p.url}" alt=""><button type="button" data-remove="${i}" aria-label="사진 빼기">✕</button>`;
      picker.insertBefore(div, addBtn);
    });
    picker.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => { pendingPhotos.splice(Number(btn.dataset.remove), 1); renderPhotoPicker(scrim); });
    });
  }

  function requestLocation() {
    const note = document.getElementById('locationNote');
    if (!navigator.geolocation) { if (note) note.textContent = '📍 위치 정보를 사용할 수 없어요'; return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`);
        const data = await res.json();
        pendingLocation = { country: data.countryName || null, city: data.city || data.locality || null, lat: latitude, lng: longitude };
        if (note) note.textContent = `📍 ${[pendingLocation.city, pendingLocation.country].filter(Boolean).join(', ') || '위치 확인됨'}`;
      } catch (err) {
        pendingLocation = { country: null, city: null, lat: latitude, lng: longitude };
        if (note) note.textContent = '📍 위치는 저장했지만 지명 변환에 실패했어요';
      }
    }, () => {
      pendingLocation = null;
      if (note) note.textContent = '📍 위치 권한이 거부됐어요 (위치 없이 저장돼요)';
    }, { timeout: 8000 });
  }

  function wireEntryForm(scrim) {
    const grid = scrim.querySelector('#tagGrid');
    grid.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const on = btn.classList.toggle('is-selected');
        btn.setAttribute('aria-pressed', String(on));
      });
    });

    const photoInput = scrim.querySelector('#photoInput');
    photoInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      photoInput.value = '';
      for (const file of files) {
        try { await addPendingPhoto(file); }
        catch (err) { showToast(err.message || '사진을 올리지 못했어요'); }
      }
      renderPhotoPicker(scrim);
    });

    scrim.querySelector('#entryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get('date');
      const tags = Array.from(grid.querySelectorAll('.tag-chip.is-selected')).map(b => b.dataset.tag);
      const title = (fd.get('title') || '').trim();
      const body = (fd.get('caption') || '').trim();
      if (!pendingPhotos.length && !title && !body) { showToast('사진 또는 글 중 하나는 있어야 해요'); return; }

      AppState.addJournalEntry({
        date, phase: departurePhaseFor(date), title, body,
        photos: pendingPhotos.map(p => p.path),
        tags, location: pendingLocation
      });
      pendingPhotos = [];
      closeModal(scrim);
      view.selected = date;
      renderAll();
      showToast('기록을 저장했어요');
      flashShutter();
    });
  }

  function flashShutter() {
    const camera = document.getElementById('fabCameraLabel');
    if (!camera) return;
    camera.classList.remove('is-captured');
    void camera.offsetWidth;
    camera.classList.add('is-captured');
    setTimeout(() => camera.classList.remove('is-captured'), 500);
  }

  /* --------------------------------------------------- 이번 달 정리 / 보고서 */

  function openWrapupModal() {
    const monthKey = `${view.year}-${String(view.month + 1).padStart(2, '0')}`;
    const all = entries();
    const monthEntries = all.filter(e => e.date.slice(0, 7) === monthKey);
    const source = monthEntries.length ? monthEntries : all;
    const photos = source.flatMap(e => (e.photos || []).map(p => ({ src: photoUrl(p), date: e.date }))).filter(p => p.src).slice(0, 8);
    const daysRecorded = new Set(source.map(e => e.date)).size;
    const cities = [...new Set(source.map(e => e.location && e.location.city).filter(Boolean))];
    const tagCounts = {};
    source.forEach(e => (e.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
    const topCat = topTag ? CATEGORY_MAP[topTag[0]] : null;
    const hero = photos[0];
    const rest = photos.slice(1);

    const scrim = ensureScrim('wrapupModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel diary-modal-pad">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        ${hero ? `
          <div class="wrapup-hero">
            <img src="${hero.src}" alt="${hero.date} 사진">
            <div class="wrapup-hero__overlay">
              <span class="wrapup-hero__eyebrow">MONTHLY WRAP-UP</span>
              <h2>${view.year}년 ${view.month + 1}월</h2>
            </div>
          </div>`
        : `<div class="diary-modal-header"><h2>${view.year}년 ${view.month + 1}월 정리</h2></div>`}
        ${monthEntries.length ? '' : `<p class="diary-modal-header__note">이번 달 기록이 없어 전체 기록으로 보여드려요</p>`}
        ${rest.length ? `<div class="wrapup-strip">${rest.map(p => `<img src="${p.src}" alt="${p.date} 사진">`).join('')}</div>` : ''}
        <div class="wrapup-stats">
          <div class="wrapup-stat"><span class="wrapup-stat__num">${daysRecorded}</span><span class="wrapup-stat__label">기록한 날</span></div>
          <div class="wrapup-stat"><span class="wrapup-stat__num">${cities.length || '-'}</span><span class="wrapup-stat__label">방문 도시</span></div>
          <div class="wrapup-stat wrapup-stat--highlight" style="--stat-color:${topCat ? topCat.color : 'var(--diary-text-faint)'}">
            <span class="wrapup-stat__num wrapup-stat__num--text">${topCat ? topCat.ko : '-'}</span>
            <span class="wrapup-stat__label">가장 많이 쓴 태그</span>
          </div>
        </div>
        <span class="diary-form__label">보고서 항목별 채움</span>
        ${REPORT_CATEGORIES.map(c => {
          const count = tagCounts[c.id] || 0;
          const pct = Math.min(100, count * 34);
          return `<div class="wrapup-cat-row">
            <span class="wrapup-cat-row__label">${c.ko}</span>
            <div class="diary-progress__bar"><div class="diary-progress__fill" style="width:${pct}%; background:${c.color};"></div></div>
            <span class="diary-progress__label">${count}개</span>
          </div>`;
        }).join('')}
      </div>`;
    wireModalDismiss(scrim);
    openModal(scrim);
  }

  function openReportModal() {
    const all = entries();
    const scrim = ensureScrim('reportModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel diary-modal-pad">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header">
          <h2>지금까지 쌓인 기록으로 미리 보기</h2>
          <p class="diary-modal-header__note">문장을 새로 지어내지 않아요. 적어둔 글을 항목별·날짜순으로 모아 보여줄 뿐이에요.</p>
        </div>
        <nav class="report-nav">
          ${REPORT_CATEGORIES.map(c => {
            const has = all.some(e => (e.tags || []).includes(c.id));
            return `<a href="#report-${c.id}" class="report-nav__chip" data-has="${has}" style="--chip-color:${c.color}">${c.ko}</a>`;
          }).join('')}
        </nav>
        ${REPORT_CATEGORIES.map(c => {
          const items = all.filter(e => (e.tags || []).includes(c.id));
          return `<div class="report-section" id="report-${c.id}">
            <h3 class="report-section__title">${c.ko}</h3>
            ${items.length ? items.map(e => {
              const u = (e.photos || []).map(photoUrl).find(Boolean);
              const loc = e.location && (e.location.city || e.location.country)
                ? ' · ' + [e.location.city, e.location.country].filter(Boolean).join(', ') : '';
              return `<div class="report-entry">
                ${u ? `<img src="${u}" alt="${esc(e.title || e.date + ' 기록 사진')}">` : ''}
                <div>
                  <div class="report-entry__date">${e.date}${esc(loc)}</div>
                  <p class="report-entry__caption">${esc(e.body || e.title || '(사진만 기록)')}</p>
                </div>
              </div>`;
            }).join('') : `<p class="report-empty">아직 기록이 없어요</p>`}
          </div>`;
        }).join('')}
      </div>`;
    wireModalDismiss(scrim);
    openModal(scrim);
  }

  /* --------------------------------------------------------------- 부팅 */

  function wireChrome() {
    root.querySelector('#calPrev').addEventListener('click', () => {
      view.month -= 1;
      if (view.month < 0) { view.month = 11; view.year -= 1; }
      renderMonth();
    });
    root.querySelector('#calNext').addEventListener('click', () => {
      view.month += 1;
      if (view.month > 11) { view.month = 0; view.year += 1; }
      renderMonth();
    });
    root.querySelector('#openWrapup').addEventListener('click', openWrapupModal);
    root.querySelector('#openReport').addEventListener('click', openReportModal);
  }

  function mountFabs() {
    document.querySelectorAll('.diary-fab-bar').forEach(el => el.remove());
    const bar = document.createElement('div');
    bar.className = 'diary-fab-bar';
    bar.innerHTML = FAB_MARKUP;
    document.body.appendChild(bar);

    bar.querySelector('#fabEdit').addEventListener('click', () => openEntryModal());
    bar.querySelector('#fabCameraLabel').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bar.querySelector('#fabCameraInput').click(); }
    });
    bar.querySelector('#fabCameraInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) openEntryModal(file);
    });
  }

  function renderAll() {
    renderHero();
    renderStreak();
    renderMonth();
    renderSide();
  }

  /** journal.js가 학교 확정 상태일 때 부른다. */
  function mountDiaryView(mount) {
    root = mount;
    root.classList.add('diary-view');
    root.innerHTML = MARKUP;
    wireChrome();
    mountFabs();
    renderAll();
    refreshPhotoUrls();
  }

  function unmountDiaryView() {
    document.querySelectorAll('.diary-fab-bar').forEach(el => el.remove());
    root = null;
  }

  global.mountDiaryView = mountDiaryView;
  global.unmountDiaryView = unmountDiaryView;
  global.diaryViewIsMounted = () => !!root;
  global.diaryRefreshPhotos = refreshPhotoUrls;
})(window);
