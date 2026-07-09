-- Gunpula shared sync v2: email login + invite codes.
-- Run once in the Supabase SQL Editor. Safe to run next to the v1 schema
-- (docs/supabase-setup.sql); old clients keep working until everyone migrates.
--
-- Also required in the Supabase dashboard:
--   1. Authentication -> Providers -> Email: enabled (default).
--   2. Authentication -> Email Templates -> Magic Link: make sure the body
--      contains {{ .Token }} so the mail carries the 6-digit code, e.g.
--        <p>你的 Gunpula 登录验证码：<strong>{{ .Token }}</strong></p>
--
-- The app talks to these tables only through the RPC functions below;
-- direct table access is denied by RLS + revokes.

create table if not exists public.gunpula_v2_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default '我的收藏空间',
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{"schema_version":1,"collection":{"owned":[],"wanted":[],"items":{}},"overrides":{},"series_label_overrides":{}}'::jsonb,
  revision bigint not null default 0,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.gunpula_v2_members (
  workspace_id uuid not null references public.gunpula_v2_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- One workspace per user keeps the model simple: the unique index lets the
-- RPCs resolve "my workspace" without extra arguments.
create unique index if not exists gunpula_v2_members_single_workspace
  on public.gunpula_v2_members (user_id);

create table if not exists public.gunpula_v2_events (
  id bigserial primary key,
  workspace_id uuid not null references public.gunpula_v2_workspaces(id) on delete cascade,
  revision bigint not null,
  base_revision bigint not null default 0,
  reason text not null default 'sync',
  updated_by text not null default '',
  created_at timestamptz not null default now()
);

alter table public.gunpula_v2_workspaces enable row level security;
alter table public.gunpula_v2_members enable row level security;
alter table public.gunpula_v2_events enable row level security;

revoke all on public.gunpula_v2_workspaces from anon, authenticated;
revoke all on public.gunpula_v2_members from anon, authenticated;
revoke all on public.gunpula_v2_events from anon, authenticated;

create or replace function public.gunpula_v2_generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

create or replace function public.gunpula_v2_member_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif((select display_name from public.gunpula_v2_members where user_id = p_user_id), ''),
    split_part((select email from auth.users where id = p_user_id), '@', 1),
    'member'
  );
$$;

-- Returns the caller's workspace state, or null when they have none yet.
create or replace function public.gunpula_v2_get_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.gunpula_v2_members%rowtype;
  ws public.gunpula_v2_workspaces%rowtype;
  members jsonb;
begin
  if auth.uid() is null then
    raise exception 'gunpula not signed in' using errcode = '42501';
  end if;

  select * into member_row from public.gunpula_v2_members where user_id = auth.uid();
  if not found then
    return null;
  end if;

  select * into ws from public.gunpula_v2_workspaces where id = member_row.workspace_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'name', public.gunpula_v2_member_name(m.user_id),
      'role', m.role,
      'joined_at', m.joined_at
    ) order by m.joined_at), '[]'::jsonb)
    into members
    from public.gunpula_v2_members m
   where m.workspace_id = ws.id;

  return jsonb_build_object(
    'workspace_id', ws.id,
    'workspace_name', ws.name,
    'invite_code', case when member_row.role = 'owner' then ws.invite_code else null end,
    'payload', ws.payload,
    'revision', ws.revision,
    'updated_by', ws.updated_by,
    'updated_at', ws.updated_at,
    'can_edit', member_row.role in ('owner', 'editor'),
    'role', member_row.role,
    'members', members
  );
end;
$$;

create or replace function public.gunpula_v2_save_state(
  p_payload jsonb,
  p_base_revision bigint default 0,
  p_reason text default 'sync'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.gunpula_v2_members%rowtype;
  ws public.gunpula_v2_workspaces%rowtype;
begin
  if auth.uid() is null then
    raise exception 'gunpula not signed in' using errcode = '42501';
  end if;

  select * into member_row from public.gunpula_v2_members where user_id = auth.uid();
  if not found then
    raise exception 'gunpula no workspace' using errcode = '42501';
  end if;
  if member_row.role not in ('owner', 'editor') then
    raise exception 'gunpula read-only workspace access' using errcode = '42501';
  end if;

  select * into ws from public.gunpula_v2_workspaces where id = member_row.workspace_id for update;

  update public.gunpula_v2_workspaces
     set payload = coalesce(p_payload, '{}'::jsonb),
         revision = ws.revision + 1,
         updated_by = public.gunpula_v2_member_name(auth.uid()),
         updated_at = now()
   where id = ws.id
   returning * into ws;

  insert into public.gunpula_v2_events (workspace_id, revision, base_revision, reason, updated_by)
  values (ws.id, ws.revision, coalesce(p_base_revision, 0), coalesce(nullif(p_reason, ''), 'sync'), ws.updated_by);

  return public.gunpula_v2_get_state();
end;
$$;

create or replace function public.gunpula_v2_create_workspace(
  p_name text default '',
  p_display_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  if auth.uid() is null then
    raise exception 'gunpula not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.gunpula_v2_members where user_id = auth.uid()) then
    raise exception 'gunpula already in a workspace' using errcode = '23505';
  end if;

  insert into public.gunpula_v2_workspaces (name, invite_code, owner_id)
  values (coalesce(nullif(trim(p_name), ''), '我的收藏空间'), public.gunpula_v2_generate_invite_code(), auth.uid())
  returning id into ws_id;

  insert into public.gunpula_v2_members (workspace_id, user_id, display_name, role)
  values (ws_id, auth.uid(), coalesce(trim(p_display_name), ''), 'owner');

  return public.gunpula_v2_get_state();
end;
$$;

create or replace function public.gunpula_v2_join_workspace(
  p_invite_code text,
  p_display_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws public.gunpula_v2_workspaces%rowtype;
begin
  if auth.uid() is null then
    raise exception 'gunpula not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.gunpula_v2_members where user_id = auth.uid()) then
    raise exception 'gunpula already in a workspace' using errcode = '23505';
  end if;

  select * into ws from public.gunpula_v2_workspaces
   where invite_code = upper(trim(p_invite_code));
  if not found then
    raise exception 'gunpula invalid invite code' using errcode = '22023';
  end if;

  insert into public.gunpula_v2_members (workspace_id, user_id, display_name, role)
  values (ws.id, auth.uid(), coalesce(trim(p_display_name), ''), 'editor');

  return public.gunpula_v2_get_state();
end;
$$;

-- One-time import of a v1 workspace: the caller proves ownership with the
-- same id + secret hash the old client already stores, and the old payload
-- is copied into their (empty) v2 workspace. The v1 rows stay untouched.
create or replace function public.gunpula_v2_migrate_from_v1(
  p_workspace_id text,
  p_access_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.gunpula_v2_members%rowtype;
  ws public.gunpula_v2_workspaces%rowtype;
  legacy public.gunpula_workspace_states%rowtype;
begin
  if auth.uid() is null then
    raise exception 'gunpula not signed in' using errcode = '42501';
  end if;

  select * into member_row from public.gunpula_v2_members where user_id = auth.uid();
  if not found then
    raise exception 'gunpula no workspace' using errcode = '42501';
  end if;
  if member_row.role <> 'owner' then
    raise exception 'gunpula owner only' using errcode = '42501';
  end if;

  select * into legacy from public.gunpula_workspace_states
   where workspace_id = p_workspace_id
     and (read_hash = p_access_hash or edit_hash = p_access_hash);
  if not found then
    raise exception 'gunpula legacy workspace not found' using errcode = '22023';
  end if;

  select * into ws from public.gunpula_v2_workspaces where id = member_row.workspace_id for update;

  update public.gunpula_v2_workspaces
     set payload = legacy.payload,
         revision = ws.revision + 1,
         updated_by = public.gunpula_v2_member_name(auth.uid()),
         updated_at = now()
   where id = ws.id;

  insert into public.gunpula_v2_events (workspace_id, revision, base_revision, reason, updated_by)
  values (ws.id, ws.revision + 1, ws.revision, 'migrate-v1', public.gunpula_v2_member_name(auth.uid()));

  return public.gunpula_v2_get_state();
end;
$$;

grant execute on function public.gunpula_v2_get_state() to authenticated;
grant execute on function public.gunpula_v2_save_state(jsonb, bigint, text) to authenticated;
grant execute on function public.gunpula_v2_create_workspace(text, text) to authenticated;
grant execute on function public.gunpula_v2_join_workspace(text, text) to authenticated;
grant execute on function public.gunpula_v2_migrate_from_v1(text, text) to authenticated;
