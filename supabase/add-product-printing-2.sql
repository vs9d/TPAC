-- =====================================================================
-- TPAC: product printing — PART 2 of 2 (built-in types + settings).
-- Run PART 1 first. Safe to run more than once; your changes are kept.
-- =====================================================================

-- built-in types (hoodie, T-shirt…) laid out like the drawn garments
insert into public.product_types (code, name_ar, name_en, garment_shape, default_price, sort_order) values
  ('tshirt', 'تيشيرت', 'T-shirt', 'tshirt', 20000, 1),
  ('oversized', 'تيشيرت أوفرسايز', 'Oversized tee', 'oversized', 25000, 2),
  ('hoodie', 'هودي', 'Hoodie', 'hoodie', 40000, 3),
  ('sweatshirt', 'سويتشيرت', 'Sweatshirt', 'sweatshirt', 35000, 4),
  ('longsleeve', 'كم طويل', 'Long sleeve', 'longsleeve', 28000, 5)
on conflict (code) do nothing;

insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select t.id, v.code, v.name_ar, v.name_en, 600, 700, v.sort_order
  from public.product_types t
 cross join (values ('front', 'الأمام', 'Front', 0), ('back', 'الخلف', 'Back', 1)) as v(code, name_ar, name_en, sort_order)
 where t.garment_shape is not null
on conflict (product_type_id, code) do nothing;

-- an earlier dashboard version saved some placement codes with "-" (left-chest, sleeve-left): repair them
update public.product_print_areas a set code = replace(a.code, '-', '_')
 where a.code in ('left-chest', 'sleeve-left')
   and not exists (select 1 from public.product_print_areas b where b.view_id = a.view_id and b.code = replace(a.code, '-', '_'));

insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, a.code, n.name_ar, n.name_en, a.x, a.y, a.w, a.h, a.cw, a.ch, a.s
  from (values
    ('tshirt', 'front', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0),
    ('tshirt', 'back', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1),
    ('tshirt', 'left_chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2),
    ('tshirt', 'sleeve', 0.10333, 0.21429, 0.08667, 0.07429, 8, 8, 3),
    ('tshirt', 'sleeve_left', 0.81000, 0.21429, 0.08667, 0.07429, 8, 8, 4),
    ('oversized', 'front', 0.32000, 0.21429, 0.36000, 0.42857, 32, 42, 0),
    ('oversized', 'back', 0.30667, 0.18286, 0.38667, 0.48571, 34, 48, 1),
    ('oversized', 'left_chest', 0.58667, 0.20000, 0.12000, 0.10286, 10, 10, 2),
    ('oversized', 'sleeve', 0.06667, 0.28571, 0.09333, 0.08000, 8, 8, 3),
    ('oversized', 'sleeve_left', 0.84000, 0.28571, 0.09333, 0.08000, 8, 8, 4),
    ('hoodie', 'front', 0.34000, 0.27143, 0.32000, 0.31429, 28, 30, 0),
    ('hoodie', 'back', 0.31667, 0.33714, 0.36667, 0.41429, 32, 40, 1),
    ('hoodie', 'left_chest', 0.58333, 0.25143, 0.10667, 0.09143, 10, 10, 2),
    ('hoodie', 'sleeve', 0.13333, 0.27143, 0.07667, 0.06571, 8, 8, 3),
    ('hoodie', 'sleeve_left', 0.79000, 0.27143, 0.07667, 0.06571, 8, 8, 4),
    ('sweatshirt', 'front', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0),
    ('sweatshirt', 'back', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1),
    ('sweatshirt', 'left_chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2),
    ('sweatshirt', 'sleeve', 0.12667, 0.25143, 0.07667, 0.06571, 8, 8, 3),
    ('sweatshirt', 'sleeve_left', 0.79667, 0.25143, 0.07667, 0.06571, 8, 8, 4),
    ('longsleeve', 'front', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0),
    ('longsleeve', 'back', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1),
    ('longsleeve', 'left_chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2),
    ('longsleeve', 'sleeve', 0.12667, 0.24286, 0.07667, 0.06571, 8, 8, 3),
    ('longsleeve', 'sleeve_left', 0.79667, 0.24286, 0.07667, 0.06571, 8, 8, 4)
  ) as a(type_code, code, x, y, w, h, cw, ch, s)
  join (values
    ('front', 'وسط الأمام', 'Front centre'),
    ('back', 'وسط الظهر', 'Back centre'),
    ('left_chest', 'الصدر الأيسر', 'Left chest'),
    ('sleeve', 'الكم الأيمن', 'Right sleeve'),
    ('sleeve_left', 'الكم الأيسر', 'Left sleeve')
  ) as n(code, name_ar, name_en) on n.code = a.code
  join public.product_types t on t.code = a.type_code
  join public.product_type_views v on v.product_type_id = t.id and v.code = case when a.code = 'back' then 'back' else 'front' end
on conflict (view_id, code) do nothing;

-- black & white as default colours of the built-in types (only where none are set yet)
update public.product_types
   set default_color_ids = array(select id from public.colors where code in ('black', 'white') order by sort_order)
 where default_color_ids = '{}' and garment_shape is not null;

-- the switch for customers uploading their OWN designs in "Design your piece" (on by default)
insert into public.website_settings (key, value) values ('designer', '{"customer_uploads": true}'::jsonb)
on conflict (key) do update set value = jsonb_build_object('customer_uploads', true) || website_settings.value;
