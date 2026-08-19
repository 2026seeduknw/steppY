/**
 * 지원 가능 여부 판정 (간이 로직).
 * §7.2 실제 배정은 총점(GPA 백분위×2 + 어학 배점) 석차 기반 배정이지만,
 * 이 데모는 F3 "지원 가능 여부 배지"만 다루므로 GPA 컷 · 어학 컷 충족 여부만
 * 비교하는 단순 임계치 로직을 사용합니다. 실제 총점·석차 배정 로직은
 * 서비스가 다수 대학 규정을 데이터화한 뒤 §7.2 산식대로 별도 구현이 필요합니다.
 */
function computeEligibility(profile, school) {
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
  const reasons = [];
  if (!gpaOk) reasons.push(`GPA ${school.gpaCut} 이상 필요`);
  if (!langOk) reasons.push(`${school.langTest.type} ${school.langTest.cut} 이상 필요`);
  return { status: 'warn', label: '기준 미달', detail: reasons.join(' · ') };
}

function eligibilityBadgeHtml(elig) {
  const cls = elig.status === 'go' ? 'badge--go' : elig.status === 'warn' ? 'badge--warn' : 'badge--neutral';
  const icon = elig.status === 'go' ? '✓' : elig.status === 'warn' ? '!' : '?';
  return `<span class="badge ${cls}" title="${elig.detail}">${icon} ${elig.label}</span>`;
}
