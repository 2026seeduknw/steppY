(function () {
  AppState.load();

  // 학교를 확정한 뒤에는 홈 대시보드 대신 교환 준비하기 화면을 보여줌.
  // Supabase 연동 시 MOCK.schools가 비동기로 실 데이터로 교체되는데, 이 IIFE는
  // 그보다 먼저 동기적으로 실행돼 getConfirmedSchool()이 아직 null일 수 있음 —
  // 그래서 최초 체크 + 'MOCK:updated' 이후 재체크 두 군데서 모두 확인함
  // (consult.js의 tryPreselect()와 동일한 패턴).
  function redirectIfConfirmed() {
    // 출국한 뒤에는 탭에 홈(준비하기)이 없고 기록이 첫 화면이다(layout.js TABS_BY_STAGE).
    // 로그인 직후처럼 홈으로 들어오는 길은 기록으로 돌린다.
    // 귀국한 뒤에는 학점 인정이 첫 화면이다 — 귀국 후 할 일이 그 화면 맨 위에 있다
    if (AppState.getConfirmedSchool() && typeof hasReturned === 'function' && hasReturned()) {
      location.replace('credits.html');
      return true;
    }
    if (AppState.getConfirmedSchool() && typeof hasDeparted === 'function' && hasDeparted()) {
      location.replace('journal.html');
      return true;
    }
    if (AppState.getConfirmedSchool()) {
      morphToPreparePage();
      return true;
    }
    return false;
  }

  if (redirectIfConfirmed()) return;

  // MY PICKS 원판 상태 — renderAll()이 아래에서 바로 불리므로 맨 위에 둔다(renderPicksWheel 참고)
  let wheelOrder = null;     // [1지망, 2지망, 3지망, 찜한 학교…] — 돌려도 바뀌지 않는다
  let focus = 0;             // 지금 맨 위(main)에 올라와 있는 칸
  const WHEEL_SLOTS = 5;

  // 로그인 상태에서는 AppState가 서버에서 채워지기 전에 이 IIFE가 먼저 돌아,
  // 최초 1회는 게스트 기본값으로 그려진다. 하이드레이션이 끝나면 'MOCK:updated'가
  // 오므로 그때 아래 네 가지를 통째로 다시 그린다(renderAll).
  // 맨 위 STEPPY 워드마크 아래 한 줄 — 이름과 파견 시기를 한 문장으로
  function renderGreeting() {
    const greeting = document.getElementById('greeting');

    // 로그인 전에는 인사할 이름도, 보여줄 파견 시기도 없다. 데모 프로필을 그대로
    // 띄우면 남의 정보를 자기 것처럼 보게 되므로 행동을 안내하는 문구로 바꾼다.
    if (!AppState.isAuthed) {
      greeting.textContent = '로그인하고 지원 가능한 학교를 찾아보세요';
      return;
    }

    const p = AppState.profile;
    const term = p.exchangeTerm || {};
    greeting.textContent = term.year
      ? `${p.name || '회원'}님, ${term.year} ${term.season} 파견 준비 중`
      : `${p.name || '회원'}님, 교환 시기를 등록하면 일정을 정리해드려요`;
  }


  /**
   * 학과·학점이 비어 있으면 지원 가능 판정이 전 학교에서 "정보 필요"로 나온다.
   * 예전에는 가입 직후 온보딩 화면으로 강제로 보냈는데, 무엇을 쓰는 앱인지
   * 보기도 전에 폼부터 만나는 순서였다 — 홈을 먼저 보여주고 여기서 부른다.
   * 채워지면 버튼은 스스로 사라진다.
   */

  function renderProfileCta() {
    const cta = document.getElementById('profileCta');
    if (!cta) return;
    const p = AppState.profile || {};
    cta.hidden = !AppState.isAuthed || !!(p.major && p.gpa);
  }

  function renderAll() {
    renderGreeting();
    renderProfileCta();
    // 기본 정보(프로필)는 앱바 계정 시트로 옮겼다 — 홈에서는 보여주지 않는다
    // 두 상자 아래 할 일 알약(todo-card.js 그대로). 펼치면 그 아래로 목록이 열린다
    renderTodoCard(document.getElementById('todoCard'));
    renderPicksWheel();
    renderJourney();
    renderUpcomingSchedule(document.getElementById('homeSchedule'));
  }

  // 바로가기 카드 — 옆으로 넘기면 아래 점이 따라간다
  (function bindShortcutDots() {
    const track = document.getElementById('shortcutTrack');
    const dots = [...document.querySelectorAll('#shortcutDots i')];
    if (!track) return;
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
    }, { passive: true });
  })();

  renderAll();

  // 제휴 업체(보험/어학원/여행) 배너 — 아직 실제 제휴처가 없는 더미 CTA.
  // 클릭 수만 세어 실제 수요가 있는지 검증하는 용도라 트래킹이 핵심이다.
  // 출시 빌드에서는 release-flags.js가 통째로 걷어낸다(partnerPromo) — 눌러도
  // 갈 곳이 없는 버튼이 보이면 심사에서 걸린다. 그래서 없을 수 있다.
  const partnerBanner = document.getElementById('partnerPromoBanner');
  if (partnerBanner) {
    partnerBanner.addEventListener('click', () => {
      trackEvent('partner_promo_click');
      showToast('아직 준비 중이에요. 기다려 주셔서 고마워요, 곧 찾아뵐게요!');
    });
  }

  // 계정 시트에서 이름을 바꾸면 인사말도 그 자리에서 바뀌어야 한다.
  // (예전에는 지망 목록만 다시 그려서, 새로고침 전까지 옛 이름이 남았다)
  document.addEventListener('profile:updated', () => {
    renderGreeting();
    renderProfileCta();
    renderPicksWheel();
  });
  document.addEventListener('MOCK:updated', () => {
    if (redirectIfConfirmed()) return;
    renderAll();
  });

  /**
   * MY PICKS — 1·2·3지망과 찜한 학교를 원판에 둘러 놓는다(한 번에 5개).
   *
   * 지망 순서는 고정이다. 원판은 "어느 학교를 크게 볼지"만 고르는 다이얼이다 —
   * 시계 반대 방향으로 돌리면 맨 위(main)가 1지망 → 2지망 → 3지망 → 찜한 학교 순으로
   * 넘어가고, 가운데에 그 학교의 지망과 이름이 뜬다. 돌린다고 지망이 저장되지는 않는다.
   * 지망을 바꾸는 건 맨 위 학교를 눌러 여는 학교 상세에서 한다.
   *
   * 돌리는 법: 좌우로 밀기 · 스크롤 · 가운데 ↻ · 다른 학교 누르기(그 학교가 맨 위로).
   */

  // 비어 있는 지망 자리는 'empty:<순위>' 로 원판에 남긴다 — 그 자리를 찜한 학교로 채워
  // 그리면 저장되지 않은 지망을 저장된 것처럼 보여주게 된다.
  function isEmptySlot(id) { return typeof id === 'string' && /^(empty|add):/.test(id); }
  const isAddSlot = (id) => typeof id === 'string' && id.startsWith('add:');
  function wheelSource() {
    const wish = AppState.getWishlist();
    const exists = (id) => id && MOCK.schools.some(s => s.id === id);
    const ids = [1, 2, 3].map(r => exists(wish[r]) ? wish[r] : 'empty:' + r);
    (AppState.load().favorites || []).forEach(id => { if (exists(id) && !ids.includes(id)) ids.push(id); });
    // 5칸이 안 차면 남는 자리는 '+'(학교 더 찜하기)로 채운다. 5칸이 넘으면 돌릴수록 다음 학교가 들어온다
    for (let i = 1; ids.length < WHEEL_SLOTS; i++) ids.push('add:' + i);
    return ids;
  }

  function logoHtml(school) {
    const file = typeof SCHOOL_LOGOS !== 'undefined' && SCHOOL_LOGOS[school.id];
    return file
      ? `<img src="assets/school-logos/${file}" alt="" data-abbr="${schoolInitials(school.name)}">`
      : `<span class="v2-logo__abbr">${schoolInitials(school.name)}</span>`;
  }

  function renderPicksWheel() {
    const mount = document.getElementById('picksWheel');

    if (!AppState.isAuthed) {
      mount.innerHTML = `
        <a class="v2-wheel__empty" href="search.html">
          <strong>지원 가능한 학교부터 찾아보세요</strong>
          <span>271개 파견교를 성적·국가·전공으로 골라볼 수 있어요</span>
        </a>`;
      return;
    }

    // 하이드레이션 뒤처럼 바깥에서 찜·지망이 바뀌었으면 원판을 새로 잡는다
    const src = wheelSource();
    if (!wheelOrder || src.join('|') !== wheelOrder.join('|')) {
      const keep = wheelOrder && wheelOrder[focus];
      wheelOrder = src;
      focus = Math.max(0, src.indexOf(keep));
    }

    if (!wheelOrder.some(id => !isEmptySlot(id))) {
      mount.innerHTML = `
        <a class="v2-wheel__empty" href="search.html">
          <strong>아직 고른 학교가 없어요</strong>
          <span>학교 찾기에서 ♡를 누르거나 희망대학표에 담으면 여기에 모여요</span>
        </a>`;
      return;
    }

    if (!mount.querySelector('.v2-wheel__ring')) {
      mount.innerHTML = `
        <span class="v2-wheel__ring" aria-hidden="true"></span>
        <div class="v2-wheel__items"></div>
        <button type="button" class="v2-wheel__center" data-rotate aria-label="다음 학교 보기">
          <span class="v2-wheel__rank"></span>
          <span class="v2-wheel__name"></span>
          <span class="v2-wheel__flag" aria-hidden="true"></span>
        </button>`;
      mount.querySelector('[data-rotate]').addEventListener('click', () => turnWheel(1));
      bindWheelGestures(mount);
    }

    const n = wheelOrder.length;
    const items = mount.querySelector('.v2-wheel__items');
    // 원판 위 학교들은 지우거나 새로 만들지 않고 계속 그 자리에 둔 채 각도만 바꾼다 —
    // 보이는 5칸 밖으로 나간 학교는 투명하게 원 뒤로 숨긴다. 요소가 생겼다 사라지면 툭툭 튄다.
    items.querySelectorAll('[data-id]').forEach(el => { if (!wheelOrder.includes(el.dataset.id)) el.remove(); });
    const half = Math.floor((WHEEL_SLOTS - 1) / 2);   // 맨 위 양옆으로 2칸씩
    wheelOrder.forEach((id, idx) => {
      const empty = isEmptySlot(id);
      const school = empty ? null : MOCK.schools.find(s => s.id === id);
      const rank = idx < 3 ? idx + 1 : 0;
      // 맨 위에서 몇 칸 떨어졌나(시계 방향 +). 반 바퀴 넘으면 반대쪽으로 센다
      let k = ((idx - focus) % n + n) % n;
      if (k > n / 2) k -= n;
      const shown = Math.abs(k) <= half;
      let el = items.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'v2-pick' + (empty ? ' is-empty' : '');
        el.dataset.id = id;
        const file = !empty && typeof SCHOOL_LOGOS !== 'undefined' && SCHOOL_LOGOS[school.id];
        el.innerHTML = `
          <span class="v2-logo${empty ? ' v2-logo--empty' : file ? '' : ' v2-logo--abbr'}">${empty ? '+' : logoHtml(school)}</span>
          <span class="v2-pick__badge">${rank || ''}</span>`;
        el.classList.toggle('is-fav', !rank && !empty);
        el.setAttribute('aria-label', isAddSlot(id) ? '학교 더 찜하기' : empty ? `희망 ${rank}순위 비어 있음` : `${rank ? '희망 ' + rank + '순위' : '찜한 학교'} ${school.name}`);
        el.addEventListener('click', () => {
          const at = wheelOrder.indexOf(id);
          if (at !== focus) return turnWheel(at - focus);   // 다른 학교를 누르면 그 학교가 맨 위로
          if (empty) location.href = 'search.html';
          else openSchoolModal(id, { onChange: () => { renderPicksWheel(); renderJourney(); } });
        });
        items.appendChild(el);
        // 로고는 비율이 제각각이라 칸이 아니라 면적을 맞춘다(logo-fit.js) — 정사각형 로고가 칸의 78%
        const img = el.querySelector('img');
        if (img) fitLogo(img, { maxW: 100, maxH: 100, area: 78 * 78, unit: '%' });
      }
      // 숨은 칸에서 반대편 숨은 칸으로 넘어갈 때(원판 뒤를 한 바퀴 도는 경우)는 애니메이션 없이 옮긴다
      const prev = el.dataset.k === undefined ? null : Number(el.dataset.k);
      const jump = prev !== null && Math.abs(k - prev) > 1;
      if (jump) { el.style.transition = 'none'; void el.offsetWidth; }
      // 화면 밖 칸은 원 위에서 조금 더 멀리(±2.7칸) 두고 투명하게 — 들어올 때 옆에서 미끄러져 온다
      const kk = shown ? k : Math.sign(k || 1) * (half + 0.7);
      el.style.setProperty('--a', (-90 + kk * (360 / WHEEL_SLOTS)) + 'deg');
      el.dataset.k = k;
      el.classList.toggle('is-top', k === 0);
      el.classList.toggle('is-hidden', !shown);
      el.tabIndex = shown ? 0 : -1;
      if (jump) { void el.offsetWidth; el.style.transition = ''; }
    });

    const topId = wheelOrder[focus];
    const topRank = focus < 3 ? focus + 1 : 0;
    const topSchool = isEmptySlot(topId) ? null : MOCK.schools.find(s => s.id === topId);
    const rankText = isAddSlot(topId) ? '학교 더 찜하기' : topRank ? `희망 ${topRank}순위` : '찜한 학교';
    const nameText = topSchool ? topSchool.name : isAddSlot(topId) ? '눌러서 학교 찾기' : '비어 있어요 · 눌러서 학교 찾기';
    const center = mount.querySelector('.v2-wheel__center');
    // 화살표(↻) 자리에는 맨 위 학교 나라의 국기를 둔다
    const flagText = topSchool ? countryFlag(topSchool.countryEn) : '';
    const rankEl = center.querySelector('.v2-wheel__rank'), nameEl = center.querySelector('.v2-wheel__name');
    const flagEl = center.querySelector('.v2-wheel__flag');
    if (nameEl.textContent === nameText && rankEl.textContent === rankText) return;
    if (!nameEl.textContent) { rankEl.textContent = rankText; nameEl.textContent = nameText; flagEl.textContent = flagText; return; }
    // 원판이 도는 동안 글자가 살짝 사라졌다가 새 학교로 바뀐다
    center.classList.add('is-changing');
    clearTimeout(center._swap);
    center._swap = setTimeout(() => {
      rankEl.textContent = rankText; nameEl.textContent = nameText; flagEl.textContent = flagText;
      center.classList.remove('is-changing');
    }, 220);
  }

  // steps > 0: 시계 반대 방향으로 돌아 다음 칸(1지망 → 2지망 …)이 맨 위로 온다
  function turnWheel(steps) {
    if (!wheelOrder || wheelOrder.length < 2 || !steps) return;
    const n = wheelOrder.length;
    // 반 바퀴보다 먼 칸은 반대쪽으로 도는 게 짧다
    let k = ((steps % n) + n) % n;
    if (k > n / 2) k -= n;
    focus = ((focus + k) % n + n) % n;
    renderPicksWheel();
  }

  function bindWheelGestures(el) {
    // 좌우로 밀기 — 왼쪽으로 밀면 원판이 시계 반대 방향으로 돈다
    let x0 = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    el.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) {
        turnWheel(dx < 0 ? 1 : -1);
        // 밀고 손을 뗀 자리의 학교가 눌린 것으로 처리되지 않게 이번 클릭은 삼킨다
        el.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      }
    });
    // 스크롤(마우스 휠·트랙패드) — 한 번 굴릴 때 한 칸씩
    let acc = 0, lock = false;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (lock) return;
      acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(acc) < 30) return;
      turnWheel(acc > 0 ? 1 : -1);
      acc = 0; lock = true;
      setTimeout(() => { lock = false; }, 280);
    }, { passive: false });
  }

  /**
   * 진행 단계 — 시작과 끝을 잇는 한 줄 위에 발자국으로 현재 위치를 표시한다.
   *
   * 예전엔 단계마다 카드를 만들어 가로로 스크롤시켰는데, 4단계 중 2개만 보이고
   * 나머지는 밀어야 나와서 "지금 어디쯤인지"가 한눈에 안 잡혔다. 이제 모든 단계를
   * 한 줄에 두고 지나온 구간만 선을 채운다.
   *
   * '학교 탐색'과 '지망 선택'은 한 단계다 — 찾아보는 일과 1~3지망에 담는 일이
   * 같은 화면(학교 찾기)에서 이어지고, 둘을 나눠 봐야 사용자가 할 일이 달라지지
   * 않는다. 나뉘어 있을 때는 즐겨찾기만 눌러도 첫 칸이 채워져, 아직 아무것도
   * 고르지 않았는데 진도가 나간 것처럼 보였다.
   */
  function renderJourney() {
    const p = AppState.profile;
    const hasWishlist = AppState.getWishlistList().length > 0;
    const confirmed = AppState.getConfirmedSchool();
    const { data: term } = OIA.termOf(p);
    const passed = (iso) => !!iso && Date.now() > OIA.kst(iso).getTime();
    // 실제 흐름(국제처): 희망대학표를 내고(1월 초) → 배정 결과가 나오고(1월 20일) → 준비.
    // 학생이 학교를 '확정'하는 단계는 없다. 지원·배정은 날짜가 지나면 지난 것으로 본다.
    // 확정을 취소하고 돌아왔으면 지망이 남아 있어도 다시 '탐색'부터다(state.js).
    // 네 칸이 반쪽 상자(약 170px)에 들어가야 해서 이름은 두 글자로 — 넉 자면 두 줄로 접힌다.
    const steps = [
      { label: '탐색', done: hasWishlist && !AppState.confirmCancelled },
      { label: '지원', sub: term ? OIA.fmtDate(term.applyFrom, { withTime: false }).replace(/\(.\)/, '') : '', done: hasWishlist && passed(term && term.applyTo) },
      { label: '배정', sub: term ? OIA.fmtDate(term.placementAt, { withTime: false }).replace(/\(.\)/, '') : '', done: !!confirmed && !OIA.beforePlacement(p) },
      { label: '준비', done: false }
    ];
    const firstUndone = steps.findIndex(s => !s.done);
    const currentIdx = firstUndone === -1 ? steps.length - 1 : firstUndone;

    // 각 단계는 자기 구간의 한가운데에 놓인다 (3단계면 16.7% / 50% / 83.3%)
    const at = (i) => ((i + 0.5) / steps.length) * 100;

    document.getElementById('journeySteps').innerHTML = `
      <div class="journey">
        <ol class="journey__labels" style="--journey-count:${steps.length}">
          ${steps.map((s, i) => `
            <li class="journey__label ${s.done ? 'is-done' : ''} ${i === currentIdx ? 'is-current' : ''}">
              ${s.label}${s.sub ? `<small class="journey__sub">${s.sub}</small>` : ''}
            </li>`).join('')}
        </ol>
        <div class="journey__track" aria-hidden="true">
          <span class="journey__line"></span>
          <span class="journey__trail" style="width:${at(currentIdx)}%"></span>
          ${steps.map((s, i) => `
            <span class="journey__node ${s.done ? 'is-done' : ''} ${i === currentIdx ? 'is-current' : ''}"
                  style="left:${at(i)}%"></span>`).join('')}
        </div>
      </div>`;
  }
})();
