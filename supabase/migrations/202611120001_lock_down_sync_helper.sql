-- The public RPCs below run as SECURITY DEFINER and call this helper as the
-- function owner. It must not itself be callable directly by anonymous or
-- authenticated browser roles.
begin;

revoke all on function public.journey_sync_require_user() from public;
revoke all on function public.journey_sync_require_user() from anon, authenticated;

commit;
