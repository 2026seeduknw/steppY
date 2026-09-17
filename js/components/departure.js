/**
 * 출국일 기준의 D-day 계산.
 *
 * 같은 값을 홈(교환 준비하기)의 카운트다운 카드와 기록 탭의 MY JOURNEY가
 * 함께 쓴다. 두 곳에서 따로 계산하면 한쪽만 고쳐져 숫자가 어긋나기 쉬워서
 * 한 군데로 모았다.
 *
 * 기간을 세 국면으로 나눈다:
 *   before — 출국 전. D-30. 떠나기 전 기억(배웅, 짐 싸기)을 남기도록 유도한다.
 *   abroad — 파견 중. Day 12. 진행 바로 얼마나 지났는지 보여준다.
 *   after  — 귀국 후. 기록은 계속 볼 수 있지만 카운트는 멈춘다.
 */
const DEPARTURE_PHASES = { BEFORE: 'before', ABROAD: 'abroad', AFTER: 'after' };

function departureInfo() {
  const range = AppState.getProgramRange();
  if (!range || !range.start || !range.end) return { hasRange: false };

  const DAY = 86400000;
  // 시각을 빼고 날짜끼리만 뺀다. new Date('2026-09-14')는 UTC 자정이라
  // 한국에서 실행하면 하루가 밀린다 — 그래서 'T00:00:00'을 붙여 로컬 자정으로 읽는다.
  const at = (iso) => new Date(`${iso}T00:00:00`);
  const today = at(todayISO());
  const start = at(range.start);
  const end = at(range.end);

  const daysUntil = Math.round((start - today) / DAY);
  const totalDays = Math.max(1, Math.round((end - start) / DAY));
  const elapsed = Math.round((today - start) / DAY);

  if (daysUntil > 0) {
    return { hasRange: true, phase: DEPARTURE_PHASES.BEFORE, daysUntil, totalDays, start: range.start, end: range.end };
  }
  if (elapsed > totalDays) {
    return { hasRange: true, phase: DEPARTURE_PHASES.AFTER, dayNum: totalDays + 1, totalDays, pct: 100, start: range.start, end: range.end };
  }
  return {
    hasRange: true,
    phase: DEPARTURE_PHASES.ABROAD,
    dayNum: elapsed + 1,
    daysLeft: totalDays - elapsed,
    totalDays,
    pct: Math.min(100, Math.max(0, (elapsed / totalDays) * 100)),
    start: range.start,
    end: range.end
  };
}

/**
 * 출국일이 지났는가.
 *
 * 비자 서류와 학점 인정은 출국 전에만 쓰는 화면이다. 비자는 나오면 끝이고,
 * 학점 인정은 수강신청까지 끝난 뒤라 더 고를 것이 없다. 떠난 뒤에도 남겨두면
 * 이미 끝낸 일이 계속 할 일처럼 보인다.
 *
 * 출국일을 아직 안 골랐으면 false다 — 날짜를 모르는 채로 화면을 지우면
 * 사용자 입장에서는 기능이 이유 없이 사라진 것이 된다.
 */
function hasDeparted() {
  const info = departureInfo();
  return info.hasRange && info.phase !== DEPARTURE_PHASES.BEFORE;
}

/** 오늘 남기는 기록이 '출국 전'인지 '파견 중'인지. 사용자가 매번 고르지 않아도 되게 한다. */
function departurePhaseFor(iso) {
  const range = AppState.getProgramRange();
  if (!range) return 'prepare';
  return iso >= range.start ? 'abroad' : 'prepare';
}

/** 학기만 알 때 쓰는 기본값. 정확하진 않지만 빈 칸보다는 고치기 쉽다. */
function guessProgramRange() {
  const term = (AppState.profile && AppState.profile.exchangeTerm) || {};
  const year = term.year || new Date().getFullYear();
  return String(term.season || '').includes('가을')
    ? { start: `${year}-09-01`, end: `${year}-12-20` }
    : { start: `${year}-03-02`, end: `${year}-06-20` };
}

/**
 * 홈(교환 준비하기)에 놓는 카운트다운 카드.
 * 날짜가 없으면 입력받고, 있으면 D-NN 또는 Day N을 보여주며 기록 탭으로 보낸다.
 */
function renderDepartureCard(mount) {
  if (!mount) return;
  const info = departureInfo();

  if (!info.hasRange) {
    const g = guessProgramRange();
    mount.innerHTML = `
      <section class="departure-card departure-card--setup">
        <span class="departure-card__eyebrow">출국까지</span>
        <h2 class="departure-card__title">출국일을 입력하면 남은 날을 세어드려요</h2>
        <p class="departure-card__desc">떠나기 전 기록도, 교환 중 기록도 이 날짜를 기준으로 정리돼요</p>
        <div class="departure-card__row">
          <label>출국<input type="date" id="depStart" value="${g.start}"></label>
          <label>귀국<input type="date" id="depEnd" value="${g.end}"></label>
        </div>
        <button type="button" class="btn btn--primary btn--block" id="depSave">저장</button>
      </section>`;
    mount.querySelector('#depSave').addEventListener('click', () => {
      const start = mount.querySelector('#depStart').value;
      const end = mount.querySelector('#depEnd').value;
      if (!start || !end || start > end) { showToast('출국일이 귀국일보다 늦을 수 없어요'); return; }
      AppState.setProgramRange(start, end);
      renderDepartureCard(mount);
    });
    return;
  }

  const school = AppState.getConfirmedSchool();
  const city = school ? (school.city || school.country || '파견교') : '파견교';
  const fmt = (iso) => { const [, m, d] = iso.split('-'); return `${Number(m)}월 ${Number(d)}일`; };

  /**
   * 비행 경로 카드. 출발지·도착지를 양 끝에 두고 그 사이를 비행기가 지나간다.
   *
   *   출국 전 — 서울 → 파견 도시. 준비 기간을 한 구간으로 본다.
   *   파견 중 — 파견 도시 → 서울. 이제 돌아올 일이 남았다.
   *
   * 출국 전 진행률의 기준점이 문제였다. "준비를 언제 시작했는지"가 있어야 하는데,
   * 온보딩을 마친 시각(onboardedAt)이 그 사람이 실제로 준비를 시작한 날이라
   * 그걸 출발점으로 쓴다. 없거나 출국일보다 뒤면 6개월 전으로 잡는다 —
   * 교환 준비는 대개 그쯤 시작한다.
   */
  function legCard({ fromLabel, fromSub, toLabel, toSub, pct, pill, pillNote, tone }) {
    return `
      <a class="leg-card leg-card--${tone}" href="journal.html">
        <div class="leg-card__ends">
          <div class="leg-card__end">
            <span class="leg-card__place">${fromLabel}</span>
            <span class="leg-card__date">${fromSub}</span>
          </div>
          <div class="leg-card__end leg-card__end--to">
            <span class="leg-card__place">${toLabel}</span>
            <span class="leg-card__date">${toSub}</span>
          </div>
        </div>

        <div class="leg-card__track" aria-hidden="true">
          <span class="leg-card__line"></span>
          <span class="leg-card__line leg-card__line--done" style="width:${pct}%"></span>
          <span class="leg-card__plane" style="left:${pct}%">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/></svg>
          </span>
        </div>

        <div class="leg-card__foot">
          <span class="leg-card__pill">${pill}</span>
          <span class="leg-card__note">${pillNote}</span>
        </div>
      </a>`;
  }

  if (info.phase === DEPARTURE_PHASES.BEFORE) {
    // 준비 구간의 출발점 — 온보딩한 날, 없으면 출국 6개월 전
    const onboarded = AppState.load().onboardedAt;
    const DAY = 86400000;
    const startMs = (() => {
      const s = onboarded ? Date.parse(onboarded) : NaN;
      const dep = new Date(`${info.start}T00:00:00`).getTime();
      return (!Number.isNaN(s) && s < dep) ? s : dep - 180 * DAY;
    })();
    const depMs = new Date(`${info.start}T00:00:00`).getTime();
    const nowMs = new Date(`${todayISO()}T00:00:00`).getTime();
    const pct = Math.min(96, Math.max(3, ((nowMs - startMs) / (depMs - startMs)) * 100));

    mount.innerHTML = legCard({
      fromLabel: '서울', fromSub: '준비 중',
      toLabel: city, toSub: fmt(info.start),
      pct: Math.round(pct),
      pill: `D-${info.daysUntil}`,
      pillNote: '출국까지',
      tone: 'before'
    }) + `<button type="button" class="departure-card__edit" id="depEdit">출국일 수정</button>`;

  } else if (info.phase === DEPARTURE_PHASES.ABROAD) {
    mount.innerHTML = legCard({
      fromLabel: city, fromSub: fmt(info.start),
      toLabel: '서울', toSub: fmt(info.end),
      pct: Math.round(Math.min(97, Math.max(3, info.pct))),
      pill: `D+${info.dayNum - 1}`,
      pillNote: `귀국까지 ${info.daysLeft}일`,
      tone: 'abroad'
    }) + `<button type="button" class="departure-card__edit" id="depEdit">파견 기간 수정</button>`;

  } else {
    mount.innerHTML = legCard({
      fromLabel: city, fromSub: fmt(info.start),
      toLabel: '서울', toSub: fmt(info.end),
      pct: 100,
      pill: `${info.totalDays}일`,
      pillNote: '교환 종료 · 기록 돌아보기',
      tone: 'after'
    }) + `<button type="button" class="departure-card__edit" id="depEdit">파견 기간 수정</button>`;
  }

  const edit = mount.querySelector('#depEdit');
  if (edit) edit.addEventListener('click', () => {
    AppState.setProgramRange(null, null);
    renderDepartureCard(mount);
  });
}
