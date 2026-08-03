-- Gunpula CMS backend
-- Run this once in Supabase SQL Editor. It keeps the static catalog as the
-- immutable base and stores only reviewed admin changes and published patches.

create extension if not exists pgcrypto;

create table if not exists public.gunpula_cms_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Administrator',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gunpula_cms_changes (
  id bigint generated always as identity primary key,
  batch_id uuid not null default gen_random_uuid(),
  entity_type text not null check (entity_type in ('product', 'category', 'merge', 'source', 'image_task', 'review')),
  entity_id text not null,
  operation text not null check (operation in ('add', 'edit', 'move', 'hide', 'merge', 'repair', 'ignore')),
  patch jsonb not null default '{}'::jsonb,
  before_value jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'undone', 'published')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  published_revision bigint
);

create index if not exists gunpula_cms_changes_status_id
  on public.gunpula_cms_changes (status, id desc);

create table if not exists public.gunpula_cms_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0,
  payload jsonb not null default jsonb_build_object(
    'products', '{}'::jsonb,
    'added', '{}'::jsonb,
    'categories', '{}'::jsonb,
    'merges', '{}'::jsonb,
    'sources', '{}'::jsonb,
    'image_tasks', '{}'::jsonb,
    'reviews', '{}'::jsonb
  ),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.gunpula_cms_releases (
  id bigint generated always as identity primary key,
  revision bigint not null unique,
  note text not null default '',
  change_count integer not null default 0,
  payload jsonb not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now()
);

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

insert into public.gunpula_cms_state (singleton)
values (true)
on conflict (singleton) do nothing;

-- Initial owner. Change the email here if the administrator account differs.
insert into public.gunpula_cms_admins (user_id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
  from auth.users
 where lower(email) = lower('mdefitko@gmail.com')
on conflict (user_id) do update
  set email = excluded.email,
      enabled = true;

alter table public.gunpula_cms_admins enable row level security;
alter table public.gunpula_cms_changes enable row level security;
alter table public.gunpula_cms_state enable row level security;
alter table public.gunpula_cms_releases enable row level security;
alter table public.gunpula_search_misses enable row level security;

revoke all on public.gunpula_cms_admins from anon, authenticated;
revoke all on public.gunpula_cms_changes from anon, authenticated;
revoke all on public.gunpula_cms_state from anon, authenticated;
revoke all on public.gunpula_cms_releases from anon, authenticated;
revoke all on public.gunpula_search_misses from anon, authenticated;

create or replace function public.gunpula_cms_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from public.gunpula_cms_admins
     where user_id = auth.uid()
       and enabled
  );
$$;

create or replace function public.gunpula_cms_assert_admin()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.gunpula_cms_is_admin() then
    raise exception 'gunpula cms administrator access required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.gunpula_cms_get_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  perform public.gunpula_cms_assert_admin();
  select jsonb_build_object(
    'admin', (
      select jsonb_build_object('user_id', user_id, 'email', email, 'display_name', display_name)
        from public.gunpula_cms_admins
       where user_id = auth.uid()
    ),
    'published', (
      select jsonb_build_object('revision', revision, 'payload', payload, 'updated_at', updated_at)
        from public.gunpula_cms_state
       where singleton
    ),
    'drafts', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.id)
        from public.gunpula_cms_changes c
       where c.status = 'draft'
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.id desc)
        from (
          select *
            from public.gunpula_cms_changes
           order by id desc
           limit 150
        ) c
    ), '[]'::jsonb),
    'releases', coalesce((
      select jsonb_agg(to_jsonb(r) - 'payload' order by r.revision desc)
        from (
          select *
            from public.gunpula_cms_releases
           order by revision desc
           limit 50
        ) r
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.gunpula_cms_save_change(
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_patch jsonb,
  p_before_value jsonb default '{}'::jsonb,
  p_batch_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inserted public.gunpula_cms_changes%rowtype;
begin
  perform public.gunpula_cms_assert_admin();
  if p_entity_type not in ('product', 'category', 'merge', 'source', 'image_task', 'review') then
    raise exception 'invalid cms entity type' using errcode = '22023';
  end if;
  if p_operation not in ('add', 'edit', 'move', 'hide', 'merge', 'repair', 'ignore') then
    raise exception 'invalid cms operation' using errcode = '22023';
  end if;
  if nullif(trim(p_entity_id), '') is null then
    raise exception 'cms entity id required' using errcode = '22023';
  end if;
  if pg_column_size(coalesce(p_patch, '{}'::jsonb)) > 1048576 then
    raise exception 'cms patch exceeds 1 MB' using errcode = '22023';
  end if;

  insert into public.gunpula_cms_changes (
    batch_id, entity_type, entity_id, operation, patch, before_value, created_by
  ) values (
    coalesce(p_batch_id, gen_random_uuid()),
    p_entity_type,
    trim(p_entity_id),
    p_operation,
    coalesce(p_patch, '{}'::jsonb),
    coalesce(p_before_value, '{}'::jsonb),
    auth.uid()
  )
  returning * into inserted;
  return to_jsonb(inserted);
end;
$$;

create or replace function public.gunpula_cms_save_batch(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  item jsonb;
  batch uuid := gen_random_uuid();
  inserted jsonb := '[]'::jsonb;
begin
  perform public.gunpula_cms_assert_admin();
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'cms batch must be a non-empty array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) > 5000 or pg_column_size(p_changes) > 8388608 then
    raise exception 'cms batch is too large' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_changes)
  loop
    inserted := inserted || jsonb_build_array(public.gunpula_cms_save_change(
      item ->> 'entity_type',
      item ->> 'entity_id',
      item ->> 'operation',
      coalesce(item -> 'patch', '{}'::jsonb),
      coalesce(item -> 'before_value', '{}'::jsonb),
      batch
    ));
  end loop;
  return inserted;
end;
$$;

create or replace function public.gunpula_cms_undo_change(p_change_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  changed public.gunpula_cms_changes%rowtype;
  target_batch uuid;
  undone_count integer;
begin
  perform public.gunpula_cms_assert_admin();
  select *
    into changed
    from public.gunpula_cms_changes
   where id = p_change_id
     and status = 'draft';
  target_batch := changed.batch_id;
  if target_batch is null then
    raise exception 'draft change not found' using errcode = '22023';
  end if;

  update public.gunpula_cms_changes
     set status = 'undone'
   where batch_id = target_batch
     and status = 'draft';
  get diagnostics undone_count = row_count;
  return to_jsonb(changed) || jsonb_build_object('status', 'undone', 'undone_count', undone_count);
end;
$$;

create or replace function public.gunpula_cms_publish(p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_payload jsonb;
  next_payload jsonb;
  next_revision bigint;
  draft_count integer;
  change_row public.gunpula_cms_changes%rowtype;
  current_value jsonb;
begin
  perform public.gunpula_cms_assert_admin();

  select payload, revision + 1
    into current_payload, next_revision
    from public.gunpula_cms_state
   where singleton
   for update;
  next_payload := current_payload;

  select count(*) into draft_count
    from public.gunpula_cms_changes
   where status = 'draft';
  if draft_count = 0 then
    raise exception 'no draft changes to publish' using errcode = '22023';
  end if;

  for change_row in
    select *
      from public.gunpula_cms_changes
     where status = 'draft'
     order by id
  loop
    if change_row.entity_type = 'product' and change_row.operation = 'add' then
      current_value := coalesce(next_payload #> array['added', change_row.entity_id], '{}'::jsonb);
      next_payload := jsonb_set(next_payload, array['added', change_row.entity_id], current_value || change_row.patch, true);
    elsif change_row.entity_type = 'product' then
      current_value := coalesce(next_payload #> array['products', change_row.entity_id], '{}'::jsonb);
      next_payload := jsonb_set(next_payload, array['products', change_row.entity_id], current_value || change_row.patch, true);
    elsif change_row.entity_type = 'category' then
      current_value := coalesce(next_payload #> array['categories', change_row.entity_id], '{}'::jsonb);
      next_payload := jsonb_set(next_payload, array['categories', change_row.entity_id], current_value || change_row.patch, true);
    elsif change_row.entity_type = 'merge' then
      next_payload := jsonb_set(next_payload, array['merges', change_row.entity_id], to_jsonb(change_row.patch ->> 'target_id'), true);
    elsif change_row.entity_type = 'source' then
      current_value := coalesce(next_payload #> array['sources', change_row.entity_id], '{}'::jsonb);
      next_payload := jsonb_set(next_payload, array['sources', change_row.entity_id], current_value || change_row.patch, true);
    elsif change_row.entity_type = 'image_task' then
      current_value := coalesce(next_payload #> array['image_tasks', change_row.entity_id], '{}'::jsonb);
      next_payload := jsonb_set(next_payload, array['image_tasks', change_row.entity_id], current_value || change_row.patch, true);
    elsif change_row.entity_type = 'review' then
      current_value := coalesce(next_payload #> array['reviews', change_row.entity_id], '{}'::jsonb);
      next_payload := jsonb_set(next_payload, array['reviews', change_row.entity_id], current_value || change_row.patch, true);
    end if;
  end loop;

  update public.gunpula_cms_state
     set revision = next_revision,
         payload = next_payload,
         updated_by = auth.uid(),
         updated_at = now()
   where singleton;

  insert into public.gunpula_cms_releases (
    revision, note, change_count, payload, published_by
  ) values (
    next_revision, coalesce(p_note, ''), draft_count, next_payload, auth.uid()
  );

  update public.gunpula_cms_changes
     set status = 'published',
         published_revision = next_revision
   where status = 'draft';

  return jsonb_build_object(
    'revision', next_revision,
    'change_count', draft_count,
    'updated_at', now()
  );
end;
$$;

create or replace function public.gunpula_cms_update_release_note(
  p_revision bigint,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated public.gunpula_cms_releases%rowtype;
begin
  perform public.gunpula_cms_assert_admin();
  if length(coalesce(p_note, '')) > 2000 then
    raise exception 'release note exceeds 2000 characters' using errcode = '22023';
  end if;

  update public.gunpula_cms_releases
     set note = coalesce(p_note, '')
   where revision = p_revision
  returning * into updated;
  if updated.id is null then
    raise exception 'cms release not found' using errcode = '22023';
  end if;
  return to_jsonb(updated) - 'payload';
end;
$$;

create or replace function public.gunpula_cms_get_published()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'revision', revision,
    'payload', payload,
    'updated_at', updated_at
  )
  from public.gunpula_cms_state
  where singleton;
$$;

create or replace function public.gunpula_log_search_miss(p_query text, p_normalized_query text, p_franchise text default 'all', p_language text default 'zh')
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  clean_query text := left(trim(coalesce(p_query, '')), 160);
  clean_normalized text := left(trim(coalesce(p_normalized_query, '')), 160);
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if length(clean_query) < 2 or length(clean_normalized) < 2 then return; end if;
  insert into public.gunpula_search_misses (query, normalized_query, franchise, language)
  values (clean_query, clean_normalized, left(coalesce(nullif(p_franchise, ''), 'all'), 40), left(coalesce(nullif(p_language, ''), 'zh'), 8))
  on conflict (normalized_query, franchise, language) do update
    set query = excluded.query, count = public.gunpula_search_misses.count + 1, last_seen_at = now();
end;
$$;

create or replace function public.gunpula_cms_get_search_misses()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare result jsonb;
begin
  perform public.gunpula_cms_assert_admin();
  select coalesce(jsonb_agg(to_jsonb(m) order by m.count desc, m.last_seen_at desc), '[]'::jsonb) into result
    from (select id, query, normalized_query, franchise, language, count, first_seen_at, last_seen_at from public.gunpula_search_misses order by count desc, last_seen_at desc limit 250) m;
  return result;
end;
$$;

revoke all on function public.gunpula_cms_is_admin() from public, anon, authenticated;
revoke all on function public.gunpula_cms_assert_admin() from public, anon, authenticated;
revoke all on function public.gunpula_cms_get_bootstrap() from public, anon, authenticated;
revoke all on function public.gunpula_cms_save_change(text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.gunpula_cms_save_batch(jsonb) from public, anon, authenticated;
revoke all on function public.gunpula_cms_undo_change(bigint) from public, anon, authenticated;
revoke all on function public.gunpula_cms_publish(text) from public, anon, authenticated;
revoke all on function public.gunpula_cms_update_release_note(bigint, text) from public, anon, authenticated;
revoke all on function public.gunpula_cms_get_published() from public, anon, authenticated;
revoke all on function public.gunpula_log_search_miss(text, text, text, text) from public, anon, authenticated;
revoke all on function public.gunpula_cms_get_search_misses() from public, anon, authenticated;

grant execute on function public.gunpula_cms_get_bootstrap() to authenticated;
grant execute on function public.gunpula_cms_save_change(text, text, text, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.gunpula_cms_save_batch(jsonb) to authenticated;
grant execute on function public.gunpula_cms_undo_change(bigint) to authenticated;
grant execute on function public.gunpula_cms_publish(text) to authenticated;
grant execute on function public.gunpula_cms_update_release_note(bigint, text) to authenticated;
grant execute on function public.gunpula_cms_get_published() to anon, authenticated;
grant execute on function public.gunpula_log_search_miss(text, text, text, text) to authenticated;
grant execute on function public.gunpula_cms_get_search_misses() to authenticated;
