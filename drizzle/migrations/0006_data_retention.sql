-- 0006: automatic clean-up so the privacy policy's retention promises are real.
--  * detailed visit and activity records: 24 months
--  * security/audit log: 24 months
--  * declined submissions: 12 months
--  * contact details on approved submissions: removed 12 months after review
create or replace function public.purge_old_records()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int; e int;
begin
  delete from public.page_views where created_at < now() - interval '24 months'; get diagnostics a = row_count;
  delete from public.site_events where created_at < now() - interval '24 months'; get diagnostics b = row_count;
  delete from public.security_events where created_at < now() - interval '24 months'; get diagnostics c = row_count;
  delete from public.aspirant_submissions where status = 'rejected' and coalesce(reviewed_at, created_at) < now() - interval '12 months'; get diagnostics d = row_count;
  update public.aspirant_submissions
     set contact_name = 'removed', contact_email = 'removed@removed.invalid', contact_phone = null, contact_role = null
   where status = 'approved' and reviewed_at < now() - interval '12 months' and contact_email <> 'removed@removed.invalid';
  get diagnostics e = row_count;
  return jsonb_build_object('page_views', a, 'site_events', b, 'security_events', c, 'declined_submissions', d, 'contacts_removed', e);
end $$;
revoke all on function public.purge_old_records() from public, anon, authenticated;
grant execute on function public.purge_old_records() to service_role;
