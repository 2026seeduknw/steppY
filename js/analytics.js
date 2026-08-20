/**
 * Vercel Web Analytics — 빌드 스텝이 없는 정적 사이트라 npm 패키지(@vercel/analytics)
 * 대신 공식 스크립트 태그 방식(전역 va() 함수)을 그대로 사용한다.
 * 프로젝트에서 Analytics를 활성화하기 전까지 /_vercel/insights/script.js는 404를
 * 반환하지만 va() 호출 자체는 큐에 쌓이기만 하고 에러를 내지 않는다.
 */
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
(function () {
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
})();

/** 버튼 클릭 등 커스텀 이벤트 기록. props는 문자열/숫자/불리언 값만 허용된다(Vercel 제약). */
function trackEvent(name, props) {
  window.va('event', props ? { name, ...props } : { name });
}
