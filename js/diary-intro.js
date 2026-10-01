/**
 * 기록하기 — 비로그인 온보딩.
 *
 * 로그인 전에는 사진·기록 화면을 보여주지 않고, 이 탭이 무엇을 해 주는지 위에서 아래로 이어지는 한 페이지로 알려 준다(스크롤).
 *   1. 사진 한 장을 올리면 함께 담기는 것(캡션·위치·날씨·노래·태그)
 *   2. 돌아볼 수 있게 정리해 주는 것(Wrap-up → 교환보고서를 쓸 때 그날을 생생하게)
 *   3. 교환 간 친구들과 함께 보는 타임라인
 * 모든 그림은 예시이고 어디에도 저장되지 않는다. 탭바 위에 고정된 버튼이 로그인으로 이어진다.
 *
 * journal.js가 로그인 여부에 따라 이 화면과 사진 다이어리(diary-view.js)를 번갈아 붙인다.
 */
(function (global) {
  let mounted = null;

  const PAGES = [
    {
      key: 'info',
      title: '기억하고 싶은 순간들을 남겨요',
      desc: '사진을 넣으면 날씨와 위치가 함께 저장돼요.<br>듣고 있는 음악도 등록할 수 있고, 날씨·위치·사진 분위기에 맞는 노래도 추천해드려요.',
      // 기록하기 탭의 최근 사진 카드(diary-view.js renderFeatured)와 같은 마크업·클래스 — 같은 모양으로 나온다
      visual: () => {
        const d = new Date();
        const film = `'${String(d.getFullYear()).slice(2)} ${d.getMonth() + 1} ${d.getDate()}`;
        return `
        <div class="dintro-polaroid" aria-hidden="true">
          <div class="diary-slide is-active">
            <div class="diary-featured__film">
              <div class="diary-featured__card">
                <img class="diary-featured__img" src="assets/mock/campus-sunset.webp" alt="" draggable="false">
              </div>
              <div class="film-bar film-bar--bottom"><span>▶ 1A</span><span>${film}</span></div>
            </div>
          </div>
          <ul class="dintro-chips">
            <li><b>✏️ 캡션</b>노을 지는 캠퍼스</li>
            <li><b>📍 위치</b>리옹, 프랑스</li>
            <li><b>☀️ 날씨</b>맑음 19°</li>
            <li><b>🎵 노래</b>Kiss Me · Ariana Grande</li>
          </ul>
        </div>`;
      }
    },
    {
      key: 'wrapup',
      title: '돌아볼 수 있게 정리해 드려요',
      desc: '쌓인 기록을 Wrap-up으로 모아 드려요.<br>교환보고서를 쓸 때 그때를 생생하게 떠올리고, 교환 생활을 돌아보는 장치가 돼요.',
      visual: `
        <div class="dintro-wrap" aria-hidden="true">
          <p class="dintro-wrap__eyebrow">WRAP-UP · 예시 &nbsp;<b>이번 달 정리</b></p>
          <div class="dintro-wrap__stats">
            <div><strong>12</strong><span>기록한 날</span></div>
            <div><strong>31</strong><span>사진</span></div>
            <div><strong>3</strong><span>다녀온 도시</span></div>
          </div>
          <div class="dintro-wrap__strip">
            <img src="assets/mock/campus-sunset.webp" alt="" draggable="false">
            <img src="assets/mock/cafe-laptop.webp" alt="" draggable="false">
            <span>+29</span>
          </div>
          <p class="dintro-wrap__note">“첫 바게트, 도서관 스터디룸…” 보고서에 쓸 이야기가 이미 모여 있어요</p>
        </div>`
    },
    {
      key: 'friends',
      title: '교환 간 친구들과 함께해요',
      desc: '교환학생을 간 친구들과 친구를 맺으면, 친구들이 어디서 뭘 하는지 타임라인에서 함께 볼 수 있어요.<br>댓글과 좋아요로 안부도 나눠요.',
      // 친구 타임라인 카드(js/friends.js cardHtml)와 같은 클래스·구성 — 아바타 옆에 이름·학교, 사진, 그 아래 캡션과 촬영 지역
      visual: () => {
        const card = (name, school, photo, caption, place) => `
          <article class="ft-card">
            <header class="ft-card__head">
              <span class="ft-avatar">${name[0]}</span>
              <div class="ft-card__who">
                <strong>${name}</strong>
                <span class="ft-card__school">🎓 ${school}</span>
              </div>
            </header>
            <div class="ft-photos"><img src="${photo}" alt="" draggable="false"></div>
            <p class="ft-card__body">${caption}</p>
            <p class="ft-card__meta">📍 ${place}</p>
          </article>`;
        return `
        <div class="dintro-timeline" aria-hidden="true">
          ${card('현서', 'UCLA · California', 'assets/mock/campus-sunset.webp', '수업 끝나고 계단 위에서 본 노을. 잔디밭이 다 금빛이었다.', 'Los Angeles, California')}
          ${card('성욱', 'UNC · North Carolina', 'assets/mock/cafe-laptop.webp', '아이스 라떼 두 잔 놓고 과제하는 오후. 날씨가 너무 좋다.', 'Chapel Hill, North Carolina')}
        </div>`;
      }
    }
  ];

  const MARKUP = `
    <section class="dintro" aria-label="기록하기 소개">
      <header class="dintro__hero">
        <h1 class="dintro__headline"><span class="wm-text">Memories from Exchange</span></h1>
        <p class="dintro__sub">교환 생활의 기억들을 모아요</p>
      </header>
      ${PAGES.map((p, i) => `
        <article class="dintro__page" data-key="${p.key}">
          <p class="dintro__no">0${i + 1}</p>
          <h2 class="dintro__title">${p.title}</h2>
          <p class="dintro__desc">${p.desc}</p>
          <div class="dintro__visual">${typeof p.visual === 'function' ? p.visual() : p.visual}</div>
        </article>`).join('')}
      <a class="dintro__login" href="auth.html">이미 계정이 있어요 · 로그인</a>
      <div class="dintro__cta">
        <a class="btn btn--primary btn--block" id="dintroStart" href="auth.html">로그인하고 시작하기</a>
      </div>
    </section>`;

  function mountDiaryIntro(mount) {
    mounted = mount;
    mount.classList.add('diary-view', 'diary-intro-mount');
    // 사진 카드 모양이 필름 테마 CSS에 걸려 있어서 테마는 필름으로 맞추고, 배경만 흰색으로 덮는다
    // (body.journal-intro). 로그인해서 다이어리가 붙으면 diary-view가 시간대를 다시 정한다.
    document.body.dataset.theme = 'film';
    document.body.dataset.tod = 'day';
    document.body.classList.add('journal-intro');
    mount.innerHTML = MARKUP;
    mount.querySelector('#dintroStart').addEventListener('click', () => {
      if (typeof trackEvent === 'function') trackEvent('journal_intro_login_click', {});
    });
    if (typeof trackEvent === 'function') trackEvent('journal_intro_view', {});
  }

  function unmountDiaryIntro() {
    if (!mounted) return;
    mounted.classList.remove('diary-intro-mount');
    document.body.classList.remove('journal-intro');
    mounted = null;
  }

  global.mountDiaryIntro = mountDiaryIntro;
  global.unmountDiaryIntro = unmountDiaryIntro;
  global.diaryIntroIsMounted = () => !!mounted;
})(window);
