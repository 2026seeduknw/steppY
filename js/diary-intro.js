/**
 * 기록하기 — 비로그인 온보딩.
 *
 * 로그인 전에는 사진·기록 화면을 보여주지 않고, 이 탭이 무엇을 해 주는지 위에서 아래로 이어지는 한 페이지로 알려 준다(스크롤).
 *   1. 사진 한 장을 올리면 함께 담기는 것(제목·캡션·위치·날씨·노래·폴더)
 *   2. 돌아볼 수 있게 정리해 주는 것(Streak·캘린더 → Wrap-up → 교환보고서)
 *   3. 교환 간 친구들이 오늘 올린 기록(Friends Today)
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
      desc: '사진에 제목과 캡션을 붙이면 날씨와 위치가 함께 저장돼요.<br>그때 듣던 음악을 추가하고, 담을 폴더도 바로 선택해요.',
      // 기록하기 첫 화면의 큰 사진 카드(diary-view.js renderHomeHero)와 같은 클래스
      visual: () => {
        const d = new Date();
        const date = `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`;
        return `
        <div class="dintro-polaroid" aria-hidden="true">
          <div class="rec-hero dintro-hero">
            <div class="rec-hero__btn">
              <img class="rec-hero__img" src="assets/mock/campus-sunset.webp" alt="" draggable="false">
              <span class="rec-hero__place">📍 리옹 · 캠퍼스</span>
              <span class="rec-hero__label">Today’s Memories</span>
              <span class="rec-hero__date">${date}</span>
            </div>
          </div>
          <ul class="dintro-chips">
            <li><b>✏️ 제목</b>노을 지는 캠퍼스</li>
            <li><b>📁 폴더</b>Daily · Campus</li>
            <li><b>☀️ 날씨</b>맑음 19°</li>
            <li><b>🎵 노래</b>Kiss Me · Ariana Grande</li>
          </ul>
        </div>`;
      }
    },
    {
      key: 'wrapup',
      title: '돌아볼 수 있게 정리해 드려요',
      desc: '며칠 기록했는지 쌓이는 걸 보고, 캘린더에서 날짜마다 첫 사진으로 돌아봐요.<br>쌓인 기록은 Wrap-up으로 모아 교환보고서를 쓸 때 꺼내 봐요.',
      // D-day 밑 이번 주 줄(diary-view.js renderStreak)과 같은 클래스
      visual: () => {
        const d = new Date();
        const base = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
        const done = new Set([0, 1, 2].map(k => d.getDay() - k).filter(k => k >= 0));
        const cells = ['일', '월', '화', '수', '목', '금', '토'].map((w, i) => {
          const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i).getDate();
          const cls = ['rec-streak__day', done.has(i) && 'is-done', i === d.getDay() && 'is-today', i > d.getDay() && 'is-future'].filter(Boolean).join(' ');
          return `<span class="${cls}"><i>${w}</i><b>${day}</b></span>`;
        }).join('');
        return `
        <div class="dintro-wrap" aria-hidden="true">
          <div class="rec-streak dintro-streak">
            <div class="rec-streak__top">
              <p class="rec-streak__count"><b>12</b>days recorded</p>
              <span class="rec-streak__more">자세히 보기 →</span>
            </div>
            <div class="rec-streak__week">${cells}</div>
          </div>
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
        </div>`;
      }
    },
    {
      key: 'friends',
      title: '교환 간 친구들과 함께해요',
      desc: '친구를 맺으면 친구들이 오늘 올린 사진과 글을 시간 순으로 볼 수 있어요.<br>초대 링크 하나로 바로 친구가 돼요.',
      // 기록하기 첫 화면의 Friends Today(diary-archive.js drawFriends)와 같은 클래스
      visual: () => {
        const card = (name, school, time, photo, title) => `
          <li class="ftl__item">
            <article class="ftl__card">
              <div class="ftl__who"><span class="ftl__av">${name[0]}</span><b>${name}</b><span class="ftl__school">${school}</span><span class="ftl__time">${time}</span></div>
              <div class="ftl__photo">
                <img class="ftl__img" src="${photo}" alt="" draggable="false">
                <p class="ftl__title">${title}</p>
                <span class="ftl__toggle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
              </div>
            </article>
          </li>`;
        return `
        <div class="dintro-timeline" aria-hidden="true">
          <p class="arc-sec-home__label">Friends Today</p>
          <ol class="ftl">
            ${card('현서', 'UCLA · LA', '18:40', 'assets/mock/campus-sunset.webp', '수업 끝나고 본 노을')}
            ${card('성욱', 'UNC · Chapel Hill', '14:05', 'assets/mock/cafe-laptop.webp', '라떼 두 잔 놓고 과제')}
          </ol>
        </div>`;
      }
    }
  ];
  const MARKUP = `
    <section class="dintro" aria-label="기록하기 소개">
      <header class="dintro__hero">
        <h1 class="dintro__headline"><span class="wm-text">Archive your memories</span></h1>
        <p class="dintro__sub">교환 생활의 기억들을 모아요.</p>
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
