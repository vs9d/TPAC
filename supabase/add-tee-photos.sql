-- =====================================================================
-- TPAC: t-shirt photos for the print studio + the hoodie "front + back in one photo".
--  • T-shirt: 6 colours (black, white, heather grey, navy, maroon, brown) × 4 views
--    (front, back, right sleeve, left sleeve). Made from one real photo of a black tee
--    (cut out, front neckline added, sleeves as close-ups, recoloured with folds kept).
--  • Hoodie: an extra view "front + back (one photo)" — the back hoodie in front, the front
--    hoodie behind it — with print spots for the back and the left chest. The admin places the
--    artwork on it (or copies it from the front / back with one button) and it becomes a product photo.
-- Needs add-product-printing-1.sql and -2.sql first (add-hoodie-photos.sql recommended).
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================

insert into public.colors (code, name_ar, name_en, hex, sort_order) values
  ('brown', 'بني', 'Brown', '#5B4231', 8),
  ('maroon', 'نبيتي', 'Maroon', '#5E1A24', 9)
on conflict (code) do nothing;

-- ---------------------------------------------------------------- t-shirt
update public.custom_garment_types
   set color_ids = array(select distinct unnest(color_ids || array(select id from public.colors where code in ('black', 'white', 'heather', 'navy', 'maroon', 'brown'))))
 where code = 'tshirt';
update public.product_types
   set default_color_ids = array(select distinct unnest(default_color_ids || array(select id from public.colors where code in ('black', 'white', 'heather', 'navy', 'maroon', 'brown'))))
 where code = 'tshirt';

insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select t.id, v.code, v.name_ar, v.name_en, 600, 862, v.sort_order
  from public.product_types t
 cross join (values ('right', 'الكم الأيمن', 'Right sleeve', 2), ('left', 'الكم الأيسر', 'Left sleeve', 3)) as v(code, name_ar, name_en, sort_order)
 where t.code = 'tshirt'
on conflict (product_type_id, code) do nothing;

update public.product_type_views v
   set mockup_url = '/mockups/tee-black-' || v.code || '.webp', mockup_path = null,
       mockup_width = case when v.code in ('right', 'left') then 600 else 1000 end,
       mockup_height = case when v.code in ('right', 'left') then 862 else 924 end,
       color_mockups = coalesce(v.color_mockups, '{}'::jsonb) || (
         select coalesce(jsonb_object_agg(c.id::text, jsonb_build_object('url', '/mockups/tee-' || c.code || '-' || v.code || '.webp')), '{}'::jsonb)
           from public.colors c where c.code in ('black', 'white', 'heather', 'navy', 'maroon', 'brown'))
  from public.product_types t
 where t.id = v.product_type_id and t.code = 'tshirt' and v.code in ('front', 'back', 'right', 'left');

update public.product_print_areas a set code = replace(a.code, '-', '_')
 where a.code in ('left-chest', 'sleeve-left')
   and not exists (select 1 from public.product_print_areas b where b.view_id = a.view_id and b.code = replace(a.code, '-', '_'));

-- print areas measured on the photos; the sleeves move onto their own photos (same rows)
update public.product_print_areas a
   set view_id = target.id, x = p.x, y = p.y, width = p.w, height = p.h, max_width_cm = p.cw, max_height_cm = p.ch
  from (values ('front',       'front', 0.33959, 0.18652, 0.31741, 0.42475, 28.0, 35.0),
               ('left_chest',  'front', 0.54437, 0.17729, 0.10239, 0.11080, 9.0, 9.0),
               ('back',        'back',  0.33191, 0.14035, 0.33276, 0.48015, 30.0, 40.0),
               ('sleeve',      'right', 0.34620, 0.46430, 0.30770, 0.21430, 9.0, 9.0),
               ('sleeve_left', 'left',  0.34620, 0.46430, 0.30770, 0.21430, 9.0, 9.0)) as p(code, view_code, x, y, w, h, cw, ch),
       public.product_types t
  join public.product_type_views target on target.product_type_id = t.id
 where t.code = 'tshirt' and target.code = p.view_code and a.code = p.code
   and a.view_id in (select id from public.product_type_views where product_type_id = t.id);

-- ---------------------------------------------------------------- hoodie: front + back in one photo
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select t.id, 'combo', 'أمام وخلف (صورة وحدة)', 'Front + back (one photo)', 1000, 1000, 9
  from public.product_types t where t.code = 'hoodie'
on conflict (product_type_id, code) do nothing;

update public.product_type_views v
   set mockup_url = '/mockups/hoodie-black-combo.webp', mockup_path = null, mockup_width = 1000, mockup_height = 1000,
       color_mockups = coalesce(v.color_mockups, '{}'::jsonb) || (
         select coalesce(jsonb_object_agg(c.id::text, jsonb_build_object('url', '/mockups/hoodie-' || c.code || '-combo.webp')), '{}'::jsonb)
           from public.colors c where c.code in ('black', 'white', 'brown', 'navy', 'maroon'))
  from public.product_types t
 where t.id = v.product_type_id and t.code = 'hoodie' and v.code = 'combo';

insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, p.code, p.name_ar, p.name_en, p.x, p.y, p.w, p.h, p.cw, p.ch, p.sort_order
  from public.product_type_views v
  join public.product_types t on t.id = v.product_type_id and t.code = 'hoodie'
 cross join (values ('combo_back',  'الظهر',        'Back',       0.23400, 0.42800, 0.35200, 0.40480, 32.0, 38.0, 0),
                    ('combo_chest', 'الصدر الأيسر', 'Left chest', 0.69630, 0.23869, 0.07920, 0.07913, 9.0, 9.0, 1)) as p(code, name_ar, name_en, x, y, w, h, cw, ch, sort_order)
 where v.code = 'combo'
on conflict (view_id, code) do nothing;
