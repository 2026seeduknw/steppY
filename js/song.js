/**
 * 오늘의 노래 추천 — 알고리즘 v5 (Last.fm 단독 버전).
 * 원래는 Spotify Search(로컬 장르)+Last.fm(무드 태그) 조합이었는데,
 * Spotify가 2026-02부터 Search API에 "앱 소유자 Premium 필수" 제한을 걸어서
 * 백엔드/시크릿 없이 못 쓰게 됨. 대신 Last.fm 하나로 로컬성+무드를 다 해결:
 *  - "로컬 음악" 후보 풀 = 두 소스를 섞음(fetchSongRecommendation 참고):
 *    1) tag.getTopTracks('french' 등) — 아티스트/장르 기준, 진짜 그 나라·언어권 음악
 *    2) geo.getTopTracks(country) — 청취자 기준, 그 나라 사람들이 실제로 많이 듣는 곡
 *    (처음엔 2번만 썼는데 프랑스에서도 미국 팝이 1등으로 뜨는 문제가 있었고,
 *    1번만 쓰면 반대로 그 나라 사람들이 실제 즐겨듣는 글로벌 히트가 빠짐 — 그래서 합침)
 *  - track.getTopTags: 각 후보곡의 실제 유저 태그 → 오늘의 무드 키워드와 겹치는지 채점
 * Last.fm API 키는 읽기 전용 공개 데이터용이라 브라우저에 그대로 둬도 안전함
 * (Spotify Client Secret과 달리 계정 권한을 여는 키가 아님) — 그래서 서버 없이
 * 완전히 클라이언트에서만 동작하고, 배포도 예전처럼 정적 파일 업로드로 충분함.
 */
const SongEngine = (function () {
  // Last.fm 공개 API 키 — 읽기 전용, 노출돼도 문제없는 종류의 키
  const LASTFM_API_KEY = '58a3154f0f9d7080e6f555119958a0cc';
  const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

  // 국가(ISO 3166-1 alpha-2) → Last.fm geo.getTopTracks가 기대하는 영문 국가명.
  // 매핑 안 된 나라는 국가 차트 대신 글로벌 차트로 폴백(fetchSongRecommendation 참고).
  const LASTFM_COUNTRY = {
    FR: 'France', JP: 'Japan', KR: 'South Korea', DE: 'Germany', GB: 'United Kingdom',
    US: 'United States', ES: 'Spain', IT: 'Italy', CN: 'China', TW: 'Taiwan',
    HK: 'Hong Kong', SG: 'Singapore', AU: 'Australia', CA: 'Canada', NL: 'Netherlands',
    CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
    FI: 'Finland', PT: 'Portugal', BE: 'Belgium', IE: 'Ireland', PL: 'Poland',
    CZ: 'Czech Republic', MX: 'Mexico', BR: 'Brazil', TH: 'Thailand', VN: 'Vietnam',
    ID: 'Indonesia', MY: 'Malaysia', PH: 'Philippines', IN: 'India', TR: 'Turkey',
    RU: 'Russia', NZ: 'New Zealand'
  };

  // 국가(ISO 3166-1 alpha-2) → 그 나라/언어권 음악을 가리키는 실제 Last.fm 크라우드 태그.
  // geo 차트(청취자 기준)보다 이게 우선 소스 — 진짜 그 나라 음악만 후보로 잡힘.
  const LOCALE_TAG = {
    FR: 'french', JP: 'j-pop', KR: 'k-pop', DE: 'german', GB: 'british',
    US: 'american', ES: 'spanish', IT: 'italian', CN: 'mandopop', TW: 'mandopop',
    HK: 'cantopop', AU: 'australian', CA: 'canadian', NL: 'dutch', SE: 'swedish',
    NO: 'norwegian', DK: 'danish', FI: 'finnish', PT: 'portuguese', IE: 'irish',
    PL: 'polish', MX: 'mexican', BR: 'brazilian', TH: 'thai', VN: 'vietnamese',
    ID: 'indonesian', PH: 'opm', IN: 'bollywood', TR: 'turkish', RU: 'russian'
  };

  const MOODS = ['cozy', 'energetic', 'romantic', 'calm', 'adventurous', 'melancholic'];
  const MOOD_KO = {
    cozy: '아늑함', energetic: '신남', romantic: '설렘',
    calm: '차분함', adventurous: '모험심', melancholic: '센치함'
  };

  const TAG_MOOD_WEIGHTS = {
    food: { cozy: 1, romantic: 1 },
    dorm: { cozy: 2, calm: 1 },
    class: { calm: 2, melancholic: 1 },
    neighborhood: { adventurous: 2, calm: 1 },
    campus: { adventurous: 1, calm: 1 },
    friends: { energetic: 2, romantic: 1 },
    trip: { adventurous: 2, energetic: 1 },
    admin: { calm: 2, melancholic: 1 },
    tip: { adventurous: 1, energetic: 1 },
    daily: { cozy: 1, melancholic: 1 },
    study: { calm: 2, cozy: 1 },
    transit: { adventurous: 1, energetic: 1 },
    shopping: { cozy: 1, energetic: 1 },
    event: { energetic: 2, romantic: 1 },
    help: { cozy: 1, calm: 1 },
    language: { adventurous: 1, calm: 1 }
  };

  const WEATHER_MOOD_WEIGHTS = {
    clear: { energetic: 2, adventurous: 1 },
    cloudy: { calm: 1, melancholic: 1 },
    rain: { cozy: 2, melancholic: 1 },
    snow: { cozy: 2, romantic: 1 },
    storm: { melancholic: 2 }
  };

  const TIME_MOOD_WEIGHTS = {
    morning: { calm: 1, energetic: 1 },
    afternoon: { energetic: 2, adventurous: 1 },
    evening: { romantic: 2, cozy: 1 },
    night: { cozy: 2, melancholic: 1 }
  };

  const MOOD_KEYWORDS = {
    cozy: ['chill', 'cozy', 'mellow', 'acoustic', 'lo-fi', 'rainy day'],
    energetic: ['upbeat', 'party', 'dance', 'energetic', 'summer'],
    romantic: ['romantic', 'love', 'sunset', 'dreamy', 'soft'],
    calm: ['calm', 'chill', 'study', 'ambient', 'instrumental', 'peaceful'],
    adventurous: ['indie', 'road trip', 'adventure', 'feel good', 'upbeat'],
    melancholic: ['sad', 'melancholy', 'rainy', 'slow', 'emotional', 'blue']
  };

  const WEATHER_LABELS = {
    clear: { emoji: '☀️', ko: '맑음' },
    cloudy: { emoji: '☁️', ko: '흐림' },
    rain: { emoji: '🌧️', ko: '비' },
    snow: { emoji: '❄️', ko: '눈' },
    storm: { emoji: '⛈️', ko: '폭풍' }
  };
  const TIME_LABELS = {
    morning: { emoji: '🌅', ko: '아침' },
    afternoon: { emoji: '☀️', ko: '오후' },
    evening: { emoji: '🌆', ko: '저녁' },
    night: { emoji: '🌙', ko: '밤' }
  };

  function weatherBucket(code) {
    if (code === 0 || code === 1) return 'clear';
    if ([2, 3, 45, 48].includes(code)) return 'cloudy';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([95, 96, 99].includes(code)) return 'storm';
    return 'cloudy';
  }

  function timeBucket(hour) {
    if (hour >= 5 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  // 날씨코드/시간을 사람이 읽는 한글+이모지 라벨로 — 기록에 태그로 보여줄 때 씀
  function weatherLabel(code) {
    if (typeof code !== 'number') return null;
    return WEATHER_LABELS[weatherBucket(code)] || null;
  }
  function timeLabel(hour) {
    return TIME_LABELS[timeBucket(hour)];
  }

  function tempWeight(tempC) {
    if (typeof tempC !== 'number') return {};
    if (tempC <= 5) return { cozy: 1 };
    if (tempC >= 28) return { energetic: 1 };
    return {};
  }

  // 태그+날씨+시간대 점수를 다 더해서 오늘의 무드를 정함.
  // 1등과 2등 점수차가 근소하면(<=2, 2등이 0점 초과) 둘을 섞어서 더 유연하게.
  function computeMood({ tags, weatherCode, tempC, date }) {
    const scores = Object.fromEntries(MOODS.map((m) => [m, 0]));
    const add = (w) => { for (const k in w) scores[k] = (scores[k] || 0) + w[k]; };

    if (tags && tags.length) tags.forEach((t) => add(TAG_MOOD_WEIGHTS[t] || {}));
    else add(TAG_MOOD_WEIGHTS.daily);

    if (typeof weatherCode === 'number') add(WEATHER_MOOD_WEIGHTS[weatherBucket(weatherCode)] || {});
    else add(WEATHER_MOOD_WEIGHTS.cloudy);

    const hour = (date instanceof Date ? date : new Date()).getHours();
    add(TIME_MOOD_WEIGHTS[timeBucket(hour)] || {});
    add(tempWeight(tempC));

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topMood, topScore] = sorted[0];
    const [secondMood, secondScore] = sorted[1];

    let keywords = MOOD_KEYWORDS[topMood].slice();
    let moodKey = topMood;
    if (secondScore > 0 && topScore - secondScore <= 2) {
      keywords = keywords.concat(MOOD_KEYWORDS[secondMood]);
      moodKey = `${topMood}+${secondMood}`;
    }
    return {
      mood: moodKey,
      moodKo: moodKey.split('+').map((m) => MOOD_KO[m]).join(' · '),
      keywords: [...new Set(keywords)]
    };
  }

  async function fetchWeather(lat, lng) {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      if (!res.ok) return null;
      const data = await res.json();
      const cw = data.current_weather;
      if (!cw) return null;
      return { code: cw.weathercode, temp: cw.temperature };
    } catch (e) {
      return null;
    }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Last.fm이 순간적으로 요청을 많이 받으면(한 번의 추천에 최대 20개 이상 호출이 몰림) rate limit을
  // 걸 수 있어서, 실패하면 짧게 쉬었다가 최대 2번 더 재시도 — 그래도 안 되면 그때 포기
  async function lastfmGet(params, attempt = 0) {
    const url = `${LASTFM_BASE}?${new URLSearchParams({ ...params, api_key: LASTFM_API_KEY, format: 'json' }).toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (attempt < 2) {
        await wait(res.status === 429 ? 800 * (attempt + 1) : 300 * (attempt + 1));
        return lastfmGet(params, attempt + 1);
      }
      throw new Error(`lastfm_request_failed ${res.status}`);
    }
    return res.json();
  }

  // 동시에 너무 많은 요청을 한꺼번에 쏘면 rate limit에 걸리기 쉬워서, 최대 `limit`개씩만
  // 동시에 실행하고 다음 것을 이어서 실행
  async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  // 여러 페이지를 병렬로 가져와 하나로 합침 — 후보 풀을 넉넉히 키워야
  // "이미 나온 곡 제외" 후에도 고를 게 충분히 남음
  async function fetchPages(method, extraParams, pages) {
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        lastfmGet({ method, limit: 50, page: i + 1, ...extraParams }).catch(() => null)
      )
    );
    const tracks = [];
    for (const data of results) {
      const items = (data && data.tracks && data.tracks.track) || [];
      tracks.push(...items);
    }
    return tracks
      .map((t) => ({ name: t.name, artist: (t.artist && t.artist.name) || '' }))
      .filter((t) => t.name && t.artist);
  }

  // 장르/언어 태그로 직접 검색 — 실제로 그 나라·언어권 음악으로 태그된 곡만 걸러짐 (아티스트 기준)
  async function fetchByLocaleTag(tag, pages) {
    return fetchPages('tag.gettoptracks', { tag }, pages);
  }

  // 국가 차트 — 그 나라 유저들이 실제로 많이 듣는 곡 (청취자 기준, 글로벌 팝도 섞일 수 있음)
  async function fetchLocalCandidates(countryName, pages) {
    return fetchPages('geo.gettoptracks', { country: countryName }, pages);
  }

  // 앨범 커버 — Last.fm은 대부분 회색 기본 이미지라, 실제 커버가 잘 나오는
  // iTunes Search API(무료, 키 불필요)로 따로 가져옴
  async function fetchAlbumArt(name, artist) {
    try {
      const q = encodeURIComponent(`${artist} ${name}`.trim());
      const res = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&limit=1`);
      if (!res.ok) return null;
      const data = await res.json();
      const item = data.results && data.results[0];
      if (!item || !item.artworkUrl100) return null;
      return item.artworkUrl100.replace('100x100bb', '300x300bb');
    } catch (e) {
      return null;
    }
  }

  // 매핑 안 된 나라(폴백) — 글로벌 인기 차트
  async function fetchGlobalCandidates() {
    try {
      const data = await lastfmGet({ method: 'chart.gettoptracks', limit: 50 });
      const tracks = (data.tracks && data.tracks.track) || [];
      return tracks
        .map((t) => ({ name: t.name, artist: (t.artist && t.artist.name) || '' }))
        .filter((t) => t.name && t.artist);
    } catch (e) {
      return [];
    }
  }

  async function getLastfmTags(artist, track) {
    try {
      const data = await lastfmGet({ method: 'track.gettoptags', artist, track });
      const tags = (data.toptags && data.toptags.tag) || [];
      return tags.map((t) => String(t.name || '').toLowerCase());
    } catch (e) {
      return [];
    }
  }

  // 이름+아티스트 기준으로 중복 제거 (두 소스에 같은 곡이 겹칠 수 있음)
  function dedupeTracks(tracks) {
    const seen = new Set();
    return tracks.filter((t) => {
      const key = `${t.name.toLowerCase()}::${t.artist.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function spotifySearchUrl(name, artist) {
    const q = encodeURIComponent(`${artist} ${name}`.trim());
    return `https://open.spotify.com/search/${q}`;
  }

  function youtubeSearchUrl(name, artist) {
    const q = encodeURIComponent(`${artist} ${name}`.trim());
    return `https://www.youtube.com/results?search_query=${q}`;
  }

  async function fetchSongRecommendation({ countryCode, keywords }) {
    const code = (countryCode || '').toUpperCase();
    const localeTag = LOCALE_TAG[code];
    const countryName = LASTFM_COUNTRY[code];
    // 아티스트 기준(장르 태그)과 청취자 기준(그 나라 차트)을 섞어서 후보 풀을 만듦 —
    // 하나만 쓰면 한쪽으로 치우침(태그만: 로컬 인디까지 다 잡힘 / 차트만: 글로벌 팝이 섞임).
    // 페이지를 3장씩 가져와서(최대 150+150) 풀을 넉넉히 키움 — 아래서 "이미 나온 곡"을
    // 제외하고도 고를 게 충분히 남게 하려는 목적.
    const [tagCandidates, chartCandidates] = await Promise.all([
      localeTag ? fetchByLocaleTag(localeTag, 3) : Promise.resolve([]),
      countryName ? fetchLocalCandidates(countryName, 3) : Promise.resolve([])
    ]);
    let candidates = dedupeTracks([...tagCandidates, ...chartCandidates]);
    if (!candidates.length) candidates = await fetchGlobalCandidates();
    if (!candidates.length) return null;

    // 지금까지 기록된 모든 곡은 다시 안 뽑음 — 별도 저장 없이 기존 entry들에서 바로 읽음.
    // 후보가 너무 적게 남으면(정말 다 써버린 극단적 경우) 예외적으로 재사용 허용.
    // 앱에서는 기록 목록이 AppState.getJournal()이다(원본 프로토타입은 getDiaryEntries).
    // 추천은 덤이라, 목록을 못 읽는 상황이어도 추천 자체가 죽지는 않게 빈 배열로 떨어뜨린다.
    const pastEntries = (typeof AppState !== 'undefined' && typeof AppState.getJournal === 'function')
      ? AppState.getJournal() : [];
    const usedKeys = new Set(
      pastEntries
        .map((e) => e.song)
        .filter(Boolean)
        .map((s) => `${s.name.toLowerCase()}::${s.artist.toLowerCase()}`)
    );
    const freshCandidates = candidates.filter((c) => !usedKeys.has(`${c.name.toLowerCase()}::${c.artist.toLowerCase()}`));
    const pickFrom = freshCandidates.length >= 5 ? freshCandidates : candidates;

    // Last.fm 태그 조회는 일부 샘플(최대 15곡)만 — 매번 다른 샘플이라 결과도 매번 달라짐.
    // 15개를 한꺼번에 쏘면 rate limit에 걸리기 쉬워서 5개씩만 동시에 진행
    const sample = shuffle(pickFrom).slice(0, 15);
    const scored = await mapWithConcurrency(sample, 5, async (c) => {
      const tags = await getLastfmTags(c.artist, c.name);
      const score = keywords.length
        ? tags.reduce((acc, tag) => acc + (keywords.some((k) => tag.includes(k) || k.includes(tag)) ? 1 : 0), 0)
        : 0;
      // 유저가 대부분 한국인 교환학생이라, 어차피 익숙한 K-pop/한국 아티스트는
      // 완전히 빼진 않되 덜 뽑히게 — 그래야 현지 음악을 새로 발견하는 재미가 삼
      const isKorean = tags.some((t) => t.includes('k-pop') || t.includes('korean'));
      return { track: c, score, isKorean };
    });

    scored.sort((a, b) => b.score - a.score);
    const maxScore = scored[0].score;
    let pool = maxScore > 0 ? scored.filter((s) => s.score === maxScore) : scored.slice(0, 5);
    if (pool.length < 3) pool = scored.slice(0, Math.min(5, scored.length));

    const KOREAN_WEIGHT = 0.3; // 완전 배제는 아니고 확률만 낮춤
    const totalWeight = pool.reduce((sum, p) => sum + (p.isKorean ? KOREAN_WEIGHT : 1), 0);
    let r = Math.random() * totalWeight;
    let picked = pool[pool.length - 1].track;
    for (const p of pool) {
      const w = p.isKorean ? KOREAN_WEIGHT : 1;
      if (r < w) { picked = p.track; break; }
      r -= w;
    }
    const art = await fetchAlbumArt(picked.name, picked.artist);
    return {
      name: picked.name,
      artist: picked.artist,
      art,
      spotifyUrl: spotifySearchUrl(picked.name, picked.artist),
      youtubeUrl: youtubeSearchUrl(picked.name, picked.artist)
    };
  }

  // "지금 듣고 있는 노래" 자기입력용 검색 자동완성 — 오타 없이 정확한 곡을 고르게 함
  async function searchTracks(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const data = await lastfmGet({ method: 'track.search', track: query.trim(), limit: 8 });
      const matches = (data.results && data.results.trackmatches && data.results.trackmatches.track) || [];
      return dedupeTracks(
        matches.map((t) => ({ name: t.name, artist: t.artist || '' })).filter((t) => t.name && t.artist)
      );
    } catch (e) {
      return [];
    }
  }

  function buildSongLinks(name, artist) {
    return { spotifyUrl: spotifySearchUrl(name, artist), youtubeUrl: youtubeSearchUrl(name, artist) };
  }

  return {
    computeMood, fetchWeather, fetchSongRecommendation, searchTracks, buildSongLinks,
    fetchAlbumArt, weatherLabel, timeLabel
  };
})();
