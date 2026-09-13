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

  if (info.phase === DEPARTURE_PHASES.BEFORE) {
    mount.innerHTML = `
      <a class="departure-card departure-card--before" href="journal.html">
        <div class="departure-card__head">
          <span class="departure-card__eyebrow">출국까지</span>
          <span class="departure-card__dday">D-${info.daysUntil}</span>
        </div>
        <p class="departure-card__desc">
          배웅 나온 친구들, 짐 싸던 밤 — 떠나기 전 오늘도 나중에 꺼내 볼 기억이 돼요.
          기록 탭에 남겨두면 교환 가서 생각날 때 볼 수 있어요.
        </p>
        <span class="departure-card__cta">출국 전 기록 남기기 →</span>
      </a>
      <button type="button" class="departure-card__edit" id="depEdit">출국일 수정</button>`;
  } else if (info.phase === DEPARTURE_PHASES.ABROAD) {
    mount.innerHTML = `
      <a class="departure-card departure-card--abroad" href="journal.html">
        <div class="departure-card__head">
          <span class="departure-card__eyebrow">파견 ${info.dayNum}일째</span>
          <span class="departure-card__dday">D+${info.dayNum - 1}</span>
        </div>
        <div class="departure-card__bar"><div style="width:${info.pct}%"></div></div>
        <p class="departure-card__desc">귀국까지 ${info.daysLeft}일 남았어요. 오늘의 순간을 기록해두세요.</p>
        <span class="departure-card__cta">오늘 기록하기 →</span>
      </a>
      <button type="button" class="departure-card__edit" id="depEdit">파견 기간 수정</button>`;
  } else {
    mount.innerHTML = `
      <a class="departure-card departure-card--after" href="journal.html">
        <div class="departure-card__head">
          <span class="departure-card__eyebrow">교환 종료</span>
          <span class="departure-card__dday">${info.totalDays}일</span>
        </div>
        <p class="departure-card__desc">${info.start} ~ ${info.end} 동안의 기록이 모두 남아 있어요.</p>
        <span class="departure-card__cta">기록 돌아보기 →</span>
      </a>
      <button type="button" class="departure-card__edit" id="depEdit">파견 기간 수정</button>`;
  }

  const edit = mount.querySelector('#depEdit');
  if (edit) edit.addEventListener('click', () => {
    AppState.setProgramRange(null, null);
    renderDepartureCard(mount);
  });
}
