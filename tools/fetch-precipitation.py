#!/usr/bin/env python3
"""
파견교 강수량 수집 — 계절별 "월 평균 강수량"과 "비 오는 날 수".

왜 필요했나
    climate_staging 에는 계절 평균기온만 있었다. 그런데 화면의 기후 필터는
    그 기온만으로 나눈 분류에 '온화·잦은 비' 같은 라벨을 붙이고 있었다.
    마드리드(여름 14mm·3일)와 리버풀(여름 92mm·17일)이 같은 칸에 들어가 있었고,
    둘을 가르는 건 기온이 아니라 강수다.

출처
    Open-Meteo Archive API (ERA5 재분석). 무료·키 불필요이고, 앱이 이미
    날씨에 쓰는 곳이라 개인정보처리방침에 새로 추가할 제3자가 없다.
    https://open-meteo.com/en/docs/historical-weather-api

기간
    2020-01-01 ~ 2024-12-31 (5년). 평년값(30년)이 이상적이지만 일 단위
    응답이라 271곳 × 30년은 받는 양이 과하다. 5년이면 계절 경향을 읽기에
    충분하고, 어차피 "여기 비 많이 오나?"를 가늠하는 용도다.

"비 오는 날"
    하루 강수 1mm 이상. 기상청·WMO가 강수일수에 쓰는 관행적 기준이다
    (0.1mm로 잡으면 이슬비까지 세어 거의 매일이 비 오는 날이 된다).

사용법
    python3 tools/fetch-precipitation.py            # SQL 파일만 만든다
    python3 tools/fetch-precipitation.py --limit 5  # 몇 개만 시험 삼아
"""
import argparse, json, sys, time, urllib.request, urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

SUPABASE_URL = 'https://iejxyrqjhqevbmgwcmwf.supabase.co'
ANON_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllanh5cnFqaHFldmJtZ3djbXdmIiwi'
            'cm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjA0NTQsImV4cCI6MjEwMjYzNjQ1NH0.Xia_lXQBjh4iUcUBzN5xKkLyjNXEaM0qIsLKXhUxa8s')
START, END = '2020-01-01', '2024-12-31'
RAIN_DAY_MM = 1.0
SEASON_OF_MONTH = {3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer',
                   9: 'autumn', 10: 'autumn', 11: 'autumn', 12: 'winter', 1: 'winter', 2: 'winter'}
SEASONS = ['spring', 'summer', 'autumn', 'winter']


def get_json(url, headers=None, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            if i == tries - 1:
                raise
            # 429(속도 제한)는 잠깐 쉬면 풀린다
            time.sleep(2 ** i)
    return None


def load_schools(limit=None):
    url = f'{SUPABASE_URL}/rest/v1/schools?select=id,lat,lng&order=id'
    rows = get_json(url, {'apikey': ANON_KEY, 'Authorization': f'Bearer {ANON_KEY}'})
    rows = [r for r in rows if r.get('lat') is not None and r.get('lng') is not None]
    return rows[:limit] if limit else rows


def seasonal(lat, lng):
    url = (f'https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}'
           f'&start_date={START}&end_date={END}&daily=precipitation_sum&timezone=auto')
    d = get_json(url)
    days = d.get('daily') or {}
    times, values = days.get('time') or [], days.get('precipitation_sum') or []
    total, rain_days, months = defaultdict(float), defaultdict(int), defaultdict(set)
    for ds, mm in zip(times, values):
        if mm is None:
            continue
        s = SEASON_OF_MONTH[int(ds[5:7])]
        total[s] += mm
        if mm >= RAIN_DAY_MM:
            rain_days[s] += 1
        months[s].add(ds[:7])
    out = {}
    for s in SEASONS:
        n = len(months[s])
        if not n:
            return None
        out[s] = (round(total[s] / n), round(rain_days[s] / n))
    return out


def sql_literal(v):
    return 'null' if v is None else str(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int)
    ap.add_argument('--out', default='tools/out/precipitation.sql')
    # Open-Meteo 무료 한도는 "호출 수"가 아니라 받아가는 양으로 매겨진다.
    # 5년치 일 단위를 6개씩 병렬로 당기면 중간에 429가 나기 시작한다 —
    # 한 번에 다 못 받으면 --only-missing 으로 빈 곳만 이어 받는다.
    ap.add_argument('--only-missing', action='store_true')
    ap.add_argument('--workers', type=int, default=6)
    args = ap.parse_args()

    schools = load_schools(args.limit)
    if args.only_missing:
        url = (f'{SUPABASE_URL}/rest/v1/climate_staging'
               f'?select=school_id&precip_spring_mm=not.is.null')
        done = {r['school_id'] for r in
                get_json(url, {'apikey': ANON_KEY, 'Authorization': f'Bearer {ANON_KEY}'})
                if r.get('school_id')}
        schools = [s for s in schools if s['id'] not in done]
    print(f'학교 {len(schools)}곳', file=sys.stderr)

    results, failed = {}, []

    def work(row):
        try:
            return row['id'], seasonal(row['lat'], row['lng'])
        except Exception as e:                       # noqa: BLE001 — 실패한 학교만 건너뛴다
            return row['id'], None

    # Open-Meteo 무료 한도는 분당 600건이다. 6개씩 병렬이면 그 아래로 넉넉히 들어온다.
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for i, (sid, r) in enumerate(pool.map(work, schools), 1):
            if r is None:
                failed.append(sid)
            else:
                results[sid] = r
            if i % 25 == 0:
                print(f'  {i}/{len(schools)}', file=sys.stderr)

    import os
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w') as f:
        f.write('-- tools/fetch-precipitation.py 가 생성했다. 직접 고치지 말 것.\n')
        f.write(f'-- 출처: Open-Meteo Archive (ERA5), {START} ~ {END}, 비 오는 날 = 일 강수 {RAIN_DAY_MM}mm 이상\n')
        f.write('update public.climate_staging c set\n'
                '  precip_spring_mm = v.sp_mm, raindays_spring = v.sp_d,\n'
                '  precip_summer_mm = v.su_mm, raindays_summer = v.su_d,\n'
                '  precip_autumn_mm = v.au_mm, raindays_autumn = v.au_d,\n'
                '  precip_winter_mm = v.wi_mm, raindays_winter = v.wi_d\n'
                'from (values\n')
        rows = []
        for sid, r in sorted(results.items()):
            vals = ', '.join(sql_literal(x) for s in SEASONS for x in r[s])
            rows.append(f"  ('{sid}', {vals})")
        f.write(',\n'.join(rows))
        f.write('\n) as v(school_id, sp_mm, sp_d, su_mm, su_d, au_mm, au_d, wi_mm, wi_d)\n'
                'where c.school_id = v.school_id;\n')

    print(f'성공 {len(results)}곳 · 실패 {len(failed)}곳 → {args.out}', file=sys.stderr)
    if failed:
        print('실패: ' + ', '.join(failed[:20]), file=sys.stderr)


if __name__ == '__main__':
    main()
