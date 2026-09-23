/**
 * Supabase Auth 래퍼 — 이메일 + 비밀번호.
 *
 * 왜 소셜 로그인이 아닌가
 *   Google·카카오 같은 서드파티 소셜 로그인을 넣으면 App Store 심사 가이드라인
 *   4.8에 따라 Sign in with Apple도 함께 제공해야 한다. 이메일/비밀번호만 쓰면
 *   그 의무가 없고, Capacitor에서 OAuth 리다이렉트(딥링크) 처리도 필요 없다.
 *   카카오 로그인은 이후에 Apple 로그인과 묶어서 추가하는 것이 순서다.
 *
 * 주의 — 배포 전 필수
 *   Supabase 기본 메일 발송기는 프로덕션용이 아니다(시간당 발송 제한 + 낮은
 *   도달률). 이메일 확인·비밀번호 재설정을 실제로 쓰려면 커스텀 SMTP
 *   (Resend / SendGrid / SES 등)를 Supabase 대시보드에 연결해야 한다.
 */

/** 가입 가능한 메일 도메인. 서버(auth.users의 enforce_yonsei_email 트리거)와 같은 규칙. */
const ALLOWED_EMAIL_DOMAIN = '@yonsei.ac.kr';

const Auth = {
  session: null,
  _ready: null,

  /**
   * 연세대 메일인지. 화면에서 먼저 걸러 친절한 문구를 보여주기 위한 것이고,
   * 실제 차단은 서버 트리거가 한다 — anon 키로 API를 직접 호출하면 이 검사는
   * 그냥 건너뛰어진다.
   */
  isAllowedEmail(email) {
    return typeof email === 'string' && email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
  },

  /**
   * OAuth 실패는 예외로 오지 않는다.
   *
   * signInWithOAuth()는 authorize URL만 만들어 돌려주므로, provider 미설정이나
   * 사용자의 동의 거부 같은 실패는 리다이렉트로 "돌아온 뒤" URL에 실려 온다.
   * PKCE 흐름이면 쿼리스트링(?error=...), implicit 흐름이면 해시(#error=...)다.
   * 여기서 한 번 꺼내 보관하고 주소창은 깨끗하게 지운다 — 남겨두면 새로고침할
   * 때마다 같은 오류가 다시 뜬다.
   */
  redirectError: null,

  _consumeRedirectError() {
    const sources = [
      new URLSearchParams(location.search),
      new URLSearchParams(location.hash.replace(/^#/, ''))
    ];
    let found = null;
    sources.forEach(params => {
      if (!found && params.get('error')) {
        found = params.get('error_description') || params.get('error');
      }
    });
    if (found) {
      this.redirectError = decodeURIComponent(found.replace(/\+/g, ' '));
      history.replaceState(null, '', location.pathname);
    }
    return this.redirectError;
  },

  /** 저장된 세션을 복구하고 이후 변화를 구독한다. 여러 번 불러도 한 번만 실행된다. */
  init() {
    if (this._ready) return this._ready;
    this._consumeRedirectError();
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      this._ready = Promise.resolve(null);
      return this._ready;
    }
    this._ready = supabaseClient.auth.getSession()
      .then(({ data }) => {
        this.session = data.session || null;
        supabaseClient.auth.onAuthStateChange((_event, session) => {
          const before = this.session && this.session.user.id;
          const after = session && session.user.id;
          this.session = session || null;
          if (before !== after) document.dispatchEvent(new CustomEvent('auth:changed'));
        });
        return this.session;
      })
      .catch(() => null);
    return this._ready;
  },

  get user() { return this.session ? this.session.user : null; },
  get userId() { return this.session ? this.session.user.id : null; },
  get isAuthed() { return !!this.session; },
  get email() { return this.session ? this.session.user.email : null; },

  /**
   * 가입. Supabase 프로젝트에서 "Confirm email"이 켜져 있으면 세션 없이
   * 사용자만 만들어지고 확인 메일을 기다려야 한다 — 그 경우를 호출부가
   * 구분할 수 있도록 needsConfirmation을 함께 돌려준다.
   */
  async signUp(email, password, name) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      // handle_new_user() 트리거가 이 값을 읽어 profiles.name을 채운다
      options: { data: { name: name || null } }
    });
    if (error) throw error;
    return { user: data.user, needsConfirmation: !data.session };
  },

  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.session = data.session;
    return data.session;
  },

  async signOut() {
    await supabaseClient.auth.signOut();
    this.session = null;
  },

  /**
   * 회원 탈퇴 — 계정과 그에 딸린 데이터를 전부 지운다. 되돌릴 수 없다.
   *
   * App Store 심사 가이드라인 5.1.1(v)는 계정을 만들 수 있는 앱이면 앱 안에서
   * 지울 수도 있어야 한다고 요구한다. 웹으로 내보내거나 메일로 요청하게 하면
   * 리젝이다.
   *
   * 실제 삭제는 Edge Function(supabase/functions/delete-account)이 한다.
   * anon 키로는 계정을 지울 수 없고 service_role 키를 여기 둘 수는 없어서,
   * 서버에서 JWT를 확인한 뒤 "그 토큰의 주인"만 지우는 구조다. 사진(Storage)도
   * 거기서 함께 지운다 — 클라이언트에서 지우면 중간에 앱이 꺼졌을 때 주인 없는
   * 파일이 남는다.
   */
  async deleteAccount() {
    if (!this.userId) throw new Error('not_authenticated');

    // 현재 세션 토큰은 supabase-js가 알아서 Authorization 헤더에 싣는다.
    const { data, error } = await supabaseClient.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw error;
    if (!data || !data.deleted) throw new Error((data && data.error) || 'delete_failed');

    // 사용자 행이 사라진 뒤라 서버에 로그아웃을 요청하면 401이 돌아온다.
    // 남은 일은 이 기기의 토큰을 버리는 것뿐이므로 local 스코프로 끝낸다.
    await supabaseClient.auth.signOut({ scope: 'local' }).catch(() => {});
    this.session = null;
  },

  /** Supabase 오류 코드를 사용자에게 보여줄 한국어 문장으로 바꾼다. */
  message(error) {
    const code = error && (error.code || error.message) || '';
    if (/Invalid login credentials/i.test(code)) return '이메일 또는 비밀번호가 맞지 않아요.';
    if (/user_already_exists|already registered/i.test(code)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
    if (/weak_password|at least 6/i.test(code)) return '비밀번호는 6자 이상이어야 해요.';
    if (/Email not confirmed/i.test(code)) return '메일함에서 인증 링크를 먼저 확인해 주세요.';
    if (/over_email_send_rate_limit|rate limit/i.test(code)) return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.';
    // Supabase는 형식뿐 아니라 일부 도메인(example.com 등)도 거절한다
    // auth.users의 enforce_yonsei_email 트리거가 막은 경우.
    // GoTrue가 DB 예외를 "Database error saving new user"로 감싸 보내서
    // 원인 문구가 사라진다 — 그래서 여기서 되살려 준다.
    if (/Database error saving new user|yonsei_email_required|unexpected_failure/i.test(code)) {
      return `연세대학교 메일(${ALLOWED_EMAIL_DOMAIN})로만 가입할 수 있어요.`;
    }
    if (/validation_failed|invalid format|is invalid|email_address_invalid/i.test(code)) {
      return '사용할 수 없는 이메일 주소예요. 실제로 받을 수 있는 주소를 입력해 주세요.';
    }
    return (error && error.message) || '알 수 없는 오류가 발생했어요.';
  }
};
