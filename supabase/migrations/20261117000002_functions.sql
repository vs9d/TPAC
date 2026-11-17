-- =====================================================================
-- TPAC — business logic functions
-- Critical money / stock operations run inside single transactions in
-- Postgres so they can never be partially applied or raced.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so they can be used inside RLS
-- policies without recursive policy evaluation)
-- ---------------------------------------------------------------------
create or replace function public.current_role_name()
returns public.user_role language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.customer_profiles where id = auth.uid()), 'customer'::public.user_role)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.customer_profiles where id = auth.uid() and role in ('staff', 'admin'))
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.customer_profiles where id = auth.uid() and role = 'admin')
$$;

-- ---------------------------------------------------------------------
-- New auth user -> profile row
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.customer_profiles (id, email, full_name, phone, preferred_locale)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    public.normalize_iraqi_phone(new.raw_user_meta_data ->> 'phone'),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'ar' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may edit their own profile but never their role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    -- service_role (no auth.uid) or an admin may change roles
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'not_authorized: only admins can change roles' using errcode = '42501';
    end if;
    if auth.uid() is not null and auth.uid() = new.id and new.role <> 'admin' then
      raise exception 'admins cannot demote themselves' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger customer_profiles_protect_role before update on public.customer_profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- Admin activity log
-- ---------------------------------------------------------------------
create or replace function public.log_admin_activity(p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window, shared across all app instances)
-- ---------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;

-- ---------------------------------------------------------------------
-- Order status workflow
-- ---------------------------------------------------------------------
create or replace function public.order_status_rank(s public.order_status)
returns int language sql immutable as $$
  select case s
    when 'received' then 1 when 'confirmed' then 2 when 'preparing' then 3
    when 'printing' then 4 when 'quality_check' then 5 when 'ready_to_ship' then 6
    when 'shipped' then 7 when 'delivered' then 8 when 'cancelled' then 99 end
$$;

-- Forward-only moves (steps may be skipped, e.g. no printing for stock
-- items). Cancellation is allowed until delivery. Terminal states are final.
create or replace function public.can_transition_order(p_from public.order_status, p_to public.order_status)
returns boolean language sql immutable as $$
  select case
    when p_from in ('delivered', 'cancelled') then false
    when p_to = 'cancelled' then true
    else public.order_status_rank(p_to) > public.order_status_rank(p_from)
  end
$$;

-- ---------------------------------------------------------------------
-- Cart pricing — the single source of truth for prices, discounts,
-- delivery fees and stock availability. Used both for previews and
-- inside place_order().
-- payload: {
--   items: [{variant_id, quantity} | {custom_design_id, quantity}],
--   discount_code, governorate, delivery_method, user_id, phone
-- }
-- ---------------------------------------------------------------------
create or replace function public.quote_cart(payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_item jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_subtotal int := 0;
  v_qty int;
  v_line jsonb;
  r record;
  d record;
  z record;
  v_discount int := 0;
  v_discount_info jsonb := null;
  v_delivery_fee int := 0;
  v_delivery_info jsonb := null;
  v_method text := coalesce(payload ->> 'delivery_method', 'standard');
  v_code text := upper(nullif(trim(payload ->> 'discount_code'), ''));
  v_user uuid := nullif(payload ->> 'user_id', '')::uuid;
  v_phone text := public.normalize_iraqi_phone(payload ->> 'phone');
  v_free_shipping boolean := false;
  v_uses int;
  v_min_order int := coalesce((select (value ->> 'min_order_total')::int from public.website_settings where key = 'checkout'), 0);
  v_has_custom boolean := false;
  v_seen jsonb := '{}'::jsonb;
  v_key text;
begin
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    v_errors := v_errors || jsonb_build_object('code', 'empty_cart');
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) > 50 then
    raise exception 'too_many_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_qty := coalesce((v_item ->> 'quantity')::int, 0);
    v_key := coalesce(v_item ->> 'variant_id', v_item ->> 'custom_design_id', '');
    if v_seen ? v_key then
      raise exception 'duplicate_cart_line' using errcode = '22023';
    end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);

    if v_item ? 'variant_id' and v_item ->> 'variant_id' is not null then
      select v.id as variant_id, v.sku, v.size_code, p.id as product_id, p.slug, p.name_ar, p.name_en,
             coalesce(v.price_override, p.base_price) as unit_price,
             c.name_ar as color_name_ar, c.name_en as color_name_en, c.hex as color_hex,
             coalesce(i.quantity, 0) as stock,
             (v.is_active and p.is_published) as sellable,
             (select pi.url from public.product_images pi
               where pi.product_id = p.id and (pi.color_id = v.color_id or pi.color_id is null)
               order by (pi.color_id = v.color_id) desc nulls last, pi.sort_order limit 1) as image_url
        into r
        from public.product_variants v
        join public.products p on p.id = v.product_id
        join public.colors c on c.id = v.color_id
        left join public.inventory i on i.variant_id = v.id
       where v.id = (v_item ->> 'variant_id')::uuid;

      if not found or not r.sellable then
        v_line := jsonb_build_object('variant_id', v_item ->> 'variant_id', 'quantity', v_qty, 'error', 'unavailable', 'line_total', 0);
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'variant_id', v_item ->> 'variant_id');
      else
        v_line := jsonb_build_object(
          'variant_id', r.variant_id, 'product_id', r.product_id, 'slug', r.slug, 'sku', r.sku,
          'name_ar', r.name_ar, 'name_en', r.name_en, 'size_code', r.size_code,
          'color_name_ar', r.color_name_ar, 'color_name_en', r.color_name_en, 'color_hex', r.color_hex,
          'image_url', r.image_url, 'unit_price', r.unit_price, 'quantity', v_qty,
          'available', r.stock, 'line_total', r.unit_price * greatest(v_qty, 0));
        if v_qty < 1 or v_qty > 99 then
          v_line := v_line || jsonb_build_object('error', 'invalid_quantity');
          v_errors := v_errors || jsonb_build_object('code', 'invalid_quantity', 'variant_id', r.variant_id);
        elsif v_qty > r.stock then
          v_line := v_line || jsonb_build_object('error', 'insufficient_stock');
          v_errors := v_errors || jsonb_build_object('code', 'insufficient_stock', 'variant_id', r.variant_id, 'available', r.stock);
        else
          v_subtotal := v_subtotal + r.unit_price * v_qty;
        end if;
      end if;

    elsif v_item ? 'custom_design_id' and v_item ->> 'custom_design_id' is not null then
      select cd.id, cd.unit_price, cd.size_code, cd.preview_front_path, cd.print_locations,
             g.name_ar, g.name_en, c.name_ar as color_name_ar, c.name_en as color_name_en, c.hex as color_hex
        into r
        from public.custom_designs cd
        join public.custom_garment_types g on g.code = cd.garment_type
        join public.colors c on c.id = cd.color_id
       where cd.id = (v_item ->> 'custom_design_id')::uuid
         and (cd.user_id is null or cd.user_id = v_user);
      if not found then
        v_line := jsonb_build_object('custom_design_id', v_item ->> 'custom_design_id', 'quantity', v_qty, 'error', 'unavailable', 'line_total', 0);
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'custom_design_id', v_item ->> 'custom_design_id');
      else
        v_has_custom := true;
        v_line := jsonb_build_object(
          'custom_design_id', r.id, 'name_ar', r.name_ar || ' — تصميم خاص', 'name_en', 'Custom ' || r.name_en,
          'size_code', r.size_code, 'color_name_ar', r.color_name_ar, 'color_name_en', r.color_name_en,
          'color_hex', r.color_hex, 'preview_path', r.preview_front_path, 'print_locations', to_jsonb(r.print_locations),
          'unit_price', r.unit_price, 'quantity', v_qty, 'line_total', r.unit_price * greatest(v_qty, 0));
        if v_qty < 1 or v_qty > 99 then
          v_line := v_line || jsonb_build_object('error', 'invalid_quantity');
          v_errors := v_errors || jsonb_build_object('code', 'invalid_quantity', 'custom_design_id', r.id);
        else
          v_subtotal := v_subtotal + r.unit_price * v_qty;
        end if;
      end if;
    else
      raise exception 'invalid_cart_line' using errcode = '22023';
    end if;
    v_lines := v_lines || jsonb_build_array(v_line);
  end loop;

  -- Discount code ---------------------------------------------------
  if v_code is not null then
    select * into d from public.discount_codes where code = v_code;
    if not found or not d.is_active then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'invalid_code');
    elsif d.starts_at is not null and d.starts_at > now() then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'not_started');
    elsif d.ends_at is not null and d.ends_at < now() then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'expired');
    elsif d.max_uses is not null and d.used_count >= d.max_uses then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'usage_limit');
    elsif v_subtotal < d.min_order_total then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'min_order', 'min_order_total', d.min_order_total);
    else
      v_uses := 0;
      if d.max_uses_per_customer is not null and (v_user is not null or v_phone is not null) then
        select count(*) into v_uses from public.discount_usage u
         where u.discount_code_id = d.id
           and ((v_user is not null and u.user_id = v_user) or (v_phone is not null and u.phone = v_phone));
      end if;
      if d.max_uses_per_customer is not null and v_uses >= d.max_uses_per_customer then
        v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'already_used');
      else
        if d.type = 'percent' then
          v_discount := floor(v_subtotal * d.value / 100.0)::int;
        elsif d.type = 'fixed' then
          v_discount := least(d.value, v_subtotal);
        else
          v_free_shipping := true;
        end if;
        if d.max_discount is not null then v_discount := least(v_discount, d.max_discount); end if;
        v_discount_info := jsonb_build_object('code', v_code, 'valid', true, 'type', d.type, 'value', d.value, 'id', d.id);
      end if;
    end if;
  end if;

  -- Delivery --------------------------------------------------------
  if payload ->> 'governorate' is not null then
    select * into z from public.delivery_zones where governorate = payload ->> 'governorate' and is_active;
    if not found then
      v_delivery_info := jsonb_build_object('available', false, 'error', 'unsupported_governorate');
      v_errors := v_errors || jsonb_build_object('code', 'unsupported_governorate');
    elsif v_method = 'pickup' then
      if z.pickup_available then
        v_delivery_fee := 0;
        v_delivery_info := jsonb_build_object('available', true, 'method', 'pickup');
      else
        v_delivery_info := jsonb_build_object('available', false, 'error', 'pickup_unavailable');
        v_errors := v_errors || jsonb_build_object('code', 'pickup_unavailable');
      end if;
    elsif v_method = 'express' then
      if z.express_fee is not null then
        v_delivery_fee := z.express_fee;
        v_delivery_info := jsonb_build_object('available', true, 'method', 'express');
      else
        v_delivery_info := jsonb_build_object('available', false, 'error', 'express_unavailable');
        v_errors := v_errors || jsonb_build_object('code', 'express_unavailable');
      end if;
    elsif v_method = 'standard' then
      v_delivery_fee := z.standard_fee;
      if z.free_shipping_threshold is not null and (v_subtotal - v_discount) >= z.free_shipping_threshold then
        v_delivery_fee := 0;
      end if;
      v_delivery_info := jsonb_build_object('available', true, 'method', 'standard',
        'days_min', z.estimated_days_min, 'days_max', z.estimated_days_max);
    else
      raise exception 'invalid_delivery_method' using errcode = '22023';
    end if;
    if v_free_shipping and v_method <> 'pickup' then
      v_delivery_fee := 0;
    end if;
  end if;

  if v_subtotal > 0 and v_subtotal < v_min_order then
    v_errors := v_errors || jsonb_build_object('code', 'min_order_total', 'min_order_total', v_min_order);
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal,
    'discount_total', v_discount,
    'delivery_fee', v_delivery_fee,
    'total', greatest(v_subtotal - v_discount, 0) + v_delivery_fee,
    'discount', v_discount_info,
    'delivery', v_delivery_info,
    'has_custom_items', v_has_custom,
    'min_order_total', v_min_order,
    'errors', v_errors
  );
end $$;

-- ---------------------------------------------------------------------
-- Place an order atomically.
-- payload = quote_cart payload + customer: {customer_name, phone, email,
--   governorate, city, address_line, delivery_notes, payment_method, locale}
-- Stock is committed at placement (prevents overselling) and restored by
-- update_order_status() on cancellation.
-- ---------------------------------------------------------------------
create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q jsonb;
  v_line jsonb;
  v_order public.orders;
  v_phone text := public.normalize_iraqi_phone(payload ->> 'phone');
  v_user uuid := nullif(payload ->> 'user_id', '')::uuid;
  v_new_qty int;
  v_code_id uuid;
begin
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if coalesce(trim(payload ->> 'customer_name'), '') = '' or coalesce(trim(payload ->> 'address_line'), '') = ''
     or coalesce(trim(payload ->> 'city'), '') = '' then
    raise exception 'missing_customer_fields' using errcode = '22023';
  end if;
  if coalesce(payload ->> 'payment_method', 'cod') not in ('cod', 'online') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  -- Lock stock rows in a stable order to avoid deadlocks between
  -- concurrent checkouts, then lock the discount code row.
  perform 1 from public.inventory
   where variant_id in (
     select (e ->> 'variant_id')::uuid from jsonb_array_elements(payload -> 'items') e where e ->> 'variant_id' is not null)
   order by variant_id
   for update;

  if nullif(trim(payload ->> 'discount_code'), '') is not null then
    perform 1 from public.discount_codes where code = upper(trim(payload ->> 'discount_code')) for update;
  end if;

  q := public.quote_cart(payload || jsonb_build_object('phone', v_phone));

  if jsonb_array_length(q -> 'errors') > 0 then
    raise exception 'cart_invalid: %', (q -> 'errors')::text using errcode = 'P0001';
  end if;
  if q -> 'discount' is not null and q -> 'discount' <> 'null'::jsonb and not (q -> 'discount' ->> 'valid')::boolean then
    raise exception 'discount_invalid: %', (q -> 'discount' ->> 'error') using errcode = 'P0001';
  end if;
  if q -> 'delivery' is null or q -> 'delivery' = 'null'::jsonb then
    raise exception 'missing_governorate' using errcode = '22023';
  end if;

  v_code_id := nullif(q -> 'discount' ->> 'id', '')::uuid;

  insert into public.orders (
    user_id, customer_name, phone, email, governorate, city, address_line, delivery_notes,
    delivery_method, payment_method, payment_status, status, subtotal, discount_total, delivery_fee, total,
    discount_code_id, discount_code, locale, source, stock_committed, has_custom_items)
  values (
    v_user, trim(payload ->> 'customer_name'), v_phone, nullif(trim(payload ->> 'email'), ''),
    payload ->> 'governorate', trim(payload ->> 'city'), trim(payload ->> 'address_line'),
    nullif(trim(payload ->> 'delivery_notes'), ''),
    coalesce(payload ->> 'delivery_method', 'standard')::public.delivery_method,
    coalesce(payload ->> 'payment_method', 'cod')::public.payment_method,
    case when payload ->> 'payment_method' = 'online' then 'pending'::public.payment_status else 'unpaid'::public.payment_status end,
    'received', (q ->> 'subtotal')::int, (q ->> 'discount_total')::int, (q ->> 'delivery_fee')::int, (q ->> 'total')::int,
    v_code_id, case when v_code_id is not null then q -> 'discount' ->> 'code' end,
    case when payload ->> 'locale' = 'en' then 'en' else 'ar' end, 'web', true, (q ->> 'has_custom_items')::boolean)
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(q -> 'lines') loop
    insert into public.order_items (order_id, product_id, variant_id, custom_design_id, name_ar, name_en, sku, size_code,
      color_name_ar, color_name_en, color_hex, image_url, unit_price, quantity, line_total)
    values (v_order.id, nullif(v_line ->> 'product_id', '')::uuid, nullif(v_line ->> 'variant_id', '')::uuid,
      nullif(v_line ->> 'custom_design_id', '')::uuid, v_line ->> 'name_ar', v_line ->> 'name_en', v_line ->> 'sku',
      v_line ->> 'size_code', v_line ->> 'color_name_ar', v_line ->> 'color_name_en', v_line ->> 'color_hex',
      coalesce(v_line ->> 'image_url', v_line ->> 'preview_path'),
      (v_line ->> 'unit_price')::int, (v_line ->> 'quantity')::int, (v_line ->> 'line_total')::int);

    if v_line ->> 'variant_id' is not null then
      update public.inventory set quantity = quantity - (v_line ->> 'quantity')::int
       where variant_id = (v_line ->> 'variant_id')::uuid
       returning quantity into v_new_qty;
      insert into public.inventory_transactions (variant_id, change, quantity_after, reason, order_id, created_by)
      values ((v_line ->> 'variant_id')::uuid, -(v_line ->> 'quantity')::int, v_new_qty, 'sale', v_order.id, v_user);
      update public.products set sales_count = sales_count + (v_line ->> 'quantity')::int
       where id = (v_line ->> 'product_id')::uuid;
    end if;
  end loop;

  if v_code_id is not null then
    update public.discount_codes set used_count = used_count + 1 where id = v_code_id;
    insert into public.discount_usage (discount_code_id, order_id, user_id, phone, amount)
    values (v_code_id, v_order.id, v_user, v_phone, (q ->> 'discount_total')::int);
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, 'received', v_user);

  insert into public.notifications (audience, channel, event, title, body, order_id, link)
  values ('admin', 'in_app', 'order.created', 'طلب جديد ' || v_order.order_number,
          v_order.customer_name || ' — ' || v_order.total || ' IQD', v_order.id, '/admin/orders/' || v_order.id);
  if v_order.has_custom_items then
    insert into public.notifications (audience, channel, event, title, body, order_id, link)
    values ('admin', 'in_app', 'custom_design.created', 'طلب تصميم خاص ' || v_order.order_number,
            v_order.customer_name, v_order.id, '/admin/orders/' || v_order.id);
  end if;

  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'total', v_order.total,
    'subtotal', v_order.subtotal, 'discount_total', v_order.discount_total, 'delivery_fee', v_order.delivery_fee);
end $$;

-- ---------------------------------------------------------------------
-- Staff: change order status (with inventory restoration on cancel)
-- ---------------------------------------------------------------------
create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  it record;
  v_new_qty int;
  v_restored boolean := false;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not public.can_transition_order(o.status, p_status) then
    raise exception 'invalid_transition: % -> %', o.status, p_status using errcode = 'P0001';
  end if;

  -- Restore stock if cancelled before it left the warehouse.
  if p_status = 'cancelled' and o.stock_committed and public.order_status_rank(o.status) < public.order_status_rank('shipped') then
    for it in select variant_id, quantity from public.order_items where order_id = o.id and variant_id is not null order by variant_id loop
      update public.inventory set quantity = quantity + it.quantity where variant_id = it.variant_id
        returning quantity into v_new_qty;
      if found then
        insert into public.inventory_transactions (variant_id, change, quantity_after, reason, order_id, created_by, note)
        values (it.variant_id, it.quantity, v_new_qty, 'cancellation', o.id, auth.uid(), 'Order ' || o.order_number || ' cancelled');
      end if;
      update public.products p set sales_count = greatest(p.sales_count - it.quantity, 0)
        from public.product_variants v where v.id = it.variant_id and p.id = v.product_id;
    end loop;
    update public.orders set stock_committed = false where id = o.id;
    v_restored := true;
  end if;

  update public.orders set status = p_status,
    payment_status = case when p_status = 'delivered' and payment_method = 'cod' then 'paid'::public.payment_status else payment_status end
   where id = o.id;
  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (o.id, o.status, p_status, nullif(trim(p_note), ''), auth.uid());

  if o.user_id is not null then
    insert into public.notifications (audience, user_id, order_id, channel, event, title, body, link)
    values ('customer', o.user_id, o.id, 'in_app', 'order.status_changed',
            'تحديث على طلبك ' || o.order_number, p_status::text, '/account/orders/' || o.id);
  end if;

  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'order.status_changed', 'order', o.id::text,
          jsonb_build_object('from', o.status, 'to', p_status, 'stock_restored', v_restored));

  return jsonb_build_object('order_id', o.id, 'from', o.status, 'to', p_status, 'stock_restored', v_restored);
end $$;

-- ---------------------------------------------------------------------
-- Staff: inventory adjustments
-- ---------------------------------------------------------------------
create or replace function public.adjust_inventory(p_variant_id uuid, p_change int, p_reason public.inventory_reason, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_qty int;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_change = 0 then
    raise exception 'zero_change' using errcode = '22023';
  end if;
  if p_reason in ('sale', 'cancellation') then
    raise exception 'reason_reserved_for_orders' using errcode = '22023';
  end if;
  insert into public.inventory (variant_id, quantity) values (p_variant_id, 0) on conflict (variant_id) do nothing;
  update public.inventory set quantity = quantity + p_change where variant_id = p_variant_id
    returning quantity into v_qty;  -- the CHECK (quantity >= 0) constraint prevents negative stock
  insert into public.inventory_transactions (variant_id, change, quantity_after, reason, note, created_by)
  values (p_variant_id, p_change, v_qty, p_reason, nullif(trim(p_note), ''), auth.uid());
  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'inventory.adjusted', 'variant', p_variant_id::text,
          jsonb_build_object('change', p_change, 'reason', p_reason, 'quantity_after', v_qty));
  return v_qty;
end $$;

-- Low stock alert (fires once when stock crosses the threshold)
create or replace function public.inventory_low_stock_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v record;
begin
  if new.quantity <= new.low_stock_threshold and (tg_op = 'INSERT' or old.quantity > old.low_stock_threshold) then
    select p.name_ar, p.id as product_id, pv.sku into v
      from public.product_variants pv join public.products p on p.id = pv.product_id where pv.id = new.variant_id;
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'inventory.low_stock', 'مخزون منخفض: ' || coalesce(v.name_ar, ''),
            coalesce(v.sku, '') || ' — ' || new.quantity, '/admin/inventory?q=' || coalesce(v.sku, ''));
  end if;
  return new;
end $$;

create trigger inventory_low_stock after insert or update of quantity on public.inventory
  for each row execute function public.inventory_low_stock_alert();

-- Admin alerts for new bulk requests / inquiries
create or replace function public.notify_admin_new_record()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'bulk_order_requests' then
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'bulk_request.created', 'طلب جملة جديد ' || new.request_number,
            new.organization_name || ' — ' || new.estimated_quantity, '/admin/bulk/' || new.id);
  elsif tg_table_name = 'contact_inquiries' then
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'inquiry.created', 'استفسار جديد من ' || new.name, left(new.message, 140), '/admin/inquiries');
  end if;
  return new;
end $$;

create trigger bulk_order_requests_notify after insert on public.bulk_order_requests
  for each row execute function public.notify_admin_new_record();
create trigger contact_inquiries_notify after insert on public.contact_inquiries
  for each row execute function public.notify_admin_new_record();

-- ---------------------------------------------------------------------
-- Public order tracking (order number + phone must both match)
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders
   where order_number = upper(trim(p_order_number))
     and phone = public.normalize_iraqi_phone(p_phone);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'delivery_method', o.delivery_method,
    'governorate', o.governorate,
    'city', o.city,
    'total', o.total,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_en', name_en, 'quantity', quantity,
                'size_code', size_code, 'color_name_ar', color_name_ar, 'color_name_en', color_name_en)), '[]'::jsonb)
              from public.order_items where order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', to_status, 'at', created_at) order by created_at), '[]'::jsonb)
                from public.order_status_history where order_id = o.id)
  );
end $$;

-- ---------------------------------------------------------------------
-- Bulk: quantity-based price lookup
-- ---------------------------------------------------------------------
create or replace function public.bulk_unit_price(p_product_type text, p_quantity int)
returns int language sql stable security definer set search_path = public as $$
  select unit_price from public.bulk_pricing_rules
   where is_active and product_type = p_product_type and min_quantity <= p_quantity
     and (max_quantity is null or max_quantity >= p_quantity)
   order by min_quantity desc limit 1
$$;

-- Staff: convert an approved quotation into a real order
create or replace function public.convert_quotation_to_order(p_quotation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  qt public.quotations;
  br public.bulk_order_requests;
  v_order public.orders;
  it jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into qt from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'quotation_not_found' using errcode = 'P0002'; end if;
  if qt.status <> 'approved' then raise exception 'quotation_not_approved' using errcode = 'P0001'; end if;
  if jsonb_array_length(qt.items) = 0 then raise exception 'quotation_empty' using errcode = 'P0001'; end if;
  select * into br from public.bulk_order_requests where id = qt.bulk_request_id;

  insert into public.orders (user_id, customer_name, phone, email, governorate, city, address_line, delivery_notes,
    delivery_method, payment_method, status, subtotal, discount_total, delivery_fee, total, source, quotation_id, stock_committed)
  values (br.user_id, br.contact_name || ' — ' || br.organization_name, coalesce(public.normalize_iraqi_phone(br.phone), br.phone), br.email,
    'baghdad', '-', '-', 'Bulk order ' || br.request_number,
    'standard', 'cod', 'confirmed', qt.subtotal, qt.discount, qt.delivery_fee, qt.total, 'bulk', qt.id, false)
  returning * into v_order;

  for it in select * from jsonb_array_elements(qt.items) loop
    insert into public.order_items (order_id, name_ar, name_en, size_code, unit_price, quantity, line_total)
    values (v_order.id, coalesce(it ->> 'description', 'Bulk item'), coalesce(it ->> 'description', 'Bulk item'),
      it ->> 'size', (it ->> 'unit_price')::int, (it ->> 'quantity')::int, (it ->> 'unit_price')::int * (it ->> 'quantity')::int);
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (v_order.id, null, 'confirmed', 'Converted from quotation ' || qt.quote_number, auth.uid());
  update public.quotations set status = 'converted', order_id = v_order.id where id = qt.id;
  update public.bulk_order_requests set status = 'converted' where id = br.id;
  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'quotation.converted', 'quotation', qt.id::text, jsonb_build_object('order_id', v_order.id));
  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number);
end $$;

-- ---------------------------------------------------------------------
-- Staff: dashboard metrics
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_orders', (select count(*) from public.orders where created_at between p_from and p_to),
    'pending_orders', (select count(*) from public.orders where status in ('received', 'confirmed', 'preparing', 'printing', 'quality_check', 'ready_to_ship')),
    'completed_orders', (select count(*) from public.orders where status = 'delivered' and created_at between p_from and p_to),
    'cancelled_orders', (select count(*) from public.orders where status = 'cancelled' and created_at between p_from and p_to),
    'total_sales', (select coalesce(sum(total), 0) from public.orders where status <> 'cancelled' and created_at between p_from and p_to),
    'revenue', (select coalesce(sum(total - delivery_fee), 0) from public.orders where status = 'delivered' and created_at between p_from and p_to),
    'customers', (select count(*) from public.customer_profiles where role = 'customer'),
    'new_bulk_requests', (select count(*) from public.bulk_order_requests where status = 'new'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'total', t, 'orders', c) order by d), '[]'::jsonb) from (
        select date_trunc('day', created_at)::date as d, sum(total) as t, count(*) as c
          from public.orders where status <> 'cancelled' and created_at between p_from and p_to group by 1) s),
    'best_sellers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select oi.product_id, max(oi.name_ar) as name_ar, max(oi.name_en) as name_en, sum(oi.quantity) as units, sum(oi.line_total) as revenue
          from public.order_items oi join public.orders o on o.id = oi.order_id
         where o.status <> 'cancelled' and o.created_at between p_from and p_to and oi.product_id is not null
         group by oi.product_id order by sum(oi.quantity) desc limit 5) x),
    'low_stock', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select pv.id as variant_id, pv.sku, p.name_ar, p.name_en, i.quantity, i.low_stock_threshold
          from public.inventory i join public.product_variants pv on pv.id = i.variant_id join public.products p on p.id = pv.product_id
         where i.quantity <= i.low_stock_threshold and pv.is_active order by i.quantity asc limit 10) x)
  );
end $$;

-- ---------------------------------------------------------------------
-- Function privileges: nothing is callable by default.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.normalize_iraqi_phone(text) to anon, authenticated;
grant execute on function public.order_status_rank(public.order_status) to anon, authenticated;
grant execute on function public.can_transition_order(public.order_status, public.order_status) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.adjust_inventory(uuid, int, public.inventory_reason, text) to authenticated;
grant execute on function public.convert_quotation_to_order(uuid) to authenticated;
grant execute on function public.admin_dashboard_stats(timestamptz, timestamptz) to authenticated;
grant execute on function public.log_admin_activity(text, text, text, jsonb) to authenticated;
grant execute on function public.bulk_unit_price(text, int) to anon, authenticated;
-- quote_cart / place_order / check_rate_limit: service_role only (called from the server after validation)
grant execute on function public.quote_cart(jsonb) to service_role;
grant execute on function public.place_order(jsonb) to service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
