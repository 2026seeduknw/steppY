/**
 * F1 인트로: 시간대별 하늘/지구본 컬러, 국가명 split-flap, 스크롤 시 F2 전환.
 */
(function () {
  function timeBucket() {
    const h = new Date().getHours();
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 18) return 'day';
    if (h >= 18 && h < 20) return 'dusk';
    return 'night';
  }
  document.body.dataset.tod = timeBucket();

  // 추상 대륙 실루엣 SVG를 데이터 URI로 생성해 지구본 표면에 반복 배치
  const continentsSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="260" viewBox="0 0 300 260">
      <g fill="#14324a" opacity="0.55">
        <ellipse cx="40" cy="70" rx="26" ry="16"/>
        <ellipse cx="70" cy="110" rx="18" ry="30"/>
        <ellipse cx="130" cy="50" rx="34" ry="14"/>
        <ellipse cx="150" cy="150" rx="22" ry="34"/>
        <ellipse cx="210" cy="90" rx="30" ry="20"/>
        <ellipse cx="250" cy="160" rx="20" ry="26"/>
        <ellipse cx="20" cy="190" rx="16" ry="22"/>
        <ellipse cx="270" cy="40" rx="18" ry="12"/>
      </g>
    </svg>`.trim();
  const dataUri = `url("data:image/svg+xml,${encodeURIComponent(continentsSvg)}")`;
  document.documentElement.style.setProperty('--continents-svg', dataUri);

  // 국가명 split-flap 보드
  startSplitFlapCycle(document.getElementById('countryBoard'), MOCK.countries, { length: 20, interval: 2600 });

  // 스크롤 다운 → F2로 전환
  let transitioning = false;
  function goToHome() {
    if (transitioning) return;
    transitioning = true;
    document.getElementById('transitionOverlay').classList.add('is-active');
    setTimeout(() => { window.location.href = 'home.html'; }, 650);
  }
  window.addEventListener('wheel', (e) => { if (e.deltaY > 0) goToHome(); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'PageDown') goToHome(); });
  document.getElementById('scrollHint').addEventListener('click', goToHome);
  let touchStartY = null;
  window.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchStartY !== null && touchStartY - e.touches[0].clientY > 40) goToHome();
  }, { passive: true });
})();
