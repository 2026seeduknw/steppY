/**
 * 후기 문장 ↔ 학생 질문을 같은 키워드 사전으로 분류한다.
 * data-source.js(school_exchange_reports 문장 단위 태깅)와
 * consult.js(Mentor's Step 질문 매칭)가 함께 사용해, 챗봇이 제안하는
 * 7개 주제 칩(기숙사/교통/상권/치안/학업/날씨/생활비)이 실제 후기 태그와 어긋나지 않게 한다.
 * 짧은 한 글자 키워드(비/방/돈/밤 등)는 다른 단어(생활비/가방/비싸다 등)의 부분
 * 문자열로 우연히 매칭되는 오탐이 잦아 의도적으로 배제함.
 */
const REVIEW_TOPICS = [
  { tag: '기숙사', keywords: ['기숙사', 'dorm', 'dormitory', '주거', '룸메이트'] },
  { tag: '교통', keywords: ['교통', '버스', '지하철', '통학', '이동수단', '대중교통', 'mrt'] },
  { tag: '상권', keywords: ['상권', '편의점', '마트', '쇼핑', '맛집', '다운타운', '시내'] },
  { tag: '치안', keywords: ['치안', '안전', '위험', '밤길', '소매치기'] },
  { tag: '학업', keywords: ['수업', '학업', '과제', '교수', '강의', '시험', '조모임', '팀플'] },
  { tag: '날씨', keywords: ['날씨', '기후', '우천', '더위', '추위', '계절'] },
  { tag: '생활비', keywords: ['생활비', '물가', '비용', '식비', '외식'] }
];

function matchReviewTopics(text) {
  const q = text.toLowerCase();
  return REVIEW_TOPICS.filter(t => t.keywords.some(k => q.includes(k.toLowerCase()))).map(t => t.tag);
}
