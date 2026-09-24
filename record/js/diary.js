(function () {
  AppState.load();

  // 경험보고서 항목(9개) — 사용자에게 직접 고르라고 하지 않고, 아래 실생활 태그를 통해
  // 백그라운드에서만 채워짐. 보고서 모달/진행률 계산에만 쓰임.
  const REPORT_CATEGORIES = [
    { id: 'overview', ko: '교환대학 개요', color: '#4E6B93' },
    { id: 'surroundings', ko: '대학 주변 환경', color: '#5A5D96' },
    { id: 'housing', ko: '거주 및 식사', color: '#3F6B52' },
    { id: 'academics', ko: '학업 환경', color: '#454E86' },
    { id: 'support', ko: '국제학생 지원부서', color: '#A15A42' },
    { id: 'facilities', ko: '캠퍼스 시설', color: '#9C7B2E' },
    { id: 'culture', ko: '문화 적응 경험', color: '#6B4E85' },
    { id: 'resources', ko: '도움 받을 곳', color: '#3F7A82' },
    { id: 'tips', ko: '기타 및 한마디', color: '#8A4F42' }
  ];

  // 사용자가 실제로 고르는 태그 — 딱딱한 보고서 항목명 대신 일상적인 말로.
  // categories: 이 태그를 고르면 백그라운드에서 자동으로 채워지는 보고서 항목(들).
  // 하나의 태그가 여러 보고서 항목에 걸쳐도 됨(겹침 허용).
  const DIARY_TAGS = [
    { id: 'food', ko: '맛집·카페', color: '#A15A42', categories: ['surroundings', 'housing'] },
    { id: 'dorm', ko: '기숙사·자취', color: '#3F6B52', categories: ['housing'] },
    { id: 'class', ko: '수업·과제', color: '#454E86', categories: ['academics'] },
    { id: 'neighborhood', ko: '동네 탐방', color: '#5A5D96', categories: ['surroundings'] },
    { id: 'campus', ko: '캠퍼스 스팟', color: '#9C7B2E', categories: ['facilities'] },
    { id: 'friends', ko: '친구·모임', color: '#6B4E85', categories: ['culture'] },
    { id: 'trip', ko: '주말 여행', color: '#4E6B93', categories: ['surroundings', 'culture'] },
    { id: 'admin', ko: '행정·서류', color: '#8A4F42', categories: ['support'] },
    { id: 'tip', ko: '꿀팁 발견', color: '#3F7A82', categories: ['resources', 'tips'] },
    { id: 'daily', ko: '오늘의 소소함', color: '#7A6B4F', categories: ['tips'] }
  ];
  const TAG_MAP = Object.fromEntries(DIARY_TAGS.map(t => [t.id, t]));
  // 엔트리의 실생활 태그들을 → 해당하는 보고서 항목 id 집합으로 펼침
  function entryCategoryIds(e) {
    return [...new Set(e.tags.flatMap(t => (TAG_MAP[t] || {}).categories || []))];
  }

  // ---- 퀘스트 — 듀오링고 로드맵식: 목표를 여러 개 동시에 켤 수 있고, 각 목표마다
  // 독립된 로드맵(완료 개수 = 위치)을 진행함. 날짜가 아니라 완료 여부로만 다음 칸이
  // 열려서 하루 건너뛰어도 페널티 없음. 완료는 체크박스만(증빙 없음), 5개마다 레벨업.
  const QUEST_GOALS = [
    { id: 'language', ko: '언어 배우기', icon: '💬' },
    { id: 'social', ko: '친구 사귀기', icon: '🤝' },
    { id: 'culture', ko: '문화 체험하기', icon: '🌍' }
  ];
  const QUEST_POOLS = {
    language: [
      '편의점 점원에게 한마디 인사 건네보기',
      '카페에서 현지어로 주문해보기',
      '길 가는 사람에게 길 물어보기',
      '오늘 새로 배운 단어 3개 써먹어보기',
      '가게에서 가격 물어보기',
      '날씨 얘기로 스몰토크 시도해보기',
      '메뉴판 모르는 단어 체크하고 찾아보기',
      '현지 친구에게 표현 하나 물어보기',
      '짧은 라디오·팟캐스트 1분 들어보기',
      '오늘 나눈 대화 중 새 표현 하나 적어두기'
    ],
    social: [
      '같은 수업 듣는 사람에게 먼저 말 걸어보기',
      '기숙사 이웃과 인사 나누기',
      '그룹 프로젝트 팀원에게 안부 물어보기',
      '동아리·모임 한 곳 구경 가보기',
      '누군가와 밥 약속 잡아보기',
      '낯선 사람과 스몰토크 해보기',
      '버디 프로그램 멘토에게 먼저 연락해보기',
      '같이 사진 찍자고 요청해보기',
      '오늘 만난 사람 이름 기억해서 불러보기',
      'SNS로 새 친구 팔로우하고 댓글 남겨보기'
    ],
    culture: [
      '로컬 시장·마트 구경하기',
      '처음 보는 현지 음식 하나 먹어보기',
      '동네 랜드마크 하나 찾아가보기',
      '현지 뉴스 헤드라인 하나 읽어보기',
      '동네 축제·이벤트 정보 찾아보기',
      '박물관·미술관 한 곳 방문하기',
      '현지인에게 맛집 추천받아보기',
      '대중교통 혼자 타보기',
      '현지 인사 예절 하나 배워보기',
      '동네 카페에서 책이나 신문 읽어보기'
    ]
  };
  function questAt(goal, idx) {
    const pool = QUEST_POOLS[goal];
    if (!pool) return null;
    return pool[idx % pool.length];
  }
  function questLevel(progress) { return Math.floor(progress / 5) + 1; }
  function questLevelProgress(progress) { return progress % 5; } // 현재 레벨 안에서 몇 개 했는지 (0~4)

  const now = new Date();
  const todayIso = toIso(now);
  const view = { year: now.getFullYear(), month: now.getMonth(), selected: todayIso };
  let pendingPhotos = [];
  let pendingLocation = null;
  let pendingWeather = null; // { code, temp } — requestLocation()이 위치와 함께 미리 받아둠
  let pendingNowPlaying = null; // { name, artist } — 사용자가 직접 검색해서 고른 "지금 듣고 있는 노래"
  let nowPlayingSearchTimer = null;

  function toIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function flashShutter() {
    const camera = document.getElementById('fabCameraLabel');
    camera.classList.remove('is-captured');
    void camera.offsetWidth;
    camera.classList.add('is-captured');
    setTimeout(() => camera.classList.remove('is-captured'), 500);
  }

  function fadeIn(el) {
    el.style.transition = 'none';
    el.style.opacity = '0';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 180ms ease';
      requestAnimationFrame(() => { el.style.opacity = '1'; });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function tagChipHtml(id) {
    const tag = TAG_MAP[id];
    if (!tag) return '';
    return `<span class="tag-chip" style="--chip-color:${tag.color}">${tag.ko}</span>`;
  }

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

  // ---- 연속 기록(스트릭) ----
  function computeStreak() {
    const days = new Set(AppState.getDiaryEntries().map(e => e.date));
    let streak = 0;
    const cursor = new Date(now);
    if (!days.has(todayIso)) cursor.setDate(cursor.getDate() - 1);
    while (days.has(toIso(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  let lastStreak = null;
  function renderStreak() {
    const streak = computeStreak();
    const el = document.getElementById('streakNum');
    el.textContent = streak;
    if (lastStreak !== null && streak > lastStreak) {
      const badge = document.getElementById('streakBadge');
      badge.classList.remove('is-bumping');
      void badge.offsetWidth; // 리플로우 강제 — 같은 클래스 다시 넣어도 애니메이션 재생되게
      badge.classList.add('is-bumping');
    }
    lastStreak = streak;
  }

  // ---- 히어로: 비행기가 항로를 따라 날아가는 파견 기간 진행률 바 ----
  function renderHero() {
    const range = AppState.getProgramRange();
    const start = new Date(range.start);
    const end = new Date(range.end);
    const totalDays = Math.max(1, Math.round((end - start) / 86400000));
    const elapsedDays = Math.round((now - start) / 86400000);
    const dayNum = Math.max(1, elapsedDays + 1);
    const pct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    document.getElementById('heroDay').textContent = `Day ${dayNum}`;
    document.getElementById('heroFill').style.width = `${pct}%`;
    document.getElementById('heroPlane').style.left = `${pct}%`;
    document.getElementById('heroStartDate').textContent = range.start;
    document.getElementById('heroEndDate').textContent = range.end;
    const entries = AppState.getDiaryEntries();
    const recordedDays = new Set(entries.map(e => e.date)).size;
    document.getElementById('heroSub').textContent = recordedDays
      ? `지금까지 ${recordedDays}일 기록했어요`
      : '오늘의 순간을 기록해보세요';
  }

  // ---- 진행률 ----
  function renderProgress() {
    const entries = AppState.getDiaryEntries();
    const filled = new Set();
    entries.forEach(e => entryCategoryIds(e).forEach(catId => filled.add(catId)));
    document.getElementById('progressLabel').textContent = `보고서 ${filled.size}/${REPORT_CATEGORIES.length}`;
    document.getElementById('progressFill').style.width = `${Math.round((filled.size / REPORT_CATEGORIES.length) * 100)}%`;
  }

  // ---- 캘린더 ----
  function entriesByDate() {
    const map = {};
    AppState.getDiaryEntries().forEach(e => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }

  // ---- 기록 카드 — CGV/메가박스 "포토티켓"처럼: 사진에 제목을 오버레이하고,
  // 그 아래 얇은 정보 줄(장소·날씨·시간대·태그)과 노래 칸이 붙음 ----
  const clockLabel = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  function photoHeaderHtml(e) {
    if (!e.photos.length) return '';
    const altText = escapeHtml(e.caption || `${e.date} 기록 사진`);
    const titleOverlay = e.caption ? `
      <div class="diary-entry__title-overlay">
        <p class="diary-entry__poster-title">${escapeHtml(e.caption)}</p>
        <span class="diary-entry__poster-date">${e.date}</span>
      </div>` : '';
    if (e.photos.length === 1) {
      return `<div class="diary-entry__photo-wrap"><img class="diary-entry__photo-single" src="${e.photos[0]}" alt="${altText}">${titleOverlay}</div>`;
    }
    const extra = e.photos.length - 2;
    return `<div class="diary-entry__photo-wrap diary-entry__photo-wrap--dual">
      <img class="diary-entry__photo-main" src="${e.photos[0]}" alt="${altText}">
      <img class="diary-entry__photo-inset" src="${e.photos[1]}" alt="${e.date} 추가 사진">
      ${extra > 0 ? `<span class="diary-entry__photo-more">+${extra}</span>` : ''}
      ${titleOverlay}
    </div>`;
  }
  // 보딩패스/영화 티켓의 "FROM / TO / SEAT" 라벨+값 그리드처럼 — 장소·날씨·시간대를
  // 작은 대문자 라벨 + 굵은 값 쌍으로
  function rowsHtml(e) {
    const cells = [];
    if (e.location && (e.location.city || e.location.country)) {
      cells.push({ label: '장소', value: escapeHtml([e.location.city, e.location.country].filter(Boolean).join(', ')) });
    }
    const w = e.weather && typeof e.weather.code === 'number' ? SongEngine.weatherLabel(e.weather.code) : null;
    if (w) cells.push({ label: '날씨', value: `${w.emoji} ${w.ko}${typeof e.weather.temp === 'number' ? ` ${Math.round(e.weather.temp)}°` : ''}` });
    const t = SongEngine.timeLabel(new Date(e.createdAt).getHours());
    if (t) cells.push({ label: '시간대', value: `${t.emoji} ${t.ko}` });
    if (!cells.length) return '';
    return `<div class="diary-ticket-rows">${cells.map((c) => `
      <div class="diary-ticket-row">
        <span class="diary-ticket-row__label">${c.label}</span>
        <span class="diary-ticket-row__value">${c.value}</span>
      </div>`).join('')}</div>`;
  }
  // 티켓의 "좌석 번호" 자리처럼 — 노래를 앨범 커버 썸네일 + 정보 + 링크 한 줄로
  function songRowHtml(item, label, variant) {
    if (!item) return '';
    // 링크를 곡 정보 줄 안에 작게 끼워넣지 않고 아래에 큼직한 버튼으로 따로 빼서
    // 폰에서도 오탭 없이 편하게 누를 수 있게 함(최소 44px 탭 영역)
    return `
      <div class="diary-ticket-song diary-ticket-song--${variant}">
        <div class="diary-ticket-song__top">
          ${item.art ? `<img class="diary-ticket-song__art" src="${item.art}" alt="">` : `<span class="diary-ticket-song__art diary-ticket-song__art--empty">🎵</span>`}
          <div class="diary-ticket-song__info">
            <span class="diary-ticket-song__label">${label}</span>
            <span class="diary-ticket-song__title">${escapeHtml(item.name)}</span>
            <span class="diary-ticket-song__artist">${escapeHtml(item.artist)}</span>
          </div>
        </div>
        <div class="diary-ticket-song__links">
          ${item.spotifyUrl ? `<a class="diary-ticket-song__link diary-ticket-song__link--spotify" href="${item.spotifyUrl}" target="_blank" rel="noopener">Spotify ↗</a>` : ''}
          <a class="diary-ticket-song__link diary-ticket-song__link--youtube" href="${item.youtubeUrl}" target="_blank" rel="noopener">YouTube ↗</a>
        </div>
      </div>`;
  }
  function entryCardHtml(e, i) {
    return `
      <div class="diary-entry diary-entry--ticket" data-idx="${i}">
        ${photoHeaderHtml(e)}
        <div class="diary-ticket-body">
          ${(!e.photos.length && e.caption) ? `<p class="diary-ticket-caption">${escapeHtml(e.caption)}</p>` : ''}
          <span class="diary-ticket-time">${clockLabel(e.createdAt)}</span>
          ${rowsHtml(e)}
          ${e.tags.length ? `
          <div class="diary-ticket-row">
            <span class="diary-ticket-row__label">태그</span>
            <div class="diary-ticket-tags">${e.tags.map(tagChipHtml).join('')}</div>
          </div>` : ''}
          ${(e.song || e.nowPlaying) ? '<div class="diary-ticket-perf"></div>' : ''}
          ${songRowHtml(e.song, '🎵 오늘의 노래', 'recommend')}
          ${songRowHtml(e.nowPlaying, '🎧 그때 듣던 노래', 'nowplaying')}
        </div>
      </div>`;
  }
  const emptyStateHtml = `<div class="diary-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke-dasharray="3 3"/><circle cx="12" cy="13.5" r="3.4" stroke-dasharray="3 3"/></svg>
      <p>이 날짜엔 아직 기록이 없어요<br>아래 카메라로 남겨보세요</p>
    </div>`;
  // 저장된 사진 클릭하면 원본 크기로 팝업 — 사진 영역에만 리스너를 닮(본문/링크는 클릭해도 안 열림)
  function wireEntryCards(container, items) {
    container.querySelectorAll('.diary-entry--ticket[data-idx]').forEach((el) => {
      const entry = items[Number(el.dataset.idx)];
      const wrap = el.querySelector('.diary-entry__photo-wrap');
      if (!wrap || !entry.photos.length) return;
      wrap.classList.add('is-clickable');
      wrap.addEventListener('click', (ev) => {
        const idx = ev.target.closest('.diary-entry__photo-inset') ? 1 : 0;
        openPhotoLightbox(entry.photos, idx);
      });
    });
  }
  // 달력에서 날짜를 누르면 스크롤 없이 바로 그날 기록을 팝업으로 보여줌
  function openDayModal(iso) {
    const items = entriesByDate()[iso] || [];
    const scrim = ensureScrim('dayModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel diary-modal-pad diary-day-modal">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header"><h2>${iso}</h2></div>
        <div class="diary-entry-list" id="dayModalList">
          ${items.length ? items.map((e, i) => entryCardHtml(e, i)).join('') : emptyStateHtml}
        </div>
      </div>`;
    wireModalDismiss(scrim);
    wireEntryCards(scrim.querySelector('#dayModalList'), items);
    openModal(scrim);
  }

  function renderMonth() {
    const map = entriesByDate();
    document.getElementById('calTitle').textContent = `${view.year}년 ${view.month + 1}월`;
    const first = new Date(view.year, view.month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += `<div class="diary-day is-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = map[iso] || [];
      const isToday = iso === todayIso;
      const isSelected = iso === view.selected;
      const inRange = AppState.isDateInProgram(iso);
      const withPhoto = items.find(e => e.photos && e.photos.length);
      const dayTags = items.flatMap(e => e.tags);
      // 카테고리당 점 하나로 중복 제거하고 3개까지만, 나머지는 칩 없이 순수 텍스트 "+N"로 (과밀 방지)
      const uniqueDayTags = [...new Set(dayTags)];
      const shownDayTags = uniqueDayTags.slice(0, 3);
      const dayTagOverflow = uniqueDayTags.length - shownDayTags.length;
      const dots = shownDayTags.map(t => `<span class="diary-day__dot" style="background:${(TAG_MAP[t] || {}).color || '#ccc'}"></span>`).join('')
        + (dayTagOverflow > 0 ? `<span class="diary-day__dot-more">+${dayTagOverflow}</span>` : '');
      const classes = ['diary-day', isToday && 'is-today', isSelected && 'is-selected', !inRange && 'is-outside', withPhoto && 'has-photo']
        .filter(Boolean).join(' ');
      const tagNames = [...new Set(dayTags.map(t => (TAG_MAP[t] || {}).ko).filter(Boolean))];
      const dayLabel = [
        `${view.year}년 ${view.month + 1}월 ${d}일`,
        isToday && '오늘',
        !inRange && '파견 기간 밖',
        tagNames.length ? tagNames.join(', ') : (items.length ? '기록 있음' : '기록 없음')
      ].filter(Boolean).join(', ');
      cells += `
        <button type="button" class="${classes}" data-date="${iso}" aria-label="${dayLabel}" title="${dayLabel}">
          ${withPhoto ? `<span class="diary-day__photo" style="background-image:url('${withPhoto.photos[0]}')"></span>` : ''}
          <span class="diary-day__num">${d}</span>
          ${!withPhoto ? `<span class="diary-day__dots">${dots}</span>` : ''}
        </button>`;
    }
    const calMonthEl = document.getElementById('calMonth');
    calMonthEl.innerHTML = cells;
    fadeIn(calMonthEl);
    document.querySelectorAll('.diary-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        view.selected = el.dataset.date;
        renderMonth(); renderSide();
        openDayModal(el.dataset.date);
      });
    });
  }

  function renderSide() {
    const items = entriesByDate()[view.selected] || [];
    document.getElementById('sideDate').textContent = view.selected;
    const list = document.getElementById('entryList');
    list.innerHTML = items.length ? items.map((e, i) => entryCardHtml(e, i)).join('') : emptyStateHtml;
    fadeIn(list);
    wireEntryCards(list, items);
  }

  // 저장한 사진을 원본 크기로 보는 팝업 — 여러 장이면 좌우로 넘겨볼 수 있음
  function openPhotoLightbox(photos, startIdx) {
    let idx = startIdx;
    const scrim = ensureScrim('lightboxScrim');
    function render() {
      scrim.innerHTML = `
        <div class="modal-panel diary-lightbox">
          <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
          <img src="${photos[idx]}" alt="">
          ${photos.length > 1 ? `
            <button type="button" class="diary-lightbox__prev" aria-label="이전 사진">‹</button>
            <button type="button" class="diary-lightbox__next" aria-label="다음 사진">›</button>
            <span class="diary-lightbox__count">${idx + 1} / ${photos.length}</span>` : ''}
        </div>`;
      wireModalDismiss(scrim);
      if (photos.length > 1) {
        scrim.querySelector('.diary-lightbox__prev').addEventListener('click', () => { idx = (idx - 1 + photos.length) % photos.length; render(); });
        scrim.querySelector('.diary-lightbox__next').addEventListener('click', () => { idx = (idx + 1) % photos.length; render(); });
      }
    }
    render();
    openModal(scrim);
  }

  document.getElementById('calPrev').addEventListener('click', () => {
    view.month -= 1; if (view.month < 0) { view.month = 11; view.year -= 1; } renderMonth();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    view.month += 1; if (view.month > 11) { view.month = 0; view.year += 1; } renderMonth();
  });

  // ---- 새 기록 ----
  // 왼쪽 카메라 버튼: 바로 촬영 → 자동으로 사진 채워진 채 기록 폼이 열림
  document.getElementById('fabCameraInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const targetDate = AppState.isDateInProgram(view.selected) ? view.selected : todayIso;
    if (!AppState.isDateInProgram(targetDate)) { showToast('파견 기간 안에서만 기록할 수 있어요'); return; }
    const dataUrl = await resizeImage(file);
    openEntryModal([dataUrl]);
  });

  // <label>은 Enter/Space로 활성화되지 않아서(네이티브 버튼이 아님) 키보드 사용자를 위해 직접 처리
  document.getElementById('fabCameraLabel').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('fabCameraInput').click(); }
  });

  // 오른쪽 연필 버튼: 이미 갖고 있는 사진으로(또는 사진 없이 글만) 기록
  document.getElementById('fabEdit').addEventListener('click', () => openEntryModal());

  // ---- 퀘스트 버튼(카메라 오른쪽) ----
  function renderQuestDot() {
    // 목표를 하나도 안 골랐을 때만 "여기 눌러보세요" 표시 — 이미 진행 중이면 매번 알릴 필요 없음
    document.getElementById('questDot').hidden = AppState.getQuestGoals().length > 0;
  }

  document.getElementById('fabQuest').addEventListener('click', () => openQuestModal());

  function goalRoadmapHtml(goalId) {
    const info = QUEST_GOALS.find(g => g.id === goalId);
    const progress = AppState.getQuestProgress(goalId);
    const level = questLevel(progress);
    const posInLevel = questLevelProgress(progress);
    const currentQuest = questAt(goalId, progress);
    // 듀오링고 유닛 경로처럼 지그재그로 굽이치는 길 — SVG 점선 도로 위에 노드를 얹음
    const NX = [100, 152, 100, 48, 100]; // 0~200 기준 좌우 지그재그
    const NY = [40, 116, 192, 268, 344];
    const pathD = NX.map((x, i) => i === 0 ? `M${x},${NY[i]}` : `Q${(NX[i - 1] + x) / 2},${(NY[i - 1] + NY[i]) / 2} ${x},${NY[i]}`).join(' ');
    const nodes = NX.map((x, i) => {
      let stateClass = 'quest-node--upcoming';
      let label = String(i + 1);
      if (i < posInLevel) { stateClass = 'quest-node--done'; label = '✓'; }
      else if (i === posInLevel) { stateClass = 'quest-node--current'; label = '📍'; }
      if (i === NX.length - 1) stateClass += ' quest-node--checkpoint';
      return `<span class="quest-node ${stateClass}" style="left:${x / 2}%; top:${NY[i]}px;">${label}</span>`;
    }).join('');
    return `
      <div class="quest-roadmap">
        <div class="quest-roadmap__head">
          <span class="quest-roadmap__title">${info.icon} ${info.ko}</span>
          <span class="quest-roadmap__level">Lv.${level}</span>
          <button type="button" class="quest-roadmap__remove" data-remove-goal="${goalId}" aria-label="이 목표 그만하기" title="그만하기">✕</button>
        </div>
        <div class="quest-path">
          <svg class="quest-path__line" viewBox="0 0 200 384" preserveAspectRatio="none">
            <path d="${pathD}" fill="none" stroke="var(--diary-line-strong)" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 14"/>
          </svg>
          ${nodes}
        </div>
        <div class="quest-roadmap__current">
          <p class="quest-roadmap__quest">${escapeHtml(currentQuest || '')}</p>
          <button type="button" class="btn btn--primary btn--sm quest-roadmap__complete" data-complete-goal="${goalId}">완료하기</button>
        </div>
      </div>`;
  }

  function openQuestModal() {
    const goals = AppState.getQuestGoals();
    const availableToAdd = QUEST_GOALS.filter(g => !goals.includes(g.id));
    const scrim = ensureScrim('questModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel modal-panel--sm diary-modal-pad">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header">
          <h2>퀘스트 로드맵</h2>
          <p class="diary-modal-header__note">완료할 때마다 다음 칸이 열려요. 날짜는 상관없어요 — 내 속도대로.</p>
        </div>
        ${goals.length ? goals.map(goalRoadmapHtml).join('') : `<p class="report-empty">아직 시작한 목표가 없어요. 아래에서 골라보세요.</p>`}
        ${availableToAdd.length ? `
          <span class="diary-form__label" style="display:block; margin-top:${goals.length ? 'var(--space-5)' : '0'};">${goals.length ? '목표 추가하기' : '목표 고르기'}</span>
          <div class="quest-goal-grid">
            ${availableToAdd.map(g => `<button type="button" class="quest-goal-card" data-add-goal="${g.id}"><span class="quest-goal-card__icon">${g.icon}</span><span>${g.ko}</span></button>`).join('')}
          </div>` : ''}
      </div>`;
    wireModalDismiss(scrim);
    scrim.querySelectorAll('[data-add-goal]').forEach(btn => {
      btn.addEventListener('click', () => { AppState.addQuestGoal(btn.dataset.addGoal); renderQuestDot(); openQuestModal(); });
    });
    scrim.querySelectorAll('[data-remove-goal]').forEach(btn => {
      btn.addEventListener('click', () => { AppState.removeQuestGoal(btn.dataset.removeGoal); renderQuestDot(); openQuestModal(); });
    });
    scrim.querySelectorAll('[data-complete-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const goalId = btn.dataset.completeGoal;
        const before = AppState.getQuestProgress(goalId);
        const after = AppState.completeQuest(goalId);
        closeModal(scrim);
        showToast(questLevel(after) > questLevel(before) ? `레벨업! Lv.${questLevel(after)} 달성 🎉` : '퀘스트를 완료했어요!');
        showQuestNudge();
      });
    });
    openModal(scrim);
  }

  // 퀘스트 완료 직후 살짝 유도 — 강제 아니고, 사진첩/카메라로 자연스럽게만 연결
  function showQuestNudge() {
    const old = document.getElementById('questNudge');
    if (old) old.remove();
    const nudge = document.createElement('div');
    nudge.id = 'questNudge';
    nudge.className = 'quest-nudge';
    nudge.innerHTML = `
      <span>📸 이 순간을 사진으로 남겨볼까요?</span>
      <div class="quest-nudge__actions">
        <button type="button" id="questNudgeYes">사진 찍기</button>
        <button type="button" id="questNudgeNo" aria-label="닫기">✕</button>
      </div>`;
    document.body.appendChild(nudge);
    const remove = () => nudge.remove();
    nudge.querySelector('#questNudgeYes').addEventListener('click', () => { remove(); document.getElementById('fabCameraInput').click(); });
    nudge.querySelector('#questNudgeNo').addEventListener('click', remove);
    setTimeout(remove, 6000);
  }

  function openEntryModal(initialPhotos) {
    const targetDate = AppState.isDateInProgram(view.selected) ? view.selected : todayIso;
    if (!AppState.isDateInProgram(targetDate)) {
      showToast('파견 기간 안에서만 기록할 수 있어요');
      return;
    }
    pendingPhotos = initialPhotos ? initialPhotos.slice() : [];
    pendingLocation = null;
    pendingNowPlaying = null;
    const scrim = ensureScrim('entryModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel modal-panel--sm diary-modal-pad diary-sheet">
        <div class="diary-sheet__handle"></div>
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header">
          <h2>${targetDate}</h2>
        </div>
        <form class="diary-form" id="entryForm">
          <div class="diary-photo-picker" id="photoPicker">
            <label class="diary-photo-picker__add">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <input type="file" accept="image/*" multiple id="photoInput" style="display:none;">
            </label>
          </div>
          <textarea name="caption" placeholder="오늘 하루는 어땠나요? (선택)"></textarea>
          <div>
            <span class="diary-form__label">태그 (여러 개 선택 가능)</span>
            <div class="diary-tag-grid" id="tagGrid">
              ${DIARY_TAGS.map(t => `<button type="button" class="tag-chip" data-tag="${t.id}" style="--chip-color:${t.color}" aria-pressed="false">${t.ko}</button>`).join('')}
            </div>
          </div>
          <div>
            <span class="diary-form__label">지금 듣고 있는 노래 (선택)</span>
            <div id="nowPlayingPicker"></div>
          </div>
          <span class="diary-location-note" id="locationNote">📍 위치 확인 중…</span>
          <input type="hidden" name="date" value="${targetDate}">
          <button type="submit" class="btn btn--primary btn--block">기록 저장</button>
        </form>
      </div>`;
    wireModalDismiss(scrim);
    openModal(scrim);
    wireEntryForm(scrim);
    renderPhotoPicker(scrim);
    renderNowPlayingPicker(scrim);
    requestLocation();
  }

  // "지금 듣고 있는 노래" — Last.fm 검색 자동완성으로 정확한 곡을 고르게 함.
  // 선택 전엔 검색창, 선택 후엔 칩 하나로 바뀜(사진 썸네일과 같은 패턴).
  function renderNowPlayingPicker(scrim) {
    const mount = scrim.querySelector('#nowPlayingPicker');
    if (pendingNowPlaying) {
      mount.innerHTML = `
        <div class="diary-nowplaying-chip">
          <span>🎧 ${escapeHtml(pendingNowPlaying.artist)} · ${escapeHtml(pendingNowPlaying.name)}</span>
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
      nowPlayingSearchTimer = setTimeout(async () => {
        const matches = await SongEngine.searchTracks(q);
        if (!matches.length) { list.hidden = true; list.innerHTML = ''; return; }
        list.innerHTML = matches.map((m, i) => `<li data-idx="${i}">${escapeHtml(m.name)} <span>· ${escapeHtml(m.artist)}</span></li>`).join('');
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
    const addBtn = picker.querySelector('.diary-photo-picker__add');
    picker.querySelectorAll('.diary-photo-thumb').forEach(el => el.remove());
    pendingPhotos.forEach((src, i) => {
      const div = document.createElement('div');
      div.className = 'diary-photo-thumb';
      div.innerHTML = `<img src="${src}" alt=""><button type="button" data-remove="${i}">✕</button>`;
      picker.insertBefore(div, addBtn);
    });
    picker.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => { pendingPhotos.splice(Number(btn.dataset.remove), 1); renderPhotoPicker(scrim); });
    });
  }

  function resizeImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function requestLocation() {
    const note = document.getElementById('locationNote');
    pendingWeather = null;
    if (!navigator.geolocation) { if (note) note.textContent = '📍 위치 정보를 사용할 수 없어요'; return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      // 오늘의 노래 추천용 날씨는 위치 확인과 동시에 미리 받아둠 — 저장 시점엔 이미 준비돼있게
      SongEngine.fetchWeather(latitude, longitude).then((w) => { pendingWeather = w; });
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

  // ---- 오늘의 노래 추천 ----
  // 기록 저장을 막지 않도록 완전히 비동기로: 실패해도 조용히 스킵.
  async function recommendSongFor(entry, tags) {
    if (!pendingLocation || !pendingLocation.countryCode) return;
    const { mood, moodKo, keywords } = SongEngine.computeMood({
      tags,
      weatherCode: pendingWeather ? pendingWeather.code : undefined,
      tempC: pendingWeather ? pendingWeather.temp : undefined,
      date: new Date(entry.createdAt)
    });
    const song = await SongEngine.fetchSongRecommendation({ countryCode: pendingLocation.countryCode, keywords });
    if (!song) return;
    song.mood = mood;
    song.moodKo = moodKo;
    AppState.setEntrySong(entry.id, song);
    if (view.selected === entry.date) renderSide();
    showSongPopup(song);
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
      <span class="song-popup__title">${escapeHtml(song.name)}</span>
      <span class="song-popup__artist">${escapeHtml(song.artist)}</span>
      <div class="song-popup__links">
        ${song.spotifyUrl ? `<a href="${song.spotifyUrl}" target="_blank" rel="noopener">Spotify ↗</a>` : ''}
        <a href="${song.youtubeUrl}" target="_blank" rel="noopener">YouTube ↗</a>
      </div>`;
    document.body.appendChild(popup);
    const remove = () => popup.remove();
    popup.querySelector('.song-popup__close').addEventListener('click', remove);
    setTimeout(remove, 9000);
  }

  function wireEntryForm(scrim) {
    const grid = scrim.querySelector('#tagGrid');
    grid.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.classList.toggle('is-selected');
        btn.setAttribute('aria-pressed', String(selected));
      });
    });

    const photoInput = scrim.querySelector('#photoInput');
    photoInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) pendingPhotos.push(await resizeImage(file));
      renderPhotoPicker(scrim);
      photoInput.value = '';
    });

    scrim.querySelector('#entryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get('date');
      if (!AppState.isDateInProgram(date)) { showToast('파견 기간 안에서만 기록할 수 있어요'); return; }
      const tags = Array.from(grid.querySelectorAll('.tag-chip.is-selected')).map(b => b.dataset.tag);
      const caption = (fd.get('caption') || '').trim();
      if (!pendingPhotos.length && !caption) { showToast('사진 또는 글 중 하나는 있어야 해요'); return; }
      const nowPlaying = pendingNowPlaying
        ? Object.assign({ name: pendingNowPlaying.name, artist: pendingNowPlaying.artist, art: null }, SongEngine.buildSongLinks(pendingNowPlaying.name, pendingNowPlaying.artist))
        : null;
      const entry = AppState.addDiaryEntry({ date, photos: pendingPhotos.slice(), caption, tags, location: pendingLocation, nowPlaying, weather: pendingWeather });
      closeModal(scrim);
      renderMonth(); renderSide(); renderProgress(); renderStreak(); renderHero();
      showToast('기록을 저장했어요');
      flashShutter();
      recommendSongFor(entry, tags);
      if (nowPlaying) {
        // 저장은 즉시, 앨범 커버는 비동기로 조용히 붙임(실패해도 그냥 커버 없이 남음)
        SongEngine.fetchAlbumArt(nowPlaying.name, nowPlaying.artist).then((art) => {
          if (!art) return;
          AppState.setEntryNowPlayingArt(entry.id, art);
          if (view.selected === entry.date) renderSide();
        });
      }
    });
  }

  // ---- 월간 정리 (목업) ----
  document.getElementById('openWrapup').addEventListener('click', openWrapupModal);

  function openWrapupModal() {
    const monthKey = `${view.year}-${String(view.month + 1).padStart(2, '0')}`;
    const all = AppState.getDiaryEntries();
    const monthEntries = all.filter(e => e.date.slice(0, 7) === monthKey);
    const source = monthEntries.length ? monthEntries : all;
    const photos = source.flatMap(e => e.photos.map(p => ({ src: p, date: e.date }))).slice(0, 8);
    const daysRecorded = new Set(source.map(e => e.date)).size;
    const cities = [...new Set(source.map(e => e.location && e.location.city).filter(Boolean))];
    const tagCounts = {};
    source.forEach(e => e.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
    // 보고서 항목별 채움은 사용자가 고른 실생활 태그를 카테고리로 펼쳐서 집계
    const categoryCounts = {};
    source.forEach(e => entryCategoryIds(e).forEach(catId => { categoryCounts[catId] = (categoryCounts[catId] || 0) + 1; }));

    const heroPhoto = photos[0];
    const restPhotos = photos.slice(1);
    const topTagCat = topTag ? TAG_MAP[topTag[0]] : null;

    const scrim = ensureScrim('wrapupModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel diary-modal-pad">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        ${heroPhoto ? `
          <div class="wrapup-hero">
            <img src="${heroPhoto.src}" alt="${heroPhoto.date} 사진">
            <div class="wrapup-hero__overlay">
              <span class="wrapup-hero__eyebrow">MONTHLY WRAP-UP</span>
              <h2>${view.year}년 ${view.month + 1}월</h2>
            </div>
          </div>` : `
          <div class="diary-modal-header">
            <h2>${view.year}년 ${view.month + 1}월 정리</h2>
          </div>`}
        <p class="diary-modal-header__note">목업 데이터 — 지금까지 쌓인 기록 기준</p>
        ${restPhotos.length ? `<div class="wrapup-strip">${restPhotos.map(p => `<img src="${p.src}" alt="${p.date} 사진">`).join('')}</div>` : ''}
        <div class="wrapup-stats">
          <div class="wrapup-stat"><span class="wrapup-stat__num">${daysRecorded}</span><span class="wrapup-stat__label">기록한 날</span></div>
          <div class="wrapup-stat"><span class="wrapup-stat__num">${cities.length || '-'}</span><span class="wrapup-stat__label">방문 도시</span></div>
          <div class="wrapup-stat wrapup-stat--highlight" style="--stat-color:${topTagCat ? topTagCat.color : 'var(--diary-text-faint)'}"><span class="wrapup-stat__num" style="font-size:var(--fs-h3);">${topTagCat ? topTagCat.ko : '-'}</span><span class="wrapup-stat__label">가장 많이 쓴 태그</span></div>
        </div>
        <span class="diary-form__label">보고서 항목별 채움</span>
        ${REPORT_CATEGORIES.map(c => {
          const count = categoryCounts[c.id] || 0;
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

  // ---- 경험보고서 미리보기 (목업) ----
  document.getElementById('openReport').addEventListener('click', openReportModal);

  function openReportModal() {
    const entries = AppState.getDiaryEntries();
    const scrim = ensureScrim('reportModalScrim');
    scrim.innerHTML = `
      <div class="modal-panel diary-modal-pad">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <div class="diary-modal-header">
          <h2>지금까지 쌓인 기록으로 미리 보기</h2>
          <p class="diary-modal-header__note">AI가 문장을 새로 쓰지 않고, 기록한 캡션을 항목별·날짜순으로 모아 보여줍니다.</p>
        </div>
        <nav class="report-nav">
          ${REPORT_CATEGORIES.map(c => {
            const has = entries.some(e => entryCategoryIds(e).includes(c.id));
            return `<a href="#report-${c.id}" class="report-nav__chip" data-has="${has}" style="--chip-color:${c.color}">${c.ko}</a>`;
          }).join('')}
        </nav>
        ${REPORT_CATEGORIES.map(c => {
          const items = entries.filter(e => entryCategoryIds(e).includes(c.id));
          return `<div class="report-section" id="report-${c.id}">
            <h3 class="report-section__title">${c.ko}</h3>
            ${items.length ? items.map(e => `
              <div class="report-entry">
                ${e.photos[0] ? `<img src="${e.photos[0]}" alt="${escapeHtml(e.caption || e.date + ' 기록 사진')}">` : ''}
                <div>
                  <div class="report-entry__date">${e.date}${e.location && (e.location.city || e.location.country) ? ' · ' + [e.location.city, e.location.country].filter(Boolean).join(', ') : ''}</div>
                  <p class="report-entry__caption">${escapeHtml(e.caption || '(사진만 기록)')}</p>
                </div>
              </div>`).join('') : `<p class="report-empty">아직 기록이 없어요</p>`}
          </div>`;
        }).join('')}
        <div class="report-section">
          <h3 class="report-section__title">공유 가능한 연락처 (선택)</h3>
          <p class="report-empty">학기 말에 직접 입력하는 항목이에요</p>
        </div>
      </div>`;
    wireModalDismiss(scrim);
    openModal(scrim);
  }

  renderMonth();
  renderSide();
  renderProgress();
  renderStreak();
  renderHero();
  renderQuestDot();
})();
