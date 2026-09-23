/**
 * Vercel Web Analytics — 빌드 스텝이 없는 정적 사이트라 npm 패키지(@vercel/analytics)
 * 대신 공식 스크립트 태그 방식(전역 va() 함수)을 그대로 사용한다.
 * 프로젝트에서 Analytics를 활성화하기 전까지 /_vercel/insights/script.js는 404를
 * 반환하지만 va() 호출 자체는 큐에 쌓이기만 하고 에러를 내지 않는다.
 */
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
(function () {
  // 네이티브 앱에서는 페이지가 capacitor://localhost 에서 뜨고 /_vercel/... 은
  // 앱 번들 안에 없다. 그대로 두면 화면을 열 때마다 404 요청이 하나씩 나간다.
  // va() 큐는 그대로 두므로 trackEvent()는 어디서든 Supabase 쪽에 계속 쌓인다.
  if (!/^https?:$/.test(location.protocol)) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
})();

/** 버튼 클릭 등 커스텀 이벤트 기록. props는 문자열/숫자/불리언 값만 허용된다(Vercel 제약).
 * Vercel Web Analytics의 커스텀 이벤트(Events 탭)는 Hobby 플랜에서 지원되지 않아
 * 실제 집계는 안 되므로, Supabase click_events 테이블에도 함께 남겨 SQL로 바로
 * 집계할 수 있게 한다(va() 호출은 나중에 Pro로 올릴 경우를 대비해 그대로 둠). */
function trackEvent(name, props) {
  window.va('event', props ? { name, ...props } : { name });
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    supabaseClient.from('click_events').insert({ event_name: name, metadata: props || {} }).then(() => {});
  }
}
