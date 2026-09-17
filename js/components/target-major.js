/**
 * 신청 전공 — 확정한 학교에서 어떤 전공으로 신청했는지.
 *
 * 홈(교환 준비하기)에서만 고른다. 학점 인정 탭은 이 값이 정해져야 결과를 보여준다.
 * 두 곳에 입력칸을 두면 한쪽에서 고친 값이 다른 쪽에 안 보이는 것처럼 느껴진다.
 *
 * 후보는 그 학교 과목 매칭의 matched_topics(현지 학과명)에서 뽑는다. 목록에 없는
 * 학과를 넣어봐야 걸리는 과목이 없어서다.
 */
function targetMajorOptions(schoolId) {
  return [...new Set(
    (MOCK.courseMatches || [])
      .filter(m => m.school === schoolId)
      .flatMap(m => m.matchedTopics || [])
  )].sort((a, b) => a.localeCompare(b));
}

function renderTargetMajorCard(mount) {
  if (!mount) return;
  const confirmed = AppState.getConfirmedSchool();
  if (!confirmed) { mount.innerHTML = ''; return; }

  const options = targetMajorOptions(confirmed.id);
  const selected = AppState.profile.targetMajor || '';

  // 이 학교의 과목 자료가 아직 없으면 고를 것도, 걸릴 것도 없다
  if (!options.length) {
    mount.innerHTML = `
      <section class="target-major target-major--empty">
        <span class="target-major__eyebrow">신청 전공</span>
        <p class="target-major__desc">${confirmed.nameKo || confirmed.name}의 과목 자료가 아직 없어서 전공을 고를 수 없어요.</p>
      </section>`;
    return;
  }

  // 학교를 바꿨는데 예전 학교의 학과가 남아 있으면 푼다
  if (selected && !options.includes(selected)) {
    AppState.updateProfile({ targetMajor: null });
    return renderTargetMajorCard(mount);
  }

  mount.innerHTML = `
    <section class="target-major${selected ? ' is-set' : ''}">
      <div class="target-major__head">
        <span class="target-major__eyebrow">신청 전공</span>
        ${selected ? `<button type="button" class="target-major__clear" id="clearTargetMajor">변경</button>` : ''}
      </div>
      ${selected
        ? `<p class="target-major__value">${selected}</p>
           <a class="target-major__cta" href="credits.html">이 전공으로 학점 인정 보기 →</a>`
        : `<p class="target-major__desc">${confirmed.nameKo || confirmed.name}에서 신청한 전공을 고르면, 학점 인정 탭에서 그 전공 과목만 볼 수 있어요.</p>
           <div id="targetMajorSelect"></div>`}
    </section>`;

  const clear = mount.querySelector('#clearTargetMajor');
  if (clear) clear.addEventListener('click', () => {
    AppState.updateProfile({ targetMajor: null });
    renderTargetMajorCard(mount);
  });

  const selectMount = mount.querySelector('#targetMajorSelect');
  if (selectMount) {
    const select = createSearchableSelect({
      items: options.map(t => ({ value: t, label: t })),
      selected: '',
      multiple: false,
      placeholder: '전공 검색',
      onChange: (value) => {
        if (!value) return;
        AppState.updateProfile({ targetMajor: value });
        trackEvent('target_major_set', { major: value, school: confirmed.id });
        renderTargetMajorCard(mount);
      }
    });
    selectMount.appendChild(select.el);
  }
}
