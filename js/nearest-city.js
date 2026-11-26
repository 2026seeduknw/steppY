/**
 * 사진 좌표 → 가장 가까운 도시. 휴대폰(브라우저) 안에서만 계산한다.
 *
 * 왜 기기 안에서 하나
 *   예전에는 사진 좌표를 BigDataCloud 무료 API로 보내 도시 이름을 받았다. 그 API는 "기기의 지금 위치"에만
 *   쓰라고 되어 있어 사진 좌표(저장된 좌표)를 보내면 이용 조건 위반이고, 정확한 좌표가 사용자 IP와 함께
 *   외부로 나갔다. 그래서 도시 목록(assets/geo/cities.tsv, GeoNames CC BY 4.0 — tools/build-cities.mjs)을
 *   앱에 넣고 여기서 찾는다. 사진 좌표는 밖으로 나가지 않는다.
 *
 * 어떤 도시를 고르나
 *   거리만 보면 큰 도시 바로 옆 작은 동네가 뽑히고, 인구만 보면 엉뚱한 대도시가 뽑힌다. 도시마다
 *   인구로 어림한 반경 r(km) = 1 + 0.5·√(인구/1000) 을 두고 "거리 ÷ r"이 가장 작은 도시를 고른다.
 *   (서울 r≈52km, 파리 r≈24km, 인구 3만 대학 도시 r≈4km)
 *   100km 안에 도시가 하나도 없으면(바다 위·오지) null — 엉뚱한 먼 도시를 붙이지 않는다.
 *
 * 목록은 처음 쓸 때 한 번 불러온다(약 1.8MB, 웹은 압축돼 약 0.8MB). 사진에 위치가 없으면 불러오지도 않는다.
 * 나라 이름은 country-flags.js 의 COUNTRY_ISO2(앱이 쓰는 영어 이름)를 먼저, 없으면 브라우저 Intl 로 만든다.
 */
const NearestCity = {
  URL: 'assets/geo/cities.tsv',
  MAX_KM: 100,

  _data: null,
  _loading: null,
  _countryNames: null,

  load() {
    if (this._data) return Promise.resolve(this._data);
    if (!this._loading) {
      this._loading = fetch(this.URL)
        .then(r => { if (!r.ok) throw new Error(`cities ${r.status}`); return r.text(); })
        .then(text => {
          const lines = text.split('\n').filter(l => l && l[0] !== '#');
          const n = lines.length;
          const data = { n, name: new Array(n), cc: new Array(n), lat: new Float32Array(n), lng: new Float32Array(n), pop: new Float32Array(n) };
          lines.forEach((l, i) => {
            const c = l.split('\t');
            data.name[i] = c[0]; data.cc[i] = c[1];
            data.lat[i] = +c[2]; data.lng[i] = +c[3]; data.pop[i] = +c[4] || 1;
          });
          this._data = data;
          return data;
        })
        .catch(e => { this._loading = null; throw e; });   // 다음에 다시 시도할 수 있게
    }
    return this._loading;
  },

  /** → { city, country, countryCode, lat, lng }(lat·lng는 도시 중심) 또는 null */
  async find(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const d = await this.load();
    const KM_PER_DEG = 111.2;
    const maxDeg = this.MAX_KM / KM_PER_DEG;
    const cosLat = Math.cos(lat * Math.PI / 180);
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < d.n; i++) {
      const dLat = d.lat[i] - lat;
      if (dLat > maxDeg || dLat < -maxDeg) continue;
      let dLng = d.lng[i] - lng;
      if (dLng > 180) dLng -= 360; else if (dLng < -180) dLng += 360;   // 날짜변경선
      const x = dLng * cosLat;
      const km = Math.sqrt(dLat * dLat + x * x) * KM_PER_DEG;
      if (km > this.MAX_KM) continue;
      const score = km / (1 + 0.5 * Math.sqrt(d.pop[i]));
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) return null;
    // 대도시 한가운데의 동네가 뽑혔으면(런던 한복판의 Camden Town) 그 대도시로 바꾼다 —
    // 10배 이상 큰 도시의 중심 반경 R = 1 + 0.15·√(인구/1000) km(서울 약 16km, 런던 약 15km, 파리 약 8km) 안이면.
    // 10배 기준이라 서울 옆 인천(약 4배), 보스턴 옆 케임브리지(약 6배)처럼 따로인 도시는 그대로 남고,
    // 반경을 작게 잡아 서울에서 17km 떨어진 부천 중심도 부천으로 남는다.
    let parent = -1;
    for (let i = 0; i < d.n; i++) {
      if (d.pop[i] < d.pop[best] * 10 || (parent >= 0 && d.pop[i] <= d.pop[parent])) continue;
      const dLat = d.lat[i] - lat;
      let dLng = d.lng[i] - lng;
      if (dLng > 180) dLng -= 360; else if (dLng < -180) dLng += 360;
      const x = dLng * cosLat;
      const km = Math.sqrt(dLat * dLat + x * x) * KM_PER_DEG;
      if (km <= 1 + 0.15 * Math.sqrt(d.pop[i])) parent = i;
    }
    if (parent >= 0) best = parent;
    const cc = d.cc[best];
    // Float32 라 48.85 가 48.849998… 로 읽힌다 — 목록 정밀도(소수 둘째 자리)로 되돌린다
    const round2 = (v) => Math.round(v * 100) / 100;
    return { city: d.name[best], country: this.countryName(cc), countryCode: cc, lat: round2(d.lat[best]), lng: round2(d.lng[best]) };
  },

  /** 도시 이름으로 찾기(직접 위치 입력) — 앞글자가 맞는 도시를 인구 많은 순으로. → [{ city, country, countryCode, lat, lng }] */
  async search(q, limit = 6) {
    const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const key = norm(q);
    if (key.length < 2) return [];
    const d = await this.load();
    if (!d.key) d.key = d.name.map(norm);   // 처음 찾을 때 한 번만
    const hits = [];
    for (let i = 0; i < d.n; i++) {
      const k = d.key[i];
      if (k.startsWith(key) || (key.length >= 3 && k.includes(' ' + key))) hits.push(i);
    }
    hits.sort((a, b) => d.pop[b] - d.pop[a]);
    const round2 = (v) => Math.round(v * 100) / 100;
    return hits.slice(0, limit).map(i => ({ city: d.name[i], country: this.countryName(d.cc[i]), countryCode: d.cc[i], lat: round2(d.lat[i]), lng: round2(d.lng[i]) }));
  },

  countryName(cc) {
    if (!this._countryNames) {
      const m = {};
      // 같은 코드에 이름이 여럿이면 앞의 것(목록의 대표 이름)을 쓴다
      if (typeof COUNTRY_ISO2 !== 'undefined') Object.keys(COUNTRY_ISO2).forEach(name => { if (!m[COUNTRY_ISO2[name]]) m[COUNTRY_ISO2[name]] = name; });
      this._countryNames = m;
    }
    if (this._countryNames[cc]) return this._countryNames[cc];
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || cc; } catch (e) { return cc; }
  }
};
