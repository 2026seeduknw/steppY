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

  /**
   * 태그 칩(EVERYDAY_TAGS, js/report-categories.js) 15개를 그대로 늘어놓으면 카드가
   * 너무 많아 보여서, 여기서만(UI 표시용) 5개 묶음으로 접었다 편다. 저장되는 값은
   * 여전히 EVERYDAY_TAGS의 원래 id다 — 묶음은 report-categories.js의 cats(보고서 항목)와
   * 무관하게 "일상적으로 같이 떠오르는 일" 기준으로 묶었을 뿐, 데이터·보고서 집계
   * 로직(categoriesOfTags)은 그대로 둔다.
   */
  const TAG_GROUPS = [
    { emoji: '🍽️', ko: '밥·생활',    ids: ['food', 'dorm', 'shopping'] },
    { emoji: '📚', ko: '학업',       ids: ['class', 'study', 'language'] },
    { emoji: '🏫', ko: '캠퍼스·사람', ids: ['campus', 'event', 'friends'] },
    { emoji: '🌆', ko: '동네·이동',  ids: ['neighborhood', 'transit', 'trip'] },
    { emoji: '🙋', ko: '도움·서류',  ids: ['admin', 'help', 'tip'] }
  ];

  function tagChipTemplate(t, selected) {
    return `<button type="button" class="tag-chip${selected ? ' is-selected' : ''}" data-tag="${t.id}" style="--chip-color:${(CATEGORY_MAP[t.cats[0]] || {}).color || '#4E6B93'}" aria-pressed="${selected}"><span class="tag-chip__emoji" aria-hidden="true">${t.emoji}</span>${t.ko}</button>`;
  }

  /** editTags가 있으면(수정) 이미 고른 태그가 든 묶음을 펼친 채로 그린다. */
  function tagGroupsTemplate(editTags) {
    return TAG_GROUPS.map(g => {
      const items = g.ids.map(id => EVERYDAY_MAP[id]).filter(Boolean);
      const open = !!(editTags && items.some(t => editTags.includes(t.id)));
      return `
        <div class="tag-group${open ? ' is-open' : ''}" data-group>
          <button type="button" class="tag-group__head" data-group-toggle aria-expanded="${open}">
            <span class="tag-group__emoji" aria-hidden="true">${g.emoji}</span>
            <span class="tag-group__label">${g.ko}</span>
            <span class="tag-group__caret" aria-hidden="true">⌄</span>
          </button>
          <div class="tag-group__body"${open ? '' : ' hidden'}>
            ${items.map(t => tagChipTemplate(t, !!(editTags && editTags.includes(t.id)))).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function toIso(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function entries() {
    const list = AppState.isAuthed ? AppState.getJournal() : guestSample();
    return list.slice().sort((a, b) => a.date.localeCompare(b.date));
  }

  // 귀국 후(DEPARTURE_PHASES.AFTER)에는 "출국 전(한국)" 기록과 "파견 중" 기록이 한 달력에
  // 섞인다 — 귀국 전까지는 매일 "지금 국면"만 쓰니 섞일 일이 없었지만, 돌아온 뒤 둘을
  // 오가며 보고 싶을 때는 칩으로 걸러야 한다(renderPhaseToggle). 캘린더·최근 사진 캐러셀만
  // 이 필터를 따른다 — 연속 기록·이번 주 스트립은 "그날 뭔가 남겼는지"라는 습관 지표라
  // 어느 국면 기록이든 항상 전부 센다.
  let phaseFilter = 'all';   // 'all' | 'prepare' | 'abroad'
  function visibleEntries() {
    const list = entries();
    if (phaseFilter === 'all') return list;
    return list.filter(e => (e.phase || departurePhaseFor(e.date)) === phaseFilter);
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
    P.sunset = 'assets/mock/campus-sunset.webp';   // 어제·오늘 예시 사진(앱에 들어 있는 파일)
    P.laptop = 'assets/mock/cafe-laptop.webp';
    Object.values(P).forEach(u => { photoUrls[u] = u; });
    const y = now.getFullYear(), m = now.getMonth();
    const at = (day, h, min) => new Date(y, m, day, h, min).toISOString();
    const mk = (day, h, min, o) => Object.assign({
      id: 'guest' + day, date: toIso(new Date(y, m, day)), phase: 'abroad', title: '', body: '',
      photos: [], tags: [], location: { country: '프랑스', city: '리옹' }, song: null, nowPlaying: null,
      weather: null, createdAt: at(day, h, min)
    }, o);
    // 예시 기록에도 앨범 표지 있는 노래를 붙인다 — 둘러보기에서 LP가 돌아가는 모습을 보여주기 위해서다.
    const ART = {
      indila: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/49/58/30/49583018-308b-431d-c691-4a28e78be8cd/14UMGIM01109.rgb.jpg/300x300bb.jpg',
      air: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d1/f9/26/d1f926e7-e996-7166-3744-0710a82177ac/017046664455.jpg/300x300bb.jpg',
      iu: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/dc/12/fe/dc12fe03-172b-a843-0d96-12819fa05b6c/cover-.jpg/300x300bb.jpg',
      stromae: 'https://is1-ssl.mzstatic.com/image/thumb/Video5/v4/49/ab/0f/49ab0f2e-9895-b63a-6438-0cf87201f875/13UAAIM09601_1_1.jpg/300x300bb.jpg',
      ariana: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7e/e6/82/7ee682bd-1b17-6adc-be63-b5af1bdff369/26UMGIM51126.rgb.jpg/300x300bb.jpg',
      justice: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/62/e4/01/62e40187-e672-17e5-f31f-9aee262703a3/mzi.bifzeufu.jpg/300x300bb.jpg'
    };
    const track = (name, artist, art) => Object.assign({ name, artist, art },
      (typeof SongEngine !== 'undefined') ? SongEngine.buildSongLinks(name, artist) : { youtubeUrl: '#' });
    guestCache = [
      mk(1, 11, 20, { title: '리옹 도착', body: '학교가 트램으로 15분 거리라 생각보다 조용한 동네였다.', photos: [P.campus], tags: ['neighborhood'],
        song: track('Sexy Boy', 'Air', ART.air) }),
      mk(2, 19, 40, { title: '기숙사 첫 요리', body: '마트에서 산 바게트가 확실히 다르다.', photos: [P.dorm], tags: ['dorm'],
        weather: { code: 3, temp: 18 },
        song: track('Dernière danse', 'Indila', ART.indila) }),
      mk(3, 13, 15, { title: '점심이 2시간', body: '다들 점심을 천천히 먹는 게 아직 적응 안 됨.', photos: [P.cafe], tags: ['friends'],
        song: track('밤편지', 'IU', ART.iu) }),
      mk(5, 15, 30, { title: '도서관 스터디룸', body: '국제학생 오피스에서 서류 도움 받고 스터디룸도 예약함.', photos: [P.library], tags: ['study', 'admin'],
        song: track('Formidable', 'Stromae', ART.stromae),
        nowPlaying: track('밤편지', 'IU', ART.iu) }),
      mk(7, 17, 45, { title: '파리 당일치기', body: '주말에 에펠탑 보고 옴.', photos: [P.eiffel, P.cafe], tags: ['trip', 'food'], location: { country: '프랑스', city: '파리' },
        weather: { code: 61, temp: 12 },
        song: track('Formidable', 'Stromae', ART.stromae) })
    ];
    // 어제·오늘 기록 — 달이 바뀌어도 항상 "어제"와 "오늘"이 되도록 날짜를 지금 기준으로 잡는다.
    const dayAt = (offset, h, min, o) => {
      const d = new Date(y, m, now.getDate() + offset);
      return Object.assign({
        id: 'guestd' + offset, date: toIso(d), phase: 'abroad', title: '', body: '', photos: [], tags: [],
        location: { country: '프랑스', city: '리옹' }, song: null, nowPlaying: null, weather: null,
        createdAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min).toISOString()
      }, o);
    };
    guestCache.push(
      dayAt(-1, 18, 40, { title: '노을 지는 캠퍼스', body: '수업 끝나고 계단 위에서 본 노을. 잔디밭이 다 금빛이었다.', photos: [P.sunset], tags: ['campus', 'neighborhood'],
        weather: { code: 0, temp: 19 }, song: track('Kiss Me', 'Ariana Grande', ART.ariana) }),
      dayAt(0, 11, 45, { title: '잔디밭 앞 카페', body: '아이스 라떼 두 잔 놓고 과제하는 오후. 날씨가 너무 좋다.', photos: [P.laptop], tags: ['study', 'food'],
        weather: { code: 1, temp: 22 }, song: track('D.A.N.C.E.', 'Justice', ART.justice) })
    );
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

    <div class="diary-tabs" role="tablist" aria-label="기록 보기">
      <button type="button" class="diary-tabs__tab is-active" role="tab" aria-selected="true" data-tab="mine">내 기록</button>
      <button type="button" class="diary-tabs__tab" role="tab" aria-selected="false" data-tab="timeline">타임라인</button>
      <button type="button" class="diary-tabs__friends" id="friendsBtn" aria-label="친구 관리">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><path d="M16.5 5.2a3 3 0 0 1 0 5.6M18 14c2 .6 3.5 2.3 3.5 5"/></svg>
        <span class="diary-tabs__badge" data-friends-badge hidden>0</span>
      </button>
    </div>

    <section class="ft-timeline" id="friendTimeline" hidden></section>

    <div class="diary-week" id="weekStrip" aria-label="이번 주 기록"></div>

    <div id="diaryHeroSlot"></div>
    <div id="diaryPhaseToggle" hidden></div>

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
          <div class="diary-menu">
            <button type="button" class="diary-icon-btn" id="calMenuBtn" aria-label="더 보기" aria-haspopup="menu" aria-expanded="false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
            </button>
            <div class="diary-menu__pop" id="calMenu" role="menu" hidden>
              <button type="button" class="diary-menu__item" id="openStampbook" role="menuitem">우표첩</button>
              <button type="button" class="diary-menu__item" id="openWrapup" role="menuitem">이번 달 정리</button>
              <button type="button" class="diary-menu__item" id="openReport" role="menuitem">경험보고서 미리보기</button>
            </div>
          </div>
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

  `;

  /* --------------------------------------------------------------- 파견 기간 */

  function renderHero() {
    const slot = root.querySelector('#diaryHeroSlot');
    const info = departureInfo();

    // 날짜를 모르면 여기서 받지 않고 홈으로 보낸다 — 입력 자리가 두 곳이면
    // 한쪽에서 고친 값이 다른 쪽에 안 보이는 것처럼 느껴진다.
    if (!info.hasRange) {
      slot.innerHTML = `
        <a class="diary-hero diary-hero--compact diary-hero--setup" href="home.html">
          <span class="diary-hero__cta">홈에서 출국일 입력하기 →</span>
        </a>`;
      return;
    }

    // 출국 전 — 남은 날 한 줄.
    if (info.phase === DEPARTURE_PHASES.BEFORE) {
      slot.innerHTML = `
        <div class="diary-hero diary-hero--compact diary-hero--before">
          <span class="diary-hero__daycount">D-<b class="diary-seg">${info.daysUntil}</b></span>
          <span class="diary-hero__left">${info.start} 출국</span>
        </div>`;
      return;
    }

    // 파견 중 / 귀국 후 — 한 줄: Day N ▬▬✈━━ 남은 날. 날짜·설명 문장은 뺐다(화면 정보 줄이기).
    const isAfter = info.phase === DEPARTURE_PHASES.AFTER;
    slot.innerHTML = `
      <div class="diary-hero diary-hero--compact">
        <span class="diary-hero__daycount">${isAfter ? '교환 종료' : `Day <b class="diary-seg">${info.dayNum}</b>`}</span>
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
        ${isAfter ? '' : `<span class="diary-hero__left">${info.daysLeft}일 남음</span>`}
      </div>`;
  }

  /**
   * 귀국 후에만 뜨는 국면 필터 — 돌아오기 전까지는 달력에 "출국 전" 기록과
   * "파견 중" 기록이 섞일 일이 없지만(그날그날 지금 국면만 쓰니까), 귀국 후에는
   * 둘 다 쌓여 있어서 한쪽만 골라 보고 싶을 때가 있다.
   */
  function renderPhaseToggle() {
    const mount = root.querySelector('#diaryPhaseToggle');
    if (!mount) return;
    const info = departureInfo();
    if (!info.hasRange || info.phase !== DEPARTURE_PHASES.AFTER) {
      mount.hidden = true;
      mount.innerHTML = '';
      return;
    }
    mount.hidden = false;
    const OPTIONS = [{ key: 'all', label: '전체' }, { key: 'prepare', label: '출국 전' }, { key: 'abroad', label: '파견 중' }];
    mount.innerHTML = `
      <div class="diary-phase-toggle" role="group" aria-label="기록 국면 필터">
        ${OPTIONS.map(o => `<button type="button" class="diary-phase-toggle__btn${phaseFilter === o.key ? ' is-active' : ''}" data-phase="${o.key}">${o.label}</button>`).join('')}
      </div>`;
    mount.querySelectorAll('[data-phase]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (phaseFilter === btn.dataset.phase) return;
        phaseFilter = btn.dataset.phase;
        renderPhaseToggle();
        renderFeatured();
        renderMonth();
      });
    });
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

  /**
   * 더미 안의 사진은 비율이 제각각이라, 그냥 겹치면 가장 큰 사진에 맞춰 카드가 커지고 작은 사진 둘레에
   * 여백이 생긴다. 맨 위(첫) 사진의 비율로 틀을 하나 정하고 나머지는 그 틀을 채워(cover) 진짜 카드 더미처럼 보이게 한다.
   * 상한은 일반 사진 한 장일 때와 같다(CSS의 max-height 360px / 폭 340px·화면 84%).
   */
  function sizeStacks(scope) {
    scope.querySelectorAll('.diary-featured__card[data-stack]').forEach(card => {
      const first = card.querySelector('.diary-stack__img');
      if (!first || !first.naturalWidth) return;
      const maxW = Math.min(340, window.innerWidth * 0.84), maxH = 360;
      const ratio = first.naturalWidth / first.naturalHeight;
      let w = maxH * ratio, h = maxH;
      if (w > maxW) { w = maxW; h = maxW / ratio; }
      card.style.setProperty('--stack-w', Math.round(w) + 'px');
      card.style.setProperty('--stack-h', Math.round(h) + 'px');
    });
  }

  /**
   * 하루에 사진이 여러 장이면 카드 더미처럼 겹쳐 놓는다. 맨 위 사진을 위로 쓸어 올리면
   * 더미의 맨 뒤로 넘어가고 다음 사진이 올라온다(끝까지 넘기면 처음으로 돌아온다).
   * 손가락은 처음 움직인 방향으로 동작을 정한다(touch-action: none이라 직접 판정):
   *   위 → 사진 넘기기 / 좌우 → 전날·다음날(nav, 캐러셀) / 아래 → 페이지 스크롤.
   * 마우스는 가로 끌기를 캐러셀이 이미 처리하므로 여기서는 위로 쓸기만 맡는다.
   */
  function wireStack(sl, nav) {
    const card = sl.querySelector('.diary-featured__card');
    const imgs = card ? [...card.querySelectorAll('.diary-stack__img')] : [];
    const n = imgs.length;
    if (n < 2) return;
    const badge = card.querySelector('.diary-stack__count');
    const order = imgs.map((_, i) => i);   // order[0]이 맨 위 사진
    const place = () => {
      order.forEach((idx, pos) => imgs[idx].style.setProperty('--pos', pos));
      badge.textContent = `${order[0] + 1} / ${n}`;
    };

    let id = null, sx = 0, sy = 0, lx = 0, ly = 0, dx = 0, dy = 0, mode = null, touchy = true, busy = false;
    const top = () => imgs[order[0]];
    const reset = () => { const t = top(); t.style.transition = ''; t.style.transform = ''; t.style.opacity = ''; };

    function flip() {
      busy = true;
      const t = top();
      t.style.transition = 'transform 240ms ease-in, opacity 240ms ease-in';
      t.style.transform = `translate(${dx * 0.35}px, -120%) rotate(${dx * 0.04 - 6}deg)`;
      t.style.opacity = '0';
      setTimeout(() => {
        // 날아간 사진은 transition 없이 더미 맨 뒤로 보내고, 나머지가 한 칸씩 앞으로 올라오는 건 transition에 맡긴다
        t.style.transition = 'none'; t.style.transform = ''; t.style.opacity = '';
        order.push(order.shift());
        place();
        void t.offsetWidth;
        t.style.transition = '';
        busy = false;
      }, 250);
    }

    card.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      id = ev.pointerId; touchy = ev.pointerType !== 'mouse';
      sx = lx = ev.clientX; sy = ly = ev.clientY; dx = 0; dy = 0; mode = null;
    });
    card.addEventListener('pointermove', (ev) => {
      if (ev.pointerId !== id) return;
      dx = ev.clientX - sx; dy = ev.clientY - sy;
      if (!mode) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) mode = touchy ? 'h' : 'skip';
        else mode = dy < 0 ? (busy ? 'skip' : 'up') : (touchy ? 'scroll' : 'skip');
        if (mode === 'skip') return;
        try { card.setPointerCapture(id); } catch (e) { /* 캡처 못 해도 이동은 따라온다 */ }
        if (mode === 'h') nav.start();
        if (mode === 'up') top().style.transition = 'none';
      }
      if (mode === 'h') nav.move(dx);
      else if (mode === 'scroll') window.scrollBy({ top: ly - ev.clientY, behavior: 'instant' });   // 사진 위에서 아래로 끌면 페이지가 손가락을 따라온다(전역 smooth 스크롤은 잘게 끊어 부르면 서로 취소해서 즉시 이동으로)
      else if (mode === 'up') {
        const up = Math.max(-420, Math.min(0, dy));
        const t = top();
        t.style.transform = `translate(${dx * 0.35}px, ${up}px) rotate(${dx * 0.04}deg)`;
        t.style.opacity = String(Math.max(0.4, 1 + up / 360));
      }
      lx = ev.clientX; ly = ev.clientY;
    });
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      id = null;
      const m = mode; mode = null;
      if (!m || m === 'skip') return;
      sl._noClickUntil = Date.now() + 400;   // 쓸어 넘긴 직후의 클릭은 "기록 열기"가 아니다
      if (m === 'h') nav.end(dx);
      else if (m === 'up') { if (ev.type !== 'pointercancel' && dy < -60) flip(); else reset(); }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    // 위로 쓸어 올린 자리에서 길게 눌러 생기는 메뉴·이미지 끌기가 끼어들지 않게
    card.addEventListener('contextmenu', (ev) => { if (mode) ev.preventDefault(); });

    // 쓸어 넘길 수 있다는 걸 처음 한 번만 살짝 들썩여 알려 준다
    try {
      if (localStorage.getItem('diary_stack_hint') !== '1') {
        localStorage.setItem('diary_stack_hint', '1');
        top().classList.add('is-nudge');
      }
    } catch (e) { /* 저장이 안 되면 매번 들썩이지만 해롭지 않다 */ }
  }

  function renderFeatured(swap) {
    const slot = root && root.querySelector('#diaryFeaturedSlot');
    if (!slot) return;

    if (!visibleEntries().length) {
      // 출국 전에는 "떠나기 전 기록"을 왜 남기는지가 안 와닿는다 — 교환 가서도
      // 다시 볼 수 있다는 걸 먼저 말해준다(departureInfo, js/components/departure.js).
      const isBefore = departureInfo().phase === DEPARTURE_PHASES.BEFORE;
      slot.innerHTML = `
        ${featuredHead('첫 우표')}
        <button type="button" class="diary-featured__empty" id="emptyStamp">
          <span class="diary-featured__empty-icon" aria-hidden="true">${isBefore ? '🇰🇷' : '✉️'}</span>
          <b>${isBefore ? '한국에서의 추억을 남겨보아요' : '첫 기록을 남겨보세요'}</b>
          <span>${isBefore ? '지금 남긴 기록은 교환 가서도 다시 볼 수 있어요' : '사진 한 장이면 첫 우표가 붙어요'}</span>
        </button>`;
      slot.querySelector('#emptyStamp').addEventListener('click', () => { if (!needLogin()) openEntryModal(); });
      wireQuestion(slot);
      return;
    }

    const withPhoto = visibleEntries().filter(e => (e.photos || []).some(p => photoUrl(p)));
    if (!withPhoto.length) {
      // 사진 주소를 받는 중이면 빈 칸 대신 같은 크기의 자리를 먼저 보여준다
      slot.innerHTML = visibleEntries().some(photosLoading)
        ? `${featuredHead('가장 최근 기록')}<div class="diary-featured__skeleton" aria-label="사진 불러오는 중"></div>` : '';
      if (slot.innerHTML) wireQuestion(slot);
      return;
    }

    const allDates = [...new Set(withPhoto.map(e => e.date))].sort().reverse();   // 최신순
    const dates = allDates.slice(0, 14);                                          // 캐러셀은 최근 14일까지
    const yest = toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    let pick = (view.featured && dates.includes(view.featured)) ? view.featured
      : (dates.includes(yest) ? yest : dates[0]);
    const labelFor = (iso) => iso === todayIso ? '오늘의 기록' : iso === yest ? '어제의 기록'
      : `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
    // 왼쪽이 과거, 오른쪽이 최근 — 어제는 오늘의 왼쪽에 놓인다(달력과 같은 방향)
    // 하루 사진은 전부 한 더미로 쌓는다. 기본 순서는 올린 순서 — 먼저 올린 기록이 맨 위,
    // 한 기록 안에서는 쓰기 창에서 정한 순서(맨 앞이 대표 사진)를 따른다.
    const slides = dates.slice().reverse().map((d, i) => {
      const list = withPhoto.filter(e => e.date === d)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const urls = [];
      list.forEach(e => (e.photos || []).forEach(p => { const u = photoUrl(p); if (u && !urls.includes(u)) urls.push(u); }));
      return { d, i, e: list[list.length - 1], urls };
    });

    slot.innerHTML = `
      ${featuredHead(labelFor(pick))}
      <div class="diary-carousel-wrap">
      <button type="button" class="diary-carousel__nav diary-carousel__nav--prev" id="featPrev" aria-label="더 이전 사진">‹</button>
      <button type="button" class="diary-carousel__nav diary-carousel__nav--next" id="featNext" aria-label="더 최근 사진">›</button>
      <div class="diary-carousel" id="featCarousel" aria-label="최근 사진">
        <span class="diary-carousel__pad" aria-hidden="true"></span>
        ${slides.map(s => `
          <div class="diary-slide" data-date="${s.d}">
            <div class="diary-featured__film">
              <div class="diary-featured__card"${s.urls.length > 1 ? ` data-stack="${s.urls.length}"` : ''} role="button" tabindex="0" aria-label="${esc(s.d)} 기록 열기${s.urls.length > 1 ? ` · 사진 ${s.urls.length}장, 위로 쓸어 넘기기` : ''}">
                <div class="diary-stack">
                  ${s.urls.map((u, k) => `<img class="diary-featured__img diary-stack__img" src="${u}" style="--pos:${k}" alt="${esc(s.e.title || s.e.body || '')}${s.urls.length > 1 ? ` (${k + 1}/${s.urls.length})` : ''}" draggable="false">`).join('')}
                </div>
                ${s.urls.length > 1 ? `<span class="diary-stack__count" aria-hidden="true">1 / ${s.urls.length}</span>` : ''}
              </div>
              <div class="film-bar film-bar--bottom" aria-hidden="true"><span>▶ ${allDates.length - allDates.indexOf(s.d)}A</span><span>${filmDate(s.d)}</span></div>
            </div>
          </div>`).join('')}
        <span class="diary-carousel__pad" aria-hidden="true"></span>
      </div>
      </div>`;

    wireQuestion(slot);
    const car = slot.querySelector('#featCarousel');
    const eyebrowEl = slot.querySelector('.diary-featured__eyebrow');
    const slideEls = [...car.querySelectorAll('.diary-slide')];
    const pads = car.querySelectorAll('.diary-carousel__pad');

    // 사진을 누르면 그날 기록 팝업
    // 더미 카드 위에서 손가락으로 좌우로 밀 때 쓰는 캐러셀 이동 — 짧게(40px) 밀어도 전날/다음날로 넘어간다.
    // goTo·activeIdx는 아래에서 정의되지만 이 함수들은 손가락이 움직일 때에야 불린다.
    let navLeft = 0, navIdx = 0;
    const nav = {
      // 시작할 때의 위치를 기억해 둔다 — 끌다가 가운데를 넘으면 활성 슬라이드가 바뀌어, 놓을 때 그걸 기준으로 하면 두 칸 넘어간다
      start() { navLeft = car.scrollLeft; navIdx = activeIdx(); car.style.scrollSnapType = 'none'; car.classList.add('is-dragging'); },
      move(dx) { car.scrollLeft = navLeft - dx; },
      end(dx) {
        car.classList.remove('is-dragging');
        goTo(dx <= -40 ? navIdx + 1 : dx >= 40 ? navIdx - 1 : navIdx);   // 왼쪽으로 밀면 더 최근, 오른쪽으로 밀면 더 이전
      }
    };
    slideEls.forEach(sl => {
      wireStack(sl, nav);
      // 사진을 쓸어 넘긴 직후의 클릭은 "기록 열기"로 치지 않는다
      const open = () => { if (Date.now() < (sl._noClickUntil || 0)) return; view.selected = sl.dataset.date; renderMonth(); openDayModal(sl.dataset.date); };
      sl.addEventListener('click', open);
      sl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(); });
    });

    // 넘기는 방법 — 터치는 손가락으로 밀기, 마우스는 사진을 끌거나 양옆 ‹ › 버튼, 트랙패드는 두 손가락 좌우.
    let goTimer = 0;
    const goTo = (i) => {
      const t = slideEls[Math.max(0, Math.min(slideEls.length - 1, i))];
      const left = t.offsetLeft - (car.clientWidth - t.offsetWidth) / 2;
      // scroll-snap이 켜져 있으면 부드러운 이동이 중간에 막히는 브라우저가 있어, 이동하는 동안만 끄고 도착 뒤에 다시 켠다
      car.style.scrollSnapType = 'none';
      car.scrollTo({ left, behavior: 'smooth' });
      clearTimeout(goTimer);
      goTimer = setTimeout(() => { car.scrollLeft = left; car.style.scrollSnapType = ''; }, 450);
    };
    const activeIdx = () => Math.max(0, slideEls.findIndex(sl => sl.classList.contains('is-active')));
    slot.querySelector('#featPrev').addEventListener('click', () => goTo(activeIdx() - 1));   // ‹ 왼쪽 = 더 이전(과거)
    slot.querySelector('#featNext').addEventListener('click', () => goTo(activeIdx() + 1));   // › 오른쪽 = 더 최근
    let dragX = 0, dragLeft = 0, dragging = false, dragged = false;
    car.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      dragging = true; dragged = false; dragX = ev.clientX; dragLeft = car.scrollLeft;
    });
    window.addEventListener('pointermove', (ev) => {
      if (!dragging || !car.isConnected) return;
      const dx = ev.clientX - dragX;
      if (Math.abs(dx) > 5) { dragged = true; car.style.scrollSnapType = 'none'; car.classList.add('is-dragging'); }
      if (dragged) car.scrollLeft = dragLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      car.classList.remove('is-dragging');
      if (dragged) {
        // 놓은 자리에서 가장 가까운 사진으로 부드럽게 맞춘다
        const mid = car.scrollLeft + car.clientWidth / 2;
        let bi = 0, bd = Infinity;
        slideEls.forEach((sl, i) => { const d = Math.abs(sl.offsetLeft + sl.offsetWidth / 2 - mid); if (d < bd) { bd = d; bi = i; } });
        goTo(bi);
      }
    });
    car.addEventListener('click', (ev) => { if (dragged) { ev.stopPropagation(); ev.preventDefault(); dragged = false; } }, true);

    // 가운데에 온 사진을 따라 제목·활성 표시를 바꾼다. 가운데에 온 사진을 따라 제목·활성 표시만 바꾼다.
    let scrollTimer = 0;
    car.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const mid = car.scrollLeft + car.clientWidth / 2;
        let best = null, bestDist = Infinity;
        slideEls.forEach(sl => {
          const dist = Math.abs(sl.offsetLeft + sl.offsetWidth / 2 - mid);
          if (dist < bestDist) { bestDist = dist; best = sl; }
        });
        if (best && best.dataset.date !== view.featured) {
          view.featured = best.dataset.date;
          if (eyebrowEl) eyebrowEl.textContent = labelFor(view.featured);
          slideEls.forEach(sl => sl.classList.toggle('is-active', sl === best));
        }
      }, 60);
    }, { passive: true });

    // 사진 폭은 불러온 뒤에야 정해진다 — 그 뒤에 양끝 여백을 잡아 첫 장이 가운데에 오게 한다
    car.style.visibility = 'hidden';
    Promise.all([...car.querySelectorAll('img')].map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))).then(() => {
      if (!car.isConnected) return;
      sizeStacks(car);
      const cw = car.clientWidth;
      pads[0].style.flexBasis = Math.max(0, (cw - slideEls[0].offsetWidth) / 2) + 'px';
      pads[1].style.flexBasis = Math.max(0, (cw - slideEls[slideEls.length - 1].offsetWidth) / 2) + 'px';
      const target = slideEls.find(sl => sl.dataset.date === pick) || slideEls[0];
      car.scrollLeft = target.offsetLeft - (cw - target.offsetWidth) / 2;
      target.classList.add('is-active');
      view.featured = target.dataset.date;
      car.style.visibility = '';
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
    visibleEntries().forEach(e => { (map[e.date] = map[e.date] || []).push(e); });
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
  document.addEventListener('click', (ev) => { if (ev.target.closest('[data-modal-close], .modal-scrim') && !ev.target.closest('[data-preview]')) stopPreview(); });
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
  /** 앨범 LP — 항상 천천히 돌고, 누르면 30초 미리듣기(재생 중엔 빨리 돈다). 표지가 없으면 검은 LP로 그린다. */
  function lpHtml(track) {
    if (!track) return '';
    const bg = track.art ? ` style="background-image:url('${track.art}')"` : '';
    return `<button type="button" class="diary-lp-btn" data-preview data-track="${esc(track.name)}" data-artist="${esc(track.artist)}" aria-label="${esc(track.name)} 30초 미리듣기">
      <span class="diary-lp${track.art ? '' : ' diary-lp--plain'}"${bg}></span><span class="diary-lp-play" aria-hidden="true"></span>
    </button>`;
  }

  function stampHtml(e, i) {
    const urls = (e.photos || []).map(photoUrl).filter(Boolean);
    const heading = e.title || e.body || '';
    const alt = esc(heading || `${e.date} 기록 사진`);
    const city0 = (e.location && (e.location.city || e.location.country)) || '';
    // 오늘의 노래를 우선하되, 없으면 그때 듣던 노래. 표지가 없어도 LP는 보인다.
    const lpTrack = e.song || e.nowPlaying || null;
    let photo;
    if (!urls.length && photosLoading(e)) {
      photo = `<div class="diary-stamp__skeleton" aria-label="사진 불러오는 중"></div>`;
    } else if (!urls.length) {
      photo = `<div class="diary-stamp__blank"><p>${esc(e.body || e.title || '')}</p>${lpHtml(lpTrack)}</div>`;
    } else {
      // 여러 장이면 한 장씩 옆으로 넘겨 본다(스와이프 + ‹ › 버튼). 넘길 수 있다는 걸
      // 위 숫자(1 / 3)로 알려준다.
      const multi = urls.length > 1;
      photo = `<div class="diary-entry__photo-wrap">
        ${multi ? `
        <div class="diary-photo-track" data-photo-track>
          ${urls.map((u, k) => `<img class="diary-entry__photo-single" src="${u}" alt="${alt} (${k + 1}/${urls.length})"${k ? ' loading="lazy"' : ''} draggable="false">`).join('')}
        </div>
        <span class="diary-entry__photo-more" data-photo-count>1 / ${urls.length}</span>
        <button type="button" class="diary-photo-nav diary-photo-nav--prev" data-photo-prev aria-label="이전 사진" hidden>‹</button>
        <button type="button" class="diary-photo-nav diary-photo-nav--next" data-photo-next aria-label="다음 사진">›</button>`
        : `<img class="diary-entry__photo-single" src="${urls[0]}" alt="${alt}">`}
        ${city0 ? `<div class="diary-postmark diary-postmark--film" aria-hidden="true"><b data-film="${filmDate(e.date)}">${e.date.slice(5).replace('-', '.')}</b><span>${esc(city0)}</span></div>` : ''}
        ${lpHtml(lpTrack)}
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
          <button type="button" class="diary-song-play" data-preview data-track="${esc(item.name)}" data-artist="${esc(item.artist)}" aria-label="${esc(item.name)} 30초 미리듣기">
            ${item.art
              ? `<img class="diary-ticket-song__art" src="${item.art}" alt="">`
              : `<span class="diary-ticket-song__art diary-ticket-song__art--empty">🎵</span>`}
            <span class="diary-lp-play" aria-hidden="true"></span>
          </button>
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
        const track = wrap.querySelector('[data-photo-track]');
        const current = () => (track && track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0);
        wrap.classList.add('is-clickable');
        // 누르면 지금 보고 있는 사진부터 크게 연다
        wrap.addEventListener('click', () => openPhotoLightbox(urls, current()));
        if (track) {
          const count = wrap.querySelector('[data-photo-count]');
          const prev = wrap.querySelector('[data-photo-prev]');
          const next = wrap.querySelector('[data-photo-next]');
          let ticking = false;
          const sync = () => {
            ticking = false;
            const i = current();
            count.textContent = `${i + 1} / ${urls.length}`;
            prev.hidden = i <= 0;
            next.hidden = i >= urls.length - 1;
          };
          track.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }, { passive: true });
          const go = (d) => (ev) => {
            ev.stopPropagation();
            track.scrollTo({ left: (current() + d) * track.clientWidth, behavior: 'smooth' });
          };
          prev.addEventListener('click', go(-1));
          next.addEventListener('click', go(1));
        }
      }
    });
    container.querySelectorAll('[data-preview]').forEach(btn => {
      btn.addEventListener('click', (ev) => { ev.stopPropagation(); togglePreview(btn); });
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
    if (!root || !root.querySelector('#entryList')) return;   // 달력 아래 목록은 뺐다 — 날짜를 누르면 팝업이 대신한다
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
          /*
           * 사진 비율: 4:3(가로) ~ 3:4(세로) 사이면 그대로 둔다. 16:9처럼 더 납작하거나 9:16처럼 더 길쭉하면
           * 가운데를 기준으로 4:3(또는 3:4)까지만 잘라 저장한다.
           */
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          const ratio = sw / sh;
          if (ratio > 4 / 3) { sw = Math.round(sh * 4 / 3); sx = Math.round((img.width - sw) / 2); }
          else if (ratio < 3 / 4) { sh = Math.round(sw * 4 / 3); sy = Math.round((img.height - sh) / 2); }
          const maxDim = 900;
          const scale = Math.min(1, maxDim / Math.max(sw, sh));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(sw * scale);
          canvas.height = Math.round(sh * scale);
          canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
    // 경로가 아니라 주소(또는 앱에 들어 있는 assets/ 파일)로 저장된 사진(예시 기록)은 서명 없이 그대로 쓴다
    all.filter(p => /^(https?:\/\/|assets\/)/.test(p)).forEach(p => { photoUrls[p] = p; });
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

  // 결제창에서 크레딧으로 1장을 더 샀으면 쓰기 창의 "크레딧" 버튼을 다시 "+"로 돌린다.
  // 쓰기 창은 열 때마다 새로 그려지므로 리스너는 여기서 한 번만 단다.
  document.addEventListener('credits:changed', () => {
    const s = document.getElementById('entryModalScrim');
    if (s && s.classList.contains('is-open') && s.querySelector('.diary-photo-picker')) renderPhotoPicker(s);
  });

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
              <span class="diary-photo-picker__add-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </span>
              <input type="file" accept="image/*" multiple id="photoInput" style="display:none;">
            </label>
            <label class="diary-photo-picker__add diary-photo-picker__camera" aria-label="바로 사진 찍기">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.4"/></svg>
              <input type="file" accept="image/*" capture="environment" id="cameraInput" style="display:none;">
            </label>
          </div>
          <p class="diary-photo-picker__quota" id="photoQuota" hidden></p>
          <p class="diary-form__hint" id="photoHint" hidden>⟳을 누르면 다음 사진이 앞으로 와요 — 맨 앞 사진이 대표 사진(우표에 크게 나오는 사진)이에요</p>
          <input type="text" name="title" class="diary-form__title" placeholder="제목 (선택)" maxlength="80">
          ${prompt ? `<p class="diary-prompt-note">💭 ${esc(prompt)}</p>` : ''}
          <textarea name="caption" placeholder="${prompt ? '한 줄로 답해보세요 (선택)' : '오늘 하루는 어땠나요? (선택)'}"></textarea>
          <div>
            <span class="diary-form__label">오늘 뭘 했나요? (여러 개 골라도 돼요)</span>
            <div class="diary-tag-grid" id="tagGrid">
              ${tagGroupsTemplate(edit ? edit.tags : null)}
            </div>
            <p class="diary-form__hint">고른 태그는 나중에 교환보고서 항목에 자동으로 나뉘어 들어가요</p>
          </div>
          <div>
            <span class="diary-form__label">그때 듣던 노래 (선택)</span>
            <div id="nowPlayingPicker"></div>
          </div>
          <label class="diary-share">
            <input type="checkbox" name="share" ${!edit || edit.visibility === 'friends' ? 'checked' : ''}>
            <span class="diary-share__text"><b>친구에게 공개</b><small>친구 목록에 있는 분들이 사진·글·위치·노래를 볼 수 있어요. 끄면 나만 봐요.</small></span>
          </label>
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
      // 태그 선택·묶음 펼침은 tagGroupsTemplate(edit.tags)가 이미 그려서 처리했다.
    }
    renderPhotoPicker(scrim);
    renderNowPlayingPicker(scrim);
    if (!edit) requestLocation();

    if (initialFile) {
      // 메인 화면 카메라로 바로 찍은 사진도 하루 무료 한도에 똑같이 센다
      if (AppState.freePhotoUploadsLeft() <= 0) {
        openPaywall({ reason: 'photo' });
      } else {
        addPendingPhoto(initialFile)
          .then(() => { AppState.recordPhotoUpload(); renderPhotoPicker(scrim); })
          .catch(err => showToast(err.message || '사진을 올리지 못했어요'));
      }
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

  // 뒤로 갈수록 살짝 더 기울고 더 밀린다 — 우표 카드 뒷장(.diary-stamp-back)과 같은 말투.
  const PHOTO_PEEK_OFFSETS = [{ rot: -6, x: -6, y: 5 }, { rot: 7, x: 7, y: 7 }];

  /**
   * 사진을 낱장 썸네일로 늘어놓는 대신, 그날 찍은 사진을 한 장씩 넘겨보는 작은 더미로
   * 보여준다(맨 앞이 우표 대표 사진). 뒤에 최대 2장만 살짝 겹쳐 보이고, 나머지는
   * 왼쪽 위 "+N"으로만 표시 — 몇 장이든 오른쪽 아래 ⟳를 눌러 순서대로 넘길 수 있다.
   */
  function renderPhotoPicker(scrim) {
    const picker = scrim.querySelector('#photoPicker');
    const addBtn = picker.querySelector('.diary-photo-picker__add');   // 더미는 첫 번째 추가 버튼 앞에 끼운다
    const oldStack = picker.querySelector('.diary-photo-stack');
    if (oldStack) oldStack.remove();

    if (pendingPhotos.length) {
      const stack = document.createElement('div');
      stack.className = 'diary-photo-stack';
      const peeks = pendingPhotos.slice(1, 3);
      stack.innerHTML = `
        ${peeks.map((p, k) => {
          const o = PHOTO_PEEK_OFFSETS[k];
          return `<div class="diary-photo-stack__peek" style="transform:rotate(${o.rot}deg) translate(${o.x}px, ${o.y}px); z-index:${2 - k};"><img src="${p.url}" alt=""></div>`;
        }).join('')}
        <div class="diary-photo-stack__front">
          <img src="${pendingPhotos[0].url}" alt="">
          <span class="diary-photo-thumb__cover">대표</span>
          <button type="button" class="diary-photo-stack__remove" aria-label="사진 빼기">✕</button>
        </div>
        ${pendingPhotos.length > 3 ? `<span class="diary-photo-stack__more">+${pendingPhotos.length - 3}</span>` : ''}
        ${pendingPhotos.length > 1 ? `<button type="button" class="diary-photo-stack__flip" aria-label="다음 사진 보기" title="다음 사진 보기">⟳</button>` : ''}
      `;
      picker.insertBefore(stack, addBtn);
      stack.querySelector('.diary-photo-stack__remove').addEventListener('click', () => {
        pendingPhotos.shift();
        renderPhotoPicker(scrim);
      });
      const flipBtn = stack.querySelector('.diary-photo-stack__flip');
      if (flipBtn) flipBtn.addEventListener('click', () => {
        pendingPhotos.push(pendingPhotos.shift());
        renderPhotoPicker(scrim);
      });
    }

    const hint = scrim.querySelector('#photoHint');
    if (hint) hint.hidden = pendingPhotos.length < 2;

    // 무료 한도를 다 썼으면 "+" 자리를 코인 아이콘으로 바꿔 크레딧을 써야 더 올릴 수
    // 있다는 걸 누르기 전에 미리 알려준다(js/state.js AppState.freePhotoUploadsLeft).
    const left = AppState.freePhotoUploadsLeft();
    const locked = Number.isFinite(left) && left <= 0;
    addBtn.classList.toggle('diary-photo-picker__add--credit', locked);
    const addIcon = addBtn.querySelector('.diary-photo-picker__add-icon');
    addIcon.innerHTML = locked
      ? `<span class="diary-photo-picker__add-coin" aria-hidden="true">🪙</span><span class="diary-photo-picker__add-label">크레딧</span>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;

    const quota = scrim.querySelector('#photoQuota');
    if (quota) {
      quota.hidden = !Number.isFinite(left);   // 프리미엄(Infinity)이면 아예 감춘다
      quota.textContent = left > 0
        ? `오늘 무료 사진 ${left}장 남음 · 프리미엄이면 무제한`
        : '오늘 무료 사진을 다 썼어요 · 크레딧을 쓰거나 프리미엄이면 더 올릴 수 있어요';
    }
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
        // 도시·국가만 남긴다 — 정밀 좌표는 친구에게 공개된 기록에서 정확한 위치가 새는 길이라 저장하지 않는다
        pendingLocation = { country: data.countryName || null, city: data.city || data.locality || null, countryCode: data.countryCode || null };
        if (note) note.textContent = `📍 ${[pendingLocation.city, pendingLocation.country].filter(Boolean).join(', ') || '위치 확인됨'}`;
      } catch (err) {
        pendingLocation = null;
        if (note) note.textContent = '📍 지명을 확인하지 못했어요';
      }
    }, () => {
      pendingLocation = null;
      if (note) note.textContent = '📍 위치 권한이 거부됐어요 (위치 없이 저장돼요)';
    }, { timeout: 8000 });
  }

  function wireEntryForm(scrim) {
    const grid = scrim.querySelector('#tagGrid');
    // 위임 클릭 하나로 묶음 펼치기/접기와 태그 고르기를 같이 받는다 — 묶음을 펼칠 때마다
    // 안의 칩이 새로 생기는 게 아니라(이미 DOM에 있고 hidden만 바뀐다) 위임이 아니어도
    // 되지만, 두 종류 버튼을 한 리스너로 묶어 두는 편이 더 단순하다.
    grid.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-group-toggle]');
      if (toggle) {
        const group = toggle.closest('.tag-group');
        const body = group.querySelector('.tag-group__body');
        const open = group.classList.toggle('is-open');
        body.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        return;
      }
      const chip = e.target.closest('.tag-chip');
      if (chip) {
        const on = chip.classList.toggle('is-selected');
        chip.setAttribute('aria-pressed', String(on));
      }
    });

    ['#photoInput', '#cameraInput'].forEach((sel) => {
      const input = scrim.querySelector(sel);
      // 한도를 다 썼으면 사진 고르는 창 대신 결제창을 연다 — 고른 뒤에 막히면 헛수고라서
      input.closest('label').addEventListener('click', (e) => {
        if (AppState.freePhotoUploadsLeft() > 0) return;
        e.preventDefault();
        openPaywall({ reason: 'photo' });
      });
      input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        input.value = '';
        let blocked = false;
        for (const file of files) {
          if (AppState.freePhotoUploadsLeft() <= 0) { blocked = true; break; }
          try { await addPendingPhoto(file); AppState.recordPhotoUpload(); }
          catch (err) { showToast(err.message || '사진을 올리지 못했어요'); }
        }
        renderPhotoPicker(scrim);
        if (blocked) openPaywall({ reason: 'photo' });
      });
    });

    scrim.querySelector('#entryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get('date');
      const tags = Array.from(grid.querySelectorAll('.tag-chip.is-selected')).map(b => b.dataset.tag);
      const title = (fd.get('title') || '').trim();
      const body = (fd.get('caption') || '').trim();
      const visibility = fd.get('share') ? 'friends' : 'private';
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
          nowPlaying: nextNP,
          visibility
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
        nowPlaying, weather: pendingWeather, visibility
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
    // 달력 오른쪽 ⋯ — 우표첩·이번 달 정리·보고서 미리보기를 한 곳에 모았다
    const menuBtn = root.querySelector('#calMenuBtn');
    const menu = root.querySelector('#calMenu');
    const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', outsideMenu, true); };
    const outsideMenu = (ev) => { if (!menu.contains(ev.target) && ev.target !== menuBtn && !menuBtn.contains(ev.target)) closeMenu(); };
    menuBtn.addEventListener('click', () => {
      if (!menu.hidden) { closeMenu(); return; }
      menu.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', outsideMenu, true);
    });
    menu.addEventListener('click', () => closeMenu());
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
    wireTabs();
    root.querySelector('#openWrapup').addEventListener('click', openWrapupModal);
    root.querySelector('#openReport').addEventListener('click', openReportModal);
  }

  /** 내 기록 ↔ 친구 타임라인. 타임라인은 보일 때마다 새로 읽는다(친구가 방금 올렸을 수 있다). */
  function wireTabs() {
    const slot = root.querySelector('#friendTimeline');
    let mounted = false;
    root.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const timeline = btn.dataset.tab === 'timeline';
        root.classList.toggle('is-timeline', timeline);
        slot.hidden = !timeline;
        root.querySelectorAll('[data-tab]').forEach(b => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        if (!timeline) return;
        if (!mounted) { mounted = true; Friends.mountTimeline(slot); }
        else Friends.reloadTimeline();
      });
    });
    root.querySelector('#friendsBtn').addEventListener('click', () => {
      if (needLogin()) return;
      Friends.openManager();
    });
    Friends.refreshBadges();
  }

  /** 둘러보기에는 남길 계정이 없다 — 로그인해야 저장된다. 로그인 화면으로 갈지 묻고, 갔으면 true. */
  function needLogin() {
    if (AppState.isAuthed) return false;
    if (window.confirm('로그인하면 기록을 계정에 남길 수 있어요. 로그인 화면으로 갈까요?')) location.href = 'auth.html';
    return true;
  }

  function renderAll() {
    renderHero();
    renderPhaseToggle();
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
    // 퀘스트 완료 뒤 "사진 찍기"로 넘어오면(journal.html?add=1) 바로 기록 쓰기 창을 연다
    if (new URLSearchParams(location.search).get('add') === '1') {
      history.replaceState(null, '', location.pathname);
      setTimeout(() => { if (!needLogin()) openEntryModal(); }, 500);
    }
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
