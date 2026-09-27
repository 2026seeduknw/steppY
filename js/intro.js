/**
 * F1 인트로(랜딩): 교환 가능 국가명 플로팅 마퀴, 숫자 세어 올리기.
 */
(function () {
  const COUNTRIES = ['UNITED STATES', 'UNITED KINGDOM', 'FRANCE', 'GERMANY', 'JAPAN', 'SINGAPORE', 'AUSTRALIA', 'CANADA', 'SWITZERLAND'];

  /* 국가 마퀴는 지구 위 불빛과 같은 말을 해서 랜딩에서 뺐다. 마크업이 없으면
     그냥 건너뛴다 — 예전에는 여기서 null 에 innerHTML 을 쓰다 터졌고, 같은
     IIFE 안에 있던 숫자 카운트업까지 통째로 죽었다(숫자가 0 에 멈춰 있던 원인).
     되돌리고 싶으면 index.html 에 .intro__marquee 를 다시 넣기만 하면 된다. */
  const track = document.getElementById('marqueeTrack');
  if (track) {
    const itemsHtml = COUNTRIES.map(c => `<span class="country">${c}</span><span class="dot"></span>`).join('');
    // 두 번 반복해 translateX(-50%) 루프가 이음매 없이 이어지도록 함
    track.innerHTML = itemsHtml + itemsHtml;
  }

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

    /**
     * 인트로 스플래시가 끝난 뒤에 관찰을 시작한다.
     *
     * 숫자는 이제 첫 화면 안에 있다(국가 마퀴를 빼면서 위로 올라왔다).
     * 관찰을 바로 걸면 스플래시가 흰 화면으로 덮고 있는 1.9초 동안 숫자가
     * 다 올라가 버려서, 정작 화면이 드러났을 때는 아무 일도 없던 것처럼 보인다.
     *
     * 스플래시가 없거나(재방문·모션 최소화) 이미 끝났으면 바로 시작한다.
     */
    const startCounting = () => counters.forEach(el => io.observe(el));
    if (document.getElementById('introSplash')) {
      // 착지 직후 바로 세면 스플래시가 끝나는 것과 숫자가 튀는 게 겹쳐 보인다.
      // 착지의 여운이 가시고 나서 세어 올리도록 한 박자(1초) 쉰다.
      document.addEventListener('splash:done', () => setTimeout(startCounting, 1000), { once: true });
    } else {
      startCounting();
    }
  }

})();
