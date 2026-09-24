/**
 * 소수점 자리수 제한 — `<input data-decimals="2">` 에 붙는다.
 *
 * 왜 step="0.01" 로는 안 되냐면
 *   step 은 폼을 제출할 때 도는 네이티브 검증이다. 이 앱의 입력 화면은
 *   type="button" + 자체 validate() 라 그 검증을 아예 타지 않는다. 그래서
 *   3.6234 를 그대로 받아 저장하고 있었다.
 *
 * 왜 저장 시점이 아니라 입력 시점에 자르냐면
 *   저장할 때 반올림하면 사용자가 적은 값과 화면에 남는 값이 달라진다.
 *   애초에 세 번째 자리가 찍히지 않게 하는 편이 설명할 것이 없다.
 *
 * type="number" 의 함정
 *   값이 "3." 처럼 중간 상태이면 el.value 가 빈 문자열로 온다. 그때는 아무것도
 *   하지 않고 넘긴다 — 빈 값으로 덮으면 사용자가 찍은 소수점이 사라진다.
 *   selectionStart 도 number 입력에서는 못 읽는다. 어차피 뒤에서 잘라내는
 *   것뿐이라 커서는 끝에 두면 된다.
 */
(function () {
  function clamp(el) {
    const max = parseInt(el.dataset.decimals, 10);
    if (!Number.isFinite(max)) return;
    const raw = el.value;
    if (raw === '') return;                    // "3." 같은 중간 상태 포함
    const dot = raw.indexOf('.');
    if (dot === -1 || raw.length - dot - 1 <= max) return;
    el.value = raw.slice(0, dot + 1 + max);
  }

  // 입력칸이 나중에 그려지는 화면(계정 시트, 학교 찾기 성적 폼)이 있어서
  // 각자 연결하지 않고 문서 하나에 위임한다.
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el && el.dataset && el.dataset.decimals) clamp(el);
  });
})();

/** 저장 직전 한 번 더. 붙여넣기·자동완성처럼 input 을 안 거치는 경로를 막는다. */
function roundDecimals(value, places) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10 ** places) / 10 ** places;
}
