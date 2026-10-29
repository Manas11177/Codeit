-- Code Mentor database schema (Supabase Postgres).
-- Safe to run more than once.

create table if not exists languages (
    id serial primary key,
    name text not null unique
);

create table if not exists modules (
    id serial primary key,
    language_id integer not null references languages (id) on delete cascade,
    title text not null,
    sequence_no integer not null default 0
);

create table if not exists lessons (
    id serial primary key,
    module_id integer not null references modules (id) on delete cascade,
    title text not null,
    concept_text text not null default '',
    starter_code text not null default '',
    sequence_no integer not null default 0
);

create table if not exists test_cases (
    id serial primary key,
    lesson_id integer not null references lessons (id) on delete cascade,
    input text not null default '',
    expected_output text not null default ''
);

-- user_id is the Supabase Auth user id (auth.users.id).
create table if not exists progress (
    id serial primary key,
    user_id uuid not null,
    lesson_id text not null,
    status text not null default 'in_progress',
    attempts integer not null default 0,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (user_id, lesson_id)
);

create table if not exists hint_logs (
    id serial primary key,
    user_id uuid not null,
    lesson_id text not null,
    hint_level integer not null default 1,
    ai_response text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists paste_events (
    id serial primary key,
    user_id uuid not null,
    lesson_id text not null,
    blocked boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists modules_language_idx on modules (language_id);
create index if not exists lessons_module_idx on lessons (module_id);
create index if not exists test_cases_lesson_idx on test_cases (lesson_id);
create index if not exists progress_user_idx on progress (user_id);
create index if not exists hint_logs_user_idx on hint_logs (user_id);
create index if not exists paste_events_user_idx on paste_events (user_id);

-- The publishable key ships to the browser, so block direct table access
-- through the Supabase Data API. The Express server connects as the
-- postgres role, which bypasses RLS.
alter table languages enable row level security;
alter table modules enable row level security;
alter table lessons enable row level security;
alter table test_cases enable row level security;
alter table progress enable row level security;
alter table hint_logs enable row level security;
alter table paste_events enable row level security;

insert into languages (id, name)
values (1, 'Python')
on conflict (id) do nothing;

insert into modules (id, language_id, title, sequence_no)
values
    (1, 1, 'Python Foundations', 1),
    (2, 1, 'Variables & Data Types', 2),
    (3, 1, 'Control Flow', 3),
    (4, 1, 'Functions', 4),
    (5, 1, 'Collections & Problem Solving', 5)
on conflict (id) do nothing;

select setval('languages_id_seq', greatest((select max(id) from languages), 1));
select setval('modules_id_seq', greatest((select max(id) from modules), 1));
