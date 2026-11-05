/**
 * 학교별 지원 가능 판정.
 *
 * 국제처 배정은 "컷을 넘으면 합격"이 아니라 총점 석차 순으로 희망대학표를 내려가며 정해진다.
 * 그래서 이 배지는 '지원할 자격이 되는지'까지만 말한다 — 붙는다는 뜻이 아니다.
 *
 * 판정 순서(docs/oia/2027F_product_notes.md 2.1):
 *   1. 내 전형(언어권)으로 지원할 수 있는 학교인가
 *   2. 연세대 공통 자격 — 학점 2.8, 이수 학기, 계열별 TOEFL 최소, 어학 유효기간 (js/oia-rules.js)
 *   3. 학교 기준 — GPA 컷, TOEFL 컷 또는 현지어 등급
 *
 * status: 'go'(지원 가능) | 'warn'(기준 미달) | 'unknown'(정보 필요) | 'off'(다른 언어권)
 */
function computeEligibility(profile, school) {
  // 가입 직후 계정은 GPA가 비어 있다. null >= 2.8 은 false라서 그대로 두면
  // "기준 미달"로 단정해버린다 — 아직 판정할 수 없다고 알려야 맞다.
  if (profile.gpa === null || profile.gpa === undefined || Number.isNaN(profile.gpa)) {
    return { status: 'unknown', label: 'GPA 정보 필요', detail: 'GPA를 등록하면 지원 가능 여부를 판정할 수 있어요' };
  }
  const track = (profile.exchangeTerm || {}).track || null;
  if (track && !OIA.schoolOffersTrack(school, track)) {
    return { status: 'off', label: '다른 언어권', detail: `${OIA.trackLabel(track)} 전형으로는 지원할 수 없는 학교예요` };
  }

  const needs = [];
  // 연세대 공통 자격에서 이미 떨어지면 어느 학교도 안 된다 — 그 이유를 먼저 말한다
  const common = OIA.commonChecks(profile).filter(c => c.status === 'fail');
  common.forEach(c => needs.push(c.label));

  const gpaCut = Math.max(OIA.MIN_GPA, typeof school.gpaCut === 'number' ? school.gpaCut : 0);
  if (profile.gpa < gpaCut && !common.some(c => c.key === 'gpa')) needs.push(`GPA ${formatGpa(gpaCut)}`);

  // 전형을 안 정했으면 학교의 대표 트랙으로 본다(예전 동작)
  const effTrack = track || (school.track === 'english' ? 'english' : null);
  const exempt = !!(profile.academic && profile.academic.langExempt);
  let langUnknown = null;

  if (effTrack === 'english' && !exempt) {
    const test = OIA.testFor(profile, 'english');
    const cut = Math.max(OIA.minToefl(profile) || 0, typeof school.langTest.cut === 'number' ? school.langTest.cut : 0);
    if (!test || test.score == null) langUnknown = 'TOEFL iBT 점수를 등록하면 판정할 수 있어요';
    else if (cut && test.score < cut && !common.some(c => c.key === 'lang')) needs.push(`TOEFL ${cut}`);
  } else if (effTrack && !exempt) {
    const test = OIA.testFor(profile, effTrack);
    const pts = OIA.langPoints(test);
    if (pts == null) langUnknown = `${OIA.trackOf(effTrack).lang} 성적을 등록하면 판정할 수 있어요`;
    else {
      // 비영어권 전용 학교는 원본에 요구 등급(B2, N2 …)이 있다. 같은 계열 시험일 때만 견준다.
      const ok = school.track === 'nonEnglish' ? OIA.levelAtLeast(test, school.langTest.level) : null;
      if (ok === false) needs.push(`${test.type} ${school.langTest.level}`);
    }
  } else if (!effTrack && !exempt) {
    langUnknown = '지원할 전형(언어권)을 정하면 판정할 수 있어요';
  }

  if (needs.length) return { status: 'warn', label: '기준 미달', detail: `필요한 기준: ${needs.join(' · ')}` };
  if (langUnknown) return { status: 'unknown', label: '어학 정보 필요', detail: langUnknown };
  return { status: 'go', label: '지원 가능', detail: '지원 자격을 갖췄어요 · 배정은 총점 순이라 합격을 뜻하지는 않아요' };
}

function eligibilityBadgeHtml(elig) {
  const cls = elig.status === 'go' ? 'badge--go' : elig.status === 'warn' ? 'badge--warn' : 'badge--neutral';
  const icon = elig.status === 'go' ? '✓' : elig.status === 'warn' ? '!' : elig.status === 'off' ? '–' : '?';
  return `<span class="badge ${cls}" title="${elig.detail}">${icon} ${elig.label}</span>`;
}

/**
 * 내 지원 자격 — 학교와 상관없는 연세대 공통 기준을 한 줄씩. 학교 찾기 맨 위에 둔다.
 * 여기서 걸리면 학교별 배지는 의미가 없어서, 학교 목록보다 먼저 보여야 한다.
 */
function myEligibilityHtml(profile) {
  const checks = OIA.commonChecks(profile);
  const track = (profile.exchangeTerm || {}).track;
  const score = OIA.totalScore(profile);
  const { key: termKey, data: termData } = OIA.termOf(profile);
  const icon = { ok: '✓', fail: '!', unknown: '?' };
  const failed = checks.some(c => c.status === 'fail');
  const unknown = checks.some(c => c.status === 'unknown');
  const summary = failed ? '공통 기준에 못 미치는 항목이 있어요' : unknown ? '입력하면 판정할 수 있어요' : '공통 기준을 모두 갖췄어요';
  return `
    <div class="my-elig${failed ? ' is-fail' : ''}">
      <div class="my-elig__head">
        <p class="my-elig__title">내 지원 자격 <span class="my-elig__track">${track ? OIA.trackLabel(track) : '전형 미정'}${termKey ? ` · ${OIA.termLabel(termKey)}` : ''}</span></p>
        <a class="my-elig__edit" href="onboarding.html">수정</a>
      </div>
      <p class="my-elig__summary">${summary}</p>
      <ul class="my-elig__list">
        ${checks.map(c => `
          <li class="my-elig__row is-${c.status}">
            <span class="my-elig__icon" aria-hidden="true">${icon[c.status]}</span>
            <span class="my-elig__label">${c.label}</span>
            <span class="my-elig__detail">${c.detail}</span>
          </li>`).join('')}
      </ul>
      ${score ? `<p class="my-elig__score">배정 총점 <strong class="tnum">${score.total}</strong> / ${score.max}
        <span>학점 ${score.gpaPart}/${score.gpaMax} + 어학 ${score.langPart}/${score.langMax}${score.estimated ? ' (면제 환산 추정)' : ''}</span></p>`
        : `<p class="my-elig__score my-elig__score--empty">성적표 백분위를 입력하면 배정 총점(${track && track !== 'english' ? '140' : '320'}점 만점)을 계산해요</p>`}
      ${termData ? '' : termKey ? `<p class="my-elig__note">${OIA.termLabel(termKey)} 국제처 안내가 아직 없어 2027 가을학기 기준으로 판정해요</p>` : ''}
    </div>`;
}
