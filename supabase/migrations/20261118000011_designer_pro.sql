-- =====================================================================
-- TPAC: Designer Pro — print options, quantity discounts, richer designs.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================

-- 1) Designs: a name, a batch (one design ordered in several sizes), chosen options
alter table public.custom_designs add column if not exists name text check (name is null or length(name) <= 80);
alter table public.custom_designs add column if not exists batch_id uuid;
alter table public.custom_designs add column if not exists options jsonb not null default '{}'::jsonb;
alter table public.custom_designs add column if not exists options_price int not null default 0 check (options_price >= 0);
create index if not exists custom_designs_batch_idx on public.custom_designs(batch_id) where batch_id is not null;

-- 2) Print options managed from the dashboard (method / finish / fabric / package are single-choice, addon is multi-choice)
create table if not exists public.designer_options (
  id uuid primary key default gen_random_uuid(),
  group_code text not null check (group_code in ('method', 'finish', 'fabric', 'package', 'addon')),
  code text not null check (code ~ '^[a-z0-9_]{2,32}$'),
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  price int not null default 0 check (price >= 0 and price <= 1000000),
  is_default boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (group_code, code)
);

-- 3) Quantity discount for made-to-order pieces (applied by quote_cart on the total custom quantity)
create table if not exists public.designer_tiers (
  min_qty int primary key check (min_qty > 1 and min_qty <= 10000),
  discount_percent int not null check (discount_percent between 1 and 60),
  is_active boolean not null default true
);

alter table public.designer_options enable row level security;
alter table public.designer_tiers enable row level security;
drop policy if exists designer_options_read on public.designer_options;
drop policy if exists designer_options_write on public.designer_options;
drop policy if exists designer_tiers_read on public.designer_tiers;
drop policy if exists designer_tiers_write on public.designer_tiers;
create policy designer_options_read on public.designer_options for select to anon, authenticated using (is_active or public.is_staff());
create policy designer_options_write on public.designer_options for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy designer_tiers_read on public.designer_tiers for select to anon, authenticated using (is_active or public.is_staff());
create policy designer_tiers_write on public.designer_tiers for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 4) Starter data (only when empty, so your edits are never overwritten)
insert into public.designer_options (group_code, code, name_ar, name_en, description_ar, description_en, price, is_default, sort_order)
select * from (values
  ('method', 'dtf',        'طباعة DTF',        'DTF print',       'ألوان كاملة ودقة عالية، تناسب الصور والتفاصيل', 'Full colour, high detail — ideal for photos and artwork', 0, true, 1),
  ('method', 'vinyl',      'فينيل حراري',      'Heat-press vinyl','ألوان صلبة نظيفة للشعارات والنصوص',               'Clean solid colours for logos and lettering',          2000, false, 2),
  ('method', 'screen',     'سلك سكرين',        'Screen print',    'الأفضل للكميات الكبيرة وألوان محدودة',            'Best for large runs with few colours',                  1500, false, 3),
  ('method', 'embroidery', 'تطريز',            'Embroidery',      'خيوط مطرّزة بملمس فاخر (للتصاميم الصغيرة)',       'Stitched thread with a premium feel (small designs)',   6000, false, 4),
  ('finish', 'matte',      'مطفي',             'Matte',           'ملمس ناعم بدون لمعان',                           'Soft finish, no shine',                                 0, true, 1),
  ('finish', 'glossy',     'لامع',             'Glossy',          'سطح لامع بألوان زاهية',                           'Shiny surface, vivid colours',                          1000, false, 2),
  ('finish', 'puff',       'بارز 3D',          '3D puff',         'طباعة بارزة بملمس مرتفع',                         'Raised, textured print',                                2500, false, 3),
  ('finish', 'glitter',    'لمعة جليتر',       'Glitter',         'جزيئات لامعة تلمع تحت الضوء',                     'Sparkling particles that catch the light',              2500, false, 4),
  ('finish', 'reflective', 'عاكس للضوء',       'Reflective',      'يلمع عند تسليط الضوء عليه ليلاً',                 'Lights up under headlights at night',                   3000, false, 5),
  ('fabric', 'standard',   'قطن قياسي ٢٤٠غ',   'Standard 240 GSM','قطن مريح للاستخدام اليومي',                       'Comfortable everyday cotton',                           0, true, 1),
  ('fabric', 'heavy',      'قطن ثقيل ٣٢٠غ',    'Heavyweight 320 GSM','قماش أثقل بقَصّة فاخرة',                      'Heavier cloth with a premium drape',                    5000, false, 2),
  ('fabric', 'organic',    'قطن مسرّح فاخر',   'Combed premium',  'ألياف مسرّحة أنعم وأكثر متانة',                   'Softer, longer-lasting combed fibres',                  3500, false, 3),
  ('package', 'standard',  'تغليف عادي',       'Standard bag',    'كيس شفاف',                                        'Clear polybag',                                         0, true, 1),
  ('package', 'gift',      'علبة هدية',        'Gift box',        'علبة أنيقة جاهزة للإهداء',                       'Neat box, ready to gift',                               2500, false, 2),
  ('addon', 'custom_label','علامة رقبة مخصصة', 'Custom neck label','علامة بشعارك داخل ياقة القطعة',                 'Your own label inside the collar',                      1500, false, 1),
  ('addon', 'hang_tag',    'بطاقة تعليق',      'Hang tag',        'بطاقة معلّقة بشعار TPAC',                         'TPAC hang tag',                                         500, false, 2),
  ('addon', 'gift_note',   'بطاقة إهداء',      'Gift note',       'بطاقة مكتوبة بخطك داخل العبوة',                   'A handwritten-style card in the package',               500, false, 3),
  ('addon', 'single_pack', 'تغليف فردي',       'Individually packed','كل قطعة بكيس منفصل',                          'Every piece packed separately',                         300, false, 4),
  ('addon', 'rush',        'تجهيز سريع',       'Rush production', 'أولوية في الطباعة والتسليم',                      'Priority printing and dispatch',                        5000, false, 5)
) v(group_code, code, name_ar, name_en, description_ar, description_en, price, is_default, sort_order)
where not exists (select 1 from public.designer_options);

insert into public.designer_tiers (min_qty, discount_percent)
select * from (values (6, 5), (12, 10), (24, 15), (50, 20)) v(min_qty, discount_percent)
where not exists (select 1 from public.designer_tiers);

insert into public.website_settings (key, value) values
  ('designer', '{"lead_days_min":3,"lead_days_max":5,"rush_days":2,"notice_ar":"كل قطعة تُطبع حسب الطلب ولا يمكن إرجاعها بعد الطباعة. راجع التصميم جيداً قبل التأكيد.","notice_en":"Every piece is printed to order and cannot be returned after printing. Please review your design carefully before confirming.","min_dpi":150}'::jsonb)
on conflict (key) do nothing;

-- 5) Garments: long sleeve joins the designer (T-shirt, oversized, hoodie, sweatshirt, long sleeve)
insert into public.custom_garment_types (code, name_ar, name_en, base_price, color_ids, sizes, print_locations, sort_order, is_active)
select 'longsleeve', 'تيشيرت كم طويل', 'Long-sleeve tee', 28000,
       array(select id from public.colors where code in ('black', 'white')), '{S,M,L,XL,XXL}',
       '{front,back,left_chest,sleeve,sleeve_left}', 5, false
where not exists (select 1 from public.custom_garment_types where code = 'longsleeve');

-- 6) quote_cart: quantity discount on custom pieces (the only place prices are computed)
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
  v_custom_qty int := 0;
  v_tier_pct int := 0;
  v_unit int;
begin
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    v_errors := v_errors || jsonb_build_object('code', 'empty_cart');
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) > 50 then
    raise exception 'too_many_items' using errcode = '22023';
  end if;

  -- Quantity discount for made-to-order pieces: based on the TOTAL number of custom pieces in the cart.
  select coalesce(sum((e ->> 'quantity')::int), 0) into v_custom_qty
    from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) e
   where e ->> 'custom_design_id' is not null and coalesce((e ->> 'quantity')::int, 0) between 1 and 99;
  select coalesce(max(discount_percent), 0) into v_tier_pct
    from public.designer_tiers where is_active and min_qty <= v_custom_qty;

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
        v_unit := greatest(r.unit_price - (round(r.unit_price * v_tier_pct / 100.0 / 250.0) * 250)::int, 0);
        v_line := jsonb_build_object(
          'custom_design_id', r.id, 'name_ar', r.name_ar || ' — تصميم خاص', 'name_en', 'Custom ' || r.name_en,
          'size_code', r.size_code, 'color_name_ar', r.color_name_ar, 'color_name_en', r.color_name_en,
          'color_hex', r.color_hex, 'preview_path', r.preview_front_path, 'print_locations', to_jsonb(r.print_locations),
          'unit_price', v_unit, 'list_price', r.unit_price, 'tier_percent', v_tier_pct,
          'quantity', v_qty, 'line_total', v_unit * greatest(v_qty, 0));
        if v_qty < 1 or v_qty > 99 then
          v_line := v_line || jsonb_build_object('error', 'invalid_quantity');
          v_errors := v_errors || jsonb_build_object('code', 'invalid_quantity', 'custom_design_id', r.id);
        else
          v_subtotal := v_subtotal + v_unit * v_qty;
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
