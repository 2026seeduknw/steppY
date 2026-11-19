/**
 * 푸시 알림 — 알림 권한을 묻고, 기기 토큰(알림을 보낼 "주소")을 Supabase에 저장한다.
 *
 * 어디에 실리나
 *   auth.js 를 싣는 모든 화면. 알림을 누르는 순간 사용자가 어느 화면에 있든
 *   그 화면에서 이동을 받아야 해서다. 권한을 묻는 것만 홈에서 한다.
 *
 * 언제 묻나
 *   로그인한 사람이 홈에 처음 들어왔을 때 한 번. 화면이 다 그려지고 잠깐 뒤에 묻는다 —
 *   앱을 열자마자 시스템 창이 뜨면 무슨 앱인지 보기도 전에 "허용 안 함"을 누르기 쉽다.
 *   iOS는 이 창을 앱 평생 한 번만 띄운다. 거절하면 그다음부터는 설정 앱에서만 켤 수 있다.
 *   로그인 전에는 묻지 않는다 — 토큰을 누구 것으로 저장할지 모르기 때문이다.
 *
 * 저장은 어떻게 하나
 *   허용돼 있으면 화면이 열릴 때마다 register()를 부른다. iOS는 토큰을 바꿀 수 있어서
 *   (앱 재설치, 기기 복원 등) 매번 받아 두는 게 맞다. 다만 같은 사람·같은 토큰이면
 *   하루에 한 번만 서버에 보낸다(supabase/push_tokens.sql 의 register_push_token).
 *
 * 로그아웃할 때 토큰을 지우는 건 js/auth.js 의 signOut 이 한다(SAVED_KEY 를 같이 쓴다).
 *
 * 알림을 누르면 data.url(예: 'consult.html')이 있을 때 그 화면으로 간다.
 *
 * 웹(브라우저)에서는 플러그인이 없어 아무 일도 하지 않는다.
 * 이 파일은 supabase-client.js·auth.js 뒤에 실려야 한다.
 */
const Push = {
  /** 마지막으로 서버에 저장한 { token, userId, at } — auth.js 의 signOut 도 이 키를 읽는다 */
  SAVED_KEY: 'steppy:push-token',
  /** 같은 토큰을 다시 보내지 않는 간격 */
  RESAVE_MS: 24 * 60 * 60 * 1000,
  /** 홈이 그려지고 권한 창을 띄우기까지 기다리는 시간 */
  ASK_DELAY_MS: 1500,

  _listening: false,

  get plugin() {
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.PushNotifications) || null;
  },

  _readSaved() {
    try { return JSON.parse(localStorage.getItem(this.SAVED_KEY) || 'null'); } catch (e) { return null; }
  },

  /** 리스너는 로그인과 상관없이 붙인다 — 알림을 눌러 앱이 열렸을 때 갈 곳을 놓치지 않게 */
  _listen(plugin) {
    if (this._listening) return;
    this._listening = true;
    plugin.addListener('registration', ({ value }) => this._save(value));
    plugin.addListener('registrationError', (e) => console.warn('[push] 토큰 받기 실패', e));
    plugin.addListener('pushNotificationActionPerformed', ({ notification }) => this._open(notification));
  },

  async start() {
    const plugin = this.plugin;
    if (!plugin) return;
    this._listen(plugin);

    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    await Auth.init();
    if (!Auth.isAuthed) return;

    try {
      let { receive } = await plugin.checkPermissions();
      const canAsk = document.body.dataset.page === 'home';
      if (canAsk && (receive === 'prompt' || receive === 'prompt-with-rationale')) {
        await new Promise(r => setTimeout(r, this.ASK_DELAY_MS));
        ({ receive } = await plugin.requestPermissions());
      }
      if (receive !== 'granted') return;
      // 결과는 'registration' 이벤트로 온다(AppDelegate가 토큰을 넘겨준다)
      await plugin.register();
    } catch (e) {
      console.warn('[push]', e);
    }
  },

  async _save(token) {
    const userId = Auth.userId;
    if (!token || !userId) return;

    const saved = this._readSaved();
    if (saved && saved.token === token && saved.userId === userId && Date.now() - saved.at < this.RESAVE_MS) return;

    const platform = window.Capacitor.getPlatform() === 'android' ? 'android' : 'ios';
    const { error } = await supabaseClient.rpc('register_push_token', { p_token: token, p_platform: platform });
    if (error) { console.warn('[push] 토큰 저장 실패', error); return; }
    try {
      localStorage.setItem(this.SAVED_KEY, JSON.stringify({ token, userId, at: Date.now() }));
    } catch (e) { /* 사생활 모드 */ }
  },

  /** 알림 data.url 이 앱 안의 화면(예: 'consult.html?tab=qa')일 때만 이동한다 */
  _open(notification) {
    const url = notification && notification.data && notification.data.url;
    if (typeof url === 'string' && /^[a-z0-9-]+\.html([?#].*)?$/i.test(url)) {
      location.href = url;
    }
  }
};

Push.start();
