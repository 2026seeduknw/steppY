/**
 * 온보딩 넘기기 — 첫 장(지구·숫자) + Four Steps 네 장을 옆으로 한 장씩.
 *
 * 넘기기는 브라우저의 가로 스크롤 스냅에 맡긴다(손가락으로 밀어도, 버튼으로 넘겨도 같은 길).
 * 지금 몇 번째 장인지는 scrollLeft 로 읽어 점·버튼을 맞춘다.
 * 마지막 장에서는 "다음" 대신 밀어서 시작하기(swipe-start.js)가 나오고, 그 아래에 둘러보기·약관이 나온다.
 */
(function () {
  const track = document.getElementById('obTrack');
  if (!track) return;
  const slides = [...track.querySelectorAll('.ob-slide')];
  const dots = [...document.querySelectorAll('#obDots span')];
  const back = document.getElementById('obBack');
  const next = document.getElementById('obNext');
  const skip = document.getElementById('obSkip');
  const bar = document.getElementById('obBar');
  const last = slides.length - 1;
  // 로그인 화면으로 — 로그인이 남아 있으면 auth-page.js가 곧장 홈으로 보낸다
  const DEST = 'auth.html';
  let index = 0;

  const go = (i) => {
    i = Math.max(0, Math.min(last, i));
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  };

  function paint() {
    dots.forEach((d, i) => d.classList.toggle('is-on', i === index));
    bar.classList.toggle('is-first', index === 0);
    bar.classList.toggle('is-last', index === last);
    skip.hidden = index === last;
    next.textContent = index === last ? '로그인 · 회원가입' : '다음';
    slides.forEach((s, i) => s.setAttribute('aria-hidden', i === index ? 'false' : 'true'));
  }

  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== index) {
        index = i;
        paint();
        // 장이 바뀌면 그 장은 맨 위부터 읽게 한다(긴 장을 내려 읽다 넘긴 경우)
        slides[i].scrollTop = 0;
      }
    });
  }, { passive: true });

  next.addEventListener('click', () => {
    if (index === last) {
      if (typeof trackEvent === 'function') trackEvent('intro_start', {});
      location.href = DEST;
      return;
    }
    go(index + 1);
  });
  back.addEventListener('click', () => go(index - 1));
  skip.addEventListener('click', () => go(last));

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  });

  // 화면 폭이 바뀌면(회전 등) 지금 장에 다시 맞춘다
  window.addEventListener('resize', () => { track.scrollLeft = index * track.clientWidth; });

  paint();
})();
