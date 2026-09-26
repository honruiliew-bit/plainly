-- Allow two more row kinds: 'brief' (the daily brief) and 'skip'
-- (non-finance stories we already looked at, so we never re-check them).
alter table public.explainers drop constraint if exists explainers_kind_check;
alter table public.explainers
  add constraint explainers_kind_check check (kind in ('feed', 'custom', 'brief', 'skip'));
