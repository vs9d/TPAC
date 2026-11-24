-- =====================================================================
-- TPAC: options for couple sets (and any product the admin chooses).
-- A product can ask for the second hoodie's size and for fields such as a
-- letter, a name or a date — once for the set or once for each hoodie.
-- The customer fills them in on the product page; they show in the bag,
-- at checkout, on the order, the invoice and the customer's order page.
-- Set them per product: Dashboard → Products → edit → «خيارات الطقم».
-- The 16 couple sets get sensible options (only if they have none yet).
-- Needs add-couple-hoodies.sql first for the sets' options.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- NB: quote_cart is wrapped here (the old one is kept as quote_cart_base).
-- If an older script that redefines quote_cart is run again later, run this
-- one again afterwards.
-- =====================================================================

alter table public.products add column if not exists couple_options jsonb;
alter table public.order_items add column if not exists options jsonb;
alter table public.cart_items add column if not exists options jsonb not null default '{}'::jsonb;
-- the same product can be in the bag twice with different names / letters
drop index if exists public.cart_items_variant_uniq;
create unique index if not exists cart_items_variant_opts_uniq on public.cart_items(cart_id, variant_id, options) where variant_id is not null;

-- the customer's answers: short strings under simple keys, empty ones dropped
create or replace function public.option_values_clean(p jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(key, left(btrim(value), 60)), '{}'::jsonb)
    from (select key, value from jsonb_each_text(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end)
           where key ~ '^[a-z0-9_]{1,30}$' and btrim(coalesce(value, '')) <> ''
           order by key limit 20) s;
$$;

-- answers → labelled options, following the product's couple_options; missing = a required answer is absent
create or replace function public.couple_line_options(p_product uuid, p_size text, p_values jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb;
  v jsonb := public.option_values_clean(p_values);
  f jsonb;
  out jsonb := '[]'::jsonb;
  missing boolean := false;
  n int;
  k text;
  val text;
  per boolean;
  lbl_ar text;
  lbl_en text;
begin
  select couple_options into cfg from public.products where id = p_product;
  if cfg is null or jsonb_typeof(cfg) <> 'object' then
    return jsonb_build_object('options', null, 'missing', false);
  end if;
  if coalesce((cfg ->> 'second_size')::boolean, false) then
    out := out || jsonb_build_object('key', 'size_1', 'label_ar', 'قياس الهودي الأول', 'label_en', 'First hoodie size', 'value', p_size);
    val := upper(v ->> 'size_2');
    if val is null or not exists (select 1 from public.sizes where code = val) then
      missing := true;
    else
      out := out || jsonb_build_object('key', 'size_2', 'label_ar', 'قياس الهودي الثاني', 'label_en', 'Second hoodie size', 'value', val);
    end if;
  end if;
  for f in select * from jsonb_array_elements(case when jsonb_typeof(cfg -> 'fields') = 'array' then cfg -> 'fields' else '[]'::jsonb end) loop
    continue when coalesce(f ->> 'key', '') !~ '^[a-z0-9_]{1,24}$';
    per := coalesce((f ->> 'per_piece')::boolean, false);
    for n in 1 .. case when per then 2 else 1 end loop
      k := (f ->> 'key') || case when per then '_' || n else '' end;
      val := left(v ->> k, case f ->> 'type' when 'letter' then 3 when 'date' then 20 else 30 end);
      lbl_ar := coalesce(f ->> 'label_ar', k) || case when per then ' — ' || case n when 1 then 'الهودي الأول' else 'الهودي الثاني' end else '' end;
      lbl_en := coalesce(nullif(f ->> 'label_en', ''), f ->> 'label_ar', k) || case when per then ' — ' || case n when 1 then 'First hoodie' else 'Second hoodie' end else '' end;
      if val is null then
        if coalesce((f ->> 'required')::boolean, false) then missing := true; end if;
      else
        out := out || jsonb_build_object('key', k, 'label_ar', lbl_ar, 'label_en', lbl_en, 'value', val);
      end if;
    end loop;
  end loop;
  return jsonb_build_object('options', out, 'missing', missing);
end $$;

-- keep the original calculation as quote_cart_base (once)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'quote_cart_base' and pronamespace = 'public'::regnamespace) then
    alter function public.quote_cart(jsonb) rename to quote_cart_base;
  end if;
end $$;

-- quote_cart: the same product with different answers = separate lines; prices and stock are checked
-- on the product's total quantity by quote_cart_base, then each line gets its options back
create or replace function public.quote_cart(payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_items jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  v_agg jsonb := '[]'::jsonb;
  v_sum jsonb := '{}'::jsonb;
  v_seen jsonb := '{}'::jsonb;
  e jsonb;
  k text;
  base jsonb;
  bl jsonb;
  ln jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_errors jsonb;
  v_qty int;
  v_vals jsonb;
  v_res jsonb;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return public.quote_cart_base(payload);
  end if;
  if jsonb_array_length(v_items) > 50 then
    raise exception 'too_many_items' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(v_items) loop
    k := coalesce(e ->> 'variant_id', 'd:' || (e ->> 'custom_design_id'), '') || '|' || public.option_values_clean(e -> 'options')::text;
    if v_seen ? k then
      raise exception 'duplicate_cart_line' using errcode = '22023';
    end if;
    v_seen := v_seen || jsonb_build_object(k, true);
    if e ->> 'variant_id' is not null then
      v_sum := v_sum || jsonb_build_object(e ->> 'variant_id', coalesce((v_sum ->> (e ->> 'variant_id'))::int, 0) + coalesce((e ->> 'quantity')::int, 0));
    else
      v_agg := v_agg || jsonb_build_array(e - 'options');
    end if;
  end loop;
  v_agg := v_agg || coalesce((select jsonb_agg(jsonb_build_object('variant_id', key, 'quantity', value::int)) from jsonb_each_text(v_sum)), '[]'::jsonb);

  base := public.quote_cart_base(payload || jsonb_build_object('items', v_agg));
  v_errors := coalesce(base -> 'errors', '[]'::jsonb);

  for e in select * from jsonb_array_elements(v_items) loop
    if e ->> 'variant_id' is not null then
      select x into bl from jsonb_array_elements(base -> 'lines') x where x ->> 'variant_id' = e ->> 'variant_id' limit 1;
      v_qty := coalesce((e ->> 'quantity')::int, 0);
      v_vals := public.option_values_clean(e -> 'options');
      ln := coalesce(bl, jsonb_build_object('variant_id', e ->> 'variant_id', 'error', 'unavailable'))
            || jsonb_build_object('quantity', v_qty,
                 'line_total', case when bl ->> 'error' = 'unavailable' or bl is null then 0 else coalesce((bl ->> 'unit_price')::int, 0) * v_qty end,
                 'option_values', v_vals);
      if bl ->> 'product_id' is not null then
        v_res := public.couple_line_options((bl ->> 'product_id')::uuid, bl ->> 'size_code', v_vals);
        ln := ln || jsonb_build_object('options', v_res -> 'options');
        if (v_res ->> 'missing')::boolean and ln ->> 'error' is null then
          ln := ln || jsonb_build_object('error', 'options_required');
          v_errors := v_errors || jsonb_build_object('code', 'options_required', 'variant_id', e ->> 'variant_id');
        end if;
      end if;
    else
      select x into ln from jsonb_array_elements(base -> 'lines') x where x ->> 'custom_design_id' = e ->> 'custom_design_id' limit 1;
      ln := coalesce(ln, jsonb_build_object('custom_design_id', e ->> 'custom_design_id', 'quantity', coalesce((e ->> 'quantity')::int, 0), 'error', 'unavailable', 'line_total', 0));
    end if;
    v_lines := v_lines || jsonb_build_array(ln);
  end loop;

  return base || jsonb_build_object('lines', v_lines, 'errors', v_errors);
end $$;

-- place_order: same as before, and keeps each line's options on the order
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
      color_name_ar, color_name_en, color_hex, image_url, unit_price, quantity, line_total, options)
    values (v_order.id, nullif(v_line ->> 'product_id', '')::uuid, nullif(v_line ->> 'variant_id', '')::uuid,
      nullif(v_line ->> 'custom_design_id', '')::uuid, v_line ->> 'name_ar', v_line ->> 'name_en', v_line ->> 'sku',
      v_line ->> 'size_code', v_line ->> 'color_name_ar', v_line ->> 'color_name_en', v_line ->> 'color_hex',
      coalesce(v_line ->> 'image_url', v_line ->> 'preview_path'),
      (v_line ->> 'unit_price')::int, (v_line ->> 'quantity')::int, (v_line ->> 'line_total')::int,
      case when jsonb_typeof(v_line -> 'options') = 'array' and jsonb_array_length(v_line -> 'options') > 0 then v_line -> 'options' end);

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


revoke all on function public.quote_cart_base(jsonb) from public, anon, authenticated;
revoke all on function public.quote_cart(jsonb) from public, anon, authenticated;
revoke all on function public.place_order(jsonb) from public, anon, authenticated;
revoke all on function public.couple_line_options(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.quote_cart_base(jsonb) to service_role;
grant execute on function public.quote_cart(jsonb) to service_role;
grant execute on function public.place_order(jsonb) to service_role;
grant execute on function public.couple_line_options(uuid, text, jsonb) to service_role;
grant execute on function public.option_values_clean(jsonb) to anon, authenticated, service_role;

-- options of the 16 couple sets (kept if the admin already set them)
update public.products p set couple_options = v.cfg
  from (values
  ('old-cinema-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('coordinates-couple-hoodies', '{"second_size": true, "fields": [{"key": "coords", "label_ar": "الإحداثيات", "label_en": "Coordinates", "type": "text", "per_piece": false, "required": false}, {"key": "sleeve", "label_ar": "حرف الردن", "label_en": "Sleeve letter", "type": "letter", "per_piece": true, "required": false}]}'::jsonb),
  ('anatomy-heart-names-couple-hoodies', '{"second_size": true, "fields": [{"key": "name", "label_ar": "الاسم", "label_en": "Name", "type": "text", "per_piece": true, "required": true}, {"key": "date", "label_ar": "التاريخ", "label_en": "Date", "type": "date", "per_piece": false, "required": true}, {"key": "sleeve", "label_ar": "حروف الردن", "label_en": "Sleeve initials", "type": "text", "per_piece": false, "required": false}]}'::jsonb),
  ('bears-forever-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('pinky-love-couple-hoodies', '{"second_size": true, "fields": [{"key": "sleeve", "label_ar": "حرف الردن", "label_en": "Sleeve letter", "type": "letter", "per_piece": true, "required": false}]}'::jsonb),
  ('puzzle-heart-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('full-of-you-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('fik-minni-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('bunnies-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('always-with-you-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('little-chicks-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('ocean-heart-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb),
  ('initial-heart-couple-hoodies', '{"second_size": true, "fields": [{"key": "letter", "label_ar": "الحرف داخل القلب", "label_en": "Letter in the heart", "type": "letter", "per_piece": true, "required": true}]}'::jsonb),
  ('stitch-hug-couple-hoodies', '{"second_size": true, "fields": [{"key": "sleeve", "label_ar": "تاريخ الردن", "label_en": "Sleeve date", "type": "date", "per_piece": false, "required": false}]}'::jsonb),
  ('pinky-promise-date-couple-hoodies', '{"second_size": true, "fields": [{"key": "date", "label_ar": "التاريخ", "label_en": "Date", "type": "date", "per_piece": false, "required": true}]}'::jsonb),
  ('stitch-angel-couple-hoodies', '{"second_size": true, "fields": []}'::jsonb)
  ) as v(slug, cfg)
 where p.slug = v.slug and p.couple_options is null;

-- the sets' descriptions: sizes and names are now chosen on the product page, not in the order notes
update public.products set
  description_ar = replace(replace(description_ar,
    'المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'تختارون قياس كل هودي بصفحة المنتج.'),
    'اكتبوها بملاحظات الطلب.', 'اكتبوها بالخانات بصفحة المنتج.'),
  description_en = replace(replace(description_en,
    'The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.', 'Pick each hoodie''s size on the product page.'),
    'write them in the order notes.', 'fill them in on the product page.')
 where slug like '%-couple-hoodies' and couple_options is not null;
