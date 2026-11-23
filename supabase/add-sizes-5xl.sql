-- =====================================================================
-- TPAC: sizes S → 5XL for hoodies, sweatshirts and t-shirts.
-- Adds 4XL and 5XL, makes S…5XL the default sizes of new products of these types
-- and the sizes customers can order in the print studio.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================

insert into public.sizes (code, label, sort_order) values
  ('4XL', '4XL', 7),
  ('5XL', '5XL', 8)
on conflict (code) do nothing;

update public.product_types
   set default_sizes = '{S,M,L,XL,XXL,3XL,4XL,5XL}'
 where code in ('hoodie', 'sweatshirt', 'tshirt', 'oversized', 'longsleeve');

update public.custom_garment_types
   set sizes = '{S,M,L,XL,XXL,3XL,4XL,5XL}'
 where code in ('hoodie', 'sweatshirt', 'tshirt', 'oversized', 'longsleeve');
