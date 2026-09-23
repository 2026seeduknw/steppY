/**
 * F1 인트로(랜딩): 교환 가능 국가명 플로팅 마퀴, 숫자 세어 올리기.
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

  /**
   * 숫자 세어 올리기 — 271 / 76 / 32.
   *
   * 화면에 들어왔을 때 한 번만 돈다. 페이지를 열자마자 돌려버리면 스크롤해서
   * 내려왔을 때는 이미 끝나 있어서 아무 일도 없던 것처럼 보인다.
   * 끝값은 markup의 data-count-to에 있다 — JS가 죽어도 0이 아니라 숫자가 남도록
   * 스크립트가 시작할 때 최종값을 먼저 써 두고, 관찰이 붙으면 0부터 다시 센다.
   */
  const counters = [...document.querySelectorAll('[data-count-to]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!counters.length || reduceMotion || !('IntersectionObserver' in window)) {
    counters.forEach(el => { el.textContent = el.dataset.countTo; });
  } else {
    counters.forEach(el => { el.textContent = el.dataset.countTo; });

    const countUp = (el) => {
      const to = Number(el.dataset.countTo);
      const DURATION = 1100;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / DURATION);
        // 빠르게 올라갔다가 끝에서 멎는다(easeOutCubic). 선형이면 끝이 뚝 끊긴다.
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(to * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        countUp(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => io.observe(el));
  }

})();
