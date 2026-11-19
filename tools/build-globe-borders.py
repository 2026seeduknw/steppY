"""
지구본 경계선 자료 만들기 — assets/globe/borders.json

원본(공개 데이터, Natural Earth 기반 TopoJSON)
  나라: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
  미국 주: https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json

두 나라(두 주)가 함께 쓰는 선(arc)만 뽑는다 — 해안선은 지도 그림에 이미 있다.
선은 더글러스-포이커로 줄이고 좌표는 0.01도 정수로 저장한다.
  python3 tools/build-globe-borders.py <countries-50m.json> <states-10m.json>
"""
import json, sys

def decode_arcs(topo):
    sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']
    out = []
    for arc in topo['arcs']:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out

def shared_arcs(topo, obj):
    count = {}
    def walk(rings):
        for ring in rings:
            for a in ring:
                i = a if a >= 0 else ~a
                count[i] = count.get(i, 0) + 1
    for g in topo['objects'][obj]['geometries']:
        arcs = g.get('arcs') or []
        if g['type'] == 'Polygon': walk(arcs)
        elif g['type'] == 'MultiPolygon':
            for poly in arcs: walk(poly)
    return [i for i, n in count.items() if n >= 2]

def dp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; L = (dx * dx + dy * dy) ** 0.5 or 1e-9
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L
        if d > best: best, bi = d, i
    if best <= eps: return [pts[0], pts[-1]]
    return dp(pts[:bi + 1], eps)[:-1] + dp(pts[bi:], eps)

def lines(path, obj, eps):
    topo = json.load(open(path))
    arcs = decode_arcs(topo)
    out = []
    for i in shared_arcs(topo, obj):
        pts = dp(arcs[i], eps)
        flat = []
        for x, y in pts: flat += [round(x * 100), round(y * 100)]
        if len(flat) >= 4: out.append(flat)
    return out

countries = lines(sys.argv[1], 'countries', 0.04)
states = lines(sys.argv[2], 'states', 0.03)
json.dump({'source': 'Natural Earth via world-atlas@2.0.2 / us-atlas@3.0.1', 'scale': 100,
           'countries': countries, 'usStates': states},
          open('assets/globe/borders.json', 'w'), separators=(',', ':'))
print(len(countries), len(states))
