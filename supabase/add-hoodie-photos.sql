-- =====================================================================
-- TPAC: hoodie photos for the print studio — 5 colours (black, white, brown,
-- navy, maroon) × 4 views (front, back, right side, left side).
-- Black & white back / side views are real photos; brown, navy and maroon
-- back / side views are the black photos recoloured (same folds and seams).
-- Needs add-product-printing-1.sql and -2.sql first.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- The photos ship with the website (/mockups/…); replace any of them from
-- Dashboard → Print designer → Printing images.
-- =====================================================================

insert into public.colors (code, name_ar, name_en, hex, sort_order) values
  ('brown', 'بني', 'Brown', '#5B4231', 8),
  ('maroon', 'نبيتي', 'Maroon', '#5E1A24', 9)
on conflict (code) do nothing;

-- the hoodie is offered in the five photographed colours (other colours already chosen are kept)
update public.custom_garment_types
   set color_ids = array(select distinct unnest(color_ids || array(select id from public.colors where code in ('black', 'white', 'brown', 'navy', 'maroon'))))
 where code = 'hoodie';
update public.product_types
   set default_color_ids = array(select distinct unnest(default_color_ids || array(select id from public.colors where code in ('black', 'white', 'brown', 'navy', 'maroon'))))
 where code = 'hoodie';

-- a view of its own for each sleeve
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select t.id, v.code, v.name_ar, v.name_en, 700, 1100, v.sort_order
  from public.product_types t
 cross join (values ('right', 'الكم الأيمن', 'Right sleeve', 2), ('left', 'الكم الأيسر', 'Left sleeve', 3)) as v(code, name_ar, name_en, sort_order)
 where t.code = 'hoodie'
on conflict (product_type_id, code) do nothing;

-- photos: the black one is the default, every colour has its own
update public.product_type_views v
   set mockup_url = '/mockups/hoodie-black-' || v.code || '.webp', mockup_path = null,
       mockup_width = case when v.code in ('right', 'left') then 700 else 1000 end,
       mockup_height = 1100,
       color_mockups = coalesce(v.color_mockups, '{}'::jsonb) || (
         select coalesce(jsonb_object_agg(c.id::text, jsonb_build_object('url', '/mockups/hoodie-' || c.code || '-' || v.code || '.webp')), '{}'::jsonb)
           from public.colors c where c.code in ('black', 'white', 'brown', 'navy', 'maroon'))
  from public.product_types t
 where t.id = v.product_type_id and t.code = 'hoodie' and v.code in ('front', 'back', 'right', 'left');

-- repair: an earlier dashboard version saved some placement codes with "-" (left-chest, sleeve-left)
update public.product_print_areas a set code = replace(a.code, '-', '_')
 where a.code in ('left-chest', 'sleeve-left')
   and not exists (select 1 from public.product_print_areas b where b.view_id = a.view_id and b.code = replace(a.code, '-', '_'));

-- print areas measured on the photos (fractions of the photo, max size in cm);
-- the sleeves move onto their own photos (same rows, so existing products keep their artwork)
update public.product_print_areas a
   set view_id = target.id, x = p.x, y = p.y, width = p.w, height = p.h, max_width_cm = p.cw, max_height_cm = p.ch
  from (values ('front',       'front', 0.31000, 0.30000, 0.38000, 0.23000, 28.0, 19.0),
               ('left_chest',  'front', 0.55500, 0.31500, 0.12000, 0.10900, 9.0, 9.0),
               ('back',        'back',  0.28000, 0.35000, 0.44000, 0.46000, 32.0, 38.0),
               ('sleeve',      'right', 0.42000, 0.40000, 0.16000, 0.34000, 8.0, 28.0),
               ('sleeve_left', 'left',  0.42000, 0.40000, 0.16000, 0.34000, 8.0, 28.0)) as p(code, view_code, x, y, w, h, cw, ch),
       public.product_types t
  join public.product_type_views target on target.product_type_id = t.id
 where t.code = 'hoodie' and target.code = p.view_code and a.code = p.code
   and a.view_id in (select id from public.product_type_views where product_type_id = t.id);
