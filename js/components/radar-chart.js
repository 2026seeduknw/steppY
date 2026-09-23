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

/**
 * 각 지표를 "어떻게 계산했는지".
 *
 * 문구를 지어내지 않았다 — supabase의 livability_column_definitions /
 * livability_methodology_notes에 적힌 산식·출처를 그대로 옮긴 것이다.
 * (그 테이블들은 클라이언트가 읽지 않아 RLS로 잠가 뒀다. 산식이 바뀌면 여기도
 *  같이 고쳐야 한다.)
 *
 * 치안만 예외다. 위 두 테이블에 치안 항목이 없어서, js/data-source.js가 명시한
 * 출처(외교부 여행경보 · Numbeo · GPI)까지만 적고 세부 가중치는 "기록 없음"으로
 * 밝힌다. 모르는 걸 아는 척하지 않는 편이 낫다.
 */
/**
 * ? 를 눌렀을 때 펼쳐지는 설명.
 *
 * 산식은 싣지 않는다. 가중치나 환산식을 적어두면 정확해 보이지만, 읽는 사람이
 * 그걸로 검산할 것도 아니고 원본 데이터가 바뀌면 제일 먼저 틀리는 부분이다.
 * 대신 "무엇이 들어갔는지"와 "어느 쪽이 높은 점수인지"만 적는다 — 점수를 읽고
 * 학교를 비교하는 데 실제로 필요한 건 그 둘이다.
 */
const AXIS_HELP = {
  security: {
    what: '이 지역이 얼마나 안전한지 보는 0~100 점수예요.',
    factors: [
      '외교부 여행경보 — 경보 단계가 낮을수록 높은 점수',
      'Numbeo 범죄 지수 — 체감 범죄가 적을수록 높은 점수',
      '세계평화지수(GPI) — 국가가 평화로울수록 높은 점수'
    ],
    source: '외교부 · Numbeo · GPI',
    caveat: '세 자료를 어떤 비중으로 합쳤는지는 원본 데이터에 기록돼 있지 않아요.'
  },
  costOfLiving: {
    what: '이 도시가 전 세계 도시 중 저렴한 편인지 보는 점수예요.',
    factors: [
      'LivingCost의 도시 생활비 글로벌 랭킹 — 생활비가 저렴한 도시일수록 높은 점수'
    ],
    source: 'LivingCost.org'
  },
  commerce: {
    what: '학교 주변에서 먹고 사고 노는 게 얼마나 편한지 보는 점수예요.',
    factors: [
      '학교에서 가까운 생활권일수록 크게 반영 — 1km 안이 3km 안보다 중요',
      '장소가 많을수록, 종류가 다양할수록 높은 점수',
      '종류별 중요도는 생활필수 > 음식·카페 > 쇼핑·서비스 > 여가시설 순',
      '점수는 전체 학교와 견줘 매겨요'
    ],
    source: 'Foursquare Places API',
    caveat: '검색 결과가 50개로 제한돼서, 아주 번화한 지역은 실제보다 낮게 나올 수 있어요.'
  },
  transitMobility: {
    what: '학교에서 일상적으로 이동하기 얼마나 편한지 보는 점수예요.',
    factors: [
      '도심 접근성 — 대중교통으로 시내까지 걸리는 시간이 짧을수록 높은 점수',
      '대중교통 거점 — 학교 1km 안에 정류장이 많을수록 높은 점수'
    ],
    source: 'TravelTime · Transitland'
  },
  travelMobility: {
    what: '교환학생 기간에 다른 나라로 여행 가기 얼마나 쉬운지 보는 점수예요.',
    factors: [
      '공항 접근성 — 가까운 공항까지 거리가 짧을수록 높은 점수',
      '인접국 접근성 — 가장 가까운 다른 나라가 가까울수록 높은 점수'
    ],
    source: 'LivingCost · Natural Earth'
  }
};

/** 차트 위 라벨에 붙는 짧은 설명(SVG <title>). 무엇이 반영됐는지는 ? 를 누르면 펼쳐진다. */
function axisTooltip(ax) {
  const h = AXIS_HELP[ax.key];
  return h ? h.what : ax.label;
}

function axisHelpHtml(ax) {
  const h = AXIS_HELP[ax.key];
  if (!h) return '';
  return `
    <div class="score-detail" id="scoreHelp-${ax.key}" hidden>
      <p class="score-detail__what">${h.what}</p>
      <p class="score-detail__how"><strong>무엇을 보나요</strong></p>
      <ul class="score-detail__factors">
        ${h.factors.map(f => `<li>${f}</li>`).join('')}
      </ul>
      ${h.caveat ? `<p class="score-detail__caveat">${h.caveat}</p>` : ''}
      <p class="score-detail__source">출처 · ${h.source}</p>
    </div>`;
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

/**
 * 지표별 "그래서 실제로 어떤데" 한 줄.
 *
 * 점수(0~100)는 271개 파견교끼리 견준 상대값이라, 82라는 숫자만 봐서는 그 동네가
 * 어떤 곳인지 알 수 없다. school_livability_score_basis 에 점수를 만들기 전의
 * 원자료가 남아 있으므로(도심까지 몇 분, 공항까지 몇 km, 상권 몇 곳) 그걸 그대로
 * 옮긴다 — 학교 둘을 놓고 고를 때 실제로 비교하게 되는 건 이 값들이다.
 *
 * 근거가 없는 지표(치안)나 원자료가 없는 학교는 빈 문자열을 돌려주고, 그때는
 * 점수 막대만 남는다.
 */
function scoreEvidence(key, school) {
  const b = school && school.scoreBasis;
  if (!b) return '';
  const km = (t) => t && t.replace(/\s*([0-9.]+)km$/, ' $1km');

  if (key === 'costOfLiving' && b.cost && b.cost.rank && b.cost.total) {
    // 랭킹 1위가 가장 비싼 도시다. 등수를 그대로 읽으면 방향을 헷갈리니 백분율로 바꾼다.
    const pct = Math.max(1, Math.round(b.cost.rank / b.cost.total * 100));
    const side = pct <= 50 ? `비싼 쪽 상위 ${pct}%` : `저렴한 쪽 상위 ${100 - pct}%`;
    return `전 세계 ${b.cost.total.toLocaleString('ko-KR')}개 도시 중 ${side}`;
  }
  if (key === 'commerce' && b.commerce && b.commerce.within3km != null) {
    const parts = [`학교 3km 안에 ${b.commerce.within3km}곳`];
    if (b.commerce.within1km != null) parts.push(`그중 1km 안 ${b.commerce.within1km}곳`);
    if (b.commerce.food != null) parts.push(`음식·카페 ${b.commerce.food}곳`);
    return parts.join(' · ');
  }
  if (key === 'transitMobility' && b.transit && b.transit.downtownMin != null) {
    const parts = [`도심까지 대중교통 ${Math.round(b.transit.downtownMin)}분`];
    if (b.transit.stops != null) parts.push(`1km 안 정류장 ${Math.round(b.transit.stops)}곳`);
    return parts.join(' · ');
  }
  if (key === 'travelMobility' && b.travel && (b.travel.airport || b.travel.nearestCountry)) {
    const parts = [];
    if (b.travel.airport) parts.push(`가까운 공항 ${km(b.travel.airport)}`);
    if (b.travel.nearestCountry) parts.push(`가장 가까운 다른 나라 ${km(b.travel.nearestCountry)}`);
    return parts.join(' · ');
  }
  if (key === 'security') {
    return '외교부 여행경보 · Numbeo 범죄지수 · 세계평화지수를 합친 값';
  }
  return '';
}

function scoreRowsHtml(scores, school) {
  return RADAR_AXES.map(ax => {
    const hasData = typeof scores[ax.key] === 'number';
    const v = scores[ax.key] || 0;
    const band = scoreBand(v);
    const evidence = hasData ? scoreEvidence(ax.key, school) : '';
    return `
      <div class="score-row">
        <span class="score-row__label">${ax.icon} ${ax.label}<button type="button" class="score-row__help"
              data-score-help="${ax.key}" aria-expanded="false" aria-controls="scoreHelp-${ax.key}"
              aria-label="${escapeAttr(ax.label)} 점수 계산 방법">?</button></span>
        <div class="score-row__bar"><div class="score-row__fill" style="width:${v}%; background:${band.color};"></div></div>
        <span class="score-row__band" style="color:${band.color};">${hasData ? band.label : '자료 없음'}</span>
      </div>
      ${evidence ? `<p class="score-row__evidence">${evidence}</p>` : ''}
      ${axisHelpHtml(ax)}`;
  }).join('');
}

function scoreCardHtml(school, opts) {
  const numbered = !opts || opts.numbered !== false;
  const scores = school.scores || {};
  return `
    <div class="card score-card">
      <div class="section-title">
        <div><h2>${numbered && typeof schoolPlaceLabel === 'function'
          ? `How is ${schoolPlaceLabel(school)}?`
          : '살기 어떤 곳인가'}</h2></div>
      </div>
      <p class="score-card__note">막대가 길수록 다른 파견교보다 좋다는 뜻이에요. 막대 아래 한 줄은 그 막대가 나온 실제 숫자고요.</p>
      <div class="score-card__body">
        ${radarChartSvg(scores)}
        <div class="score-rows">${scoreRowsHtml(scores, school)}</div>
      </div>
    </div>`;
}


/**
 * ? 를 누르면 그 지표의 계산 방법을 펼친다.
 *
 * 예전에는 title 속성 툴팁이었는데, 터치 기기에서는 title이 아예 뜨지 않아
 * 모바일에서 물음표가 눌러도 아무 일이 없는 장식이었다.
 *
 * 카드가 학교 상세 모달과 교환 준비 화면 양쪽에서 다시 그려지므로, 각 호출부에
 * 배선하지 않고 document에 한 번만 위임한다.
 */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-score-help]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const panel = document.getElementById(`scoreHelp-${btn.dataset.scoreHelp}`);
  if (!panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  btn.classList.toggle('is-open', open);
});
