/**
 * 기본 정보 입력 (§4.1) — F2/F4 공통, 단일 프로필 엔티티(AppState.profile)를 공유.
 */
const LANG_TEST_TYPES = ['TOEFL', 'IELTS', 'HSK', 'JLPT', 'DELF'];
const SEASONS = ['봄학기', '여름학기', '가을학기', '겨울학기'];

function renderProfileCard(mount) {
  mount.innerHTML = profileViewTemplate();
  mount.querySelector('[data-edit-profile]').addEventListener('click', () => {
    mount.innerHTML = profileEditTemplate();
    wireProfileEdit(mount);
    wireMajorSelect(mount);
  });
}

function profileViewTemplate() {
  const p = AppState.profile;
  const lang = p.languageTests[0];
  return `
    <div class="section-title">
      <div><h2>기본 정보</h2></div>
      <button class="btn--text" data-edit-profile>수정</button>
    </div>
    <div class="profile-stats profile-stats--compact">
      <div class="profile-stat"><span class="profile-stat__label">GPA</span><span class="profile-stat__value tnum">${p.gpa.toFixed(2)} <em>/ ${p.gpaScale}</em></span></div>
      <div class="profile-stat"><span class="profile-stat__label">어학 성적</span><span class="profile-stat__value tnum">${lang ? `${lang.type} ${lang.score}` : '미등록'}</span></div>
      <div class="profile-stat"><span class="profile-stat__label">교환 시기</span><span class="profile-stat__value">${p.exchangeTerm.year} ${p.exchangeTerm.season}</span></div>
      <div class="profile-stat"><span class="profile-stat__label">재학 학과</span><span class="profile-stat__value">${p.major}</span></div>
    </div>
  `;
}

function profileEditTemplate() {
  const p = AppState.profile;
  const lang = p.languageTests[0] || { type: 'TOEFL', score: '' };
  return `
    <div class="section-title">
      <div><h2>기본 정보 수정</h2></div>
    </div>
    <form class="profile-form" id="profileForm">
      <label class="field">
        <span>GPA (4.3 만점, 0.01 단위)</span>
        <input type="number" step="0.01" min="0" max="4.3" name="gpa" value="${p.gpa}" required>
      </label>
      <label class="field">
        <span>어학 시험</span>
        <select name="langType">${LANG_TEST_TYPES.map(t => `<option ${t === lang.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </label>
      <label class="field">
        <span>어학 점수</span>
        <input type="number" name="langScore" value="${lang.score}" required>
      </label>
      <label class="field">
        <span>교환 시기</span>
        <select name="season">${SEASONS.map(s => `<option ${s === p.exchangeTerm.season ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </label>
      <label class="field">
        <span>단위</span>
        <select name="unit">
          <option value="semester" ${p.exchangeTerm.unit === 'semester' ? 'selected' : ''}>학기(semester)</option>
          <option value="quarter" ${p.exchangeTerm.unit === 'quarter' ? 'selected' : ''}>쿼터(quarter)</option>
        </select>
      </label>
      <label class="field">
        <span>재학 학과</span>
        <input type="hidden" name="major" value="${p.major}">
        <div data-major-select></div>
      </label>
      <div class="field field--actions">
        <button type="button" class="btn btn--ghost btn--sm" data-cancel-edit>취소</button>
        <button type="submit" class="btn btn--primary btn--sm">저장</button>
      </div>
    </form>
  `;
}

function wireMajorSelect(mount) {
  const container = mount.querySelector('[data-major-select]');
  const hiddenInput = mount.querySelector('input[name="major"]');
  const items = MOCK.yonseiMajors.map(m => ({ value: m.majorName, label: m.majorName, group: m.college }));
  const select = createSearchableSelect({
    items,
    selected: hiddenInput.value,
    multiple: false,
    placeholder: '학과를 검색해서 선택하세요',
    onChange: (value) => { hiddenInput.value = value; }
  });
  container.replaceWith(select.el);
}

function wireProfileEdit(mount) {
  mount.querySelector('[data-cancel-edit]').addEventListener('click', () => renderProfileCard(mount));
  mount.querySelector('#profileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    AppState.updateProfile({
      gpa: parseFloat(fd.get('gpa')),
      major: fd.get('major'),
      languageTests: [{ type: fd.get('langType'), score: parseFloat(fd.get('langScore')) }],
      exchangeTerm: { unit: fd.get('unit'), season: fd.get('season'), year: AppState.profile.exchangeTerm.year }
    });
    renderProfileCard(mount);
    showToast('기본 정보를 저장했어요');
    document.dispatchEvent(new CustomEvent('profile:updated'));
  });
}
