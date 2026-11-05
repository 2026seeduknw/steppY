/**
 * 기본 정보 카드 (계정 시트) — 보기만 한다.
 *
 * 고치는 건 기본 정보 화면(onboarding.html)에서 한다. 예전엔 이 카드 안에 따로 입력 폼이
 * 있었는데, 전형·어학 등급·학적처럼 국제처 규칙에 맞춘 칸이 늘면서 두 폼이 어긋나기
 * 시작했다(여기만 IELTS를 받는 식으로). 입력하는 곳을 한 군데로 모았다.
 */
function renderProfileCard(mount) {
  mount.innerHTML = profileViewTemplate();
}

function profileViewTemplate() {
  const p = AppState.profile;
  const term = p.exchangeTerm || {};
  const a = p.academic || {};
  const track = term.track;
  const test = track ? OIA.testFor(p, track) : (p.languageTests || [])[0];
  const degree = (OIA.DEGREES.find(d => d.key === a.degree) || OIA.DEGREES[0]).label;
  const field = (OIA.FIELDS.find(f => f.key === a.field) || {}).label;
  const stat = (label, value) => `<div class="profile-stat"><span class="profile-stat__label">${label}</span><span class="profile-stat__value">${value}</span></div>`;
  return `
    <div class="section-title">
      <div><h2>기본 정보</h2></div>
      <a class="btn--text" href="onboarding.html">수정</a>
    </div>
    <div class="profile-stats profile-stats--compact">
      ${stat('이름', p.name || '미등록')}
      ${stat('GPA', p.gpa == null ? '미등록' : `<span class="tnum">${formatGpa(p.gpa)}</span> <em>/ ${formatGpa(p.gpaScale)}</em>${a.percentile != null ? ` <em>· 백분위 ${a.percentile}</em>` : ''}`)}
      ${stat('지원 전형', track ? OIA.trackLabel(track) : '미정')}
      ${stat('어학 성적', a.langExempt ? '면제 대상' : test ? `<span class="tnum">${OIA.testText(test)}</span>${test.date ? ` <em>· ${test.date.replace('-', '.')}</em>` : ''}` : '미등록')}
      ${stat('교환 시기', `${term.year} ${term.season}${term.length === 2 ? ' · 1년' : ' · 한 학기'}`)}
      ${stat('학적', [degree, field, a.semesters != null ? `${a.semesters}학기 이수` : null].filter(Boolean).join(' · '))}
      ${stat('재학 학과', p.major || '미등록')}
    </div>
  `;
}
