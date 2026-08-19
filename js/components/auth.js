/**
 * 로그인 게이팅 UX 목업. 실제 인증 백엔드는 아직 없고(§ CLAUDE.md 참고),
 * "비로그인으로도 둘러볼 수 있지만 저장/확정 같은 액션은 로그인이 필요하다"는
 * 배포 준비 단계의 동작만 클라이언트 상태(AppState.loggedIn)로 미리 구현합니다.
 * 실서비스 전환 시 openAuthModal의 제출 핸들러를 실제 인증 호출로 교체합니다.
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
      <button type="button" class="btn btn--primary" id="mockLoginBtn" style="width:100%;">로그인하기</button>
    </div>`;
  wireModalDismiss(scrim);
  scrim.querySelector('#mockLoginBtn').addEventListener('click', () => {
    AppState.login();
    closeModal(scrim);
    showToast('로그인했어요');
  });
  openModal(scrim);
}
