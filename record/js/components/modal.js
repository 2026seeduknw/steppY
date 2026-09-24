/**
 * 최소한의 모달 열기/닫기 헬퍼. scrim 클릭 · ESC · 닫기 버튼으로 닫힘.
 */
function openModal(scrimEl) {
  scrimEl.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeModal(scrimEl) {
  scrimEl.classList.remove('is-open');
  document.body.style.overflow = '';
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
