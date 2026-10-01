/**
 * 친구 초대 링크 받기.
 *
 * 링크(steppy://invite?code=…)로 앱이 열리면 코드를 받아 두었다가, 로그인한 사람이 기록하기 화면에서
 * 이용 안내에 동의하면 서버(accept_invite RPC)가 바로 친구로 맺어 준다. 초대한 사람이 링크를 건넨 것이
 * 이미 "친구가 되자"는 뜻이라 요청·수락 단계를 건너뛴다.
 *
 * 로그인 전이면 코드를 이 기기에 남겨 두고 로그인 화면으로 안내한다 — 로그인한 뒤 아무 화면에서나
 * 다시 들어오면 기록하기 화면으로 넘어가서 이어서 처리한다.
 *
 * 앱(Capacitor)에서는 @capacitor/app 의 appUrlOpen / getLaunchUrl 로 링크를 받는다. 웹에서는 받을 일이 없다
 * (웹은 invite.html 이 앱 열기를 시도한다).
 */
const Invite = (function () {
  const KEY = 'steppy_pending_invite';
  const ASKED = 'steppy_invite_asked';
  const FAILED = 'steppy_invite_failed';   // 이번 실행에서 서버 처리에 실패했다 — 화면을 열 때마다 같은 오류를 반복해 띄우지 않는다
  const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
  const onJournal = () => /journal\.html$/.test(location.pathname);
  const onAuth = () => /auth\.html$/.test(location.pathname);

  const stashed = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const stash = (code) => { try { localStorage.setItem(KEY, code); } catch (e) { /* 저장 못 해도 이번 한 번은 처리한다 */ } };
  const clear = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(ASKED); sessionStorage.removeItem(FAILED); } catch (e) { /* 무시 */ } };

  /** 링크가 들어왔다 — 코드를 받아 두고 상황에 맞게 이어 간다 */
  function onUrl(url) {
    const code = typeof AppLinks !== 'undefined' ? AppLinks.parseInvite(url) : null;
    if (!code) return;
    stash(code);
    try { sessionStorage.removeItem(ASKED); sessionStorage.removeItem(FAILED); } catch (e) { /* 무시 */ }   // 새 링크는 처음부터 다시 시도한다
    route();
  }

  async function route() {
    const code = stashed();
    if (!code) return;
    // 첫 화면·로그인 화면처럼 로그인 정보를 다루지 않는 화면은 코드만 받아 두고, 처리는 다음 화면에서 한다
    if (typeof Auth === 'undefined' || typeof AppState === 'undefined' || typeof supabaseClient === 'undefined') return;
    await Auth.init();
    if (!AppState.isAuthed) {
      if (onAuth()) return;   // 로그인(가입) 중이면 그대로 두었다가 로그인 뒤에 이어 간다
      let asked = false;
      try { asked = sessionStorage.getItem(ASKED) === '1'; sessionStorage.setItem(ASKED, '1'); } catch (e) { /* 무시 */ }
      if (!asked && window.confirm('친구 초대가 도착했어요. 로그인하면 바로 친구가 돼요. 로그인 화면으로 갈까요?')) location.href = 'auth.html';
      return;
    }
    if (!onJournal()) { location.href = 'journal.html'; return; }
    try { if (sessionStorage.getItem(FAILED) === '1') return; } catch (e) { /* 무시 */ }
    await accept(code);
  }

  const MESSAGES = {
    accepted: '친구가 됐어요! 🎉',
    already_friends: '이미 친구예요',
    self: '내가 만든 초대 링크예요',
    invalid_code: '초대 링크를 확인할 수 없어요'
  };
  async function accept(code) {
    // 친구 기능을 처음 쓰는 사람은 이용 안내(신고·차단 포함)에 먼저 동의한다
    if (typeof Friends !== 'undefined' && Friends.ensureTerms && !(await Friends.ensureTerms())) {
      toast('이용 안내에 동의하면 친구가 될 수 있어요');
      return;
    }
    const res = await supabaseClient.rpc('accept_invite', { code });
    if (res.error) {
      console.warn('[invite]', res.error.message);
      toast('초대를 처리하지 못했어요. 잠시 후 다시 시도해 주세요');
      try { sessionStorage.setItem(FAILED, '1'); } catch (e) { /* 무시 */ }
      return;   // 코드는 남겨 둔다 — 앱을 다시 열면 한 번 더 시도한다
    }
    clear();
    toast(MESSAGES[res.data] || '초대를 처리했어요');
    if (res.data === 'accepted' || res.data === 'already_friends') {
      if (typeof DiaryArchive !== 'undefined' && DiaryArchive.reloadFriends) DiaryArchive.reloadFriends();
      if (typeof Friends !== 'undefined') Friends.refreshBadges();
    }
  }

  function init() {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.addListener) {
      App.addListener('appUrlOpen', (ev) => onUrl(ev && ev.url));
      if (App.getLaunchUrl) App.getLaunchUrl().then(r => { if (r && r.url) onUrl(r.url); }).catch(() => {});
    }
    // 링크로 이미 코드를 받아 둔 상태에서 들어온 화면(로그인 직후 등)도 이어서 처리한다
    route();
  }
  window.addEventListener('load', init);

  return { onUrl, route };
})();
