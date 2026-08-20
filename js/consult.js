/**
 * 멘토 없는 멘토 상담 — 학교를 고르면 선배 경험보고서 후기를 질문 키워드로
 * 매칭해 챗봇 형태로 보여준다. 실제 AI/백엔드 없이 클라이언트 키워드 매칭으로만
 * 동작하며, 후기 원문은 Supabase school_exchange_reports에서 온다
 * (js/data-source.js::loadSchoolExchangeReports → MOCK.schoolReviews).
 * 질문 키워드 사전은 js/review-topics.js(REVIEW_TOPICS)를 후기 태깅 쪽과 공유한다 —
 * 두 곳이 따로 놀면 여기서 제안하는 주제 칩이 실제 후기 태그와 어긋날 수 있어서다.
 */
(function () {
  AppState.load();

  const SUGGEST_TAGS = REVIEW_TOPICS.map(t => t.tag);

  const params = new URLSearchParams(location.search);
  const preselect = params.get('school');

  let activeSchool = null;
  let messages = [];

  const panel = document.getElementById('chatPanel');
  const messagesEl = document.getElementById('chatMessages');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function nowLabel() {
    return new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  }

  function matchReviews(schoolId, questionText) {
    const topics = matchReviewTopics(questionText);
    const all = MOCK.schoolReviews[schoolId] || [];
    if (topics.length) {
      const hits = all.filter(r => topics.includes(r.tag));
      if (hits.length) return { hits, fallback: false, topics };
    }
    return { hits: all.slice(0, 3), fallback: true, topics };
  }

  function addMessage(msg) { messages.push(msg); renderMessages(); }

  function botBubbleInner(m) {
    if (m.type === 'typing') {
      return `<div class="chat-typing"><span></span><span></span><span></span></div>`;
    }
    if (m.type === 'chips') {
      return `
        <div class="chat-message__sender">Mentor's Step</div>
        <p>${escapeHtml(m.text)}</p>
        <div class="chat-suggest-chips">${m.chips.map(c => `<button type="button" class="chip" data-suggest="${c}">${c}</button>`).join('')}</div>
      `;
    }
    if (m.type === 'reviews') {
      return `
        <div class="chat-message__sender">Mentor's Step</div>
        <p>${escapeHtml(m.text)}</p>
        ${m.reviews.map(r => `
          <div class="chat-message__quote">
            <div class="chat-message__quote-meta">${r.tag ? `#${r.tag} · ` : ''}${escapeHtml(r.author || '선배 후기')}</div>
            <div class="chat-message__quote-text">${escapeHtml(r.text)}</div>
          </div>
        `).join('')}
      `;
    }
    return `<div class="chat-message__sender">Mentor's Step</div><p>${escapeHtml(m.text)}</p>`;
  }

  function renderMessages() {
    const logoFile = activeSchool && SCHOOL_LOGOS[activeSchool];
    const avatarInner = logoFile ? `<img src="assets/school-logos/${logoFile}" alt="">` : '🐾';
    messagesEl.innerHTML = messages.map(m => {
      if (m.role === 'user') {
        return `<div class="chat-message chat-message--user">
          <div class="chat-message__bubble">${escapeHtml(m.text)}</div>
          <div class="chat-message__meta">${m.time || ''}</div>
        </div>`;
      }
      return `<div class="chat-message chat-message--bot">
        <div class="chat-message__row">
          <div class="chat-message__avatar">${avatarInner}</div>
          <div class="chat-message__bubble">${botBubbleInner(m)}</div>
        </div>
        ${m.type === 'typing' ? '' : `<div class="chat-message__meta">${m.time || ''}</div>`}
      </div>`;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function startChat(schoolId) {
    const school = MOCK.schools.find(s => s.id === schoolId);
    if (!school) return;
    activeSchool = schoolId;
    messages = [];
    document.getElementById('chatSchoolName').textContent = `${school.name} 후기 챗봇`;
    panel.hidden = false;
    if (currentSelect) currentSelect.setSelected(schoolId);
    addMessage({ role: 'bot', type: 'chips', text: `${school.name}에 대해 뭐가 궁금해요? 선배들의 후기를 찾아드릴게요.`, chips: SUGGEST_TAGS, time: nowLabel() });
  }

  function askQuestion(text) {
    if (!activeSchool || !text.trim()) return;
    trackEvent('consult_question', { schoolId: activeSchool });
    addMessage({ role: 'user', text, time: nowLabel() });

    const typingMsg = { role: 'bot', type: 'typing' };
    messages.push(typingMsg);
    renderMessages();

    setTimeout(() => {
      const idx = messages.indexOf(typingMsg);
      if (idx !== -1) messages.splice(idx, 1);

      const { hits, fallback, topics } = matchReviews(activeSchool, text);
      if (!hits.length) {
        addMessage({ role: 'bot', text: '관련 후기를 찾지 못했어요. 다른 키워드로 물어봐 주세요.', time: nowLabel() });
        return;
      }
      const intro = fallback
        ? '정확히 일치하는 후기는 없지만, 이 학교의 선배 후기를 보여드려요.'
        : `${topics.join(', ')} 관련 선배 후기를 찾았어요.`;
      addMessage({ role: 'bot', type: 'reviews', text: intro, reviews: hits, time: nowLabel() });
    }, 600);
  }

  const pickerMount = document.getElementById('schoolPicker');
  let currentSelect = null;
  function renderSchoolPicker() {
    pickerMount.innerHTML = '';
    const items = MOCK.schools.map(s => ({ value: s.id, label: s.name, group: s.country }));
    const keepSelected = activeSchool && MOCK.schools.some(s => s.id === activeSchool) ? activeSchool : null;
    currentSelect = createSearchableSelect({
      items,
      selected: keepSelected,
      multiple: false,
      placeholder: '학교를 검색해서 선택하세요',
      onChange: (value) => { if (value) startChat(value); }
    });
    pickerMount.appendChild(currentSelect.el);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    askQuestion(text);
  });

  messagesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest]');
    if (btn) askQuestion(btn.dataset.suggest);
  });

  function tryPreselect() {
    if (!preselect || activeSchool) return;
    if (MOCK.schools.some(s => s.id === preselect)) startChat(preselect);
  }

  renderSchoolPicker();
  tryPreselect();

  document.addEventListener('MOCK:updated', () => {
    renderSchoolPicker();
    tryPreselect();
    if (activeSchool && !MOCK.schools.some(s => s.id === activeSchool)) {
      panel.hidden = true;
      activeSchool = null;
    }
  });
})();
