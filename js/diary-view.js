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
  const view = { year: now.getFullYear(), month: now.getMonth(), selected: todayIso, featured: null };

  // 비공개 버킷이라 경로 → 서명 URL 변환이 필요하다. 받아온 것은 여기 모아둔다.
  const photoUrls = {};
  let editingEntry = null;   // 수정 중인 기록(없으면 새 기록)
  let editKeepTags = [];     // 일상 태그가 아닌 옛 태그 — 수정해도 잃지 않게 들고 있는다
  let pendingPhotos = [];   // { path, url } — 모달에서 올린 뒤 저장 전까지
  let pendingLocation = null;
  let pendingWeather = null;     // 위치 확인과 동시에 미리 받아둔다 — 저장 시점엔 준비돼 있게
  let pendingNowPlaying = null;  // 사용자가 직접 고른 "그때 듣던 노래"
  let nowPlayingSearchTimer = null;
  let lastStreak = null;
  let root = null;

  function toIso(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function entries() {
    const list = AppState.isAuthed ? AppState.getJournal() : guestSample();
    return list.slice().sort((a, b) => a.date.localeCompare(b.date));
  }

  /*
   * 둘러보기(로그인 전)에는 저장할 계정이 없어서 기록이 비어 보인다. 화면이 어떤 모양인지
   * 알 수 있도록 이번 달에 예시 기록을 깔아 보여준다. 읽기 전용이고 어디에도 저장되지 않는다.
   */
  let guestCache = null;
  function guestSample() {
    if (guestCache) return guestCache;
    const P = {
      campus: 'https://images.unsplash.com/photo-1751510397614-e289eb4ce57a?w=900&q=75&auto=format&fit=crop',
      library: 'https://images.unsplash.com/photo-1741699427799-3fbb70fce948?w=900&q=75&auto=format&fit=crop',
      cafe: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=900&q=75&auto=format&fit=crop',
      dorm: 'https://images.unsplash.com/photo-1632119289059-793dd347950f?w=900&q=75&auto=format&fit=crop',
      eiffel: 'https://images.unsplash.com/photo-1757435755027-91a1a4beb6c5?w=900&q=75&auto=format&fit=crop'
    };
    Object.values(P).forEach(u => { photoUrls[u] = u; });
    const y = now.getFullYear(), m = now.getMonth();
    const at = (day, h, min) => new Date(y, m, day, h, min).toISOString();
    const mk = (day, h, min, o) => Object.assign({
      id: 'guest' + day, date: toIso(new Date(y, m, day)), phase: 'abroad', title: '', body: '',
      photos: [], tags: [], location: { country: '프랑스', city: '리옹' }, song: null, nowPlaying: null,
      weather: null, createdAt: at(day, h, min)
    }, o);
    const link = (name, artist) => (typeof SongEngine !== 'undefined')
      ? SongEngine.buildSongLinks(name, artist) : { youtubeUrl: '#' };
    guestCache = [
      mk(1, 11, 20, { title: '리옹 도착', body: '학교가 트램으로 15분 거리라 생각보다 조용한 동네였다.', photos: [P.campus], tags: ['neighborhood'] }),
      mk(2, 19, 40, { title: '기숙사 첫 요리', body: '마트에서 산 바게트가 확실히 다르다.', photos: [P.dorm], tags: ['dorm'],
        weather: { code: 3, temp: 18 },
        song: Object.assign({ name: 'Dernière danse', artist: 'Indila', art: null }, link('Dernière danse', 'Indila')) }),
      mk(3, 13, 15, { title: '점심이 2시간', body: '다들 점심을 천천히 먹는 게 아직 적응 안 됨.', photos: [P.cafe], tags: ['friends'] }),
      mk(5, 15, 30, { title: '도서관 스터디룸', body: '국제학생 오피스에서 서류 도움 받고 스터디룸도 예약함.', photos: [P.library], tags: ['study', 'admin'],
        nowPlaying: Object.assign({ name: '밤편지', artist: 'IU', art: null }, link('밤편지', 'IU')) }),
      mk(7, 17, 45, { title: '파리 당일치기', body: '주말에 에펠탑 보고 옴.', photos: [P.eiffel, P.cafe], tags: ['trip', 'food'], location: { country: '프랑스', city: '파리' },
        weather: { code: 61, temp: 12 },
        song: Object.assign({ name: 'Formidable', artist: 'Stromae', art: null }, link('Formidable', 'Stromae')) })
    ];
    return guestCache;
  }
  /** 필름 카메라 날짜 각인 — 2026-09-12 → '26 9 12 */
  function filmDate(iso) { return `'${iso.slice(2, 4)} ${Number(iso.slice(5, 7))} ${Number(iso.slice(8, 10))}`; }
  function photoUrl(path) { return photoUrls[path] || ''; }
  const photoFailed = new Set();   // 주소를 받았는데 찾지 못한 사진 — 스켈레톤을 끝없이 돌리지 않는다
  /** 사진이 있는 기록인데 주소가 아직 안 온 상태 */
  function photosLoading(e) {
    const ps = e.photos || [];
    return ps.length > 0 && !ps.some(p => photoUrls[p]) && !ps.every(p => photoFailed.has(p));
  }
  /** 태그 하나의 표시 정보. 일상 태그는 이모지+이름, 옛 기록의 항목 id는 항목 이름 그대로. */
  function tagInfo(id) {
    const t = EVERYDAY_MAP[id];
    if (t) return { label: `${t.emoji} ${t.ko}`, name: t.ko, color: (CATEGORY_MAP[t.cats[0]] || {}).color || '#4E6B93' };
    const c = CATEGORY_MAP[id];
    return c ? { label: c.ko, name: c.ko, color: c.color } : null;
  }
  function tagChip(id) {
    const t = tagInfo(id);
    return t ? `<span class="tag-chip" style="--chip-color:${t.color}">${t.label}</span>` : '';
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

    <div class="diary-week" id="weekStrip" aria-label="이번 주 기록"></div>

    <div id="diaryHeroSlot"></div>

    <div class="diary-write-bar">
      <label class="diary-write-bar__btn diary-write-bar__btn--camera" id="cameraBtn" role="button" tabindex="0" aria-label="바로 사진 찍어 기록하기">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.4"/></svg>
        카메라
        <input type="file" accept="image/*" capture="environment" id="cameraInputMain" tabindex="-1">
      </label>
      <button type="button" class="diary-write-bar__btn" id="writeBtn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        기록하기
      </button>
    </div>

    <section class="diary-featured" id="diaryFeaturedSlot"></section>

    <section class="diary-cal-section">
      <div class="diary-cal-nav">
        <h2 class="diary-cal-nav__title" id="calTitle"></h2>
        <div class="diary-cal-nav__btns">
          <button type="button" class="diary-icon-btn" id="openStampbook" aria-label="우표첩" title="우표첩">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" stroke-dasharray="2.5 2"/><rect x="8" y="7" width="8" height="8" rx="1"/></svg>
          </button>
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
      <h2 id="sideDate" class="is-date"></h2>
      <div class="diary-entry-list" id="entryList"></div>
    </section>
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
            <span class="diary-hero__daycount">D-<b class="diary-seg">${info.daysUntil}</b></span>
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
          <span class="diary-hero__daycount">${isAfter ? '교환 종료' : `Day <b class="diary-seg">${info.dayNum}</b>`}</span>
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
    renderWeek();
  }

  /* --------------------------------------------------------------- 최근 사진 */

  /*
   * 달력보다 먼저, 어제(없으면 가장 최근) 기록한 사진을 크게 보여준다. 좌우로 밀거나 아래
   * 날짜 칩을 눌러 다른 날의 사진으로 넘기고(앞 사진이 부드럽게 겹치며 사라진다),
   * 카드를 누르면 그날 기록이 팝업으로 열린다. 기록이 하나도 없으면 첫 우표 자리를 보여준다.
   */
  /** 카드 위 한 줄 — 왼쪽은 제목, 오른쪽은 오늘의 질문을 여는 물음표 */
  function featuredHead(label) {
    const seen = (() => { try { return localStorage.getItem('diary_q_seen') === todayIso; } catch (e) { return false; } })();
    return `
      <div class="diary-featured__head">
        <p class="diary-featured__eyebrow">${label}</p>
        <button type="button" class="diary-qmark${seen ? '' : ' is-new'}" id="qmarkBtn" aria-label="오늘의 질문 보기" aria-expanded="false">?</button>
        <div class="diary-qpop" id="qpop" role="dialog" aria-label="오늘의 질문" hidden>
          <span class="diary-qpop__tail" aria-hidden="true"></span>
          <small>💭 오늘의 질문</small>
          <p>${esc(dailyQuestion())}</p>
          <div class="diary-qpop__actions">
            <button type="button" class="diary-qpop__ans" id="qpopAnswer">답하기</button>
            <button type="button" class="diary-qpop__close" id="qpopClose">닫기</button>
          </div>
        </div>
      </div>`;
  }

  /** 물음표를 누르면 그 옆에 질문 카드가 뜬다. 바깥을 누르거나 Esc로 닫는다. */
  function wireQuestion(slot) {
    const btn = slot.querySelector('#qmarkBtn');
    const pop = slot.querySelector('#qpop');
    if (!btn || !pop) return;
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc_); };
    const outside = (ev) => { if (!pop.contains(ev.target) && ev.target !== btn) close(); };
    const esc_ = (ev) => { if (ev.key === 'Escape') close(); };
    btn.addEventListener('click', () => {
      if (!pop.hidden) { close(); return; }
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.remove('is-new');
      try { localStorage.setItem('diary_q_seen', todayIso); } catch (e) { /* 저장 못 해도 팝업은 뜬다 */ }
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', esc_);
    });
    slot.querySelector('#qpopClose').addEventListener('click', close);
    slot.querySelector('#qpopAnswer').addEventListener('click', () => {
      const q = dailyQuestion();
      close();
      if (!needLogin()) openEntryModal(null, q);
    });
  }

  let featuredLastUrl = null;

  function renderFeatured(swap) {
    const slot = root && root.querySelector('#diaryFeaturedSlot');
    if (!slot) return;

    if (!entries().length) {
      slot.innerHTML = `
        ${featuredHead('첫 우표')}
        <button type="button" class="diary-featured__empty" id="emptyStamp">
          <span class="diary-featured__empty-icon" aria-hidden="true">✉️</span>
          <b>첫 기록을 남겨보세요</b>
          <span>사진 한 장이면 첫 우표가 붙어요</span>
        </button>`;
      slot.querySelector('#emptyStamp').addEventListener('click', () => { if (!needLogin()) openEntryModal(); });
      wireQuestion(slot);
      return;
    }

    const withPhoto = entries().filter(e => (e.photos || []).some(p => photoUrl(p)));
    if (!withPhoto.length) {
      // 사진 주소를 받는 중이면 빈 칸 대신 같은 크기의 자리를 먼저 보여준다
      slot.innerHTML = entries().some(photosLoading)
        ? `${featuredHead('가장 최근 기록')}<div class="diary-featured__skeleton" aria-label="사진 불러오는 중"></div>` : '';
      if (slot.innerHTML) wireQuestion(slot);
      return;
    }

    const dates = [...new Set(withPhoto.map(e => e.date))].sort().reverse();   // 최신순
    const yest = toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const pick = (view.featured && dates.includes(view.featured)) ? view.featured
      : (dates.includes(yest) ? yest : dates[0]);
    const idx = dates.indexOf(pick);
    const list = withPhoto.filter(e => e.date === pick);
    const e = list[list.length - 1];
    const url = photoUrl(e.photos.find(p => photoUrl(p)));
    const prev = swap && featuredLastUrl && featuredLastUrl !== url ? featuredLastUrl : null;
    featuredLastUrl = url;
    const heading = e.title || e.body || '';
    const lt = (e.location && (e.location.city || e.location.country))
      ? [e.location.city, e.location.country].filter(Boolean).join(', ') : '';
    const short = (iso) => iso === todayIso ? '오늘' : iso === yest ? '어제' : `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
    const eyebrow = pick === yest ? '어제의 기록' : pick === todayIso ? '오늘의 기록' : '가장 최근 기록';
    // 칩은 다섯 개씩 보여주되, 지금 고른 날이 항상 창 안에 들어오게 한다
    const start = Math.max(0, Math.min(idx - 2, dates.length - 5));
    const chipDates = dates.slice(start, start + 5);

    slot.innerHTML = `
      ${featuredHead(eyebrow)}
      <div class="diary-featured__film">
      <div class="film-bar film-bar--top" aria-hidden="true"></div>
      <div class="diary-featured__card${prev ? ' has-prev' : ''}" role="button" tabindex="0" aria-label="${esc(short(pick))} 기록 열기"
           style="background-image:url('${url}')${prev ? `;--prev:url('${prev}')` : ''}">
        <div class="diary-featured__panel">
          <div class="diary-featured__top">
            <p class="diary-featured__title">${esc(heading)}</p>
            <span class="diary-featured__date" data-film="${filmDate(pick)}">${pick.slice(5).replace('-', '/')}</span>
          </div>
          ${lt ? `<p class="diary-featured__loc">📍 ${esc(lt)}</p>` : ''}
        </div>
      </div>
      <div class="film-bar film-bar--bottom" aria-hidden="true"><span>▶ ${dates.length - idx}A</span><span>${filmDate(pick)}</span></div>
      </div>
      <div class="diary-featured__chips">
        ${chipDates.map(d => `<button type="button" class="diary-featured__chip${d === pick ? ' is-active' : ''}" data-fdate="${d}">${short(d)}</button>`).join('')}
      </div>`;

    wireQuestion(slot);
    const card = slot.querySelector('.diary-featured__card');
    const open = () => { view.selected = pick; renderMonth(); openDayModal(pick); };
    let sx = 0, sy = 0, swiped = false;
    card.addEventListener('pointerdown', (ev) => { sx = ev.clientX; sy = ev.clientY; swiped = false; });
    card.addEventListener('pointerup', (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      swiped = true;
      // 왼쪽으로 밀면 더 이전 날, 오른쪽으로 밀면 더 최근 날
      const next = dx < 0 ? Math.min(idx + 1, dates.length - 1) : Math.max(idx - 1, 0);
      if (next !== idx) { view.featured = dates[next]; renderFeatured(true); }
    });
    card.addEventListener('click', (ev) => {
      if (swiped) { swiped = false; return; }
      if (!ev.target.closest('[data-fdate]')) open();
    });
    card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(); });
    slot.querySelectorAll('[data-fdate]').forEach(btn => {
      btn.addEventListener('click', () => { view.featured = btn.dataset.fdate; renderFeatured(true); });
    });
  }

  /* --------------------------------------------------------------- 오늘의 질문 */

  const QUESTIONS = [
    '오늘 가장 웃겼던 순간은?', '오늘 처음 먹어본 음식이 있나요?', '오늘 만난 사람 중 기억에 남는 사람은?',
    '지금 창밖에는 뭐가 보이나요?', '오늘 배운 새로운 단어나 표현은?', '오늘 하루를 색으로 표현한다면?',
    '오늘 가장 어려웠던 일은 무엇이었나요?', '오늘 나를 칭찬한다면 어떤 점을?', '오늘 걸은 길 중 가장 예뻤던 곳은?',
    '오늘 들은 노래 중 계속 맴도는 곡은?', '한국에서 가장 그리운 건 오늘 뭐였나요?', '오늘 찍은 사진 중 가장 마음에 드는 건?',
    '오늘의 날씨는 내 기분과 닮았나요?', '내일의 나에게 한마디를 남긴다면?', '오늘 새로 알게 된 장소가 있나요?',
    '오늘 누군가에게 도움을 받았나요?', '오늘 가장 조용했던 순간은?', '오늘 꼭 기억하고 싶은 냄새나 소리는?',
    '오늘 가장 맛있었던 한 입은?', '오늘 처음 해본 일이 있나요?', '오늘 하루 중 가장 설렜던 순간은?',
    '오늘 누군가와 나눈 대화 중 기억에 남는 한마디는?', '오늘 가장 피곤했던 순간과 이유는?', '오늘 나를 웃게 만든 사소한 것은?',
    '오늘 여기서만 볼 수 있었던 풍경은?', '오늘 길에서 마주친 특별한 장면은?', '지금 내 방의 분위기를 한 줄로 말한다면?',
    '오늘 가장 후회되는 일과 배운 점은?', '이번 주에 가장 기억에 남을 일은 무엇이 될까요?', '오늘의 나에게 점수를 준다면 몇 점인가요?'
  ];
  function dailyQuestion() {
    const dayOfYear = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(now.getFullYear(), 0, 0)) / 86400000);
    return QUESTIONS[dayOfYear % QUESTIONS.length];
  }
  /* --------------------------------------------------------------- 이번 주 */

  function renderWeek() {
    const el = root && root.querySelector('#weekStrip');
    if (!el) return;
    const days = new Set(entries().map(e => e.date));
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());   // 일요일
    const names = ['일', '월', '화', '수', '목', '금', '토'];
    el.innerHTML = names.map((n, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = toIso(d);
      const cls = ['diary-week__day', days.has(iso) && 'is-done', iso === todayIso && 'is-today', iso > todayIso && 'is-future'].filter(Boolean).join(' ');
      return `<div class="${cls}"><span>${n}</span><i>${days.has(iso) ? '✓' : ''}</i></div>`;
    }).join('');
  }

  /* --------------------------------------------------------------- 시간대 배경 */

  /** 낮·노을·밤에 따라 배경이 바뀐다. 시험용으로 ?tod=night 처럼 강제할 수 있다. */
  function applyTimeOfDay() {
    const forced = new URLSearchParams(location.search).get('tod');
    const h = new Date().getHours();
    const tod = ['day', 'dusk', 'night'].includes(forced) ? forced : (h >= 6 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night');
    document.body.dataset.tod = tod;
    // 화면 분위기 — 기본은 필름 카메라. ?theme=glass 로 이전의 유리 + 노을 테마를 볼 수 있다.
    const th = new URLSearchParams(location.search).get('theme');
    document.body.dataset.theme = th === 'glass' ? 'glass' : 'film';
  }

  /* --------------------------------------------------------------- 우표첩 */

  function openStampbook() {
    const list = entries().filter(e => (e.photos || []).some(p => photoUrl(p))).sort((a, b) => b.date.localeCompare(a.date));
    const cities = new Set(list.map(e => e.location && e.location.city).filter(Boolean));
    const groups = {};
    list.forEach(e => { (groups[e.date.slice(0, 7)] = groups[e.date.slice(0, 7)] || []).push(e); });
    const scrim = ensureScrim('stampbookScrim');
    scrim.innerHTML = `
      <div class="modal-panel diary-modal-pad diary-day-modal">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header">
          <h2>우표첩</h2>
          <p class="diary-modal-header__note">${list.length ? `우표 ${list.length}장${cities.size ? ` · 도시 ${cities.size}곳` : ''}` : '사진을 남기면 우표가 모여요'}</p>
        </div>
        ${Object.keys(groups).sort().reverse().map(k => `
          <h3 class="stampbook__month">${k.slice(0, 4)}년 ${Number(k.slice(5))}월</h3>
          <div class="stampbook__grid">
            ${groups[k].map((e, n) => {
              const u = photoUrl(e.photos.find(p => photoUrl(p)));
              const city = e.location && e.location.city;
              return `<button type="button" class="stampbook__item" data-date="${e.date}" aria-label="${e.date} 기록 열기">
                <span class="stampbook__stamp" style="--tilt:${n % 2 ? '1.5deg' : '-1.5deg'}"><span style="background-image:url('${u}')"></span></span>
                <small>${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8))}${city ? ` · ${esc(city)}` : ''}</small>
              </button>`;
            }).join('')}
          </div>`).join('')}
      </div>`;
    wireModalDismiss(scrim);
    scrim.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', () => {
      closeModal(scrim);
      view.selected = b.dataset.date;
      renderMonth();
      openDayModal(b.dataset.date);
    }));
    openModal(scrim);
  }

  /* --------------------------------------------------------------- 저장 연출 */

  /** 기록을 저장하면 우표가 찍히듯 내려앉고 소인이 번지며 나타난다. */
  function playStampFx({ photo, city, date, title }) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const old = document.getElementById('stampFx');
    if (old) old.remove();
    const fx = document.createElement('div');
    fx.id = 'stampFx';
    fx.className = 'stamp-fx';
    const mmdd = date.slice(5).replace('-', '.');
    fx.innerHTML = `
      <div class="stamp-fx__flash" aria-hidden="true"></div>
      <div class="stamp-fx__wrap">
        <div class="stamp-fx__stamp">
          <div class="stamp-fx__photo" style="${photo ? `background-image:url('${photo}')` : ''}">${photo ? '' : '<span>✉️</span>'}</div>
          <div class="stamp-fx__cap"><b>${esc(title || '')}</b><small>${date}</small></div>
        </div>
        ${city ? `<div class="diary-postmark stamp-fx__mark"><span>${esc(city)}</span><b data-film="${filmDate(date)}">${mmdd}</b></div>` : ''}
      </div>`;
    document.body.appendChild(fx);
    setTimeout(() => { fx.classList.add('is-out'); }, 1700);
    setTimeout(() => { fx.remove(); }, 2100);
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
      const dots = shown.map(t => `<span class="diary-day__dot" style="background:${(tagInfo(t) || {}).color || '#ccc'}"></span>`).join('')
        + (overflow > 0 ? `<span class="diary-day__dot-more">+${overflow}</span>` : '');
      const hasText = !withPhoto && items.length;
      const loading = !withPhoto && items.some(photosLoading);
      const classes = ['diary-day', loading && 'is-loading',
        iso === todayIso && 'is-today',
        iso === view.selected && 'is-selected',
        withPhoto && 'has-photo'].filter(Boolean).join(' ');
      const names = dayTags.map(t => (tagInfo(t) || {}).name).filter(Boolean);
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
      el.addEventListener('click', () => { view.selected = el.dataset.date; renderMonth(); renderSide(); openDayModal(el.dataset.date); });
    });
  }

  /* --------------------------------------------------------------- 날짜별 기록 */

  const clockLabel = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const locText = (loc) => (loc && (loc.city || loc.country))
    ? [loc.city, loc.country].filter(Boolean).join(', ') : '';

  /* --------------------------------------------------------------- 미리듣기 */

  // 우표의 LP를 누르면 30초 미리듣기가 재생되고 LP가 돈다. 다시 누르면 멈춘다. 한 번에 한 곡만.
  let previewAudio = null;
  let previewLp = null;
  function stopPreview() {
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    if (previewLp) { previewLp.classList.remove('is-playing', 'is-loading'); previewLp = null; }
  }
  async function togglePreview(lp) {
    if (previewLp === lp) { stopPreview(); return; }
    stopPreview();
    if (typeof SongEngine === 'undefined') return;
    previewLp = lp;
    lp.classList.add('is-loading');
    const url = await SongEngine.fetchPreviewUrl(lp.dataset.track, lp.dataset.artist);
    if (previewLp !== lp) return;   // 기다리는 사이 다른 곡을 눌렀거나 멈췄다
    if (!url) { stopPreview(); showToast('이 곡은 미리듣기를 찾지 못했어요'); return; }
    const audio = new Audio(url);
    audio.volume = 0.85;
    previewAudio = audio;
    audio.addEventListener('ended', stopPreview);
    try {
      await audio.play();
      lp.classList.remove('is-loading');
      lp.classList.add('is-playing');
    } catch (err) {
      stopPreview();
      showToast('재생하지 못했어요');
    }
  }
  // 팝업을 닫거나 화면을 벗어나면 소리도 멈춘다
  document.addEventListener('click', (ev) => { if (ev.target.closest('[data-modal-close], .modal-scrim') && !ev.target.closest('.diary-lp')) stopPreview(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });

  /* 노래 무드 → 우표 빛깔. 무드가 저장돼 있지 않은 옛 기록은 태그·날씨·시간으로 다시 계산한다. */
  const MOOD_COLOR = { cozy: '#E8A66B', energetic: '#F26B5B', romantic: '#E77FA8', calm: '#5FB3B0', adventurous: '#5DB37A', melancholic: '#7A82D6' };
  function moodColor(e) {
    if (!e.song && !e.nowPlaying) return null;
    let key = e.song && e.song.mood ? String(e.song.mood).split('+')[0] : '';
    if (!key && typeof SongEngine !== 'undefined') {
      try {
        key = SongEngine.computeMood({
          tags: e.tags || [], weatherCode: e.weather ? e.weather.code : undefined,
          tempC: e.weather ? e.weather.temp : undefined, date: new Date(e.createdAt)
        }).mood.split('+')[0];
      } catch (err) { key = ''; }
    }
    return MOOD_COLOR[key] || null;
  }

  /*
   * 기록 카드 — 우표. 톱니 가장자리 안에 사진, 아래 여백에 제목·날짜, 모서리에 소인(도시·날짜).
   * 사진이 여러 장이면 뒤에 우표가 비스듬히 겹쳐 보인다. 노래가 있으면 앨범 표지가 LP처럼 붙고
   * 무드 색이 우표 둘레의 빛과 소인 색이 된다. 장소·날씨·태그·노래는 우표 아래에 따로 놓는다.
   */
  function stampHtml(e, i) {
    const urls = (e.photos || []).map(photoUrl).filter(Boolean);
    const heading = e.title || e.body || '';
    const alt = esc(heading || `${e.date} 기록 사진`);
    const city0 = (e.location && (e.location.city || e.location.country)) || '';
    const lpTrack = (e.song && e.song.art) ? e.song : (e.nowPlaying && e.nowPlaying.art) ? e.nowPlaying : null;
    const art = lpTrack ? lpTrack.art : '';
    let photo;
    if (!urls.length && photosLoading(e)) {
      photo = `<div class="diary-stamp__skeleton" aria-label="사진 불러오는 중"></div>`;
    } else if (!urls.length) {
      photo = `<div class="diary-stamp__blank"><p>${esc(e.body || e.title || '')}</p></div>`;
    } else {
      photo = `<div class="diary-entry__photo-wrap">
        <img class="diary-entry__photo-single" src="${urls[0]}" alt="${alt}">
        ${urls.length > 1 ? `<span class="diary-entry__photo-more">+${urls.length - 1}</span>` : ''}
        ${city0 ? `<div class="diary-postmark diary-postmark--film" aria-hidden="true"><b data-film="${filmDate(e.date)}">${e.date.slice(5).replace('-', '.')}</b><span>${esc(city0)}</span></div>` : ''}
        ${art ? `<button type="button" class="diary-lp" data-track="${esc(lpTrack.name)}" data-artist="${esc(lpTrack.artist)}" style="background-image:url('${art}')" aria-label="${esc(lpTrack.name)} 30초 미리듣기"></button>` : ''}
      </div>`;
    }
    const backs = urls.slice(1, 3).map((u, k) =>
      `<div class="diary-stamp-back" style="--rot:${k ? -5 : 4}deg"><div style="background-image:url('${u}')"></div></div>`).join('');
    const city = (e.location && (e.location.city || e.location.country)) || '';
    const mmdd = e.date.slice(5).replace('-', '.');
    const mark = city ? `<div class="diary-postmark diary-postmark--stamp" aria-hidden="true"><span>${esc(city)}</span><b data-film="${filmDate(e.date)}">${mmdd}</b></div>` : '';
    const capTitle = urls.length ? heading : (e.title || '');
    const mood = moodColor(e);
    return `
      <div class="diary-stamp-wrap${mood ? ' has-mood' : ''}" style="--tilt:${i % 2 ? '0.8deg' : '-0.8deg'}${mood ? `;--mood:${mood}` : ''}">
        ${backs}
        <div class="diary-stamp">
          ${photo}
          <div class="diary-stamp__cap">
            <span class="diary-stamp__title">${esc(capTitle)}</span>
            <span class="diary-stamp__date">${e.date}</span>
          </div>
        </div>
        ${mark}
      </div>`;
  }

  /** 장소·날씨·시간대 칸 + (같은 격자 안에) 태그 칸과 시각 칸. 시각은 마지막 열 — 시간대 칸 바로 아래에 맞춘다. */
  function infoRows(e, tags) {
    const cells = [];
    const lt = locText(e.location);
    if (lt) cells.push({ label: '장소', value: esc(lt) });
    if (typeof SongEngine !== 'undefined') {
      const w = e.weather && typeof e.weather.code === 'number' ? SongEngine.weatherLabel(e.weather.code) : null;
      if (w) cells.push({ label: '날씨', value: `${w.emoji} ${w.ko}${typeof e.weather.temp === 'number' ? ` ${Math.round(e.weather.temp)}°` : ''}` });
      const t = SongEngine.timeLabel(new Date(e.createdAt).getHours());
      if (t) cells.push({ label: '시간대', value: `${t.emoji} ${t.ko}` });
    }
    const cols = Math.min(3, Math.max(2, cells.length));
    const timeCell = `<div class="diary-ticket-row diary-ticket-row--time" style="grid-column:${cols}"><span class="diary-ticket-time">${clockLabel(e.createdAt)}</span></div>`;
    const tagCell = tags.length
      ? `<div class="diary-ticket-row diary-ticket-row--tags" style="grid-column:1 / ${cols}"><span class="diary-ticket-row__label">태그</span><div class="diary-ticket-tags">${tags.join('')}</div></div>` : '';
    return `<div class="diary-ticket-rows" style="--cols:${cols}">${cells.map(c => `
      <div class="diary-ticket-row">
        <span class="diary-ticket-row__label">${c.label}</span>
        <span class="diary-ticket-row__value">${c.value}</span>
      </div>`).join('')}${tagCell}${timeCell}</div>`;
  }

  function songRow(item, label, variant) {
    if (!item) return '';
    return `
      <div class="diary-ticket-song diary-ticket-song--${variant}">
        <div class="diary-ticket-song__top">
          ${item.art
            ? `<img class="diary-ticket-song__art" src="${item.art}" alt="">`
            : `<span class="diary-ticket-song__art diary-ticket-song__art--empty">🎵</span>`}
          <div class="diary-ticket-song__info">
            <span class="diary-ticket-song__label">${label}</span>
            <span class="diary-ticket-song__title">${esc(item.name)}</span>
            <span class="diary-ticket-song__artist">${esc(item.artist)}</span>
          </div>
        </div>
        <div class="diary-ticket-song__links">
          ${item.spotifyUrl ? `<a class="diary-ticket-song__link diary-ticket-song__link--spotify" href="${item.spotifyUrl}" target="_blank" rel="noopener">Spotify ↗</a>` : ''}
          <a class="diary-ticket-song__link diary-ticket-song__link--youtube" href="${item.youtubeUrl}" target="_blank" rel="noopener">YouTube ↗</a>
        </div>
      </div>`;
  }

  function entryCard(e, i) {
    const tags = (e.tags || []).map(tagChip).filter(Boolean);
    const bodyText = e.title && e.body && (e.photos || []).some(p => photoUrl(p)) ? e.body : '';
    return `
      <div class="diary-entry diary-entry--stamp" data-id="${esc(e.id)}" data-idx="${i}">
        ${stampHtml(e, i)}
        <div class="diary-ticket-body">
          ${bodyText ? `<p class="diary-ticket-text">${esc(bodyText)}</p>` : ''}
          ${infoRows(e, tags)}
          ${(e.song || e.nowPlaying) ? '<div class="diary-ticket-perf"></div>' : ''}
          ${songRow(e.song, '🎵 오늘의 노래', 'recommend')}
          ${songRow(e.nowPlaying, '🎧 그때 듣던 노래', 'nowplaying')}
          ${AppState.isAuthed ? `<div class="diary-entry__actions">
            <button type="button" class="diary-entry__edit-link" data-edit="${esc(e.id)}">수정</button>
            <button type="button" class="diary-entry__delete-link" data-del="${esc(e.id)}">이 기록 삭제</button>
          </div>` : ''}
        </div>
      </div>`;
  }

  const EMPTY_HTML = `<div class="diary-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke-dasharray="3 3"/><circle cx="12" cy="13.5" r="3.4" stroke-dasharray="3 3"/></svg>
      <p>이 날짜엔 아직 기록이 없어요<br>아래 카메라로 남겨보세요</p>
    </div>`;

  /** 사진 클릭 → 원본 크기 팝업, 삭제 버튼 연결. 사진 영역에만 리스너를 단다. */
  function wireEntryCards(container, items) {
    container.querySelectorAll('.diary-entry--stamp[data-idx]').forEach((el) => {
      const entry = items[Number(el.dataset.idx)];
      const wrap = el.querySelector('.diary-entry__photo-wrap');
      const urls = (entry.photos || []).map(photoUrl).filter(Boolean);
      if (wrap && urls.length) {
        wrap.classList.add('is-clickable');
        wrap.addEventListener('click', (ev) => {
          openPhotoLightbox(urls, 0);
        });
      }
    });
    container.querySelectorAll('.diary-lp').forEach(lp => {
      lp.addEventListener('click', (ev) => { ev.stopPropagation(); togglePreview(lp); });
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = items.find(x => x.id === btn.dataset.edit);
        if (!entry || !AppState.isAuthed) return;
        stopPreview();
        const scrim = document.getElementById('dayModalScrim');
        if (scrim) closeModal(scrim);
        openEntryModal(null, null, entry);
      });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.isAuthed) return;
        if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
        stopPreview();
        AppState.deleteJournalEntry(btn.dataset.del);
        const scrim = document.getElementById('dayModalScrim');
        if (scrim) closeModal(scrim);
        renderAll();
      });
    });
  }

  function renderSide() {
    const items = byDate()[view.selected] || [];
    root.querySelector('#sideDate').textContent = view.selected;
    const list = root.querySelector('#entryList');
    list.innerHTML = items.length ? items.map(entryCard).join('') : EMPTY_HTML;
    wireEntryCards(list, items);
  }

  /** 달력에서 날짜를 누르면 스크롤 없이 바로 그날 기록을 팝업으로 보여준다. */
  function openDayModal(iso) {
    const items = byDate()[iso] || [];
    const scrim = ensureScrim('dayModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel diary-modal-pad diary-day-modal">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header"><h2 class="is-date">${iso}</h2></div>
        <div class="diary-entry-list" id="dayModalList">${items.length ? items.map(entryCard).join('') : EMPTY_HTML}</div>
      </div>`;
    wireModalDismiss(scrim);
    wireEntryCards(scrim.querySelector('#dayModalList'), items);
    openModal(scrim);
  }

  /** 저장한 사진 확대 — 여러 장이면 좌우로 넘겨본다. */
  function openPhotoLightbox(urls, startIdx) {
    let idx = startIdx;
    const scrim = ensureScrim('lightboxScrim');
    function render() {
      scrim.innerHTML = `
        <div class="modal-panel diary-lightbox">
          <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
          <img src="${urls[idx]}" alt="">
          ${urls.length > 1 ? `
            <button type="button" class="diary-lightbox__prev" aria-label="이전 사진">‹</button>
            <button type="button" class="diary-lightbox__next" aria-label="다음 사진">›</button>
            <span class="diary-lightbox__count">${idx + 1} / ${urls.length}</span>` : ''}
        </div>`;
      wireModalDismiss(scrim);
      if (urls.length > 1) {
        scrim.querySelector('.diary-lightbox__prev').addEventListener('click', () => { idx = (idx - 1 + urls.length) % urls.length; render(); });
        scrim.querySelector('.diary-lightbox__next').addEventListener('click', () => { idx = (idx + 1) % urls.length; render(); });
      }
    }
    render();
    openModal(scrim);
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
    const all = entries().flatMap(e => e.photos || []).filter(p => !photoUrls[p]);
    // 경로가 아니라 주소로 저장된 사진(예시 기록)은 서명 없이 그대로 쓴다
    all.filter(p => /^https?:\/\//.test(p)).forEach(p => { photoUrls[p] = p; });
    const paths = all.filter(p => !photoUrls[p]);
    if (!paths.length) { renderFeatured(); renderMonth(); renderSide(); return; }
    const map = await AppState.signPhotoPaths(paths);
    Object.assign(photoUrls, map);
    paths.forEach(p => { if (!map[p]) photoFailed.add(p); });
    renderFeatured();
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

  function openEntryModal(initialFile, prompt, edit) {
    // 원본은 파견 기간 밖을 막았지만, 여기서는 출국 전 기록이 핵심 용도라 막지 않는다.
    editingEntry = edit || null;
    const targetDate = edit ? edit.date : (view.selected || todayIso);
    pendingPhotos = edit ? (edit.photos || []).map(p => ({ path: p, url: photoUrl(p) })) : [];
    pendingLocation = null;
    pendingWeather = null;
    pendingNowPlaying = edit ? (edit.nowPlaying || null) : null;
    editKeepTags = edit ? (edit.tags || []).filter(t => !EVERYDAY_MAP[t]) : [];

    const scrim = ensureScrim('entryModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel modal-panel--sm diary-modal-pad diary-sheet">
        <div class="diary-sheet__handle"></div>
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header">
          <h2${edit ? '' : ' class="is-date"'}>${edit ? '기록 수정' : targetDate}</h2>
          <p class="diary-modal-header__note">${edit ? targetDate : (departurePhaseFor(targetDate) === 'abroad' ? '파견 중 기록' : '출국 전 기록')}</p>
        </div>
        <form class="diary-form" id="entryForm">
          <div class="diary-photo-picker" id="photoPicker">
            <label class="diary-photo-picker__add">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <input type="file" accept="image/*" multiple id="photoInput" style="display:none;">
            </label>
            <label class="diary-photo-picker__add diary-photo-picker__camera" aria-label="바로 사진 찍기">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.4"/></svg>
              <input type="file" accept="image/*" capture="environment" id="cameraInput" style="display:none;">
            </label>
          </div>
          <p class="diary-form__hint" id="photoHint" hidden>사진을 누르면 대표 사진(우표에 크게 나오는 사진)이 돼요</p>
          <input type="text" name="title" class="diary-form__title" placeholder="제목 (선택)" maxlength="80">
          ${prompt ? `<p class="diary-prompt-note">💭 ${esc(prompt)}</p>` : ''}
          <textarea name="caption" placeholder="${prompt ? '한 줄로 답해보세요 (선택)' : '오늘 하루는 어땠나요? (선택)'}"></textarea>
          <div>
            <span class="diary-form__label">오늘 뭘 했나요? (여러 개 골라도 돼요)</span>
            <div class="diary-tag-grid" id="tagGrid">
              ${EVERYDAY_TAGS.map(t => `<button type="button" class="tag-chip" data-tag="${t.id}" style="--chip-color:${(CATEGORY_MAP[t.cats[0]] || {}).color || '#4E6B93'}" aria-pressed="false"><span class="tag-chip__emoji" aria-hidden="true">${t.emoji}</span>${t.ko}</button>`).join('')}
            </div>
            <p class="diary-form__hint">고른 태그는 나중에 교환보고서 항목에 자동으로 나뉘어 들어가요</p>
          </div>
          <div>
            <span class="diary-form__label">그때 듣던 노래 (선택)</span>
            <div id="nowPlayingPicker"></div>
          </div>
          ${edit ? '' : '<span class="diary-location-note" id="locationNote">📍 위치 확인 중…</span>'}
          <input type="hidden" name="date" value="${targetDate}">
          <button type="submit" class="btn btn--primary btn--block" id="entrySubmit">${edit ? '수정 저장' : '기록 저장'}</button>
        </form>
      </div>`;

    wireModalDismiss(scrim);
    openModal(scrim);
    wireEntryForm(scrim);
    if (edit) {
      // 이미 쓴 내용을 채워 넣는다
      const form = scrim.querySelector('#entryForm');
      form.querySelector('[name=title]').value = edit.title || '';
      form.querySelector('[name=caption]').value = edit.body || '';
      (edit.tags || []).forEach(t => {
        const chip = scrim.querySelector(`#tagGrid [data-tag="${t}"]`);
        if (chip) { chip.classList.add('is-selected'); chip.setAttribute('aria-pressed', 'true'); }
      });
    }
    renderPhotoPicker(scrim);
    renderNowPlayingPicker(scrim);
    if (!edit) requestLocation();

    if (initialFile) {
      addPendingPhoto(initialFile)
        .then(() => renderPhotoPicker(scrim))
        .catch(err => showToast(err.message || '사진을 올리지 못했어요'));
    }
  }

  /*
   * 곡명을 직접 타이핑하게 두면 오타·표기 흔들림 때문에 나중에 같은 곡이 다르게 쌓인다.
   * Last.fm 검색으로 고르게 해서 제목·아티스트를 정규화한다.
   * 고르기 전엔 검색창, 고른 뒤엔 칩 하나 — 사진 썸네일과 같은 패턴.
   */
  function renderNowPlayingPicker(scrim) {
    const mount = scrim.querySelector('#nowPlayingPicker');
    if (!mount) return;
    if (typeof SongEngine === 'undefined') { mount.innerHTML = ''; return; }

    if (pendingNowPlaying) {
      mount.innerHTML = `
        <div class="diary-nowplaying-chip">
          <span>🎧 ${esc(pendingNowPlaying.artist)} · ${esc(pendingNowPlaying.name)}</span>
          <button type="button" id="nowPlayingClear" aria-label="지우기">✕</button>
        </div>`;
      mount.querySelector('#nowPlayingClear').addEventListener('click', () => {
        pendingNowPlaying = null;
        renderNowPlayingPicker(scrim);
      });
      return;
    }

    mount.innerHTML = `
      <div class="diary-nowplaying-search">
        <input type="text" id="nowPlayingInput" placeholder="곡 제목을 검색해보세요" autocomplete="off">
        <ul class="diary-nowplaying-results" id="nowPlayingResults" hidden></ul>
      </div>`;
    const input = mount.querySelector('#nowPlayingInput');
    const list = mount.querySelector('#nowPlayingResults');
    input.addEventListener('input', () => {
      clearTimeout(nowPlayingSearchTimer);
      const q = input.value;
      // 글자마다 쏘면 Last.fm rate limit에 걸린다 — 멈춘 뒤에 한 번만.
      nowPlayingSearchTimer = setTimeout(async () => {
        const matches = await SongEngine.searchTracks(q);
        if (!matches.length) { list.hidden = true; list.innerHTML = ''; return; }
        list.innerHTML = matches.map((m, i) => `<li data-idx="${i}">${esc(m.name)} <span>· ${esc(m.artist)}</span></li>`).join('');
        list.hidden = false;
        list.querySelectorAll('li').forEach((li, i) => {
          li.addEventListener('click', () => {
            pendingNowPlaying = matches[i];
            renderNowPlayingPicker(scrim);
          });
        });
      }, 300);
    });
  }

  function renderPhotoPicker(scrim) {
    const picker = scrim.querySelector('#photoPicker');
    const addBtn = picker.querySelector('.diary-photo-picker__add');   // 썸네일은 첫 번째 추가 버튼 앞에 끼운다
    picker.querySelectorAll('.diary-photo-thumb').forEach(el => el.remove());
    pendingPhotos.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'diary-photo-thumb' + (i === 0 ? ' is-cover' : '');
      div.innerHTML = `<img src="${p.url}" alt="" ${i > 0 ? `data-cover="${i}" role="button" tabindex="0"` : ''}>${i === 0 ? '<span class="diary-photo-thumb__cover">대표</span>' : ''}<button type="button" data-remove="${i}" aria-label="사진 빼기">✕</button>`;
      picker.insertBefore(div, addBtn);
    });
    const hint = scrim.querySelector('#photoHint');
    if (hint) hint.hidden = pendingPhotos.length < 2;
    picker.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => { pendingPhotos.splice(Number(btn.dataset.remove), 1); renderPhotoPicker(scrim); });
    });
    // 누른 사진을 맨 앞으로 — 앞의 사진이 우표의 대표 사진이다
    picker.querySelectorAll('[data-cover]').forEach(img => {
      const pick = () => {
        const [chosen] = pendingPhotos.splice(Number(img.dataset.cover), 1);
        pendingPhotos.unshift(chosen);
        renderPhotoPicker(scrim);
        showToast('대표 사진으로 바꿨어요');
      };
      img.addEventListener('click', pick);
      img.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') pick(); });
    });
  }

  function requestLocation() {
    const note = document.getElementById('locationNote');
    pendingWeather = null;
    if (!navigator.geolocation) { if (note) note.textContent = '📍 위치 정보를 사용할 수 없어요'; return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      // 노래 추천에 쓸 날씨는 저장 버튼을 기다리지 않고 지금 받아둔다.
      if (typeof SongEngine !== 'undefined') {
        SongEngine.fetchWeather(latitude, longitude).then(w => { pendingWeather = w; }).catch(() => {});
      }
      try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`);
        const data = await res.json();
        pendingLocation = { country: data.countryName || null, city: data.city || data.locality || null, countryCode: data.countryCode || null, lat: latitude, lng: longitude };
        if (note) note.textContent = `📍 ${[pendingLocation.city, pendingLocation.country].filter(Boolean).join(', ') || '위치 확인됨'}`;
      } catch (err) {
        pendingLocation = { country: null, city: null, countryCode: null, lat: latitude, lng: longitude };
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

    ['#photoInput', '#cameraInput'].forEach((sel) => {
      const input = scrim.querySelector(sel);
      input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        input.value = '';
        for (const file of files) {
          try { await addPendingPhoto(file); }
          catch (err) { showToast(err.message || '사진을 올리지 못했어요'); }
        }
        renderPhotoPicker(scrim);
      });
    });

    scrim.querySelector('#entryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get('date');
      const tags = Array.from(grid.querySelectorAll('.tag-chip.is-selected')).map(b => b.dataset.tag);
      const title = (fd.get('title') || '').trim();
      const body = (fd.get('caption') || '').trim();
      if (!pendingPhotos.length && !title && !body) { showToast('사진 또는 글 중 하나는 있어야 해요'); return; }

      // 수정 — 위치·날씨·오늘의 노래는 그대로 두고 글·태그·사진·그때 듣던 노래만 바꾼다
      if (editingEntry) {
        const target = editingEntry;
        const keepNP = pendingNowPlaying && target.nowPlaying
          && pendingNowPlaying.name === target.nowPlaying.name && pendingNowPlaying.artist === target.nowPlaying.artist;
        const nextNP = keepNP ? target.nowPlaying
          : (pendingNowPlaying && typeof SongEngine !== 'undefined')
            ? Object.assign({ name: pendingNowPlaying.name, artist: pendingNowPlaying.artist, art: null },
                SongEngine.buildSongLinks(pendingNowPlaying.name, pendingNowPlaying.artist))
            : null;
        AppState.updateJournalEntry(target.id, {
          title, body,
          photos: pendingPhotos.map(p => p.path),
          tags: [...tags, ...editKeepTags.filter(t => !tags.includes(t))],
          nowPlaying: nextNP
        });
        editingEntry = null;
        pendingPhotos = [];
        pendingNowPlaying = null;
        closeModal(scrim);
        view.selected = date;
        renderAll();
        showToast('기록을 수정했어요');
        openDayModal(date);
        return;
      }

      const nowPlaying = (pendingNowPlaying && typeof SongEngine !== 'undefined')
        ? Object.assign(
            { name: pendingNowPlaying.name, artist: pendingNowPlaying.artist, art: null },
            SongEngine.buildSongLinks(pendingNowPlaying.name, pendingNowPlaying.artist))
        : null;

      const entry = AppState.addJournalEntry({
        date, phase: departurePhaseFor(date), title, body,
        photos: pendingPhotos.map(p => p.path),
        tags, location: pendingLocation,
        nowPlaying, weather: pendingWeather
      });
      const fxPhoto = pendingPhotos[0] && pendingPhotos[0].url;
      const fxCity = pendingLocation && (pendingLocation.city || pendingLocation.country);
      pendingPhotos = [];
      pendingNowPlaying = null;
      closeModal(scrim);
      view.selected = date;
      renderAll();
      showToast('기록을 저장했어요');
      flashShutter();
      playStampFx({ photo: fxPhoto, city: fxCity, date, title: title || body });
      // 추천은 저장을 막지 않는다 — 늦게 도착해도 카드에 붙고, 실패하면 조용히 넘어간다.
      recommendSongFor(entry, tags);
    });
  }

  /* ------------------------------------------------------- 오늘의 노래 */

  /*
   * 기록을 저장한 직후, 그 순간의 태그·날씨·시간대로 무드를 계산해 현지 노래를 하나 고른다.
   * 저장 흐름과 분리해 두는 이유 — Last.fm 왕복이 몇 초 걸릴 수 있는데 그동안 저장 버튼이
   * 매달려 있으면 안 된다. 실패해도 기록 자체는 이미 남아 있다.
   */
  async function recommendSongFor(entry, tags) {
    if (typeof SongEngine === 'undefined') return;
    if (!entry || !pendingLocation || !pendingLocation.countryCode) return;
    try {
      const { mood, moodKo, keywords } = SongEngine.computeMood({
        tags,
        weatherCode: pendingWeather ? pendingWeather.code : undefined,
        tempC: pendingWeather ? pendingWeather.temp : undefined,
        date: new Date(entry.createdAt)
      });
      const song = await SongEngine.fetchSongRecommendation({
        countryCode: pendingLocation.countryCode, keywords
      });
      if (!song) return;
      song.mood = mood;
      song.moodKo = moodKo;
      // 저장이 끝나 실제 uuid로 바뀌었을 수 있어 tempId도 함께 찾는다(setEntrySong이 처리).
      AppState.setEntrySong(entry.id, song);
      // MOCK:updated만으로는 부족하다 — journal.js는 다이어리가 이미 떠 있으면
      // 사진만 다시 채우고 목록은 그대로 둔다(하이드레이션이 화면을 흔들지 않도록).
      // 그래서 뒤늦게 도착한 노래는 여기서 직접 다시 그려야 카드에 나타난다.
      if (view.selected === entry.date) renderSide();
      showSongPopup(song);
    } catch (err) {
      /* 추천은 덤이라 조용히 넘어간다 */
    }
  }

  function showSongPopup(song) {
    const old = document.getElementById('songPopup');
    if (old) old.remove();
    const popup = document.createElement('div');
    popup.id = 'songPopup';
    popup.className = 'song-popup';
    popup.innerHTML = `
      <button type="button" class="song-popup__close" aria-label="닫기">✕</button>
      <span class="song-popup__mood">🎵 이 순간의 노래</span>
      <span class="song-popup__title">${esc(song.name)}</span>
      <span class="song-popup__artist">${esc(song.artist)}</span>
      <div class="song-popup__links">
        ${song.spotifyUrl ? `<a href="${song.spotifyUrl}" target="_blank" rel="noopener">Spotify ↗</a>` : ''}
        <a href="${song.youtubeUrl}" target="_blank" rel="noopener">YouTube ↗</a>
      </div>`;
    document.body.appendChild(popup);
    const remove = () => popup.remove();
    popup.querySelector('.song-popup__close').addEventListener('click', remove);
    setTimeout(remove, 9000);
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
    const rawCounts = {};
    source.forEach(e => (e.tags || []).forEach(t => { rawCounts[t] = (rawCounts[t] || 0) + 1; }));
    const topRaw = Object.entries(rawCounts).sort((a, b) => b[1] - a[1])[0];
    const topCat = topRaw && tagInfo(topRaw[0]) ? { ko: tagInfo(topRaw[0]).label, color: tagInfo(topRaw[0]).color } : null;
    const tagCounts = {};   // 보고서 항목별 — 일상 태그를 항목으로 풀어서 센다
    source.forEach(e => categoriesOfTags(e.tags).forEach(c => { tagCounts[c] = (tagCounts[c] || 0) + 1; }));
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
            const has = all.some(e => categoriesOfTags(e.tags).includes(c.id));
            return `<a href="#report-${c.id}" class="report-nav__chip" data-has="${has}" style="--chip-color:${c.color}">${c.ko}</a>`;
          }).join('')}
        </nav>
        ${REPORT_CATEGORIES.map(c => {
          const items = all.filter(e => categoriesOfTags(e.tags).includes(c.id));
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

  function shiftMonth(delta) {
    view.month += delta;
    if (view.month < 0) { view.month = 11; view.year -= 1; }
    if (view.month > 11) { view.month = 0; view.year += 1; }
    renderMonth();
    const grid = root.querySelector('#calMonth');
    grid.dataset.slide = delta > 0 ? 'next' : 'prev';
    void grid.offsetWidth;
    grid.classList.remove('is-sliding'); void grid.offsetWidth; grid.classList.add('is-sliding');
  }

  function wireChrome() {
    root.querySelector('#calPrev').addEventListener('click', () => shiftMonth(-1));
    root.querySelector('#calNext').addEventListener('click', () => shiftMonth(1));
    // 달력을 좌우로 밀어 달을 넘긴다. 세로 스크롤은 그대로 두고, 민 직후의 클릭은 날짜 선택으로 치지 않는다.
    const calSection = root.querySelector('.diary-cal-section');
    let cx = 0, cy = 0, calSwiped = false;
    calSection.addEventListener('pointerdown', (ev) => { cx = ev.clientX; cy = ev.clientY; });
    calSection.addEventListener('pointerup', (ev) => {
      const dx = ev.clientX - cx, dy = ev.clientY - cy;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      calSwiped = true;
      setTimeout(() => { calSwiped = false; }, 300);
      shiftMonth(dx < 0 ? 1 : -1);
    });
    calSection.addEventListener('click', (ev) => { if (calSwiped) { ev.stopPropagation(); ev.preventDefault(); calSwiped = false; } }, true);
    root.querySelector('#openStampbook').addEventListener('click', openStampbook);
    root.querySelector('#writeBtn').addEventListener('click', () => { if (!needLogin()) openEntryModal(); });
    const camLabel = root.querySelector('#cameraBtn');
    const camInput = root.querySelector('#cameraInputMain');
    // 로그인 전이면 촬영 창을 열지 않고 로그인 안내부터 띄운다
    camLabel.addEventListener('click', (e) => { if (needLogin()) e.preventDefault(); });
    camLabel.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); camLabel.click(); } });
    camInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) openEntryModal(file);
    });
    root.querySelector('#openWrapup').addEventListener('click', openWrapupModal);
    root.querySelector('#openReport').addEventListener('click', openReportModal);
  }

  /** 둘러보기에는 남길 계정이 없다 — 로그인해야 저장된다. 로그인 화면으로 갈지 묻고, 갔으면 true. */
  function needLogin() {
    if (AppState.isAuthed) return false;
    if (window.confirm('로그인하면 기록을 계정에 남길 수 있어요. 로그인 화면으로 갈까요?')) location.href = 'auth.html';
    return true;
  }

  function renderAll() {
    renderHero();
    renderStreak();
    renderFeatured();
    renderMonth();
    renderSide();
  }

  /** journal.js가 학교 확정 상태일 때 부른다. */
  function mountDiaryView(mount) {
    root = mount;
    root.classList.add('diary-view');
    root.innerHTML = MARKUP;
    applyTimeOfDay();
    wireChrome();
    renderAll();
    refreshPhotoUrls();
  }

  function unmountDiaryView() {
    root = null;
  }

  global.mountDiaryView = mountDiaryView;
  global.unmountDiaryView = unmountDiaryView;
  global.diaryViewIsMounted = () => !!root;
  global.diaryRefreshPhotos = refreshPhotoUrls;
  // 하이드레이션 뒤 파견 기간·기록이 바뀌었을 수 있다 — Day N·연속 기록·달력을 다시 그린다
  global.diaryRefreshAll = () => { if (root) { renderAll(); refreshPhotoUrls(); } };
})(window);
