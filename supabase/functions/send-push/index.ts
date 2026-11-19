/**
 * send-push — 앱 사용자에게 푸시 알림을 보내는 서버 함수.
 *
 * 무엇을 하나
 *   push_tokens 표(supabase/push_tokens.sql)에서 기기 토큰을 읽어 Apple 푸시 서버(APNs)로
 *   알림을 보낸다. Firebase를 거치지 않고 Apple에 바로 보낸다 — 지금은 iOS 앱만 있어서
 *   중간 서비스를 하나 더 둘 이유가 없다. 안드로이드를 내면 FCM 발송을 여기에 더한다.
 *
 * 누가 부를 수 있나
 *   service_role 키를 가진 사람만. 아무나 부르면 전체 사용자에게 스팸을 보낼 수 있다.
 *   그래서 verify_jwt 를 끄고(로그인한 일반 사용자 토큰도 통과돼 버리므로) 이 안에서
 *   Authorization 이 service_role 키와 같은지 직접 비교한다.
 *   보통은 tools/send-push.mjs(npm run push)로 부른다.
 *
 * 요청
 *   POST /functions/v1/send-push
 *   Authorization: Bearer <service_role 키>
 *   {
 *     "title": "제목",
 *     "body": "내용",
 *     "user_ids": ["..."],      // 빼면 전체
 *     "url": "consult.html",    // 선택 — 알림을 누르면 열 화면(js/push.js)
 *     "dry_run": true           // 선택 — 보내지 않고 몇 대에 갈지만 센다
 *   }
 *
 * 필요한 비밀값 (Supabase 대시보드 → Edge Functions → Secrets)
 *   APNS_KEY_ID       Apple Developer → Keys 에서 만든 APNs 키의 Key ID (10자)
 *   APNS_TEAM_ID      Apple Developer 계정의 Team ID (10자)
 *   APNS_PRIVATE_KEY  다운로드한 .p8 파일 내용 전체 (-----BEGIN PRIVATE KEY----- 줄 포함)
 *   APNS_BUNDLE_ID    선택. 기본값 kr.steppy.app
 *
 * 개발 빌드와 출시 빌드
 *   Xcode로 폰에 바로 설치한 앱의 토큰은 Apple의 sandbox 서버에서만, TestFlight·App Store
 *   앱의 토큰은 운영 서버에서만 통한다. 토큰만 봐서는 어느 쪽인지 알 수 없어서
 *   운영 서버에 먼저 보내고 BadDeviceToken 이면 sandbox 로 한 번 더 보낸다.
 *   둘 다 거절하거나 410(앱 삭제됨)이면 그 토큰은 표에서 지운다.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com'
};
const BATCH = 20;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** 키 비교에 걸리는 시간으로 키를 한 글자씩 맞혀 보는 공격을 막는다 */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

/**
 * APNs 인증 토큰(ES256 JWT). Apple은 1시간까지 받아 주지만 20분보다 자주 새로 만들면
 * TooManyProviderTokenUpdates 로 거절한다 — 함수가 살아 있는 동안 40분씩 재사용한다.
 */
let cachedJwt: { value: string; at: number } | null = null;
async function apnsJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.at < 40 * 60 * 1000) return cachedJwt.value;

  const keyId = Deno.env.get('APNS_KEY_ID')!.trim();
  const teamId = Deno.env.get('APNS_TEAM_ID')!.trim();
  // 대시보드에 붙여 넣을 때 줄바꿈이 "\n" 글자로 들어오는 경우도 있다
  const pem = Deno.env.get('APNS_PRIVATE_KEY')!.replace(/\\n/g, '\n');
  const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const unsigned =
    `${b64urlJson({ alg: 'ES256', kid: keyId })}.${b64urlJson({ iss: teamId, iat: Math.floor(Date.now() / 1000) })}`;
  // WebCrypto의 ECDSA 서명은 이미 JWT가 원하는 r||s(64바이트) 형식이다
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  );
  cachedJwt = { value: `${unsigned}.${b64url(sig)}`, at: Date.now() };
  return cachedJwt.value;
}

type Outcome = { result: 'sent' | 'gone' | 'failed'; reason?: string };

async function sendOne(token: string, payload: string, jwt: string, bundleId: string): Promise<Outcome> {
  for (const host of [HOSTS.production, HOSTS.sandbox]) {
    const res = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json'
      },
      body: payload
    });
    if (res.status === 200) {
      await res.body?.cancel();
      return { result: 'sent' };
    }
    const reason: string = (await res.json().catch(() => ({}))).reason || `HTTP ${res.status}`;
    if (res.status === 410 || reason === 'Unregistered') return { result: 'gone', reason };
    if (reason === 'BadDeviceToken') {
      if (host === HOSTS.production) continue; // 개발 빌드 토큰일 수 있다 → sandbox
      return { result: 'gone', reason };
    }
    return { result: 'failed', reason };
  }
  return { result: 'failed', reason: 'unreachable' };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer || !sameSecret(bearer, serviceKey)) return json(401, { error: 'unauthorized' });

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!title && !body) return json(400, { error: 'title_or_body_required' });

  let userIds: string[] | null = null;
  if (input.user_ids !== undefined) {
    if (!Array.isArray(input.user_ids)) return json(400, { error: 'user_ids_must_be_array' });
    userIds = input.user_ids.filter((x): x is string => typeof x === 'string');
    if (userIds.length === 0) return json(400, { error: 'empty_user_ids' });
  }
  const url = typeof input.url === 'string' && input.url ? input.url : null;
  const dryRun = input.dry_run === true;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });

  // 대상 토큰 — 한 번에 1000행까지만 오므로 끊어서 모은다
  const tokens: string[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from('push_tokens').select('token').eq('platform', 'ios').order('token').range(from, from + 999);
    if (userIds) q = q.in('user_id', userIds);
    const { data, error } = await q;
    if (error) return json(500, { error: 'token_query_failed', detail: error.message });
    tokens.push(...data.map(r => r.token as string));
    if (data.length < 1000) break;
  }

  if (dryRun) return json(200, { dry_run: true, targets: tokens.length });
  if (tokens.length === 0) return json(200, { targets: 0, sent: 0, failed: 0, removed: 0 });

  for (const name of ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_PRIVATE_KEY']) {
    if (!Deno.env.get(name)) return json(500, { error: 'apns_not_configured', missing: name });
  }

  let jwt: string;
  try { jwt = await apnsJwt(); } catch (e) {
    return json(500, { error: 'apns_key_invalid', detail: String(e) });
  }

  const alert: Record<string, string> = {};
  if (title) alert.title = title;
  if (body) alert.body = body;
  // url 은 aps 밖에 둔다 — 앱에서는 notification.data.url 로 읽힌다
  const payload = JSON.stringify({ aps: { alert, sound: 'default' }, ...(url ? { url } : {}) });
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') || 'kr.steppy.app';

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  const reasons: Record<string, number> = {};
  for (let i = 0; i < tokens.length; i += BATCH) {
    const chunk = tokens.slice(i, i + BATCH);
    const outcomes = await Promise.all(
      chunk.map(t => sendOne(t, payload, jwt, bundleId).catch(e => ({ result: 'failed', reason: String(e) }) as Outcome))
    );
    outcomes.forEach((o, j) => {
      if (o.result === 'sent') sent++;
      else if (o.result === 'gone') gone.push(chunk[j]);
      else failed++;
      if (o.reason) reasons[o.reason] = (reasons[o.reason] || 0) + 1;
    });
  }

  if (gone.length) await admin.from('push_tokens').delete().in('token', gone);

  return json(200, { targets: tokens.length, sent, failed, removed: gone.length, reasons });
});
