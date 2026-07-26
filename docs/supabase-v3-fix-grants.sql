-- 补丁：把 v3 内部函数真正对匿名调用者关上。
--
-- 为什么需要这个：Supabase 除了 Postgres 默认给 PUBLIC 的 EXECUTE 之外，还通过
-- ALTER DEFAULT PRIVILEGES 把新函数的 EXECUTE 直接授给 anon 和 authenticated。
-- 只 revoke ... from public 撤不掉那两条直接授权，函数依然可调用（已在实际项目上
-- 验证：匿名调 gunpula_v3_public_profile 会执行并返回 null，而不是被拒绝）。
--
-- 影响范围有限：要利用它得先猜中一个 v4 UUID，实际上不可行。但这道门本来就该是
-- 关着的，所以补上。
--
-- 在 Supabase → SQL Editor 里跑一次即可，只改权限，不动任何数据。

revoke all on function public.gunpula_v3_norm_handle(text) from public, anon, authenticated;
revoke all on function public.gunpula_v3_ensure_self() from public, anon, authenticated;
revoke all on function public.gunpula_v3_public_profile(uuid) from public, anon, authenticated;
revoke all on function public.gunpula_v3_are_friends(uuid, uuid) from public, anon, authenticated;

revoke all on function public.gunpula_v3_get_me() from public, anon, authenticated;
revoke all on function public.gunpula_v3_claim_handle(text) from public, anon, authenticated;
revoke all on function public.gunpula_v3_update_profile(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.gunpula_v3_save_state(jsonb, bigint) from public, anon, authenticated;
revoke all on function public.gunpula_v3_search_user(text) from public, anon, authenticated;
revoke all on function public.gunpula_v3_request_friend(text) from public, anon, authenticated;
revoke all on function public.gunpula_v3_respond_friend(text, boolean) from public, anon, authenticated;
revoke all on function public.gunpula_v3_remove_friend(text) from public, anon, authenticated;
revoke all on function public.gunpula_v3_get_friend_collection(text) from public, anon, authenticated;
revoke all on function public.gunpula_v3_migrate_from_v2() from public, anon, authenticated;

-- 登录用户仍然要能调这些（上面把 authenticated 也撤了，这里按需授回）。
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
