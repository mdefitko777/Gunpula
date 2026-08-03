-- Search insights upgrade for Gunpula v2.
-- Run once in Supabase SQL Editor. Search misses contain no user id, email,
-- collection data, or browsing history. Only signed-in app users may add rows;
-- only CMS administrators may read them.

create table if not exists public.gunpula_search_misses (
  id bigint generated always as identity primary key,
  query text not null,
  normalized_query text not null,
  franchise text not null default 'all',
  language text not null default 'zh',
  count bigint not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (normalized_query, franchise, language)
);

create index if not exists gunpula_search_misses_priority
  on public.gunpula_search_misses (count desc, last_seen_at desc);

alter table public.gunpula_search_misses enable row level security;
revoke all on public.gunpula_search_misses from anon, authenticated;

create or replace function public.gunpula_log_search_miss(
  p_query text,
  p_normalized_query text,
  p_franchise text default 'all',
  p_language text default 'zh'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  clean_query text := left(trim(coalesce(p_query, '')), 160);
  clean_normalized text := left(trim(coalesce(p_normalized_query, '')), 160);
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if length(clean_query) < 2 or length(clean_normalized) < 2 then
    return;
  end if;
  insert into public.gunpula_search_misses (query, normalized_query, franchise, language)
  values (clean_query, clean_normalized, left(coalesce(nullif(p_franchise, ''), 'all'), 40), left(coalesce(nullif(p_language, ''), 'zh'), 8))
  on conflict (normalized_query, franchise, language) do update
    set query = excluded.query,
        count = public.gunpula_search_misses.count + 1,
        last_seen_at = now();
end;
$$;

create or replace function public.gunpula_cms_get_search_misses()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  perform public.gunpula_cms_assert_admin();
  select coalesce(jsonb_agg(to_jsonb(m) order by m.count desc, m.last_seen_at desc), '[]'::jsonb)
    into result
    from (
      select id, query, normalized_query, franchise, language, count, first_seen_at, last_seen_at
        from public.gunpula_search_misses
       order by count desc, last_seen_at desc
       limit 250
    ) m;
  return result;
end;
$$;

revoke all on function public.gunpula_log_search_miss(text, text, text, text) from public, anon, authenticated;
revoke all on function public.gunpula_cms_get_search_misses() from public, anon, authenticated;
grant execute on function public.gunpula_log_search_miss(text, text, text, text) to authenticated;
grant execute on function public.gunpula_cms_get_search_misses() to authenticated;
