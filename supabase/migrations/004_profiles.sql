-- A short private profile per user, used only to tailor explanations,
-- plus a cache of personalised impact write-ups so each is generated once.
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_impacts (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null references public.explainers(key) on delete cascade,
  phash      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.profiles enable row level security;
alter table public.personal_impacts enable row level security;
