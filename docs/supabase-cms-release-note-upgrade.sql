-- Run once in Supabase SQL Editor for editable CMS release notes.
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

revoke all on function public.gunpula_cms_update_release_note(bigint, text)
  from public, anon, authenticated;
grant execute on function public.gunpula_cms_update_release_note(bigint, text)
  to authenticated;

select pg_notify('pgrst', 'reload schema');
