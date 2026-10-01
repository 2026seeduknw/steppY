#!/usr/bin/env python3
"""
country_prep 화면용 한국어 문장 → SQL + 검토표.

입력
  supabase/generated/country_prep.json   원문(엑셀 그대로, build_import.py 출력)
  supabase/country_prep_ko.json          다듬은 문장(원문 범위 안에서 번역·풀어쓰기만)

출력
  supabase/country_prep_ko.sql           *_ko 칸 추가 + 국가별 update (원문 칸은 건드리지 않음)
  supabase/country_prep_ko_review.md     국가별 원문 ↔ 다듬은 문장 나란히 + 확인 필요 항목

사용
  python3 tools/build-country-prep-ko.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIG = json.loads((ROOT / 'supabase/generated/country_prep.json').read_text())
KO = json.loads((ROOT / 'supabase/country_prep_ko.json').read_text())
KO.pop('_comment', None)

TEXT_FIELDS = [
    ('telecom_recommend', '통신 · 추천'), ('telecom_price', '통신 · 요금'), ('telecom_note', '통신 · 참고'),
    ('insurance', '보험 · 추천'), ('insurance_price', '보험 · 요금'), ('insurance_note', '보험 · 참고'),
    ('bank_recommend', '계좌 · 추천'),
]

orig_by_en = {r['country_en']: r for r in ORIG}
missing = sorted(set(orig_by_en) - set(KO))
extra = sorted(set(KO) - set(orig_by_en))
if missing or extra:
    raise SystemExit(f'국가 불일치 — 원문에만: {missing} / 다듬은 쪽에만: {extra}')


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def arr(items):
    return 'array[' + ', '.join(q(i) for i in items) + ']::text[]'


sql = [
    '-- tools/build-country-prep-ko.py가 만든 파일 — 직접 고치지 말고 country_prep_ko.json을 고친 뒤 다시 만들 것.',
    '-- 원문 칸은 그대로 두고 화면용 *_ko 칸만 채운다. 화면(js/components/prepare-view.js)은',
    '-- *_ko가 있으면 그걸, 없으면 원문을 보여준다. 실행: Supabase SQL Editor에 붙여넣고 Run.',
    '',
]
for f, _ in TEXT_FIELDS:
    sql.append(f'alter table public.country_prep add column if not exists {f}_ko text;')
sql.append('alter table public.country_prep add column if not exists account_docs_ko text[];')
sql.append('')
for en, row in KO.items():
    sets = [f'{f}_ko = {q(row[f])}' for f, _ in TEXT_FIELDS]
    sets.append(f"account_docs_ko = {arr(row['account_docs'])}")
    sql.append(f'update public.country_prep set\n  ' + ',\n  '.join(sets) + f'\nwhere country_en = {q(en)};')
    sql.append('')
(ROOT / 'supabase/country_prep_ko.sql').write_text('\n'.join(sql))

md = [
    '# country_prep 한국어 다듬기 — 검토표',
    '',
    '> tools/build-country-prep-ko.py가 만든 파일. 원칙: 원문에 있는 내용만 번역·풀어쓰기, 새 정보·추측 없음.',
    '> 숫자·브랜드명은 원문 그대로(통화 표기만 한글). **확인 필요** 항목은 원문 뜻이 애매하거나 해석이 들어간 곳.',
    '',
]
flagged = [en for en, r in KO.items() if r.get('review')]
md.append(f'확인 필요 항목이 있는 국가: {len(flagged)}개 / 전체 {len(KO)}개')
md.append('')
for en, row in KO.items():
    o = orig_by_en[en]
    md.append(f"## {o['country_ko']} ({en})")
    md.append('')
    md.append('| 항목 | 원문 | 다듬은 문장 |')
    md.append('|---|---|---|')
    for f, label in TEXT_FIELDS:
        md.append(f"| {label} | {o[f] or ''} | {row[f]} |")
    md.append(f"| 계좌 · 필요 서류 | {o['account_docs'] or ''} | {' / '.join(row['account_docs'])} |")
    md.append('')
    if row.get('review'):
        md.append('**확인 필요**')
        md.extend(f'- {r}' for r in row['review'])
        md.append('')
(ROOT / 'supabase/country_prep_ko_review.md').write_text('\n'.join(md))

print(f'{len(KO)}개국 · SQL / 검토표 생성 (확인 필요 {len(flagged)}개국)')
