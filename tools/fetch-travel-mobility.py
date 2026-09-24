#!/usr/bin/env python3
"""
여행 이동성 점수의 원자료 — 가장 가까운 공항, 가장 가까운 다른 나라.

왜
    UC 9개 캠퍼스는 좌표가 비어 있어 생활 점수 파이프라인이 건너뛰었다.
    다섯 지표 중 여행 이동성은 공개 데이터 두 개로 계산할 수 있다.
    (상권=Foursquare, 교통=TravelTime/Transitland 은 키가 있어야 한다)

자료
    공항  OurAirports (퍼블릭 도메인) — large/medium 만 쓴다. small 까지 넣으면
          개인 활주로·농업용 비행장이 잡혀 "가까운 공항"의 뜻이 달라진다.
    국경  Natural Earth 10m admin-0 (퍼블릭 도메인). 폴리곤 정점까지의 거리를
          최단거리로 본다 — 10m 해상도면 정점 간격이 대개 1km 미만이라
          실제 국경선까지 거리와 큰 차이가 없다(검증: 암스테르담→독일 94.0km,
          기존 값 94.2km / 칼가리→미국 231.6km, 기존 값 230.7km).
          속령은 본국 기준으로 걸러낸다(SOVEREIGNT) — 안 그러면 시드니에서
          '산호해 제도'(호주령)가 가장 가까운 "다른 나라"로 잡힌다.

산식 (school_livability_score_basis.travel_mobility_formula 그대로)
    평균(공항접근점수, 인접국가접근점수)
    공항접근점수     = (101 - 공항거리km) / (101 - 3) * 100   ← 범위는 기존 데이터 기준
    인접국가접근점수 = 25km 이하 100, 800km 이상 0, 사이는 (800-거리)/(800-25)*100

사용법
    python3 tools/fetch-travel-mobility.py <school_id> [<school_id> ...]
    python3 tools/fetch-travel-mobility.py --all            # 좌표 있는 학교 전부
"""
import csv, json, math, os, sys, urllib.request
import numpy as np

SUPABASE_URL = 'https://iejxyrqjhqevbmgwcmwf.supabase.co'
ANON_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllanh5cnFqaHFldmJtZ3djbXdmIiwi'
            'cm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjA0NTQsImV4cCI6MjEwMjYzNjQ1NH0.Xia_lXQBjh4iUcUBzN5xKkLyjNXEaM0qIsLKXhUxa8s')
AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
BORDERS_URL = ('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/'
               'master/geojson/ne_10m_admin_0_countries.geojson')
CACHE = os.path.join(os.path.dirname(__file__), 'out', 'cache')

# 기존 262곳 데이터에서 뽑힌 정규화 범위(score_range_note). 새로 채우는 학교도
# 같은 잣대를 써야 점수끼리 비교가 된다.
AIRPORT_KM_MIN, AIRPORT_KM_MAX = 3.0, 101.0
NEAR_KM_FULL, NEAR_KM_ZERO = 25.0, 800.0
R = 6371.0088


def cached(url, name, binary=False):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
    return path


def load_airports():
    rows = list(csv.DictReader(open(cached(AIRPORTS_URL, 'airports.csv'), encoding='utf-8')))
    # OurAirports 에는 같은 공항이 '[Duplicate] ...' / '(Duplicate)...' 이름으로
    # 한 번 더 들어 있는 잘못된 레코드가 있다. 좌표가 엉뚱한 경우가 있어 뺀다
    # (기존 데이터에 "[Duplicate] Beijing Xijiao Airport" 가 들어간 것도 이 때문).
    keep = [r for r in rows
            if r['type'] in ('large_airport', 'medium_airport')
            and 'duplicate' not in r['name'].lower()]
    lat = np.radians(np.array([float(r['latitude_deg']) for r in keep]))
    lon = np.radians(np.array([float(r['longitude_deg']) for r in keep]))
    return np.array([r['name'] for r in keep]), lat, lon


def load_borders():
    d = json.load(open(cached(BORDERS_URL, 'ne10.geojson'), encoding='utf-8'))
    names, sov, lats, lons = [], [], [], []
    for f in d['features']:
        p = f['properties']
        nm = p.get('ADMIN') or p.get('NAME_EN')
        sv = p.get('SOVEREIGNT') or nm
        g = f['geometry']
        if not g:
            continue
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for ring in poly:
                for x, y in ring:
                    names.append(nm); sov.append(sv); lons.append(x); lats.append(y)
    return (np.array(names), np.array(sov),
            np.radians(np.array(lats)), np.radians(np.array(lons)))


def haversine_to(lat, lng, arr_lat, arr_lon):
    p1, l1 = math.radians(lat), math.radians(lng)
    a = np.sin((arr_lat - p1) / 2) ** 2 + math.cos(p1) * np.cos(arr_lat) * np.sin((arr_lon - l1) / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def airport_score(km):
    return round(max(0.0, min(100.0, (AIRPORT_KM_MAX - km) / (AIRPORT_KM_MAX - AIRPORT_KM_MIN) * 100)), 1)


def neighbour_score(km):
    if km <= NEAR_KM_FULL:
        return 100.0
    if km >= NEAR_KM_ZERO:
        return 0.0
    return round((NEAR_KM_ZERO - km) / (NEAR_KM_ZERO - NEAR_KM_FULL) * 100, 1)


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    want_all = '--all' in sys.argv

    url = f'{SUPABASE_URL}/rest/v1/schools?select=id,lat,lng,country_en&limit=400'
    schools = json.load(urllib.request.urlopen(urllib.request.Request(
        url, headers={'apikey': ANON_KEY, 'Authorization': f'Bearer {ANON_KEY}'})))
    by_id = {s['id']: s for s in schools}

    if want_all:
        ids = [s['id'] for s in schools if s.get('lat') is not None]

    ap_name, ap_lat, ap_lon = load_airports()
    b_name, b_sov, b_lat, b_lon = load_borders()
    print(f'공항 {len(ap_name)}개 · 국경 정점 {len(b_name)}개', file=sys.stderr)

    # schools.country_en 과 Natural Earth 의 ADMIN 이름이 다른 둘
    ALIAS = {'United States': 'United States of America',
             'Hong Kong': 'Hong Kong S.A.R.'}

    admin_to_sov = {}
    for nm, sv in zip(b_name, b_sov):
        admin_to_sov.setdefault(nm, sv)

    for sid in ids:
        s = by_id.get(sid)
        if not s or s.get('lat') is None:
            print(f'{sid}\tNO-COORDS')
            continue
        lat, lng = float(s['lat']), float(s['lng'])
        own = ALIAS.get(s['country_en'], s['country_en'])

        d = haversine_to(lat, lng, ap_lat, ap_lon)
        i = int(np.argmin(d))
        akm, aname = round(float(d[i]), 1), str(ap_name[i])

        # 무엇을 "다른 나라"로 볼 것인가
        #   호주 학교 → 산호해 제도(호주령)는 다른 나라가 아니다. 학교가 있는
        #     곳이 주권국 자신이면 그 주권국의 속령까지 전부 뺀다.
        #   홍콩 학교 → 본토 중국은 다른 나라로 친다. 주권국은 같아도 출입국이
        #     따로라 학생 입장에서는 국경을 넘는 이동이다. 그래서 학교가 있는
        #     곳이 속령·특별행정구면 그 구역 하나만 뺀다.
        own_sov = admin_to_sov.get(own, own)
        mask = (b_sov != own_sov) if own_sov == own else (b_name != own)
        dn = haversine_to(lat, lng, b_lat[mask], b_lon[mask])
        j = int(np.argmin(dn))
        nkm, nname = round(float(dn[j]), 1), str(b_name[mask][j])

        a_s, n_s = airport_score(akm), neighbour_score(nkm)
        total = round((a_s + n_s) / 2, 1)
        print(f'{sid}\t{total}\t{a_s}\t{n_s}\t{aname}\t{akm}\t{nname}\t{nkm}')


if __name__ == '__main__':
    main()
