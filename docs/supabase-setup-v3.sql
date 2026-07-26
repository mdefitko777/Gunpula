-- Gunpula friends v3: a real friend system.
--
-- Run once in the Supabase SQL Editor. Safe to run next to v1/v2: nothing here
-- drops or edits the older tables, and gunpula_v3_migrate_from_v2() copies your
-- own slice of the shared workspace across so nothing is lost.
--
-- Why v3 replaces the v2 "shared workspace + invite code" model:
--   * v2 pinned each user to exactly one workspace, for life (unique index).
--   * The invite code could not be rotated or revoked, and members could not be
--     removed — once the code leaked, the door could not be closed.
--   * Every member's collection lived in ONE shared payload, so any member's
--     save overwrote the whole blob, including everyone else's data.
--
-- v3 instead gives每人 their own row and a permanent account handle:
--   * You own your data. Friends can READ your collection, never write it.
--   * You are found by a handle you choose (like @name), not a shared secret.
--   * A request must be accepted; either side can unfriend at any time.
--   * You can have many friends instead of one group.
--
-- Privacy note: get_friend_collection deliberately returns ONLY the collection.
-- Home cover photos live in payload.appearance and are never exposed to friends.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.gunpula_v3_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- The permanent, searchable account id. Stored lowercase; handle_lookup keeps
  -- the uniqueness check case-insensitive so "Bbang" and "bbang" can't collide.
  handle text unique,
  display_name text not null default '',
  avatar text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{"schema_version":1,"collection":{"owned":[],"wanted":[],"items":{},"member_items":{}},"overrides":{},"series_label_overrides":{}}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One row per pair, keyed by the requester. status: pending -> accepted.
-- Declining deletes the row so the pair can try again later.
create table if not exists public.gunpula_v3_friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint gunpula_v3_no_self_friend check (requester_id <> addressee_id)
);

create index if not exists gunpula_v3_friendships_addressee
  on public.gunpula_v3_friendships (addressee_id, status);

alter table public.gunpula_v3_users enable row level security;
alter table public.gunpula_v3_friendships enable row level security;

-- All access goes through the security-definer RPCs below; direct table reads
-- stay denied so a leaked anon key exposes nothing.
revoke all on public.gunpula_v3_users from anon, authenticated;
revoke all on public.gunpula_v3_friendships from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.gunpula_v3_norm_handle(p_handle text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p_handle, '')));
$$;

-- Make sure the caller has a row; every RPC starts here.
create or replace function public.gunpula_v3_ensure_self()
returns public.gunpula_v3_users
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.gunpula_v3_users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'gunpula not signed in' using errcode = '42501';
  end if;
  insert into public.gunpula_v3_users (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;
  select * into me from public.gunpula_v3_users where user_id = auth.uid();
  return me;
end;
$$;

create or replace function public.gunpula_v3_public_profile(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'handle', u.handle,
    'name', coalesce(nullif(u.display_name, ''), u.handle, 'member'),
    'avatar', u.avatar
  )
  from public.gunpula_v3_users u
  where u.user_id = p_user_id;
$$;

-- Are these two accepted friends (in either direction)?
create or replace function public.gunpula_v3_are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gunpula_v3_friendships f
     where f.status = 'accepted'
       and ((f.requester_id = p_a and f.addressee_id = p_b)
         or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

-- ---------------------------------------------------------------------------
-- My state (defined first: the mutating RPCs below all return it)
-- ---------------------------------------------------------------------------

-- Everything the app needs on open: my profile, my data, my friends, and the
-- requests waiting on either side.
create or replace function public.gunpula_v3_get_me()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.gunpula_v3_users%rowtype;
  friends jsonb;
  incoming jsonb;
  outgoing jsonb;
begin
  me := public.gunpula_v3_ensure_self();

  select coalesce(jsonb_agg(public.gunpula_v3_public_profile(other) order by other), '[]'::jsonb)
    into friends
    from (
      select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as other
        from public.gunpula_v3_friendships f
       where f.status = 'accepted'
         and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    ) s;

  select coalesce(jsonb_agg(public.gunpula_v3_public_profile(f.requester_id) order by f.created_at), '[]'::jsonb)
    into incoming
    from public.gunpula_v3_friendships f
   where f.addressee_id = auth.uid() and f.status = 'pending';

  select coalesce(jsonb_agg(public.gunpula_v3_public_profile(f.addressee_id) order by f.created_at), '[]'::jsonb)
    into outgoing
    from public.gunpula_v3_friendships f
   where f.requester_id = auth.uid() and f.status = 'pending';

  return jsonb_build_object(
    'handle', me.handle,
    'display_name', me.display_name,
    'avatar', me.avatar,
    'preferences', me.preferences,
    'payload', me.payload,
    'revision', me.revision,
    'updated_at', me.updated_at,
    'friends', friends,
    'incoming_requests', incoming,
    'outgoing_requests', outgoing
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Account
-- ---------------------------------------------------------------------------

-- Claim or change the searchable account id. 3-20 chars, letters/digits/_ only.
create or replace function public.gunpula_v3_claim_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.gunpula_v3_users%rowtype;
  want text;
begin
  me := public.gunpula_v3_ensure_self();
  want := public.gunpula_v3_norm_handle(p_handle);

  if want !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'gunpula handle must be 3-20 chars of a-z 0-9 _' using errcode = '22023';
  end if;
  if exists (select 1 from public.gunpula_v3_users
              where handle = want and user_id <> auth.uid()) then
    raise exception 'gunpula handle taken' using errcode = '23505';
  end if;

  update public.gunpula_v3_users
     set handle = want, updated_at = now()
   where user_id = auth.uid();

  return public.gunpula_v3_get_me();
end;
$$;

create or replace function public.gunpula_v3_update_profile(
  p_display_name text default null,
  p_avatar text default null,
  p_preferences jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.gunpula_v3_ensure_self();
  update public.gunpula_v3_users
     set display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
         avatar       = coalesce(p_avatar, avatar),
         preferences  = coalesce(p_preferences, preferences),
         updated_at   = now()
   where user_id = auth.uid();
  return public.gunpula_v3_get_me();
end;
$$;

-- ---------------------------------------------------------------------------
-- Saving my state
-- ---------------------------------------------------------------------------

-- Optimistic concurrency on my own row only; nobody else can write it.
create or replace function public.gunpula_v3_save_state(
  p_payload jsonb,
  p_base_revision bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.gunpula_v3_users%rowtype;
begin
  me := public.gunpula_v3_ensure_self();
  if p_base_revision <> me.revision then
    raise exception 'gunpula revision conflict (server %, sent %)', me.revision, p_base_revision
      using errcode = '40001';
  end if;

  update public.gunpula_v3_users
     set payload = coalesce(p_payload, payload),
         revision = me.revision + 1,
         updated_at = now()
   where user_id = auth.uid();

  return public.gunpula_v3_get_me();
end;
$$;

-- ---------------------------------------------------------------------------
-- Finding people and friend requests
-- ---------------------------------------------------------------------------

-- Search by exact handle. Returns only the public profile plus how you two
-- currently relate — never an email, never any collection data.
create or replace function public.gunpula_v3_search_user(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.gunpula_v3_users%rowtype;
  rel text;
begin
  perform public.gunpula_v3_ensure_self();
  select * into target from public.gunpula_v3_users
   where handle = public.gunpula_v3_norm_handle(p_handle);
  if not found then
    return null;
  end if;

  if target.user_id = auth.uid() then
    rel := 'self';
  elsif public.gunpula_v3_are_friends(auth.uid(), target.user_id) then
    rel := 'friends';
  elsif exists (select 1 from public.gunpula_v3_friendships
                 where requester_id = auth.uid() and addressee_id = target.user_id
                   and status = 'pending') then
    rel := 'outgoing';
  elsif exists (select 1 from public.gunpula_v3_friendships
                 where requester_id = target.user_id and addressee_id = auth.uid()
                   and status = 'pending') then
    rel := 'incoming';
  else
    rel := 'none';
  end if;

  return public.gunpula_v3_public_profile(target.user_id) || jsonb_build_object('relation', rel);
end;
$$;

create or replace function public.gunpula_v3_request_friend(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  perform public.gunpula_v3_ensure_self();
  select user_id into target_id from public.gunpula_v3_users
   where handle = public.gunpula_v3_norm_handle(p_handle);
  if target_id is null then
    raise exception 'gunpula user not found' using errcode = '22023';
  end if;
  if target_id = auth.uid() then
    raise exception 'gunpula cannot add yourself' using errcode = '22023';
  end if;
  if public.gunpula_v3_are_friends(auth.uid(), target_id) then
    raise exception 'gunpula already friends' using errcode = '23505';
  end if;

  -- If they already asked you, accept instead of creating a mirror request.
  if exists (select 1 from public.gunpula_v3_friendships
              where requester_id = target_id and addressee_id = auth.uid()
                and status = 'pending') then
    update public.gunpula_v3_friendships
       set status = 'accepted', responded_at = now()
     where requester_id = target_id and addressee_id = auth.uid();
    return public.gunpula_v3_get_me();
  end if;

  insert into public.gunpula_v3_friendships (requester_id, addressee_id, status)
  values (auth.uid(), target_id, 'pending')
  on conflict (requester_id, addressee_id) do nothing;

  return public.gunpula_v3_get_me();
end;
$$;

-- Accept or decline a request that was sent to me. Declining removes the row.
create or replace function public.gunpula_v3_respond_friend(
  p_handle text,
  p_accept boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid;
begin
  perform public.gunpula_v3_ensure_self();
  select user_id into requester from public.gunpula_v3_users
   where handle = public.gunpula_v3_norm_handle(p_handle);
  if requester is null then
    raise exception 'gunpula user not found' using errcode = '22023';
  end if;

  if p_accept then
    update public.gunpula_v3_friendships
       set status = 'accepted', responded_at = now()
     where requester_id = requester and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.gunpula_v3_friendships
     where requester_id = requester and addressee_id = auth.uid() and status = 'pending';
  end if;

  return public.gunpula_v3_get_me();
end;
$$;

-- Unfriend, or withdraw a request I sent. Works from either side.
create or replace function public.gunpula_v3_remove_friend(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  perform public.gunpula_v3_ensure_self();
  select user_id into other from public.gunpula_v3_users
   where handle = public.gunpula_v3_norm_handle(p_handle);
  if other is null then
    raise exception 'gunpula user not found' using errcode = '22023';
  end if;

  delete from public.gunpula_v3_friendships
   where (requester_id = auth.uid() and addressee_id = other)
      or (requester_id = other and addressee_id = auth.uid());

  return public.gunpula_v3_get_me();
end;
$$;

-- A friend's collection, read-only, and ONLY the collection: appearance (which
-- holds the home cover photos) and local overrides are stripped out here so
-- personal images are never shared, even with accepted friends.
create or replace function public.gunpula_v3_get_friend_collection(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.gunpula_v3_users%rowtype;
begin
  perform public.gunpula_v3_ensure_self();
  select * into target from public.gunpula_v3_users
   where handle = public.gunpula_v3_norm_handle(p_handle);
  if not found then
    raise exception 'gunpula user not found' using errcode = '22023';
  end if;
  if not public.gunpula_v3_are_friends(auth.uid(), target.user_id) then
    raise exception 'gunpula not friends' using errcode = '42501';
  end if;

  return public.gunpula_v3_public_profile(target.user_id) || jsonb_build_object(
    'collection', coalesce(target.payload -> 'collection', '{}'::jsonb),
    'updated_at', target.updated_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Migration from the v2 shared workspace
-- ---------------------------------------------------------------------------

-- Copies MY slice of the old shared payload into my own v3 row. Idempotent-ish:
-- it refuses to clobber a v3 collection that already has entries, so running it
-- twice cannot wipe newer data. The v2 tables are left untouched as a backup.
create or replace function public.gunpula_v3_migrate_from_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.gunpula_v3_users%rowtype;
  my_name text;
  ws_payload jsonb;
  mine jsonb;
  existing_items jsonb;
begin
  me := public.gunpula_v3_ensure_self();

  existing_items := coalesce(me.payload -> 'collection' -> 'items', '{}'::jsonb);
  if existing_items <> '{}'::jsonb then
    return public.gunpula_v3_get_me();
  end if;

  -- Nothing to migrate from on a project that never ran the v2 schema.
  if to_regclass('public.gunpula_v2_members') is null then
    return public.gunpula_v3_get_me();
  end if;

  select w.payload into ws_payload
    from public.gunpula_v2_members m
    join public.gunpula_v2_workspaces w on w.id = m.workspace_id
   where m.user_id = auth.uid();
  if ws_payload is null then
    return public.gunpula_v3_get_me();
  end if;

  my_name := public.gunpula_v2_member_name(auth.uid());

  -- Prefer my own bucket; fall back to the flat items map from older payloads.
  mine := ws_payload -> 'collection' -> 'member_items' -> my_name;
  if mine is null then
    mine := coalesce(ws_payload -> 'collection' -> 'items', '{}'::jsonb);
  end if;

  update public.gunpula_v3_users
     set payload = jsonb_build_object(
           'schema_version', 1,
           'collection', jsonb_build_object(
             'items', mine,
             'member_items', jsonb_build_object(my_name, mine),
             'owned', '[]'::jsonb,
             'wanted', '[]'::jsonb
           ),
           'overrides', coalesce(ws_payload -> 'overrides', '{}'::jsonb),
           'series_label_overrides', coalesce(ws_payload -> 'series_label_overrides', '{}'::jsonb),
           'appearance', coalesce(ws_payload -> 'appearance', '{}'::jsonb)
         ),
         display_name = coalesce(nullif(display_name, ''), my_name),
         revision = me.revision + 1,
         updated_at = now()
   where user_id = auth.uid();

  return public.gunpula_v3_get_me();
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: RPCs only, and only for signed-in users.
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and both anon and
-- authenticated inherit that — so revoking from those two roles alone would
-- leave the functions callable. Everything is revoked from PUBLIC first, then
-- only the app-facing RPCs are granted back. This matters for the internal
-- helpers especially: gunpula_v3_public_profile(uuid) would otherwise let an
-- anonymous caller turn a guessed user id into someone's handle and avatar.
-- ---------------------------------------------------------------------------
revoke all on function public.gunpula_v3_norm_handle(text) from public;
revoke all on function public.gunpula_v3_ensure_self() from public;
revoke all on function public.gunpula_v3_public_profile(uuid) from public;
revoke all on function public.gunpula_v3_are_friends(uuid, uuid) from public;

revoke all on function public.gunpula_v3_get_me() from public;
revoke all on function public.gunpula_v3_claim_handle(text) from public;
revoke all on function public.gunpula_v3_update_profile(text, text, jsonb) from public;
revoke all on function public.gunpula_v3_save_state(jsonb, bigint) from public;
revoke all on function public.gunpula_v3_search_user(text) from public;
revoke all on function public.gunpula_v3_request_friend(text) from public;
revoke all on function public.gunpula_v3_respond_friend(text, boolean) from public;
revoke all on function public.gunpula_v3_remove_friend(text) from public;
revoke all on function public.gunpula_v3_get_friend_collection(text) from public;
revoke all on function public.gunpula_v3_migrate_from_v2() from public;

grant execute on function public.gunpula_v3_get_me() to authenticated;
grant execute on function public.gunpula_v3_claim_handle(text) to authenticated;
grant execute on function public.gunpula_v3_update_profile(text, text, jsonb) to authenticated;
grant execute on function public.gunpula_v3_save_state(jsonb, bigint) to authenticated;
grant execute on function public.gunpula_v3_search_user(text) to authenticated;
grant execute on function public.gunpula_v3_request_friend(text) to authenticated;
grant execute on function public.gunpula_v3_respond_friend(text, boolean) to authenticated;
grant execute on function public.gunpula_v3_remove_friend(text) to authenticated;
grant execute on function public.gunpula_v3_get_friend_collection(text) to authenticated;
grant execute on function public.gunpula_v3_migrate_from_v2() to authenticated;
