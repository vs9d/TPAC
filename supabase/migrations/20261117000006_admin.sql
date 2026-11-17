-- =====================================================================
-- TPAC — admin helpers
-- =====================================================================

-- Customers = registered profiles + guest buyers (grouped by phone), with
-- order statistics so repeat customers are easy to identify.
create or replace function public.admin_customers(p_search text default null, p_limit int default 50, p_offset int default 0, p_repeat_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(trim(p_search), '');
  v_phone text := public.normalize_iraqi_phone(p_search);
  v_result jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  with registered as (
    select cp.id as user_id, cp.full_name as name, cp.phone, cp.email, cp.role::text as role, cp.created_at,
           count(o.id) filter (where o.status <> 'cancelled') as order_count,
           coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) as total_spent,
           max(o.created_at) as last_order_at
      from customer_profiles cp
      left join orders o on o.user_id = cp.id or (o.user_id is null and cp.phone is not null and o.phone = cp.phone)
     group by cp.id
  ), guests as (
    select null::uuid as user_id, max(o.customer_name) as name, o.phone, max(o.email) as email, 'guest'::text as role, min(o.created_at) as created_at,
           count(*) filter (where o.status <> 'cancelled') as order_count,
           coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) as total_spent,
           max(o.created_at) as last_order_at
      from orders o
     where o.user_id is null and not exists (select 1 from customer_profiles cp where cp.phone = o.phone)
     group by o.phone
  ), all_rows as (
    select * from registered union all select * from guests
  ), filtered as (
    select * from all_rows
     where (v_q is null or name ilike '%' || v_q || '%' or email ilike '%' || v_q || '%' or phone = v_phone
            or (length(regexp_replace(v_q, '[^0-9]', '', 'g')) >= 4 and phone like '%' || regexp_replace(v_q, '[^0-9]', '', 'g') || '%'))
       and (not p_repeat_only or order_count >= 2)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(to_jsonb(f) order by f.last_order_at desc nulls last, f.created_at desc)
                         from (select * from filtered order by last_order_at desc nulls last, created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0)) f), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

revoke execute on function public.admin_customers(text, int, int, boolean) from public, anon;
grant execute on function public.admin_customers(text, int, int, boolean) to authenticated;
