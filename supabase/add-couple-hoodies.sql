-- =====================================================================
-- TPAC: 16 couple hoodie sets for the page /couples («للمرتبطين»).
-- Every design is small on the left chest; the hoodies come in black and
-- white only: each set is offered as black + white, both black or both
-- white (a photo of both hoodies for each), 90,000 IQD per set, S–XXL,
-- 100 in stock per size. Change prices, stock and texts from Dashboard →
-- Products afterwards.
-- Also updates the sets from the first version of this script (old
-- colours, photos and descriptions are replaced).
-- Needs add-couples-page.sql first (and sizes S–XXL, category «هوديات»).
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- Photos ship with the website: /products/couples/<slug>-<colour>.webp
-- =====================================================================

insert into public.colors (code, name_ar, name_en, hex, sort_order)
values ('black-white', 'أسود + أبيض', 'Black + White', '#111111', 20)
on conflict (code) do nothing;

insert into public.products (slug, name_ar, name_en, description_ar, description_en, material_ar, material_en, printing_ar, printing_en,
  category_id, base_price, is_published, is_new_arrival, tags, published_at)
select v.slug, v.name_ar, v.name_en, v.description_ar, v.description_en,
  'فليس قطن وبوليستر ثقيل، قبعة مبطّنة، جيب كنغر وأساور مضلّعة.',
  'Heavyweight cotton-poly fleece, lined hood, kangaroo pocket and ribbed cuffs.',
  'طباعة DTF أو تطريز صغير على الصدر حسب التصميم.',
  'A small DTF print or embroidery on the chest, depending on the design.',
  (select id from public.categories where slug = 'hoodies'), 50000, true, true, '{couples,hoodie,هودي,للمرتبطين}', now()
from (values
  ('old-cinema-couple-hoodies', 'طقم زمن الطيبين', 'Golden Era Couple Set', 'على صدر كل هودي صورة صغيرة من زمن الطيبين مع قلوب حمراء — واحد إله وواحد إلها.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'A small golden-era film still with red hearts on the chest of each hoodie — one for him, one for her.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('coordinates-couple-hoodies', 'طقم الإحداثيات', 'Coordinates Couple Set', 'على الصدر إحداثيات المكان اللي تعرّفتوا بيه، وعلى الكم أول حرف مع ∞ و♥. نكتب الإحداثيات والحروف مثل ما تريدون — اكتبوها بالخانات بصفحة المنتج.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'The coordinates of the place you met on the chest, and an initial with ∞ and ♥ on the sleeve. We print your own coordinates and initials — fill them in on the product page.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('anatomy-heart-names-couple-hoodies', 'طقم القلب بالاسم والتاريخ', 'Heart, Name & Date Couple Set', 'على الصدر قلب حقيقي مرسوم بالخط، تحته تاريخكم واسم كل واحد، وعلى الكم الحرفين وبينهم قلب. نكتب الأسماء والتاريخ والحروف مثل ما تريدون — اكتبوها بالخانات بصفحة المنتج.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'A line-drawn anatomical heart on the chest with your date and each name beneath it, and both initials with a heart on the sleeve. We print your own names, date and initials — fill them in on the product page.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('bears-forever-couple-hoodies', 'طقم الدبدوبين', 'Forever Bears Couple Set', 'دبدوبين على الصدر: «الى متى يالوز ؟» — «الى الابد يا سكر ♡».

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'Two bears on the chest: “Until when, my almond?” — “Forever, sugar ♡”.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('pinky-love-couple-hoodies', 'طقم وعد الخنصر', 'Pinky Love Couple Set', 'على الصدر إيدين ماسكين بعض بالخنصر وكلمة love، وعلى الكم أول حرف من اسم الشريك. نكتب الحروف مثل ما تريدون — اكتبوها بالخانات بصفحة المنتج.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'Two hands linked by the little finger and “love” on the chest, and your partner''s initial on the sleeve. We print your own initials — fill them in on the product page.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('puzzle-heart-couple-hoodies', 'طقم تكمّلني', 'You Complete Me Couple Set', 'على هودي قلب ناقصه قطعة، وعلى الثاني القطعة اللي تكمّله — وعلى الكم «u complete me ♥».

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'One hoodie has a heart missing a piece, the other has the piece that completes it — “u complete me ♥” on the sleeve.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('full-of-you-couple-hoodies', 'طقم مليان بيك', 'Full of You Couple Set', 'قلب حقيقي على الصدر: «I''m Full of you» و«You are always in my heart».

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'An anatomical heart on the chest: “I''m Full of you” and “You are always in my heart”.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('fik-minni-couple-hoodies', 'طقم فيك مني .. فيني منك', 'Part of Me Couple Set', 'على هودي «فيك مني ..» وعلى الثاني «فيني منك ..» — عبارتين تكمّلن بعض.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'One reads “فيك مني ..” (there''s some of me in you), the other “فيني منك ..” (there''s some of you in me).

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('bunnies-couple-hoodies', 'طقم الأرانب', 'Bunnies Couple Set', 'على هودي الأرنب وعلى الثاني الأرنبة.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'The bunny on one hoodie and his bunny girl on the other.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('always-with-you-couple-hoodies', 'طقم دائماً وياك', 'Always With You Couple Set', 'قلب حقيقي مرسوم بالخط على الصدر، وعلى الكم «I AM ALWAYS WITH YOU».

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'A line-drawn anatomical heart on the chest and “I AM ALWAYS WITH YOU” on the sleeve.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('little-chicks-couple-hoodies', 'طقم الصوص', 'Little Chicks Couple Set', 'على هودي صوص صغير وعلى الثاني صوص طالع من البيضة.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'A little chick on one hoodie and a chick hatching from its egg on the other.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('ocean-heart-couple-hoodies', 'طقم قلب البحر', 'Ocean Heart Couple Set', 'قلب نصّه بحر على الصدر، وتحته «You are my soul and my all my life».

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'A heart half-filled with the sea on the chest and “You are my soul and my all my life”.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('initial-heart-couple-hoodies', 'طقم القلب بالحرف', 'Initial Heart Couple Set', 'على صدر كل هودي قلب حقيقي بداخله أول حرف من اسم الشريك. نكتب الحروف مثل ما تريدون — اكتبوها بالخانات بصفحة المنتج.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'An anatomical heart holding your partner''s initial on the chest of each hoodie. We print your own initials — fill them in on the product page.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('stitch-hug-couple-hoodies', 'طقم الحضن', 'The Hug Couple Set', 'حضن الكائنين الأزرق والوردي على الصدر، وتحته «I''m with you even if this whole world abandons you, I promise to love you forever»، وعلى الكم تاريخكم. نكتب التاريخ مثل ما تريدون — اكتبوها بالخانات بصفحة المنتج.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'The blue and pink hug on the chest, “I''m with you even if this whole world abandons you, I promise to love you forever”, and your date on the sleeve. We print your own date — fill them in on the product page.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('pinky-promise-date-couple-hoodies', 'طقم الوعد بالتاريخ', 'Pinky Promise Date Couple Set', 'على الصدر إيدين بوعد الخنصر وفوقهم تاريخكم وقلب. نكتب التاريخ مثل ما تريدون — اكتبوها بالخانات بصفحة المنتج.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'A pinky promise with your date and a heart on the chest. We print your own date — fill them in on the product page.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.'),
  ('stitch-angel-couple-hoodies', 'طقم الأزرق والوردي', 'Blue & Pink Couple Set', 'على هودي الكائن الوردي وعلى الثاني الكائن الأزرق — يباوعون على بعض.

الألوان: أسود + أبيض، الاثنين أسود، أو الاثنين أبيض.
السعر للطقم كامل (هوديين). تختارون قياس كل هودي بصفحة المنتج.', 'The pink one on one hoodie and the blue one on the other — looking at each other.

Colours: black + white, both black, or both white.
The price is for the full set (two hoodies). Pick each hoodie''s size on the product page.')
) as v(slug, name_ar, name_en, description_ar, description_en)
-- only on a shop that already has its catalogue (on a brand-new database the seed comes later)
where exists (select 1 from public.categories where slug = 'hoodies')
  and exists (select 1 from public.sizes where code = 'XXL')
on conflict (slug) do update set base_price = excluded.base_price, description_ar = excluded.description_ar, description_en = excluded.description_en,
  printing_ar = excluded.printing_ar, printing_en = excluded.printing_en;

-- photos: one per colour version, black + white first
delete from public.product_images i using public.products p
 where p.id = i.product_id and p.slug in ('old-cinema-couple-hoodies', 'coordinates-couple-hoodies', 'anatomy-heart-names-couple-hoodies', 'bears-forever-couple-hoodies', 'pinky-love-couple-hoodies', 'puzzle-heart-couple-hoodies', 'full-of-you-couple-hoodies', 'fik-minni-couple-hoodies', 'bunnies-couple-hoodies', 'always-with-you-couple-hoodies', 'little-chicks-couple-hoodies', 'ocean-heart-couple-hoodies', 'initial-heart-couple-hoodies', 'stitch-hug-couple-hoodies', 'pinky-promise-date-couple-hoodies', 'stitch-angel-couple-hoodies')
   and i.url not like '/products/couples/' || p.slug || '-%';
insert into public.product_images (product_id, url, alt_ar, alt_en, color_id, sort_order)
select p.id, '/products/couples/' || p.slug || '-' || c.code || '.webp', p.name_ar || ' — ' || v.ar, p.name_en || ' — ' || v.en, c.id, v.n
  from public.products p
 cross join (values ('black-white', 'أسود + أبيض', 'Black + White', 0), ('black', 'أسود', 'Black', 1), ('white', 'أبيض', 'White', 2)) as v(code, ar, en, n)
  join public.colors c on c.code = v.code
 where p.slug in ('old-cinema-couple-hoodies', 'coordinates-couple-hoodies', 'anatomy-heart-names-couple-hoodies', 'bears-forever-couple-hoodies', 'pinky-love-couple-hoodies', 'puzzle-heart-couple-hoodies', 'full-of-you-couple-hoodies', 'fik-minni-couple-hoodies', 'bunnies-couple-hoodies', 'always-with-you-couple-hoodies', 'little-chicks-couple-hoodies', 'ocean-heart-couple-hoodies', 'initial-heart-couple-hoodies', 'stitch-hug-couple-hoodies', 'pinky-promise-date-couple-hoodies', 'stitch-angel-couple-hoodies')
   and not exists (select 1 from public.product_images i where i.product_id = p.id and i.color_id = c.id);

-- in the collection «للمرتبطين»
insert into public.product_collections (product_id, collection_id, sort_order)
select p.id, (select id from public.collections where slug = 'couples'), v.n
  from (values
  ('old-cinema-couple-hoodies', 0),
  ('coordinates-couple-hoodies', 1),
  ('anatomy-heart-names-couple-hoodies', 2),
  ('bears-forever-couple-hoodies', 3),
  ('pinky-love-couple-hoodies', 4),
  ('puzzle-heart-couple-hoodies', 5),
  ('full-of-you-couple-hoodies', 6),
  ('fik-minni-couple-hoodies', 7),
  ('bunnies-couple-hoodies', 8),
  ('always-with-you-couple-hoodies', 9),
  ('little-chicks-couple-hoodies', 10),
  ('ocean-heart-couple-hoodies', 11),
  ('initial-heart-couple-hoodies', 12),
  ('stitch-hug-couple-hoodies', 13),
  ('pinky-promise-date-couple-hoodies', 14),
  ('stitch-angel-couple-hoodies', 15)
  ) as v(slug, n)
  join public.products p on p.slug = v.slug
 where exists (select 1 from public.collections where slug = 'couples')
on conflict (product_id, collection_id) do nothing;

-- sizes S–XXL in black + white, black and white (other colours of the first version go)
delete from public.product_variants pv using public.products p
 where p.id = pv.product_id and p.slug in ('old-cinema-couple-hoodies', 'coordinates-couple-hoodies', 'anatomy-heart-names-couple-hoodies', 'bears-forever-couple-hoodies', 'pinky-love-couple-hoodies', 'puzzle-heart-couple-hoodies', 'full-of-you-couple-hoodies', 'fik-minni-couple-hoodies', 'bunnies-couple-hoodies', 'always-with-you-couple-hoodies', 'little-chicks-couple-hoodies', 'ocean-heart-couple-hoodies', 'initial-heart-couple-hoodies', 'stitch-hug-couple-hoodies', 'pinky-promise-date-couple-hoodies', 'stitch-angel-couple-hoodies')
   and pv.color_id not in (select id from public.colors where code in ('black-white', 'black', 'white'));
insert into public.product_variants (product_id, sku, size_code, color_id)
select p.id, 'TP-CPL-' || lpad(v.n::text, 2, '0') || '-' || c.tag || '-' || s.code, s.code, col.id
  from (values
  ('old-cinema-couple-hoodies', 1),
  ('coordinates-couple-hoodies', 2),
  ('anatomy-heart-names-couple-hoodies', 3),
  ('bears-forever-couple-hoodies', 4),
  ('pinky-love-couple-hoodies', 5),
  ('puzzle-heart-couple-hoodies', 6),
  ('full-of-you-couple-hoodies', 7),
  ('fik-minni-couple-hoodies', 8),
  ('bunnies-couple-hoodies', 9),
  ('always-with-you-couple-hoodies', 10),
  ('little-chicks-couple-hoodies', 11),
  ('ocean-heart-couple-hoodies', 12),
  ('initial-heart-couple-hoodies', 13),
  ('stitch-hug-couple-hoodies', 14),
  ('pinky-promise-date-couple-hoodies', 15),
  ('stitch-angel-couple-hoodies', 16)
  ) as v(slug, n)
  join public.products p on p.slug = v.slug
 cross join (values ('black-white', 'BW'), ('black', 'BLK'), ('white', 'WHT')) as c(code, tag)
  join public.colors col on col.code = c.code
 cross join (values ('S'),('M'),('L'),('XL'),('XXL')) s(code)
on conflict (product_id, size_code, color_id) do nothing;

insert into public.inventory (variant_id, quantity, low_stock_threshold)
select v.id, 100, 5 from public.product_variants v where v.sku like 'TP-CPL-%'
on conflict (variant_id) do nothing;
insert into public.inventory_transactions (variant_id, change, quantity_after, reason, note)
select i.variant_id, i.quantity, i.quantity, 'initial', 'Couple sets'
  from public.inventory i join public.product_variants v on v.id = i.variant_id
 where v.sku like 'TP-CPL-%'
   and not exists (select 1 from public.inventory_transactions t where t.variant_id = i.variant_id);

-- colours only the first version used
delete from public.colors c
 where c.code in ('lavender', 'black-bone', 'sand-forest', 'black-sage', 'royal-white', 'black-red')
   and not exists (select 1 from public.product_variants v where v.color_id = c.id)
   and not exists (select 1 from public.custom_designs d where d.color_id = c.id);

-- the cover of the couples page, if it has none yet (or still the first version's)
update public.collections set image_url = '/products/couples/coordinates-couple-hoodies-black-white.webp'
 where slug = 'couples' and (image_url is null or image_url = '/products/couples/coordinates-couple-hoodies.webp');
