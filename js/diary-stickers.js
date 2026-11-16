/**
 * 다이어리 기본 스티커 — steppY가 직접 그린 SVG라 저작권 걱정 없이 무료로 쓴다.
 * 손으로 그린 느낌(굵은 잉크선 + 크림·주황·하늘 포인트)으로 맞췄다.
 *
 * 페이지에는 { type: 'art', art: 'b:<key>' } 로 저장하고, 그릴 때 url()로 data URL을 만든다.
 * 사용자가 올린 SVG·PNG는 { art: 'u:<id>' } — 이 기기의 "내 스티커"(localStorage)에 들어 있다.
 * 둘 다 <img>로만 그린다 — SVG 안에 스크립트가 있어도 <img> 안에서는 돌지 않는다.
 */
(function (global) {
  const INK = '#22302D', CREAM = '#FFF6DE', ORANGE = '#F08A3C', SKY = '#9CC3D5', RED = '#E35B4F', YELLOW = '#F6D35B', PAPER = '#F4EEDF';
  const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
  const ink = `fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;

  const LIST = [
    { key: 'star', label: '별', r: 1, svg: svg('0 0 120 120',
      `<path d="M60 8 72 44 110 46 80 70 92 108 60 86 28 108 40 70 10 46 48 44Z" fill="#fff" ${ink.replace('fill="none" ', '')}/>`) },
    { key: 'badge', label: '도장', r: 1, svg: svg('0 0 140 140',
      `<circle cx="70" cy="70" r="64" fill="${INK}"/><circle cx="70" cy="70" r="40" fill="${CREAM}"/>` +
      `<path d="M70 44l6 16 17-3-11 13 11 13-17-3-6 16-6-16-17 3 11-13-11-13 17 3z" fill="${INK}"/>` +
      `<defs><path id="c" d="M70 70m-52 0a52 52 0 1 1 104 0a52 52 0 1 1-104 0"/></defs>` +
      `<text font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="2.5" fill="#fff"><textPath href="#c">EXCHANGE · STUDENT · STEPPY ·</textPath></text>`) },
    { key: 'heart', label: '하트', r: 1, svg: svg('0 0 120 110',
      `<path d="M60 100C20 72 8 52 10 34 12 16 30 6 44 10c8 2 13 8 16 14 3-6 8-12 16-14 14-4 32 6 34 24 2 18-10 38-50 66Z" fill="${RED}" ${ink.replace('fill="none" ', '')}/>` +
      `<path d="M28 30c2-6 8-10 14-10" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/>`) },
    { key: 'arrow', label: '화살표', r: 2.2, svg: svg('0 0 60 132',
      `<path d="M30 6c-6 18 8 30 0 48s8 34 0 62" ${ink}/><path d="M14 102l16 22 14-24" ${ink}/>`) },
    { key: 'circle', label: '동그라미', r: 0.45, svg: svg('0 0 220 100',
      `<path d="M30 58C26 30 80 14 128 16s82 18 80 36-46 34-104 32S20 72 40 40c10-14 50-24 92-22" fill="none" stroke="${YELLOW}" stroke-width="6" stroke-linecap="round"/>`) },
    { key: 'tape', label: '마스킹 테이프', r: 0.3, svg: svg('0 0 200 60',
      `<path d="M6 8l8 4-6 6 8 6-6 6 6 6-8 6 6 6-6 6h182l-6-6 8-6-6-6 6-6-8-6 6-6-6-6 8-6-6-6Z" fill="${PAPER}" opacity=".88"/>` +
      `<path d="M20 20h160M20 40h160" stroke="#E2D9C3" stroke-width="2" opacity=".7"/>`) },
    { key: 'tape-orange', label: '주황 테이프', r: 0.3, svg: svg('0 0 200 60',
      `<path d="M6 8l8 4-6 6 8 6-6 6 6 6-8 6 6 6-6 6h182l-6-6 8-6-6-6 6-6-8-6 6-6-6-6 8-6-6-6Z" fill="${ORANGE}" opacity=".85"/>`) },
    { key: 'plane', label: '비행기', r: 0.8, svg: svg('0 0 140 110',
      `<path d="M8 58 128 10 96 98 66 70 46 92 46 62Z" fill="#fff" ${ink.replace('fill="none" ', '')}/><path d="M46 62 128 10M66 70l-20-8" ${ink}/>` +
      `<path d="M12 96c14-4 22-10 28-20" stroke="${INK}" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round" fill="none"/>`) },
    { key: 'ticket', label: '티켓', r: 0.48, svg: svg('0 0 240 116',
      `<path d="M8 8h224v34a16 16 0 0 0 0 32v34H8V74a16 16 0 0 0 0-32Z" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
      `<path d="M176 14v88" stroke="${INK}" stroke-width="3" stroke-dasharray="6 6"/>` +
      `<text x="26" y="52" font-family="Arial Black, Arial, sans-serif" font-size="26" font-weight="900" fill="${INK}">BOARDING</text>` +
      `<text x="26" y="84" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="${ORANGE}">ICN → ✈</text>` +
      `<text x="186" y="66" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="${INK}">27A</text>`) },
    { key: 'postmark', label: '소인', r: 1, svg: svg('0 0 140 140',
      `<circle cx="70" cy="70" r="60" fill="none" stroke="${SKY}" stroke-width="5"/><circle cx="70" cy="70" r="46" fill="none" stroke="${SKY}" stroke-width="2"/>` +
      `<text x="70" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="${SKY}">AIR MAIL</text>` +
      `<text x="70" y="88" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${SKY}">PAR AVION</text>`) },
    { key: 'sparkle', label: '반짝', r: 1, svg: svg('0 0 120 120',
      `<path d="M60 6c4 30 24 50 54 54-30 4-50 24-54 54-4-30-24-50-54-54 30-4 50-24 54-54Z" fill="${YELLOW}" ${ink.replace('fill="none" ', '')}/>`) },
    { key: 'squiggle', label: '밑줄', r: 0.22, svg: svg('0 0 240 52',
      `<path d="M8 30c18-22 30 18 48 0s30-22 48 0 30 18 48 0 30-22 48 0 18 14 32 4" ${ink}/>`) },
    { key: 'clip', label: '클립', r: 2.3, svg: svg('0 0 50 116',
      `<path d="M34 30V86a12 12 0 0 1-24 0V22a18 18 0 0 1 36 0v68" fill="none" stroke="#9AA3A1" stroke-width="5" stroke-linecap="round"/>`) },
    { key: 'cassette', label: '카세트', r: 0.64, svg: svg('0 0 200 128',
      `<rect x="6" y="6" width="188" height="116" rx="12" fill="${INK}"/><rect x="22" y="18" width="156" height="58" rx="6" fill="${CREAM}"/>` +
      `<rect x="22" y="18" width="156" height="14" fill="${ORANGE}"/>` +
      `<circle cx="66" cy="52" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="134" cy="52" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
      `<rect x="84" y="46" width="32" height="12" rx="3" fill="#6B5A4C"/><path d="M50 122l12-30h76l12 30" fill="#3A4744"/>`) },
    { key: 'smile', label: '스마일', r: 1, svg: svg('0 0 120 120',
      `<circle cx="60" cy="60" r="52" fill="${YELLOW}" ${ink.replace('fill="none" ', '')}/><circle cx="44" cy="50" r="6" fill="${INK}"/><circle cx="76" cy="50" r="6" fill="${INK}"/>` +
      `<path d="M38 72c12 16 32 16 44 0" ${ink}/>`) },
    { key: 'flower', label: '꽃', r: 1, svg: svg('0 0 120 120',
      `<g fill="#fff" stroke="${INK}" stroke-width="4">` +
      [0, 72, 144, 216, 288].map(a => `<ellipse cx="60" cy="30" rx="18" ry="24" transform="rotate(${a} 60 60)"/>`).join('') +
      `</g><circle cx="60" cy="60" r="14" fill="${ORANGE}" stroke="${INK}" stroke-width="4"/>`) },
    { key: 'today', label: 'TODAY', r: 0.36, svg: svg('0 0 200 72',
      `<rect x="4" y="4" width="192" height="64" rx="32" fill="${SKY}" stroke="${INK}" stroke-width="4"/>` +
      `<text x="100" y="47" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="30" font-weight="900" fill="${INK}">TODAY!</text>`) },
    { key: 'pin', label: '압정', r: 1.3, svg: svg('0 0 80 104',
      `<circle cx="40" cy="34" r="26" fill="${RED}" stroke="${INK}" stroke-width="4"/><path d="M40 60v38" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="32" cy="26" r="6" fill="#fff" opacity=".7"/>`) }
  ];

  const cache = {};
  function builtinUrl(key) {
    if (cache[key]) return cache[key];
    const s = LIST.find(x => x.key === key);
    if (!s) return '';
    cache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg);
    return cache[key];
  }

  /* ---- 내 스티커(이 기기) ---- */
  const myKey = () => `steppy_stickers_v1_${(typeof Auth !== 'undefined' && Auth.userId) || 'guest'}`;
  function mine() { try { return JSON.parse(localStorage.getItem(myKey()) || '[]') || []; } catch (e) { return []; } }
  function saveMine(list) {
    try { localStorage.setItem(myKey(), JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }
  function addMine(src, ratio) {
    const list = mine();
    const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    list.unshift({ id, src, r: ratio || 1 });
    return saveMine(list) ? list[0] : null;
  }
  function removeMine(id) { saveMine(mine().filter(s => s.id !== id)); }

  /** 'b:star' / 'u:<id>' → 그릴 주소. 지워진 내 스티커는 빈 문자열 */
  function url(art) {
    if (!art) return '';
    if (art.startsWith('b:')) return builtinUrl(art.slice(2));
    if (art.startsWith('u:')) { const s = mine().find(x => x.id === art.slice(2)); return s ? s.src : ''; }
    return '';
  }
  function ratioOf(art) {
    if (art.startsWith('b:')) { const s = LIST.find(x => x.key === art.slice(2)); return s ? s.r : 1; }
    const s = mine().find(x => x.id === art.slice(2)); return s ? s.r : 1;
  }

  global.DiaryStickers = { LIST, url, ratioOf, builtinUrl, mine, addMine, removeMine };
})(window);
