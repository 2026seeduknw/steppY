/**
 * 교환보고서 — 기록 탭에 쌓인 글·사진을 항목별로 모아 초안으로 보여준다.
 *
 * 파견 중에는 잠겨 있다. 학기 절반쯤에 열어주면 "지금 쓸 수 있는 것"처럼 보이는데,
 * 정작 내용은 절반뿐이라 초안 품질이 나쁘고, 다시 열어볼 이유도 사라진다.
 * 귀국일이 지나면 풀린다.
 *
 * 문장을 새로 지어내지 않는다. 적어둔 글을 항목별·날짜순으로 모아 줄 뿐이다.
 * 그래야 보고서에 들어간 문장이 전부 본인이 쓴 것이 된다.
 */
(function () {
  AppState.load();

  const mount = document.getElementById('reportRoot');
  const photoUrls = {};

  const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  const entries = () => AppState.getJournal().slice().sort((a, b) => a.date.localeCompare(b.date));

  /* ------------------------------------------------------------- 잠금 화면 */

  /** 잠금 상태에서 보여줄 흐릿한 미리보기. 실제 기록이 있으면 그걸, 없으면 뼈대만. */
  function blurredPreview() {
    const all = entries();
    return REPORT_CATEGORIES.slice(0, 4).map(c => {
      const items = all.filter(e => categoriesOfTags(e.tags).includes(c.id));
      const body = items.length
        ? items.slice(0, 2).map(e => esc((e.body || e.title || '').slice(0, 70))).join(' ')
        : '교환 기간에 남긴 기록이 이 자리에 정리돼요. 날짜와 사진도 함께 묶여요.';
      return `
        <div class="report-blur__section">
          <h3 style="--chip-color:${c.color}">${c.ko}</h3>
          <p>${body}</p>
        </div>`;
    }).join('');
  }

  function renderLocked(info) {
    const all = entries();
    const tagged = new Set(all.flatMap(e => categoriesOfTags(e.tags)));
    const daysLeft = info.phase === DEPARTURE_PHASES.ABROAD ? info.daysLeft : null;

    mount.innerHTML = `
      <section class="report-lock">
        <div class="report-lock__badge" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/>
          </svg>
        </div>
        <h2 class="report-lock__title">교환이 끝나면 열려요</h2>
        <p class="report-lock__desc">
          ${daysLeft !== null
            ? `귀국까지 <strong>${daysLeft}일</strong> 남았어요. 그때까지 남긴 기록을 모아 경험보고서 초안을 만들어드려요.`
            : '파견이 끝나면 그동안 남긴 기록을 모아 경험보고서 초안을 만들어드려요.'}
        </p>

        <div class="report-lock__progress">
          <div class="report-lock__bar"><div style="width:${Math.round(tagged.size / REPORT_CATEGORIES.length * 100)}%"></div></div>
          <span>보고서 항목 ${tagged.size} / ${REPORT_CATEGORIES.length}개 채움</span>
        </div>

        <a class="btn btn--primary btn--block" href="journal.html">기록하러 가기</a>
      </section>

      <div class="report-blur" aria-hidden="true">
        ${blurredPreview()}
      </div>
      <p class="report-blur__note">미리보기 — 실제 초안은 귀국 후에 열려요</p>
    `;
  }

  /* ------------------------------------------------------------- 해제 화면 */

  async function renderUnlocked() {
    const all = entries();
    const paths = all.flatMap(e => e.photos || []).filter(p => !photoUrls[p]);
    if (paths.length) Object.assign(photoUrls, await AppState.signPhotoPaths(paths));

    const confirmed = AppState.getConfirmedSchool();
    const range = AppState.getProgramRange();
    const days = new Set(all.map(e => e.date)).size;

    mount.innerHTML = `
      <section class="report-head">
        <h2>${confirmed ? esc(confirmed.name) : '교환'} 경험보고서 초안</h2>
        <p class="report-head__meta">
          ${range ? `${range.start} ~ ${range.end} · ` : ''}기록한 날 ${days}일 · 항목 ${new Set(all.flatMap(e => categoriesOfTags(e.tags))).size}/${REPORT_CATEGORIES.length}
        </p>
        <p class="report-head__note">적어둔 글을 항목별·날짜순으로 모았어요. 문장을 새로 지어내지 않으니 그대로 옮기거나 고쳐 쓰면 돼요.</p>
        <button type="button" class="btn btn--ghost btn--sm" id="copyReport">전체 복사</button>
      </section>

      ${REPORT_CATEGORIES.map(c => {
        const items = all.filter(e => categoriesOfTags(e.tags).includes(c.id));
        return `
        <section class="report-section">
          <h3 style="--chip-color:${c.color}">${c.ko}</h3>
          ${items.length ? items.map(e => {
            const u = (e.photos || []).map(p => photoUrls[p]).find(Boolean);
            return `
            <article class="report-entry">
              ${u ? `<img src="${u}" alt="${esc(e.title || e.date)}">` : ''}
              <div>
                <div class="report-entry__date">${e.date}</div>
                ${e.title ? `<p class="report-entry__title">${esc(e.title)}</p>` : ''}
                <p class="report-entry__body">${esc(e.body || '(사진만 기록)')}</p>
              </div>
            </article>`;
          }).join('') : `<p class="report-empty">이 항목으로 남긴 기록이 없어요</p>`}
        </section>`;
      }).join('')}
    `;

    document.getElementById('copyReport').addEventListener('click', () => {
      const text = REPORT_CATEGORIES.map(c => {
        const items = all.filter(e => categoriesOfTags(e.tags).includes(c.id));
        if (!items.length) return `## ${c.ko}\n(기록 없음)\n`;
        return `## ${c.ko}\n` + items.map(e => `- ${e.date} ${e.title ? e.title + ' — ' : ''}${e.body || '(사진만 기록)'}`).join('\n') + '\n';
      }).join('\n');
      navigator.clipboard.writeText(text)
        .then(() => showToast('보고서 초안을 복사했어요'))
        .catch(() => showToast('복사하지 못했어요'));
    });
  }

  /* --------------------------------------------------------------- 라우팅 */

  function render() {
    if (!AppState.isAuthed) {
      mount.innerHTML = `
        <section class="card card-pad">
          <div class="guest-cta">
            <p class="guest-cta__text">로그인하면 교환 기간에 남긴 기록으로 <strong>경험보고서 초안</strong>을 만들어드려요</p>
            <a class="btn btn--primary btn--block" href="auth.html">로그인하기</a>
          </div>
        </section>`;
      return;
    }
    const info = departureInfo();
    if (info.hasRange && info.phase === DEPARTURE_PHASES.AFTER) renderUnlocked();
    else renderLocked(info);
  }

  render();
  document.addEventListener('MOCK:updated', render);
})();
