/**
 * mock-data.js의 현재 내용을 supabase/seed.sql로 변환.
 * 실제 시트 데이터로 교체하기 전까지 바로 써볼 수 있는 기본값을 채워줌.
 * 실행: node supabase/generate-seed.js > supabase/seed.sql
 */
const path = require('path');
const MOCK = require(path.join(__dirname, '..', 'js', 'mock-data.js'));

function esc(v) {
  if (v === null || v === undefined) return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function num(v) {
  return v === null || v === undefined ? 'null' : v;
}
function arr(list) {
  if (!list || !list.length) return "'{}'";
  return `ARRAY[${list.map(esc).join(', ')}]`;
}

const lines = [];
lines.push('-- 자동 생성됨: node supabase/generate-seed.js > supabase/seed.sql');
lines.push('-- mock-data.js 기준 시드 데이터 중, 아직 실제 데이터로 대체되지 않은 테이블만 대상.');
lines.push('-- schools/country_prep/yonsei_majors/yonsei_courses는 supabase/build_import.py +');
lines.push('-- supabase/generated/*.json (실제 2027-1 파견대학 원본) 기준으로 별도 적재함.');
lines.push('');

lines.push('insert into checklist_items (id, title, due_offset, source, updated_at, detail, sort_order)');
lines.push('values');
lines.push(MOCK.checklist.map((c, i) => `  (${esc(c.id)}, ${esc(c.title)}, ${esc(c.dueOffset)}, ${esc(c.source)}, ${c.updatedAt === '확인 필요' ? 'null' : esc(c.updatedAt)}, ${esc(c.detail)}, ${i})`).join(',\n'));
lines.push('on conflict (id) do nothing;');
lines.push('');

lines.push('insert into scholarships (name, amount, eligibility, sort_order)');
lines.push('values');
lines.push(MOCK.scholarships.map((s, i) => `  (${esc(s.name)}, ${esc(s.amount)}, ${esc(s.eligibility)}, ${i})`).join(',\n'));
lines.push(';');
lines.push('');

lines.push('insert into living_prep (key, title, summary, caution)');
lines.push('values');
lines.push(Object.entries(MOCK.livingPrep).map(([key, d]) => `  (${esc(key)}, ${esc(d.title)}, ${esc(d.summary)}, ${esc(d.caution)})`).join(',\n'));
lines.push('on conflict (key) do nothing;');
lines.push('');

lines.push('insert into course_matches (id, school_id, home_course, target_course, similarity, matched_topics, note)');
lines.push('values');
lines.push(MOCK.courseMatches.map(m => `  (${esc(m.id)}, ${esc(m.school)}, ${esc(m.homeCourse)}, ${esc(m.targetCourse)}, ${num(m.similarity)}, ${arr(m.matchedTopics)}, ${esc(m.note)})`).join(',\n'));
lines.push('on conflict (id) do nothing;');
lines.push('');

lines.push('insert into tips (school_id, title, summary)');
lines.push('values');
lines.push(MOCK.tips.map(t => `  (${esc(t.school)}, ${esc(t.title)}, ${esc(t.summary)})`).join(',\n'));
lines.push(';');
lines.push('');

lines.push('insert into nearby_spots (school_id, title, summary)');
lines.push('values');
lines.push(MOCK.nearbySpots.map(s => `  (${esc(s.school)}, ${esc(s.title)}, ${esc(s.summary)})`).join(',\n'));
lines.push(';');
lines.push('');

console.log(lines.join('\n'));
