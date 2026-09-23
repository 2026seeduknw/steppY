/**
 * 로그인 / 회원가입 화면 컨트롤러 (auth.html 전용).
 * 이미 로그인된 상태로 들어오면 홈으로 되돌린다.
 */
(function () {
  const form = document.getElementById('authForm');
  const modes = document.getElementById('authModes');
  const submit = document.getElementById('authSubmit');
  const errorEl = document.getElementById('authError');
  const noticeEl = document.getElementById('authNotice');
  const nameField = document.querySelector('.auth__field--name');
  const titleEl = document.getElementById('authTitle');
  const subEl = document.getElementById('authSub');
  const passwordInput = form.elements.password;

  let mode = 'signin';

  Auth.init().then(session => {
    // OAuth로 갔다가 실패해서 돌아온 경우 먼저 알린다
    if (Auth.redirectError) {
      showError(Auth.message({ message: Auth.redirectError }));
      return;
    }
    if (session) location.replace('home.html');
  });

  const COPY = {
    signin: {
      title: '다시 만나서 반가워요',
      sub: '연세대학교 메일로 로그인하면 지망 학교와 준비 상황을 어느 기기에서든 이어서 볼 수 있어요',
      submit: '로그인',
      autocomplete: 'current-password'
    },
    signup: {
      title: 'steppY 시작하기',
      sub: '재학생 확인을 위해 연세대학교 메일(@yonsei.ac.kr)로만 가입할 수 있어요',
      submit: '가입하고 시작하기',
      autocomplete: 'new-password'
    }
  };

  function setMode(next) {
    mode = next;
    const copy = COPY[next];
    titleEl.textContent = copy.title;
    subEl.textContent = copy.sub;
    submit.textContent = copy.submit;
    passwordInput.setAttribute('autocomplete', copy.autocomplete);
    nameField.hidden = next !== 'signup';
    modes.querySelectorAll('.mode-toggle__btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === next);
    });
    clearMessages();
  }

  function clearMessages() {
    errorEl.hidden = true;
    noticeEl.hidden = true;
  }

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = false;
    noticeEl.hidden = true;
  }

  function showNotice(text) {
    noticeEl.textContent = text;
    noticeEl.hidden = false;
    errorEl.hidden = true;
  }

  modes.addEventListener('click', e => {
    const btn = e.target.closest('.mode-toggle__btn');
    if (btn) setMode(btn.dataset.mode);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearMessages();

    const fd = new FormData(form);
    const email = (fd.get('email') || '').trim();
    const password = fd.get('password') || '';
    const name = (fd.get('name') || '').trim();

    if (!email || !password) return showError('이메일과 비밀번호를 모두 입력해 주세요.');
    // 서버에서도 막지만, 여기서 먼저 걸러야 왜 안 되는지 바로 알 수 있다
    if (!Auth.isAllowedEmail(email)) {
      return showError(`연세대학교 메일(${ALLOWED_EMAIL_DOMAIN})로만 이용할 수 있어요.`);
    }
    if (mode === 'signup' && password.length < 6) return showError('비밀번호는 6자 이상이어야 해요.');

    submit.disabled = true;
    submit.textContent = mode === 'signin' ? '로그인 중…' : '가입 중…';

    try {
      if (mode === 'signin') {
        await Auth.signIn(email, password);
        location.replace('home.html');
        return;
      }
      const { needsConfirmation } = await Auth.signUp(email, password, name);
      // 세션이 바로 생기면(이메일 확인 꺼진 프로젝트) 온보딩부터 보여준다.
      // 확인 메일이 필요한 경우는 첫 로그인 때 layout.js의 가드가 잡는다.
      if (needsConfirmation) {
        // 프로젝트에서 "Confirm email"이 켜져 있는 경우 — 세션이 없으므로
        // 바로 진입시킬 수 없다. 확인 메일을 안내한다.
        showNotice(`${email}로 인증 메일을 보냈어요. 링크를 눌러 인증을 마친 뒤 로그인해 주세요.`);
        setModeAfterSignup();
        return;
      }
      location.replace('home.html');
    } catch (err) {
      showError(Auth.message(err));
    } finally {
      submit.disabled = false;
      submit.textContent = COPY[mode].submit;
    }
  });

  function setModeAfterSignup() {
    const notice = noticeEl.textContent;
    setMode('signin');
    showNotice(notice);
  }

  setMode('signin');
})();
