-- =====================================================================
-- TPAC: real hoodie photos (black, white, brown, navy) for the print studio
-- and for hoodie products. Needs add-product-printing.sql first.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- The photos ship with the website (/mockups/…): replace them any time from
-- Dashboard → Print designer → Printing images.
-- =====================================================================

insert into public.colors (code, name_ar, name_en, hex, sort_order)
values ('brown', 'بني', 'Brown', '#5B4231', 8)
on conflict (code) do nothing;

-- the hoodie is offered in the four photographed colours (existing colours are kept)
update public.custom_garment_types
   set color_ids = array(select distinct unnest(color_ids || array(select id from public.colors where code in ('black', 'white', 'navy', 'brown'))))
 where code = 'hoodie';
update public.product_types
   set default_color_ids = array(select distinct unnest(default_color_ids || array(select id from public.colors where code in ('black', 'white', 'navy', 'brown'))))
 where code = 'hoodie';

-- front view: default photo + one photo per colour (all 1000 × 1100, garment in the same place)
update public.product_type_views v
   set mockup_url = '/mockups/hoodie-black-front.webp', mockup_path = null, mockup_width = 1000, mockup_height = 1100,
       color_mockups = coalesce(v.color_mockups, '{}'::jsonb) || (
         select coalesce(jsonb_object_agg(c.id::text, jsonb_build_object('url', '/mockups/hoodie-' || c.code || '-front.webp')), '{}'::jsonb)
           from public.colors c where c.code in ('black', 'white', 'navy', 'brown'))
  from public.product_types t
 where t.id = v.product_type_id and t.code = 'hoodie' and v.code = 'front';

-- repair: an earlier dashboard version saved placement codes with "-" (left-chest, sleeve-left)
update public.product_print_areas a set code = replace(a.code, '-', '_')
 where a.code in ('left-chest', 'sleeve-left')
   and not exists (select 1 from public.product_print_areas b where b.view_id = a.view_id and b.code = replace(a.code, '-', '_'));

-- print areas measured on these photos (fractions of the photo, max size in cm)
update public.product_print_areas a
   set x = p.x, y = p.y, width = p.w, height = p.h, max_width_cm = p.cw, max_height_cm = p.ch
  from public.product_type_views v
  join public.product_types t on t.id = v.product_type_id,
       (values ('front',       0.31000, 0.30000, 0.38000, 0.23000, 28.0, 19.0),
               ('left_chest',  0.55500, 0.31500, 0.12000, 0.10900, 9.0, 9.0),
               ('sleeve',      0.09500, 0.43000, 0.10000, 0.09100, 8.0, 8.0),
               ('sleeve_left', 0.80500, 0.43000, 0.10000, 0.09100, 8.0, 8.0)) as p(code, x, y, w, h, cw, ch)
 where a.view_id = v.id and t.code = 'hoodie' and v.code = 'front' and a.code = p.code;
