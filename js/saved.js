/**
 * 내 저장(PICKS) — 희망대학표 + 관심 학교 1:1 비교.
 *
 * 희망대학표는 국제처 온라인 지원서에 적는 그 표다(docs/oia/2027F_product_notes.md 2.3):
 * 최대 25개, 순서대로, 한 언어권만, 학교마다 지원 학과·파견 기간. 석차 순으로 이 표를
 * 위에서부터 내려가며 한 곳에 배정된다. 순서를 바꾸고 학과·기간을 적는 곳이 여기다.
 *
 * 비교 대상은 최대 세 곳이다. 1~3지망을 먼저 채우고, 자리가 남으면 즐겨찾기(하트)한
 * 학교로 채운다 — 지망을 아직 안 정한 사람도 하트만 눌러 두면 비교표가 생긴다.
 * (예전에는 아래에 D-Day 체크리스트도 있었다 — 홈의 할 일과 같은 목록이라 뺐다.)
 */
(function () {
  AppState.load();

  const wishMount = document.getElementById('savedWishlist');
  const compareMount = document.getElementById('savedCompare');
  const favsMount = document.getElementById('savedFavs');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** 비교할 학교들. { school, tag } — tag 는 '1지망' 또는 '찜'. */
  function pickSchools() {
    const wishlist = AppState.getWishlist();
    const picked = [];
    [1, 2, 3].forEach((rank) => {
      const school = wishlist[rank] && MOCK.schools.find((s) => s.id === wishlist[rank]);
      if (school) picked.push({ school, tag: `${rank}순위` });
    });
    (AppState.load().favorites || []).forEach((id) => {
      if (picked.length >= 3 || picked.some((p) => p.school.id === id)) return;
      const school = MOCK.schools.find((s) => s.id === id);
      if (school) picked.push({ school, tag: '찜' });
    });
    return picked;
  }

  /** 271곳 중 한 달 생활비가 비싼 순으로 몇 % 안에 드는지(상위 1% = 가장 비쌈). 학교 찾기와 같은 기준. */
  function costPercentile(school) {
    const v = school.monthlyLivingCostKrw;
    if (v == null || isNaN(v)) return null;
    const all = MOCK.schools.map((x) => x.monthlyLivingCostKrw).filter((x) => x != null && !isNaN(x));
    return Math.max(1, Math.round((all.filter((x) => x > v).length + 1) / all.length * 100));
  }

  /** 그 줄에서 가장 유리한 칸의 인덱스들. 견줄 값이 둘 이상이고 서로 다를 때만 표시한다. */
  function bestIndexes(values, better) {
    const nums = values.filter((v) => v != null);
    if (nums.length < 2) return [];
    const best = better === 'max' ? Math.max(...nums) : Math.min(...nums);
    if (nums.every((v) => v === best)) return [];
    return values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  }

  function renderCompare() {
    const picked = pickSchools();
    if (!picked.length) {
      compareMount.innerHTML = `
        <div class="saved__head"><h2>관심 학교 1:1 비교</h2></div>
        <div class="saved-empty">
          <p class="saved-empty__title">아직 찜한 학교가 없어요</p>
          <p class="saved-empty__sub">학교 찾기에서 하트를 누르거나 지망 순위를 정하면 여기서 나란히 견줄 수 있어요</p>
          <a class="btn btn--accent saved-empty__btn" href="search.html">학교 찾기</a>
        </div>`;
      return;
    }

    const major = AppState.profile && AppState.profile.major;
    const creditMap = buildMajorCreditMap(major);
    const schools = picked.map((p) => p.school);

    // 한 줄 = 견주는 항목 하나. raw 는 비교용 숫자(없으면 null), text 는 화면에 찍는 글자.
    const rows = [
      { label: '슬롯', better: 'max', raw: (s) => (typeof s.slot === 'number' ? s.slot : null), text: (s) => (typeof s.slot === 'number' ? `${s.slot}명` : '-') },
      { label: '한 달 생활비', better: 'min', raw: (s) => s.monthlyLivingCostKrw ?? null, text: (s) => (s.monthlyLivingCostKrw != null ? `${Math.round(s.monthlyLivingCostKrw / 10000)}만` : '-'),
        sub: (s) => { const p = costPercentile(s); return p ? { text: `상위 ${p}%`, hot: p <= 30 } : null; } }
    ];
    // 전공을 입력한 사람에게만 인정 과목 줄을 둔다 — 셀 기준이 없으면 전부 '-' 다.
    if (major) rows.push({ label: '인정 과목', better: 'max', raw: (s) => creditMap.get(s.id) ?? null, text: (s) => (creditMap.get(s.id) ? `${creditMap.get(s.id)}개` : '-') });
    rows.push(
      { label: 'GPA 컷', better: 'min', raw: (s) => (typeof s.gpaCut === 'number' ? s.gpaCut : null), text: (s) => formatGpa(s.gpaCut) || s.gpaCut || '-' },
      // 어학 컷은 시험 종류가 같을 때만 숫자로 견줄 수 있다(TOEFL 85 와 IELTS 6.5 는 비교가 안 된다)
      // 시험 이름을 숫자 아래 작은 줄로 내린다 — 'TOEFL 79' 한 줄이면 강조 칸의 좌우 여백이 6px까지 줄었다(app_ui.md 1장)
      { label: '어학 컷', better: 'min', sameType: true, raw: (s) => (typeof s.langTest.cut === 'number' ? s.langTest.cut : null), text: (s) => (s.langTest.cut != null ? `${s.langTest.cut}` : '-'),
        sub: (s) => (s.langTest.cut != null ? { text: s.langTest.type } : null) }
    );

    const cols = `style="grid-template-columns: 76px repeat(${schools.length}, minmax(0, 1fr))"`;
    const body = rows.map((row) => {
      const comparable = !row.sameType || new Set(schools.map((s) => s.langTest.type)).size === 1;
      const best = comparable ? bestIndexes(schools.map(row.raw), row.better) : [];
      return `
        <div class="compare__row" ${cols}>
          <span class="compare__label">${row.label}</span>
          ${schools.map((s, i) => {
            const sub = row.sub && row.sub(s);
            return `<span class="compare__cell${best.includes(i) ? ' is-best' : ''}"><span class="compare__value">
              <span class="compare__main">${esc(row.text(s))}</span>${sub ? `<span class="compare__sub${sub.hot ? ' is-hot' : ''}">${esc(sub.text)}</span>` : ''}
            </span></span>`;
          }).join('')}
        </div>`;
    }).join('');

    compareMount.innerHTML = `
      <div class="compare card">
        <div class="compare__row compare__row--head" ${cols}>
          <span></span>
          ${picked.map((p, i) => {
            const logo = typeof SCHOOL_LOGOS !== 'undefined' && SCHOOL_LOGOS[p.school.id];
            return `
            <button type="button" class="compare__school" data-open-school="${p.school.id}" aria-label="${esc(p.tag)} ${esc(p.school.name)}">
              <span class="compare__logo">${logo
                ? `<img src="assets/school-logos/${logo}" alt="" data-abbr="${esc(schoolInitials(p.school.name))}">`
                : `<span class="logo-fallback">${esc(schoolInitials(p.school.name))}</span>`}
</span>
              <span class="compare__tag">${p.tag}</span>
            </button>`;
          }).join('')}
        </div>
        ${body}
      </div>
      ${schools.length < 2 ? '<p class="saved__note">한 곳 더 찜하면 나란히 견줄 수 있어요 · <a href="search.html">학교 찾기</a></p>' : ''}`;

    fitLogosIn(compareMount, '.compare__logo img', { maxW: 100, maxH: 100, area: 70 * 70, unit: '%' });
    compareMount.querySelectorAll('[data-open-school]').forEach((el) => {
      el.addEventListener('click', () => openSchoolModal(el.dataset.openSchool, { onChange: renderAll }));
    });
  }

  /**
   * 찜한 학교 목록 — 지금 1~3지망인 학교는 위 비교표에 있으므로 여기서는 뺀다.
   * 줄을 누르면 학교 상세가 열린다. 지망을 바꾸는 건 학교 상세에서 한다 — 바꾸면 그 학교는
   * 이 목록에서 빠져 비교표로 올라가고, 자리를 내준 학교는 이 목록으로 내려온다.
   */
  // 찜은 안 하고 지망에만 있던 학교가 자리를 내주면 어디에도 안 보이게 된다 —
  // 이 화면에 있는 동안 한 번 보인 학교는 목록에 남긴다
  const seen = new Set();
  function renderFavorites() {
    if (!favsMount) return;
    if (!AppState.isAuthed) { favsMount.innerHTML = ''; return; }
    const wish = AppState.getWishlist();
    // 희망대학표에 있는 학교는 위 목록에 있으므로 여기서는 뺀다
    const ranked = new Set(Object.values(wish).filter(Boolean));
    ranked.forEach((id) => seen.add(id));
    const ids = [];
    (AppState.load().favorites || []).forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    seen.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    const schools = ids.filter((id) => !ranked.has(id))
      .map((id) => MOCK.schools.find((sc) => sc.id === id)).filter(Boolean);

    if (!schools.length) {
      favsMount.innerHTML = `
        <div class="saved__head"><h2>찜한 학교</h2></div>
        <div class="saved-empty">
          <p class="saved-empty__title">희망대학표 말고 찜한 학교가 없어요</p>
          <a class="btn btn--accent saved-empty__btn" href="search.html">학교 찾기</a>
        </div>`;
      return;
    }

    favsMount.innerHTML = `
      <div class="saved__head"><h2>찜한 학교</h2><span class="saved__meta">${schools.length}곳</span></div>
      <ul class="fav-list card">
        ${schools.map((sc) => {
          const logo = typeof SCHOOL_LOGOS !== 'undefined' && SCHOOL_LOGOS[sc.id];
          return `
          <li class="fav-row">
            <button type="button" class="fav-row__school" data-open-school="${sc.id}">
              <span class="fav-row__logo">${logo
                ? `<img src="assets/school-logos/${logo}" alt="" data-abbr="${esc(schoolInitials(sc.name))}">`
                : `<span class="logo-fallback">${esc(schoolInitials(sc.name))}</span>`}</span>
              <span class="fav-row__text">
                <span class="fav-row__name">${esc(sc.name)}</span>
                <span class="fav-row__meta">${countryFlag(sc.countryEn)} ${esc(sc.country)}</span>
              </span>
            </button>
          </li>`;
        }).join('')}
      </ul>`;

    fitLogosIn(favsMount, '.fav-row__logo img', { maxW: 100, maxH: 100, area: 70 * 70, unit: '%' });
    favsMount.querySelectorAll('[data-open-school]').forEach((el) => {
      el.addEventListener('click', () => openSchoolModal(el.dataset.openSchool, { onChange: renderAll }));
    });
  }

  /* ---------------------------------------------------------- 희망대학표 */

  let editing = null;   // 지원 학과·기간을 고치고 있는 학교 id

  /** 오른쪽 손잡이를 끌어 순서를 바꾼다 — 놓은 자리의 순위로 옮긴다 */
  function wireWishDrag(row, id) {
    const grip = row.querySelector('[data-grip]');
    if (!grip) return;
    grip.addEventListener('pointerdown', (ev) => {
      if (grip.disabled) return;
      ev.preventDefault();
      const rows = [...row.parentElement.querySelectorAll(':scope > .wish-row')];
      const from = rows.indexOf(row);
      const rects = rows.map((r) => r.getBoundingClientRect());
      const startY = ev.clientY;
      let to = from;
      try { grip.setPointerCapture(ev.pointerId); } catch (e) { /* 캡처가 안 되면 window로 받는다 */ }
      row.classList.add('is-dragging');
      const move = (e) => {
        const dy = e.clientY - startY;
        row.style.transform = `translateY(${dy}px)`;
        const mid = rects[from].top + rects[from].height / 2 + dy;
        // 끌고 있는 줄의 가운데보다 위에 있는 다른 줄의 수 = 새 자리
        to = rects.filter((r, k) => k !== from && r.top + r.height / 2 < mid).length;
        rows.forEach((r, k) => {
          if (r === row) return;
          let shift = 0;
          if (from < to && k > from && k <= to) shift = -rects[from].height;
          if (from > to && k >= to && k < from) shift = rects[from].height;
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const end = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        rows.forEach((r) => { r.style.transform = ''; });
        row.classList.remove('is-dragging');
        if (to !== from) { AppState.setWishlistRank(to + 1, id); renderAll(); }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
  }

  function renderWishlist() {
    if (!wishMount) return;
    if (!AppState.isAuthed) { wishMount.innerHTML = ''; return; }
    const p = AppState.profile;
    const track = (p.exchangeTerm || {}).track;
    const defaultLength = (p.exchangeTerm || {}).length === 2 ? 2 : 1;
    const list = AppState.getWishlistList()
      .map((e) => Object.assign(e, { school: MOCK.schools.find((sc) => sc.id === e.schoolId) }))
      .filter((e) => e.school);
    const { data: termData } = OIA.termOf(p);

    // 전형을 안 정했으면 섞여 들어갈 수 있다 — 한 언어권만 적을 수 있다는 걸 여기서 알린다
    const langSets = list.map((e) => e.school.languages || []).filter((l) => l.length);
    const shared = langSets.length ? OIA.TRACKS.map((t) => t.key).filter((k) => langSets.every((l) => l.includes(k))) : [];
    const mixed = !track && langSets.length > 1 && !shared.length;

    const head = `
      <div class="saved__head">
        <h2>희망대학표</h2>
        <span class="saved__meta">${list.length}/${OIA.WISHLIST_MAX}${track ? ` · ${OIA.trackLabel(track)}` : ''}</span>
      </div>
      ${list.length < OIA.WISHLIST_MAX ? `<div class="wish-add">
        <span class="wish-add__label">학교 추가</span>
        <div class="wish-add__mount" id="wishAddMount"></div>
      </div>` : ''}
      <p class="wish-note">${termData
        ? `${OIA.fmtDate(termData.applyFrom)} ~ ${OIA.fmtDate(termData.applyTo)} 온라인 지원서에 이 순서대로 적어요.<br>마감 뒤에는 바꿀 수 없어요.`
        : '국제처 온라인 지원서에 이 순서대로 적어요.<br>석차 순으로 위에서부터 한 곳에 배정돼요.'}</p>
      ${!track ? `<p class="wish-warn">지원 전형(영어권/비영어권 언어)을 아직 안 정했어요 · <a href="onboarding.html">정하기</a></p>` : ''}
      ${mixed ? '<p class="wish-warn">언어권이 서로 다른 학교가 섞여 있어요.<br>한 전형의 학교만 적을 수 있어요.</p>' : ''}`;

    if (!list.length) {
      wishMount.innerHTML = head + `
        <div class="saved-empty">
          <p class="saved-empty__title">아직 담은 학교가 없어요</p>
          <p class="saved-empty__sub">위에서 학교를 바로 추가하거나, 학교 상세에서 '희망대학표 담기'를 눌러도 돼요</p>
          <a class="btn btn--accent saved-empty__btn" href="search.html">학교 찾기</a>
        </div>`;
      wireWishAdd(track, list);
      return;
    }

    wishMount.innerHTML = head + `
      <ol class="wish-list card">
        ${list.map((e, i) => {
          const elig = computeEligibility(p, e.school);
          const len = e.length || defaultLength;
          const offTrack = track && !OIA.schoolOffersTrack(e.school, track);
          return `
          <li class="wish-row${offTrack ? ' is-off' : ''}" data-id="${esc(e.schoolId)}">
            <label class="wish-row__rank tnum" aria-label="${e.rank}지망 · 눌러서 순위 바꾸기">
              <select data-rank aria-label="${esc(e.school.name)} 순위">${list.map((_, k) => `<option value="${k + 1}"${k === i ? ' selected' : ''}>${k + 1}</option>`).join('')}</select>
              <span aria-hidden="true">${e.rank}</span>
            </label>
            <button type="button" class="wish-row__main" data-open-school="${esc(e.schoolId)}">
              <span class="wish-row__name">${esc(e.school.name)}</span>
              <span class="wish-row__meta">${countryFlag(e.school.countryEn)} ${esc(e.school.country)} · ${esc(e.major || '지원 학과 미정')} · ${len === 2 ? '1년' : '한 학기'}
                <span class="wish-row__elig is-${elig.status}">${elig.label}</span></span>
            </button>
            <span class="wish-row__ctrl">
              <button type="button" data-edit aria-label="지원 학과·기간 고치기">✎</button>
              <button type="button" class="wish-row__grip" data-grip aria-label="끌어서 순서 바꾸기" ${list.length < 2 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
              </button>
            </span>
            ${editing === e.schoolId ? `
            <form class="wish-edit" data-edit-form>
              <input type="text" name="major" maxlength="60" value="${esc(e.major)}" placeholder="듣고 싶은 전공을 영어로 (예: Economics)" aria-label="지원 학과">
              <div class="wish-edit__pick" data-major-pick></div>
              <div class="wish-edit__len" role="group" aria-label="파견 기간">
                ${[[1, '한 학기'], [2, '1년']].map(([v, l]) => `<button type="button" class="chip${len === v ? ' is-selected' : ''}" data-len="${v}">${l}</button>`).join('')}
              </div>
              <div class="wish-edit__actions">
                <button type="button" class="btn--text wish-edit__remove" data-remove>희망대학표에서 빼기</button>
                <button type="submit" class="btn btn--primary btn--sm">저장</button>
              </div>
            </form>` : ''}
          </li>`;
        }).join('')}
      </ol>
      <p class="saved__note">지원 학과는 '배정가능 대학 명단'의 지원 가능 학과에서 골라요.<br>지원 불가 학과를 쓰면 배정되지 않아요. ISEP·GE3는 한 곳으로 쳐요.
        ${/경영|경제|상경|응용통계|공학|공대/.test(p.major || '') ? '<br>경영·상경·공학 계열은 기초 선수과목을 듣고 가면 파견교 수업 선택이 넓어져요.' : ''}
        · <a href="${OIA.LINKS.univFinder}" target="_blank" rel="noopener">UnivFinder에서 학교별 조건 보기 ↗</a></p>`;

    wishMount.querySelectorAll('[data-open-school]').forEach((el) => {
      el.addEventListener('click', () => openSchoolModal(el.dataset.openSchool, { onChange: renderAll }));
    });
    wishMount.querySelectorAll('.wish-row').forEach((row) => {
      const id = row.dataset.id;
      // 순위 숫자를 누르면 1~N 중에서 바로 고른다(25지망까지 한 번에)
      row.querySelector('[data-rank]').addEventListener('change', (ev) => {
        AppState.setWishlistRank(Number(ev.target.value), id);
        showToast(`${ev.target.value}지망으로 옮겼어요`);
        renderAll();
      });
      wireWishDrag(row, id);
      row.querySelector('[data-edit]').addEventListener('click', () => { editing = editing === id ? null : id; renderWishlist(); });
      const form = row.querySelector('[data-edit-form]');
      if (!form) return;
      let len = Number((form.querySelector('.chip.is-selected') || {}).dataset?.len || defaultLength);
      form.querySelectorAll('[data-len]').forEach((c) => c.addEventListener('click', () => {
        len = Number(c.dataset.len);
        form.querySelectorAll('[data-len]').forEach((x) => x.classList.toggle('is-selected', x === c));
      }));
      form.querySelector('[data-remove]').addEventListener('click', () => {
        AppState.removeFromWishlist(id);
        editing = null;
        showToast('희망대학표에서 뺐어요');
        renderAll();
      });
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        AppState.setWishlistMeta(id, { major: form.elements.major.value.trim(), length: len });
        editing = null;
        showToast('저장했어요');
        renderWishlist();
      });
      // 이 학교 과목 자료에 있는 학과 목록에서 고르면 입력칸에 채운다(목록에 없으면 직접 적는다)
      const pickMount = form.querySelector('[data-major-pick]');
      if (pickMount && typeof mountMajorPicker === 'function') {
        mountMajorPicker(pickMount, id, { selected: form.elements.major.value, onPick: (v) => { if (v) form.elements.major.value = v; } });
      }
      form.elements.major.focus();
    });
    wireWishAdd(track, list);
  }

  /** 희망대학표에서 바로 학교 추가 — 고르면 담고, 그 학교의 지원 학과 입력칸을 바로 연다 */
  function wireWishAdd(track, list) {
    const mount = document.getElementById('wishAddMount');
    if (!mount || typeof createSearchableSelect !== 'function') return;
    const taken = new Set(list.map((e) => e.schoolId));
    const items = MOCK.schools
      .filter((sc) => !taken.has(sc.id) && (!track || OIA.schoolOffersTrack(sc, track)))
      .map((sc) => ({ value: sc.id, label: `${sc.name} · ${sc.country}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const select = createSearchableSelect({
      items, selected: '', multiple: false, placeholder: '학교 이름으로 검색',
      onChange: (id) => {
        if (!id) return;
        const res = AppState.addToWishlist(id);
        if (!res.ok) {
          showToast(res.reason === 'full' ? `희망대학표는 ${OIA.WISHLIST_MAX}개까지 쓸 수 있어요`
            : res.reason === 'track' ? `${OIA.trackLabel(track)} 전형이라 이 학교는 담을 수 없어요` : '이미 담은 학교예요');
          return;
        }
        showToast(`${res.rank}순위로 담았어요. 지원 학과를 적어 주세요`);
        editing = id;
        renderAll();
      }
    });
    mount.innerHTML = '';
    mount.appendChild(select.el);
  }

  function renderAll() { renderWishlist(); renderCompare(); renderFavorites(); }

  renderAll();
  // 로그인 직후에는 게스트 기본값으로 먼저 그려진다. 서버 데이터가 오면 다시 그린다.
  ['MOCK:updated', 'profile:updated'].forEach((ev) => document.addEventListener(ev, renderAll));
})();
