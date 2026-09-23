/**
 * 출시 빌드에서 감출 기능.
 *
 * 왜 지우지 않고 끄나
 *   App Store 심사(가이드라인 2.1)는 "아직 안 되는 기능이 화면에 보이는 것"을
 *   리젝 사유로 삼는다. 준비 중 배지를 달아 두는 것도 마찬가지다. 그렇다고
 *   코드를 지우면 데이터가 준비됐을 때 되살리는 비용이 커진다. 그래서 값 하나로
 *   껐다 켠다 — 데이터가 채워지면 true로 바꾸고 다시 빌드하면 끝이다.
 *
 * 켜는 조건
 *   mentorStep  — school_exchange_reports 에 후기 문장이 들어가면 (지금 0건,
 *                 그래서 열어 봐야 빈 챗봇이다)
 *   partnerPromo — 실제 제휴처가 생기고 눌렀을 때 갈 곳이 있으면
 *                 (지금은 클릭 수만 세는 더미 CTA라 "아직 준비 중" 토스트로 끝난다)
 *
 * 이 파일은 layout.js·school-modal.js보다 먼저 실려야 한다.
 */
const RELEASE = {
  mentorStep: false,
  partnerPromo: false
};

/**
 * 정적 HTML에 박혀 있는 것은 여기서 걷어낸다.
 * `<div data-release="mentorStep">` 처럼 적어 두면 꺼져 있을 때 통째로 사라진다.
 * (숨기는 게 아니라 지운다 — hidden으로 두면 화면 낭독기와 검색에는 남는다)
 */
function applyReleaseFlags() {
  document.querySelectorAll('[data-release]').forEach(el => {
    if (!RELEASE[el.dataset.release]) el.remove();
  });
}

// 이 스크립트는 body 끝에 실리므로 보통은 바로 걷어낼 수 있다. 그래야 뒤따라
// 실행되는 화면 스크립트가 이미 사라진 요소를 붙잡지 않는다.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyReleaseFlags);
} else {
  applyReleaseFlags();
}
