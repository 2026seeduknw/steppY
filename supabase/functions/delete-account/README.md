# delete-account

앱 안의 **회원 탈퇴** 버튼이 부르는 Edge Function. 호출자의 JWT로 본인 확인을 한 뒤
사진(Storage)과 계정(auth.users)을 지운다. `profiles` / `user_favorites` /
`user_wishlist` / `user_todos` / `user_journal` 은 `auth.users(id) on delete cascade`
라 함께 사라진다.

App Store 심사 가이드라인 5.1.1(v) — 앱에서 계정을 만들 수 있으면 앱에서 지울 수도
있어야 한다 — 을 만족시키기 위한 것이라, 이게 죽으면 탈퇴가 막히고 재심사에서 걸린다.

## 왜 SQL 함수가 아닌가

처음에는 `public.delete_own_account()`(security definer)로 만들었는데, 사진을 못
지운다. Supabase가 `storage.objects` 직접 삭제를 트리거(`storage.protect_delete`)로
막아 두었고 — 고아 파일이 생기는 것을 방지한다 — 실물 파일까지 지우려면 Storage API를
타야 한다. 그 한 줄 때문에 탈퇴 전체가 실패했다. 그래서 SQL 함수는 없앴고
(마이그레이션 `drop_delete_own_account_rpc`), 삭제 경로는 이 함수 하나뿐이다.

## 배포

    npx supabase functions deploy delete-account --project-ref iejxyrqjhqevbmgwcmwf

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase가
자동으로 넣어 주므로 따로 설정할 것이 없다. `verify_jwt` 는 켜 둔다.

## 확인

로그인한 계정의 access token으로:

    curl -X POST https://iejxyrqjhqevbmgwcmwf.supabase.co/functions/v1/delete-account \
      -H "apikey: <anon key>" -H "Authorization: Bearer <access token>"
    # {"deleted":true,"photos_removed":0}
