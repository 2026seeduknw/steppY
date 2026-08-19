/**
 * 로그인 게이팅 UX + 구글/카카오 소셜 로그인(Supabase Auth).
 *
 * "비로그인으로도 둘러볼 수 있지만 저장/확정 같은 액션은 로그인이 필요하다"는
 * 배포 준비 단계의 동작을, Supabase Auth의 OAuth(Google/Kakao) 세션으로 구현합니다.
 * 로그인 여부는 AppState.loggedIn에 캐시해 두고(새로고침 시 매번 세션 재확인),
 * 실제 소스는 항상 Supabase 세션입니다.
 *
 * 사전 준비(대시보드에서 1회, 코드 아님):
 *   Supabase 프로젝트 → Authentication → Providers → Google/Kakao 활성화 +
 *   각 콘솔에서 발급한 Client ID/Secret 입력. 그 전까지는 버튼을 눌러도
 *   Supabase가 "provider is not enabled" 에러를 돌려줍니다.
 */
function openAuthModal(message) {
  let scrim = document.getElementById('authModalScrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.id = 'authModalScrim';
    scrim.className = 'modal-scrim';
    document.body.appendChild(scrim);
  }
  scrim.innerHTML = `
    <div class="modal-panel modal-panel--sm auth-modal">
      <button class="modal-close" data-modal-close aria-label="닫기">✕</button>
      <span class="eyebrow">LOGIN</span>
      <h2>로그인이 필요해요</h2>
      <p>${message || '이 기능은 로그인 후 이용할 수 있어요.'}</p>
      <div class="auth-modal__social">
        <button type="button" class="btn-social btn-social--google" id="googleLoginBtn">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.91c1.7-1.57 2.69-3.88 2.69-6.64z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.27c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z"/>
            <path fill="#FBBC05" d="M3.96 10.71c-.18-.54-.29-1.11-.29-1.71s.11-1.17.29-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Google로 계속하기
        </button>
        <button type="button" class="btn-social btn-social--kakao" id="kakaoLoginBtn">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#391B1B" d="M9 1.5C4.58 1.5 1 4.36 1 7.88c0 2.24 1.47 4.21 3.68 5.35-.16.6-.6 2.2-.69 2.54-.11.42.16.42.33.3.14-.09 2.2-1.5 3.1-2.11.51.07 1.04.11 1.58.11 4.42 0 8-2.86 8-6.38S13.42 1.5 9 1.5z"/>
          </svg>
          카카오로 계속하기
        </button>
      </div>
      ${SUPABASE_CONFIGURED ? '' : '<p class="auth-hint">* Supabase가 연결되지 않아 소셜 로그인이 아직 동작하지 않아요.</p>'}
    </div>`;
  wireModalDismiss(scrim);
  scrim.querySelector('#googleLoginBtn').addEventListener('click', () => signInWithProvider('google'));
  scrim.querySelector('#kakaoLoginBtn').addEventListener('click', () => signInWithProvider('kakao'));
  openModal(scrim);
}

function signInWithProvider(provider) {
  if (!SUPABASE_CONFIGURED) { showToast('Supabase가 연결되지 않아 소셜 로그인을 쓸 수 없어요'); return; }
  supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.href } });
}

function syncAuthFromSupabaseSession(session) {
  const isLoggedIn = !!session;
  if (AppState.isLoggedIn() !== isLoggedIn) {
    if (isLoggedIn) AppState.login(); else AppState.logout();
  }
  const scrim = document.getElementById('authModalScrim');
  if (isLoggedIn && scrim && scrim.classList.contains('is-open')) {
    closeModal(scrim);
    showToast('로그인했어요');
  }
}

if (SUPABASE_CONFIGURED) {
  supabaseClient.auth.getSession().then(({ data }) => syncAuthFromSupabaseSession(data.session));
  supabaseClient.auth.onAuthStateChange((_event, session) => syncAuthFromSupabaseSession(session));
}
