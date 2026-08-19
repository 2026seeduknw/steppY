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
 *     wishlistCount, climate 텍스트 — 원본에 대응 데이터 없음 → 빈 배열/기본값.
 *     (security는 2027-1_치안.xlsx 반영 후 security_score/security_level로 채워짐)
 *     이 때문에 검색 화면의 "전공/기후" 필터는 실제 학교에는 아직 걸리지 않습니다.
 *   - langTest — TOEFL iBT 점수만 원본에 있어 그 값만 사용. 그 외 어학시험(IELTS/JLPT 등)
 *     요건은 language_notes/language_level에 원문 그대로 남아있지만 배지 판정에는 아직 미반영.
 */
(function () {
  if (typeof SUPABASE_CONFIGURED === 'undefined' || !SUPABASE_CONFIGURED) return;

  const SECURITY_TEXT = {
    high: '치안 양호 — Numbeo·GPI·외교부 여행경보 종합 기준',
    medium: '치안 보통 — Numbeo·GPI·외교부 여행경보 종합 기준',
    low: '치안 주의 — Numbeo·GPI·외교부 여행경보 종합 기준'
  };

  function coerce(v) {
    if (v === null || v === undefined || v === '') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }

  /** 학교의 봄/가을학기별로 온도·기후노트·한국식 비유를 한 문장으로 합쳐 school.climate에 채움 */
  function buildClimateText(s) {
    const parts = [];
    if (s.climate_notes) parts.push(s.climate_notes);
    if (s.korea_comparison) parts.push(s.korea_comparison);
    if (!parts.length) return null;
    return parts.join(' · ');
  }

  const HOUSING_LABEL = { Yes: '기숙사 보장', Partial: '기숙사 부분 보장', No: '기숙사 미보장' };

  async function loadSchools() {
    const { data: schools, error } = await supabaseClient.from('schools').select('*');
    if (error || !schools) throw error || new Error('schools fetch failed');

    return schools.map(s => {
      const toeflScore = coerce(s.toefl_ibt);
      const isEnglish = s.track === 'english';
      const climateText = buildClimateText(s);
      const seasons = [
        ...(s.spring_available ? ['봄학기'] : []),
        ...(s.fall_available ? ['가을학기'] : [])
      ];
      return {
        id: s.id, lat: s.lat, lng: s.lng,
        scores: {
          security: coerce(s.security_score),
          costOfLiving: s.cost_score, commerce: s.commerce_score,
          transitMobility: s.mobility_score, travelMobility: s.travel_mobility_score
        },
        name: s.name, nameKo: s.name_ko || s.name,
        country: s.country_ko || s.country_en, countryEn: s.country_en,
        region: s.region_ko || s.continent, city: s.city || '',
        qsRank: s.qs_rank, slot: s.quota, track: s.track,
        langTest: {
          type: isEnglish ? 'TOEFL' : (s.language_level || '현지 어학시험'),
          cut: isEnglish && typeof toeflScore === 'number' ? toeflScore : null
        },
        gpaCut: coerce(s.gpa_required),
        majors: [], seasons,
        climate: seasons.length && climateText
          ? Object.fromEntries(seasons.map(season => [season, climateText]))
          : {},
        tempBySeason: {
          spring: coerce(s.temp_spring_c), summer: coerce(s.temp_summer_c),
          autumn: coerce(s.temp_autumn_c), winter: coerce(s.temp_winter_c)
        },
        housing: {
          guaranteed: s.housing_guaranteed || null,
          guaranteedLabel: HOUSING_LABEL[s.housing_guaranteed] || null,
          info: s.housing_info || null,
          currency: s.dorm_currency || null,
          priceLocal: coerce(s.dorm_semester_avg_local),
          priceKrw: coerce(s.dorm_semester_avg_krw),
          confidence: s.dorm_confidence || null
        },
        security: SECURITY_TEXT[s.security_level] || '치안 점수 데이터 준비 중', securityLevel: s.security_level || undefined,
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

  const DOC_SOURCE_LABEL = { OFFICIAL_WEBSITE: '학교 공식 홈페이지', OIA_DETAIL: '연세대 국제처 파견교 안내' };

  /** school_document_requirements + school_documents → school.id 기준 필요서류 맵 */
  async function loadSchoolDocuments() {
    const [{ data: reqs }, { data: docs }] = await Promise.all([
      supabaseClient.from('school_document_requirements').select('*'),
      supabaseClient.from('school_documents').select('*').order('sort_order')
    ]);
    const out = {};
    (reqs || []).forEach(r => {
      out[r.school_id] = {
        sourceType: r.source_type, sourceLabel: DOC_SOURCE_LABEL[r.source_type] || r.source_type,
        sourceUrl: r.source_url, hasHintData: !!r.has_hint_data,
        hintDisclaimer: r.hint_disclaimer, baseline: [], hint: []
      };
    });
    (docs || []).forEach(d => {
      if (!out[d.school_id]) {
        out[d.school_id] = {
          sourceType: d.source_type, sourceLabel: DOC_SOURCE_LABEL[d.source_type] || d.source_type,
          sourceUrl: d.source_url, hasHintData: false, hintDisclaimer: null, baseline: [], hint: []
        };
      }
      const bucket = d.document_type === 'hint' ? out[d.school_id].hint : out[d.school_id].baseline;
      bucket.push(d.document_name);
    });
    return out;
  }

  /** visa_requirements + visa_documents → country_en 기준 비자서류 맵 */
  async function loadVisaData() {
    const [{ data: reqs }, { data: docs }] = await Promise.all([
      supabaseClient.from('visa_requirements').select('*'),
      supabaseClient.from('visa_documents').select('*')
    ]);
    const out = {};
    (reqs || []).forEach(r => {
      out[r.country_en] = {
        status: r.status, statusLabel: r.status_label_ko, documentCount: r.document_count,
        exclusionReason: r.exclusion_reason, documents: []
      };
    });
    (docs || []).forEach(d => {
      if (!out[d.country_en]) out[d.country_en] = { status: null, statusLabel: null, documentCount: 0, exclusionReason: null, documents: [] };
      out[d.country_en].documents.push({ name: d.raw_name, standardType: d.standard_type, sourceUrl: d.source_url, sourceQuote: d.source_quote });
    });
    return out;
  }

  /** country_prep + country_prep_steps → country_en 기준 생활 준비(통신/보험/계좌) 맵 */
  async function loadCountryPrep() {
    const [{ data: prep }, { data: steps }] = await Promise.all([
      supabaseClient.from('country_prep').select('*'),
      supabaseClient.from('country_prep_steps').select('*')
    ]);
    const out = {};
    (prep || []).forEach(p => {
      out[p.country_en] = {
        countryKo: p.country_ko, dispatchSchoolCount: p.dispatch_school_count,
        telecom: { recommend: p.telecom_recommend, price: p.telecom_price, note: p.telecom_note, source: p.telecom_source },
        insurance: { name: p.insurance, price: p.insurance_price, note: p.insurance_note, source: p.insurance_source },
        bank: { recommend: p.bank_recommend, accountDocs: p.account_docs, source: p.bank_note_source },
        confidenceGrade: p.confidence_grade, steps: []
      };
    });
    (steps || []).forEach(s => {
      if (!out[s.country_en]) out[s.country_en] = { countryKo: s.country_ko, dispatchSchoolCount: null, telecom: {}, insurance: {}, bank: {}, confidenceGrade: s.confidence_grade, steps: [] };
      out[s.country_en].steps.push({ step: s.step, timing: s.timing, requiredDocs: s.required_docs, place: s.place, caution: s.caution, source: s.source });
    });
    return out;
  }

  Promise.all([
    loadSchools(), loadChecklist(), loadScholarships(),
    loadLivingPrep(), loadCourseMatches(), loadTips(), loadNearbySpots(), loadYonseiMajors(),
    loadSchoolDocuments(), loadVisaData(), loadCountryPrep()
  ]).then(([schools, checklist, scholarships, livingPrep, courseMatches, tips, nearbySpots, yonseiMajors,
            schoolDocuments, visaByCountry, countryPrepByCountry]) => {
    if (schools.length) MOCK.schools = schools;
    if (checklist.length) MOCK.checklist = checklist;
    if (scholarships.length) MOCK.scholarships = scholarships;
    if (Object.keys(livingPrep).length) MOCK.livingPrep = livingPrep;
    if (courseMatches.length) MOCK.courseMatches = courseMatches;
    if (tips.length) MOCK.tips = tips;
    if (nearbySpots.length) MOCK.nearbySpots = nearbySpots;
    if (yonseiMajors.length) MOCK.yonseiMajors = yonseiMajors;
    if (Object.keys(schoolDocuments).length) MOCK.schoolDocuments = schoolDocuments;
    if (Object.keys(visaByCountry).length) MOCK.visaByCountry = visaByCountry;
    if (Object.keys(countryPrepByCountry).length) MOCK.countryPrepByCountry = countryPrepByCountry;
    document.dispatchEvent(new CustomEvent('MOCK:updated'));
  }).catch(err => {
    console.warn('[data-source] Supabase에서 데이터를 불러오지 못해 mock 데이터를 계속 사용합니다.', err);
  });
})();
