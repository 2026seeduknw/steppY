/**
 * 최소한의 모달 열기/닫기 헬퍼. scrim 클릭 · ESC · 닫기 버튼으로 닫힘.
 */
function openModal(scrimEl) {
  if (!scrimEl.classList.contains('is-open')) lockPageScroll();
  scrimEl.classList.add('is-open');
}

function closeModal(scrimEl) {
  if (scrimEl.classList.contains('is-open')) unlockPageScroll();
  scrimEl.classList.remove('is-open');
  const panel = scrimEl.querySelector('.modal-panel');
  if (panel) { panel.style.transition = ''; panel.style.transform = ''; }
}

/* 모달이 떠 있는 동안 뒤 화면이 같이 스크롤되지 않게 한다.
   body overflow:hidden 만으로는 아이폰(WKWebView)에서 뒤가 계속 밀렸다 —
   문서 루트도 막고, 시트 밖(어두운 배경)을 미는 손가락은 아예 받지 않는다.
   모달이 겹쳐 열릴 수 있어 몇 개가 열려 있는지 센다. */
let _scrollLocks = 0;
function lockPageScroll() {
  if (_scrollLocks++ > 0) return;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.addEventListener('touchmove', _blockOutsideScroll, { passive: false });
}
function unlockPageScroll() {
  if (_scrollLocks === 0 || --_scrollLocks > 0) return;
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.removeEventListener('touchmove', _blockOutsideScroll);
}
function _blockOutsideScroll(e) {
  // 시트·필터 시트처럼 스스로 스크롤하는 판 안이면 그대로 둔다
  if (e.target.closest && e.target.closest('.modal-panel, .app-sheet__panel, [data-scroll-ok]')) return;
  if (e.cancelable) e.preventDefault();
}

/* 아래에서 올라온 시트를 위쪽을 잡고 끌어내려 닫는다.
   시트 내용이 맨 위까지 올라가 있을 때만 시작한다 — 중간에서 아래로 쓸면 그냥 내용 스크롤이다.
   scrim 에 한 번만 걸어 두면 안의 시트를 다시 그려도(innerHTML) 계속 된다. */
function wireSheetDrag(scrimEl) {
  let panel = null, startY = 0, startT = 0, dy = 0, dragging = false, armed = false;
  scrimEl.addEventListener('touchstart', (e) => {
    panel = e.target.closest('.modal-panel');
    if (!panel || !scrimEl.classList.contains('is-open') || e.touches.length !== 1) { armed = false; return; }
    armed = panel.scrollTop <= 0;
    dragging = false; dy = 0;
    startY = e.touches[0].clientY; startT = Date.now();
  }, { passive: true });
  scrimEl.addEventListener('touchmove', (e) => {
    if (!armed) return;
    const d = e.touches[0].clientY - startY;
    if (!dragging) {
      // 위로 밀면 평소처럼 내용 스크롤
      if (d < 0 || panel.scrollTop > 0) { armed = false; return; }
      if (d < 6) return;
      dragging = true;
      panel.style.transition = 'none';
    }
    dy = Math.max(0, d);
    panel.style.transform = `translateY(${dy}px)`;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  const end = () => {
    if (!armed) return;
    armed = false;
    if (!dragging) return;
    dragging = false;
    const fast = dy > 40 && dy / Math.max(1, Date.now() - startT) > 0.6;
    panel.style.transition = '';
    if (dy > panel.offsetHeight * 0.22 || fast) {
      closeModal(scrimEl);
    } else {
      panel.style.transform = '';
    }
  };
  scrimEl.addEventListener('touchend', end);
  scrimEl.addEventListener('touchcancel', end);
}

function wireModalDismiss(scrimEl) {
  scrimEl.addEventListener('click', (e) => {
    if (e.target === scrimEl) closeModal(scrimEl);
  });
  wireModalCloseButtons(scrimEl);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && scrimEl.classList.contains('is-open')) closeModal(scrimEl);
  });
}

/** scrim의 innerHTML을 다시 그린 뒤(close 버튼이 새 노드가 된 경우) 다시 호출 */
function wireModalCloseButtons(scrimEl) {
  scrimEl.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(scrimEl));
  });
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

/**
 * 긴 설명 글에 줄바꿈을 넣는다(app_ui.md: 문장·절이 이어지면 줄을 바꾼다).
 * 데이터에서 온 긴 문장은 " · ", "; ", ") (" 로 이어 붙어 있는 경우가 많아 그 자리에서 끊는다.
 * HTML이 들어 있지 않은 평문에만 쓴다.
 */
function readableText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s+·\s+/g, '<br>')
    .replace(/;\s+/g, ';<br>')
    .replace(/\)\s+\(/g, ')<br>(')
    .replace(/(?<=[가-힣])\.\s+/g, '.<br>');   // 한국어 문장 끝만(Univ. of 같은 약어는 그대로)
}
