/**
 * 가로 스크롤 트랙에 점 인디케이터를 붙인다.
 *
 * 왜 필요하냐면 — 홈의 "지망하는 학교"는 857px 트랙 중 309px만 보이는데, 다음
 * 카드가 20px만 걸쳐 보여서 "카드 하나 + 테두리 조각"처럼 읽혔다. 옆으로 밀 수
 * 있다는 신호가 없으니 2·3지망이 있는 줄 모르고 지나치게 된다.
 * 카드 폭을 줄여 다음 카드를 더 드러내는 것과 함께, 몇 개 중 몇 번째인지도
 * 점으로 알려준다.
 *
 * 트랙을 다시 그릴 때마다 호출하면 된다 — 기존 인디케이터는 스스로 치운다.
 */
function attachCarouselDots(track) {
  if (!track || !track.parentElement) return;

  const prev = track.parentElement.querySelector('.carousel-dots');
  if (prev) prev.remove();

  const items = [...track.children];
  // 항목이 하나거나 트랙이 다 보이면 인디케이터가 알려줄 게 없다
  if (items.length < 2 || track.scrollWidth <= track.clientWidth + 1) return;

  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = items.map((_, i) =>
    `<span class="carousel-dots__dot${i === 0 ? ' is-active' : ''}"></span>`).join('');
  track.insertAdjacentElement('afterend', dots);

  const marks = [...dots.children];

  // 스크롤 위치를 항목 인덱스로 바꾸는 대신, 실제로 가장 많이 보이는 항목을
  // 현재로 친다. 카드 폭이 제각각이어도(진행 단계 카드가 그렇다) 맞는다.
  function sync() {
    const trackBox = track.getBoundingClientRect();
    let best = 0;
    let bestVisible = -1;
    items.forEach((el, i) => {
      const box = el.getBoundingClientRect();
      const visible = Math.min(box.right, trackBox.right) - Math.max(box.left, trackBox.left);
      if (visible > bestVisible) { bestVisible = visible; best = i; }
    });
    marks.forEach((d, i) => d.classList.toggle('is-active', i === best));
  }

  let queued = false;
  track.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }, { passive: true });

  sync();
}
