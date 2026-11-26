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
  // 사진 찍은 곳·날씨를 찾는 중인 작업들 — 이게 끝나기 전에 저장을 누르면 위치 없이 저장됐다. 저장 때 잠깐 기다린다
  let placeJobs = [];
  const placeJob = (p) => { placeJobs.push(Promise.resolve(p).catch(() => {})); return p; };
  let pendingNowPlaying = null;  // 사용자가 직접 고른 "그때 듣던 노래"
  let nowPlayingSearchTimer = null;
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
    const list = AppState.isAuthed ? AppState.getJournal() : [];   // 로그인 전에는 예시 기록 없이 빈 화면
    // 같은 날은 기록 시각순 — 먼저 찍은 사진이 앞(왼쪽)에 온다. 시각은 찍은 시점(앨범에서 고른 사진은 EXIF)이다.
    return list.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)));
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
    <header class="v2-head rec-head">
      <div class="rec-head__text">
        <p class="v2-head__eyebrow">Archive your memories</p>
        <h1 class="v2-head__title" id="recDayTitle">Today</h1>
      </div>
      <button type="button" class="rec-head__add" id="recHeadAdd"><span aria-hidden="true">+</span> 사진 추가</button>
    </header>

    <section class="rec-streak" id="recStreak"></section>

    <section class="rec-hero" id="recHero"></section>

    <section class="rec-recent">
      <div class="rec-sec-head">
        <h2 class="rec-sec-head__title">Storage</h2>
        <button type="button" class="rec-sec-head__more" id="recOpenStorage" aria-label="저장소 전체 보기">→</button>
      </div>
      <div class="rec-recent__row" id="recRecent"></div>
    </section>

    <!-- Recap — 한 달 사진을 잡지 한 장처럼(예전에는 Monthly 폴더를 열면 나왔다. 폴더는 이제 사진 보관용). js/record-v2.js openRecap -->
    <section class="rec-recap-home">
      <div id="recRecapSlot"></div>
    </section>

    <!-- 하루 다이어리 — 하루를 한 장으로 꾸민다(사진·글·스티커·노래). 열면 넣은 노래가 재생된다. js/record-v2.js -->
    <section class="rec-diary">
      <div class="rec-sec-head">
        <h2 class="rec-sec-head__title">Diary</h2>
        <button type="button" class="rec-diary__new" id="recDiaryNew">+ 다이어리 만들기</button>
      </div>
      <div class="rec-diary__row" id="recDiaryRow"></div>
    </section>

    <!-- 예전 첫 화면(최근 사진 카드·기록 버튼)은 시안에서 빠졌다. 기록 쓰기 창은 사진 자리에서 연다 -->
    <section class="diary-featured" id="diaryFeaturedSlot" hidden></section>
    <div class="diary-write-bar" hidden>
      <label class="diary-write-bar__btn diary-write-bar__btn--camera" id="cameraBtn" role="button" tabindex="-1" aria-hidden="true">
        <input type="file" accept="image/*" capture="environment" id="cameraInputMain" tabindex="-1">
      </label>
      <button type="button" class="diary-write-bar__btn" id="writeBtn" tabindex="-1" aria-hidden="true"></button>
    </div>

    <section class="arc-sec-home" id="archiveFriendsSec">
      <div class="arc-sec-home__head"><span class="arc-sec-home__label">Friends Today</span><button type="button" class="arc-edit" id="archiveFriendsManage">친구 관리<span class="arc-badge" data-friends-badge hidden>0</span></button></div>
      <div id="archiveFriends"></div>
    </section>

    <!-- 달력은 첫 화면에서 빠졌다 — 이번 주 기록 줄의 '자세히 보기'로 여는 전체 화면 -->
    <div class="rec-layer rec-calpage" id="recCalPage" hidden>
      <header class="rec-top">
        <button type="button" class="rec-top__back" id="recCalClose" aria-label="닫기">‹</button>
        <div class="rec-top__title"><b>캘린더</b><small>Calendar</small></div>
        <div class="rec-top__right"></div>
      </header>
      <div class="rec-layer__body">
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
      </div>
    </div>

    <div id="diaryHeroSlot"></div>
    <div id="diaryPhaseToggle" hidden></div>


  `;

  /* --------------------------------------------------------------- 파견 기간 */

  function renderHero() {
    const slot = root.querySelector('#diaryHeroSlot');
    const info = departureInfo();

    // 날짜를 모르면 아무것도 보이지 않는다 — 출국일 입력 안내는 홈에 있다(입력 자리가 두 곳이면
    // 한쪽에서 고친 값이 다른 쪽에 안 보이는 것처럼 느껴져서 여기서는 안내도 하지 않는다).
    // 빈 칸이 flex 간격만 먹지 않게 슬롯 자체를 숨긴다.
    slot.hidden = !info.hasRange;
    if (!info.hasRange) { slot.innerHTML = ''; return; }

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

  /** 기록이 있는 날 모음 — 국면 필터와 상관없이 전부 센다 */
  function recordedDays() { return new Set(entries().map(e => e.date)); }
  /** D-day 밑 이번 주 줄 — 일~토 칸에 기록한 날을 채우고, 자세히 보기로 달력을 연다 */
  function renderStreak() {
    const slot = root.querySelector('#recStreak');
    if (!slot) return;
    const days = recordedDays();
    // 연속 일수 대신 지금까지 기록한 날 수(하루에 여러 번 써도 하루)
    const n = days.size;
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    const cells = WD.map((w, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const iso = toIso(d);
      const done = days.has(iso);
      const cls = ['rec-streak__day', done && 'is-done', iso === todayIso && 'is-today', iso > todayIso && 'is-future'].filter(Boolean).join(' ');
      return `<span class="${cls}"><i>${w}</i><b>${d.getDate()}</b></span>`;
    }).join('');
    slot.innerHTML = `
      <div class="rec-streak__top">
        <p class="rec-streak__count" aria-label="${n} ${n === 1 ? 'day' : 'days'} recorded">
          <b>${n}</b>${n === 1 ? 'day' : 'days'} recorded
        </p>
        <button type="button" class="rec-streak__more" id="recCalOpen">자세히 보기 →</button>
      </div>
      <div class="rec-streak__week">${cells}</div>`;
  }
  function openCalPage() {
    const page = root.querySelector('#recCalPage');
    if (!page) return;
    view.year = now.getFullYear(); view.month = now.getMonth();
    renderMonth();
    page.hidden = false;
    page.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => page.classList.add('is-open'));
  }
  function closeCalPage() {
    const page = root && root.querySelector('#recCalPage');
    if (!page) return;
    page.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (!page.classList.contains('is-open')) page.hidden = true; }, 330);
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
    sl._topIndex = () => order[0];          // 눌렀을 때 맨 위 사진부터 확대한다
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
          <span>${isBefore ? '지금 남긴 기록은 교환 가서도 다시 볼 수 있어요' : '사진 한 장이면 첫 우표가 붙어요.'}</span>
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
      const urls = [], ents = [];   // ents[i] = urls[i] 사진이 속한 기록(확대 화면의 위치·날씨·노래용)
      list.forEach(e => (e.photos || []).forEach(p => { const u = photoUrl(p); if (u && !urls.includes(u)) { urls.push(u); ents.push(e); } }));
      return { d, i, e: list[list.length - 1], urls, ents };
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
      const open = () => {
        if (Date.now() < (sl._noClickUntil || 0)) return;
        // 사진을 누르면 살짝 커지고 뒤는 블러, 빈 자리에 위치·날씨·노래(js/diary-archive.js). 더미는 맨 위 사진부터.
        if (typeof DiaryArchive !== 'undefined' && DiaryArchive.openPhotos) {
          const sd = slides[slideEls.indexOf(sl)];
          const thumbs = [...sl.querySelectorAll('.diary-featured__img')];
          if (sd && thumbs.length) {
            DiaryArchive.openPhotos(sd.urls.map((u, i) => ({ url: u, info: DiaryArchive.infoOf(sd.ents[i]) })), sl._topIndex ? sl._topIndex() : 0, thumbs);
            return;
          }
        }
        view.selected = sl.dataset.date; renderMonth(); openDayModal(sl.dataset.date);
      };
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


  /* --------------------------------------------------------------- 시간대 배경 */

  /** 낮·노을·밤에 따라 배경이 바뀐다. 시험용으로 ?tod=night 처럼 강제할 수 있다. */
  function applyTimeOfDay() {
    const forced = new URLSearchParams(location.search).get('tod');
    const h = new Date().getHours();
    const tod = ['day', 'dusk', 'night'].includes(forced) ? forced : (h >= 6 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night');
    document.body.dataset.tod = tod;
    // 화면 분위기 — 기본은 v2(흰 바탕, Figma 기록하기 시안). ?theme=film 은 필름 카메라, ?theme=glass 는 유리 + 노을 테마.
    const th = new URLSearchParams(location.search).get('theme');
    document.body.dataset.theme = th === 'glass' ? 'glass' : th === 'film' ? 'film' : 'v2';
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
  const locText = (raw) => { const loc = typeof placeEn === 'function' ? placeEn(raw) : raw;
    return (loc && (loc.city || loc.country)) ? [loc.city, loc.country].filter(Boolean).join(', ') : ''; };

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
    const lpTrack = e.nowPlaying || e.song || null;   // 직접 고른 노래가 먼저
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
          ${songRow(e.song, '🎵 추천 노래 · 날씨·위치 기반', 'recommend')}
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
      <p>이 날짜엔 아직 기록이 없어요.<br>아래 카메라로 남겨보세요.</p>
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
        wrap.addEventListener('click', () => {
          if (typeof DiaryArchive !== 'undefined' && DiaryArchive.openPhotos) {
            const thumbs = [...wrap.querySelectorAll('img.diary-entry__photo-single')];
            if (thumbs.length === urls.length) {
              const info = DiaryArchive.infoOf(entry);
              DiaryArchive.openPhotos(urls.map(u => ({ url: u, info })), current(), thumbs);
              return;
            }
          }
          openPhotoLightbox(urls, current());
        });
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
        // 아이폰 사진(HEIC)은 Safari·iOS 앱은 열지만 크롬 계열 브라우저는 못 연다
        const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || '');
        img.onerror = () => reject(new Error(heic
          ? '아이폰 사진(HEIC)은 이 브라우저에서 열 수 없어요.\nJPG·PNG로 바꿔 올리거나 휴대폰 앱에서 올려 주세요.'
          : '이미지를 열지 못했어요'));
        img.onload = () => {
          /*
           * 사진은 원본 비율 그대로 저장한다(예전에는 4:3~3:4 밖이면 가운데를 잘랐다).
           * 다이어리에서 4:3·3:4·1:1로 보이고 싶으면 꾸미기의 "자르기"에서 사용자가 직접 정한다.
           */
          const sx = 0, sy = 0, sw = img.width, sh = img.height;
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

  /**
   * 사진 속 정보 — 찍은 시각과 찍은 곳(GPS). 앨범에서 고른 사진은 올린 시각·지금 있는 곳이 아니라
   * 찍은 시각·찍은 곳으로 기록해야 해서(피드백) 원본 파일의 EXIF를 읽는다. 리사이즈(canvas)를 거치면
   * EXIF가 사라지므로 올리기 전에 읽는다. JPEG뿐 아니라 아이폰 HEIC도 안에 같은 EXIF 블록이 있어
   * 'Exif\0\0' 표시를 찾아 그 뒤의 TIFF 머리부터 읽는다.
   * 시각이 없으면 파일 수정 시각(방금 찍은 것처럼 지금과 같으면 모르는 걸로 친다)을 쓴다.
   */
  async function readPhotoMeta(file) {
    let meta = { takenAt: null, gps: null };
    try { meta = parseExif(new DataView(await file.slice(0, 524288).arrayBuffer())) || meta; }
    catch (e) { /* EXIF가 없거나 깨졌으면 아래로 */ }
    if (!(meta.takenAt && !isNaN(meta.takenAt)) && file.lastModified && Math.abs(Date.now() - file.lastModified) > 60000) {
      meta.takenAt = new Date(file.lastModified);
    }
    return meta;
  }
  function parseExif(dv) {
    // 'Exif\0\0' 찾기
    let tiff = -1;
    for (let i = 0; i + 10 < dv.byteLength; i++) {
      if (dv.getUint32(i) === 0x45786966 && dv.getUint16(i + 4) === 0) {
        const o = dv.getUint16(i + 6);
        if (o === 0x4949 || o === 0x4D4D) { tiff = i + 6; break; }
      }
    }
    if (tiff < 0) return null;
    const little = dv.getUint16(tiff) === 0x4949;
    const u16 = (o) => dv.getUint16(o, little), u32 = (o) => dv.getUint32(o, little);
    const inRange = (o) => o > 0 && o < dv.byteLength - 2;
    const find = (ifd, tag) => {
      if (!inRange(ifd)) return null;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (!inRange(e + 12)) return null; if (u16(e) === tag) return { count: u32(e + 4), val: e + 8 }; }
      return null;
    };
    const text = (e) => {
      const o = e.count > 4 ? tiff + u32(e.val) : e.val;
      let str = ''; for (let i = 0; i < e.count - 1 && inRange(o + i); i++) str += String.fromCharCode(dv.getUint8(o + i));
      return str;
    };
    const rationals = (e) => {
      const o = tiff + u32(e.val), out = [];
      for (let i = 0; i < e.count; i++) { const d = u32(o + i * 8 + 4); out.push(d ? u32(o + i * 8) / d : 0); }
      return out;
    };
    const toDate = (str) => { const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; };
    const ifd0 = tiff + u32(tiff + 4);
    let takenAt = null, gps = null;
    const exifPtr = find(ifd0, 0x8769);
    if (exifPtr) { const e = find(tiff + u32(exifPtr.val), 0x9003) || find(tiff + u32(exifPtr.val), 0x9004); if (e) takenAt = toDate(text(e)); }
    if (!takenAt) { const e0 = find(ifd0, 0x0132); if (e0) takenAt = toDate(text(e0)); }
    const gpsPtr = find(ifd0, 0x8825);
    if (gpsPtr) {
      try {
        const g = tiff + u32(gpsPtr.val);
        const latRef = find(g, 1), lat = find(g, 2), lngRef = find(g, 3), lng = find(g, 4);
        if (lat && lng) {
          const dms = (r) => r[0] + (r[1] || 0) / 60 + (r[2] || 0) / 3600;
          let la = dms(rationals(lat)), lo = dms(rationals(lng));
          if (latRef && String.fromCharCode(dv.getUint8(latRef.val)) === 'S') la = -la;
          if (lngRef && String.fromCharCode(dv.getUint8(lngRef.val)) === 'W') lo = -lo;
          if (isFinite(la) && isFinite(lo) && (la || lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) gps = { lat: la, lng: lo };
        }
      } catch (e) { /* 위치 칸이 깨졌으면 위치 없이 */ }
    }
    return { takenAt, gps };
  }

  /**
   * 앱(iOS)의 사진 고르기 — ios/App/App/PhotoPickerPlugin.swift.
   * 웹 사진 창(<input type="file">)으로 고르면 iOS가 촬영 위치(GPS)를 지우고 넘겨줄 때가 있어서,
   * 앱에서는 사진 보관함 권한을 받아 사진 앱에 저장된 촬영 위치·시각을 직접 읽는다.
   * 권한을 거부해도 사진은 고를 수 있고, 그때는 파일 안에 남은 정보만 쓴다(없으면 위치 없음).
   * 웹에서는 null — 원래대로 파일 창을 연다.
   */
  function nativePhotoPicker() {
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.PhotoPicker) || null;
  }

  let nativePicking = false;
  async function pickPhotosNative(picker, scrim) {
    if (nativePicking) return;
    nativePicking = true;
    try {
      const left = AppState.freePhotoUploadsLeft();
      const { photos } = await picker.pick({ limit: Number.isFinite(left) ? left : 0 });
      const stamped = await Promise.all((photos || []).map(async (p) => {
        const res = await fetch(window.Capacitor.convertFileSrc(p.path));
        const blob = await res.blob();
        const file = new File([blob], p.name || 'photo.jpg', { type: p.mimeType || blob.type || 'image/jpeg' });
        const fromFile = await readPhotoMeta(file);
        return {
          f: file,
          m: {
            // 시각은 파일 EXIF(찍은 곳의 벽시계 시각)를 먼저 쓴다. 보관함의 creationDate는 절대 시각이라
            // 기기 시간대로 바뀌면서 해외에서 찍은 사진의 날짜가 하루 밀릴 수 있다(예: 바르셀로나 19:45 → 서울 02:45)
            takenAt: fromFile.takenAt || (p.takenAt ? new Date(p.takenAt) : null),
            // 위치는 보관함 값을 먼저 쓴다 — 파일 쪽 위치는 iOS가 지웠을 수 있다
            gps: p.location || fromFile.gps
          }
        };
      }));
      await addPickedPhotos(scrim, stamped);
    } catch (err) {
      const msg = (err && err.message) || '';
      if (!/already picking/.test(msg)) showToast('사진을 불러오지 못했어요');   // 네이티브 오류 문구(영어)는 그대로 보이지 않는다
      console.warn('[photo-picker]', err);
    } finally {
      nativePicking = false;
    }
  }

  /** 고른 사진들을 올린다 — 고른 순서가 아니라 찍은 순서로 줄을 세운다(모르는 건 맨 뒤) */
  async function addPickedPhotos(scrim, stamped) {
    if (!stamped.length) return;
    let blocked = false;
    stamped.sort((a, b) => (a.m.takenAt ? +a.m.takenAt : Infinity) - (b.m.takenAt ? +b.m.takenAt : Infinity));
    for (const { f: file, m } of stamped) {
      if (AppState.freePhotoUploadsLeft() <= 0) { blocked = true; break; }
      try { await addPendingPhoto(file, m); AppState.recordPhotoUpload(); }
      catch (err) { showToast(err.message || '사진을 올리지 못했어요'); }
    }
    renderPhotoPicker(scrim);
    if (blocked) openPaywall({ reason: 'photo' });
  }

  async function addPendingPhoto(file, meta) {
    if (meta === undefined) meta = await readPhotoMeta(file);
    const takenAt = meta ? meta.takenAt : null;
    const gps = meta ? meta.gps : null;
    const blob = await resizeImage(window.HeicFix ? await HeicFix.prepare(file) : file);   // 아이폰 HEIC → JPEG(필요할 때만)
    const path = await AppState.uploadDiaryPhoto(blob);
    const url = URL.createObjectURL(blob);   // 방금 올린 건 서명 URL을 기다릴 것 없이 바로 보여준다
    photoUrls[path] = url;
    pendingPhotos.push({ path, url, takenAt, gps });
    usePhotoPlace();
    return path;
  }

  /** 서명 URL을 받아 채운 뒤 다시 그린다. 사진 수만큼 왕복하지 않도록 한 번에 묶어 받는다. */
  async function refreshPhotoUrls() {
    const all = entries().flatMap(e => e.photos || []).filter(p => !photoUrls[p]);
    // 경로가 아니라 주소(또는 앱에 들어 있는 assets/ 파일)로 저장된 사진(예시 기록)은 서명 없이 그대로 쓴다
    all.filter(p => /^(https?:\/\/|assets\/)/.test(p)).forEach(p => { photoUrls[p] = p; });
    const paths = all.filter(p => !photoUrls[p]);
    if (!paths.length) { renderFeatured(); renderMonth(); renderSide(); renderArchive(); renderHome(); return; }
    const map = await AppState.signPhotoPaths(paths);
    Object.assign(photoUrls, map);
    paths.forEach(p => { if (!map[p]) photoFailed.add(p); });
    renderFeatured();
    renderMonth();
    renderSide();
    renderArchive();
    renderHome();
    document.dispatchEvent(new CustomEvent('record:photos'));
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

  /** 기록 쓰기 창의 폴더 칩 — 손으로 만든 폴더만(Monthly는 날짜로 자동이라 뺀다). 여러 개 고를 수 있다 */
  let pendingFolders = new Set();
  function entryFolders() {
    try { return typeof DiaryArchive !== 'undefined' ? DiaryArchive.folders().filter(f => f.type !== 'monthly') : []; }
    catch (e) { return []; }
  }
  function folderIdsOf(entryId) {
    return entryFolders().filter(x => (x.entryIds || []).includes(entryId)).map(x => x.id);
  }
  function folderChipsHtml() {
    const chips = entryFolders().map(f => `<button type="button" class="rec-chip${pendingFolders.has(f.id) ? ' is-on' : ''}" data-folder-pick="${esc(f.id)}" aria-pressed="${pendingFolders.has(f.id)}">${esc(f.name)}</button>`).join('');
    return chips + '<button type="button" class="rec-chip entry-v2__chip-add" data-folder-new aria-label="새 폴더 만들기">+</button>';
  }

  function openEntryModal(initialFile, prompt, edit) {
    // 원본은 파견 기간 밖을 막았지만, 여기서는 출국 전 기록이 핵심 용도라 막지 않는다.
    editingEntry = edit || null;
    const targetDate = edit ? edit.date : (view.selected || todayIso);
    pendingPhotos = edit ? (edit.photos || []).map(p => ({ path: p, url: photoUrl(p) })) : [];
    pendingLocation = null;
    pendingWeather = null;
    photoPlaceKey = '';
    placeJobs = [];
    pendingNowPlaying = edit ? (edit.nowPlaying || null) : null;
    editKeepTags = edit ? (edit.tags || []).filter(t => !EVERYDAY_MAP[t]) : [];

    const scrim = ensureScrim('entryModalScrim');
    // 기록 쓰기 — 사진 · 제목/캡션 · 담을 폴더 · 그때 듣던 노래만(v2 컨셉: 흰 시트, 큰 제목, 칩)
    pendingFolders = new Set(edit ? folderIdsOf(edit.id) : []);
    scrim.innerHTML = `
      <div class="modal-panel modal-panel--sm diary-modal-pad diary-sheet entry-v2">
        <div class="diary-sheet__handle"></div>
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <header class="entry-v2__head">
          <p class="entry-v2__eyebrow">${esc(targetDate)}</p>
          <h2 class="entry-v2__title">${edit ? 'Edit' : 'New'} <span>record</span></h2>
        </header>
        <form class="diary-form entry-v2__form" id="entryForm">
          <div class="diary-photo-picker" id="photoPicker">
            <label class="diary-photo-picker__add" aria-label="사진 추가">
              <span class="diary-photo-picker__add-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </span>
              <input type="file" accept="image/*" multiple id="photoInput" style="display:none;">
            </label>
          </div>
          <p class="entry-v2__place" id="locationNote" hidden></p>
          <p class="diary-form__hint" id="photoHint" hidden>⟳을 누르면 다음 사진이 앞으로 와요.<br>맨 앞 사진이 대표 사진이에요.</p>

          <div class="entry-v2__field">
            <span class="entry-v2__label">제목 · 캡션</span>
            <input type="text" name="title" class="entry-v2__input entry-v2__input--title" placeholder="사진 제목" maxlength="80">
            ${prompt ? `<p class="diary-prompt-note">💭 ${esc(prompt)}</p>` : ''}
            <textarea name="caption" class="entry-v2__input entry-v2__caption" placeholder="${prompt ? '한 줄로 답해보세요' : '캡션을 남겨 보세요'}"></textarea>
          </div>

          <div class="entry-v2__field">
            <span class="entry-v2__label">담을 폴더</span>
            <div class="entry-v2__chips" id="folderChips">${folderChipsHtml()}</div>
          </div>

          <div class="entry-v2__field">
            <span class="entry-v2__label">그때 듣던 노래</span>
            <div id="nowPlayingPicker"></div>
          </div>

          <!-- 공개 범위 — 글에 민감한 내용이 들어가면 친구에게 보일 수 있어 비공개로 고를 수 있게 한다(개인정보 보호법 제23조 제3항) -->
          <div class="entry-v2__field">
            <span class="entry-v2__label">공개 범위</span>
            <div class="entry-v2__chips" id="visibilityChips" role="radiogroup" aria-label="공개 범위">
              ${[['friends', '친구 공개'], ['private', '나만 보기']].map(([v, l]) => {
                const on = (edit ? (edit.visibility || 'friends') : 'friends') === v;
                return `<button type="button" class="rec-chip${on ? ' is-on' : ''}" data-visibility="${v}" role="radio" aria-checked="${on}">${l}</button>`;
              }).join('')}
            </div>
            <p class="entry-v2__note">친구 공개 기록은 친구 목록에 있는 사람에게 보여요.<br>건강·종교·연애처럼 민감한 내용이 있으면 '나만 보기'로 남겨 주세요.</p>
          </div>

          <input type="hidden" name="date" value="${targetDate}">
          <button type="submit" class="entry-v2__submit" id="entrySubmit">${edit ? '수정 저장' : '기록 저장'}</button>
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
    // 기기의 지금 위치는 읽지 않는다 — 위치는 고른 사진의 촬영 위치에서만 온다(usePhotoPlace)

    if (initialFile) {
      // 메인 화면 카메라로 바로 찍은 사진도 하루 무료 한도에 똑같이 센다
      if (AppState.freePhotoUploadsLeft() <= 0) {
        openPaywall({ reason: 'photo' });
      } else {
        // 방금 찍은 사진의 위치는 곧 지금 있는 곳(실시간 위치)이라 쓰지 않는다 — 찍은 시각만 쓴다
        readPhotoMeta(initialFile)
          .then(m => addPendingPhoto(initialFile, { takenAt: m.takenAt, gps: null }))
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
  /*
   * 검색 결과를 고르지 않고 곡명만 적은 채 저장하면 그 글자가 버려지고 추천 노래만 붙었다(피드백).
   * 이제는 ① 결과 목록 맨 아래에 "적은 그대로 쓰기"가 늘 있고 ② 엔터를 치면 첫 결과를 고르며
   * ③ 아무것도 고르지 않고 저장해도 칸에 적힌 글자를 그대로 노래로 남긴다(typedNowPlaying).
   * "곡 - 가수"처럼 적으면 곡과 가수로 나눈다.
   */
  /** 고른(또는 적은) 노래 → 기록에 넣을 모양. 노래 엔진이 없어도 곡명은 잃지 않는다 */
  function songOf(np) {
    if (!np || !np.name) return null;
    const links = typeof SongEngine !== 'undefined' ? SongEngine.buildSongLinks(np.name, np.artist || '') : {};
    return Object.assign({ name: np.name, artist: np.artist || '', art: null }, links);
  }
  function typedSong(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const m = t.split(/\s+[-–·]\s+/);
    return m.length >= 2 ? { name: m[0].trim(), artist: m.slice(1).join(' ').trim() } : { name: t, artist: '' };
  }
  function typedNowPlaying(scrim) {
    const input = scrim && scrim.querySelector('#nowPlayingInput');
    return input ? typedSong(input.value) : null;
  }
  function renderNowPlayingPicker(scrim) {
    const mount = scrim.querySelector('#nowPlayingPicker');
    if (!mount) return;

    if (pendingNowPlaying) {
      mount.innerHTML = `
        <div class="diary-nowplaying-chip">
          <span>🎧 ${esc(pendingNowPlaying.name)}${pendingNowPlaying.artist ? ` · ${esc(pendingNowPlaying.artist)}` : ''}</span>
          <button type="button" id="nowPlayingClear" aria-label="지우기">✕</button>
        </div>`;
      mount.querySelector('#nowPlayingClear').addEventListener('click', () => {
        pendingNowPlaying = null;
        renderNowPlayingPicker(scrim);
        const again = scrim.querySelector('#nowPlayingInput');
        if (again) again.focus();
      });
      return;
    }

    mount.innerHTML = `
      <div class="diary-nowplaying-search">
        <input type="text" id="nowPlayingInput" placeholder="곡 제목이나 가수를 검색해보세요" autocomplete="off" enterkeyhint="search">
        <ul class="diary-nowplaying-results" id="nowPlayingResults" hidden></ul>
      </div>`;
    const input = mount.querySelector('#nowPlayingInput');
    const list = mount.querySelector('#nowPlayingResults');
    let matches = [];
    let seq = 0;   // 늦게 도착한 옛 검색 결과가 새 결과를 덮지 않게
    const pick = (song) => { if (!song) return; pendingNowPlaying = song; renderNowPlayingPicker(scrim); };
    const draw = (q, state) => {
      const raw = typedSong(q);
      const rows = matches.map((m, i) => `<li data-idx="${i}">${esc(m.name)} <span>· ${esc(m.artist)}</span></li>`).join('');
      const note = state === 'loading' ? '<li class="is-note" aria-disabled="true">찾는 중…</li>'
        : state === 'empty' ? '<li class="is-note" aria-disabled="true">검색 결과가 없어요</li>' : '';
      list.innerHTML = rows + note + (raw ? `<li data-raw class="is-raw">“${esc(q.trim())}” 적은 그대로 쓰기</li>` : '');
      list.hidden = !list.innerHTML;
    };
    list.addEventListener('click', (ev) => {
      const li = ev.target.closest('li');
      if (!li || li.classList.contains('is-note')) return;
      if (li.hasAttribute('data-raw')) pick(typedSong(input.value));
      else pick(matches[Number(li.dataset.idx)]);
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' || ev.isComposing) return;
      ev.preventDefault();   // 엔터로 기록 전체가 저장되지 않게
      pick(matches[0] || typedSong(input.value));
    });
    input.addEventListener('input', () => {
      clearTimeout(nowPlayingSearchTimer);
      const q = input.value;
      matches = [];
      if (q.trim().length < 2 || typeof SongEngine === 'undefined') { draw(q, ''); return; }
      draw(q, 'loading');
      const my = ++seq;
      // 글자마다 쏘면 Last.fm rate limit에 걸린다 — 멈춘 뒤에 한 번만.
      nowPlayingSearchTimer = setTimeout(async () => {
        const found = await SongEngine.searchTracks(q);
        if (my !== seq || !input.isConnected) return;
        matches = found;
        draw(q, found.length ? '' : 'empty');
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
        usePhotoPlace();   // 대표 사진이 바뀌었으니 위치도 그 사진 기준으로 다시
      });
      const flipBtn = stack.querySelector('.diary-photo-stack__flip');
      if (flipBtn) flipBtn.addEventListener('click', () => {
        pendingPhotos.push(pendingPhotos.shift());
        renderPhotoPicker(scrim);
        usePhotoPlace();
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

  /*
   * 위치 = 대표(맨 앞) 사진의 촬영 위치. 그 사진에 위치가 없으면 비워 둔다 — 다른 사진의 위치나
   * 기기의 지금 위치로 채우지 않는다(실시간 위치는 받지 않는다). ⟳로 대표 사진이 바뀌면 다시 정한다.
   * 도시는 기기 안에서 찾고(NearestCity — 사진 좌표는 밖으로 안 나간다), 날씨는 그 도시 중심 좌표와
   * 찍은 날짜로 조회한다. 위치정보 이용 동의를 받은 뒤에만 하고, 기록에는 도시·국가만 남긴다(stripCoords).
   * 기록 날짜도 사진을 찍은 날로 맞춘다(새 기록일 때만).
   */
  let photoPlaceKey = '';   // 지금 위치·날씨를 가져온 사진(같은 사진으로 두 번 묻지 않게)
  function setLocationNote(text) {
    const note = document.getElementById('locationNote');
    if (note) { note.textContent = text || ''; note.hidden = !text; }
  }
  function clearPhotoPlace() {
    photoPlaceKey = '';
    pendingLocation = null;
    pendingWeather = null;
    setLocationNote('');
  }
  function usePhotoPlace() {
    if (editingEntry) return;
    const first = pendingPhotos.find(p => p.takenAt) || null;
    // 기록 날짜 = 사진 찍은 날
    if (first && first.takenAt) {
      const d = toIso(first.takenAt);
      const form = document.getElementById('entryForm');
      const dateInput = form && form.querySelector('[name=date]');
      if (dateInput && dateInput.value !== d) {
        dateInput.value = d;
        const eb = document.querySelector('#entryModalScrim .entry-v2__eyebrow');
        if (eb) eb.textContent = `${d} · 사진 찍은 날`;
      }
    }
    const front = pendingPhotos[0] || null;
    if (!front || !front.gps) { clearPhotoPlace(); return; }
    if (photoPlaceKey === front.path) return;
    const consent = AppState.locationConsent();
    if (consent === 'no') { clearPhotoPlace(); return; }
    if (consent !== 'yes') {
      askLocationConsent().then(ok => {
        AppState.setLocationConsent(ok ? 'yes' : 'no');
        if (ok) usePhotoPlace();
      });
      return;
    }
    photoPlaceKey = front.path;
    const key = front.path;
    const { lat, lng } = front.gps;
    const when = front.takenAt || null;
    setLocationNote('📍 사진 찍은 곳을 찾는 중…');
    pendingLocation = null;
    pendingWeather = null;
    // 도시는 기기 안에서 찾는다(js/nearest-city.js) — 사진 좌표는 밖으로 보내지 않는다
    placeJob(NearestCity.find(lat, lng)
      .then(place => {
        if (photoPlaceKey !== key) return;
        // 날씨는 사진 좌표가 아니라 찾은 도시의 중심 좌표로, 찍은 날을 알 때만 조회한다 —
        // 날짜를 모르는데 지금 날씨를 붙이면 찍을 때 날씨처럼 보인다
        const sendWeather = !!(place && when && typeof SongEngine !== 'undefined' && SongEngine.fetchWeatherAt);
        // 이용사실 확인자료 — 좌표는 남기지 않고 목적과 보낸 곳만(위치정보법 제16조 제2항)
        AppState.logLocationUse('journal_photo_place_weather', sendWeather ? ['Open-Meteo'] : []);
        if (!place) { setLocationNote('📍 사진 찍은 곳 근처에서 도시를 찾지 못했어요'); return; }
        // 도시·국가만 남긴다 — 좌표는 저장하지 않는다(stripCoords)
        pendingLocation = { country: place.country, city: place.city, countryCode: place.countryCode };
        showPlaceNote();
        if (sendWeather) {
          // 저장이 날씨도 기다리도록 같은 작업으로 돌려준다
          return SongEngine.fetchWeatherAt(place.lat, place.lng, when)
            .then(w => { if (photoPlaceKey === key) { pendingWeather = w; showPlaceNote(); } })
            .catch(() => {});
        }
      })
      .catch(() => { if (photoPlaceKey === key) setLocationNote('📍 사진 찍은 곳의 도시를 찾지 못했어요'); }));
  }
  function showPlaceNote() {
    const place = pendingLocation ? [pendingLocation.city, pendingLocation.country].filter(Boolean).join(', ') : '';
    let w = '';
    if (pendingWeather && typeof SongEngine !== 'undefined') {
      const lb = SongEngine.weatherLabel(pendingWeather.code);
      if (lb) w = ` · ${lb.emoji} ${lb.ko}${typeof pendingWeather.temp === 'number' ? ` ${Math.round(pendingWeather.temp)}°` : ''}`;
    }
    const front = pendingPhotos[0];
    const t = front && front.takenAt ? ` · ${String(front.takenAt.getHours()).padStart(2, '0')}:${String(front.takenAt.getMinutes()).padStart(2, '0')}` : '';
    if (place || w) setLocationNote(`📍 ${place || '사진 찍은 곳'}${t}${w} — 사진 기준`);
  }

  /*
   * 노래 추천은 나라(countryCode) 하나만 있으면 돌아간다. 사진에 위치가 없어 기록의 위치가 비어 있어도
   * 추천이 끊기지 않게, 확정한 학교의 나라를 추천에만 쓴다 — 기록에 위치로 저장하지는 않는다.
   * country-flags.js의 COUNTRY_ISO2(영문 국가명 → ISO 코드)를 그대로 재사용한다.
   */
  function schoolCountryCode() {
    const school = typeof AppState !== 'undefined' ? AppState.getConfirmedSchool() : null;
    if (!school || typeof COUNTRY_ISO2 === 'undefined' || !school.countryEn) return null;
    return COUNTRY_ISO2[school.countryEn] || null;
  }

  /**
   * 개인위치정보 이용 동의(선택) — 사진의 촬영 위치를 처음 쓰려 할 때 한 번 묻는다. 기록 쓰기 창 위에 한 장 더 뜬다.
   * 동의하지 않아도 기록은 그대로 저장되고, 위치 없이 남는다. 기기의 지금 위치는 동의와 상관없이 읽지 않는다.
   */
  let consentAsking = null;   // 사진을 여러 장 올려 동시에 물어도 창을 하나만 띄운다
  function askLocationConsent() {
    if (consentAsking) return consentAsking;
    consentAsking = new Promise((resolve) => {
      const box = document.createElement('div');
      box.className = 'loc-consent';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', '위치정보 이용 동의');
      box.innerHTML = `
        <div class="loc-consent__panel">
          <p class="loc-consent__title">위치정보 이용 동의 <span>(선택)</span></p>
          <p class="loc-consent__lead">기록에 도시와 날씨를 붙이려고 사진에 담긴 촬영 위치를 확인해요. 지금 계신 곳은 확인하지 않아요.</p>
          <ul class="loc-consent__list">
            <li>위치(위도·경도)는 휴대폰 안에서 가까운 도시를 찾는 데만 쓰고, 밖으로 보내거나 저장하지 않아요</li>
            <li>날씨는 찾은 도시의 중심 좌표와 사진 찍은 날짜로 Open-Meteo에서 조회해요</li>
            <li>기록에는 도시·국가만 저장돼요</li>
            <li>동의하지 않아도 기록은 저장되고, 위치 없이 남아요</li>
            <li>계정 메뉴에서 언제든 동의를 철회할 수 있어요</li>
          </ul>
          <a class="loc-consent__link" href="terms.html#ch9" target="_blank" rel="noopener">이용약관 9장(위치기반서비스) 보기</a>
          <div class="loc-consent__actions">
            <button type="button" class="loc-consent__btn" data-loc="no">동의 안 함</button>
            <button type="button" class="loc-consent__btn loc-consent__btn--yes" data-loc="yes">동의하고 계속</button>
          </div>
        </div>`;
      document.body.appendChild(box);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-loc]');
        if (!b) return;
        box.remove();
        consentAsking = null;
        resolve(b.dataset.loc === 'yes');
      });
    });
    return consentAsking;
  }

  /** 기록에는 도시·국가·국가 코드만 저장한다. 정밀 좌표는 친구 공개 때 위치가 새는 길이라 남기지 않는다. */
  function stripCoords(loc) {
    return loc ? { country: loc.country || null, city: cityEn(loc.city), countryCode: loc.countryCode || null } : null;
  }

  function wireEntryForm(scrim) {
    const visBox = scrim.querySelector('#visibilityChips');
    if (visBox) visBox.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-visibility]');
      if (!b) return;
      visBox.querySelectorAll('[data-visibility]').forEach(x => {
        const on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-checked', String(on));
      });
    });
    // 폴더는 여러 개 고를 수 있다 — 같은 칩을 다시 누르면 해제
    const chipBox = scrim.querySelector('#folderChips');
    // + → 그 자리에 이름 칸이 열리고, 엔터(또는 칸 밖을 누르면) 폴더를 만들어 바로 고른다
    chipBox.addEventListener('click', (e) => {
      const add = e.target.closest('[data-folder-new]');
      if (!add || typeof DiaryArchive === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'rec-chip entry-v2__chip-input';
      input.placeholder = '폴더 이름';
      input.maxLength = 20;
      add.replaceWith(input);
      input.focus();
      let done = false;
      const finish = (keep) => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        if (keep && name) {
          const f = DiaryArchive.addFolder(name);
          pendingFolders.add(f.id);
        }
        chipBox.innerHTML = folderChipsHtml();
        const on = chipBox.querySelector('.is-on');
        if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      };
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
    });
    chipBox.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-folder-pick]');
      if (!chip) return;
      const id = chip.dataset.folderPick;
      if (pendingFolders.has(id)) pendingFolders.delete(id); else pendingFolders.add(id);
      const on = pendingFolders.has(id);
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
    });

    ['#photoInput'].forEach((sel) => {
      const input = scrim.querySelector(sel);
      input.closest('label').addEventListener('click', (e) => {
        // 한도를 다 썼으면 사진 고르는 창 대신 결제창을 연다 — 고른 뒤에 막히면 헛수고라서
        if (AppState.freePhotoUploadsLeft() <= 0) {
          e.preventDefault();
          openPaywall({ reason: 'photo' });
          return;
        }
        // 앱에서는 웹 사진 창 대신 네이티브 창으로 고른다(촬영 위치를 읽으려고 — nativePhotoPicker 참고)
        const picker = nativePhotoPicker();
        if (!picker) return;
        e.preventDefault();
        pickPhotosNative(picker, scrim);
      });
      input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        input.value = '';
        // 웹(브라우저)에서는 파일 안의 EXIF에서 찍은 시각·위치를 읽는다
        const stamped = await Promise.all(files.map(async (f) => ({ f, m: await readPhotoMeta(f) })));
        await addPickedPhotos(scrim, stamped);
      });
    });

    scrim.querySelector('#entryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      // 사진 찍은 곳·지금 있는 곳을 아직 찾는 중이면 끝날 때까지(최대 5초) 기다렸다 저장한다 — 안 그러면 위치·날씨 없이 저장된다
      if (!editingEntry && !e.target._saving && !e.target._waitingPlace && placeJobs.length && (!pendingLocation || !pendingWeather)) {
        e.target._waitingPlace = true;
        const btn = e.target.querySelector('#entrySubmit');
        const label = btn && btn.textContent;
        if (btn) { btn.disabled = true; btn.textContent = '위치 확인 중…'; }
        await Promise.race([Promise.all(placeJobs), new Promise(r => setTimeout(r, 5000))]);
        e.target._waitingPlace = false;
        if (btn) { btn.disabled = false; btn.textContent = label; }
      } else if (e.target._waitingPlace) return;
      // 저장 버튼을 빠르게 두 번 누르면(휴대폰에서 키보드가 닫히며 한 번 더 눌리는 경우 포함) 기록이 두 번
      // 저장되고 우표도 두 번 찍혔다 — 한 번 저장을 시작하면 이 창에서는 다시 받지 않는다
      if (e.target._saving) return;
      const fd = new FormData(e.target);
      const date = fd.get('date');
      // 태그 고르기는 창에서 뺐다 — 수정이면 원래 값을 그대로 두고, 새 기록은 태그 없이
      const tags = editingEntry ? (editingEntry.tags || []).filter(t => EVERYDAY_MAP[t]) : [];
      const title = (fd.get('title') || '').trim();
      const body = (fd.get('caption') || '').trim();
      const visBtn = scrim.querySelector('#visibilityChips .is-on');
      const visibility = visBtn ? visBtn.dataset.visibility : (editingEntry ? (editingEntry.visibility || 'friends') : 'friends');
      // 고른 폴더에 담고, 수정 중에 고르기를 푼 폴더에서는 뺀다
      const putInFolder = (id) => {
        if (typeof DiaryArchive === 'undefined') return;
        let removed = false;
        entryFolders().forEach(f => {
          const list = f.entryIds || (f.entryIds = []);
          const i = list.indexOf(id);
          if (!pendingFolders.has(f.id) && i >= 0) { list.splice(i, 1); removed = true; }
        });
        pendingFolders.forEach(fid => {
          const hit = DiaryArchive.findNode(fid);
          if (hit) DiaryArchive.addEntries(hit.node, [id]);
        });
        if (removed) DiaryArchive.save();
      };
      if (!pendingPhotos.length && !title && !body) { showToast('사진 또는 글 중 하나는 있어야 해요'); return; }
      e.target._saving = true;
      const submitBtn = e.target.querySelector('#entrySubmit');
      if (submitBtn) submitBtn.disabled = true;

      // 검색 결과를 고르지 않고 곡명만 적어 둔 경우 — 적은 그대로 노래로 남긴다
      if (!pendingNowPlaying) pendingNowPlaying = typedNowPlaying(scrim);

      // 수정 — 위치·날씨·오늘의 노래는 그대로 두고 글·태그·사진·그때 듣던 노래만 바꾼다
      if (editingEntry) {
        const target = editingEntry;
        const keepNP = pendingNowPlaying && target.nowPlaying
          && pendingNowPlaying.name === target.nowPlaying.name && pendingNowPlaying.artist === target.nowPlaying.artist;
        const nextNP = keepNP ? target.nowPlaying : songOf(pendingNowPlaying);
        AppState.updateJournalEntry(target.id, {
          title, body,
          photos: pendingPhotos.map(p => p.path),
          tags: [...tags, ...editKeepTags.filter(t => !tags.includes(t))],
          nowPlaying: nextNP,
          visibility
        });
        putInFolder(target.id);
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

      const nowPlaying = songOf(pendingNowPlaying);

      // 기록 시각은 가장 먼저 찍은 사진의 시각 — 그래야 같은 날 사진이 찍은 순서로 놓인다(모르면 지금)
      const taken = pendingPhotos.map(p => p.takenAt).filter(Boolean).map(Number);
      const takenAt = taken.length ? new Date(Math.min(...taken)) : null;
      const entry = AppState.addJournalEntry({
        date, phase: departurePhaseFor(date), title, body,
        photos: pendingPhotos.map(p => p.path),
        tags, location: stripCoords(pendingLocation), takenAt,
        nowPlaying, weather: pendingWeather, visibility
      });
      if (entry) putInFolder(entry.id);
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
    // 나라 — 사진 위치에서 온 것, 없으면 확정한 학교의 나라(추천에만 쓰고 기록에는 저장하지 않는다)
    const countryCode = (pendingLocation && pendingLocation.countryCode) || schoolCountryCode();
    if (!entry || !countryCode) return;
    if (entry.nowPlaying) return;   // 직접 고른 노래가 있으면 추천하지 않는다
    try {
      const { mood, moodKo, keywords } = SongEngine.computeMood({
        tags,
        weatherCode: pendingWeather ? pendingWeather.code : undefined,
        tempC: pendingWeather ? pendingWeather.temp : undefined,
        date: new Date(entry.createdAt)
      });
      const song = await SongEngine.fetchSongRecommendation({
        countryCode, keywords
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
      <span class="song-popup__mood">🎵 steppY 추천 노래</span>
      <span class="song-popup__why">지금 날씨와 위치에 어울리는 곡을 골랐어요</span>
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
          <p class="diary-modal-header__note">문장을 새로 지어내지 않아요.<br>적어둔 글을 항목별·날짜순으로 모아 보여드려요.</p>
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
    wireFriends();
    root.querySelector('#openWrapup').addEventListener('click', openWrapupModal);
  }

  /** 친구 관리(코드로 추가·요청 수락·차단)로 들어가는 버튼. 받은 요청이 있으면 숫자 배지가 붙는다. */
  function wireFriends() {
    root.querySelector('#archiveFriendsManage').addEventListener('click', () => {
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

  /* --------------------------------------------------------------- 첫 화면(시안: 기록하기/첫 화면) */

  /** 제목 — 파견 중이면 Day N, 출국 전이면 D-N, 귀국 후에는 지낸 날 수 */
  function renderDayTitle() {
    const el = root.querySelector('#recDayTitle');
    if (!el) return;
    const info = departureInfo();
    if (!info.hasRange) el.textContent = 'Today';
    else if (info.phase === DEPARTURE_PHASES.BEFORE) el.textContent = `D-${info.daysUntil}`;
    else if (info.phase === DEPARTURE_PHASES.AFTER) el.textContent = `${info.totalDays} Days`;
    else el.textContent = `Day ${info.dayNum}`;
  }

  /** 오늘 찍은 사진(없으면 가장 최근 사진)을 크게. 누르면 확대 화면 */
  function heroEntry() {
    const withPhoto = entries().filter(e => (e.photos || []).length);
    const today = withPhoto.filter(e => e.date === todayIso);
    const pick = (today.length ? today : withPhoto).slice(-1)[0] || null;
    return pick ? { entry: pick, isToday: pick.date === todayIso } : null;
  }
  const shortDate = (iso) => `${iso.slice(2, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)}.`;
  function placeText(e) {
    const loc = typeof placeEn === 'function' ? placeEn(e.location) : (e.location || {});
    return [loc.city, loc.country].filter(Boolean).join(' · ');
  }
  function renderHomeHero() {
    const slot = root.querySelector('#recHero');
    if (!slot) return;
    const hit = heroEntry();
    const url = hit && (hit.entry.photos || []).map(photoUrl).find(Boolean);
    if (!hit || !url) {
      const loading = hit && photosLoading(hit.entry);
      slot.className = 'rec-hero rec-hero--empty' + (loading ? ' is-loading' : '');
      slot.innerHTML = loading ? '' : `
        <div class="rec-hero__empty">
          <p class="rec-hero__empty-title">오늘의 첫 사진을 남겨 보세요</p>
          <button type="button" class="rec-hero__cta" data-hero-write><span aria-hidden="true">+</span>사진 추가</button>
        </div>`;
      return;
    }
    // 날짜마다 한 장(왼쪽이 과거) — 같은 날 사진은 옆으로 늘어놓지 않고 카드처럼 겹쳐 쌓는다.
    // 오른쪽 아래 +를 누르면 맨 위 사진이 맨 뒤로 가고 다음 사진이 올라온다(예전 기록하기의 사진 더미).
    // 처음에는 가장 최근 날이 가운데에 온다.
    heroShots = allShots();
    const days = [];
    heroShots.forEach((x, i) => {
      const last = days[days.length - 1];
      if (last && last.date === x.entry.date) last.items.push(i);
      else days.push({ date: x.entry.date, items: [i] });
    });
    slot.className = 'rec-hero rec-hero--reel';
    slot.innerHTML = `
      <div class="rec-hero__track" id="recHeroTrack">
        ${days.map((d, di) => {
          const latest = di === days.length - 1;
          const isToday = d.date === todayIso;
          const n = d.items.length;
          const first = heroShots[d.items[0]].entry;
          const place = placeText(first);
          return `<div class="rec-hero__slide${latest ? ' is-latest' : ''}" data-day="${di}">
            <div class="rec-hero__stack${n > 1 ? ' is-stack' : ''}" data-n="${n}">
              ${d.items.map((i, k) => {
                const x = heroShots[i];
                const pl = placeText(x.entry);
                // 가장 최근 날만 큰 글씨(위치 칩 · Today's Memories · 날짜). 사진마다 자기 위치를 단다
                return `<button type="button" class="rec-hero__btn rec-hero__card${k ? '' : ' is-top'}" data-hero-open="${i}" style="--pos:${k}" aria-label="${esc(shortDate(x.entry.date))} 사진 크게 보기${n > 1 ? ` (${k + 1}/${n})` : ''}"${k ? ' tabindex="-1"' : ''}>
                  <img class="rec-hero__img" src="${esc(x.url)}" alt="${esc(x.entry.title || '')}" draggable="false" loading="${di >= days.length - 3 ? 'eager' : 'lazy'}">
                  ${latest ? `${pl ? `<span class="rec-hero__place">📍 ${esc(pl)}</span>` : ''}
                  <span class="rec-hero__label">${isToday ? 'Today’s Memories' : 'Latest Memories'}</span>
                  <span class="rec-hero__date">${shortDate(x.entry.date)}</span>` : ''}
                </button>`;
              }).join('')}
              ${n > 1 ? `<span class="rec-hero__count" aria-hidden="true">1 / ${n}</span>` : ''}
            </div>
            ${latest ? '' : `<p class="rec-hero__cap">${shortDate(d.date)}${place ? ` · ${esc(place)}` : ''}${n > 1 ? ` · ${n}장` : ''}</p>`}
          </div>`;
        }).join('')}
      </div>`;
    // 세로로 긴 사진은 4:5까지만 보여주고 위아래를 자른다(누르면 원본 전체) — 줄이 지나치게 길어지지 않게.
    // 가로 사진은 원래 비율 그대로.
    const heroRatio = (img) => (img.naturalHeight / img.naturalWidth > 5 / 4 ? '4 / 5' : `${img.naturalWidth} / ${img.naturalHeight}`);
    // 더미는 맨 위 사진의 비율로 틀을 정한다 — 나머지 사진은 그 틀을 채운다(진짜 카드 더미처럼)
    slot.querySelectorAll('.rec-hero__stack').forEach(st => {
      const img = st.querySelector('.rec-hero__card img');
      const stacked = st.classList.contains('is-stack');
      const set = () => {
        if (!img.naturalWidth) return;
        if (stacked) st.style.setProperty('--ratio', heroRatio(img));
        else img.style.aspectRatio = heroRatio(img);
      };
      if (img.complete) set(); else img.addEventListener('load', set, { once: true });
    });
    const track = slot.querySelector('#recHeroTrack');
    // 줄 높이는 넘기는 도중이 아니라 멈춘 뒤에만 바꾼다 — 넘기는 중에 가운데 사진이 바뀔 때마다
    // 높이가 오르내리면 아래 화면 전체가 같이 출렁였다
    const slides = [...track.querySelectorAll('.rec-hero__slide')];
    // 사진 칸의 가운데 자리는 스크롤해도 변하지 않는다 — 매 프레임 재지 않고 한 번 재 둔다(크기가 바뀔 때만 다시)
    let centers = [], slideW = 1;
    const measure = () => {
      slideW = (slides[0] && slides[0].offsetWidth) || 1;
      centers = slides.map(sl => sl.offsetLeft - track.offsetLeft + sl.offsetWidth / 2);
    };
    const fitHeight = (best) => { if (best && best.offsetHeight) track.style.height = `${best.offsetHeight}px`; };
    const mark = (settled = true) => {
      if (!centers.length) measure();
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = null, bd = Infinity;
      slides.forEach((sl, i) => {
        const d = Math.abs(centers[i] - mid);
        if (d < bd) { bd = d; best = sl; }
        // 손가락을 따라 이어서 밝아지고 커진다 — 가운데를 넘는 순간 확 바뀌지 않게(transform·opacity 만 써서 버벅이지 않는다)
        const t = Math.max(0, 1 - d / slideW);
        sl.style.opacity = (0.4 + 0.6 * t).toFixed(3);
        sl.style.transform = t >= 0.999 ? 'none' : `scale(${(0.94 + 0.06 * t).toFixed(4)})`;
      });
      slides.forEach(sl => { const on = sl === best; if (sl.classList.contains('is-active') !== on) sl.classList.toggle('is-active', on); });
      // 가운데 사진 높이만큼만 차지한다 — 긴 사진일 때만 길어지고 가로 사진이면 줄어든다
      if (settled) fitHeight(best);
    };
    // 사진이 늦게 뜨면 높이가 바뀌므로 그때 다시 잰다
    track.querySelectorAll('.rec-hero__img').forEach(img => { if (!img.complete) img.addEventListener('load', () => mark(), { once: true }); });
    // 다시 그릴 때마다 붙으면 쌓이므로 하나만 남긴다
    if (renderHomeHero.onResize) window.removeEventListener('resize', renderHomeHero.onResize);
    renderHomeHero.onResize = () => { if (track.isConnected) { measure(); go(cur, true); } };
    window.addEventListener('resize', renderHomeHero.onResize);
    // 손가락을 따라 흐르는 스크롤은 빨리 쓸면 사진이 깨져 보였다 — 한 번 쓸면 한 장씩, 정해진 속도로 천천히 넘긴다
    let cur = 0, anim = 0, swiped = false;
    const leftOf = (i) => slides[i].offsetLeft - track.offsetLeft - (track.clientWidth - slides[i].offsetWidth) / 2;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const go = (i, instant) => {
      if (!slides.length) return;
      cur = Math.max(0, Math.min(slides.length - 1, i));
      cancelAnimationFrame(anim);
      const from = track.scrollLeft, to = leftOf(cur);
      if (instant || Math.abs(to - from) < 1) { track.scrollLeft = to; mark(true); return; }
      const DUR = 520, t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / DUR);
        track.scrollLeft = from + (to - from) * ease(t);
        mark(t >= 1);
        if (t < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    };
    track._go = (slide) => go(slides.indexOf(slide));
    let sx = 0, sy = 0, down = false;
    track.addEventListener('pointerdown', (ev) => { down = true; swiped = false; sx = ev.clientX; sy = ev.clientY; });
    const finish = (ev) => {
      if (!down) return;
      down = false;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) { swiped = true; go(cur + (dx < 0 ? 1 : -1)); }
    };
    track.addEventListener('pointerup', finish);
    track.addEventListener('pointercancel', finish);
    // 쓸어 넘긴 뒤 따라오는 click 은 사진 열기로 치지 않는다
    track.addEventListener('click', (ev) => { if (swiped) { ev.stopPropagation(); ev.preventDefault(); swiped = false; } }, true);
    // 가장 최근(맨 오른쪽)에서 시작 — 자리가 다 잡힌 뒤에(바로 하면 폭이 0이라 안 먹는다)
    const toLatest = () => { measure(); go(slides.length - 1, true); };
    requestAnimationFrame(toLatest);
    setTimeout(toLatest, 120);
  }

  /** 하루 사진 더미 — 누르면 맨 위 사진을 맨 뒤로 보내고 다음 사진을 올린다(끝까지 넘기면 처음으로) */
  function flipHeroStack(st) {
    if (!st || st._busy) return;
    const cards = [...st.querySelectorAll('.rec-hero__card')].sort((a, b) => a.style.getPropertyValue('--pos') - b.style.getPropertyValue('--pos'));
    const n = cards.length;
    if (n < 2) return;
    st._busy = true;
    const top = cards[0];
    top.classList.add('is-leaving');
    setTimeout(() => {
      top.classList.remove('is-leaving');
      cards.forEach((c, k) => {
        const pos = k === 0 ? n - 1 : k - 1;
        c.style.setProperty('--pos', pos);
        c.tabIndex = pos ? -1 : 0;
        c.classList.toggle('is-top', !pos);
      });
      const topIdx = ((Number(st.dataset.top) || 0) + 1) % n;   // 지금 맨 위가 원래 몇 번째 사진인지
      st.dataset.top = String(topIdx);
      const count = st.querySelector('.rec-hero__count');
      if (count) count.textContent = `${topIdx + 1} / ${n}`;
      st._busy = false;
    }, 260);
  }

  /** 사진이 있는 기록의 사진 전부 — 날짜·찍은 시각 순(과거 → 최근) */
  let heroShots = [];
  function allShots() {
    const out = [];
    entries().forEach(e => (e.photos || []).forEach(p => { const u = photoUrl(p); if (u) out.push({ url: u, entry: e }); }));
    return out;
  }

  /** 최근에 사진이 담긴 순서로 폴더 넷 */
  function recentFolders() {
    if (typeof DiaryArchive === 'undefined' || !DiaryArchive.folders) return [];
    const list = DiaryArchive.folders().slice();
    const latest = (f) => DiaryArchive.entriesOfNode(f).reduce((m, e) => (e.date > m ? e.date : m), '');
    return list.map((f, i) => ({ f, i, d: latest(f) }))
      .sort((a, b) => b.d.localeCompare(a.d) || a.i - b.i)
      .slice(0, 4).map(x => x.f);
  }
  function renderRecent() {
    const row = root.querySelector('#recRecent');
    if (!row) return;
    row.innerHTML = recentFolders().map(f => `
      <button type="button" class="rec-folder" data-folder="${esc(f.id)}" aria-label="${esc(f.name)} 폴더 열기">
        ${DiaryArchive.folderIcon(f, 'rh-' + f.id)}
        <span class="rec-folder__name">${esc(f.name)}</span>
        <span class="rec-folder__meta">${f.type === 'monthly' ? '자동' : DiaryArchive.itemsOf(f).length + '장'}</span>
      </button>`).join('') + (recentFolders().length < 4 ? `
      <button type="button" class="rec-folder rec-folder--new" data-folder-new aria-label="새 폴더 만들기">
        <span class="rec-folder__plus" aria-hidden="true">+</span>
        <span class="rec-folder__name">새 폴더</span>
        <span class="rec-folder__meta">이름·색 정하기</span>
      </button>` : '');
  }
  function renderRecapCard() {
    const slot = root && root.querySelector('#recRecapSlot');
    if (!slot || typeof RecordV2 === 'undefined' || !RecordV2.recapCardHtml) return;
    slot.innerHTML = RecordV2.recapCardHtml(recordCtx());
  }

  /** Diary 줄 — 꾸민 하루 다이어리를 최근 날짜부터 작은 페이지로 */
  function renderDiaryRow() {
    const row = root && root.querySelector('#recDiaryRow');
    if (!row || typeof RecordV2 === 'undefined' || !RecordV2.listDiaries) return;
    const list = RecordV2.listDiaries();
    if (!list.length) {
      row.innerHTML = `<button type="button" class="rec-diary__empty" data-diary-new>
        <b>인상 깊었던 하루나 여행을 한 장의 다이어리로</b>
        <span>사진·글·스티커를 붙이고 노래도 넣어요.<br>다이어리를 열면 노래와 함께 다시 볼 수 있어요.</span>
      </button>`;
      return;
    }
    row.innerHTML = list.map(d => `
      <button type="button" class="rec-diary__item" data-diary="${esc(d.key)}" aria-label="${esc(d.meta.title || RecordV2.rangeLabel(d.meta))} 다이어리 열기">
        <span class="rec-diary__thumb">${RecordV2.diaryThumbHtml(recordCtx(), d)}</span>
        ${d.meta.title ? `<span class="rec-diary__title">${esc(d.meta.title)}</span>` : ''}
        <span class="rec-diary__date">${RecordV2.rangeLabel(d.meta)}${d.page.song ? ' ♪' : ''}</span>
      </button>`).join('');
  }

  function recordCtx() {
    return { entries: () => entries(), photoUrl: (p) => photoUrl(p), needLogin: () => needLogin(), write: () => openEntryModal() };
  }

  function wireHome() {
    root.querySelector('#recHeadAdd').addEventListener('click', () => { if (!needLogin()) openEntryModal(); });
    const newDiary = () => { if (!needLogin()) RecordV2.createDiary(recordCtx(), todayIso, renderDiaryRow); };
    root.querySelector('#recDiaryNew').addEventListener('click', newDiary);
    root.querySelector('#recDiaryRow').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-diary-new]')) { newDiary(); return; }
      const b = ev.target.closest('[data-diary]');
      if (b) RecordV2.openDiary(recordCtx(), b.dataset.diary, renderDiaryRow);
    });
    root.querySelector('#recStreak').addEventListener('click', (ev) => { if (ev.target.closest('#recCalOpen')) RecordV2.openCalendar(recordCtx()); });
    root.querySelector('#recCalClose').addEventListener('click', closeCalPage);
    root.querySelector('#recOpenStorage').addEventListener('click', () => RecordV2.openStorage(recordCtx()));
    root.querySelector('#recRecapSlot').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-recap]');
      if (b) RecordV2.openRecap(recordCtx(), b.dataset.recap);
    });
    root.querySelector('#recRecent').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-folder-new]')) { if (!needLogin()) DiaryArchive.createFolder(); return; }
      const b = ev.target.closest('[data-folder]');
      if (!b) return;
      const hit = DiaryArchive.findNode(b.dataset.folder);
      if (hit) RecordV2.openFolder(recordCtx(), hit.node);
    });
    root.querySelector('#recHero').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-hero-write]')) { if (!needLogin()) openEntryModal(); return; }
      const btn = ev.target.closest('[data-hero-open]');
      if (!btn) return;
      const start = Number(btn.dataset.heroOpen) || 0;
      // 쓸어 넘긴 사진이 옆에 있을 때 누르면 먼저 그 사진을 가운데로
      const slide = btn.closest('.rec-hero__slide');
      if (slide && !slide.classList.contains('is-active')) {
        const track = slide.parentElement;
        if (track._go) track._go(slide);
        return;
      }
      // 여러 장 겹친 날은 누르면 다음 사진이 앞으로 온다. 크게 보기는 길게 누르기(아래 pointerdown)
      const stack = btn.closest('.rec-hero__stack.is-stack');
      if (stack) { if (heroLongPressed) { heroLongPressed = false; return; } flipHeroStack(stack); return; }
      openHeroLightbox(start);
    });
    // 겹친 사진을 길게 누르면 확대 화면
    let heroLongPressed = false, heroPressTimer = 0;
    root.querySelector('#recHero').addEventListener('pointerdown', (ev) => {
      heroLongPressed = false;
      const btn = ev.target.closest('.rec-hero__slide.is-active .is-stack [data-hero-open]');
      clearTimeout(heroPressTimer);
      if (!btn) return;
      const x0 = ev.clientX, y0 = ev.clientY;
      const cancel = (e) => { if (!e || e.type !== 'pointermove' || Math.hypot(e.clientX - x0, e.clientY - y0) > 10) { clearTimeout(heroPressTimer); off(); } };
      const off = () => ['pointermove', 'pointerup', 'pointercancel'].forEach(t => window.removeEventListener(t, cancel));
      ['pointermove', 'pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, cancel));
      heroPressTimer = setTimeout(() => { off(); heroLongPressed = true; openHeroLightbox(Number(btn.dataset.heroOpen) || 0); }, 480);
    });
    function openHeroLightbox(start) {
      // 확대 화면도 같은 줄(시간순 전체)로 — 양옆 사진이 비치고 넘겨 볼 수 있다
      const imgs = [...root.querySelectorAll('#recHeroTrack .rec-hero__img')];
      const shots = heroShots.map(x => ({ url: x.url, info: DiaryArchive.infoOf(x.entry) }));
      if (!shots.length || !imgs[start]) return;
      DiaryArchive.openPhotos(shots, start, imgs);
    }
    if (!wireHome._doc) {
      wireHome._doc = true;
      document.addEventListener('archive:changed', () => { if (root) renderRecent(); });
      // 다른 기기에서 고친 다이어리·폴더가 도착했을 때
      document.addEventListener('diary:synced', () => { DiaryArchive.reload(); if (root) { renderRecent(); renderDiaryRow(); } });
    }
  }

  function renderHome() {
    renderDayTitle();
    renderStreak();
    renderDiaryRow();
    renderHomeHero();
    renderRecent();
    renderRecapCard();
  }

  function renderArchive() {
    if (typeof DiaryArchive === 'undefined' || !root) return;
    DiaryArchive.render(root, { entries: () => entries(), photoUrl: (p) => photoUrl(p), needLogin: () => needLogin() });
  }

  function renderAll() {
    renderArchive();
    renderHome();
    renderHero();
    renderPhaseToggle();
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
    wireHome();
    renderAll();
    refreshPhotoUrls();
  }

  function unmountDiaryView() {
    closeCalPage();
    root = null;
  }

  global.mountDiaryView = mountDiaryView;
  global.unmountDiaryView = unmountDiaryView;
  global.diaryViewIsMounted = () => !!root;
  global.diaryRefreshPhotos = refreshPhotoUrls;
  // 하이드레이션 뒤 파견 기간·기록이 바뀌었을 수 있다 — Day N·연속 기록·달력을 다시 그린다
  // 사진 크게 보기(js/diary-archive.js)에서 그 기록의 제목·노래를 고치러 들어온다 — 기록 쓰기 창을 수정으로 연다
  global.diaryEditEntry = (id) => {
    const entry = root && AppState.isAuthed ? AppState.load().journal.find(e => e.id === id) : null;
    if (!entry) return false;
    stopPreview();
    openEntryModal(null, null, entry);
    return true;
  };
  global.diaryRefreshAll = () => { if (root) { renderAll(); refreshPhotoUrls(); } };
})(window);
