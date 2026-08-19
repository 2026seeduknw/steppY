"""
실제 파견대학 엑셀 자료(공유용.zip) -> Supabase 시드용 JSON 변환 스크립트.

입력 파일 (엑셀 원본 경로를 --src로 지정, 기본값은 아래 SRC_DIR):
  2027-1_파견_대학_목록_국가_지역_추가.xlsx  (263개교 기본정보 + 한글 국가/지역)
  2027-1_파견_대학_QS_정리.xlsx              (QS 랭킹)
  물가_여행지수_이동지수.xlsx                 (물가/상권/이동성/여행이동성 점수)
  학교별_기숙사비용.xlsx                      (기숙사비 학기평균)
  2027-1_보험_통신사_계좌.xlsx                (국가별 통신/보험/계좌 준비)
  연세대학교_단과대학별_전공리스트.xlsx        (연세대 전공 리스트)
  yonsei_sinchon_2026_courses.xlsx           (연세대 개설과목 — Courses 시트만 사용)

출력: supabase/generated/*.json (schools, country_prep, yonsei_majors, yonsei_courses)

주의:
  - University of California는 실제 파일에 1개 행(정원 합계)만 있지만, QS는 캠퍼스별로
    분리돼 있고 안내 문서도 "9개 캠퍼스를 하나로 묶지 말 것"이라고 명시함 -> 9개 캠퍼스
    행으로 분리하되, 어학/GPA/마감일 등 공통 지원조건은 그대로 복제하고 QS 랭킹만
    캠퍼스별로 채움 (Merced/Riverside/Santa Cruz는 QS 랭킹 없음 -> null).
  - 치안(security) 점수는 2027-1_치안.xlsx의 Universities 시트(최종 치안점수/치안 등급)에서
    가져오고, UC는 UC_Campus_Detail 시트(캠퍼스별 최종 치안점수)를 캠퍼스명으로 직접 매칭함.
    등급 매핑: 매우양호·양호→high, 보통→medium, 주의·고위험→low, 산출불가→null.
  - Weekly Plans 시트(15만행, 강의계획서 원문)는 용량/활용도 대비 부담이 커 이번엔 제외.
"""
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

SRC_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent.parent / "scratchpad" / "supabase-import" / "공유용" / "공유용"
OUT_DIR = Path(__file__).resolve().parent / "generated"
OUT_DIR.mkdir(exist_ok=True)

UC_CAMPUSES = [
    ("University of California, Berkeley", "https://www.berkeley.edu"),
    ("University of California, Davis", "https://www.ucdavis.edu"),
    ("University of California, Irvine", "https://students.uci.edu"),
    ("University of California, Los Angeles", "https://www.ucla.edu"),
    ("University of California, Merced", "https://www.ucmerced.edu"),
    ("University of California, Riverside", "https://www.ucr.edu"),
    ("University of California, San Diego", "https://ucsd.edu"),
    ("University of California, Santa Barbara", "https://osl.sa.ucsb.edu"),
    ("University of California, Santa Cruz", "https://www.ucsc.edu"),
]
# QS 파일 표기 -> 위 캠퍼스명 매칭용 키워드
UC_QS_KEYWORDS = {
    "Berkeley": "University of California, Berkeley",
    "Los Angeles": "University of California, Los Angeles",
    "San Diego": "University of California, San Diego",
    "Davis": "University of California, Davis",
    "Irvine": "University of California, Irvine",
    "Santa Barbara": "University of California, Santa Barbara",
}


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "school"


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v


def yn_to_bool(v):
    v = clean(v)
    if v is None:
        return None
    return str(v).strip().upper() == "Y"


SECURITY_GRADE_TO_LEVEL = {
    "매우양호": "high", "양호": "high",
    "보통": "medium",
    "주의": "low", "고위험": "low",
}


def security_level(grade):
    return SECURITY_GRADE_TO_LEVEL.get(clean(grade))


def num(v):
    v = clean(v)
    if v is None:
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def make_unique_ids(names):
    seen = {}
    ids = []
    for n in names:
        base = slugify(n)
        if base not in seen:
            seen[base] = 0
            ids.append(base)
        else:
            seen[base] += 1
            ids.append(f"{base}-{seen[base]}")
    return ids


def build_schools():
    u = pd.read_excel(SRC_DIR / "2027-1_파견_대학_목록_국가_지역_추가.xlsx", sheet_name="Universities")
    cost = pd.read_excel(SRC_DIR / "물가_여행지수_이동지수.xlsx", sheet_name="학교별_종합")
    dorm = pd.read_excel(SRC_DIR / "학교별_기숙사비용.xlsx", sheet_name="semester_krw")
    qs = pd.read_excel(SRC_DIR / "2027-1_파견_대학_QS_정리.xlsx", sheet_name="QS 랭킹")
    security = pd.read_excel(SRC_DIR / "2027-1_치안.xlsx", sheet_name="Universities")
    uc_security = pd.read_excel(SRC_DIR / "2027-1_치안.xlsx", sheet_name="UC_Campus_Detail")

    cost_by_name = {row["학교"]: row for _, row in cost.iterrows()}
    dorm_by_name = {}
    for _, row in dorm.iterrows():
        dorm_by_name.setdefault(row["학교"], row)  # 첫 매칭 행만 사용(통화별 중복 행 존재)
    qs_by_name = {row["학교명"]: row["QS 랭킹"] for _, row in qs.iterrows()}
    security_by_name = {row["University"]: row for _, row in security.iterrows()}
    uc_security_by_campus = {row["캠퍼스"]: row for _, row in uc_security.iterrows()}

    rows = []
    for _, r in u.iterrows():
        name = clean(r["University"])
        if name == "University of California":
            uc_cost_row = cost_by_name.get(name)
            for campus_name, website in UC_CAMPUSES:
                qs_rank = None
                for kw, target in UC_QS_KEYWORDS.items():
                    if target == campus_name:
                        for qs_name, rank in qs_by_name.items():
                            if kw in qs_name:
                                qs_rank = num(rank)
                                break
                sec_row = uc_security_by_campus.get(campus_name)
                sec_score = num(sec_row["최종 치안점수"]) if sec_row is not None else None
                sec_level = security_level(sec_row["치안 등급"]) if sec_row is not None else None
                rows.append(_school_row(r, campus_name, website, uc_cost_row, dorm_by_name.get(name), qs_rank, sec_score, sec_level))
            continue
        c = cost_by_name.get(name)
        d = dorm_by_name.get(name)
        q = qs_by_name.get(name)
        s = security_by_name.get(name)
        sec_score = num(s["최종 치안점수"]) if s is not None else None
        sec_level = security_level(s["치안 등급"]) if s is not None else None
        rows.append(_school_row(r, name, clean(r["Website"]), c, d, num(q), sec_score, sec_level))

    ids = make_unique_ids([row["name"] for row in rows])
    for row, sid in zip(rows, ids):
        row["id"] = sid
    return rows


def _school_row(r, name, website, cost_row, dorm_row, qs_rank, security_score=None, security_level_value=None):
    return {
        "name": name,
        "name_ko": None,
        "country_en": clean(r["Country"]),
        "country_ko": clean(r.get("국가")),
        "continent": clean(r["Continent"]),
        "region_ko": clean(r.get("지역")),
        "city": clean(cost_row["도시"]) if cost_row is not None else None,
        "lat": clean(cost_row["위도"]) if cost_row is not None else None,
        "lng": clean(cost_row["경도"]) if cost_row is not None else None,
        "qs_rank": qs_rank,
        "open_undergrad": yn_to_bool(r["Open to Undergraduate"]),
        "open_grad": yn_to_bool(r["Open to Graduate"]),
        "quota": num(r["Quota"]),
        "quota_unit": clean(r["Quota Unit"]),
        "academic_system": clean(r["Academic System"]),
        "language": clean(r["Language"]),
        "track": "english" if (clean(r["Language"]) and "English" in r["Language"]) else "nonEnglish",
        "toefl_ibt": clean(r["TOEFL iBT"]),
        "toefl_subscores": clean(r["TOEFL Subscores"]),
        "language_level": clean(r["Language Level"]),
        "language_notes": clean(r["Language Notes"]),
        "gpa_required": clean(r["GPA Required"]),
        "fall_available": yn_to_bool(r["Fall One Semester"]),
        "fall_calendar_year": yn_to_bool(r["Fall Calendar Year"]),
        "spring_available": yn_to_bool(r["Spring One Semester"]),
        "spring_calendar_year": yn_to_bool(r["Spring Calendar Year"]),
        "fall_nomination_deadline": clean(r["Fall Nomination Deadline"]),
        "fall_application_deadline": clean(r["Fall Application Deadline"]),
        "spring_nomination_deadline": clean(r["Spring Nomination Deadline"]),
        "spring_application_deadline": clean(r["Spring Application Deadline"]),
        "available_areas": clean(r["Available Areas"]),
        "restricted_areas": clean(r["Restricted Areas"]),
        "admission_notes": clean(r["Admission Notes"]),
        "housing_guaranteed": clean(r["Housing Guaranteed"]),
        "housing_info": clean(r["Housing Info"]),
        "scholarship_note": clean(r["Scholarship"]),
        "notice_from_oia": clean(r["Notice from OIA"]),
        "transcript_note": clean(r["Transcript"]),
        "website": website,
        "factsheet_url": clean(r["Factsheet"]),
        "detail_link": clean(r["Detail Link"]),
        "security_score": security_score,
        "security_level": security_level_value,
        "cost_score": clean(cost_row["물가점수"]) if cost_row is not None else None,
        "commerce_score": clean(cost_row["상권점수"]) if cost_row is not None else None,
        "mobility_score": clean(cost_row["이동성점수"]) if cost_row is not None else None,
        "travel_mobility_score": clean(cost_row["여행이동성점수"]) if cost_row is not None else None,
        "overall_ref_score": clean(cost_row["종합참고점수"]) if cost_row is not None else None,
        "monthly_living_cost_usd": clean(cost_row["월 생활비(USD)"]) if cost_row is not None else None,
        "monthly_living_cost_krw": clean(cost_row["월 생활비(KRW)"]) if cost_row is not None else None,
        "dorm_currency": clean(dorm_row["통화"]) if dorm_row is not None else None,
        "dorm_semester_avg_local": clean(dorm_row["학기_평균"]) if dorm_row is not None else None,
        "dorm_semester_avg_krw": clean(dorm_row["학기평균_KRW"]) if dorm_row is not None else None,
        "dorm_confidence": clean(dorm_row["confidence"]) if dorm_row is not None else None,
    }


def build_country_prep():
    df = pd.read_excel(SRC_DIR / "2027-1_보험_통신사_계좌.xlsx", sheet_name="국가별 준비")
    rows = []
    for _, r in df.iterrows():
        rows.append({
            "region": clean(r["지역"]),
            "country_en": clean(r["국가(영문)"]),
            "country_ko": clean(r["국가(한글)"]),
            "dispatch_school_count": num(r["파견교 수"]),
            "telecom_recommend": clean(r["통신사 추천"]),
            "telecom_price": clean(r["대표 요금"]),
            "telecom_note": clean(r["통신 메모"]),
            "telecom_source": clean(r["통신 출처"]),
            "insurance": clean(r["보험"]),
            "insurance_price": clean(r["보험 요금"]),
            "insurance_note": clean(r["보험 메모"]),
            "insurance_source": clean(r["보험 출처"]),
            "bank_recommend": clean(r["은행 추천"]),
            "account_docs": clean(r["계좌 개설 서류"]),
            "bank_note_source": clean(r["은행 메모/출처"]),
            "confidence_grade": clean(r["확인등급"]),
            "survey_date": clean(str(r["조사일"])) if clean(r["조사일"]) else None,
        })
    return rows


def build_yonsei_majors():
    df = pd.read_excel(SRC_DIR / "연세대학교_단과대학별_전공리스트.xlsx", sheet_name="연세대 전공 리스트", header=2)
    df.columns = ["sort_order", "college", "division", "major_name"]
    rows = []
    for _, r in df.iterrows():
        major = clean(r["major_name"])
        college = clean(r["college"])
        if not major or not college or major == "전공명":
            continue
        rows.append({
            "sort_order": num(r["sort_order"]),
            "college": college,
            "division": clean(r["division"]),
            "major_name": major,
        })
    return rows


def build_yonsei_courses():
    df = pd.read_excel(SRC_DIR / "yonsei_sinchon_2026_courses.xlsx", sheet_name="Courses")
    rows = []
    for _, r in df.iterrows():
        rows.append({
            "semester": clean(r["학기"]),
            "year": num(r["학년도"]),
            "campus": clean(r["캠퍼스"]),
            "college": clean(r["대학"]),
            "department": clean(r["학과"]),
            "course_id": clean(r["학정번호"]),
            "course_code": clean(r["과목코드"]),
            "section": clean(str(r["분반"])) if clean(r["분반"]) is not None else None,
            "course_name": clean(r["강의명"]),
            "credits": clean(r["학점"]),
            "instructor": clean(r["담당교수"]),
            "class_time": clean(r["강의시간"]),
            "classroom": clean(r["강의실"]),
            "language": clean(r["언어"]),
            "grading": clean(r["평가방식"]),
        })
    return rows


def dump(name, rows):
    path = OUT_DIR / f"{name}.json"
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=None), encoding="utf-8")
    print(f"{name}: {len(rows)}행 -> {path}")


if __name__ == "__main__":
    dump("schools", build_schools())
    dump("country_prep", build_country_prep())
    dump("yonsei_majors", build_yonsei_majors())
    dump("yonsei_courses", build_yonsei_courses())
