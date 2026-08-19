/**
 * SUPABASE_CONFIGURED가 true면(js/supabase-client.js에 URL/키를 채운 경우)
 * 참고 데이터를 Supabase에서 불러와 MOCK.*를 그대로 덮어쓰고 'MOCK:updated' 이벤트를 발생시킵니다.
 *
 * 각 페이지 컨트롤러(js/home.js 등)는 이 이벤트를 듣고 있다가 화면을 다시 그립니다.
 * mock-data.js는 더 이상 목업 콘텐츠를 갖고 있지 않습니다 — 설정이 안 돼 있거나
 * 네트워크 오류가 나면 해당 컬렉션은 빈 배열/객체인 채로 남고, 각 페이지의 빈 상태
 * UI(예: "아직 등록된 정보가 없어요")가 그대로 보입니다.
 *
 * 사용자별 데이터(프로필/지망/즐겨찾기/확정 학교/할일)는 아직 로그인이 없어서
 * 여기서 다루지 않고 계속 js/state.js(localStorage)가 담당합니다.
 *
 * schools 테이블은 실제 2027-1 파견대학 원본(공유용.zip, supabase/build_import.py)
 * 기준이라 mock-data.js가 원래 갖고 있던 일부 필드는 원본에 없습니다. 아래에서
 * 안전한 기본값으로 채우고, 그 한계를 함께 적어둡니다:
 *   - majors(지원 가능 연세대 전공), wishlistCount —
 *     원본에 대응 데이터 없음 → 빈 배열/기본값(wishlistCount는 시드 기반 데모 숫자).
 *     (security는 2027-1_치안.xlsx 반영 후 security_score/security_level로 채워짐.
 *      climate/climateType는 climate_staging 테이블의 계절별 실측 평균기온으로 채워짐 —
 *      climateType은 그 기온으로부터 파생 분류한 값이라 원본에 직접 있는 필드는 아님)
 *     이 때문에 검색 화면의 "전공" 필터는 실제 학교에는 아직 걸리지 않습니다.
 *   - creditRecommend/reviews는 school 객체가 아니라 각 컴포넌트가
 *     MOCK.majorMatches/MOCK.schoolReviews를 school.id로 직접 필터링해 채웁니다 —
 *     학교(x전공) 조합별로 달라지는 값이라 school 객체 자체에는 넣지 않습니다.
 *   - langTest — TOEFL iBT 컷은 영어 트랙에만 있어 그 값만 배지 판정(langTest.cut)에 사용.
 *     비영어 트랙은 language_level/language_notes를 langTest.level/notes로 그대로 노출해
 *     school-modal.js가 별도 배지로 보여줌(원본 자체가 B2/HSK6처럼 다양해 자동 판정은 안 함).
 *   - housing — housing_guaranteed('Yes'|'No'|'Partial'|null)/housing_info 그대로 노출.
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

  // 지망 통계는 원본 데이터에 대응 항목이 없어 학교별로 값이 고정되는
  // 시드 기반 데모 숫자를 생성한다(매 새로고침마다 값이 안 바뀌도록).
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  function mockWishlistCount(id, qsRank) {
    const seed = hashSeed(id);
    const seed2 = hashSeed(id + ':total');
    const prestige = qsRank ? Math.max(0, 1 - qsRank / 800) : 0.3;
    const rank1 = Math.round((seed * 0.6 + prestige * 0.4) * 14);
    const extra = Math.round(seed2 * 22);
    return { rank1, total: rank1 + extra };
  }

  const SEASON_TEMP_COLS = [
    ['봄학기', 'temp_spring_c'], ['여름학기', 'temp_summer_c'],
    ['가을학기', 'temp_autumn_c'], ['겨울학기', 'temp_winter_c']
  ];

  /** 4계절 평균기온으로부터 대략적인 기후 유형을 분류(실측 기온 기반 파생값). */
  function climateTypeFromTemps(c) {
    const spring = coerce(c.temp_spring_c), summer = coerce(c.temp_summer_c);
    const autumn = coerce(c.temp_autumn_c), winter = coerce(c.temp_winter_c);
    if ([spring, summer, autumn, winter].some(v => typeof v !== 'number')) return undefined;
    if (winter < 0) return 'cold';
    if (Math.min(spring, summer, autumn, winter) >= 18) return 'hot';
    if (winter < 5 && summer > 22) return 'four-season';
    return 'mild-winter';
  }

  async function loadSchools() {
    const [{ data: schools, error }, { data: climateRows }] = await Promise.all([
      supabaseClient.from('schools').select('*'),
      supabaseClient.from('climate_staging').select('*')
    ]);
    if (error || !schools) throw error || new Error('schools fetch failed');
    const climateBySchool = {};
    (climateRows || []).forEach(c => { if (c.school_id) climateBySchool[c.school_id] = c; });

    return schools.map(s => {
      const c = climateBySchool[s.id];
      const climate = {};
      if (c) {
        SEASON_TEMP_COLS.forEach(([season, col]) => {
          const t = coerce(c[col]);
          if (typeof t === 'number') {
            climate[season] = `평균 ${t}°C` + (c.climate_notes ? `. ${c.climate_notes}` : '');
          }
        });
      }
      const toeflScore = coerce(s.toefl_ibt);
      const isEnglish = s.track === 'english';
      return {
        id: s.id, lat: s.lat, lng: s.lng,
        scores: {
          security: coerce(s.security_score),
          costOfLiving: s.cost_score, commerce: s.commerce_score,
          transitMobility: s.mobility_score, travelMobility: s.travel_mobility_score
        },
        name: s.name, nameKo: s.name_ko || s.name,
        country: s.country_ko || s.country_en, countryEn: s.country_en, region: s.region_ko || s.continent, city: s.city || '',
        qsRank: s.qs_rank, slot: s.quota, track: s.track,
        langTest: {
          type: isEnglish ? 'TOEFL' : (s.language_level || '현지 어학시험'),
          cut: isEnglish && typeof toeflScore === 'number' ? toeflScore : null,
          level: s.language_level || '', notes: s.language_notes || ''
        },
        housing: { guaranteed: s.housing_guaranteed || '', info: s.housing_info || '' },
        gpaCut: coerce(s.gpa_required),
        majors: [], seasons: [
          ...(s.spring_available ? ['봄학기'] : []),
          ...(s.fall_available ? ['가을학기'] : [])
        ],
        climate, koreaComparison: c ? (c.korea_comparison || '') : '',
        security: SECURITY_TEXT[s.security_level] || '치안 점수 데이터 준비 중', securityLevel: s.security_level || undefined,
        access: s.available_areas || '상권 정보 준비 중',
        commerceLevel: s.commerce_score >= 66 ? 'high' : s.commerce_score >= 33 ? 'medium' : s.commerce_score != null ? 'low' : undefined,
        climateType: c ? climateTypeFromTemps(c) : undefined,
        wishlistCount: mockWishlistCount(s.id, s.qs_rank),
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

  /** 국가별 통신사/보험/계좌 실데이터(32개국). 학교별이 아니라 국가별이라 원본
   *  그대로 country_en으로 반환하고, 확정 학교 국가로 찾는 건 화면 쪽(prepare-view.js)에서 처리. */
  async function loadCountryPrep() {
    const { data } = await supabaseClient.from('country_prep').select('*');
    return (data || []).map(c => ({
      countryEn: c.country_en, countryKo: c.country_ko,
      telecomRecommend: c.telecom_recommend, telecomPrice: c.telecom_price, telecomNote: c.telecom_note,
      insurance: c.insurance, insurancePrice: c.insurance_price, insuranceNote: c.insurance_note,
      bankRecommend: c.bank_recommend, accountDocs: c.account_docs
    }));
  }

  async function loadCourseMatches() {
    const { data } = await supabaseClient.from('course_matches').select('*');
    // home_course는 연세대 "전공명"을 그대로 담고 있음(과목명 단위 아님) — homeMajor로도 노출해
    // credits.js의 전공 필터가 실 데이터에서도 동작하게 한다.
    return (data || []).map(m => ({
      id: m.id, homeCourse: m.home_course, homeMajor: m.home_course, targetCourse: m.target_course, school: m.school_id,
      similarity: m.similarity, matchedTopics: m.matched_topics || [], note: m.note
    }));
  }

  async function loadMajorMatches() {
    const { data } = await supabaseClient
      .from('major_matches')
      .select('*')
      .order('korean_major_id')
      .order('rank');
    return (data || []).map(m => ({
      id: m.id, koreanMajorId: m.korean_major_id, homeMajor: m.home_major, school: m.school_id,
      targetMajor: m.target_major, similarity: m.similarity, semanticScore: m.semantic_score,
      taxonomyScore: m.taxonomy_score, matchedTopics: m.matched_topics || [], note: m.note, rank: m.rank
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

  // school_exchange_reports는 학교당 여러 개의 긴 서술형 후기 항목(개요/학업/기숙사·식사 등)을
  // 담고 있다. js/consult.js·school-modal.js가 기대하는 "짧게 태그된 인용구" 형태로
  // 펼쳐서 변환한다. 필드 하나당 인용구 하나, 태그는 근접한 항목으로 근사 매핑한다
  // (원본 서술이 여러 주제를 한 문단에 섞어 쓰는 경우가 많아 완벽한 분류는 아님).
  const REPORT_FIELD_TAGS = [
    ['housing_food', '기숙사'], ['academics', '학업'],
    ['surroundings', '상권'], ['campus_facilities', '상권'],
    ['overview', null], ['cultural_adaptation', null],
    ['international_support', null], ['tips', null]
  ];

  function truncateReview(text, max) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastBreak = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('. \n'));
    return (lastBreak > max * 0.5 ? cut.slice(0, lastBreak + 1) : cut) + '…';
  }

  async function loadSchoolExchangeReports() {
    const { data } = await supabaseClient
      .from('school_exchange_reports')
      .select('school_id, semester, title, overview, surroundings, housing_food, academics, international_support, campus_facilities, cultural_adaptation, tips')
      .not('school_id', 'is', null);
    const out = {};
    (data || []).forEach(r => {
      const author = r.semester ? `${r.semester} 파견 후기` : (r.title || '선배 후기');
      REPORT_FIELD_TAGS.forEach(([field, tag]) => {
        const text = r[field];
        if (!text || !text.trim()) return;
        (out[r.school_id] || (out[r.school_id] = [])).push({ tag, author, text: truncateReview(text.trim(), 320) });
      });
    });
    return out;
  }

  // 치안은 별도 원본(2027-1_치안.xlsx, Numbeo+GPI+외교부 여행경보 가중합)이라
  // livability_column_definitions에 행이 없다 — SECURITY_TEXT와 짝지어 여기서 직접 채운다.
  const SECURITY_LIVABILITY_DEF = {
    meaning: '외교부 여행경보·Numbeo 범죄지수·평화지수(GPI)를 종합한 0-100 치안 점수',
    source: 'Numbeo 범죄지수 + GPI + 외교부 여행경보 가중합 (2027-1_치안.xlsx)'
  };
  const LIVABILITY_COLUMN_TO_AXIS = {
    '물가점수': 'costOfLiving', '상권점수': 'commerce',
    '이동성점수': 'transitMobility', '여행이동성점수': 'travelMobility'
  };

  /** 생활 점수 레이더차트 라벨 호버 설명 (livability_column_definitions, 31행 중 4개만 사용). */
  async function loadLivabilityDefs() {
    const { data } = await supabaseClient
      .from('livability_column_definitions')
      .select('*')
      .eq('sheet_name', '학교별_종합');
    const out = { security: SECURITY_LIVABILITY_DEF };
    (data || []).forEach(d => {
      const axis = LIVABILITY_COLUMN_TO_AXIS[d.column_name];
      if (axis) out[axis] = { meaning: d.meaning, source: d.source };
    });
    return out;
  }

  async function loadYonseiMajors() {
    const { data } = await supabaseClient.from('yonsei_majors').select('*').order('sort_order');
    return (data || []).map(m => ({ college: m.college, division: m.division, majorName: m.major_name }));
  }

  /** 학교별 지원 서류 목록 (exchange-doc-crawler가 채운 school_documents 테이블, 999행).
   *  document_type: 'baseline'(공식 확인) | 'hint'(참고용, 미검증). */
  async function loadSchoolDocuments() {
    const { data } = await supabaseClient
      .from('school_documents')
      .select('school_id, document_name, document_type, sort_order, source_url')
      .order('sort_order');
    const out = {};
    (data || []).forEach(d => {
      (out[d.school_id] || (out[d.school_id] = [])).push({ name: d.document_name, type: d.document_type, sourceUrl: d.source_url });
    });
    return out;
  }

  /** 국가별 비자 서류 정보 (exchange-doc-crawler가 채운 visa_requirements/visa_documents 테이블).
   *  status: 'available'(자동추출된 서류 있음) | 'preparing'(서비스 준비중) | 'excluded'(다국가 컨소시엄 프로그램) */
  async function loadVisaRequirements() {
    const [{ data: reqs }, { data: docs }] = await Promise.all([
      supabaseClient.from('visa_requirements').select('*'),
      supabaseClient.from('visa_documents').select('*')
    ]);
    const docsByCountry = {};
    (docs || []).forEach(d => {
      (docsByCountry[d.country_en] || (docsByCountry[d.country_en] = [])).push({
        standardType: d.standard_type, rawName: d.raw_name, sourceUrl: d.source_url
      });
    });
    const out = {};
    (reqs || []).forEach(r => {
      out[r.country_en] = {
        status: r.status, statusLabelKo: r.status_label_ko,
        sources: r.sources || [], exclusionReason: r.exclusion_reason,
        documents: docsByCountry[r.country_en] || []
      };
    });
    return out;
  }

  Promise.all([
    loadSchools(), loadChecklist(), loadScholarships(),
    loadLivingPrep(), loadCourseMatches(), loadMajorMatches(), loadTips(), loadNearbySpots(), loadYonseiMajors(), loadVisaRequirements(),
    loadCountryPrep(), loadLivabilityDefs(), loadSchoolExchangeReports(), loadSchoolDocuments()
  ]).then(([schools, checklist, scholarships, livingPrep, courseMatches, majorMatches, tips, nearbySpots, yonseiMajors, visaRequirements, countryPrep, livabilityDefs, schoolReviews, schoolDocuments]) => {
    if (schools.length) MOCK.schools = schools;
    if (checklist.length) MOCK.checklist = checklist;
    if (scholarships.length) MOCK.scholarships = scholarships;
    if (Object.keys(livabilityDefs).length) MOCK.livabilityDefs = livabilityDefs;
    if (Object.keys(livingPrep).length) MOCK.livingPrep = livingPrep;
    if (courseMatches.length) MOCK.courseMatches = courseMatches;
    if (majorMatches.length) MOCK.majorMatches = majorMatches;
    if (tips.length) MOCK.tips = tips;
    if (nearbySpots.length) MOCK.nearbySpots = nearbySpots;
    if (yonseiMajors.length) MOCK.yonseiMajors = yonseiMajors;
    if (Object.keys(visaRequirements).length) MOCK.visaRequirements = visaRequirements;
    if (countryPrep.length) MOCK.countryPrep = countryPrep;
    if (Object.keys(schoolReviews).length) MOCK.schoolReviews = schoolReviews;
    if (Object.keys(schoolDocuments).length) MOCK.schoolDocuments = schoolDocuments;
    document.dispatchEvent(new CustomEvent('MOCK:updated'));
  }).catch(err => {
    console.warn('[data-source] Supabase에서 데이터를 불러오지 못해 mock 데이터를 계속 사용합니다.', err);
  });
})();
