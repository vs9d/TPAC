-- =====================================================================
-- TPAC: new print placement "inside the hood" (داخل القبعة) for hoodies.
-- Customers can print a word or a drawing on the inner back of the hood.
-- The close-up photos (/mockups/hoodie-<colour>-hood.webp) are cut from the
-- front photos for now — replace them any time from
-- Dashboard → Print designer → Printing images → "Inside the hood".
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================
alter table public.print_locations drop constraint if exists print_locations_code_check;
alter table public.print_locations add constraint print_locations_code_check
  check (code in ('front', 'back', 'left_chest', 'sleeve', 'sleeve_left', 'hood'));

insert into public.print_locations (code, name_ar, name_en, price, sort_order)
values ('hood', 'داخل القبعة', 'Inside the hood', 3000, 5)
on conflict (code) do nothing;

-- offered for hoodies (the print studio and the dashboard's placement checkboxes)
update public.custom_garment_types
   set print_locations = array(select distinct unnest(print_locations || '{hood}'::text[]))
 where code = 'hoodie' and not ('hood' = any(print_locations));

-- its own close-up photo + print area on the hoodie template (when the printing tables exist)
do $$
begin
  if to_regclass('public.product_type_views') is null then return; end if;
  insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
  select t.id, 'hood', 'داخل القبعة', 'Inside the hood', 750, 720, 4 from public.product_types t where t.code = 'hoodie'
  on conflict (product_type_id, code) do nothing;

  update public.product_type_views v
     set mockup_url = '/mockups/hoodie-black-hood.webp', mockup_path = null, mockup_width = 750, mockup_height = 720,
         color_mockups = coalesce(v.color_mockups, '{}'::jsonb) || (
           select coalesce(jsonb_object_agg(c.id::text, jsonb_build_object('url', '/mockups/hoodie-' || c.code || '-hood.webp')), '{}'::jsonb)
             from public.colors c where c.code in ('black', 'white', 'brown', 'navy', 'maroon'))
    from public.product_types t
   where t.id = v.product_type_id and t.code = 'hoodie' and v.code = 'hood'
     and (v.mockup_url is null or v.mockup_url like '/mockups/%');

  insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
  select v.id, 'hood', 'داخل القبعة', 'Inside the hood', 0.25, 0.20, 0.50, 0.23, 20, 9, 5
    from public.product_type_views v join public.product_types t on t.id = v.product_type_id
   where t.code = 'hoodie' and v.code = 'hood'
  on conflict (view_id, code) do nothing;
end $$;
