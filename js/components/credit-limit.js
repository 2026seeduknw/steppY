/** 학점 인정 탭 위쪽 — 출국 뒤에는 파견 중·귀국 후 국제처 일정(귀국신고 → 경험보고서 → 성적표 → 학점인정)을 먼저 둔다. */
function renderCreditsTop() {
  const tl = document.getElementById('creditsTimeline');
  if (tl && typeof renderOiaTimeline === 'function') {
    const info = (typeof departureInfo === 'function' && AppState.getConfirmedSchool()) ? departureInfo() : {};
    if (info.phase === 'abroad' || info.phase === 'after') {
      tl.hidden = false;
      renderOiaTimeline(tl, {
        phases: info.phase === 'after' ? ['return'] : ['abroad', 'return'],
        title: info.phase === 'after' ? '귀국 후 할 일' : '파견 중 · 귀국 후 할 일'
      });
    } else {
      tl.hidden = true;
    }
  }
}
