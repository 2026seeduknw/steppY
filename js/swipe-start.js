/**
 * 밀어서 시작하기 — 랜딩 아래에 고정된 시작 버튼.
 *
 * 왜 스와이프인가: 랜딩이 길어서 아래로 읽어 내려가면 위쪽 버튼이 화면 밖으로
 * 나간다. 아래에 고정해 두면 언제든 시작할 수 있고, 스크롤을 내리다 손가락이
 * 스치는 자리라 그냥 버튼이면 잘못 눌리기 쉽다. 밀어야 넘어가므로 오작동이 없다.
 *
 * 다만 밀기만 되면 접근성이 없다. 탭·엔터·스페이스로도 같은 동작을 하게 했다.
 */
(function () {
  const root = document.getElementById('swipeStart');
  if (!root) return;

  const track = root.querySelector('.swipe-start__track');
  const knob = document.getElementById('swipeKnob');
  const DEST = 'auth.html';

  let dragging = false;
  let startX = 0;
  let offset = 0;
  let maxOffset = 0;
  let moved = false;

  const measure = () => {
    // 손잡이가 트랙 밖으로 나가지 않는 최대 이동 거리
    maxOffset = Math.max(0, track.clientWidth - knob.offsetWidth - 8);
  };

  function setOffset(px) {
    offset = Math.min(maxOffset, Math.max(0, px));
    knob.style.transform = `translateX(${offset}px)`;
    // 끝에 가까울수록 안내 문구가 옅어진다 — 진행 중이라는 신호
    root.style.setProperty('--swipe-progress', maxOffset ? String(offset / maxOffset) : '0');
  }

  function release() {
    if (!dragging) return;
    dragging = false;
    knob.classList.remove('is-dragging');

    if (maxOffset && offset / maxOffset >= 0.82) {
      root.classList.add('is-done');
      setOffset(maxOffset);
      if (typeof trackEvent === 'function') trackEvent('intro_swipe_start', {});
      location.href = DEST;
      return;
    }
    // 끝까지 못 갔으면 제자리로. transition은 여기서만 켠다 —
    // 드래그 중에 켜두면 손가락을 따라오지 못하고 늦게 따라온다.
    knob.classList.add('is-returning');
    setOffset(0);
    setTimeout(() => knob.classList.remove('is-returning'), 220);
  }

  knob.addEventListener('pointerdown', (e) => {
    measure();
    dragging = true;
    moved = false;
    startX = e.clientX;
    knob.classList.add('is-dragging');
    knob.setPointerCapture(e.pointerId);
  });

  knob.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    setOffset(dx);
  });

  knob.addEventListener('pointerup', release);
  knob.addEventListener('pointercancel', release);

  // 밀지 않고 탭한 경우에도 넘어간다
  track.addEventListener('click', () => { if (!moved) location.href = DEST; });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.href = DEST; }
  });

  window.addEventListener('resize', () => { measure(); setOffset(0); });
  measure();
})();
