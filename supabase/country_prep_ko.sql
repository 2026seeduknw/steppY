-- tools/build-country-prep-ko.py가 만든 파일 — 직접 고치지 말고 country_prep_ko.json을 고친 뒤 다시 만들 것.
-- 원문 칸은 그대로 두고 화면용 *_ko 칸만 채운다. 화면(js/components/prepare-view.js)은
-- *_ko가 있으면 그걸, 없으면 원문을 보여준다. 실행: Supabase SQL Editor에 붙여넣고 Run.

alter table public.country_prep add column if not exists telecom_recommend_ko text;
alter table public.country_prep add column if not exists telecom_price_ko text;
alter table public.country_prep add column if not exists telecom_note_ko text;
alter table public.country_prep add column if not exists insurance_ko text;
alter table public.country_prep add column if not exists insurance_price_ko text;
alter table public.country_prep add column if not exists insurance_note_ko text;
alter table public.country_prep add column if not exists bank_recommend_ko text;
alter table public.country_prep add column if not exists account_docs_ko text[];

update public.country_prep set
  telecom_recommend_ko = 'Public Mobile 선불 요금제',
  telecom_price_ko = '월 30캐나다달러(35GB) 또는 월 35캐나다달러(50GB)',
  telecom_note_ko = '쓰던 휴대폰을 가져가 쓰는(BYOP) 선불 요금제라, 신용 기록이 없는 교환학생도 가입하기 쉬워요.',
  insurance_ko = '주·대학별 보험 (UHIP, MSP, RAMQ 등)',
  insurance_price_ko = '주와 대학에 따라 달라요',
  insurance_note_ko = '캐나다는 주(province)마다 달라서, 파견교의 보험 안내를 가장 먼저 확인하세요.',
  bank_recommend_ko = 'RBC 또는 Scotiabank의 유학생 계좌',
  account_docs_ko = array['여권', '학업 허가증(study permit)', '재학·입학 증명서', '캐나다 주소', '신분증 2종']::text[]
where country_en = 'Canada';

update public.country_prep set
  telecom_recommend_ko = 'Telcel Amigo 선불 요금제',
  telecom_price_ko = '30일 300페소(5.5GB) · 저용량은 50페소부터',
  telecom_note_ko = '멕시코 번호나 통화가 필요하면 eSIM보다 Telcel 선불 요금제가 나아요.',
  insurance_ko = '사설 유학생 보험',
  insurance_price_ko = '하루 1.37달러부터',
  insurance_note_ko = '대학이나 비자에서 요구하는 보장 조건을 확인하세요.',
  bank_recommend_ko = 'BBVA México, Banorte, Santander 중에서',
  account_docs_ko = array['여권', '거주 카드 또는 비자', '현지 주소', '세금 번호·전화번호 (요구할 수 있음)']::text[]
where country_en = 'Mexico';

update public.country_prep set
  telecom_recommend_ko = 'Mint Mobile 선불 요금제',
  telecom_price_ko = '신규 가입 시 모든 요금제 월 15달러(프로모션) · 세금·수수료 별도',
  telecom_note_ko = 'T-Mobile 통신망을 쓰는 알뜰폰(MVNO)이에요. 캠퍼스 지역에서 잘 터지는지 확인하고 고르세요.',
  insurance_ko = '학교 보험(SHIP), 또는 학교 보험 면제(waiver)가 되는 사설 유학생 보험',
  insurance_price_ko = '학교 보험 연 1,500–3,500달러 · 사설 보험 월 40–125달러',
  insurance_note_ko = 'F-1 비자는 대학 요건을, J-1 비자는 연방 최소 보장 요건도 함께 확인하세요.',
  bank_recommend_ko = 'Bank of America, 또는 Chase·Wells Fargo의 학생용 입출금 계좌',
  account_docs_ko = array['여권', '학생 비자', 'I-20 또는 DS-2019', '미국 주소', '본국(한국) 주소', '신분증 2종', '세금 ID·SSN·ITIN (가능)']::text[]
where country_en = 'United States';

update public.country_prep set
  telecom_recommend_ko = 'Vodafone 학생용 유심 요금제 또는 Boost 선불',
  telecom_price_ko = 'Vodafone 학생가 월 35호주달러(프로모션) · Boost 60GB 28일 39호주달러',
  telecom_note_ko = '오래 머물면 학생 요금제나 월정액이, 도착 직후에는 선불 요금제가 편해요.',
  insurance_ko = 'OSHC(유학생 건강보험) 필수',
  insurance_price_ko = '보험사(ahm, Allianz, Bupa 등)에서 견적을 받아야 해요',
  insurance_note_ko = '학생비자(Subclass 500)와 학교 요구 사항에 맞춰 가입하세요.',
  bank_recommend_ko = 'CommBank 또는 Westpac의 학생·이주자 계좌',
  account_docs_ko = array['여권', '학생 비자', 'CoE(입학 확인서)', '호주 주소', '지점 방문 신분 확인']::text[]
where country_en = 'Australia';

update public.country_prep set
  telecom_recommend_ko = 'China Unicom·China Mobile 캠퍼스 요금제 또는 Nihao SIM',
  telecom_price_ko = 'China Unicom Nihao SIM 13.76달러부터 · 일반 선불 약 100위안부터',
  telecom_note_ko = '여권으로 실명 등록해야 해요. 학교의 캠퍼스 할인 요금제를 확인해 보세요.',
  insurance_ko = '외국인 유학생 종합보험(LXBX 등) 또는 학교 지정 보험',
  insurance_price_ko = '학교·보험사가 안내하는 금액을 확인하세요',
  insurance_note_ko = '중국은 학교가 보험 구매와 등록을 안내하는 경우가 많아요.',
  bank_recommend_ko = 'Bank of China 또는 ICBC',
  account_docs_ko = array['여권', '학생 비자 또는 거류 허가', '중국 휴대폰 번호', '대학 입학·재학 서류', '현지 주소']::text[]
where country_en = 'China';

update public.country_prep set
  telecom_recommend_ko = 'CSL 학생 선불 요금제 또는 SoSIM',
  telecom_price_ko = 'CSL 학생 선불 58홍콩달러 · SoSIM 50GB 30일 33홍콩달러',
  telecom_note_ko = '은행·학교 인증에 홍콩 번호가 필요해서 현지 선불 유심을 추천해요.',
  insurance_ko = '학교 또는 개인 의료보험 (필수 여부 꼭 확인)',
  insurance_price_ko = '상품마다 견적을 받아야 해요',
  insurance_note_ko = '홍콩 신분증(HKID)이 없는 비거주 학생은 공공병원 비용을 먼저 내고 보험으로 청구해야 할 수 있어요.',
  bank_recommend_ko = 'HSBC HK 또는 Hang Seng의 학생·일반 계좌',
  account_docs_ko = array['여권', '학생 비자·입학 서류', '홍콩 주소', '현지 휴대폰 번호', '학교 발급 은행용 레터(bank letter)']::text[]
where country_en = 'Hong Kong';

update public.country_prep set
  telecom_recommend_ko = 'Sakura Mobile 또는 IIJmio',
  telecom_price_ko = 'Sakura 음성+데이터 월 2,980엔부터(세금 별도) · IIJmio 음성 월 850엔부터',
  telecom_note_ko = '은행·생활 인증에 일본 번호가 필요할 수 있어요. 가입할 때 재류카드나 여권이 필요해요.',
  insurance_ko = '국민건강보험(NHI) 의무 가입 + Gakkensai로 보완',
  insurance_price_ko = 'NHI 보통 월 1,000–2,000엔 · Gakkensai 연 약 1,000엔',
  insurance_note_ko = '3개월 이상 머무는 외국인은 주소를 등록한 뒤 NHI에 가입해요.',
  bank_recommend_ko = 'Japan Post Bank(유초은행)를 먼저 고려하세요',
  account_docs_ko = array['재류카드', '여권', '도장 또는 서명', '일본 전화번호', '첫 입금용 현금', '학생증 (있으면)']::text[]
where country_en = 'Japan';

update public.country_prep set
  telecom_recommend_ko = 'Hotlink, 또는 U Mobile·CelcomDigi 선불',
  telecom_price_ko = 'Hotlink 스타터 10링깃 · 학생·저가 선불 월 25–55링깃',
  telecom_note_ko = 'EMGS에서도 학생용 휴대폰 요금제를 안내해요.',
  insurance_ko = 'EMGS·학교가 마련하는 현지 의료보험 필수',
  insurance_price_ko = '기본 연 300–600링깃 수준',
  insurance_note_ko = '학생 비자(Student Pass) 조건이에요. 학교가 보험 등록을 처리하는 경우가 많아요.',
  bank_recommend_ko = 'Maybank, CIMB, RHB의 학생 계좌',
  account_docs_ko = array['여권', 'Student Pass 또는 i-Kad', '입학·재학 서류', '현지 주소', '첫 입금 250–500링깃 (가능)']::text[]
where country_en = 'Malaysia';

update public.country_prep set
  telecom_recommend_ko = 'Skinny 선불, 또는 One NZ·Spark',
  telecom_price_ko = 'Skinny 4주 1GB 13뉴질랜드달러부터 · 데이터를 많이 쓰면 One NZ·Spark 29뉴질랜드달러 이상',
  telecom_note_ko = 'Skinny는 Spark 통신망을 쓰는 저가 선불 요금제라 처음 쓰기 좋아요.',
  insurance_ko = '사설 유학생 보험 필수',
  insurance_price_ko = 'Studentsafe, Orbit, Southern Cross에서 견적을 받아야 해요',
  insurance_note_ko = 'ACC는 사고 일부를 보장하지만 유학생 보험을 대신하지는 않아요.',
  bank_recommend_ko = 'ANZ, ASB, BNZ, Kiwibank 중에서',
  account_docs_ko = array['여권', '학생 비자', '입학·재학 증명서', '뉴질랜드 주소', 'IRD 번호·세금 정보 (가능)']::text[]
where country_en = 'New Zealand';

update public.country_prep set
  telecom_recommend_ko = 'GOMO·Singtel hi! 또는 SIMBA',
  telecom_price_ko = 'GOMO 프로모션 월 10싱가포르달러, 이후 19.99싱가포르달러 · SIMBA 월 10싱가포르달러대',
  telecom_note_ko = '약정 없는 유심 전용 요금제가 교환학생에게 잘 맞아요.',
  insurance_ko = '대학 단체보험·학생보험',
  insurance_price_ko = '등록금이나 학생 비용에 포함된 경우가 많아요',
  insurance_note_ko = 'NUS, NTU, SMU 등 학교마다 보험 제도를 확인하세요.',
  bank_recommend_ko = 'DBS·POSB 또는 OCBC',
  account_docs_ko = array['여권', 'Student Pass 또는 IPA', '입학·재학 증명서', '현지 주소', '싱가포르 전화번호']::text[]
where country_en = 'Singapore';

update public.country_prep set
  telecom_recommend_ko = 'Taiwan Mobile 학생 선불 또는 Chunghwa Telecom',
  telecom_price_ko = 'Taiwan Mobile 60일 2,600대만달러 · 90일 3,300대만달러 · Chunghwa 여행자용 일일권은 별도',
  telecom_note_ko = '학생용 장기 선불 요금제와 도착 직후 쓰는 공항 유심은 따로 구분하세요.',
  insurance_ko = '거류증(ARC) 6개월 뒤부터 국민건강보험(NHI), 그 전에는 단체 의료보험',
  insurance_price_ko = 'NHI 6개월 선납 4,956대만달러 사례',
  insurance_note_ko = 'NHI 전 6개월은 대학이 단체보험에 등록해 주는 경우가 많아요.',
  bank_recommend_ko = '우체국, First Bank, CTBC 등 학교 제휴 은행',
  account_docs_ko = array['여권', '거류증(ARC)', '학생증 또는 재학 증명서', '도장 또는 서명', '현지 전화번호', '주소']::text[]
where country_en = 'Taiwan';

update public.country_prep set
  telecom_recommend_ko = 'AIS 또는 True-dtac 여행자·선불 유심',
  telecom_price_ko = 'AIS 8일 299바트, 15일 699바트 · True-dtac 여행자 유심은 별도',
  telecom_note_ko = '오래 머물면 여행자 유심이 끝난 뒤 여권을 다시 확인받거나 현지 선불 요금제로 바꿔야 해요.',
  insurance_ko = '사설·태국 현지 보험 또는 대학 단체보험',
  insurance_price_ko = '상품마다 견적을 받아야 해요',
  insurance_note_ko = '외국인 학생은 공공보험에 자동으로 가입되지 않으니 학교 요구 조건을 확인하세요.',
  bank_recommend_ko = 'Bangkok Bank, Kasikorn, SCB 중에서',
  account_docs_ko = array['여권', '학생 비자(ED 비자)', '재학 증명서', '주소 증명', '태국 전화번호']::text[]
where country_en = 'Thailand';

update public.country_prep set
  telecom_recommend_ko = 'Türk Telekom 여행자 유심 또는 Turkcell',
  telecom_price_ko = 'Türk Telekom 28일 25GB 420리라, 50GB 550리라',
  telecom_note_ko = '여권이 필요해요. 120일 넘게 쓰려면 휴대폰 IMEI 등록 문제를 확인하세요.',
  insurance_ko = '체류 허가용 건강보험 또는 SGK/GSS',
  insurance_price_ko = 'SGK/GSS 연 약 2,200리라 안내 · 사설 보험 견적도 함께 비교하세요',
  insurance_note_ko = '학생 체류 허가를 받으려면 보험 증명이 필요해요.',
  bank_recommend_ko = 'Ziraat Bankası, İşbank, Garanti BBVA 중에서',
  account_docs_ko = array['여권', '세금 번호', '체류 허가 또는 학생 증명서', '주소 증명', '튀르키예 전화번호']::text[]
where country_en = 'Turkey';

update public.country_prep set
  telecom_recommend_ko = 'Viettel 또는 Vinaphone 선불',
  telecom_price_ko = 'Viettel·Vinaphone 월 30GB 약 100,000–150,000동',
  telecom_note_ko = '오래 머물면 여권으로 등록한 선불 유심을 추천해요.',
  insurance_ko = '학교가 마련하는 국제 건강보험',
  insurance_price_ko = '예: RMIT 베트남 학기당 7,400,000동',
  insurance_note_ko = '학교가 보험 등록과 청구를 맡는 구조일 수 있어요.',
  bank_recommend_ko = 'Vietcombank, Techcombank, BIDV 중에서',
  account_docs_ko = array['여권', '비자 또는 임시 거주증(TRC)', '재학 증명서', '현지 주소', '베트남 전화번호']::text[]
where country_en = 'Vietnam';

update public.country_prep set
  telecom_recommend_ko = 'A1 SIMply S 또는 현지 Wertkarte(선불 유심)',
  telecom_price_ko = 'A1 SIMply S 월 약 19.90유로 · 선불 유심 5–10유로부터',
  telecom_note_ko = '오스트리아에서는 선불 유심을 Wertkarte라고 불러요.',
  insurance_ko = 'ÖGK 학생 자가보험 또는 비자 요건을 채우는 사보험',
  insurance_price_ko = 'ÖGK 월 약 78.84유로 (2026년)',
  insurance_note_ko = 'EU/EEA 국민은 EHIC를 쓸 수 있고, EU 밖 학생은 체류 허가 조건을 확인하세요.',
  bank_recommend_ko = 'Erste·Sparkasse 또는 Bank Austria의 학생 계좌',
  account_docs_ko = array['여권 또는 신분증', '거주 등록증(Meldezettel)', '체류 허가 또는 비자', '재학 증명서', '세금 번호·보험 번호 (있으면)']::text[]
where country_en = 'Austria';

update public.country_prep set
  telecom_recommend_ko = 'DIGI, Mobile Vikings, Lycamobile 중 저가 선불·유심 전용 요금제',
  telecom_price_ko = 'DIGI 월 5유로(30GB) · Mobile Vikings·Lycamobile 10유로대 요금제',
  telecom_note_ko = '대부분 학생증 없이 가입할 수 있어요. 신분증 등록은 필요해요.',
  insurance_ko = 'Mutualité(ziekenfonds) 가입 또는 학교가 안내하는 보험',
  insurance_price_ko = '분기당 약 79유로 + 연회비 100–120유로',
  insurance_note_ko = 'EU/EEA 국민은 EHIC, EU 밖 학생은 도착 후 mutualité 가입을 요구받을 수 있어요.',
  bank_recommend_ko = 'KBC 또는 ING의 학생·유학생 계좌',
  account_docs_ko = array['여권', '재학 증명서', '장학금·재정 증명서', '체류 허가', '숙소 계약서·주소']::text[]
where country_en = 'Belgium';

update public.country_prep set
  telecom_recommend_ko = 'Lebara 또는 Lycamobile 선불',
  telecom_price_ko = 'Lebara 30GB 59크로네, 60GB 69크로네 · Lyca 30GB 59크로네',
  telecom_note_ko = 'CPR 번호를 받기 전에는 선불 요금제가 편해요. 오래 머물면 CPR 번호와 NemKonto가 필요해요.',
  insurance_ko = '3개월 넘게 머물면 CPR·옐로카드로 공공 의료, 도착 직후 공백 기간은 사보험',
  insurance_price_ko = '공공 의료는 세금으로 운영 · 공백 기간 보험은 별도',
  insurance_note_ko = 'EU 국민은 EHIC, EU 밖 학생은 CPR 등록 전 공백 기간을 보장받아야 해요.',
  bank_recommend_ko = 'Danske Bank 등 CPR 번호로 여는 계좌',
  account_docs_ko = array['여권 또는 신분증', '덴마크 주소', 'CPR 번호', '학생 신분·입학 서류']::text[]
where country_en = 'Denmark';

update public.country_prep set
  telecom_recommend_ko = 'Telia, DNA, Elisa 선불',
  telecom_price_ko = 'Telia 31일 무제한 4G 19.99유로 · DNA 30일 29.99유로',
  telecom_note_ko = '선불이나 eSIM으로 시작하고, 장기 약정은 현지 신분증을 받은 뒤에 고민하세요.',
  insurance_ko = 'FSHS 비용 + EU 밖 학생은 체류 허가용 사보험',
  insurance_price_ko = 'FSHS 연 70.70유로 · 사보험은 별도',
  insurance_note_ko = 'EU 밖 학생은 체류 허가에 필요한 보험 보장 금액 요건을 확인하세요.',
  bank_recommend_ko = 'Nordea, OP, Danske 등 현지 은행',
  account_docs_ko = array['여권 또는 신분증', '핀란드 개인 식별 번호', '체류 허가', '재학 증명서', '주소·추가 본인 확인(KYC)']::text[]
where country_en = 'Finland';

update public.country_prep set
  telecom_recommend_ko = 'Free Mobile, 또는 Lebara·Sosh 무약정 요금제',
  telecom_price_ko = 'Free 2유로 요금제(저용량) · 일반 선불 5–10유로부터',
  telecom_note_ko = '데이터를 많이 쓰면 10유로대 무약정 요금제를 다시 확인하세요.',
  insurance_ko = '사회보장(Sécurité Sociale) 무료 등록 + 보충보험(mutuelle)은 선택',
  insurance_price_ko = '기본은 무료 · mutuelle 월 10–50유로',
  insurance_note_ko = 'etudiant-etranger.ameli.fr에서 등록해요. 학교 안내를 먼저 따르세요.',
  bank_recommend_ko = 'BNP, SG, LCL 등의 학생 계좌 또는 온라인 은행',
  account_docs_ko = array['여권 또는 신분증', '프랑스 주소', '학생 비자·체류 자격', '재학 증명서·학생증', '납세자 번호(TIN) (요청할 수 있음)']::text[]
where country_en = 'France';

update public.country_prep set
  telecom_recommend_ko = 'ALDI TALK 선불, 또는 O2·Vodafone 선불',
  telecom_price_ko = '선불 월 5–15유로 · ALDI TALK 스타터 9.99유로 수준',
  telecom_note_ko = '유심 등록 때 여권이나 영상 본인 인증(Video-Ident)이 필요해요. 독일 번호가 있으면 은행 인증에 편해요.',
  insurance_ko = '공보험 GKV(TK, AOK, Barmer 등) 또는 승인된 사보험',
  insurance_price_ko = 'GKV 월 약 141유로 (2026년)',
  insurance_note_ko = '비자·등록·학적 등록(Immatrikulation)에 보험 증명이 필요해요.',
  bank_recommend_ko = 'N26, Commerzbank, Deutsche Bank · 봉쇄 계좌(blocked account)는 Expatrio, Fintiba 등',
  account_docs_ko = array['여권 또는 신분증', '거주 등록 증명(Meldebescheinigung)', '재학·입학 증명서', '체류 허가 또는 비자', '세금 ID (있으면)']::text[]
where country_en = 'Germany';

update public.country_prep set
  telecom_recommend_ko = 'GoMo 또는 Three 선불(pay-as-you-go)',
  telecom_price_ko = 'GoMo 월 12.99유로(월 단위) · Three 월 20–25유로',
  telecom_note_ko = '30일 단위·무약정 요금제가 교환학생에게 잘 맞아요.',
  insurance_ko = 'EU 밖 학생은 사설 건강보험',
  insurance_price_ko = '연 약 160유로부터 · 사고 25,000유로 + 질병 25,000유로 보장',
  insurance_note_ko = 'IRP(체류 허가) 등록 요건을 확인하세요. EU/EEA 국민은 EHIC.',
  bank_recommend_ko = 'AIB, Bank of Ireland, Revolut Ireland',
  account_docs_ko = array['여권', '주소 증명', '재학 증명서', 'PPSN (요구할 수 있음)']::text[]
where country_en = 'Ireland';

update public.country_prep set
  telecom_recommend_ko = 'Vodafone 선불 또는 Iliad',
  telecom_price_ko = 'Vodafone 30일 200GB 약 15유로 · Iliad 월 약 7.99–11유로',
  telecom_note_ko = 'SPID·은행 인증에는 데이터 전용 eSIM보다 이탈리아 번호가 유리해요.',
  insurance_ko = 'SSN 자율 가입 또는 사보험',
  insurance_price_ko = 'SSN 연 700유로 · 사보험 월 20유로부터',
  insurance_note_ko = 'EU 국민은 EHIC, EU 밖 학생은 비자·체류 허가(permesso) 요건을 확인하세요.',
  bank_recommend_ko = 'Intesa Sanpaolo, UniCredit, Poste Italiane',
  account_docs_ko = array['여권 또는 신분증', '세금 번호(codice fiscale)', '체류 허가 또는 신청 접수증', '이탈리아 주소', '학생 증명서']::text[]
where country_en = 'Italy';

update public.country_prep set
  telecom_recommend_ko = 'Telia·Tele2·Bite 선불 또는 eSIM',
  telecom_price_ko = '현지 선불은 저렴한 편 · eSIM 1.95달러부터(데이터 전용)',
  telecom_note_ko = '2025년부터 익명 선불 유심을 쓸 수 없어서 신분증 등록이 필요해요.',
  insurance_ko = '사보험 필수',
  insurance_price_ko = '비자 기준 최소 보장 30,000유로 · 임시 체류 허가(TRP)는 학교·기관 기준 확인',
  insurance_note_ko = '영문 원본, 서명, 도장을 요구할 수 있어요.',
  bank_recommend_ko = 'Revolut, Swedbank, SEB Lithuania 중에서',
  account_docs_ko = array['여권', '체류 허가(TRP)', '현지 주소', '재학 증명서', '세금·개인 식별 번호 (가능)']::text[]
where country_en = 'Lithuania';

update public.country_prep set
  telecom_recommend_ko = 'Lebara 또는 Simyo',
  telecom_price_ko = 'Lebara·Simyo 월 약 7.50–10유로대',
  telecom_note_ko = '영어 앱이나 국제 전화가 필요하면 Lebara, 오래 쓸 저가 유심 전용 요금제는 Simyo를 고려하세요.',
  insurance_ko = '공부만 하면 사보험 · 일하거나 유급 인턴을 하면 네덜란드 기본 건강보험(basisverzekering)',
  insurance_price_ko = '사보험 월 약 40유로 · 기본 건강보험 월 약 159유로',
  insurance_note_ko = '일을 하면 공보험 가입 의무가 생길 수 있어요.',
  bank_recommend_ko = 'bunq, N26, Revolut, 또는 BSN을 받은 뒤 네덜란드 은행',
  account_docs_ko = array['여권 또는 신분증', '네덜란드 주소', 'BSN', '체류 허가', '재학 증명서 (은행마다 다름)']::text[]
where country_en = 'Netherlands';

update public.country_prep set
  telecom_recommend_ko = 'MyCall 선불, 또는 Telia·Telenor 여행자·선불',
  telecom_price_ko = '여행자 선불 약 200–400크로네 · MyCall은 D-번호 없이 가입할 수 있다고 안내돼요',
  telecom_note_ko = 'D-번호를 받기 전에는 MyCall처럼 새로 온 사람용 요금제를 확인하세요.',
  insurance_ko = '12개월 넘게 머물면 국민보험(Folketrygden), 짧게 머물면 사보험',
  insurance_price_ko = '단기 사보험 월 40–80유로',
  insurance_note_ko = 'EU/EEA 국민은 EHIC. 머무는 기간에 따라 크게 달라져요.',
  bank_recommend_ko = 'DNB, Nordea, SpareBank1 중에서',
  account_docs_ko = array['여권', '체류 카드 또는 D-번호', '주소', '재학 증명서', '노르웨이 신분증 절차 (가능)']::text[]
where country_en = 'Norway';

update public.country_prep set
  telecom_recommend_ko = 'Orange Flex 또는 Play 선불',
  telecom_price_ko = 'Orange Flex 월 35즈워티(75GB) · Play 스타터 5–10즈워티 + 충전',
  telecom_note_ko = '매장에서 여권으로 실명 등록한 뒤 월 데이터 패키지를 켜요.',
  insurance_ko = 'NFZ 자율 가입 또는 사보험',
  insurance_price_ko = 'NFZ 월 약 13유로 · 사보험 월 25유로부터',
  insurance_note_ko = 'EU 국민은 EHIC, EU 밖 학생은 체류 허가와 학교 요건을 확인하세요.',
  bank_recommend_ko = 'mBank, PKO, ING Poland 중에서',
  account_docs_ko = array['여권', '체류 허가 또는 비자', '폴란드 주소', 'PESEL 번호 (가능)', '학생 증명서']::text[]
where country_en = 'Poland';

update public.country_prep set
  telecom_recommend_ko = 'MTS·Beeline·MegaFon, 상황에 따라 여행용 eSIM',
  telecom_price_ko = '현지 유심 약 200루블부터 · 월 요금제 400루블 이상 · eSIM 4.99유로부터',
  telecom_note_ko = '2026년 외국인의 실물 유심 구매·결제에 제한이 있어서, 도착 전에 eSIM 대안을 확인하세요.',
  insurance_ko = '임의 건강보험(VHI) 필수',
  insurance_price_ko = '보험사·학교마다 견적을 받아야 해요',
  insurance_note_ko = '도착 15일 안에 사야 한다는 사례가 있어요. 머무는 기간 전체에 유효해야 해요.',
  bank_recommend_ko = 'Sberbank, Tinkoff 등은 제재·외국인 제한을 먼저 확인하세요',
  account_docs_ko = array['여권', '이민 카드·체류 등록', '비자', '러시아 전화번호', '세금·거주 정보 (가능)']::text[]
where country_en = 'Russia';

update public.country_prep set
  telecom_recommend_ko = 'Digi, Orange, Vodafone, Movistar 선불',
  telecom_price_ko = '학생용 유심 월 약 8–25유로',
  telecom_note_ko = '여권만으로 선불 유심을 산 사례가 있어요. 오래 머물면 NIE 번호를 받아 두세요.',
  insurance_ko = '비자·체류 카드(TIE)용 사설 건강보험',
  insurance_price_ko = '월 35–120유로',
  insurance_note_ko = '본인 부담금과 대기 기간이 없는, 스페인 요건을 채우는 보험인지 확인하세요.',
  bank_recommend_ko = 'BBVA, Santander, imagin, N26',
  account_docs_ko = array['여권 또는 신분증', 'NIE·TIE 또는 신청 증명', '주소', '재학 증명서·입학 서류', '스페인 전화번호']::text[]
where country_en = 'Spain';

update public.country_prep set
  telecom_recommend_ko = 'Comviq 선불 또는 Hallon',
  telecom_price_ko = 'Comviq 약 49–429크로나 · 일반 10–20GB는 10–35달러 수준',
  telecom_note_ko = '유심 등록·신분증 요건을 확인하세요. 오래 머물면 personnummer를 받은 뒤 약정을 고려하세요.',
  insurance_ko = '1년 미만은 사보험이나 대학 보험, 1년 이상은 personnummer를 받은 뒤 공공 제도',
  insurance_price_ko = '단기 사보험 월 400–800크로나',
  insurance_note_ko = 'EU/EEA 국민은 EHIC. 학교가 Kammarkollegiet 보험을 제공할 수 있어요.',
  bank_recommend_ko = 'SEB, Swedbank, Handelsbanken 중에서',
  account_docs_ko = array['여권', '체류 허가', 'personnummer·스웨덴 신분증', '재학 증명서', '주소 증명', '자금 출처']::text[]
where country_en = 'Sweden';

update public.country_prep set
  telecom_recommend_ko = 'Sunrise, Salt, Swisscom 선불',
  telecom_price_ko = 'Sunrise 선불 유심 19.90프랑 + 20프랑 충전금 · 하루 무제한 2.50프랑',
  telecom_note_ko = '스위스 요금은 비싼 편이에요. 학생이면 청년·학생 요금제를 확인하세요.',
  insurance_ko = 'KVG 건강보험 의무 가입, 또는 면제 신청·학생 보험 패키지',
  insurance_price_ko = '학생 보험료 월 200–450프랑 (칸톤·공제액에 따라)',
  insurance_note_ko = '도착 3개월 안에 가입하거나 면제를 신청해야 해요. EU/EFTA 국민은 면제받을 수 있어요.',
  bank_recommend_ko = 'PostFinance, UBS, 칸톤 은행',
  account_docs_ko = array['여권', '학생증·등록 증명', '체류 허가', '스위스 주소']::text[]
where country_en = 'Switzerland';

update public.country_prep set
  telecom_recommend_ko = 'giffgaff 월 단위 요금제',
  telecom_price_ko = '월 10파운드(20GB) 또는 쓴 만큼 내는(PAYG) 10파운드(15GB)',
  telecom_note_ko = '약정이 없고 충전이 쉬워요. 영국 은행·서비스용으로 영국 번호를 만들어 두세요.',
  insurance_ko = '이민 건강 부담금(IHS)을 내고 NHS 이용',
  insurance_price_ko = 'IHS 연 1,035파운드 (2026년 안내)',
  insurance_note_ko = '6개월 이상 학생비자면 IHS로 NHS를 쓸 수 있어요. 사보험은 선택이에요.',
  bank_recommend_ko = 'HSBC 유학생 계좌, 또는 Barclays·Monzo',
  account_docs_ko = array['여권', 'eVisa·BRP 공유 코드', '재학·입학 확인서', '영국 주소 증명 또는 대학 발급 은행 레터', '영국 전화번호']::text[]
where country_en = 'United Kingdom';

update public.country_prep set
  telecom_recommend_ko = '파견 국가가 정해지면 그 나라 기준으로 골라요',
  telecom_price_ko = '국가가 정해진 뒤 조사해요',
  telecom_note_ko = 'ISEP, GE3, SAF 같은 다국가 프로그램은 국가가 정해져야 통신사와 요금을 정할 수 있어요.',
  insurance_ko = '파견 국가와 프로그램의 보험 기준을 따라요',
  insurance_price_ko = '국가·프로그램마다 달라요',
  insurance_note_ko = '프로그램에서 보험을 지정할 수 있어요.',
  bank_recommend_ko = '파견 국가가 정해지면 그 나라 기준으로',
  account_docs_ko = array['국가·프로그램마다 달라요']::text[]
where country_en = 'Other';
