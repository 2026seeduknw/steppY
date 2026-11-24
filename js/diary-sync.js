/**
 * 다이어리 꾸밈·폴더·내 스티커를 서버(user_diary_docs)와 맞춘다. supabase/diary_sync.sql 이 필요하다.
 *
 * 화면 코드는 그대로 localStorage 를 읽고 쓴다. 여기서 그 내용을 서버와 비교해 올리고 내려받는다.
 *   - 한쪽만 바뀌었으면 그쪽을 따른다.
 *   - 양쪽이 바뀌었으면 마지막에 저장한 쪽이 남고, 밀린 내용은 이 기기에 백업으로 둔다.
 *   - 처음 연결할 때 폴더와 스티커는 양쪽을 합친다. 기기에 있던 내용은 지우지 않는다.
 *   - 사진은 diary-photos 에 올리고 문서에는 'asset:경로' 만 넣는다. 받을 때 다시 그림으로 풀어 둔다.
 * 테이블이 아직 없거나 오프라인이면 조용히 물러나고, 앱은 전처럼 이 기기 저장으로 동작한다.
 */
const DiarySync = (function () {
  const PAGES = (u) => `steppy_pages_v1_${u}`;
  const FOLDERS = (u) => `steppy_archive_v1_${u}`;
  const STICKERS = (u) => `steppy_stickers_v1_${u}`;
  const META = (u) => `steppy_diary_sync_v1_${u}`;
  const BACKUP = (u) => `steppy_diary_backup_v1_${u}`;
  const TABLE = 'user_diary_docs', BUCKET = 'diary-photos';
  const isTemp = (id) => /^j\d+$/.test(String(id || ''));

  let timer = 0, running = false, again = false, off = false;
  const uidNow = () => (typeof Auth !== 'undefined' && Auth.userId) || null;
  const readJson = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } };
  const writeJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } };
  // Postgres jsonb 는 키 순서를 바꿔 돌려준다 — 같은 내용이면 같은 값이 나오게 키를 정렬해서 잰다
  const canon = (v) => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { if (v[k] !== undefined) o[k] = canon(v[k]); }); return o; }
    return v;
  };
  function hash(v) {
    if (v === undefined) return '';
    const s = JSON.stringify(canon(v));
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return `${s.length}:${(h >>> 0).toString(36)}`;
  }

  /* ------------------------------------------------------------ 이 기기의 문서 */
  function localDocs(uid) {
    const docs = {};
    const folders = readJson(FOLDERS(uid), null), stickers = readJson(STICKERS(uid), null), pages = readJson(PAGES(uid), {});
    if (Array.isArray(folders) && folders.length) docs.folders = folders;
    if (Array.isArray(stickers) && stickers.length) docs.stickers = stickers;
    Object.keys(pages || {}).forEach(k => { if (!isTemp(k)) docs[`page:${k}`] = pages[k]; });
    return docs;
  }
  function writeLocal(uid, key, value) {
    if (key === 'folders') return writeJson(FOLDERS(uid), value);
    if (key === 'stickers') return writeJson(STICKERS(uid), value);
    const all = readJson(PAGES(uid), {}) || {};
    const k = key.slice(5);
    if (value === undefined) delete all[k]; else all[k] = value;
    return writeJson(PAGES(uid), all);
  }
  function hasTempEntry(list) {
    return (list || []).some(f => (f.entryIds || []).some(isTemp) || hasTempEntry(f.children));
  }

  /* ------------------------------------------------------------ 사진 ↔ asset: */
  async function mapStrings(v, fn) {
    if (typeof v === 'string') return fn(v);
    if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await mapStrings(x, fn)); return out; }
    if (v && typeof v === 'object') { const out = {}; for (const k of Object.keys(v)) out[k] = await mapStrings(v[k], fn); return out; }
    return v;
  }
  function encode(uid, value, meta) {
    return mapStrings(value, async (s) => {
      const m = /^data:image\/(jpeg|png|webp);base64,/.exec(s);
      if (!m) return s;   // SVG 스티커는 버킷이 받지 않아 글자 그대로 둔다
      const id = hash(s);
      if (meta.assets[id]) return `asset:${meta.assets[id]}`;
      const blob = await (await fetch(s)).blob();
      const path = `${uid}/${crypto.randomUUID()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
      const res = await supabaseClient.storage.from(BUCKET).upload(path, blob, { contentType: `image/${m[1]}`, upsert: false });
      if (res.error) throw res.error;
      meta.assets[id] = path;
      return `asset:${path}`;
    });
  }
  function decode(uid, value, meta) {
    return mapStrings(value, async (s) => {
      if (!s.startsWith('asset:')) return s;
      const path = s.slice(6);
      if (!path.startsWith(`${uid}/`)) return '';   // 내 폴더가 아닌 경로는 읽지 않는다
      const res = await supabaseClient.storage.from(BUCKET).download(path);
      if (res.error) throw res.error;
      const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(res.data); });
      meta.assets[hash(data)] = path;
      return data;
    });
  }

  /* ------------------------------------------------------------ 합치기 */
  function mergeFolders(remote, local) {
    const seen = new Map();
    (function index(list) { list.forEach(f => { seen.set(f.id, f); index(f.children || []); }); })(remote);
    const out = JSON.parse(JSON.stringify(remote));
    const copy = new Map();
    (function index(list) { list.forEach(f => { copy.set(f.id, f); index(f.children || []); }); })(out);
    (function add(list, target) {
      list.forEach(f => {
        const same = copy.get(f.id);
        if (same) {
          if (f.entryIds) same.entryIds = [...new Set([...(same.entryIds || []), ...f.entryIds])];
          add(f.children || [], same.children = same.children || []);
        } else {
          const clone = JSON.parse(JSON.stringify(f));
          target.push(clone);
          (function index(l) { l.forEach(x => { copy.set(x.id, x); index(x.children || []); }); })([clone]);
        }
      });
    })(local, out);
    return out;
  }
  function mergeById(remote, local) {
    const ids = new Set(remote.map(x => x.id));
    return [...remote, ...local.filter(x => !ids.has(x.id))];
  }
  function backup(uid, key, value) {
    const all = readJson(BACKUP(uid), {}) || {};
    all[key] = { at: new Date().toISOString(), value };
    writeJson(BACKUP(uid), all);   // 공간이 모자라면 백업만 건너뛴다
  }

  /* ------------------------------------------------------------ 맞추기 */
  function loadMeta(uid) {
    const m = readJson(META(uid), null) || {};
    return { docs: m.docs || {}, assets: m.assets || {}, dirty: m.dirty || {} };
  }
  /** 저장이 일어난 때를 문서별로 적어 둔다 — 양쪽이 바뀌었을 때 어느 쪽이 나중인지 가른다 */
  function stampDirty(uid) {
    const meta = loadMeta(uid), docs = localDocs(uid), now = Date.now();
    let changed = false;
    new Set([...Object.keys(docs), ...Object.keys(meta.docs)]).forEach(k => {
      const known = meta.docs[k] ? meta.docs[k].h : '';
      if (hash(docs[k]) !== known) { if (!meta.dirty[k]) { meta.dirty[k] = now; changed = true; } }
      else if (meta.dirty[k]) { delete meta.dirty[k]; changed = true; }
    });
    if (changed) writeJson(META(uid), meta);
  }
  async function push(uid, key, value, meta) {
    const data = value === undefined ? null : await encode(uid, value, meta);
    const res = await supabaseClient.from(TABLE)
      .upsert({ user_id: uid, doc_key: key, data, deleted: value === undefined }, { onConflict: 'user_id,doc_key' })
      .select('updated_at').single();
    if (res.error) throw res.error;
    meta.docs[key] = { h: hash(value), at: res.data.updated_at };
    delete meta.dirty[key];
  }
  async function pull(uid, key, row, meta) {
    const value = row.deleted ? undefined : await decode(uid, row.data, meta);
    if (!writeLocal(uid, key, value)) return false;
    meta.docs[key] = { h: hash(value), at: row.updated_at };
    delete meta.dirty[key];
    return true;
  }
  async function syncOne(uid, key, row, meta, canApply) {
    const docs = localDocs(uid), mine = docs[key], known = meta.docs[key];
    const localDirty = known ? hash(mine) !== known.h : mine !== undefined;
    const remoteNew = !!row && (!known || row.updated_at !== known.at);
    if (!localDirty && !remoteNew) return false;
    // 저장소가 통째로 비었으면 삭제로 치지 않는다 — 지운 게 아니라 데이터가 사라진 기기일 수 있다
    if (localDirty && mine === undefined && !key.startsWith('page:')) { delete meta.docs[key]; return false; }
    if (key === 'folders' && mine && hasTempEntry(mine)) return false;   // 진짜 id가 오면 다시 저장된다
    if (localDirty && !remoteNew) { await push(uid, key, mine, meta); return false; }
    if (!canApply) return false;
    if (!localDirty) return pull(uid, key, row, meta);
    // 양쪽이 바뀌었다
    if (!known) {
      if (!row.deleted && (key === 'folders' || key === 'stickers')) {
        const remote = await decode(uid, row.data, meta);
        const merged = key === 'folders' ? mergeFolders(remote, mine) : mergeById(remote, mine);
        if (!writeLocal(uid, key, merged)) return false;
        await push(uid, key, merged, meta);
        return true;
      }
      if (!row.deleted) {
        const remote = await decode(uid, row.data, meta);
        if (hash(remote) === hash(mine)) { meta.docs[key] = { h: hash(mine), at: row.updated_at }; return false; }
      }
    } else if ((meta.dirty[key] || 0) > Date.parse(row.updated_at)) {
      backup(uid, `${key}:server`, row.data);
      await push(uid, key, mine, meta);
      return false;
    }
    if (mine !== undefined) backup(uid, key, mine);
    return pull(uid, key, row, meta);
  }

  async function run() {
    const uid = uidNow();
    if (!uid || off || typeof supabaseClient === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    if (running) { again = true; return; }
    running = true;
    let applied = false;
    try {
      stampDirty(uid);
      const res = await supabaseClient.from(TABLE).select('doc_key, data, deleted, updated_at').eq('user_id', uid);
      if (res.error) {
        if (res.error.code === '42P01' || res.error.code === 'PGRST205') { off = true; console.info('[diary-sync] supabase/diary_sync.sql 을 아직 적용하지 않았어요'); }
        else console.warn('[diary-sync]', res.error.message);
        return;
      }
      const rows = {};
      (res.data || []).forEach(r => { rows[r.doc_key] = r; });
      const meta = loadMeta(uid);
      // 꾸미는 도중에는 화면 아래 내용을 바꾸지 않는다. 다음 기회에 받는다
      const canApply = !document.body.classList.contains('is-sheet-open');
      const keys = new Set([...Object.keys(localDocs(uid)), ...Object.keys(rows), ...Object.keys(meta.docs)]);
      for (const key of keys) {
        if (uidNow() !== uid) break;   // 도중에 계정이 바뀌면 멈춘다
        try { if (await syncOne(uid, key, rows[key], meta, canApply)) applied = true; }
        catch (e) { console.warn('[diary-sync]', key, e && e.message); }
        writeJson(META(uid), meta);
      }
    } catch (e) {
      console.warn('[diary-sync]', e && e.message);
    } finally {
      running = false;
      if (applied) document.dispatchEvent(new CustomEvent('diary:synced'));
      if (again) { again = false; schedule(); }
    }
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(run, ms == null ? 1200 : ms); }
  /** 화면 코드가 저장한 직후 부른다 */
  function touch() {
    const uid = uidNow();
    if (!uid) return;
    try { stampDirty(uid); } catch (e) { /* 다음 맞추기에서 다시 본다 */ }
    schedule();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('auth:changed', () => { off = false; schedule(0); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(0); });
    if (typeof window !== 'undefined') window.addEventListener('online', () => schedule(0));
    if (typeof Auth !== 'undefined' && Auth.init) Auth.init().then(() => schedule(0)).catch(() => {});
  }
  return { touch, run };
})();
