create table if not exists results (
  id uuid primary key,
  nickname text not null check (char_length(nickname) between 2 and 20),
  scenario_id text not null,
  mode text not null check (mode in ('learning', 'exam')),
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  breakdown jsonb not null,
  errors jsonb not null,
  events jsonb not null,
  duration_sec integer not null check (duration_sec >= 0),
  locale text not null check (locale in ('ru', 'kk')),
  app_version text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists results_board_idx
  on results (mode, created_at desc) where not hidden;
