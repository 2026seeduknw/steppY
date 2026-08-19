/**
 * Split-flap(공항 출발 안내판) 스타일 텍스트 보드.
 * F1 인트로의 "교환 가능 국가명 흘러가는 노출" 요구사항을,
 * 일반 마퀴 대신 서비스 정체성(비행기·여정)에 맞는 시그니처 컴포넌트로 구현.
 */
function createSplitFlap(container, { length = 22, align = 'center' } = {}) {
  container.classList.add('splitflap');
  container.innerHTML = '';
  const cells = [];
  for (let i = 0; i < length; i++) {
    const cell = document.createElement('span');
    cell.className = 'splitflap__char';
    const inner = document.createElement('span');
    inner.textContent = ' ';
    cell.appendChild(inner);
    container.appendChild(cell);
    cells.push(inner);
  }

  function pad(text) {
    const t = text.toUpperCase();
    if (t.length >= length) return t.slice(0, length);
    const totalPad = length - t.length;
    if (align === 'center') {
      const left = Math.floor(totalPad / 2);
      return ' '.repeat(left) + t + ' '.repeat(totalPad - left);
    }
    return t + ' '.repeat(totalPad);
  }

  function flipCell(el, newChar, delay) {
    setTimeout(() => {
      if (el.textContent === newChar) return;
      el.style.transition = 'transform 130ms ease-in, opacity 130ms ease-in';
      el.style.transform = 'rotateX(-90deg)';
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = newChar;
        el.style.transition = 'none';
        el.style.transform = 'rotateX(90deg)';
        el.style.opacity = '0';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition = 'transform 170ms cubic-bezier(0.16,1,0.3,1), opacity 170ms ease-out';
            el.style.transform = 'rotateX(0deg)';
            el.style.opacity = '1';
          });
        });
      }, 130);
    }, delay);
  }

  function setText(text) {
    const padded = pad(text).split('');
    padded.forEach((ch, i) => flipCell(cells[i], ch, i * 22));
  }

  return { setText, el: container };
}

function startSplitFlapCycle(container, items, { length = 22, interval = 2800 } = {}) {
  const board = createSplitFlap(container, { length });
  let i = 0;
  board.setText(items[0]);
  const timer = setInterval(() => {
    i = (i + 1) % items.length;
    board.setText(items[i]);
  }, interval);
  return () => clearInterval(timer);
}
