-- Gunpla DB shared sync schema for Supabase.
-- Run this once in Supabase SQL Editor.
-- The browser app calls only the two RPC functions below; direct table access stays locked by RLS.

create table if not exists public.gunpula_workspace_states (
  workspace_id text primary key,
  read_hash text not null,
  edit_hash text not null,
  payload jsonb not null default '{"schema_version":1,"collection":{"owned":[],"wanted":[],"items":{}},"overrides":{},"series_label_overrides":{}}'::jsonb,
  revision bigint not null default 0,
  updated_by text not null default 'member',
  updated_at timestamptz not null default now()
);

create table if not exists public.gunpula_workspace_events (
  id bigserial primary key,
  workspace_id text not null references public.gunpula_workspace_states(workspace_id) on delete cascade,
  revision bigint not null,
  base_revision bigint not null default 0,
  reason text not null default 'sync',
  updated_by text not null default 'member',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.gunpula_workspace_states enable row level security;
alter table public.gunpula_workspace_events enable row level security;

revoke all on public.gunpula_workspace_states from anon, authenticated;
revoke all on public.gunpula_workspace_events from anon, authenticated;

create or replace function public.gunpula_get_state(
  p_workspace_id text,
  p_access_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.gunpula_workspace_states%rowtype;
begin
  select *
    into row_data
    from public.gunpula_workspace_states
   where workspace_id = p_workspace_id
     and (read_hash = p_access_hash or edit_hash = p_access_hash);

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'workspace_id', row_data.workspace_id,
    'payload', row_data.payload,
    'revision', row_data.revision,
    'updated_by', row_data.updated_by,
    'updated_at', row_data.updated_at,
    'can_edit', row_data.edit_hash = p_access_hash
  );
end;
$$;

create or replace function public.gunpula_save_state(
  p_workspace_id text,
  p_read_hash text,
  p_edit_hash text,
  p_member_name text,
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
  row_data public.gunpula_workspace_states%rowtype;
  next_revision bigint;
begin
  select *
    into row_data
    from public.gunpula_workspace_states
   where workspace_id = p_workspace_id
   for update;

  if not found then
    insert into public.gunpula_workspace_states (
      workspace_id,
      read_hash,
      edit_hash,
      payload,
      revision,
      updated_by,
      updated_at
    )
    values (
      p_workspace_id,
      p_read_hash,
      p_edit_hash,
      coalesce(p_payload, '{}'::jsonb),
      1,
      coalesce(nullif(p_member_name, ''), 'member'),
      now()
    )
    returning * into row_data;
  else
    if row_data.edit_hash <> p_edit_hash then
      raise exception 'gunpula read-only workspace access'
        using errcode = '42501';
    end if;

    next_revision := row_data.revision + 1;
    update public.gunpula_workspace_states
       set payload = coalesce(p_payload, '{}'::jsonb),
           revision = next_revision,
           updated_by = coalesce(nullif(p_member_name, ''), 'member'),
           updated_at = now()
     where workspace_id = p_workspace_id
     returning * into row_data;
  end if;

  insert into public.gunpula_workspace_events (
    workspace_id,
    revision,
    base_revision,
    reason,
    updated_by,
    payload
  )
  values (
    row_data.workspace_id,
    row_data.revision,
    coalesce(p_base_revision, 0),
    coalesce(nullif(p_reason, ''), 'sync'),
    row_data.updated_by,
    row_data.payload
  );

  return jsonb_build_object(
    'workspace_id', row_data.workspace_id,
    'payload', row_data.payload,
    'revision', row_data.revision,
    'updated_by', row_data.updated_by,
    'updated_at', row_data.updated_at,
    'can_edit', true
  );
end;
$$;

grant execute on function public.gunpula_get_state(text, text) to anon, authenticated;
grant execute on function public.gunpula_save_state(text, text, text, text, jsonb, bigint, text) to anon, authenticated;
