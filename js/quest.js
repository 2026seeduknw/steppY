/**
 * 퀘스트 — 교환 생활에서 해볼 만한 작은 도전을 로드맵으로 따라가는 화면.
 *
 * 원래 기록 화면(diary.html)의 세 번째 버튼이던 기능을 하단 탭의 한 페이지로 옮겼다.
 *   - 목표를 여러 개 동시에 켤 수 있고, 목표마다 독립된 로드맵을 가진다.
 *   - 날짜가 아니라 "완료 개수"가 곧 로드맵 위치라서 하루 건너뛰어도 페널티가 없다.
 *   - 완료는 누르기만 하면 되고(증빙 없음), 5개마다 레벨업한다.
 *   - 완료 직후 "사진으로 남겨볼까요?"로 기록하기 화면(카메라)에 자연스럽게 잇는다.
 *
 * 저장은 이 기기의 localStorage(계정별 키). 서버(Supabase)에는 아직 퀘스트 테이블이 없다.
 */
(function () {
  const QUEST_GOALS = [
    { id: 'language', ko: '언어 배우기', icon: '💬' },
    { id: 'social', ko: '친구 사귀기', icon: '🤝' },
    { id: 'culture', ko: '문화 체험하기', icon: '🌍' }
  ];
  // 목표마다 50개(QUEST_POOLS, js/quest-pools.js), 10개 깰 때마다 레벨업 → 5단계(QUEST_TIERS)
  const PER_LEVEL = 10;
  const TOTAL = 50;

  const root = document.getElementById('questRoot');
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* --------------------------------------------------------------- 저장 */

  function storeKey() {
    const uid = (typeof Auth !== 'undefined' && Auth.userId) ? Auth.userId : 'guest';
    return `steppy_quest_v1:${uid}`;
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey()) || '{}');
      return { goals: Array.isArray(raw.goals) ? raw.goals : [], progress: raw.progress && typeof raw.progress === 'object' ? raw.progress : {} };
    } catch (e) { return { goals: [], progress: {} }; }
  }
  function save(state) {
    try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* 저장 못 해도 화면은 계속 동작 */ }
  }

  // 순서대로 열린다. 50개를 다 깨면 더 나올 게 없다(끝까지 온 것).
  const questAt = (goal, idx) => { const pool = QUEST_POOLS[goal]; return pool && idx < pool.length ? pool[idx] : null; };
  const levelOf = (progress) => Math.min(Math.floor(progress / PER_LEVEL) + 1, QUEST_TIERS.length);
  const tierOf = (progress) => QUEST_TIERS[levelOf(progress) - 1];
  const isAllDone = (progress) => progress >= TOTAL;
  const posInLevel = (progress) => (isAllDone(progress) ? PER_LEVEL : progress % PER_LEVEL);

  /* --------------------------------------------------------------- 화면 */

  // 듀오링고 유닛 경로처럼 지그재그로 굽이치는 점선 도로 위에 노드 10개를 얹는다(한 레벨 = 10칸)
  const NODE_X = [100, 152, 100, 48];          // 좌우로 굽이치는 4칸 주기
  const NODE_GAP = 74;
  const PATH_H = 40 + NODE_GAP * (PER_LEVEL - 1) + 40;

  function roadmapHtml(goalId, state) {
    const info = QUEST_GOALS.find(g => g.id === goalId);
    if (!info) return '';
    const progress = state.progress[goalId] || 0;
    const allDone = isAllDone(progress);
    const level = levelOf(progress);
    const pos = posInLevel(progress);
    const NX = Array.from({ length: PER_LEVEL }, (_, i) => NODE_X[i % NODE_X.length]);
    const NY = Array.from({ length: PER_LEVEL }, (_, i) => 40 + i * NODE_GAP);
    const pathD = NX.map((x, i) => i === 0 ? `M${x},${NY[i]}` : `Q${(NX[i - 1] + x) / 2},${(NY[i - 1] + NY[i]) / 2} ${x},${NY[i]}`).join(' ');
    const nodes = NX.map((x, i) => {
      let cls = 'quest-node--upcoming';
      let label = String(i + 1);
      if (i < pos) { cls = 'quest-node--done'; label = '✓'; }
      else if (i === pos) { cls = 'quest-node--current'; label = '📍'; }
      if (i === NX.length - 1) cls += ' quest-node--checkpoint';
      return `<span class="quest-node ${cls}" style="left:${x / 2}%; top:${NY[i]}px;">${label}</span>`;
    }).join('');
    const current = questAt(goalId, progress);
    return `
      <section class="quest-roadmap" aria-label="${esc(info.ko)} 로드맵">
        <div class="quest-roadmap__head">
          <span class="quest-roadmap__title">${info.icon} ${esc(info.ko)}</span>
          <span class="quest-roadmap__level">Lv.${level}</span>
          <span class="quest-roadmap__tier">${allDone ? '전부 완료' : tierOf(progress)}</span>
          <button type="button" class="quest-roadmap__remove" data-remove-goal="${goalId}" aria-label="${esc(info.ko)} 그만하기" title="그만하기">✕</button>
        </div>
        <p class="quest-roadmap__count">${allDone ? `${TOTAL} / ${TOTAL}` : `${progress % PER_LEVEL} / ${PER_LEVEL}`} <span>· 전체 ${Math.min(progress, TOTAL)} / ${TOTAL}</span></p>
        <div class="quest-path" style="height:${PATH_H}px">
          <svg class="quest-path__line" viewBox="0 0 200 ${PATH_H}" preserveAspectRatio="none" aria-hidden="true">
            <path d="${pathD}" fill="none" stroke="#cbd6e5" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 14"/>
          </svg>
          ${nodes}
        </div>
        <div class="quest-roadmap__current">
          ${allDone
            ? `<p class="quest-roadmap__quest">🏆 ${esc(info.ko)} 퀘스트 ${TOTAL}개를 모두 깼어요!</p>`
            : `<p class="quest-roadmap__quest">${esc(current)}</p>
               <button type="button" class="quest-complete" data-complete-goal="${goalId}">완료하기</button>`}
        </div>
      </section>`;
  }

  function render() {
    const state = load();
    const total = Object.values(state.progress).reduce((a, b) => a + (Number(b) || 0), 0);
    const available = QUEST_GOALS.filter(g => !state.goals.includes(g.id));

    root.innerHTML = `
      <div class="quest-head">
        <p class="quest-lede">완료할 때마다 다음 칸이 열려요. 날짜는 상관없어요 — 내 속도대로 해요.</p>
        <span class="quest-total"><b>${total}</b> 완료</span>
      </div>

      ${available.length ? `
        <h2 class="quest-section quest-section--first">${state.goals.length ? '목표 추가하기' : '목표 고르기'}</h2>
        <div class="quest-goal-grid">
          ${available.map(g => `<button type="button" class="quest-goal-card" data-add-goal="${g.id}"><span class="quest-goal-card__icon" aria-hidden="true">${g.icon}</span><span>${esc(g.ko)}</span></button>`).join('')}
        </div>` : ''}

      ${state.goals.length
        ? state.goals.map(g => roadmapHtml(g, state)).join('')
        : `<div class="quest-empty"><p class="quest-empty__title">아직 시작한 목표가 없어요</p><p class="quest-empty__desc">위에서 하나 골라 첫 퀘스트를 시작해 보세요.</p></div>`}
    `;

    root.querySelectorAll('[data-add-goal]').forEach(btn => btn.addEventListener('click', () => {
      const s = load();
      if (!s.goals.includes(btn.dataset.addGoal)) s.goals.push(btn.dataset.addGoal);
      if (s.progress[btn.dataset.addGoal] === undefined) s.progress[btn.dataset.addGoal] = 0;
      save(s);
      render();
    }));
    // X를 누르면 확인창 없이 바로 카드가 사라진다. 진행 상황은 저장돼 있어서 목표를 다시 고르면 이어진다.
    root.querySelectorAll('[data-remove-goal]').forEach(btn => btn.addEventListener('click', () => {
      const s = load();
      s.goals = s.goals.filter(g => g !== btn.dataset.removeGoal);
      save(s);
      const card = btn.closest('.quest-roadmap');
      const done = () => { render(); if (typeof showToast === 'function') showToast('목표를 그만했어요. 다시 고르면 이어서 할 수 있어요'); };
      if (card) { card.classList.add('is-leaving'); setTimeout(done, 220); } else done();
    }));
    root.querySelectorAll('[data-complete-goal]').forEach(btn => btn.addEventListener('click', () => {
      const goal = btn.dataset.completeGoal;
      const s = load();
      const before = s.progress[goal] || 0;
      if (before >= TOTAL) return;
      s.progress[goal] = before + 1;
      save(s);
      render();
      if (typeof showToast === 'function') {
        showToast(s.progress[goal] >= TOTAL ? '🏆 모든 퀘스트를 깼어요!' : (s.progress[goal] % PER_LEVEL === 0 ? `레벨업! Lv.${levelOf(s.progress[goal])} (${tierOf(s.progress[goal])}) 시작 🎉` : '퀘스트를 완료했어요!'));
      }
      showNudge();
    }));
  }

  // 완료 직후 살짝 권한다 — 강제가 아니고 몇 초 뒤 사라진다. 누르면 기록하기 화면에서 바로 쓰기 창이 열린다.
  function showNudge() {
    const old = document.getElementById('questNudge');
    if (old) old.remove();
    const nudge = document.createElement('div');
    nudge.id = 'questNudge';
    nudge.className = 'quest-nudge';
    nudge.innerHTML = `
      <span>📸 이 순간을 사진으로 남겨볼까요?</span>
      <div class="quest-nudge__actions">
        <a href="journal.html?add=1" id="questNudgeYes">사진 찍기</a>
        <button type="button" id="questNudgeNo" aria-label="닫기">✕</button>
      </div>`;
    document.body.appendChild(nudge);
    const remove = () => nudge.remove();
    nudge.querySelector('#questNudgeNo').addEventListener('click', remove);
    setTimeout(remove, 6000);
  }

  render();
  // 로그인 상태가 정해지면(세션 복원·로그아웃) 그 계정의 진행 상황으로 다시 그린다
  document.addEventListener('auth:changed', render);
  document.addEventListener('MOCK:updated', render);
})();
