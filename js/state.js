/**
 * 데모용 클라이언트 상태 저장소.
 * 실제 백엔드가 없는 정적 데모이므로, 페이지 이동 간(F2→F3→F4) 데이터가
 * 유지되도록 localStorage를 얕은 DB처럼 사용합니다.
 * 실서비스에서는 이 모듈 전체가 서버 API 호출로 대체됩니다.
 */

const STORAGE_KEY = 'xchg_demo_state_v1';

function defaultState() {
  return {
    profile: Object.assign({}, MOCK.defaultProfile),
    favorites: ['keio', 'nus'],
    wishlist: { 1: 'keio', 2: 'nus', 3: 'ubc' },
    confirmedSchoolId: null,
    todos: MOCK.todos.map(t => ({ id: t.id, done: t.done })),
    customTodos: [],
    targetScores: null,
    loggedIn: false
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
