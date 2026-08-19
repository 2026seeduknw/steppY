/**
 * 원형 진행률 게이지. radar-chart.js와 같은 방식으로 라이브러리 없이
 * SVG 문자열을 직접 생성함. stroke-dasharray로 진행률(0~100)을 표현.
 */
function progressRingSvg(percent, opts) {
  const { size = 56, stroke = 6, color = 'var(--sky-500)', track = 'var(--cloud-100)' } =
    opts || {};
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  return `<svg class="progress-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>
  </svg>`;
}

function progressRingHtml(percent, opts) {
  const size = (opts && opts.size) || 56;
  return `<div class="progress-ring-wrap" style="width:${size}px;height:${size}px;">
    ${progressRingSvg(percent, opts)}
    <span class="progress-ring__label">${Math.round(percent)}%</span>
  </div>`;
}
