/**
 * 치안 · 물가 · 상권 · 교통 이동성 · 여행 이동성 — 점수화된 백엔드 데이터를
 * 오각형 레이더 차트로 시각화. 점수(0~100)에 따라 도형이 채워지는 형태.
 * (현재는 목업 점수. 실제 백엔드 연동 시 school.scores만 교체하면 됨)
 */
const RADAR_AXES = [
  { key: 'security', label: '치안' },
  { key: 'costOfLiving', label: '물가' },
  { key: 'commerce', label: '상권' },
  { key: 'transitMobility', label: '교통 이동성' },
  { key: 'travelMobility', label: '여행 이동성' }
];

function scoreBand(v) {
  if (v >= 80) return { label: '매우 우수', color: 'var(--mint-500)' };
  if (v >= 60) return { label: '양호', color: 'var(--sky-500)' };
  if (v >= 40) return { label: '보통', color: 'var(--amber-700)' };
  return { label: '주의', color: 'var(--coral-500)' };
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

  const labels = RADAR_AXES.map((ax, i) => {
    const p = pentPoint(i, 1.34, cx, cy, R);
    const dx = p.x - cx;
    const anchor = Math.abs(dx) < 6 ? 'middle' : (dx > 0 ? 'start' : 'end');
    return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="${anchor}" class="radar-label">${ax.label}</text>`;
  }).join('');

  return `<svg class="radar-chart" viewBox="0 0 264 244" xmlns="http://www.w3.org/2000/svg">${rings}${axisLines}${polygonFill}${dots}${labels}</svg>`;
}

function scoreRowsHtml(scores) {
  return RADAR_AXES.map(ax => {
    const v = scores[ax.key] || 0;
    const band = scoreBand(v);
    return `
      <div class="score-row">
        <span class="score-row__label">${ax.label}</span>
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
