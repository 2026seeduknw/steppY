/**
 * 국제처 일정 카드 — 책자의 공식 일정을 시기별로 묶어 보여주고, 할 일은 체크할 수 있게 한다.
 *
 * 같은 카드를 시기에 따라 다른 화면에 둔다(phases 로 고른다):
 *   교환 준비하기 — 배정 발표 전이면 '지원' + '배정 후', 발표 뒤에는 '배정 후'
 *   학점 인정(출국 후) — '파견 중' + '귀국 후'. 귀국 뒤에는 '귀국 후'만.
 * 날짜·문구는 js/oia-rules.js TERMS 에서 온다. 체크는 이 기기에만 남긴다(계정별 키).
 */
const OIA_PHASE_LABEL = { apply: '지원', placed: '배정 후 · 출국 전', abroad: '파견 중', return: '귀국 후' };

function oiaDoneKey() {
  const uid = (typeof Auth !== 'undefined' && Auth.userId) ? Auth.userId : 'guest';
  return `steppy_oia_done_${uid}`;
}
function oiaReadDone() {
  try { return new Set(JSON.parse(localStorage.getItem(oiaDoneKey())) || []); } catch (e) { return new Set(); }
}
function oiaWriteDone(set) {
  try { localStorage.setItem(oiaDoneKey(), JSON.stringify([...set])); } catch (e) { /* 사파리 프라이빗 모드 등 */ }
}

/**
 * 마감 표시 — 'D-12 · 1월 7일(목) 10:00 ~ 1월 8일(금) 17:00'.
 * 기간이면 시작일까지 세고, 기간 안이면 '진행 중', 끝났으면 '지남'.
 * 'O월 중'으로만 알려진 일은 날짜를 지어내지 않고 달만 적는다.
 */
function oiaDueText(ev) {
  if (!ev.due) return ev.rel ? '출국일을 정하면 날짜가 나와요' : '';
  if (ev.approx === 'month') {
    const d = OIA.kst(ev.due);
    const past = OIA.daysUntil(ev.due) < -31;
    return `${past ? '<b class="oia-tl__dday is-past">지남</b> ' : ''}${d.getMonth() + 1}월 중`;
  }
  const toStart = OIA.daysUntil(ev.due);
  const toEnd = OIA.daysUntil(ev.dueTo || ev.due);
  const when = ev.dueTo ? `${OIA.fmtDate(ev.due)} ~ ${OIA.fmtDate(ev.dueTo)}` : OIA.fmtDate(ev.due);
  let dday;
  let cls = '';
  if (toEnd < 0) { dday = '지남'; cls = ' is-past'; }
  else if (toStart <= 0 && ev.dueTo) { dday = '진행 중'; cls = ' is-soon'; }
  else if (toStart === 0) { dday = '오늘'; cls = ' is-soon'; }
  else { dday = `D-${toStart}`; if (toStart <= 7) cls = ' is-soon'; }
  return `<b class="oia-tl__dday${cls}">${dday}</b> ${when}`;
}

/**
 * @param mount   카드를 그릴 자리
 * @param phases  보여줄 시기 ['apply', 'placed', …]
 * @param title   카드 제목
 */
function renderOiaTimeline(mount, { phases, title = '국제처 일정' } = {}) {
  if (!mount) return;
  const p = AppState.profile;
  const { key, data } = OIA.termOf(p);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  if (!data) {
    mount.innerHTML = `
      <div class="oia-tl">
        <div class="oia-tl__head"><h2 class="oia-tl__title">${title}</h2></div>
        <p class="oia-tl__empty">${key
          ? `${OIA.termLabel(key)} 국제처 안내가 아직 없어요.<br>책자가 나오면 공식 일정을 여기에 채워요.`
          : '교환 시기(봄·가을학기)를 정하면 국제처 공식 일정을 보여드려요.'}</p>
      </div>`;
    return;
  }

  const events = OIA.scheduleFor(p, AppState.getProgramRange()).filter(ev => phases.includes(ev.phase));
  const done = oiaReadDone();
  const tasks = events.filter(ev => !ev.info);
  const doneCount = tasks.filter(ev => done.has(`${key}:${ev.id}`)).length;

  mount.innerHTML = `
    <div class="oia-tl">
      <div class="oia-tl__head">
        <h2 class="oia-tl__title">${title}</h2>
        ${tasks.length ? `<span class="oia-tl__count tnum">${doneCount}/${tasks.length}</span>` : ''}
      </div>
      ${phases.filter(ph => events.some(ev => ev.phase === ph)).map(ph => `
        <p class="oia-tl__phase">${OIA_PHASE_LABEL[ph]}</p>
        <ul class="oia-tl__list">
          ${events.filter(ev => ev.phase === ph).map(ev => {
            const id = `${key}:${ev.id}`;
            const isDone = done.has(id);
            return `
            <li class="oia-tl__item${ev.info ? ' is-info' : ''}${isDone ? ' is-done' : ''}" data-id="${esc(id)}">
              ${ev.info
                ? '<span class="oia-tl__dot" aria-hidden="true"></span>'
                : `<button type="button" class="oia-tl__check" data-check aria-pressed="${isDone}" aria-label="${esc(ev.title)} 완료 표시">✓</button>`}
              <button type="button" class="oia-tl__row" data-expand aria-expanded="false">
                <span class="oia-tl__name">${esc(ev.title)}</span>
                ${oiaDueText(ev) ? `<span class="oia-tl__due">${oiaDueText(ev)}</span>` : ''}
              </button>
              ${ev.detail ? `<p class="oia-tl__detail">${esc(ev.detail)}</p>` : ''}
            </li>`;
          }).join('')}
        </ul>`).join('')}
      <p class="oia-tl__source">출처 · ${esc(data.source)} (국제처 홈페이지 공지가 우선이에요)</p>
    </div>`;

  mount.querySelectorAll('.oia-tl__item').forEach(li => {
    const check = li.querySelector('[data-check]');
    if (check) check.addEventListener('click', () => {
      const set = oiaReadDone();
      if (set.has(li.dataset.id)) set.delete(li.dataset.id); else set.add(li.dataset.id);
      oiaWriteDone(set);
      renderOiaTimeline(mount, { phases, title });
    });
    const row = li.querySelector('[data-expand]');
    row.addEventListener('click', () => {
      const open = li.classList.toggle('is-open');
      row.setAttribute('aria-expanded', String(open));
    });
  });
}

/** 홈에 두는 한 줄짜리 '다가오는 일정' — 가장 가까운 두 개. 할 일 목록 전체는 준비하기 화면에 있다. */
function renderUpcomingSchedule(mount) {
  if (!mount) return;
  const p = AppState.profile;
  const { key, data } = OIA.termOf(p);
  if (!AppState.isAuthed || !data) { mount.hidden = true; return; }
  const next = OIA.upcoming(p, AppState.getProgramRange(), 2);
  if (!next.length) { mount.hidden = true; return; }
  mount.hidden = false;
  mount.innerHTML = `
    <p class="upcoming__title">다가오는 국제처 일정 <span>${OIA.termLabel(key)}</span></p>
    <ul class="upcoming__list">
      ${next.map(ev => `
        <li class="upcoming__row">
          <span class="upcoming__name">${ev.title}</span>
          <span class="upcoming__due">${(() => {
            if (ev.approx === 'month') return `${OIA.kst(ev.due).getMonth() + 1}월 중`;
            // 홈은 한 줄이라 기간의 시작일만 — 끝까지 적으면 이름이 잘린다
            const d = OIA.daysUntil(ev.due);
            const dday = d <= 0 && ev.dueTo ? '진행 중' : d === 0 ? '오늘' : `D-${d}`;
            return `<b class="oia-tl__dday${d <= 7 ? ' is-soon' : ''}">${dday}</b> ${OIA.fmtDate(ev.due, { withTime: false })}`;
          })()}</span>
        </li>`).join('')}
    </ul>`;
}
