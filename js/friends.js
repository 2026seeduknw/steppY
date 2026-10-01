/**
 * 기록하기 — 친구 · 타임라인 · 좋아요 · 댓글 · 신고/차단.
 *
 * 서버는 supabase/friends.sql. 이 파일이 하는 일은 셋이다.
 *   1) 친구 관리 시트 — 내 초대 코드 공유, 코드로 요청, 받은/보낸 요청, 친구·차단 목록
 *   2) 타임라인 — 내 기록과 친구에게 공개된 기록을 최신순으로 한 줄에 (사진·위치·날씨·노래 포함)
 *   3) 좋아요·댓글, 그리고 모든 남의 글·댓글에 붙는 신고 / 사용자 차단
 *
 * 친구 관계·차단·신고는 테이블에 직접 쓰지 않고 RPC로만 바꾼다(서버가 위조를 막는다).
 * 신고·차단과 첫 사용 때의 이용 안내는 App Store 심사 가이드라인 1.2(사용자 콘텐츠) 때문에 있다.
 */
const Friends = (function () {
  const PAGE = 15;
  const SUPPORT_EMAIL = '2026.seed.uknw@gmail.com';

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const me = () => (typeof Auth !== 'undefined' ? Auth.userId : null);
  const toast = (m) => { if (typeof showToast === 'function') showToast(m); };

  /* ------------------------------------------------------------ 서버 호출 */

  async function rpc(name, args) {
    const res = await supabaseClient.rpc(name, args);
    if (res.error) { console.warn('[friends]', name, res.error.message); return { ok: false, error: res.error }; }
    return { ok: true, data: res.data };
  }

  const api = {
    inviteCode: () => rpc('my_invite_code'),
    request: (code) => rpc('send_friend_request', { code }),
    respond: (fid, accept) => rpc('respond_friend_request', { fid, accept }),
    remove: (fid) => rpc('remove_friend', { fid }),
    block: (target) => rpc('block_user', { target }),
    unblock: (target) => rpc('unblock_user', { target }),
    list: () => rpc('list_friends'),
    blocked: () => rpc('list_blocked'),
    async report({ kind, targetId, targetUser, reason }) {
      const res = await supabaseClient.from('content_reports')
        .insert({ kind, target_id: targetId, target_user: targetUser || null, reason: reason || null });
      return { ok: !res.error };
    }
  };

  /* ------------------------------------------------------- 이용 안내(첫 사용) */

  const termsKey = () => `steppy_friends_terms_${me()}`;
  function termsAccepted() { try { return localStorage.getItem(termsKey()) === '1'; } catch (e) { return false; } }

  /** 친구 기능을 처음 쓸 때 한 번 — 동의해야 이어진다. 거절하면 false. */
  function ensureTerms() {
    if (termsAccepted()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const scrim = makeScrim('friendsTermsScrim');
      scrim.innerHTML = `
        <div class="modal-panel modal-panel--sm ft-panel">
          <h2 class="ft-title">친구 기능 이용 안내</h2>
          <p class="ft-lead">친구에게 공개한 기록은 친구 목록에 있는 분들만 볼 수 있어요. 기록마다 공개 여부를 고를 수 있어요.</p>
          <ul class="ft-rules">
            <li>친구에게는 내 <b>이름과 파견 학교(국가·도시)</b>가 보여요.</li>
            <li>욕설·혐오·성적인 내용, 타인을 괴롭히거나 사칭하는 글은 올릴 수 없어요.</li>
            <li>불쾌한 글이나 댓글은 <b>신고</b>하고, 사용자는 <b>차단</b>할 수 있어요. 차단하면 서로의 기록이 보이지 않아요.</li>
            <li>신고된 내용은 운영자가 확인해 위반이 맞으면 삭제하고 이용을 제한해요.</li>
            <li>문의 <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></li>
          </ul>
          <div class="ft-actions">
            <button type="button" class="btn btn--ghost" data-no>취소</button>
            <button type="button" class="btn btn--primary" data-yes>동의하고 시작</button>
          </div>
        </div>`;
      openModal(scrim);
      const done = (ok) => { closeModal(scrim); scrim.remove(); resolve(ok); };
      scrim.querySelector('[data-yes]').addEventListener('click', () => {
        try { localStorage.setItem(termsKey(), '1'); } catch (e) { /* 저장이 안 되면 다음에 또 묻는다 */ }
        done(true);
      });
      scrim.querySelector('[data-no]').addEventListener('click', () => done(false));
      scrim.addEventListener('click', (e) => { if (e.target === scrim) done(false); });
    });
  }

  function makeScrim(id) {
    let scrim = document.getElementById(id);
    if (scrim) scrim.remove();   // 다시 열 때마다 새로 — 이전 리스너가 남지 않게
    scrim = document.createElement('div');
    scrim.id = id;
    scrim.className = 'modal-scrim';
    document.body.appendChild(scrim);
    return scrim;
  }

  /* ---------------------------------------------------------- 친구 관리 시트 */

  let managerScrim = null;

  async function openManager() {
    if (!AppState.isAuthed) { toast('로그인하면 친구를 추가할 수 있어요'); return; }
    if (!(await ensureTerms())) return;
    managerScrim = makeScrim('friendsScrim');
    managerScrim.innerHTML = `
      <div class="modal-panel modal-panel--sm ft-panel">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <h2 class="ft-title">친구</h2>
        <div id="ftManagerBody"><p class="ft-muted">불러오는 중…</p></div>
      </div>`;
    wireModalDismiss(managerScrim);
    openModal(managerScrim);
    renderManager();
  }

  async function renderManager() {
    const body = managerScrim && managerScrim.querySelector('#ftManagerBody');
    if (!body) return;
    const [codeRes, listRes, blockedRes] = await Promise.all([api.inviteCode(), api.list(), api.blocked()]);
    if (!managerScrim || !managerScrim.isConnected) return;
    if (!listRes.ok || !codeRes.ok) {
      body.innerHTML = `<p class="ft-muted">친구 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>`;
      return;
    }
    const rows = listRes.data || [];
    const friends = rows.filter(r => r.direction === 'friend');
    const incoming = rows.filter(r => r.direction === 'incoming');
    const outgoing = rows.filter(r => r.direction === 'outgoing');
    const blocked = blockedRes.ok ? (blockedRes.data || []) : [];
    const code = codeRes.data;

    body.innerHTML = `
      <section class="ft-sec">
        <p class="ft-label">내 초대 코드</p>
        <div class="ft-code-row">
          <strong class="ft-code" id="ftCode">${esc(code)}</strong>
          <button type="button" class="btn btn--ghost btn--sm" data-copy>복사</button>
          <button type="button" class="btn btn--primary btn--sm" data-share>공유</button>
        </div>
        <p class="ft-muted">친구가 이 코드를 입력하면 요청이 와요. 코드는 친구에게만 알려 주세요.</p>
      </section>

      <section class="ft-sec">
        <p class="ft-label">친구 코드로 추가</p>
        <form class="ft-add" id="ftAddForm">
          <input type="text" id="ftAddInput" class="ft-input" placeholder="친구 코드 8자리" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false">
          <button type="submit" class="btn btn--primary btn--sm">요청</button>
        </form>
      </section>

      ${incoming.length ? `
      <section class="ft-sec">
        <p class="ft-label">받은 요청 <span class="ft-count">${incoming.length}</span></p>
        ${incoming.map(r => `
          <div class="ft-row">
            <span class="ft-avatar" aria-hidden="true">${esc(initial(r.name))}</span>
            <span class="ft-row__name">${esc(r.name)}${schoolLine(r) ? `<small>${esc(schoolLine(r))}</small>` : ''}</span>
            <button type="button" class="btn btn--ghost btn--sm" data-reject="${esc(r.friendship_id)}">거절</button>
            <button type="button" class="btn btn--primary btn--sm" data-accept="${esc(r.friendship_id)}">수락</button>
          </div>`).join('')}
      </section>` : ''}

      <section class="ft-sec">
        <p class="ft-label">내 친구 <span class="ft-count">${friends.length}</span></p>
        ${friends.length ? friends.map(r => `
          <div class="ft-row">
            <span class="ft-avatar" aria-hidden="true">${esc(initial(r.name))}</span>
            <span class="ft-row__name">${esc(r.name)}${schoolLine(r) ? `<small>${esc(schoolLine(r))}</small>` : ''}</span>
            <button type="button" class="ft-link" data-remove="${esc(r.friendship_id)}" data-name="${esc(r.name)}">삭제</button>
            <button type="button" class="ft-link ft-link--danger" data-block="${esc(r.user_id)}" data-name="${esc(r.name)}">차단</button>
          </div>`).join('') : `<p class="ft-muted">아직 친구가 없어요. 위 코드를 공유해 보세요.</p>`}
        ${outgoing.map(r => `
          <div class="ft-row ft-row--pending">
            <span class="ft-avatar" aria-hidden="true">${esc(initial(r.name))}</span>
            <span class="ft-row__name">${esc(r.name)} <em>수락 대기 중</em></span>
            <button type="button" class="ft-link" data-remove="${esc(r.friendship_id)}" data-name="${esc(r.name)}">취소</button>
          </div>`).join('')}
      </section>

      ${blocked.length ? `
      <details class="ft-sec ft-blocked">
        <summary>차단한 사용자 ${blocked.length}</summary>
        ${blocked.map(r => `
          <div class="ft-row">
            <span class="ft-row__name">${esc(r.name)}</span>
            <button type="button" class="ft-link" data-unblock="${esc(r.user_id)}">차단 해제</button>
          </div>`).join('')}
      </details>` : ''}

      <p class="ft-muted ft-foot">불쾌한 글은 타임라인에서 신고할 수 있어요 · 문의 <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`;

    wireManager(body, code);
  }

  /** "학교 · 국가 도시" 한 줄. 학교를 아직 안 정했으면 빈 문자열. */
  function schoolLine(r) {
    if (!r || !r.school_name) return '';
    const place = [r.school_country, r.school_city].filter(Boolean).join(' ');
    return place ? `${r.school_name} · ${place}` : r.school_name;
  }

  function initial(name) { return (String(name || '?').trim()[0] || '?').toUpperCase(); }

  function wireManager(body, code) {
    const refresh = () => { renderManager(); refreshBadges(); };
    const text = `steppY에서 친구 해요! 기록하기 탭 → 친구에서 초대 코드 ${code} 를 입력해 주세요.`;

    body.querySelector('[data-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code); toast('코드를 복사했어요'); }
      catch (e) { toast('복사하지 못했어요. 코드를 직접 눌러 선택해 주세요'); }
    });
    body.querySelector('[data-share]').addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(text); toast('초대 문구를 복사했어요'); }
      catch (e) { toast('공유하지 못했어요'); }
    });

    body.querySelector('#ftAddForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = body.querySelector('#ftAddInput');
      const value = input.value.trim();
      if (!value) return;
      const res = await api.request(value);
      if (!res.ok) { toast('요청하지 못했어요. 잠시 후 다시 시도해 주세요'); return; }
      const msg = {
        sent: '친구 요청을 보냈어요',
        accepted: '친구가 됐어요!',
        already_friends: '이미 친구예요',
        pending: '이미 요청을 보냈어요',
        invalid_code: '코드를 찾을 수 없어요. 다시 확인해 주세요',
        self: '내 코드예요'
      }[res.data] || '요청을 처리했어요';
      toast(msg);
      if (res.data === 'sent' || res.data === 'accepted') { input.value = ''; refresh(); }
    });

    body.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.accept) { await api.respond(t.dataset.accept, true); toast('친구가 됐어요!'); refresh(); }
      else if (t.dataset.reject) { await api.respond(t.dataset.reject, false); refresh(); }
      else if (t.dataset.remove) {
        if (!window.confirm(`${t.dataset.name}님을 친구에서 삭제할까요?`)) return;
        await api.remove(t.dataset.remove); refresh();
      } else if (t.dataset.block) {
        if (!window.confirm(`${t.dataset.name}님을 차단할까요? 친구 관계가 끊기고, 서로의 기록과 댓글이 보이지 않아요.`)) return;
        await api.block(t.dataset.block); toast('차단했어요'); refresh();
      } else if (t.dataset.unblock) {
        await api.unblock(t.dataset.unblock); toast('차단을 풀었어요'); refresh();
      }
    });
  }

  /** 친구 버튼에 달 "받은 요청 수" 배지 */
  async function refreshBadges() {
    const els = document.querySelectorAll('[data-friends-badge]');
    if (!els.length) return;
    let n = 0;
    if (AppState.isAuthed) {
      const res = await api.list();
      if (res.ok) n = (res.data || []).filter(r => r.direction === 'incoming').length;
    }
    els.forEach(el => { el.textContent = n; el.hidden = n === 0; });
  }

  /* ------------------------------------------------------------- 신고 · 차단 */

  const REPORT_REASONS = [
    ['abuse', '욕설·혐오·괴롭힘'],
    ['sexual', '성적인 내용'],
    ['spam', '스팸·광고'],
    ['privacy', '개인정보 노출'],
    ['other', '기타']
  ];

  function openReport({ kind, targetId, targetUser, name }) {
    const scrim = makeScrim('friendsReportScrim');
    scrim.innerHTML = `
      <div class="modal-panel modal-panel--sm ft-panel">
        <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
        <h2 class="ft-title">${kind === 'comment' ? '댓글' : '기록'} 신고</h2>
        <p class="ft-lead">어떤 문제인가요? 운영자가 확인하고 조치해요.</p>
        <div class="ft-reasons" role="radiogroup">
          ${REPORT_REASONS.map(([k, label], i) => `
            <label class="ft-reason"><input type="radio" name="ftReason" value="${k}"${i === 0 ? ' checked' : ''}><span>${label}</span></label>`).join('')}
        </div>
        <div class="ft-actions">
          <button type="button" class="btn btn--ghost" data-modal-close>취소</button>
          <button type="button" class="btn btn--primary" data-send>신고하기</button>
        </div>
      </div>`;
    wireModalDismiss(scrim);
    openModal(scrim);
    scrim.querySelector('[data-send]').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      const reason = scrim.querySelector('input[name=ftReason]:checked').value;
      const res = await api.report({ kind, targetId, targetUser, reason });
      closeModal(scrim);
      if (!res.ok) { toast('신고하지 못했어요. 잠시 후 다시 시도해 주세요'); return; }
      toast('신고했어요. 확인 후 조치할게요');
      if (targetUser && window.confirm(`${name || '이 사용자'}님을 차단할까요? 서로의 기록과 댓글이 보이지 않아요.`)) {
        await api.block(targetUser);
        toast('차단했어요');
        reloadTimeline();
      }
    });
  }

  /* ------------------------------------------------------------- 타임라인 */

  const tl = {
    mount: null, entries: [], names: {}, schools: {}, likes: {}, commentCounts: {}, urls: {},
    cursor: null, hasMore: false, loading: false, openComments: new Set()
  };

  const ENTRY_COLS = 'id, user_id, entry_date, title, body, photos, tags, location, song, now_playing, weather, visibility, created_at';

  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    if (s < 604800) return `${Math.floor(s / 86400)}일 전`;
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  function mountTimeline(mount) {
    tl.mount = mount;
    mount.addEventListener('click', onTimelineClick);
    mount.addEventListener('submit', onCommentSubmit);
    return reloadTimeline();
  }

  async function reloadTimeline() {
    if (!tl.mount) return;
    if (!AppState.isAuthed) {
      tl.mount.innerHTML = `
        <section class="card card-pad"><div class="guest-cta">
          <p class="guest-cta__text">로그인하면 <strong>친구와 기록을 함께</strong> 볼 수 있어요</p>
          <a class="btn btn--primary btn--block" href="auth.html">로그인</a>
        </div></section>`;
      return;
    }
    tl.entries = []; tl.cursor = null; tl.hasMore = false; tl.openComments.clear();
    tl.mount.innerHTML = `<p class="ft-muted ft-center">불러오는 중…</p>`;
    const listRes = await api.list();
    tl.names = {}; tl.schools = {};
    if (listRes.ok) (listRes.data || []).filter(r => r.direction === 'friend').forEach(r => { tl.names[r.user_id] = r.name; tl.schools[r.user_id] = schoolLine(r); });
    await loadPage();
    refreshBadges();
  }

  async function loadPage() {
    if (tl.loading) return;
    tl.loading = true;
    let q = supabaseClient.from('user_journal').select(ENTRY_COLS)
      .order('created_at', { ascending: false }).limit(PAGE + 1);
    if (tl.cursor) q = q.lt('created_at', tl.cursor);
    const res = await q;
    tl.loading = false;
    if (res.error) {
      tl.mount.innerHTML = `<p class="ft-muted ft-center">타임라인을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>`;
      return;
    }
    const rows = res.data || [];
    tl.hasMore = rows.length > PAGE;
    const page = rows.slice(0, PAGE);
    if (page.length) tl.cursor = page[page.length - 1].created_at;

    const ids = page.map(r => r.id);
    if (ids.length) {
      const [likes, comments] = await Promise.all([
        supabaseClient.from('journal_likes').select('entry_id, user_id').in('entry_id', ids),
        supabaseClient.from('journal_comments').select('entry_id').in('entry_id', ids)
      ]);
      ids.forEach(id => { tl.likes[id] = []; tl.commentCounts[id] = 0; });
      (likes.data || []).forEach(l => tl.likes[l.entry_id].push(l.user_id));
      (comments.data || []).forEach(c => { tl.commentCounts[c.entry_id] += 1; });
    }
    tl.entries = tl.entries.concat(page);
    renderTimeline();
    signPhotos(page);
  }

  async function signPhotos(page) {
    const paths = page.flatMap(e => e.photos || []).filter(p => !tl.urls[p]);
    if (!paths.length) return;
    const map = await AppState.signPhotoPaths(paths);
    Object.assign(tl.urls, map);
    renderTimeline();
  }

  /** 내 카드에도 같은 형식으로 — 내가 확정한 학교는 이 기기 상태에서 바로 읽는다. */
  function mySchoolLine() {
    const id = AppState.load().confirmedSchoolId;
    const s = id && typeof MOCK !== 'undefined' ? (MOCK.schools || []).find(x => x.id === id) : null;
    if (!s) return '';
    return schoolLine({ school_name: s.nameKo || s.name, school_country: s.country, school_city: s.city });
  }

  function weatherText(w) {
    if (!w || typeof w.code !== 'number' || typeof SongEngine === 'undefined') return '';
    const l = SongEngine.weatherLabel(w.code);
    return l ? `${l.emoji} ${l.ko}${typeof w.temp === 'number' ? ` ${Math.round(w.temp)}°` : ''}` : '';
  }

  function tagText(id) {
    const t = typeof EVERYDAY_MAP !== 'undefined' ? EVERYDAY_MAP[id] : null;
    return t ? `${t.emoji} ${t.ko}` : '';
  }

  function cardHtml(e) {
    const mine = e.user_id === me();
    const name = mine ? ((AppState.profile && AppState.profile.name) || '나') : (tl.names[e.user_id] || '친구');
    const school = mine ? mySchoolLine() : (tl.schools[e.user_id] || '');
    const urls = (e.photos || []).map(p => tl.urls[p]).filter(Boolean);
    const loadingPhotos = (e.photos || []).length > 0 && !urls.length;
    const loc = e.location && (e.location.city || e.location.country);
    const meta = [loc ? `📍 ${esc(loc)}` : '', esc(weatherText(e.weather)), ...(e.tags || []).map(tagText).filter(Boolean).slice(0, 3).map(esc)].filter(Boolean);
    const track = e.song || e.now_playing;
    const likes = tl.likes[e.id] || [];
    const liked = likes.includes(me());
    const cc = tl.commentCounts[e.id] || 0;
    const open = tl.openComments.has(e.id);
    const dateNote = e.entry_date && e.created_at && e.entry_date !== e.created_at.slice(0, 10)
      ? ` · ${Number(e.entry_date.slice(5, 7))}월 ${Number(e.entry_date.slice(8, 10))}일 기록` : '';

    return `
      <article class="ft-card" data-entry="${esc(e.id)}">
        <header class="ft-card__head">
          <span class="ft-avatar${mine ? ' is-me' : ''}" aria-hidden="true">${esc(initial(name))}</span>
          <div class="ft-card__who">
            <strong>${esc(name)}${mine ? ' <em>나</em>' : ''}</strong>
            ${school ? `<span class="ft-card__school">🎓 ${esc(school)}</span>` : ''}
            <span>${esc(ago(e.created_at))}${esc(dateNote)}${mine && e.visibility !== 'friends' ? ' · 🔒 나만 보기' : ''}</span>
          </div>
          ${mine ? '' : `<button type="button" class="ft-more" data-report-entry="${esc(e.id)}" data-user="${esc(e.user_id)}" data-name="${esc(name)}" aria-label="신고">⋯</button>`}
        </header>
        ${loadingPhotos ? `<div class="ft-photos ft-photos--skeleton"></div>`
          : urls.length ? `<div class="ft-photos${urls.length > 1 ? ' is-multi' : ''}">${urls.map((u, i) =>
              `<img src="${esc(u)}" alt="${esc(e.title || `${name}의 사진`)} ${i + 1}/${urls.length}" loading="lazy" draggable="false">`).join('')}
              ${urls.length > 1 ? `<span class="ft-photos__count">1 / ${urls.length}</span>` : ''}</div>` : ''}
        ${e.title ? `<h3 class="ft-card__title">${esc(e.title)}</h3>` : ''}
        ${e.body ? `<p class="ft-card__body">${esc(e.body)}</p>` : ''}
        ${meta.length ? `<p class="ft-card__meta">${meta.join(' · ')}</p>` : ''}
        ${track ? `<p class="ft-card__song">🎵 ${esc(track.name)} — ${esc(track.artist)}</p>` : ''}
        <footer class="ft-card__actions">
          <button type="button" class="ft-act${liked ? ' is-on' : ''}" data-like="${esc(e.id)}" aria-pressed="${liked}">${liked ? '♥' : '♡'} <span>${likes.length || ''}</span></button>
          <button type="button" class="ft-act" data-comments="${esc(e.id)}" aria-expanded="${open}">💬 <span>${cc || ''}</span></button>
        </footer>
        <div class="ft-comments" data-comments-box="${esc(e.id)}"${open ? '' : ' hidden'}></div>
      </article>`;
  }

  function renderTimeline() {
    if (!tl.mount) return;
    if (!tl.entries.length) {
      tl.mount.innerHTML = `
        <section class="card card-pad ft-empty">
          <p class="ft-empty__title">아직 보여줄 기록이 없어요</p>
          <p class="ft-muted">기록을 남기고, 친구를 추가하면 이곳에서 함께 볼 수 있어요.</p>
          <button type="button" class="btn btn--primary" data-open-friends>친구 추가하기</button>
        </section>`;
      return;
    }
    // 열어 둔 댓글창·입력 중이던 글을 지키려고 카드만 다시 그리되 열린 상태는 유지한다
    const keepScroll = window.scrollY;
    tl.mount.innerHTML = tl.entries.map(cardHtml).join('')
      + (tl.hasMore ? `<button type="button" class="btn btn--ghost btn--block ft-more-btn" data-load-more>더 보기</button>` : '');
    tl.openComments.forEach(id => renderComments(id, { keepInput: true }));
    window.scrollTo(0, keepScroll);
  }

  /* ----------------------------------------------------------- 좋아요 · 댓글 */

  const commentCache = {};   // entry_id → [{id,user_id,author_name,body,created_at}]

  async function toggleLike(id) {
    const likes = tl.likes[id] || (tl.likes[id] = []);
    const i = likes.indexOf(me());
    const was = i >= 0;
    if (was) likes.splice(i, 1); else likes.push(me());
    updateActions(id);
    const res = was
      ? await supabaseClient.from('journal_likes').delete().eq('entry_id', id).eq('user_id', me())
      : await supabaseClient.from('journal_likes').insert({ entry_id: id });
    if (res.error) {
      // 서버가 거절하면(친구가 아니게 됨 등) 화면을 원래대로
      const j = likes.indexOf(me());
      if (was && j < 0) likes.push(me()); else if (!was && j >= 0) likes.splice(j, 1);
      updateActions(id);
      toast('좋아요를 반영하지 못했어요');
    }
  }

  function updateActions(id) {
    const card = tl.mount.querySelector(`[data-entry="${CSS.escape(id)}"]`);
    if (!card) return;
    const likes = tl.likes[id] || [];
    const liked = likes.includes(me());
    const btn = card.querySelector('[data-like]');
    btn.classList.toggle('is-on', liked);
    btn.setAttribute('aria-pressed', String(liked));
    btn.innerHTML = `${liked ? '♥' : '♡'} <span>${likes.length || ''}</span>`;
    const cc = tl.commentCounts[id] || 0;
    card.querySelector('[data-comments] span').textContent = cc || '';
  }

  async function renderComments(id, { keepInput } = {}) {
    const box = tl.mount.querySelector(`[data-comments-box="${CSS.escape(id)}"]`);
    if (!box) return;
    const entry = tl.entries.find(e => e.id === id);
    const prevText = keepInput ? ((box.querySelector('input[name=body]') || {}).value || '') : '';
    if (!commentCache[id]) {
      box.innerHTML = `<p class="ft-muted">불러오는 중…</p>`;
      const res = await supabaseClient.from('journal_comments')
        .select('id, user_id, author_name, body, created_at').eq('entry_id', id).order('created_at');
      if (res.error) { box.innerHTML = `<p class="ft-muted">댓글을 불러오지 못했어요</p>`; return; }
      commentCache[id] = res.data || [];
      tl.commentCounts[id] = commentCache[id].length;
      updateActions(id);
    }
    const isOwner = entry && entry.user_id === me();
    box.innerHTML = `
      <ul class="ft-clist">
        ${commentCache[id].map(c => {
          const mineC = c.user_id === me();
          return `
          <li class="ft-comment" data-cid="${esc(c.id)}">
            <div class="ft-comment__top">
              <strong>${esc(c.author_name || '이름 없음')}</strong>
              <span>${esc(ago(c.created_at))}</span>
              ${mineC || isOwner ? `<button type="button" class="ft-link" data-del-comment="${esc(c.id)}" data-entry="${esc(id)}">삭제</button>` : ''}
              ${mineC ? '' : `<button type="button" class="ft-link" data-report-comment="${esc(c.id)}" data-user="${esc(c.user_id)}" data-name="${esc(c.author_name || '')}">신고</button>`}
            </div>
            <p>${esc(c.body)}</p>
          </li>`;
        }).join('') || '<li class="ft-muted">첫 댓글을 남겨 보세요</li>'}
      </ul>
      <form class="ft-cform" data-cform="${esc(id)}">
        <input type="text" name="body" class="ft-input" placeholder="댓글 달기" maxlength="500" autocomplete="off" value="${esc(prevText)}">
        <button type="submit" class="btn btn--primary btn--sm">등록</button>
      </form>`;
  }

  async function onCommentSubmit(e) {
    const form = e.target.closest('[data-cform]');
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.cform;
    const input = form.querySelector('input[name=body]');
    const body = input.value.trim();
    if (!body) return;
    const btn = form.querySelector('button');
    btn.disabled = true;
    const res = await supabaseClient.from('journal_comments')
      .insert({ entry_id: id, body })
      .select('id, user_id, author_name, body, created_at').single();
    btn.disabled = false;
    if (res.error) { toast('댓글을 등록하지 못했어요. 잠시 후 다시 시도해 주세요'); return; }
    (commentCache[id] || (commentCache[id] = [])).push(res.data);
    tl.commentCounts[id] = commentCache[id].length;
    input.value = '';
    renderComments(id);
    updateActions(id);
  }

  async function onTimelineClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.like) { toggleLike(t.dataset.like); return; }
    if (t.dataset.comments !== undefined) {
      const id = t.dataset.comments;
      const box = tl.mount.querySelector(`[data-comments-box="${CSS.escape(id)}"]`);
      const open = box.hidden;
      box.hidden = !open;
      t.setAttribute('aria-expanded', String(open));
      if (open) { tl.openComments.add(id); renderComments(id); } else tl.openComments.delete(id);
      return;
    }
    if (t.dataset.delComment) {
      if (!window.confirm('이 댓글을 삭제할까요?')) return;
      const id = t.dataset.entry;
      const res = await supabaseClient.from('journal_comments').delete().eq('id', t.dataset.delComment);
      if (res.error) { toast('삭제하지 못했어요'); return; }
      commentCache[id] = (commentCache[id] || []).filter(c => c.id !== t.dataset.delComment);
      tl.commentCounts[id] = commentCache[id].length;
      renderComments(id); updateActions(id);
      return;
    }
    if (t.dataset.reportEntry) {
      openReport({ kind: 'entry', targetId: t.dataset.reportEntry, targetUser: t.dataset.user, name: t.dataset.name });
      return;
    }
    if (t.dataset.reportComment) {
      openReport({ kind: 'comment', targetId: t.dataset.reportComment, targetUser: t.dataset.user, name: t.dataset.name });
      return;
    }
    if (t.dataset.loadMore !== undefined) { t.disabled = true; await loadPage(); return; }
    if (t.dataset.openFriends !== undefined) openManager();
  }

  return { openManager, mountTimeline, reloadTimeline, refreshBadges };
})();
