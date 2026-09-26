-- Per-user saved articles. Explain results are saved automatically;
-- feed stories with a deep dive can be saved with the Save button.
create table if not exists public.saved_items (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null references public.explainers(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists saved_items_user_idx on public.saved_items (user_id, created_at desc);

alter table public.saved_items enable row level security;
