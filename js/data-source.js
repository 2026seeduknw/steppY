/**
 * SUPABASE_CONFIGURED가 true면(js/supabase-client.js에 URL/키를 채운 경우)
 * 참고 데이터를 Supabase에서 불러와 MOCK.*를 그대로 덮어쓰고 'MOCK:updated' 이벤트를 발생시킵니다.
 *
 * 각 페이지 컨트롤러(js/home.js 등)는 이 이벤트를 듣고 있다가 화면을 다시 그립니다.
 * 설정이 안 돼 있거나 네트워크 오류가 나면 아무것도 하지 않고 mock-data.js 값을
 * 그대로 씁니다 — 데모가 절대 깨지지 않는 걸 우선했습니다.
 *
 * 사용자별 데이터(프로필/지망/즐겨찾기/확정 학교/할일)는 아직 로그인이 없어서
 * 여기서 다루지 않고 계속 js/state.js(localStorage)가 담당합니다.
 *
 * schools 테이블은 실제 2027-1 파견대학 원본(공유용.zip, supabase/build_import.py)
 * 기준이라 mock-data.js가 원래 갖고 있던 일부 필드는 원본에 없습니다. 아래에서
 * 안전한 기본값으로 채우고, 그 한계를 함께 적어둡니다:
 *   - majors(지원 가능 연세대 전공), climateType, reviews, creditRecommend,
 *     wishlistCount, security/climate 텍스트 — 원본에 대응 데이터 없음 → 빈 배열/기본값.
 *     이 때문에 검색 화면의 "전공/기후" 필터는 실제 학교에는 아직 걸리지 않습니다.
 *   - langTest — TOEFL iBT 점수만 원본에 있어 그 값만 사용. 그 외 어학시험(IELTS/JLPT 등)
 *     요건은 language_notes/language_level에 원문 그대로 남아있지만 배지 판정에는 아직 미반영.
 */
(function () {
  if (typeof SUPABASE_CONFIGURED === 'undefined' || !SUPABASE_CONFIGURED) return;

  function coerce(v) {
    if (v === null || v === undefined || v === '') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }

  async function loadSchools() {
    const { data: schools, error } = await supabaseClient.from('schools').select('*');
    if (error || !schools) throw error || new Error('schools fetch failed');

    return schools.map(s => {
      const toeflScore = coerce(s.toefl_ibt);
      const isEnglish = s.track === 'english';
      return {
        id: s.id, lat: s.lat, lng: s.lng,
        scores: {
          security: s.security_score,
          costOfLiving: s.cost_score, commerce: s.commerce_score,
          transitMobility: s.mobility_score, travelMobility: s.travel_mobility_score
        },
        name: s.name, nameKo: s.name_ko || s.name,
        country: s.country_ko || s.country_en, region: s.region_ko || s.continent, city: s.city || '',
        qsRank: s.qs_rank, slot: s.quota, track: s.track,
        langTest: {
          type: isEnglish ? 'TOEFL' : (s.language_level || '현지 어학시험'),
          cut: isEnglish && typeof toeflScore === 'number' ? toeflScore : null
        },
        gpaCut: coerce(s.gpa_required),
        majors: [], seasons: [
          ...(s.spring_available ? ['봄학기'] : []),
          ...(s.fall_available ? ['가을학기'] : [])
        ],
        climate: {},
        security: '치안 점수 데이터 준비 중', securityLevel: undefined,
        access: s.available_areas || '상권 정보 준비 중',
        commerceLevel: s.commerce_score >= 66 ? 'high' : s.commerce_score >= 33 ? 'medium' : s.commerce_score != null ? 'low' : undefined,
        climateType: undefined,
        creditRecommend: [], reviews: [],
        wishlistCount: { rank1: 0, total: 0 },
        officialLink: s.website || s.detail_link || s.factsheet_url || '#',
        mapNote: [s.country_ko, s.city].filter(Boolean).join(' · ') || s.admission_notes || ''
      };
    });
  }

  async function loadChecklist() {
    const { data } = await supabaseClient.from('checklist_items').select('*').order('sort_order');
    return (data || []).map(c => ({
      id: c.id, title: c.title, done: false, dueOffset: c.due_offset,
      source: c.source, updatedAt: c.updated_at || '확인 필요', detail: c.detail
    }));
  }

  async function loadScholarships() {
    const { data } = await supabaseClient.from('scholarships').select('*').order('sort_order');
    return (data || []).map(s => ({ name: s.name, amount: s.amount, eligibility: s.eligibility }));
  }

  async function loadLivingPrep() {
    const { data } = await supabaseClient.from('living_prep').select('*');
    const out = {};
    (data || []).forEach(d => { out[d.key] = { title: d.title, summary: d.summary, caution: d.caution }; });
    return out;
  }

  async function loadCourseMatches() {
    const { data } = await supabaseClient.from('course_matches').select('*');
    return (data || []).map(m => ({
      id: m.id, homeCourse: m.home_course, targetCourse: m.target_course, school: m.school_id,
      similarity: m.similarity, matchedTopics: m.matched_topics || [], note: m.note
    }));
  }

  async function loadTips() {
    const { data } = await supabaseClient.from('tips').select('*');
    return (data || []).map(t => ({ school: t.school_id, title: t.title, summary: t.summary }));
  }

  async function loadNearbySpots() {
    const { data } = await supabaseClient.from('nearby_spots').select('*');
    return (data || []).map(s => ({ school: s.school_id, title: s.title, summary: s.summary }));
  }

  async function loadYonseiMajors() {
    const { data } = await supabaseClient.from('yonsei_majors').select('*').order('sort_order');
    return (data || []).map(m => ({ college: m.college, division: m.division, majorName: m.major_name }));
  }

  Promise.all([
    loadSchools(), loadChecklist(), loadScholarships(),
    loadLivingPrep(), loadCourseMatches(), loadTips(), loadNearbySpots(), loadYonseiMajors()
  ]).then(([schools, checklist, scholarships, livingPrep, courseMatches, tips, nearbySpots, yonseiMajors]) => {
    if (schools.length) MOCK.schools = schools;
    if (checklist.length) MOCK.checklist = checklist;
    if (scholarships.length) MOCK.scholarships = scholarships;
    if (Object.keys(livingPrep).length) MOCK.livingPrep = livingPrep;
    if (courseMatches.length) MOCK.courseMatches = courseMatches;
    if (tips.length) MOCK.tips = tips;
    if (nearbySpots.length) MOCK.nearbySpots = nearbySpots;
    if (yonseiMajors.length) MOCK.yonseiMajors = yonseiMajors;
    document.dispatchEvent(new CustomEvent('MOCK:updated'));
  }).catch(err => {
    console.warn('[data-source] Supabase에서 데이터를 불러오지 못해 mock 데이터를 계속 사용합니다.', err);
  });
})();
