/**
 * 학점 인정 한도 계산 — 학점 인정 탭 맨 위.
 *
 * 과목 매칭은 "어느 과목이 인정될까"를 보여주지만, 그 전에 "몇 학점까지 인정되나"가 정해져 있다
 * (국제처 책자 9.2·9.3):
 *   학부 — 1학기 졸업학점의 1/8, 1년 1/4 (5년제 건축 1/10, 1/5). 대학원 — 학기당 12학점.
 *   ECTS 는 절반, 쿼터제는 2/3, 소수점 올림.
 * 계산식은 js/oia-rules.js 에 있다. 졸업학점은 학과마다 달라 직접 받고, 이 기기에 기억해 둔다.
 */
function renderCreditLimit(mount) {
  if (!mount) return;
  const p = AppState.profile;
  const a = p.academic || {};
  const graduate = a.degree && a.degree !== 'undergrad';
  const school = AppState.getConfirmedSchool();
  const KEY = 'steppy_credit_limit_inputs';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* 무시 */ }
  const st = {
    grad: saved.grad || 130,
    semesters: (p.exchangeTerm || {}).length === 2 ? 2 : 1,
    arch5: !!saved.arch5,
    system: saved.system || OIA.creditSystemOf(school),
    earned: saved.earned || ''
  };
  // 접어 두면 제목과 최대 학점만 보인다. 처음엔 접어서 아래 과목 목록이 먼저 보이게 한다
  const OPEN_KEY = 'steppy_credit_limit_open';
  let open = false;
  try { open = localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { /* 무시 */ }

  function draw() {
    const limit = OIA.creditLimit({ gradCredits: Number(st.grad), semesters: st.semesters, arch5: st.arch5, graduate });
    const converted = OIA.convertCredits(st.earned, st.system);
    const result = converted == null ? null : Math.min(converted, limit || Infinity);
    const sysLabel = { semester: '학기제', ects: 'ECTS', quarter: '쿼터제' };
    mount.innerHTML = `
      <div class="climit">
        <div class="climit__head">
          <h2 class="climit__title">몇 학점까지 인정될까?</h2>
          <span class="climit__right">
            ${limit ? `<span class="climit__limit">최대 <strong class="tnum">${limit}</strong>학점</span>` : ''}
            <button type="button" class="climit__toggle" data-climit-toggle aria-expanded="${open}" aria-label="${open ? '접기' : '펼치기'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </span>
        </div>
        <div class="climit__body"${open ? '' : ' hidden'}>
        <div class="climit__grid">
          ${graduate ? `<p class="climit__note">대학원은 파견 학기당 12학점까지예요.</p>` : `
          <label class="climit__field"><span>졸업학점</span>
            <input type="number" inputmode="numeric" min="60" max="200" name="grad" value="${st.grad}"></label>`}
          <div class="climit__field"><span>기간</span>
            <div class="climit__chips">${[[1, '한 학기'], [2, '1년']].map(([v, l]) => `<button type="button" class="chip${st.semesters === v ? ' is-selected' : ''}" data-sem="${v}">${l}</button>`).join('')}</div></div>
          <div class="climit__field"><span>파견교 학점</span>
            <div class="climit__chips">${Object.entries(sysLabel).map(([v, l]) => `<button type="button" class="chip${st.system === v ? ' is-selected' : ''}" data-sys="${v}">${l}</button>`).join('')}</div></div>
          <label class="climit__field"><span>이수 학점</span>
            <input type="number" inputmode="decimal" min="0" step="0.5" name="earned" value="${st.earned}" placeholder="${st.system === 'ects' ? '예: 30 ECTS' : '예: 15'}"></label>
        </div>
        ${!graduate ? `<label class="climit__check"><input type="checkbox" name="arch5" ${st.arch5 ? 'checked' : ''}> 5년제 건축학 전공</label>` : ''}
        ${result != null ? `<p class="climit__result">연세대 학점으로 <strong class="tnum">${result}</strong>학점
          <span>${st.system === 'ects' ? `${st.earned} ECTS ÷ 2 = ${converted}` : st.system === 'quarter' ? `${st.earned} × 2/3 = ${converted}` : `${converted}`}${limit && converted > limit ? ` → 한도 ${limit}학점까지만` : ''}</span></p>` : ''}
        <details class="climit__rules">
          <summary>과목으로 인정받는 규칙</summary>
          <ul>
            <li>내용이 거의 같고 파견교 학점 ≥ 연세대 학점일 때 과목으로 대체돼요.<br>두 과목을 합쳐 맞출 수도 있어요.</li>
            <li>파견교 1과목을 연세대 2과목으로 인정받을 수는 없어요.<br>남는 학점은 일반선택이에요.</li>
            <li>입학년도 이후 실제로 열린 연세대 과목만 대체할 수 있어요.<br>이미 들은 과목은 일반선택만 돼요.</li>
            <li>F·Non-Pass·수강취소 과목은 빠져요.<br>파견 학점은 평량평균에 들어가지 않아요.</li>
            <li>성적증명서로 이수를 증명해야 하는 과목(영양사·CPA 등)은 대체인정 받지 말고 연세대에서 들으세요.</li>
            <li>승인: 전공 = 담당교수+학과장, 학부대학 과목 = 담당교수+학부대학장, 일반선택 = 학사지원팀.</li>
          </ul>
        </details>
        <p class="climit__source">출처 · 2027-2 국제처 해외파견프로그램 안내 9장.<br>실제 인정은 국제처 환산 뒤 학사지원팀이 승인해요.<br>학과·학번마다 다를 수 있으니 꼭 직접 확인하세요.</p>
        </div>
      </div>`;

    const head = mount.querySelector('.climit__head');
    head.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      open = !open;
      try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (err) { /* 무시 */ }
      draw();
    });
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ grad: st.grad, arch5: st.arch5, system: st.system, earned: st.earned })); } catch (e) { /* 무시 */ } };
    mount.querySelectorAll('[data-sem]').forEach(b => b.addEventListener('click', () => { st.semesters = Number(b.dataset.sem); draw(); }));
    mount.querySelectorAll('[data-sys]').forEach(b => b.addEventListener('click', () => { st.system = b.dataset.sys; persist(); draw(); }));
    mount.querySelectorAll('input[name="grad"], input[name="earned"]').forEach(inp => inp.addEventListener('change', () => {
      st[inp.name] = inp.value; persist(); draw();
    }));
    const arch = mount.querySelector('input[name="arch5"]');
    if (arch) arch.addEventListener('change', () => { st.arch5 = arch.checked; persist(); draw(); });
  }
  draw();
}

/** 학점 인정 탭 위쪽 — 출국 뒤에는 파견 중·귀국 후 국제처 일정(귀국신고 → 경험보고서 → 성적표 → 학점인정)을 먼저 둔다. */
function renderCreditsTop() {
  const tl = document.getElementById('creditsTimeline');
  if (tl && typeof renderOiaTimeline === 'function') {
    const info = (typeof departureInfo === 'function' && AppState.getConfirmedSchool()) ? departureInfo() : {};
    if (info.phase === 'abroad' || info.phase === 'after') {
      tl.hidden = false;
      renderOiaTimeline(tl, {
        phases: info.phase === 'after' ? ['return'] : ['abroad', 'return'],
        title: info.phase === 'after' ? '귀국 후 할 일' : '파견 중 · 귀국 후 할 일'
      });
    } else {
      tl.hidden = true;
    }
  }
  renderCreditLimit(document.getElementById('creditLimit'));
}
