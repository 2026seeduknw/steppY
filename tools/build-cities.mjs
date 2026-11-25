/**
 * 사진 위치 → 도시 이름을 휴대폰 안에서 찾기 위한 도시 목록(assets/geo/cities.tsv)을 만든다.
 *
 * 왜 필요한가
 *   예전에는 사진 좌표를 BigDataCloud 무료 API로 보내 도시 이름을 받았다. 그런데 그 API는
 *   "기기의 지금 위치"에만 쓰라고 되어 있고 저장된 좌표(사진 좌표)는 보내지 말라고 한다.
 *   또 정확한 좌표가 사용자 IP와 함께 외부로 나간다. 그래서 도시 목록을 앱에 넣고,
 *   가장 가까운 도시를 기기 안에서 계산한다(js/nearest-city.js). 좌표는 밖으로 나가지 않는다.
 *
 * 원본
 *   GeoNames cities5000 — 인구 5,000명 이상 도시와 모든 수도. CC BY 4.0(출처 표시 필요).
 *   https://download.geonames.org/export/dump/cities5000.zip
 *   교환 학교가 있는 작은 대학 도시(예: 미국 Geneva NY 1.3만 명)까지 잡으려고 15000이 아니라 5000을 쓴다.
 *
 * 쓰는 법
 *   curl -o tools/out/cities5000.zip https://download.geonames.org/export/dump/cities5000.zip
 *   (압축을 풀어 cities5000.txt 를 만든 뒤)
 *   node tools/build-cities.mjs tools/out/cities5000.txt
 *
 * 줄이는 것
 *   - 이름은 GeoNames 기본 이름(name) 하나만. 큰 도시는 대개 영어 이름(Munich, Vienna)이다.
 *   - 좌표는 소수 둘째 자리(약 1km)까지. 도시 중심이라 그 이상은 의미가 없다.
 *   - 이름은 현지 표기 그대로 둔다(Zürich, Köln). 영어 이름표는 언어 표시가 있는 별도 원본(수백 MB)이 필요하다.
 *   - 인구는 천 명 단위. 도시 "크기"(반경)를 어림하는 데만 쓴다.
 *   - 도시의 한 구역(PPLX: 맨해튼·브루클린 같은 동네)과 사라진 곳(PPLH·PPLQ·PPLW)은 뺀다 —
 *     기록에는 "New York City"처럼 도시 이름이 남아야 한다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('사용법: node tools/build-cities.mjs <cities5000.txt 경로>');
  process.exit(1);
}

const SKIP_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);
const text = await readFile(input, 'utf8');
const rows = [];
for (const line of text.split('\n')) {
  if (!line) continue;
  const c = line.split('\t');
  // 0 id · 1 name · 4 lat · 5 lng · 6 class · 7 code · 8 country · 14 population
  if (c[6] !== 'P' || SKIP_CODES.has(c[7])) continue;
  const name = c[1].replace(/[\t\r\n]/g, ' ').trim();
  const cc = c[8];
  const lat = Number(c[4]), lng = Number(c[5]);
  if (!name || !/^[A-Z]{2}$/.test(cc) || !isFinite(lat) || !isFinite(lng)) continue;
  const popK = Math.max(1, Math.round(Number(c[14] || 0) / 1000));
  rows.push([name, cc, String(+lat.toFixed(2)), String(+lng.toFixed(2)), popK]);
}
// 번호가 붙은 구역(Paris 16 Passy, Lyon 03, Marseille 08)은 PPLX가 아니라 PPL로 들어 있다 —
// 같은 나라 30km 안에 앞부분 이름(Paris)과 똑같은 더 큰 도시가 있으면 그 도시의 구역으로 보고 뺀다
const byKey = new Map();
rows.forEach(r => { const k = `${r[0]}|${r[1]}`; if (!byKey.has(k) || byKey.get(k)[4] < r[4]) byKey.set(k, r); });
const kmBetween = (a, b) => {
  const x = (b[3] - a[3]) * Math.cos(((+a[2] + +b[2]) / 2) * Math.PI / 180), y = b[2] - a[2];
  return Math.sqrt(x * x + y * y) * 111.2;
};
const isSection = (r) => {
  const m = /^(.+?) \d{1,2}(?:e|er)?(?: |$)/.exec(r[0]);
  if (!m) return false;
  const parent = byKey.get(`${m[1]}|${r[1]}`);
  return !!parent && parent !== r && parent[4] > r[4] && kmBetween(r, parent) <= 30;
};
const sections = rows.filter(isSection);
for (const s of sections) rows.splice(rows.indexOf(s), 1);
console.log(`번호 붙은 구역 ${sections.length}개 뺌 (예: ${sections.slice(0, 3).map(s => s[0]).join(', ')})`);

// 큰 도시가 앞에 오게 — 같은 거리면 먼저 찾힌 큰 도시가 남는다
rows.sort((a, b) => b[4] - a[4]);

const header = '# steppY cities — GeoNames cities5000 (https://www.geonames.org, CC BY 4.0). name\tcountry\tlat\tlng\tpopulation(천 명)';
const out = [header, ...rows.map(r => r.join('\t'))].join('\n') + '\n';
const dest = join(ROOT, 'assets', 'geo', 'cities.tsv');
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, out);
console.log(`assets/geo/cities.tsv — 도시 ${rows.length}개, ${(out.length / 1024).toFixed(0)} KB`);
