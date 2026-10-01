-- ============================================================
-- Mentor's Step — 상단 고정 글 (공지 · 교환보고서 · 칼럼)
--
-- 게시판 맨 위에 항상 붙어 있는 글. 운영자가 Supabase 대시보드(Table Editor)에서
-- 직접 행을 넣고 고친다 — 앱 업데이트(심사) 없이 바로 바뀐다.
-- 앱에서는 읽기만 되고 쓰기 정책이 없어서 누구도 앱으로 고정 글을 만들 수 없다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- 글 올리는 법: Table Editor → mentor_pins → Insert row
--   kind        notice(공지) | report(교환보고서) | column(칼럼)
--   title       목록에 보이는 제목
--   body        본문(줄바꿈 그대로 보인다)
--   author_label 작성자 표시(기본 '운영진' — 선배 이름·학교 등 자유롭게)
--   sort_order  작을수록 위(같으면 최신 글이 위)
--   published   false 로 두면 숨김(초안 · 내릴 때)
-- ============================================================

create table if not exists public.mentor_pins (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'notice' check (kind in ('notice', 'report', 'column')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  author_label text not null default '운영진',
  sort_order integer not null default 100,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists mentor_pins_order_idx
  on public.mentor_pins (sort_order, created_at desc) where published;

alter table public.mentor_pins enable row level security;

-- 누구나(비로그인 포함) 공개된 글만 읽는다. 쓰기 정책은 일부러 만들지 않는다 —
-- 대시보드(service role)에서만 넣고 고친다.
create policy mentor_pins_public_read on public.mentor_pins
  for select to anon, authenticated using (published);
