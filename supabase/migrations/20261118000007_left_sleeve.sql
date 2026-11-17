-- Adds a second sleeve placement: "sleeve" is the wearer's right sleeve,
-- "sleeve_left" the wearer's left sleeve. White becomes available for hoodies.
alter table public.print_locations drop constraint if exists print_locations_code_check;
alter table public.print_locations add constraint print_locations_code_check
  check (code in ('front', 'back', 'left_chest', 'sleeve', 'sleeve_left'));

insert into public.print_locations (code, name_ar, name_en, price, sort_order)
values ('sleeve_left', 'الكم الأيسر', 'Left sleeve', 3000, 4)
on conflict (code) do nothing;
update public.print_locations set name_ar = 'الكم الأيمن', name_en = 'Right sleeve' where code = 'sleeve';

update public.custom_garment_types
   set print_locations = array(select distinct unnest(print_locations || '{sleeve_left}'::text[]))
 where 'sleeve' = any(print_locations) and not ('sleeve_left' = any(print_locations));

update public.custom_garment_types
   set color_ids = array(select distinct unnest(color_ids || array(select id from public.colors where code = 'white')))
 where code = 'hoodie';
