/**
 * delete-account — 앱 안에서 계정을 지우는 서버 함수.
 *
 * 왜 Edge Function인가
 *   App Store 심사 가이드라인 5.1.1(v)는 앱에서 계정을 만들 수 있으면 앱에서
 *   지울 수도 있어야 한다고 요구한다. 그런데 계정 삭제는 anon 키로 할 수 없고,
 *   service_role 키는 프론트에 둘 수 없다. 그래서 서버에서만 도는 이 함수가
 *   호출자의 JWT로 "누구인지"를 확인한 뒤, 그 사람만 지운다.
 *
 *   SQL 함수(security definer)로도 auth.users는 지울 수 있지만 사진은 못 지운다 —
 *   Supabase가 storage.objects 직접 삭제를 트리거로 막아 두었고(고아 파일 방지),
 *   실물 파일까지 지우려면 Storage API를 타야 한다. 두 가지를 한 번에 하려면
 *   여기가 유일한 자리다.
 *
 * 지우는 것
 *   diary-photos/<uid>/* 사진 파일 전부, 그리고 auth.users 행 하나.
 *   profiles / user_favorites / user_wishlist / user_todos / user_journal 은
 *   auth.users(id) on delete cascade 라 함께 사라진다.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  // 앱(capacitor://localhost)과 웹 양쪽에서 부른다. 인증은 JWT로 하고 쿠키를
  // 쓰지 않으므로 오리진을 좁혀도 얻는 것이 없다.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'missing_authorization' });

  const url = Deno.env.get('SUPABASE_URL')!;

  // 1) 호출자가 누구인지 확인. 토큰이 말하는 사람만 지운다 — 요청 본문에서
  //    대상 id를 받지 않는 것이 핵심이다.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } }
  });
  const { data: { user }, error: whoError } = await caller.auth.getUser();
  if (whoError || !user) return json(401, { error: 'invalid_token' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  });

  // 2) 사진 먼저. 계정을 먼저 지우면 이 파일들의 주인을 알 수 없게 된다.
  //    한 번에 100장씩 끊어 가져온다(Storage list 기본 한도).
  let removed = 0;
  for (;;) {
    const { data: files, error } = await admin.storage
      .from('diary-photos')
      .list(user.id, { limit: 100 });
    if (error) return json(500, { error: 'storage_list_failed', detail: error.message });
    if (!files || files.length === 0) break;

    const paths = files.map(f => `${user.id}/${f.name}`);
    const { error: rmError } = await admin.storage.from('diary-photos').remove(paths);
    if (rmError) return json(500, { error: 'storage_remove_failed', detail: rmError.message });
    removed += paths.length;

    if (files.length < 100) break;
  }

  // 3) 계정. 나머지 테이블은 cascade 로 함께 지워진다.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json(500, { error: 'delete_user_failed', detail: deleteError.message });

  return json(200, { deleted: true, photos_removed: removed });
});
