-- ============================================================
-- 사용자별 데이터 스키마 (로그인 도입)
--
-- 지금까지 js/state.js가 브라우저 localStorage에만 들고 있던 프로필 / 즐겨찾기 /
-- 지망 / 확정 학교 / 할 일을 auth.users에 묶어 서버로 옮긴다.
-- schema.sql의 참고 데이터(schools 등)는 "누구나 읽기"지만, 여기 네 테이블은
-- 전부 RLS로 "자기 행만" 접근하도록 잠근다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- (이미 적용된 프로젝트: iejxyrqjhqevbmgwcmwf)
-- ============================================================

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  major text,
  gpa numeric(4,2),
  gpa_scale numeric(4,2) default 4.3,
  -- MOCK.defaultProfile.languageTests: [{type:'TOEFL', score:96}]
  -- 시험 종류(TOEFL/IELTS/HSK/DELE…)와 개수가 열려 있어 jsonb로 둔다.
  language_tests jsonb not null default '[]'::jsonb,
  -- exchangeTerm: {unit:'semester', season:'가을학기', year:2027}
  exchange_term jsonb,
  confirmed_school_id text references public.schools(id) on delete set null,
  target_scores jsonb,
  -- 온보딩을 완료했거나 건너뛴 시각. null이면 아직 한 번도 안내하지 않은 계정.
  -- "프로필이 비어 있다"와 "물어봤다"는 다른 정보다 — 건너뛴 사용자에게 매번
  -- 다시 묻지 않으려면 후자를 따로 기록해야 한다.
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- user_favorites
create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id text not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, school_id)
);

-- -------------------------------------------------------- user_wishlist
-- 1~3지망. 같은 학교를 두 순위에 넣을 수 없다.
create table if not exists public.user_wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  school_id text not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, rank),
  constraint user_wishlist_school_once unique (user_id, school_id)
);

-- ----------------------------------------------------------- user_todos
-- base_id가 있으면 MOCK.todos 기본 항목의 완료 여부 오버라이드,
-- 없으면 사용자가 캘린더에서 직접 추가한 항목.
create table if not exists public.user_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  base_id text,
  title text,
  due_date date,
  tag text,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_todos_shape check (
    (base_id is not null) or (title is not null and due_date is not null)
  ),
  -- 조건절 없는 일반 유니크 제약이어야 한다. 부분 인덱스(where base_id is not null)로
  -- 만들면 PostgREST의 upsert가 ON CONFLICT (user_id, base_id)를 추론하지 못해
  -- 42P10으로 실패한다. Postgres는 유니크 제약에서 NULL을 서로 다른 값으로 보므로,
  -- base_id가 NULL인 커스텀 할 일은 여러 행이 그대로 공존한다.
  constraint user_todos_base_once unique (user_id, base_id)
);

create index if not exists user_todos_user_idx on public.user_todos (user_id);
create index if not exists user_favorites_user_idx on public.user_favorites (user_id);

create trigger user_todos_touch_updated_at
  before update on public.user_todos
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS
alter table public.profiles       enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_wishlist  enable row level security;
alter table public.user_todos     enable row level security;

-- auth.uid()를 (select ...)로 감싸면 행마다 재평가하지 않고 한 번만 계산된다.
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

create policy user_favorites_select_own on public.user_favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_favorites_insert_own on public.user_favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_favorites_delete_own on public.user_favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy user_wishlist_select_own on public.user_wishlist
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_wishlist_insert_own on public.user_wishlist
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_wishlist_update_own on public.user_wishlist
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_wishlist_delete_own on public.user_wishlist
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy user_todos_select_own on public.user_todos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_todos_insert_own on public.user_todos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_todos_update_own on public.user_todos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_todos_delete_own on public.user_todos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------- 가입 시 프로필 행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------- 가입 도메인 제한 (연세 메일)
-- 클라이언트에서만 검사하면 소용이 없다. anon 키는 js/supabase-client.js에 그대로
-- 들어 있어 누구나 /auth/v1/signup 을 직접 호출할 수 있다. 실제 차단은 여기서 한다.
-- auth.users의 BEFORE INSERT라 이메일 가입이든 소셜 로그인이든 모두 통과해야 한다.
create or replace function public.enforce_yonsei_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- '%@yonsei.ac.kr' 는 정확히 그 도메인으로 끝나는 주소만 통과시킨다
  -- (foo@sub.yonsei.ac.kr 같은 하위 도메인은 걸러진다 — 필요하면 조건을 넓힐 것)
  if new.email is null or lower(new.email) not like '%@yonsei.ac.kr' then
    raise exception 'yonsei_email_required'
      using errcode = 'check_violation',
            hint = '연세대학교 메일(@yonsei.ac.kr)로만 가입할 수 있어요.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_yonsei_email_on_signup on auth.users;
create trigger enforce_yonsei_email_on_signup
  before insert on auth.users
  for each row execute function public.enforce_yonsei_email();

revoke execute on function public.enforce_yonsei_email() from anon, authenticated, public;

-- 세 함수는 모두 트리거 전용이다. 트리거는 테이블 소유자 컨텍스트로 실행되므로
-- EXECUTE 권한이 없어도 동작한다. 권한이 남아 있으면 SECURITY DEFINER 함수를
-- /rest/v1/rpc/... 로 외부에서 직접 호출할 수 있게 되므로 회수한다.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
