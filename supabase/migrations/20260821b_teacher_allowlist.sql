-- ────────────────────────────────────────────────────────────
-- 교사 허용목록
--
-- 문제: 이 프로젝트는 공개 가입이 열려 있고(disable_signup=false),
--       공개 키는 페이지 소스에 그대로 노출된다.
--       "로그인한 사용자면 누구나 읽기" 정책이었으므로,
--       외부인이 스스로 가입해 학생 기록을 전부 볼 수 있었다.
-- 해결: 명시적으로 등록된 교사만 읽는다. 로그인 자체는 자격이 아니다.
-- ────────────────────────────────────────────────────────────

create table public.teachers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.teachers is
  '기록 조회가 허용된 계정. 여기 없는 계정은 로그인해도 아무것도 못 본다.';

alter table public.teachers enable row level security;

-- 로그인한 사용자는 "자기 자신이 교사인지"만 확인할 수 있다.
-- 다른 교사의 행은 보이지 않는다. 대시보드는 이걸로 권한을 판별한다.
create policy "teachers_read_self"
  on public.teachers for select to authenticated
  using (user_id = (select auth.uid()));

-- runs 조회·삭제는 교사 목록에 있는 계정만.
drop policy if exists "auth_select_all" on public.runs;
drop policy if exists "auth_delete"     on public.runs;

create policy "teacher_select"
  on public.runs for select to authenticated
  using (exists (
    select 1 from public.teachers t where t.user_id = (select auth.uid())
  ));

create policy "teacher_delete"
  on public.runs for delete to authenticated
  using (exists (
    select 1 from public.teachers t where t.user_id = (select auth.uid())
  ));

-- ────────────────────────────────────────────────────────────
-- 교사 등록 방법 (계정을 먼저 만든 뒤 실행)
--
--   insert into public.teachers (user_id, email)
--   select id, email from auth.users
--   where email = '교사@이메일'
--   on conflict (user_id) do nothing;
-- ────────────────────────────────────────────────────────────
