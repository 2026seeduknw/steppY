/**
 * 데모용 클라이언트 상태 저장소.
 * 실제 백엔드가 없는 정적 데모이므로, 페이지 이동 간(F2→F3→F4) 데이터가
 * 유지되도록 localStorage를 얕은 DB처럼 사용합니다.
 * 실서비스에서는 이 모듈 전체가 서버 API 호출로 대체됩니다.
 */

const STORAGE_KEY = 'xchg_demo_state_v6';

/**
 * 사진 기록(다이어리) 데모 시드 — 프랑스 리옹 교환학생 가정.
 * 실사용자 기록이 하나도 없을 때(첫 로드)만 기본값으로 깔리고,
 * 이후에는 localStorage에 저장된 실제 기록으로 완전히 대체됩니다.
 * 사진은 picsum 무작위 이미지 대신 실제 파리 풍경·유럽 대학 캠퍼스·기숙사·도서관
 * 사진(Unsplash, 상업적 이용 가능한 라이선스)으로 교체함.
 */
const PHOTO_EIFFEL = 'https://images.unsplash.com/photo-1757435755027-91a1a4beb6c5?w=900&q=75&auto=format&fit=crop';
const PHOTO_CAMPUS = 'https://images.unsplash.com/photo-1751510397614-e289eb4ce57a?w=900&q=75&auto=format&fit=crop';
const PHOTO_LIBRARY = 'https://images.unsplash.com/photo-1741699427799-3fbb70fce948?w=900&q=75&auto=format&fit=crop';
const PHOTO_CAFE = 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=900&q=75&auto=format&fit=crop';
const PHOTO_DORM = 'https://images.unsplash.com/photo-1632119289059-793dd347950f?w=900&q=75&auto=format&fit=crop';

const DIARY_SEED = [
  // 3월 — 학기 초
  { id: 'seed1', date: '2026-03-02', time: '11:20', tags: ['neighborhood'], caption: '리옹 도착! 학교가 시내에서 트램으로 15분 거리라 생각보다 조용한 동네였다.', photos: [PHOTO_CAMPUS], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed2', date: '2026-03-03', time: '19:40', tags: ['dorm'], caption: '기숙사 첫 요리. 마트에서 산 바게트가 확실히 다르다.', photos: [PHOTO_DORM], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed3', date: '2026-03-05', time: '16:05', tags: ['neighborhood'], caption: '학교 앞 카르푸에서 장보기. 생각보다 물가가 착함.', photos: [PHOTO_CAFE], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed4', date: '2026-03-08', time: '10:00', tags: ['class'], caption: '첫 수업, 토론 위주라 당황했지만 재밌었다.', photos: [], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed5', date: '2026-03-10', time: '13:15', tags: ['friends'], caption: '다들 점심을 2시간씩 먹는 거 아직 적응 안 됨.', photos: [PHOTO_CAFE], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed6', date: '2026-03-14', time: '15:30', tags: ['campus', 'admin'], caption: '국제학생 오피스에서 서류 도움 받고, 도서관 스터디룸도 예약해봄.', photos: [PHOTO_LIBRARY], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed7', date: '2026-03-18', time: '09:50', tags: ['friends'], caption: '버디 프로그램 멘토랑 첫 커피.', photos: [PHOTO_CAFE], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed8', date: '2026-03-22', time: '17:45', tags: ['trip'], caption: '주말에 파리 당일치기로 에펠탑 다녀옴.', photos: [PHOTO_EIFFEL, PHOTO_CAFE], location: { country: '프랑스', city: '파리' }, weather: { code: 1, temp: 14 },
    song: { name: 'Dernière danse', artist: 'Indila', art: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/49/58/30/49583018-308b-431d-c691-4a28e78be8cd/14UMGIM01109.rgb.jpg/300x300bb.jpg', spotifyUrl: 'https://open.spotify.com/search/Indila%20Derni%C3%A8re%20danse', youtubeUrl: 'https://www.youtube.com/results?search_query=Indila%20Derni%C3%A8re%20danse' } },
  { id: 'seed9', date: '2026-03-27', time: '22:10', tags: ['daily'], caption: '한 달 벌써 지나감. 다음 학기 교환생들 화이팅!', photos: [], location: { country: '프랑스', city: '리옹' } },
  // 9월 — 2학기, 매일 기록
  { id: 'seed10', date: '2026-09-01', time: '20:30', tags: ['dorm'], caption: '개강 전날, 방 정리 마무리. 내일부터 2학기 시작.', photos: [PHOTO_DORM], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed11', date: '2026-09-02', time: '09:15', tags: ['class'], caption: '2학기 개강! 강의 배정표 보고 살짝 당황함.', photos: [PHOTO_LIBRARY], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed12', date: '2026-09-03', time: '17:00', tags: ['neighborhood'], caption: '동네 산책하다가 학교 앞 광장 처음 제대로 구경함.', photos: [PHOTO_CAMPUS], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed13', date: '2026-09-04', time: '14:40', tags: ['friends'], caption: '첫 조모임. 다들 친절해서 다행이었다.', photos: [], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed14', date: '2026-09-05', time: '19:00', tags: ['friends'], caption: '학교 축제 기간이라 다들 들떠 있음.', photos: [PHOTO_CAMPUS], location: { country: '프랑스', city: '리옹' }, weather: { code: 0, temp: 21 },
    song: { name: 'Sexy Boy', artist: 'Air', art: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d1/f9/26/d1f926e7-e996-7166-3744-0710a82177ac/017046664455.jpg/300x300bb.jpg', spotifyUrl: 'https://open.spotify.com/search/Air%20Sexy%20Boy', youtubeUrl: 'https://www.youtube.com/results?search_query=Air%20Sexy%20Boy' } },
  { id: 'seed15', date: '2026-09-06', time: '12:20', tags: ['dorm'], caption: '주말엔 늦잠. 밀린 빨래도 함.', photos: [], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed16', date: '2026-09-07', time: '21:15', tags: ['class'], caption: '도서관에서 다음 주 발표 준비.', photos: [PHOTO_LIBRARY], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed17', date: '2026-09-08', time: '16:50', tags: ['campus'], caption: '새로 생긴 스터디 라운지 가봄.', photos: [PHOTO_CAMPUS], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed18', date: '2026-09-09', time: '11:05', tags: ['admin'], caption: '국제학생 지원부서 방문, 서류 처리 도움받음.', photos: [], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed19', date: '2026-09-10', time: '18:25', tags: ['friends'], caption: '버디 프로그램으로 후배 매칭받음, 카페에서 첫 만남.', photos: [PHOTO_CAFE], location: { country: '프랑스', city: '리옹' }, weather: { code: 3, temp: 18 },
    nowPlaying: { name: '밤편지', artist: 'IU', art: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/dc/12/fe/dc12fe03-172b-a843-0d96-12819fa05b6c/cover-.jpg/300x300bb.jpg', spotifyUrl: 'https://open.spotify.com/search/IU%20%EB%B0%A4%ED%8E%B8%EC%A7%80', youtubeUrl: 'https://www.youtube.com/results?search_query=IU%20%EB%B0%A4%ED%8E%B8%EC%A7%80' } },
  { id: 'seed20', date: '2026-09-11', time: '20:00', tags: ['dorm'], caption: '룸메이트랑 같이 저녁 만들어 먹음.', photos: [PHOTO_DORM], location: { country: '프랑스', city: '리옹' } },
  { id: 'seed21', date: '2026-09-12', time: '17:30', tags: ['trip'], caption: '파리 당일치기, 에펠탑 보고 옴.', photos: [PHOTO_EIFFEL], location: { country: '프랑스', city: '파리' }, weather: { code: 61, temp: 12 },
    song: { name: 'Formidable', artist: 'Stromae', art: 'https://is1-ssl.mzstatic.com/image/thumb/Video5/v4/49/ab/0f/49ab0f2e-9895-b63a-6438-0cf87201f875/13UAAIM09601_1_1.jpg/300x300bb.jpg', spotifyUrl: 'https://open.spotify.com/search/Stromae%20Formidable', youtubeUrl: 'https://www.youtube.com/results?search_query=Stromae%20Formidable' },
    nowPlaying: { name: 'Dernière danse', artist: 'Indila', art: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/49/58/30/49583018-308b-431d-c691-4a28e78be8cd/14UMGIM01109.rgb.jpg/300x300bb.jpg', spotifyUrl: 'https://open.spotify.com/search/Indila%20Derni%C3%A8re%20danse', youtubeUrl: 'https://www.youtube.com/results?search_query=Indila%20Derni%C3%A8re%20danse' } }
].map(e => Object.assign({ id: e.id, createdAt: `${e.date}T${e.time || '12:00'}:00.000Z` }, e));

function defaultState() {
  return {
    profile: Object.assign({}, MOCK.defaultProfile),
    favorites: ['keio', 'nus'],
    wishlist: { 1: 'keio', 2: 'nus', 3: 'ubc' },
    confirmedSchoolId: null,
    todos: MOCK.todos.map(t => ({ id: t.id, done: t.done })),
    customTodos: [],
    targetScores: null,
    loggedIn: false,
    programRange: { start: '2026-01-05', end: '2026-12-20' },
    diaryEntries: DIARY_SEED.slice(),
    questGoals: [],
    questProgress: {}
  };
}

const AppState = {
  _cache: null,

  load() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._cache = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
    } catch (e) {
      this._cache = defaultState();
    }
    return this._cache;
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._cache));
  },

  get profile() { return this.load().profile; },

  updateProfile(patch) {
    Object.assign(this.load().profile, patch);
    this.save();
  },

  isFavorite(schoolId) { return this.load().favorites.includes(schoolId); },

  toggleFavorite(schoolId) {
    const s = this.load();
    const idx = s.favorites.indexOf(schoolId);
    if (idx >= 0) s.favorites.splice(idx, 1); else s.favorites.push(schoolId);
    this.save();
    return idx < 0;
  },

  getWishlist() { return this.load().wishlist; },

  setWishlistRank(rank, schoolId) {
    const s = this.load();
    Object.keys(s.wishlist).forEach(r => { if (s.wishlist[r] === schoolId) delete s.wishlist[r]; });
    if (schoolId) s.wishlist[rank] = schoolId; else delete s.wishlist[rank];
    this.save();
  },

  getConfirmedSchool() {
    const id = this.load().confirmedSchoolId;
    return id ? MOCK.schools.find(sc => sc.id === id) : null;
  },

  confirmSchool(schoolId) {
    this.load().confirmedSchoolId = schoolId;
    this.save();
  },

  getTodos() {
    const s = this.load();
    const map = s.todos.reduce((acc, t) => { acc[t.id] = t.done; return acc; }, {});
    const base = MOCK.todos.map(t => Object.assign({}, t, { done: map[t.id] !== undefined ? map[t.id] : t.done }));
    return base.concat(s.customTodos).sort((a, b) => a.date.localeCompare(b.date));
  },

  toggleTodo(id) {
    const s = this.load();
    let item = s.todos.find(t => t.id === id);
    if (item) { item.done = !item.done; this.save(); return; }
    item = s.customTodos.find(t => t.id === id);
    if (item) { item.done = !item.done; this.save(); }
  },

  addTodo({ title, date, tag }) {
    const s = this.load();
    const id = 'ct' + Date.now();
    s.customTodos.push({ id, title, date, tag: tag || '기타', done: false });
    this.save();
    return id;
  },

  reset() {
    this._cache = defaultState();
    this.save();
  },

  getProgramRange() { return this.load().programRange; },

  setProgramRange(start, end) {
    this.load().programRange = { start, end };
    this.save();
  },

  isDateInProgram(iso) {
    const range = this.load().programRange;
    if (!range || !range.start || !range.end) return false;
    return iso >= range.start && iso <= range.end;
  },

  // 퀘스트 — 듀오링고 로드맵처럼 여러 목표를 동시에 진행. 날짜가 아니라
  // "완료 개수"가 곧 로드맵 위치라서, 하루 건너뛰어도 페널티 없이 그 자리서 계속.
  getQuestGoals() { return this.load().questGoals || []; },
  addQuestGoal(id) {
    const s = this.load();
    s.questGoals = s.questGoals || [];
    if (!s.questGoals.includes(id)) s.questGoals.push(id);
    s.questProgress = s.questProgress || {};
    if (s.questProgress[id] === undefined) s.questProgress[id] = 0;
    this.save();
  },
  removeQuestGoal(id) {
    const s = this.load();
    s.questGoals = (s.questGoals || []).filter(g => g !== id);
    this.save();
  },
  getQuestProgress(goalId) { return (this.load().questProgress || {})[goalId] || 0; },
  completeQuest(goalId) {
    const s = this.load();
    s.questProgress = s.questProgress || {};
    s.questProgress[goalId] = (s.questProgress[goalId] || 0) + 1;
    this.save();
    return s.questProgress[goalId];
  },

  getDiaryEntries() {
    return this.load().diaryEntries.slice().sort((a, b) => a.date.localeCompare(b.date));
  },

  getDiaryEntriesByDate(iso) {
    return this.getDiaryEntries().filter(e => e.date === iso);
  },

  addDiaryEntry({ date, photos, caption, tags, location, nowPlaying, weather }) {
    const s = this.load();
    const entry = {
      id: 'd' + Date.now(),
      date,
      photos: photos || [],
      caption: caption || '',
      tags: tags || [],
      location: location || null,
      nowPlaying: nowPlaying || null,
      weather: weather || null,
      createdAt: new Date().toISOString()
    };
    s.diaryEntries.push(entry);
    this.save();
    return entry;
  },

  deleteDiaryEntry(id) {
    const s = this.load();
    s.diaryEntries = s.diaryEntries.filter(e => e.id !== id);
    this.save();
  },

  // 기록 저장 직후 비동기로 도착하는 오늘의 노래 추천을 그 기록에 영구히 붙임
  setEntrySong(id, song) {
    const s = this.load();
    const entry = s.diaryEntries.find(e => e.id === id);
    if (entry) { entry.song = song; this.save(); }
  },

  // 자기입력한 "지금 듣고 있는 노래"는 저장은 즉시 하고, 앨범 커버만 비동기로 나중에 붙임
  setEntryNowPlayingArt(id, art) {
    const s = this.load();
    const entry = s.diaryEntries.find(e => e.id === id);
    if (entry && entry.nowPlaying) { entry.nowPlaying.art = art; this.save(); }
  },

  isLoggedIn() { return !!this.load().loggedIn; },

  login() {
    this.load().loggedIn = true;
    this.save();
    document.dispatchEvent(new CustomEvent('auth:changed'));
  },

  logout() {
    this.load().loggedIn = false;
    this.save();
    document.dispatchEvent(new CustomEvent('auth:changed'));
  }
};
