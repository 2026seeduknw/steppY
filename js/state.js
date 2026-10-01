/**
 * 사용자 상태 저장소.
 *
 *   로그인 전(게스트) — 지금까지처럼 localStorage. 데모를 그대로 둘러볼 수 있고
 *     데이터는 그 기기 안에만 남는다.
 *   로그인 후 — Supabase(profiles / user_favorites / user_wishlist / user_todos)가
 *     정본이다. localStorage는 아예 쓰지 않는다 — 다른 계정으로 로그인했을 때
 *     이전 사용자의 캐시가 섞이는 사고를 원천 차단하기 위해서다.
 *
 * 페이지 컨트롤러(js/home.js, search.js …)를 한 줄도 고치지 않으려고 조회 API는
 * 전부 동기로 유지했다. 부팅 시 hydrate()가 서버 상태를 _cache에 채운 뒤
 * 'MOCK:updated'를 쏘고, 각 컨트롤러가 이미 그 이벤트를 듣고 다시 그린다.
 * 변경은 낙관적 갱신 — _cache를 먼저 바꾸고 서버 쓰기가 비동기로 따라간다.
 *
 * 게스트 상태를 로그인 계정으로 옮기지는 않는다. 게스트 기본값에는 데모용
 * 시드(이서연 프로필, keio/nus 즐겨찾기)가 들어 있어서, 그걸 실제 계정에
 * 올리면 남의 데이터처럼 보이는 값이 계정에 박힌다.
 */

/**
 * 게스트 상태 저장 키.
 *
 * v1에는 데모 프로필(이서연 · GPA 3.62 · TOEFL 96)이 통째로 들어 있었다.
 * 게스트 기본값을 빈 프로필로 바꾼 뒤에도, 이전에 앱을 열어본 브라우저에서는
 * load()의 Object.assign(guestState(), 저장값)이 그 값을 되살려서 — 점수를 한 번도
 * 입력하지 않았는데 "지원 가능" 배지가 뜨는 상태가 됐다.
 * 키에 버전을 붙여 옛 상태를 읽지 않고, 남아 있던 키는 지운다.
 */
const STORAGE_KEY = 'steppy_guest_state_v2';
const LEGACY_STORAGE_KEYS = ['xchg_demo_state_v1'];

/** 비프리미엄 사용자가 하루에 무료로 올릴 수 있는 사진 수(BM: 나머지는 프리미엄). */
const FREE_PHOTO_DAILY_LIMIT = 3;

/**
 * 크레딧 배분(BM 1단계). 서버 RPC(supabase/mentor_step.sql, bm_unlocks.sql)에도 같은
 * 값이 박혀 있다 — 화면에 보여주는 숫자일 뿐이고 실제 차감은 서버 값이 기준이다.
 * 여기를 바꾸면 SQL 쪽 상수도 같이 바꿔야 한다.
 */
const BM = {
  ASK_COST: 10,              // 멘토 질문 1건
  ANSWER_REWARD: 10,         // 답변 등록
  PHOTO_EXTRA_COST: 5,       // 하루 무료 3장을 넘긴 사진 1장
  MATCH_FREE: 3,             // 매칭 목록에서 무료로 보이는 개수
  MATCH_UNLOCK_STEP: 3,      // 한 번 풀 때 더 보이는 개수
  MATCH_UNLOCK_COST: 10,     // 한 번 푸는 데 드는 크레딧
  SIGNUP_BONUS: 50,          // 가입 보너스(30일 유효)
  SIGNUP_BONUS_DAYS: 30,
  PREMIUM_MONTHLY_CREDITS: 100
};

/**
 * 로그인하지 않은 방문자의 초기 상태.
 *
 * 예전에는 favorites:['keio','nus'], wishlist:{1:'keio',2:'nus',3:'ubc'} 시드가
 * 들어 있었는데, Supabase에 실제 271개교를 넣으면서 학교 id 체계가 슬러그
 * ('keio' → 'keio-university' 류)로 바뀌어 이 id들이 아무것도 가리키지 않게 됐다.
 * 그 결과 "지망하는 학교" 카드는 전부 비어 있는데 진행 단계는 '지망 선택 완료'로
 * 표시되는 모순이 생겼다 — 존재하지 않는 id도 길이는 3이라 hasWishlist가 true였다.
 * 비워두는 쪽이 실제 상태와 맞다.
 */
function guestState() {
  return {
    // 예전엔 MOCK.defaultProfile(이서연 · GPA 3.62 · TOEFL 96)을 그대로 썼다.
    // 그러면 게스트가 남의 성적으로 판정된 결과를 자기 것처럼 보게 된다.
    // 비워두고, 학교 찾기 화면에서 직접 입력하도록 안내한다(이 기기에만 남는다).
    profile: emptyState(null).profile,
    favorites: [],
    wishlist: {},
    confirmedSchoolId: null,
    todos: [],
    customTodos: [],
    journal: [],
    programRange: null,
    targetScores: null,
    // 게스트에게는 온보딩을 묻지 않는다 — 답을 저장할 계정이 없다
    onboardedAt: 'guest',
    // Mentor's Step — 게스트는 크레딧이 없고(질문·답변은 로그인 전용), 질문
    // 즐겨찾기도 계정에 묶인 값이라 이 기기에는 저장할 자리가 없다.
    credits: 0,
    questionFavorites: [],
    favoriteCountries: [],
    matchUnlocks: {}
  };
}

/** 가입 직후처럼 서버에 아무것도 없는 계정의 초기 형태. */
/**
 * 오늘 날짜를 YYYY-MM-DD로. toISOString()은 UTC로 바꿔버려서 한국 시간 자정~오전 9시
 * 사이에 하루 전 날짜가 나온다. 기록은 "오늘 쓴 것"이 중요하므로 로컬 날짜를 쓴다.
 */
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 학점 표시 — 소수점 아래 첫째 자리는 늘 보이고, 둘째 자리는 있을 때만.
 *   4 → "4.0"   4.3 → "4.3"   3.62 → "3.62"   3.60 → "3.6"
 * 정수로 떨어지면 "4"처럼 보여 만점(4.3)과 나란히 놓였을 때 어색했다.
 * 입력은 그대로 0.01 단위를 받는다 — 표시만 다듬는 것이다.
 */
function formatGpa(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '';
  const cents = Math.round(Number(v) * 100);   // 1.1*10 같은 부동소수 오차를 피하려고 정수로 본다
  return (cents % 10 === 0 ? (cents / 100).toFixed(1) : (cents / 100).toFixed(2));
}

function emptyState(displayName) {
  return {
    profile: {
      name: displayName || '회원',
      major: null,
      // 확정 학교에서 신청한 전공(현지 학과명). 연세 전공(major)과는 다른 값이다.
      targetMajor: null,
      gpa: null,
      gpaScale: 4.3,
      languageTests: [],
      // 컨트롤러들이 exchangeTerm.year / .season을 바로 읽으므로 null로 두지 않는다
      exchangeTerm: { unit: 'semester', season: '가을학기', year: new Date().getFullYear() + 1 },
      targetScoreSimUsed: false,
      // null(또는 지난 시각)이면 비프리미엄. supabase/premium.sql의 profiles.premium_until.
      premiumUntil: null
    },
    favorites: [],
    wishlist: {},
    confirmedSchoolId: null,
    todos: [],
    customTodos: [],
    journal: [],
    programRange: null,
    targetScores: null,
    onboardedAt: null,
    credits: 0,
    questionFavorites: [],
    // Mentor's Step에서 별표한 국가(한글 국가명) — profiles.favorite_countries
    favoriteCountries: [],
    // 매칭 목록별로 크레딧을 써서 푼 횟수 { listKey: 횟수 } — supabase/bm_unlocks.sql의 match_unlocks
    matchUnlocks: {}
  };
}

const AppState = {
  _cache: null,
  _hydrated: false,

  load() {
    if (this._cache) return this._cache;
    // hydrate() 이전에 동기로 불리면 일단 게스트 상태로 시작한다.
    // 로그인 상태라면 hydrate()가 곧 서버 값으로 통째로 갈아끼운다.
    try {
      LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
      const raw = localStorage.getItem(STORAGE_KEY);
      this._cache = raw ? Object.assign(guestState(), JSON.parse(raw)) : guestState();
    } catch (e) {
      this._cache = guestState();
    }
    return this._cache;
  },

  get isAuthed() { return typeof Auth !== 'undefined' && Auth.isAuthed; },

  /* needsOnboarding 게터는 지웠다 — 온보딩으로 강제 이동시키던 유일한 호출부가
     사라졌다(layout.js). 홈의 버튼은 "물어봤는지"가 아니라 "학과·학점이 실제로
     비었는지"를 본다. 그래야 건너뛴 사람에게도, 이 화면이 생기기 전에 가입한
     사람에게도 같은 안내가 뜬다. */

  /** 기본 정보를 저장한 시점을 남긴다. 언제 받았는지 알아야 할 때 쓴다. */
  markOnboarded() {
    const now = new Date().toISOString();
    this.load().onboardedAt = now;
    this.save();
    this._push(() => supabaseClient.from('profiles')
      .upsert({ id: Auth.userId, onboarded_at: now }), '온보딩 상태');
  },

  save() {
    // 로그인 상태에서는 서버가 정본이라 로컬에 남기지 않는다.
    if (this.isAuthed) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._cache)); } catch (e) { /* 사파리 프라이빗 모드 등 */ }
  },

  /* ------------------------------------------------------------------ 읽기 */

  get profile() { return this.load().profile; },
  isFavorite(schoolId) { return this.load().favorites.includes(schoolId); },
  getWishlist() { return this.load().wishlist; },

  /* -------------------------------------------------------- Mentor's Step */

  getCredits() { return this.isAuthed ? this.load().credits : 0; },
  isQuestionFavorite(id) { return this.load().questionFavorites.includes(id); },
  getFavoriteCountries() { return this.isAuthed ? this.load().favoriteCountries : []; },
  isCountryFavorite(country) { return this.getFavoriteCountries().includes(country); },

  /** 국가 별표 켜기/끄기. 몇 개 안 되는 짧은 목록이라 profiles 한 칸에 배열로 통째로 쓴다. */
  toggleCountryFavorite(country) {
    const s = this.load();
    const list = s.favoriteCountries || (s.favoriteCountries = []);
    const idx = list.indexOf(country);
    const added = idx < 0;
    if (added) list.push(country); else list.splice(idx, 1);
    const next = list.slice();
    this._push(() => supabaseClient.from('profiles')
      .upsert({ id: Auth.userId, favorite_countries: next }), '국가 즐겨찾기');
    return added;
  },

  /* --------------------------------------------------------------- BM(프리미엄/크레딧 가격) */

  /** 프리미엄 구독 중인지. premiumUntil이 없거나 이미 지났으면 false. */
  isPremium() {
    const until = this.profile.premiumUntil;
    return !!until && new Date(until).getTime() > Date.now();
  },
  /** 크레딧 구매 가격표 — DB(supabase/premium.sql)가 채워지면 그 값, 아니면 mock-data.js의 자리표시자. */
  getCreditPackages() { return MOCK.creditPackages || []; },
  getPremiumPlans() { return MOCK.premiumPlans || []; },

  /**
   * 사진 하루 3장 무료 한도. 크레딧과 달리 돈이 걸린 조작(잔액 위변조)이
   * 아니라 "그날 몇 장 더 올리느냐"일 뿐이라, 서버 RPC 없이 기기별
   * localStorage 카운터로 가볍게 막는다. 프리미엄이면 무제한.
   */
  freePhotoUploadsLeft() {
    if (this.isPremium()) return Infinity;
    return Math.max(0, FREE_PHOTO_DAILY_LIMIT + this._todayExtraPhotos() - this._todayPhotoCount());
  },
  recordPhotoUpload() {
    if (this.isPremium()) return;
    try { localStorage.setItem(this._photoCountKey(), String(this._todayPhotoCount() + 1)); } catch (e) { /* 사파리 프라이빗 모드 등 */ }
  },
  _photoCountKey() {
    const uid = (this.isAuthed && typeof Auth !== 'undefined') ? Auth.userId : 'guest';
    return `steppy_photo_uploads_${uid}_${todayISO()}`;
  },
  _todayPhotoCount() {
    try { return Number(localStorage.getItem(this._photoCountKey())) || 0; } catch (e) { return 0; }
  },
  _todayExtraPhotos() {
    try { return Number(localStorage.getItem(this._photoCountKey() + '_extra')) || 0; } catch (e) { return 0; }
  },

  /**
   * 크레딧으로 오늘 사진 1장을 더 올릴 수 있게 한다. 차감은 서버(spend_photo_credit)가
   * 잔액을 확인해서 하고, 성공했을 때만 오늘 한도를 1 늘린다 — 한도 자체는 무료 3장과
   * 같은 기기별 카운터라 돈이 걸린 부분(차감)만 서버에 맡긴다.
   */
  async buyExtraPhoto() {
    if (!this.isAuthed) return { ok: false, error: 'auth_required' };
    const { data, error } = await supabaseClient.rpc('spend_photo_credit');
    if (error) return { ok: false, error };
    this.load().credits = typeof data === 'number' ? data : this.load().credits - BM.PHOTO_EXTRA_COST;
    try { localStorage.setItem(this._photoCountKey() + '_extra', String(this._todayExtraPhotos() + 1)); } catch (e) { /* 무시 */ }
    document.dispatchEvent(new CustomEvent('credits:changed'));
    return { ok: true };
  },

  /* ---------------------------------------------- 매칭 목록 잠금(처음 3개 무료) */

  /** 이 목록에서 지금 보여줄 수 있는 개수. 게스트는 늘 무료 개수만. */
  visibleMatchCount(listKey) {
    const steps = this.isAuthed ? (this.load().matchUnlocks[listKey] || 0) : 0;
    return BM.MATCH_FREE + steps * BM.MATCH_UNLOCK_STEP;
  },

  /** 크레딧을 써서 이 목록을 3개 더 연다. 잔액 확인·차감·기록은 서버가 한 번에 한다. */
  async unlockMatches(listKey) {
    if (!this.isAuthed) return { ok: false, error: 'auth_required' };
    const { data, error } = await supabaseClient.rpc('unlock_match_list', { p_list_key: listKey });
    if (error) return { ok: false, error };
    const row = Array.isArray(data) ? data[0] : data;
    const s = this.load();
    s.matchUnlocks[listKey] = row ? row.steps : (s.matchUnlocks[listKey] || 0) + 1;
    if (row && typeof row.balance === 'number') s.credits = row.balance;
    else s.credits -= BM.MATCH_UNLOCK_COST;
    document.dispatchEvent(new CustomEvent('credits:changed'));
    return { ok: true };
  },

  toggleQuestionFavorite(id) {
    const s = this.load();
    const idx = s.questionFavorites.indexOf(id);
    const added = idx < 0;
    if (added) s.questionFavorites.push(id); else s.questionFavorites.splice(idx, 1);
    this.save();
    this._push(() => added
      ? supabaseClient.from('mentor_favorites').insert({ user_id: Auth.userId, question_id: id })
      : supabaseClient.from('mentor_favorites').delete().eq('user_id', Auth.userId).eq('question_id', id),
      '질문 즐겨찾기');
    return added;
  },

  /**
   * 질문 등록·답변은 크레딧이 걸려 있어 다른 쓰기처럼 낙관적으로 먼저 화면을
   * 바꾸고 보지 않는다 — 서버 RPC(ask_question/submit_answer, supabase/mentor_step.sql)가
   * 잔액을 원자적으로 확인·차감/적립한 "성공한 값"을 받은 뒤에야 로컬 상태를 바꾼다.
   * 실패(크레딧 부족 등)를 사용자에게 보여줘야 해서 큐에 흘려보내지 않고 직접 await한다.
   */
  async askQuestion({ country, schoolId, title, body }) {
    if (!this.isAuthed) return { ok: false, error: 'auth_required' };
    const { data, error } = await supabaseClient.rpc('ask_question', {
      p_country: country, p_school_id: schoolId || null, p_title: title, p_body: body
    });
    if (error) return { ok: false, error };
    const row = Array.isArray(data) ? data[0] : data;
    const question = {
      id: row.id, authorId: row.author_id, country: row.country, schoolId: row.school_id,
      title: row.title, body: row.body, createdAt: row.created_at, answers: []
    };
    MOCK.mentorQuestions.unshift(question);
    this.load().credits -= BM.ASK_COST;
    this.save();
    document.dispatchEvent(new CustomEvent('MOCK:updated'));
    return { ok: true, question };
  },

  async submitAnswer({ questionId, body }) {
    if (!this.isAuthed) return { ok: false, error: 'auth_required' };
    const { data, error } = await supabaseClient.rpc('submit_answer', {
      p_question_id: questionId, p_body: body
    });
    if (error) return { ok: false, error };
    const row = Array.isArray(data) ? data[0] : data;
    const answer = { id: row.id, authorId: row.author_id, body: row.body, createdAt: row.created_at };
    const question = MOCK.mentorQuestions.find(q => q.id === questionId);
    if (question) question.answers.push(answer);
    this.load().credits += BM.ANSWER_REWARD;
    this.save();
    document.dispatchEvent(new CustomEvent('MOCK:updated'));
    return { ok: true, answer };
  },

  getConfirmedSchool() {
    const id = this.load().confirmedSchoolId;
    return id ? MOCK.schools.find(sc => sc.id === id) : null;
  },

  getTodos() {
    // 로그인 전에는 보여줄 개인 데이터가 없다. MOCK.todos는 계정에 붙는 기본
    // 체크리스트라, 게스트에게 띄우면 남의 일정처럼 보이고 체크해도 남지 않는다.
    if (!this.isAuthed) return [];
    const s = this.load();
    const map = s.todos.reduce((acc, t) => { acc[t.id] = t.done; return acc; }, {});
    const base = MOCK.todos.map(t => Object.assign({}, t, { done: map[t.id] !== undefined ? map[t.id] : t.done }));
    // 기한 없는 할 일(체크리스트에서 옮겨 온 것 등)은 맨 뒤로
    return base.concat(s.customTodos).sort((a, b) => {
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
      return a.date.localeCompare(b.date);
    });
  },

  /**
   * 기록하기 — 최신 날짜가 위. 같은 날이면 나중에 쓴 것이 위.
   * 할 일과 달리 기본 제공 항목이 없어서, 로그인 전에는 그냥 빈 목록이다.
   */
  getJournal() {
    if (!this.isAuthed) return [];
    return this.load().journal.slice().sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  },

  /* ------------------------------------------------------------------ 쓰기 */

  updateProfile(patch) {
    Object.assign(this.load().profile, patch);
    this.save();
    const p = this.load().profile;
    this._push(() => supabaseClient.from('profiles').upsert({
      id: Auth.userId,
      name: p.name,
      major: p.major,
      target_major: p.targetMajor || null,
      gpa: p.gpa,
      gpa_scale: p.gpaScale,
      language_tests: p.languageTests || [],
      exchange_term: p.exchangeTerm
    }), '프로필');
  },

  toggleFavorite(schoolId) {
    const s = this.load();
    const idx = s.favorites.indexOf(schoolId);
    const added = idx < 0;
    if (added) s.favorites.push(schoolId); else s.favorites.splice(idx, 1);
    this.save();
    this._push(() => added
      ? supabaseClient.from('user_favorites').insert({ user_id: Auth.userId, school_id: schoolId })
      : supabaseClient.from('user_favorites').delete().eq('user_id', Auth.userId).eq('school_id', schoolId),
      '즐겨찾기');
    return added;
  },

  setWishlistRank(rank, schoolId) {
    const s = this.load();
    // 같은 학교가 다른 순위에 있으면 먼저 뺀다 (DB의 user_wishlist_school_once 제약과 동일)
    Object.keys(s.wishlist).forEach(r => { if (s.wishlist[r] === schoolId) delete s.wishlist[r]; });
    if (schoolId) s.wishlist[rank] = schoolId; else delete s.wishlist[rank];
    this.save();

    const rows = Object.keys(s.wishlist).map(r => ({
      user_id: Auth.userId, rank: Number(r), school_id: s.wishlist[r]
    }));
    // 순위 재배치는 부분 갱신보다 "이 사용자 지망 전체를 다시 쓰기"가 안전하다.
    this._push(async () => {
      const del = await supabaseClient.from('user_wishlist').delete().eq('user_id', Auth.userId);
      if (del.error) return del;
      return rows.length ? supabaseClient.from('user_wishlist').insert(rows) : del;
    }, '지망 학교');
  },

  confirmSchool(schoolId) {
    this.load().confirmedSchoolId = schoolId;
    this.save();
    this._push(() => supabaseClient.from('profiles')
      .upsert({ id: Auth.userId, confirmed_school_id: schoolId }), '확정 학교');
  },

  toggleTodo(id) {
    const s = this.load();
    const base = s.todos.find(t => t.id === id);
    if (base) {
      base.done = !base.done;
      this.save();
      this._push(() => supabaseClient.from('user_todos')
        .upsert({ user_id: Auth.userId, base_id: id, done: base.done },
                { onConflict: 'user_id,base_id' }), '할 일');
      return;
    }
    // MOCK.todos에는 있지만 아직 오버라이드 행이 없는 기본 항목
    const seed = MOCK.todos.find(t => t.id === id);
    if (seed) {
      const row = { id, done: !seed.done };
      s.todos.push(row);
      this.save();
      this._push(() => supabaseClient.from('user_todos')
        .upsert({ user_id: Auth.userId, base_id: id, done: row.done },
                { onConflict: 'user_id,base_id' }), '할 일');
      return;
    }
    const custom = s.customTodos.find(t => t.id === id);
    if (custom) {
      custom.done = !custom.done;
      this.save();
      this._push(() => supabaseClient.from('user_todos')
        .update({ done: custom.done }).eq('id', id).eq('user_id', Auth.userId), '할 일');
    }
  },

  addTodo({ title, date, tag }) {
    const s = this.load();
    // 서버가 uuid를 돌려주기 전까지 쓸 임시 id. 응답이 오면 아래에서 바꿔치기한다.
    const tempId = 'ct' + Date.now();
    const item = { id: tempId, title, date: date || null, tag: tag || '기타', done: false };
    s.customTodos.push(item);
    this.save();

    if (this.isAuthed) {
      this._push(async () => {
        const res = await supabaseClient.from('user_todos')
          .insert({ user_id: Auth.userId, title, due_date: item.date, tag: item.tag, done: false })
          .select('id')
          .single();
        // 이후 toggleTodo가 서버 행을 찾을 수 있도록 실제 id로 교체
        if (!res.error && res.data) item.id = res.data.id;
        return res;
      }, '할 일 추가');
    }
    return tempId;
  },

  /* ------------------------------------------------- 파견 기간 / 사진 */

  /**
   * 파견 기간이 없으면 null. Day N·진행 바는 이 값이 있어야 그린다.
   *
   * 확정한 학교가 없으면 기간도 없는 것으로 본다. 학교 확정을 취소해도
   * programRange 는 남는데, 그대로 두면 hasDeparted() 가 계속 true 라
   * 취소한 뒤에도 탭바가 "출국 후" 모양(학점 인정 없음 + 교환보고서 있음)으로
   * 남았다. 갈 학교가 없는데 출국했을 수는 없다.
   * 값 자체는 지우지 않는다 — 같은 학교를 다시 확정하면 날짜를 다시 입력하지
   * 않아도 되고, 확정 전에는 이 게터를 지나 어디에도 닿지 않는다.
   */
  getProgramRange() {
    if (!this.load().confirmedSchoolId) return null;
    return this.load().programRange;
  },

  setProgramRange(start, end) {
    this.load().programRange = (start && end) ? { start, end } : null;
    this.save();
    this._push(() => supabaseClient.from('profiles')
      .upsert({ id: Auth.userId, program_start: start || null, program_end: end || null }), '파견 기간');
  },

  isDateInProgram(iso) {
    const r = this.getProgramRange();
    // 기간을 아직 안 정했으면 막지 않는다 — 기록부터 하게 두고 기간은 나중에 받는다
    if (!r) return true;
    return iso >= r.start && iso <= r.end;
  },

  /**
   * 사진은 Postgres가 아니라 Storage(diary-photos, 비공개)에 올리고 경로만 행에 남긴다.
   * base64로 들고 있으면 행이 수 MB씩 불어나 목록 조회가 통째로 느려지고,
   * localStorage(5MB)에는 몇 장 만에 들어가지 않는다.
   * 경로 첫 칸이 user_id라 Storage 정책이 남의 폴더를 막는다.
   */
  async uploadDiaryPhoto(blob) {
    const name = `${Auth.userId}/${crypto.randomUUID()}.jpg`;
    const res = await supabaseClient.storage.from('diary-photos')
      .upload(name, blob, { contentType: 'image/jpeg', upsert: false });
    if (res.error) throw res.error;
    return name;
  },

  /**
   * 비공개 버킷이라 <img src>에 바로 못 쓴다. 한 시간짜리 서명 URL로 바꿔 준다.
   * 경로 하나씩 요청하면 화면에 사진 수만큼 왕복이 생기므로 한 번에 묶어 받는다.
   */
  async signPhotoPaths(paths) {
    const unique = [...new Set(paths.filter(Boolean))];
    if (!unique.length) return {};
    const res = await supabaseClient.storage.from('diary-photos').createSignedUrls(unique, 3600);
    if (res.error) return {};
    const map = {};
    res.data.forEach(r => { if (r.signedUrl) map[r.path] = r.signedUrl; });
    return map;
  },

  /* -------------------------------------------------------- 기록하기 */

  addJournalEntry({ date, phase, title, body, photos, tags, location, nowPlaying, weather, visibility, takenAt }) {
    const s = this.load();
    // addTodo와 같은 방식 — 서버 uuid가 오기 전까지 쓸 임시 id
    const tempId = 'j' + Date.now();
    const entry = {
      id: tempId,
      date: date || todayISO(),
      phase: phase === 'abroad' ? 'abroad' : 'prepare',
      title: title || '',
      body: body || '',
      photos: photos || [],
      tags: tags || [],
      location: location || null,
      // 저장 직후 비동기로 추천받아 채워지는 자리. 실패하면 그냥 null로 남는다.
      song: null,
      nowPlaying: nowPlaying || null,
      weather: weather || null,
      // 새 기록은 친구 공개가 기본이다(supabase/friends.sql). 쓰는 창에서 끄면 'private'.
      visibility: visibility === 'private' ? 'private' : 'friends',
      // 기록 시각 — 사진을 찍은 시각이 있으면 그걸 쓴다(같은 날 사진을 찍은 순서로 세우려고). 서버 created_at에도 그대로 넣는다.
      createdAt: (takenAt instanceof Date && !isNaN(takenAt) ? takenAt : new Date()).toISOString()
    };
    s.journal.push(entry);
    this.save();

    if (this.isAuthed) {
      this._push(async () => {
        const res = await supabaseClient.from('user_journal')
          .insert({
            user_id: Auth.userId,
            entry_date: entry.date,
            phase: entry.phase,
            title: entry.title || null,
            body: entry.body,
            photos: entry.photos,
            tags: entry.tags,
            location: entry.location,
            now_playing: entry.nowPlaying,
            weather: entry.weather,
            visibility: entry.visibility,
            created_at: entry.createdAt
          })
          .select('id, created_at')
          .single();
        // 수정·삭제가 서버 행을 찾을 수 있도록 실제 id로 교체.
        // 바꾼 뒤 반드시 다시 그려야 한다 — 목록 DOM에는 임시 id가 박혀 있어서,
        // 그대로 두면 방금 쓴 기록의 수정/삭제 버튼이 없는 id를 가리킨다.
        if (!res.error && res.data) {
          // 화면이 임시 id로 잡아둔 것(예: 방금 만든 기록을 곧바로 수정 중)이
          // 바뀐 id를 따라올 수 있도록 옛 id를 남겨둔다.
          entry.tempId = entry.id;
          entry.id = res.data.id;
          // 임시 id로 폴더 등에 담아 둔 곳이 있으면 따라 바꿀 수 있게 알린다(js/diary-archive.js)
          document.dispatchEvent(new CustomEvent('journal:idchanged', { detail: { from: entry.tempId, to: entry.id } }));
          entry.createdAt = res.data.created_at;
          this.save();
          document.dispatchEvent(new CustomEvent('MOCK:updated'));
        }
        return res;
      }, '기록 추가');
    }
    return entry;
  },

  /*
   * 아래 둘은 .eq('id', id)가 아니라 .eq('id', entry.id)를 쓴다.
   * 방금 만든 기록은 서버 uuid가 오기 전까지 임시 id('j…')를 달고 있는데,
   * 그 사이에 수정/삭제를 누르면 uuid가 아닌 값이 Postgres로 날아가 22P02로 깨진다.
   * 쓰기 큐가 순서를 지켜주므로(insert가 항상 먼저 끝난다) 실행 시점에 entry.id를
   * 읽으면 언제나 진짜 uuid다.
   */
  /*
   * 저장이 끝난 뒤 추천이 도착해서 노래만 따로 붙인다.
   * updateJournalEntry를 쓰지 않는 이유 — 그쪽은 본문·날짜를 통째로 덮어쓰기 때문에,
   * 추천이 늦게 오는 사이 사용자가 글을 고쳤다면 그 수정을 되돌려 버린다.
   * 여기서는 song 한 칸만 건드린다.
   */
  setEntrySong(id, song) {
    const entry = this.load().journal.find(e => e.id === id || e.tempId === id);
    if (!entry) return;
    entry.song = song;
    this.save();
    document.dispatchEvent(new CustomEvent('MOCK:updated'));
    if (!this.isAuthed) return;
    // entry.id를 실행 시점에 읽는다 — 큐가 insert를 먼저 끝내주므로 그때는 진짜 uuid다.
    this._push(() => supabaseClient.from('user_journal')
      .update({ song: entry.song })
      .eq('id', entry.id).eq('user_id', Auth.userId), '노래 저장');
  },

  updateJournalEntry(id, patch) {
    const entry = this.load().journal.find(e => e.id === id || e.tempId === id);
    if (!entry) return;
    Object.assign(entry, patch);
    this.save();
    if (!this.isAuthed) return;
    this._push(() => supabaseClient.from('user_journal')
      .update({
        entry_date: entry.date,
        phase: entry.phase,
        title: entry.title || null,
        body: entry.body,
        photos: entry.photos || [],
        tags: entry.tags || [],
        now_playing: entry.nowPlaying || null,
        visibility: entry.visibility === 'friends' ? 'friends' : 'private',
        updated_at: new Date().toISOString()
      })
      .eq('id', entry.id).eq('user_id', Auth.userId), '기록 수정');
  },

  deleteJournalEntry(id) {
    const s = this.load();
    const i = s.journal.findIndex(e => e.id === id);
    if (i === -1) return;
    const entry = s.journal[i];
    s.journal.splice(i, 1);
    this.save();
    if (!this.isAuthed) return;
    this._push(async () => {
      const res = await supabaseClient.from('user_journal')
        .delete().eq('id', entry.id).eq('user_id', Auth.userId);
      // 행만 지우면 Storage에 사진이 그대로 남는다. 아무도 참조하지 않는 파일이라
      // 용량만 먹고 영영 지워지지 않으므로 같이 치운다. 행 삭제가 실패했으면
      // 사진은 아직 쓰이고 있으니 건드리지 않는다.
      if (!res.error && entry.photos && entry.photos.length) {
        await supabaseClient.storage.from('diary-photos').remove(entry.photos);
      }
      return res;
    }, '기록 삭제');
  },

  reset() {
    this._cache = this.isAuthed ? emptyState(this._displayName()) : guestState();
    this.save();
  },

  /* ------------------------------------------------------------ 부팅/동기화 */

  _displayName() {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    if (!user) return null;
    const meta = user.user_metadata || {};
    return meta.name || (user.email ? user.email.split('@')[0] : '회원');
  },

  /**
   * 서버 상태를 _cache에 채운다. 페이지 컨트롤러들이 이미 듣고 있는
   * 'MOCK:updated'를 재사용해 다시 그리게 한다(전체 재렌더 신호로 쓰인다).
   */
  async hydrate() {
    if (typeof Auth === 'undefined') { this.load(); return; }
    await Auth.init();

    if (!Auth.isAuthed) {
      this._cache = null;
      this.load();
      this._hydrated = true;
      document.dispatchEvent(new CustomEvent('MOCK:updated'));
      return;
    }

    const uid = Auth.userId;
    // RLS가 이미 자기 행만 보이게 하지만, 필터를 명시해 인덱스를 타게 한다.
    const [prof, favs, wish, todos, journal, credits, qFavs, unlocks, creditTotal] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabaseClient.from('user_favorites').select('school_id').eq('user_id', uid),
      supabaseClient.from('user_wishlist').select('rank, school_id').eq('user_id', uid),
      supabaseClient.from('user_todos').select('id, base_id, title, due_date, tag, done').eq('user_id', uid),
      supabaseClient.from('user_journal').select('id, entry_date, phase, title, body, photos, tags, location, song, now_playing, weather, visibility, created_at').eq('user_id', uid),
      supabaseClient.from('user_credits').select('balance').eq('user_id', uid).maybeSingle(),
      supabaseClient.from('mentor_favorites').select('question_id').eq('user_id', uid),
      supabaseClient.from('match_unlocks').select('list_key, steps').eq('user_id', uid),
      // 기한 있는 크레딧(가입 보너스·프리미엄 증정)까지 더한 잔액 — bm_unlocks.sql
      supabaseClient.rpc('my_credit_total')
    ]);

    // friends.sql(visibility 컬럼)을 아직 안 돌린 서버면 위 조회가 통째로 실패한다 —
    // 기록이 사라진 것처럼 보이지 않게 컬럼 없이 한 번 더 읽는다.
    if (journal.error) {
      const fallback = await supabaseClient.from('user_journal')
        .select('id, entry_date, phase, title, body, photos, tags, location, song, now_playing, weather, created_at')
        .eq('user_id', uid);
      journal.data = fallback.data;
    }

    const next = emptyState(this._displayName());
    const p = prof.data;
    if (p) {
      next.profile = {
        name: p.name || this._displayName(),
        major: p.major,
        targetMajor: p.target_major || null,
        gpa: p.gpa === null ? null : Number(p.gpa),
        gpaScale: p.gpa_scale === null ? 4.3 : Number(p.gpa_scale),
        languageTests: p.language_tests || [],
        exchangeTerm: p.exchange_term || next.profile.exchangeTerm,
        targetScoreSimUsed: false,
        // premium.sql이 아직 적용되지 않았으면 이 컬럼이 없어 p.premium_until은 그냥 undefined다.
        premiumUntil: p.premium_until || null
      };
      next.confirmedSchoolId = p.confirmed_school_id || null;
      next.targetScores = p.target_scores || null;
      next.onboardedAt = p.onboarded_at || null;
      // mentor_country_favorites.sql 전이면 컬럼이 없어 undefined → 빈 목록
      next.favoriteCountries = Array.isArray(p.favorite_countries) ? p.favorite_countries : [];
      // 둘 다 있어야 Day N을 셀 수 있다. 하나만 있으면 없는 것으로 친다.
      next.programRange = (p.program_start && p.program_end)
        ? { start: p.program_start, end: p.program_end }
        : null;
    }
    if (favs.data) next.favorites = favs.data.map(r => r.school_id);
    // mentor_step.sql이 아직 적용되지 않았으면 이 두 조회는 조용히 에러만 나고
    // data는 null이다 — 그대로 기본값(0, [])으로 남아 화면이 깨지지 않는다.
    if (credits.data) next.credits = credits.data.balance;
    // bm_unlocks.sql 전에는 이 RPC가 없어 에러 → 위의 기한 없는 잔액 그대로 쓴다
    if (!creditTotal.error && typeof creditTotal.data === 'number') next.credits = creditTotal.data;
    if (qFavs.data) next.questionFavorites = qFavs.data.map(r => r.question_id);
    // bm_unlocks.sql 전이면 에러만 나고 빈 객체로 남는다 — 목록은 무료 3개만 보인다.
    if (unlocks.data) unlocks.data.forEach(r => { next.matchUnlocks[r.list_key] = r.steps; });
    if (wish.data) wish.data.forEach(r => { next.wishlist[r.rank] = r.school_id; });
    if (todos.data) {
      next.todos = todos.data.filter(r => r.base_id).map(r => ({ id: r.base_id, done: r.done }));
      next.customTodos = todos.data.filter(r => !r.base_id).map(r => ({
        id: r.id, title: r.title, date: r.due_date, tag: r.tag, done: r.done
      }));
    }

    if (journal.data) {
      next.journal = journal.data.map(r => ({
        id: r.id,
        date: r.entry_date,
        phase: r.phase,
        title: r.title || '',
        body: r.body || '',
        photos: r.photos || [],
        tags: r.tags || [],
        location: r.location || null,
        song: r.song || null,
        nowPlaying: r.now_playing || null,
        weather: r.weather || null,
        // friends.sql 이전에 쓴 기록·SQL 미적용 환경은 비공개로 본다
        visibility: r.visibility === 'friends' ? 'friends' : 'private',
        createdAt: r.created_at
      }));
    }

    this._cache = next;
    this._hydrated = true;
    document.dispatchEvent(new CustomEvent('MOCK:updated'));
  },

  // 서버 쓰기 직렬화 큐.
  // setWishlistRank()는 "이 사용자 지망 전체 삭제 후 재삽입"이라, 순위를 연속으로
  // 빠르게 바꾸면 두 요청이 겹쳐 앞선 insert와 뒤이은 insert가 user_wishlist_pkey를
  // 두고 충돌한다(23505). 낙관적 갱신이라 화면은 이미 맞는 값이므로, 서버 쓰기만
  // 순서대로 흘려보내면 된다.
  _queue: Promise.resolve(),

  /** 마지막 서버 쓰기에서 난 오류. 호출부가 이동 여부를 정할 때 본다. */
  lastWriteError: null,

  /**
   * 대기 중인 서버 쓰기가 모두 끝날 때까지 기다린다.
   *
   * 쓰기는 낙관적이라 보통은 기다릴 필요가 없지만, 쓰기 직후 페이지를 옮기는
   * 경우에는 얘기가 다르다. 온보딩이 그랬다 — markOnboarded() 직후 홈으로
   * 이동했더니, 홈에서 새로 읽은 onboarded_at이 아직 null이라 온보딩으로
   * 다시 튕겨 무한 왕복이 됐다.
   */
  flush() { return this._queue; },

  /** 로그인 상태에서만 서버로 쓴다. 실패는 조용히 삼키지 않고 토스트로 알린다. */
  _push(run, label) {
    if (!this.isAuthed) return;
    this._queue = this._queue
      .then(run)
      .then(res => {
        if (res && res.error) throw res.error;
      })
      .catch(err => {
        this.lastWriteError = err;
        console.error(`[AppState] ${label} 저장 실패`, err);
        if (typeof showToast === 'function') showToast(`${label} 저장에 실패했어요. 잠시 후 다시 시도해 주세요.`);
        // 체인을 끊지 않아야 이후 쓰기가 계속 흐른다
      });
  }
};

// 로그아웃/로그인 전환 시 이전 사용자의 상태가 남지 않도록 통째로 다시 읽는다.
document.addEventListener('auth:changed', () => {
  AppState._cache = null;
  AppState.hydrate();
});

AppState.hydrate();
