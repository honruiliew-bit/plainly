-- One table for both the shared news feed and user-pasted explanations.
-- The backend uses the service key (bypasses RLS). RLS is enabled with no
-- policies so the anon key can never read or write this table directly.

create table if not exists public.explainers (
  key          text primary key,
  kind         text not null check (kind in ('feed', 'custom')),
  title        text not null,
  source       text,
  url          text,
  published_at timestamptz,
  payload      jsonb not null,
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists explainers_feed_idx
  on public.explainers (kind, published_at desc nulls last);
create index if not exists explainers_user_idx
  on public.explainers (user_id, created_at desc);

alter table public.explainers enable row level security;