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
    targetScores: null,
    // 게스트에게는 온보딩을 묻지 않는다 — 답을 저장할 계정이 없다
    onboardedAt: 'guest'
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

function emptyState(displayName) {
  return {
    profile: {
      name: displayName || '회원',
      major: null,
      gpa: null,
      gpaScale: 4.3,
      languageTests: [],
      // 컨트롤러들이 exchangeTerm.year / .season을 바로 읽으므로 null로 두지 않는다
      exchangeTerm: { unit: 'semester', season: '가을학기', year: new Date().getFullYear() + 1 },
      targetScoreSimUsed: false
    },
    favorites: [],
    wishlist: {},
    confirmedSchoolId: null,
    todos: [],
    customTodos: [],
    journal: [],
    targetScores: null,
    onboardedAt: null
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

  /**
   * 아직 온보딩을 안내한 적 없는 로그인 계정인지.
   * 프로필이 비어 있다는 사실과 "물어봤다"는 사실은 다르다 — 건너뛴 사용자에게
   * 매번 다시 묻지 않으려면 후자를 따로 기록해야 한다.
   */
  get needsOnboarding() {
    return this.isAuthed && this._hydrated && !this.load().onboardedAt;
  },

  /** 온보딩을 마쳤거나 건너뛴 시점을 남긴다. */
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
    return base.concat(s.customTodos).sort((a, b) => a.date.localeCompare(b.date));
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
    const item = { id: tempId, title, date, tag: tag || '기타', done: false };
    s.customTodos.push(item);
    this.save();

    if (this.isAuthed) {
      this._push(async () => {
        const res = await supabaseClient.from('user_todos')
          .insert({ user_id: Auth.userId, title, due_date: date, tag: item.tag, done: false })
          .select('id')
          .single();
        // 이후 toggleTodo가 서버 행을 찾을 수 있도록 실제 id로 교체
        if (!res.error && res.data) item.id = res.data.id;
        return res;
      }, '할 일 추가');
    }
    return tempId;
  },

  /* -------------------------------------------------------- 기록하기 */

  addJournalEntry({ date, phase, title, body }) {
    const s = this.load();
    // addTodo와 같은 방식 — 서버 uuid가 오기 전까지 쓸 임시 id
    const tempId = 'j' + Date.now();
    const entry = {
      id: tempId,
      date: date || todayISO(),
      phase: phase === 'abroad' ? 'abroad' : 'prepare',
      title: title || '',
      body: body || '',
      createdAt: new Date().toISOString()
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
            body: entry.body
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
  updateJournalEntry(id, patch) {
    const entry = this.load().journal.find(e => e.id === id);
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
    this._push(() => supabaseClient.from('user_journal')
      .delete().eq('id', entry.id).eq('user_id', Auth.userId), '기록 삭제');
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
    const [prof, favs, wish, todos, journal] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabaseClient.from('user_favorites').select('school_id').eq('user_id', uid),
      supabaseClient.from('user_wishlist').select('rank, school_id').eq('user_id', uid),
      supabaseClient.from('user_todos').select('id, base_id, title, due_date, tag, done').eq('user_id', uid),
      supabaseClient.from('user_journal').select('id, entry_date, phase, title, body, created_at').eq('user_id', uid)
    ]);

    const next = emptyState(this._displayName());
    const p = prof.data;
    if (p) {
      next.profile = {
        name: p.name || this._displayName(),
        major: p.major,
        gpa: p.gpa === null ? null : Number(p.gpa),
        gpaScale: p.gpa_scale === null ? 4.3 : Number(p.gpa_scale),
        languageTests: p.language_tests || [],
        exchangeTerm: p.exchange_term || next.profile.exchangeTerm,
        targetScoreSimUsed: false
      };
      next.confirmedSchoolId = p.confirmed_school_id || null;
      next.targetScores = p.target_scores || null;
      next.onboardedAt = p.onboarded_at || null;
    }
    if (favs.data) next.favorites = favs.data.map(r => r.school_id);
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
