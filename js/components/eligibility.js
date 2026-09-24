/**
 * 지원 가능 여부 판정 (간이 로직).
 * §7.2 실제 배정은 총점(GPA 백분위×2 + 어학 배점) 석차 기반 배정이지만,
 * 이 데모는 F3 "지원 가능 여부 배지"만 다루므로 GPA 컷 · 어학 컷 충족 여부만
 * 비교하는 단순 임계치 로직을 사용합니다. 실제 총점·석차 배정 로직은
 * 서비스가 다수 대학 규정을 데이터화한 뒤 §7.2 산식대로 별도 구현이 필요합니다.
 */
function computeEligibility(profile, school) {
  // 가입 직후 계정은 GPA가 비어 있다. null >= 2.8 은 false라서 그대로 두면
  // "기준 미달"로 단정해버린다 — 아직 판정할 수 없다고 알려야 맞다.
  if (profile.gpa === null || profile.gpa === undefined || Number.isNaN(profile.gpa)) {
    return { status: 'unknown', label: 'GPA 정보 필요', detail: 'GPA를 등록하면 지원 가능 여부를 판정할 수 있어요' };
  }
  const gpaOk = profile.gpa >= school.gpaCut;
  const langScore = (profile.languageTests || []).find(t => t.type === school.langTest.type);

  if (school.track === 'english' && !langScore) {
    return { status: 'unknown', label: '어학 정보 필요', detail: `${school.langTest.type} 점수를 등록하면 판정할 수 있어요` };
  }
  if (school.track === 'nonEnglish' && !langScore) {
    return { status: 'unknown', label: '어학 정보 필요', detail: `${school.langTest.type} 성적을 등록하면 판정할 수 있어요` };
  }

  const langOk = langScore ? (typeof school.langTest.cut === 'number' ? langScore.score >= school.langTest.cut : true) : false;

  if (gpaOk && langOk) return { status: 'go', label: '지원 가능', detail: 'GPA·어학 기준을 충족해요' };
  // 못 하는 이유를 늘어놓는 대신 "무엇이 되면 되는지"로 적는다. 숫자는 같지만
  // 사용자가 다음에 할 일이 문장 안에 들어온다.
  const needs = [];
  if (!gpaOk) needs.push(`GPA ${school.gpaCut}`);
  if (!langOk) needs.push(`${school.langTest.type} ${school.langTest.cut}`);
  return { status: 'warn', label: '기준 미달', detail: `${needs.join(' · ')}부터 지원할 수 있어요` };
}

function eligibilityBadgeHtml(elig) {
  const cls = elig.status === 'go' ? 'badge--go' : elig.status === 'warn' ? 'badge--warn' : 'badge--neutral';
  const icon = elig.status === 'go' ? '✓' : elig.status === 'warn' ? '!' : '?';
  return `<span class="badge ${cls}" title="${elig.detail}">${icon} ${elig.label}</span>`;
}
