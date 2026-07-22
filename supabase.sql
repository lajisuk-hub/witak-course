-- 신규위탁 과정 앱이 쓰는 표 3개.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 을 누르면 됩니다.
-- (이미 만들어져 있으면 아무 일도 일어나지 않습니다)
--
-- 프로젝트: 인스타그램 챌린지 (mrkkbrgcalribhfrtqlm)
-- 이름 앞의 witak_ 는 다른 앱 자료와 섞이지 않게 하려는 것입니다.

-- 1) 수강생 명단 ────────────────────────────────
create table if not exists witak_students (
  phone       text primary key,              -- 하이픈 없는 전화번호. 이게 로그인 아이디
  name        text not null,
  region      text,                          -- 지금 계신 지역
  target      text,                          -- 지원하고 싶은 지역
  allowed     boolean not null default true, -- 원장님이 끌 수 있음(외부인 차단)
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

-- 2) 원장님이 올리는 날짜별 할 일 ────────────────
create table if not exists witak_tasks (
  id          bigint generated always as identity primary key,
  due_date    date not null,                 -- 이 날 해야 할 일
  title       text not null,
  detail      text,
  step        int,                            -- 관련 차시(없으면 비움)
  created_at  timestamptz not null default now()
);
create index if not exists witak_tasks_date on witak_tasks (due_date);

-- 3) 수강생이 누른 체크 ──────────────────────────
create table if not exists witak_checks (
  phone       text not null,
  task_id     bigint not null references witak_tasks (id) on delete cascade,
  checked_at  timestamptz not null default now(),
  primary key (phone, task_id)
);
create index if not exists witak_checks_phone on witak_checks (phone);

-- 4) 잠금 ────────────────────────────────────────
-- 앱은 서버쪽 열쇠로만 접근하므로, 브라우저에서 직접 읽지 못하게 막아 둔다.
alter table witak_students enable row level security;
alter table witak_tasks    enable row level security;
alter table witak_checks   enable row level security;
