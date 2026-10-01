/**
 * 앱 링크 설정 — 친구 초대 링크가 쓰는 주소들.
 *
 * 초대 링크의 흐름
 *   1. 링크 주소는 웹 페이지(invite.html)다: https://<INVITE_BASE>/invite.html?code=ABCD1234
 *   2. 그 페이지가 앱 주소(steppy://invite?code=…)로 앱을 열어 본다.
 *      - 앱이 있으면 → 앱이 열리고 js/invite.js 가 코드를 받아 바로 친구가 된다.
 *      - 앱이 없으면 → 잠시 뒤 App Store(APP_STORE_URL)로 넘어간다.
 *
 * 아래 두 값은 아직 자리표시자다. 배포 도메인이 정해지고 앱이 App Store에 올라가면 실제 값으로 바꾼다.
 * (도메인이 생기면 Universal Link를 붙이는 게 더 매끄럽다 — 확인 팝업 없이 앱이 바로 열린다.)
 */
const AppLinks = {
  /** 초대 링크의 앞부분. 웹 버전이 배포된 주소 */
  INVITE_BASE: 'https://steppy.vercel.app',
  /** 앱이 없는 사람이 가는 곳. App Store에 올린 뒤 실제 앱 주소(…/app/id숫자)로 바꾼다 */
  APP_STORE_URL: 'https://apps.apple.com/kr/app/steppy',
  /** 앱을 여는 주소 체계(ios/App/App/Info.plist의 URL Types와 같아야 한다) */
  SCHEME: 'steppy',

  inviteUrl(code) { return `${this.INVITE_BASE}/invite.html?code=${encodeURIComponent(code)}`; },
  appUrl(code) { return `${this.SCHEME}://invite?code=${encodeURIComponent(code)}`; },

  /** steppy://invite?code=… 또는 …/invite.html?code=… 에서 코드만 꺼낸다. 아니면 null */
  parseInvite(url) {
    try {
      const u = new URL(url);
      const isApp = u.protocol === this.SCHEME + ':' && (u.host === 'invite' || /invite/.test(u.pathname));
      const isWeb = /invite\.html$/.test(u.pathname);
      if (!isApp && !isWeb) return null;
      const code = (u.searchParams.get('code') || '').trim().toUpperCase();
      return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
    } catch (e) { return null; }
  }
};
