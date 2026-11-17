-- =====================================================================
-- TPAC: "Custom Print Hoodie" (print on demand, black & white,
-- front / back / right sleeve / left sleeve).
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================

-- 1) Left-sleeve placement + white hoodies in the designer
alter table public.print_locations drop constraint if exists print_locations_code_check;
alter table public.print_locations add constraint print_locations_code_check
  check (code in ('front', 'back', 'left_chest', 'sleeve', 'sleeve_left'));
insert into public.print_locations (code, name_ar, name_en, price, sort_order)
values ('sleeve_left', 'الكم الأيسر', 'Left sleeve', 3000, 4)
on conflict (code) do nothing;
update public.print_locations set name_ar = 'الكم الأيمن', name_en = 'Right sleeve' where code = 'sleeve';

insert into public.colors (code, name_ar, name_en, hex, sort_order) values
  ('black', 'أسود', 'Black', '#111111', 0), ('white', 'أبيض', 'White', '#F7F7F5', 1)
on conflict (code) do nothing;
insert into public.sizes (code, label, sort_order) values ('S','S',1),('M','M',2),('L','L',3),('XL','XL',4),('XXL','XXL',5)
on conflict (code) do nothing;

insert into public.custom_garment_types (code, name_ar, name_en, base_price, color_ids, sizes, print_locations, sort_order)
values ('hoodie', 'هودي', 'Hoodie', 40000, array(select id from public.colors where code in ('black','white')), '{S,M,L,XL,XXL}', '{front,back,sleeve,sleeve_left}', 2)
on conflict (code) do update set
  color_ids = array(select distinct unnest(public.custom_garment_types.color_ids || excluded.color_ids)),
  print_locations = array(select distinct unnest(public.custom_garment_types.print_locations || '{front,back,sleeve,sleeve_left}'::text[])),
  is_active = true;

-- 2) The product
insert into public.categories (slug, name_ar, name_en, sort_order)
values ('custom-printed', 'طباعة حسب الطلب', 'Custom printed', 6)
on conflict (slug) do nothing;

insert into public.products (slug, name_ar, name_en, description_ar, description_en, material_ar, material_en, printing_ar, printing_en,
  category_id, base_price, is_published, is_new_arrival, is_customizable, tags, published_at)
values ('custom-print-hoodie',
  'هودي طباعة حسب الطلب', 'Custom Print Hoodie',
  'هودي سادة جاهز لتصميمك. اطبع على الأمام والخلف والكمين — شعار، اسم، صورة أو عبارة. صمّمه بنفسك وشوف النتيجة قبل الطلب.',
  'A blank hoodie ready for your design. Print on the front, back and both sleeves — a logo, a name, a photo or a phrase. Design it yourself and preview it before you order.',
  'فليس قطن وبوليستر ثقيل، قبعة مبطّنة، جيب كنغر وأساور مضلّعة.',
  'Heavyweight cotton-poly fleece, lined hood, kangaroo pocket and ribbed cuffs.',
  'طباعة DTF عالية الدقة. السعر = سعر الهودي + سعر كل مكان طباعة تختاره.',
  'High-definition DTF printing. Price = hoodie + each print placement you choose.',
  (select id from public.categories where slug = 'custom-printed'),
  40000, true, true, true, '{custom,hoodie,طباعة,هودي}', now())
on conflict (slug) do update set is_published = true, is_customizable = true;

delete from public.product_images where product_id = (select id from public.products where slug = 'custom-print-hoodie');
insert into public.product_images (product_id, url, alt_ar, alt_en, color_id, sort_order) values
  ((select id from public.products where slug = 'custom-print-hoodie'), '/products/custom-hoodie-black-front.webp', 'هودي أسود للطباعة', 'Black custom hoodie', (select id from public.colors where code = 'black'), 0),
  ((select id from public.products where slug = 'custom-print-hoodie'), '/products/custom-hoodie-white-front.webp', 'هودي أبيض للطباعة', 'White custom hoodie', (select id from public.colors where code = 'white'), 1);

-- Variants exist for colour/size display; stock stays 0 because each piece is made to order through the designer.
insert into public.product_variants (product_id, sku, size_code, color_id)
select p.id, 'TP-CPH-' || upper(left(c.code, 3)) || '-' || s.code, s.code, c.id
  from public.products p, public.colors c, (values ('S'),('M'),('L'),('XL'),('XXL')) s(code)
 where p.slug = 'custom-print-hoodie' and c.code in ('black', 'white')
on conflict (product_id, size_code, color_id) do nothing;
insert into public.inventory (variant_id, quantity)
select v.id, 0 from public.product_variants v join public.products p on p.id = v.product_id
 where p.slug = 'custom-print-hoodie'
on conflict (variant_id) do nothing;
delete from public.notifications where event = 'inventory.low_stock' and body like 'TP-CPH-%';
