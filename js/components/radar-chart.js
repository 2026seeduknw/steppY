/**
 * 치안 · 물가 · 상권 · 교통 이동성 · 여행 이동성 — 점수화된 백엔드 데이터를
 * 오각형 레이더 차트로 시각화. 점수(0~100)에 따라 도형이 채워지는 형태.
 * (현재는 목업 점수. 실제 백엔드 연동 시 school.scores만 교체하면 됨)
 */
const RADAR_AXES = [
  { key: 'security', label: '치안', icon: '🛡️' },
  { key: 'costOfLiving', label: '물가', icon: '💰' },
  { key: 'commerce', label: '상권', icon: '🏙️' },
  { key: 'transitMobility', label: '교통 이동성', icon: '🚌' },
  { key: 'travelMobility', label: '여행 이동성', icon: '✈️' }
];

function scoreBand(v) {
  if (v >= 80) return { label: '매우 우수', color: 'var(--mint-500)' };
  if (v >= 60) return { label: '양호', color: 'var(--sky-500)' };
  if (v >= 40) return { label: '보통', color: 'var(--amber-700)' };
  return { label: '주의', color: 'var(--coral-500)' };
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** 라벨 호버 시 보여줄 설명. 전문 용어(GPI·Foursquare·정규화 등) 대신
 * 학생이 바로 이해할 수 있는 일상적인 말로 풀어씀. */
const AXIS_TOOLTIPS = {
  security: '이 지역이 얼마나 안전한지 보여주는 점수예요. 외교부 여행경보, 실제 범죄 통계, 세계 평화지수를 참고해서 계산했어요.',
  costOfLiving: '이 도시 물가가 전 세계 기준으로 비싼 편인지 저렴한 편인지 보여주는 점수예요. 점수가 높을수록 물가가 저렴한 도시예요.',
  commerce: '학교 근처에 밥 먹을 곳, 카페, 편의점·마트, 놀거리 같은 게 얼마나 다양하고 많은지 보여주는 점수예요. 점수가 높을수록 학교 주변에서 생활하기 편해요.',
  transitMobility: '학교에서 시내(도심)로 이동하거나 버스·지하철 같은 대중교통을 이용하기 얼마나 편한지 보여주는 점수예요.',
  travelMobility: '교환학생 기간에 다른 나라로 여행 가기 얼마나 쉬운지 보여주는 점수예요. 공항이 가까운지, 기차나 버스로 옆 나라까지 갈 수 있는지를 반영해요.'
};

function axisTooltip(ax) {
  return AXIS_TOOLTIPS[ax.key] || ax.label;
}

function pentPoint(i, frac, cx, cy, R) {
  const angle = (-90 + i * 72) * Math.PI / 180;
  return { x: cx + R * frac * Math.cos(angle), y: cy + R * frac * Math.sin(angle) };
}

function radarChartSvg(scores) {
  const cx = 132, cy = 122, R = 84;

  const rings = [0.25, 0.5, 0.75, 1].map(f => {
    const pts = RADAR_AXES.map((_, i) => pentPoint(i, f, cx, cy, R));
    return `<polygon points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="var(--line-200)" stroke-width="1"/>`;
  }).join('');

  const axisLines = RADAR_AXES.map((_, i) => {
    const p = pentPoint(i, 1, cx, cy, R);
    return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="var(--line-200)" stroke-width="1"/>`;
  }).join('');

  const scorePts = RADAR_AXES.map((ax, i) => pentPoint(i, Math.max(0.05, (scores[ax.key] || 0) / 100), cx, cy, R));
  const polygonFill = `<polygon points="${scorePts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="var(--sky-500)" fill-opacity="0.35" stroke="var(--sky-700)" stroke-width="2" stroke-linejoin="round"/>`;

  const dots = RADAR_AXES.map((ax, i) => {
    const p = scorePts[i];
    const band = scoreBand(scores[ax.key] || 0);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${band.color}" stroke="#fff" stroke-width="1.5"/>`;
  }).join('');

  // 라벨은 "교통 이동성"/"여행 이동성"처럼 긴 텍스트가 있어, 1.34배 반지름에 한 줄로
  // 놓으면 카드 바깥으로 삐져나갔다. 반지름을 1.15배로 줄이고, 공백이 있는 라벨은
  // 두 줄(tspan)로 접어 가로 폭을 좁혀서 카드 안에 들어오게 한다.
  const labels = RADAR_AXES.map((ax, i) => {
    const p = pentPoint(i, 1.15, cx, cy, R);
    const dx = p.x - cx;
    const anchor = Math.abs(dx) < 6 ? 'middle' : (dx > 0 ? 'start' : 'end');
    const parts = ax.label.split(' ');
    const lines = parts.length > 1 ? [`${ax.icon} ${parts[0]}`, parts.slice(1).join(' ')] : [`${ax.icon} ${ax.label}`];
    const tspans = lines.map((line, li) => `<tspan x="${p.x.toFixed(1)}" dy="${li === 0 ? (lines.length > 1 ? '-0.3em' : '0') : '1.15em'}">${line}</tspan>`).join('');
    return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="${anchor}" class="radar-label"><title>${escapeAttr(axisTooltip(ax))}</title>${tspans}</text>`;
  }).join('');

  return `<svg class="radar-chart" viewBox="0 0 264 244" xmlns="http://www.w3.org/2000/svg">${rings}${axisLines}${polygonFill}${dots}${labels}</svg>`;
}

function scoreRowsHtml(scores) {
  return RADAR_AXES.map(ax => {
    const v = scores[ax.key] || 0;
    const band = scoreBand(v);
    return `
      <div class="score-row">
        <span class="score-row__label">${ax.icon} ${ax.label}<span class="score-row__help" title="${escapeAttr(axisTooltip(ax))}">?</span></span>
        <div class="score-row__bar"><div class="score-row__fill" style="width:${v}%; background:${band.color};"></div></div>
        <span class="score-row__value tnum">${v}</span>
        <span class="score-row__band" style="color:${band.color};">${band.label}</span>
      </div>`;
  }).join('');
}

function scoreCardHtml(school, opts) {
  const numbered = !opts || opts.numbered !== false;
  const scores = school.scores || {};
  return `
    <div class="card score-card">
      <div class="section-title">
        <div><h2>${numbered ? '③ ' : ''}생활 점수 인포그래픽</h2></div>
      </div>
      <p class="score-card__note">치안 · 물가 · 상권 · 교통 이동성 · 여행 이동성 5개 지표를 100점 만점으로 점수화했어요. 모두 높을수록 유리해요 (물가는 저렴할수록 높은 점수).</p>
      <div class="score-card__body">
        ${radarChartSvg(scores)}
        <div class="score-rows">${scoreRowsHtml(scores)}</div>
      </div>
    </div>`;
}
