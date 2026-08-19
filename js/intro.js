/**
 * F1 인트로(랜딩): 햄버거 메뉴 토글, 교환 가능 국가명 플로팅 마퀴.
 */
(function () {
  const COUNTRIES = ['UNITED STATES', 'UNITED KINGDOM', 'FRANCE', 'GERMANY', 'JAPAN', 'SINGAPORE', 'AUSTRALIA', 'CANADA', 'SWITZERLAND'];

  const track = document.getElementById('marqueeTrack');
  function renderMarquee() {
    const itemsHtml = COUNTRIES.map(c => `<span class="country">${c}</span><span class="dot"></span>`).join('');
    // 두 번 반복해 translateX(-50%) 루프가 이음매 없이 이어지도록 함
    track.innerHTML = itemsHtml + itemsHtml;
  }
  renderMarquee();

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navMenu = document.getElementById('navMenu');
  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navMenu.classList.toggle('is-open');
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && e.target !== hamburgerBtn) {
      navMenu.classList.remove('is-open');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    }
  });
})();
