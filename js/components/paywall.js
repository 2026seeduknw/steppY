/**
 * 크레딧 · 프리미엄 결제창 — 앱 어디서 결제를 권하든 이 시트 하나를 띄운다.
 *
 *   openPaywall({ reason, need })
 *     reason: 'photo'   기록하기에서 오늘 무료 사진을 다 썼을 때
 *             'match'   학점 인정/전공 매칭 목록을 더 보려는데 크레딧이 모자랄 때
 *             'credits' 멘토 질문 등 크레딧이 모자랄 때
 *             'menu'    크레딧 배지·계정 시트에서 직접 열었을 때
 *     need:   이번에 필요한 크레딧(있으면 "N 크레딧 더 필요해요"로 보여준다)
 *
 * 결제 자체는 Payments.purchase()가 맡는다. 지금은 결제 수단이 연결되지 않아
 * "준비 중" 안내만 한다 — 3단계에서 앱(Apple IAP)·웹(토스페이먼츠) 공급자를
 * Payments.providers에 채워 넣으면 이 화면은 손대지 않아도 된다.
 */
const Payments = {
  /** 'app'(Capacitor로 감싼 iOS 앱) | 'web' */
  platform() {
    return (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())
      ? 'app' : 'web';
  },

  /**
   * 플랫폼별 결제 공급자. purchase({ kind, item })가 결제를 끝내고 { ok } 를 돌려주면
   * 된다 — 실제 지급은 결제를 검증한 서버가 grant_* RPC(supabase/premium.sql)로 하고,
   * 화면은 끝난 뒤 잔액을 다시 읽기만 한다.
   */
  providers: { app: null, web: null },

  isReady() { return !!this.providers[this.platform()]; },

  async purchase(kind, item) {
    if (typeof trackEvent === 'function') trackEvent('paywall_purchase_click', { kind, id: item.id, platform: this.platform() });
    const provider = this.providers[this.platform()];
    if (!provider) return { ok: false, error: 'not_ready' };
    return provider.purchase({ kind, item });
  }
};

const PAYWALL_REASON = {
  photo:   { icon: '📸', title: '오늘 무료 사진 3장을 다 썼어요', desc: '크레딧으로 한 장씩 더 올리거나, 프리미엄이면 무제한이에요.' },
  match:   { icon: '🔓', title: '매칭 결과를 더 보려면 크레딧이 필요해요', desc: '크레딧 10개로 3개씩 더 볼 수 있어요.' },
  credits: { icon: '🪙', title: '크레딧이 부족해요', desc: '크레딧을 충전하거나 프리미엄으로 매달 받아보세요.' },
  menu:    null
};

// 결제가 꺼진 빌드(RELEASE.payments=false)에서 쓰는 문구 — 충전·프리미엄 대신 무료로 얻는 길을 알려 준다
const PAYWALL_REASON_FREE = {
  photo:   { desc: '내일 다시 3장을 올릴 수 있어요.' },
  match:   { desc: '질문에 답변하면 크레딧을 받아 더 볼 수 있어요.' },
  credits: { desc: '질문에 답변하면 크레딧을 받을 수 있어요.' }
};

const PREMIUM_BENEFITS = [
  ['📸', '기록하기 사진 무제한'],
  ['🪙', `매달 ${BM.PREMIUM_MONTHLY_CREDITS} 크레딧 (구독 중에만 사용)`],
  ['🚫', '광고 없이']
];

function openPaywall({ reason = 'menu', need = 0 } = {}) {
  document.querySelectorAll('.app-sheet--paywall').forEach(el => el.remove());
  if (typeof trackEvent === 'function') trackEvent('paywall_open', { reason });

  const won = (n) => `₩${Number(n).toLocaleString('ko-KR')}`;
  const plans = AppState.getPremiumPlans();
  const packages = AppState.getCreditPackages();
  const authed = AppState.isAuthed;
  const premium = AppState.isPremium();
  const balance = AppState.getCredits();
  const payOn = !!RELEASE.payments;
  const base_ctx = PAYWALL_REASON[reason];
  const ctx = base_ctx && !payOn ? Object.assign({}, base_ctx, PAYWALL_REASON_FREE[reason]) : base_ctx;
  const short = need > 0 ? Math.max(0, need - balance) : 0;
  // 한 달 값으로 나눠서 "월 ₩X"로 보여줘야 긴 요금제가 싸다는 게 한눈에 보인다
  const monthly = (p) => Math.round(p.priceKrw / Math.max(1, Math.round(p.days / 30)));
  const base = plans.length ? monthly(plans[0]) : 0;

  let selectedPlan = plans.length > 1 ? plans[plans.length - 1].id : (plans[0] && plans[0].id);
  let selectedPack = packages.length > 1 ? packages[1].id : (packages[0] && packages[0].id);

  const sheet = document.createElement('div');
  sheet.className = 'app-sheet app-sheet--paywall';
  sheet.innerHTML = `
    <div class="app-sheet__scrim" data-close></div>
    <div class="app-sheet__panel" role="dialog" aria-modal="true" aria-label="크레딧 · 프리미엄">
      <div class="app-sheet__grip" data-close></div>
      <div class="app-sheet__body paywall">
        <div class="paywall__top">
          ${authed ? `
          <div class="paywall__balance">
            <span>내 크레딧</span><strong>🪙 ${balance}</strong>
            ${premium ? `<span class="paywall__badge">프리미엄 이용 중</span>` : ''}
          </div>` : '<span></span>'}
          <button type="button" class="paywall__close" data-close aria-label="닫기">✕</button>
        </div>

        ${ctx ? `
        <div class="paywall__reason">
          <span class="paywall__reason-icon" aria-hidden="true">${ctx.icon}</span>
          <div>
            <p class="paywall__reason-title">${ctx.title}</p>
            <p class="paywall__reason-desc">${short > 0 ? `${short} 크레딧이 더 필요해요 · ` : ''}${ctx.desc}</p>
          </div>
        </div>` : ''}

        ${authed ? '' : `
        <div class="paywall__guest">
          <p><strong>가입하면 ${BM.SIGNUP_BONUS} 크레딧</strong>을 바로 드려요 (${BM.SIGNUP_BONUS_DAYS}일 안에 사용)</p>
          <a class="btn btn--primary btn--block" href="auth.html">로그인 · 회원가입</a>
        </div>`}

        ${reason === 'photo' && authed ? `
        <button type="button" class="paywall__quick" data-quick-photo ${balance < BM.PHOTO_EXTRA_COST ? 'disabled' : ''}>
          <span>🪙 ${BM.PHOTO_EXTRA_COST} 크레딧으로 오늘 1장 더 올리기</span>
          <span class="paywall__quick-note">${balance < BM.PHOTO_EXTRA_COST ? '크레딧 부족' : '바로 사용'}</span>
        </button>` : ''}

        ${payOn || premium ? `<section class="paywall__premium${premium ? ' is-active' : ''}">
          <div class="paywall__premium-head">
            <span class="paywall__premium-title">
              <svg class="paywall__crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 7.5 7 11l5-7 5 7 4.5-3.5L19.5 18h-15z"/><rect x="4.5" y="19.3" width="15" height="2.2" rx="1.1"/></svg>
              steppY Premium
            </span>
            ${premium ? '<span class="paywall__badge">이용 중</span>' : ''}
          </div>
          <ul class="paywall__benefits">
            ${PREMIUM_BENEFITS.map(([i, t]) => `<li><span aria-hidden="true">${i}</span>${t}</li>`).join('')}
          </ul>
          <div class="paywall__options" role="radiogroup" aria-label="프리미엄 기간">
            ${plans.map(p => {
              const perMonth = monthly(p);
              const off = base && perMonth < base ? Math.round((1 - perMonth / base) * 100) : 0;
              return `
              <button type="button" class="paywall__option${p.id === selectedPlan ? ' is-selected' : ''}" role="radio"
                      aria-checked="${p.id === selectedPlan}" data-plan="${p.id}">
                <span class="paywall__option-label">${p.label.replace('프리미엄 ', '')}</span>
                <span class="paywall__option-price">${won(p.priceKrw)}</span>
                <span class="paywall__option-sub">${p.days > 31 ? `월 ${won(perMonth)}` : '매달'}${off ? ` · ${off}% 할인` : ''}</span>
              </button>`;
            }).join('')}
          </div>
          <button type="button" class="btn btn--accent btn--block paywall__cta" data-buy="premium" ${authed ? '' : 'disabled'}>
            ${premium ? '프리미엄 기간 늘리기' : '프리미엄 시작하기'}
          </button>
        </section>` : ''}

        ${payOn ? `<section class="paywall__credits">
          <p class="paywall__section-title">크레딧 충전</p>
          <div class="paywall__options paywall__options--grid" role="radiogroup" aria-label="크레딧 패키지">
            ${packages.map(p => `
              <button type="button" class="paywall__option${p.id === selectedPack ? ' is-selected' : ''}" role="radio"
                      aria-checked="${p.id === selectedPack}" data-pack="${p.id}">
                <span class="paywall__option-label">🪙 ${p.credits.toLocaleString('ko-KR')}</span>
                <span class="paywall__option-price">${won(p.priceKrw)}</span>
                ${p.bonus ? `<span class="paywall__option-sub">+${p.bonus} 보너스 포함</span>` : '<span class="paywall__option-sub">&nbsp;</span>'}
              </button>`).join('')}
          </div>
          <button type="button" class="btn btn--primary btn--block paywall__cta" data-buy="credits" ${authed ? '' : 'disabled'}>크레딧 충전하기</button>
        </section>` : ''}

        <details class="paywall__uses">
          <summary>크레딧은 어디에 쓰나요?</summary>
          <ul>
            <li>멘토에게 질문하기 <b>🪙 ${BM.ASK_COST}</b></li>
            <li>매칭 결과 3개 더 보기 <b>🪙 ${BM.MATCH_UNLOCK_COST}</b></li>
            <li>무료 3장을 넘긴 사진 1장 <b>🪙 ${BM.PHOTO_EXTRA_COST}</b></li>
            <li>질문에 답변하면 <b>🪙 +${BM.ANSWER_REWARD}</b> 받아요</li>
          </ul>
        </details>

        ${payOn ? `<p class="paywall__foot">${Payments.isReady()
          ? '결제가 끝나면 바로 반영돼요.'
          : '결제 수단을 연결하는 중이에요 · 곧 열어둘게요'}</p>` : ''}
      </div>
    </div>`;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  const hadSheetOpen = document.body.classList.contains('is-sheet-open');
  document.body.classList.add('is-sheet-open');

  const close = () => {
    sheet.classList.remove('is-open');
    // 다른 시트 위에 겹쳐 열렸다면(예: 질문하기 시트) 그 시트의 스크롤 잠금은 남겨 둔다
    if (!hadSheetOpen) document.body.classList.remove('is-sheet-open');
    setTimeout(() => sheet.remove(), 300);
  };

  const selectIn = (attr, id) => {
    sheet.querySelectorAll(`[${attr}]`).forEach(b => {
      const on = b.getAttribute(attr) === id;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', String(on));
    });
  };

  sheet.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) { close(); return; }

    const plan = e.target.closest('[data-plan]');
    if (plan) { selectedPlan = plan.dataset.plan; selectIn('data-plan', selectedPlan); return; }
    const pack = e.target.closest('[data-pack]');
    if (pack) { selectedPack = pack.dataset.pack; selectIn('data-pack', selectedPack); return; }

    const quick = e.target.closest('[data-quick-photo]');
    if (quick) {
      quick.disabled = true;
      const res = await AppState.buyExtraPhoto();
      if (!res.ok) {
        quick.disabled = false;
        showToast('크레딧을 쓰지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      close();
      showToast(`🪙 ${BM.PHOTO_EXTRA_COST} 크레딧을 써서 오늘 1장 더 올릴 수 있어요`);
      return;
    }

    const buy = e.target.closest('[data-buy]');
    if (buy) {
      const kind = buy.dataset.buy;
      const item = kind === 'premium'
        ? plans.find(p => p.id === selectedPlan)
        : packages.find(p => p.id === selectedPack);
      if (!item) return;
      buy.disabled = true;
      const res = await Payments.purchase(kind, item);
      buy.disabled = false;
      if (res.ok) {
        close();
        document.dispatchEvent(new CustomEvent('credits:changed'));
        showToast(kind === 'premium' ? '프리미엄이 시작됐어요' : '크레딧을 충전했어요');
      } else if (res.error === 'not_ready') {
        showToast('결제 수단을 연결하는 중이에요 · 곧 열어둘게요');
      } else if (res.error !== 'cancelled') {
        showToast('결제를 끝내지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    }
  });
}
