-- 학생 타자 연습 기록
-- 학생은 익명으로 "쓰기만" 할 수 있고, 읽기는 로그인한 교사만 가능하다.
create table public.runs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  class_code    text not null,          -- 반 (예: 1-3)
  student_name  text not null,
  student_no    text,                   -- 학번 (선택)

  level_id      text not null,
  level_name    text not null,
  grade         text not null,

  kpm           integer not null,
  accuracy      integer not null,
  errors        integer not null,
  best_combo    integer not null,
  seconds       integer not null,
  chars         integer not null,

  -- 값 범위를 DB에서 막는다. 클라이언트를 신뢰하지 않는다.
  constraint runs_class_len    check (char_length(class_code)   between 1 and 16),
  constraint runs_name_len     check (char_length(student_name) between 1 and 20),
  constraint runs_no_len       check (student_no is null or char_length(student_no) <= 16),
  constraint runs_level_valid  check (level_id in ('words','symbols','lines')),
  constraint runs_lname_len    check (char_length(level_name)   between 1 and 32),
  constraint runs_grade_valid  check (grade in ('S','A','B','C','D')),
  constraint runs_kpm_range    check (kpm        between 0 and 2000),
  constraint runs_acc_range    check (accuracy   between 0 and 100),
  constraint runs_err_range    check (errors     between 0 and 100000),
  constraint runs_combo_range  check (best_combo between 0 and 100000),
  constraint runs_sec_range    check (seconds    between 1 and 7200),
  constraint runs_chars_range  check (chars      between 1 and 100000)
);

comment on table public.runs is '학생 타자 연습 1회 기록. 익명 INSERT 허용, SELECT 는 교사(authenticated) 전용.';

create index runs_created_at_idx on public.runs (created_at desc);
create index runs_class_name_idx on public.runs (class_code, student_name);
create index runs_level_idx      on public.runs (level_id);

alter table public.runs enable row level security;

-- 학생: 기록을 남기기만 한다. 남의 기록은 물론 자기 기록도 다시 읽을 수 없다.
create policy "anon_insert_only"
  on public.runs for insert to anon
  with check (true);

-- 교사: 로그인해야 전체를 읽는다.
create policy "auth_select_all"
  on public.runs for select to authenticated
  using (true);

-- 교사: 시험 삼아 남긴 기록 등을 지울 수 있다.
create policy "auth_delete"
  on public.runs for delete to authenticated
  using (true);


-- 학생별 요약. security_invoker 로 RLS 가 그대로 적용된다 (익명은 못 읽음).
create view public.student_summary
with (security_invoker = true) as
select
  class_code,
  student_name,
  count(*)                                      as runs,
  max(kpm)                                      as best_kpm,
  round(avg(kpm))::int                          as avg_kpm,
  round(avg(accuracy))::int                     as avg_accuracy,
  max(best_combo)                               as best_combo,
  sum(errors)                                   as total_errors,
  min(created_at)                               as first_at,
  max(created_at)                               as last_at,
  count(*) filter (where level_id = 'words')    as runs_words,
  count(*) filter (where level_id = 'symbols')  as runs_symbols,
  count(*) filter (where level_id = 'lines')    as runs_lines
from public.runs
group by class_code, student_name;

comment on view public.student_summary is '학생별 집계. 교사 대시보드 전용.';
