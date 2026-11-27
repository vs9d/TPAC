-- TPAC: the gift box for every product (not only designs from the studio).
--
-- A cart line may carry gift_box = '1' and box_text (the words for the lid) in its options.
-- The price is the paid "packaging" option of the print designer (Dashboard → Print designer →
-- Options), so the admin sets it in one place. It is added per piece, on the server only.
-- Needs add-couple-options.sql (line options) first.

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'couple_line_options' and pronamespace = 'public'::regnamespace) then
    raise exception 'شغّل supabase/add-couple-options.sql أولاً — run add-couple-options.sql first';
  end if;
end $$;

-- the gift box option: the paid packaging choice ('gift' first), or nothing when the admin has none / disabled it
create or replace function public.gift_box_option()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', code, 'name_ar', name_ar, 'name_en', name_en, 'price', price)
    from public.designer_options
   where group_code = 'package' and is_active and price > 0
   order by (code = 'gift') desc, sort_order
   limit 1;
$$;

-- quote_cart: as before (one line per product + answers), plus the gift box on the lines that asked for it
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
  v_gift jsonb := public.gift_box_option();
  v_gift_price int := coalesce((v_gift ->> 'price')::int, 0);
  v_extra int := 0;
  v_unit int;
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
      -- gift box: priced per piece here (never from the browser) and listed with the line's options
      if v_vals ->> 'gift_box' = '1' and v_gift_price > 0 and bl is not null and coalesce(bl ->> 'error', '') <> 'unavailable' then
        v_unit := coalesce((ln ->> 'unit_price')::int, 0) + v_gift_price;
        ln := ln || jsonb_build_object(
          'unit_price', v_unit,
          'line_total', v_unit * v_qty,
          'gift_box_price', v_gift_price,
          'options', coalesce(case when jsonb_typeof(ln -> 'options') = 'array' then ln -> 'options' end, '[]'::jsonb)
                     || jsonb_build_array(jsonb_build_object('key', 'gift_box', 'label_ar', coalesce(v_gift ->> 'name_ar', 'علبة هدية'),
                          'label_en', coalesce(v_gift ->> 'name_en', 'Gift box'),
                          'value', coalesce(left(v_vals ->> 'box_text', 40), 'بدون كتابة'))));
        v_extra := v_extra + v_gift_price * v_qty;
      end if;
    else
      select x into ln from jsonb_array_elements(base -> 'lines') x where x ->> 'custom_design_id' = e ->> 'custom_design_id' limit 1;
      ln := coalesce(ln, jsonb_build_object('custom_design_id', e ->> 'custom_design_id', 'quantity', coalesce((e ->> 'quantity')::int, 0), 'error', 'unavailable', 'line_total', 0));
    end if;
    v_lines := v_lines || jsonb_build_array(ln);
  end loop;

  base := base || jsonb_build_object('lines', v_lines, 'errors', v_errors);
  if v_extra > 0 then
    -- the boxes are added after any discount code (a coupon never reduces the box)
    base := base || jsonb_build_object(
      'subtotal', coalesce((base ->> 'subtotal')::int, 0) + v_extra,
      'total', coalesce((base ->> 'total')::int, 0) + v_extra,
      'gift_boxes_total', v_extra);
  end if;
  return base;
end $$;

revoke all on function public.gift_box_option() from public, anon, authenticated;
grant execute on function public.gift_box_option() to service_role;
revoke all on function public.quote_cart(jsonb) from public, anon, authenticated;
grant execute on function public.quote_cart(jsonb) to service_role;
