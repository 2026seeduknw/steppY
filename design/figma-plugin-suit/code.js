// steppY 시안의 한글 글자를 SUIT로 바꾼다(영문·숫자 Manrope는 그대로).
// 직접 붙여넣은 레퍼런스 섹션(2:122)과 휴지통(54:56)은 건드리지 않는다.
// 글자 상자 하나에서 오류가 나도 멈추지 않고 넘어가며, 끝나면 바꾼 수와 첫 오류를 알려 준다.
(async () => {
  try {
    const SKIP = new Set(['2:122', '54:56']);
    figma.notify('1/4 글꼴 목록 읽는 중', { timeout: 3000 });
    const fonts = await figma.listAvailableFontsAsync();
    const suit = fonts.filter(f => /^SUIT$/i.test(f.fontName.family));
    if (!suit.length) { figma.closePlugin('SUIT 글꼴을 찾지 못했어요. 설치 후 Figma를 다시 켜 주세요.'); return; }
    const family = suit[0].fontName.family;
    const styles = new Set(suit.map(f => f.fontName.style));
    const ORDER = ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Heavy'];
    const want = { Thin: 'Thin', ExtraLight: 'ExtraLight', Light: 'Light', Regular: 'Regular', Medium: 'Medium', SemiBold: 'SemiBold', Bold: 'Bold', ExtraBold: 'ExtraBold', Black: 'Heavy' };
    const pick = (style) => {
      const w = want[style] || 'Regular';
      if (styles.has(w)) return w;
      const i = ORDER.indexOf(w);
      for (let d = 1; d < 9; d++) for (const j of [i - d, i + d]) if (ORDER[j] && styles.has(ORDER[j])) return ORDER[j];
      return [...styles][0];
    };
    figma.notify(`2/4 ${family} ${styles.size}개 굵기 불러오는 중`, { timeout: 3000 });
    for (const s of styles) await figma.loadFontAsync({ family, style: s });
    figma.notify('3/4 Noto Sans KR 불러오는 중', { timeout: 3000 });
    // 한글 쪽 원래 글꼴(Noto Sans KR)의 굵기들도 미리 불러 둔다 — 범위를 고치려면 기존 글꼴이 로드돼 있어야 한다
    const notoUsed = new Set(['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black', 'Light', 'Thin', 'ExtraLight']);
    for (const f of fonts.filter(f => f.fontName.family === 'Noto Sans KR' && notoUsed.has(f.fontName.style))) { try { await figma.loadFontAsync(f.fontName); } catch (e) { /* 없는 굵기는 건너뛴다 */ } }
    figma.notify('4/4 글자 상자 바꾸는 중', { timeout: 3000 });

    const texts = [];
    for (const top of figma.currentPage.children) {
      if (SKIP.has(top.id)) continue;
      if (top.type === 'TEXT') texts.push(top);
      else if ('findAll' in top) texts.push(...top.findAll(n => n.type === 'TEXT'));
    }
    let changed = 0, nodes = 0, errors = 0, firstErr = '';
    for (let k = 0; k < texts.length; k++) {
      const t = texts[k];
      try {
        const segs = t.getStyledTextSegments(['fontName']).filter(s => s.fontName.family === 'Noto Sans KR');
        if (!segs.length) continue;
        for (const s of segs) {
          // 다른 글꼴(Manrope 등)이 섞인 상자는 그 글꼴도 로드돼 있어야 해서 상자 전체 글꼴을 먼저 불러 둔다
          for (const f of t.getStyledTextSegments(['fontName'])) await figma.loadFontAsync(f.fontName);
          t.setRangeFontName(s.start, s.end, { family, style: pick(s.fontName.style) });
          changed++;
        }
        nodes++;
      } catch (e) {
        errors++;
        if (!firstErr) firstErr = `${t.name}: ${e && e.message ? e.message : e}`;
      }
      if (k % 300 === 0) figma.notify(`한글 → SUIT 바꾸는 중 ${k}/${texts.length}`, { timeout: 1500 });
    }
    figma.closePlugin(`한글 ${changed}곳(글자 상자 ${nodes}개)을 ${family}로 바꿨어요.${errors ? ` 오류 ${errors}개 — ${firstErr}` : ''}`);
  } catch (e) {
    figma.closePlugin('오류: ' + (e && e.message ? e.message : e));
  }
})();
