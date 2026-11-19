-- 베타 테스트 계정 (@steppy.test) — 2026-11-15
--
-- 가입은 원래 연세 메일(@yonsei.ac.kr)만 된다(auth_schema.sql의 enforce_yonsei_email 트리거).
-- 테스트용으로 @steppy.test 주소를 하나 더 허용한다.
--   - Supabase 대시보드 Authentication → Users → Add user → Create new user 에서
--     "Auto Confirm User"를 켜고 만든다 — 인증 메일 없이 바로 로그인된다.
--   - 앱 화면에서는 이 주소로 가입을 막는다(js/auth-page.js). API로 직접 만들어도
--     그 주소로는 인증 메일을 받을 수 없어서 로그인할 수 없다.
--   - 그래서 Authentication → Sign In / Providers 의 "Confirm email"은 꼭 켜 둔다.
--     꺼져 있으면 가입하자마자 로그인돼 누구나 @steppy.test로 들어올 수 있다.
--
-- 순서
--   1) 아래 [1단계]를 SQL Editor에서 실행
--   2) 대시보드에서 test1@steppy.test ~ test5@steppy.test 만들기(Auto Confirm 켜기)
--   3) 아래 [2단계]를 실행 — 이름, 서로 친구, 오늘 기록 하나씩

-- ============================================================ [1단계] 테스트 주소 허용
create or replace function public.enforce_yonsei_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and lower(new.email) like '%@yonsei.ac.kr' then
    return new;
  end if;
  -- 테스트 계정. 대시보드 Add user는 인증 전 상태로 먼저 넣고 나중에 인증 표시를 붙여서
  -- 인증 여부로는 거를 수 없다(그렇게 했다가 "Database error creating new user"가 났다).
  -- 대신 Confirm email을 켜 두면 남이 API로 만든 @steppy.test 계정은 메일 인증을 못 해 로그인할 수 없다.
  if new.email is not null and lower(new.email) like '%@steppy.test' then
    return new;
  end if;
  raise exception 'yonsei_email_required'
    using errcode = 'check_violation',
          hint = '연세대학교 메일(@yonsei.ac.kr)로만 가입할 수 있어요.';
end;
$$;

revoke execute on function public.enforce_yonsei_email() from anon, authenticated, public;


-- ============================================================ [2단계] 계정을 만든 뒤 실행
-- 여러 번 실행해도 된다(이름은 덮어쓰고, 친구·기록은 겹치지 않게 넣는다).

-- 이름 — 대시보드에서 만들면 이름이 비어 있다
update public.profiles p
set name = '테스트' || substring(u.email from 'test(\d+)@')
from auth.users u
where p.id = u.id and u.email ~ '^test\d+@steppy\.test$' and coalesce(p.name, '') = '';

-- 다섯 계정을 서로 친구로(수락된 상태)
insert into public.friendships (requester, addressee, status, responded_at)
select a.id, b.id, 'accepted', now()
from auth.users a
join auth.users b on a.id < b.id
where a.email like '%@steppy.test' and b.email like '%@steppy.test'
on conflict do nothing;

-- 오늘 기록 하나씩(글만, 친구 공개) — 기록하기 탭의 Friends Today에 바로 보인다
insert into public.user_journal (user_id, entry_date, phase, title, body, visibility, created_at)
select u.id, current_date, 'prepare', t.title, t.body, 'friends', now() - (t.mins || ' minutes')::interval
from auth.users u
join (values
  ('test1@steppy.test', '서류 챙기기 시작', E'여권 사본이랑 성적증명서 뽑아 왔다.\n어학 성적표는 다음 주에 나온다.', 20),
  ('test2@steppy.test', '1지망 고민 중', E'덴마크랑 핀란드 사이에서 아직도 고민.\n생활비 비교해 보니 비슷하다.', 65),
  ('test3@steppy.test', '토플 점수 나왔다', E'목표보다 3점 높게 나왔다.\n이제 지원서만 쓰면 된다.', 130),
  ('test4@steppy.test', '선배한테 물어봄', 'Talky에 기숙사 질문 올렸더니 바로 답이 달렸다.', 200),
  ('test5@steppy.test', '오늘의 기록', '학교 정보 보기에서 과목 찾아보는 중.', 260)
) as t(email, title, body, mins) on t.email = u.email
where not exists (
  select 1 from public.user_journal j
  where j.user_id = u.id and j.entry_date = current_date and j.title = t.title
);
