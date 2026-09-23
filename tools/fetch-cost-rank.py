#!/usr/bin/env python3
"""
LivingCost 글로벌 생활비 랭킹 수집 — 물가 점수(cost_score)의 원자료.

왜
    UC 9개 캠퍼스는 좌표가 비어 있어서 생활 점수 파이프라인이 통째로 건너뛰었다.
    치안만 있고 물가·상권·교통·여행이 전부 null 이라, 학교 상세의 레이더가
    한 꼭짓점만 있는 모양으로 나온다.

    넷 중 물가는 공개된 자료 하나로 정확히 재현된다. 나머지 셋은 Foursquare /
    TravelTime / Transitland 키가 있어야 해서 여기서는 손대지 않는다 —
    합성 점수를 반쪽만 채워 넣으면 없느니만 못하다.

산식 (school_livability_score_basis.cost_formula 에 적힌 그대로)
    cost_score = (랭킹 - 1) / (전체 - 1) * 100
    LivingCost 랭킹은 1위가 가장 비싼 도시라, 점수가 높을수록 저렴하다.
    기존 262곳으로 검산했다: Zhejiang Normal 7890/9294 → 84.9 (DB 값과 일치).

사용법
    python3 tools/fetch-cost-rank.py united-states/ca/berkeley united-states/ca/davis ...
"""
import re, sys, time, urllib.request

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) steppY-exchange-data/1.0'
RANK_RE = re.compile(r'ranked\s+([0-9,]+)(?:st|nd|rd|th)\s+out of\s+([0-9,]+)\s+in our global list')


def fetch_rank(path):
    url = f'https://livingcost.org/cost/{path}'
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        html = r.read().decode('utf-8', 'replace')
    m = RANK_RE.search(html)
    if not m:
        return None
    rank = int(m.group(1).replace(',', ''))
    total = int(m.group(2).replace(',', ''))
    return rank, total, url


def score(rank, total):
    return round((rank - 1) / (total - 1) * 100, 1)


if __name__ == '__main__':
    for path in sys.argv[1:]:
        try:
            got = fetch_rank(path)
        except Exception as e:                        # noqa: BLE001
            print(f'{path}\tERROR\t{e}')
            time.sleep(1.5)
            continue
        if not got:
            print(f'{path}\tNO-RANK')
        else:
            rank, total, url = got
            print(f'{path}\t{rank}\t{total}\t{score(rank, total)}\t{url}')
        time.sleep(1.5)
