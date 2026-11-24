-- =====================================================================
-- TPAC: 16 couple hoodie sets for the page /couples («للمرتبطين»).
-- Each product is one set of two hoodies (one photo with both), priced per
-- set, sizes S–XXL, 100 in stock per size. Change prices, stock and texts
-- from Dashboard → Products afterwards.
-- Needs add-couples-page.sql first (and sizes S–XXL, category «هوديات») (the collection «للمرتبطين»).
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- Photos ship with the website: /products/couples/<slug>.webp
-- =====================================================================

-- colours: lavender, and the two-colour sets (shown as e.g. «أسود + أبيض»)
insert into public.colors (code, name_ar, name_en, hex, sort_order) values
  ('lavender', 'ليلكي', 'Lavender', '#C9C7E4', 20),
  ('black-white', 'أسود + أبيض', 'Black + White', '#111111', 21),
  ('black-bone', 'أسود + عظمي', 'Black + Bone', '#111111', 22),
  ('sand-forest', 'رملي + زيتي', 'Sand + Forest green', '#C8B48F', 23),
  ('black-sage', 'أسود + فستقي', 'Black + Sage green', '#111111', 24),
  ('royal-white', 'أزرق ملكي + أبيض', 'Royal blue + White', '#1E3EA6', 25),
  ('black-red', 'أسود + أحمر', 'Black + Red', '#111111', 26)
on conflict (code) do nothing;

insert into public.products (slug, name_ar, name_en, description_ar, description_en, material_ar, material_en, printing_ar, printing_en,
  category_id, base_price, is_published, is_new_arrival, tags, published_at)
select v.slug, v.name_ar, v.name_en, v.description_ar, v.description_en,
  'فليس قطن وبوليستر ثقيل، قبعة مبطّنة، جيب كنغر وأساور مضلّعة.',
  'Heavyweight cotton-poly fleece, lined hood, kangaroo pocket and ribbed cuffs.',
  'طباعة DTF أو تطريز حسب التصميم.',
  'DTF print or embroidery, depending on the design.',
  (select id from public.categories where slug = 'hoodies'), 90000, true, true, '{couples,hoodie,هودي,للمرتبطين}', now()
from (values
  ('old-cinema-couple-hoodies', 'طقم زمن الطيبين', 'Golden Era Couple Set', 'هوديين ليلكي، على كل واحد صورة من زمن الطيبين مع قلوب حمراء — واحد إله وواحد إلها.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'Two lavender hoodies, each with a golden-era film still and red hearts — one for him, one for her.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('coordinates-couple-hoodies', 'طقم الإحداثيات', 'Coordinates Couple Set', 'هودي أسود وهودي عظمي، عليهم إحداثيات المكان اللي تعرّفتوا بيه، وعلى الكم أول حرف من اسمه مع ∞ و♥. نكتب الإحداثيات والحروف مثل ما تريدون — اكتبوها بملاحظات الطلب.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A black and a bone hoodie with the coordinates of the place you met, and an initial with ∞ and ♥ on the sleeve. We print your own coordinates and initials — write them in the order notes.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('anatomy-heart-names-couple-hoodies', 'طقم القلب بالاسم والتاريخ', 'Heart, Name & Date Couple Set', 'هوديين رملي بقلب حقيقي مرسوم بالخط، وتحته تاريخكم واسم كل واحد، وعلى الكم الحرفين وبينهم قلب. نكتب الأسماء والتاريخ والحروف مثل ما تريدون — اكتبوها بملاحظات الطلب.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'Two sand hoodies with a line-drawn anatomical heart, your date and each name beneath it, and both initials with a heart on the sleeve. We print your own names, date and initials — write them in the order notes.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('bears-forever-couple-hoodies', 'طقم الدبدوبين', 'Forever Bears Couple Set', 'هوديين رملي بدبدوبين: «الى متى يالوز ؟» — «الى الابد يا سكر ♡».

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'Two sand hoodies with two bears: “Until when, my almond?” — “Forever, sugar ♡”.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('pinky-love-couple-hoodies', 'طقم وعد الخنصر', 'Pinky Love Couple Set', 'هودي أبيض وهودي أسود، عليهم رسمة إيدين ماسكين بعض بالخنصر وكلمة love، وعلى الكم أول حرف من اسم الشريك. نكتب الحروف مثل ما تريدون — اكتبوها بملاحظات الطلب.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A white and a black hoodie with two hands linked by the little finger and “love”, and your partner''s initial on the sleeve. We print your own initials — write them in the order notes.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('puzzle-heart-couple-hoodies', 'طقم تكمّلني', 'You Complete Me Couple Set', 'هودي رملي عليه قلب ناقصه قطعة، وهودي زيتي عليه القطعة اللي تكمّله — وعلى الكم «u complete me ♥».

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A sand hoodie with a heart missing one piece and a forest-green hoodie with the piece that completes it — “u complete me ♥” on the sleeve.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('full-of-you-couple-hoodies', 'طقم مليان بيك', 'Full of You Couple Set', 'هوديين أسود بقلب حقيقي أبيض: «I''m Full of you» و«You are always in my heart».

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'Two black hoodies with a white anatomical heart: “I''m Full of you” and “You are always in my heart”.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('fik-minni-couple-hoodies', 'طقم فيك مني .. فيني منك', 'Part of Me Couple Set', 'هودي أبيض مكتوب عليه «فيك مني ..» وهودي أسود «فيني منك ..» — عبارتين تكمّلن بعض.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A white hoodie reading “فيك مني ..” (there''s some of me in you) and a black one reading “فيني منك ..” (there''s some of you in me).

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('bunnies-couple-hoodies', 'طقم الأرانب', 'Bunnies Couple Set', 'هودي أسود عليه الأرنب، وهودي فستقي عليه الأرنبة.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A black hoodie with the bunny and a sage-green one with his bunny girl.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('always-with-you-couple-hoodies', 'طقم دائماً وياك', 'Always With You Couple Set', 'هودي أزرق ملكي وهودي أبيض بقلب حقيقي مرسوم بالخط، وعلى الكم «I AM ALWAYS WITH YOU».

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A royal-blue and a white hoodie with a line-drawn anatomical heart and “I AM ALWAYS WITH YOU” on the sleeve.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('little-chicks-couple-hoodies', 'طقم الصوص', 'Little Chicks Couple Set', 'هوديين أسود، على واحد صوص صغير وعلى الثاني صوص طالع من البيضة.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'Two black hoodies, one with a little chick and one with a chick hatching from its egg.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('ocean-heart-couple-hoodies', 'طقم قلب البحر', 'Ocean Heart Couple Set', 'هوديين أبيض بقلب نصّه بحر، وتحته «You are my soul and my all my life».

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'Two white hoodies with a heart half-filled with the sea and “You are my soul and my all my life”.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('initial-heart-couple-hoodies', 'طقم القلب بالحرف', 'Initial Heart Couple Set', 'هودي أسود وهودي أحمر، على كل واحد قلب حقيقي بداخله أول حرف من اسم الشريك. نكتب الحروف مثل ما تريدون — اكتبوها بملاحظات الطلب.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A black and a red hoodie, each with an anatomical heart holding your partner''s initial. We print your own initials — write them in the order notes.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('stitch-hug-couple-hoodies', 'طقم الحضن', 'The Hug Couple Set', 'هوديين رمادي بحضن الكائنين الأزرق والوردي، وتحته «I''m with you even if this whole world abandons you, I promise to love you forever»، وعلى الكم تاريخكم. نكتب التاريخ مثل ما تريدون — اكتبوها بملاحظات الطلب.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'Two grey hoodies with the blue and pink hug, “I''m with you even if this whole world abandons you, I promise to love you forever”, and your date on the sleeve. We print your own date — write them in the order notes.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('pinky-promise-date-couple-hoodies', 'طقم الوعد بالتاريخ', 'Pinky Promise Date Couple Set', 'هودي أسود وهودي أبيض، عليهم إيدين بوعد الخنصر وفوقهم تاريخكم وقلب. نكتب التاريخ مثل ما تريدون — اكتبوها بملاحظات الطلب.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A black and a white hoodie with a pinky promise, your date and a heart. We print your own date — write them in the order notes.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.'),
  ('stitch-angel-couple-hoodies', 'طقم الأزرق والوردي', 'Blue & Pink Couple Set', 'هودي أبيض عليه الكائن الوردي وهودي أسود عليه الكائن الأزرق — يباوعون على بعض.

السعر للطقم كامل (هوديين). المقاس اللي تختارونه للهودي الأول — اكتبوا مقاس الهودي الثاني بملاحظات الطلب.', 'A white hoodie with the pink one and a black hoodie with the blue one — looking at each other.

The price is for the full set (two hoodies). The size you pick is for the first hoodie — write the second hoodie''s size in the order notes.')
) as v(slug, name_ar, name_en, description_ar, description_en)
-- only on a shop that already has its catalogue (on a brand-new database the seed comes later)
where exists (select 1 from public.categories where slug = 'hoodies')
  and exists (select 1 from public.sizes where code = 'XXL')
on conflict (slug) do nothing;

-- the photo (both hoodies in one picture)
insert into public.product_images (product_id, url, alt_ar, alt_en, color_id, sort_order)
select p.id, '/products/couples/' || p.slug || '.webp', p.name_ar || ' — هوديين', p.name_en || ' — two hoodies', c.id, 0
  from (values
  ('old-cinema-couple-hoodies', 'lavender'),
  ('coordinates-couple-hoodies', 'black-bone'),
  ('anatomy-heart-names-couple-hoodies', 'sand'),
  ('bears-forever-couple-hoodies', 'sand'),
  ('pinky-love-couple-hoodies', 'black-white'),
  ('puzzle-heart-couple-hoodies', 'sand-forest'),
  ('full-of-you-couple-hoodies', 'black'),
  ('fik-minni-couple-hoodies', 'black-white'),
  ('bunnies-couple-hoodies', 'black-sage'),
  ('always-with-you-couple-hoodies', 'royal-white'),
  ('little-chicks-couple-hoodies', 'black'),
  ('ocean-heart-couple-hoodies', 'white'),
  ('initial-heart-couple-hoodies', 'black-red'),
  ('stitch-hug-couple-hoodies', 'heather'),
  ('pinky-promise-date-couple-hoodies', 'black-white'),
  ('stitch-angel-couple-hoodies', 'black-white')
  ) as v(slug, color)
  join public.products p on p.slug = v.slug
  join public.colors c on c.code = v.color
 where not exists (select 1 from public.product_images i where i.product_id = p.id);

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

-- sizes S–XXL in the set's colour
insert into public.product_variants (product_id, sku, size_code, color_id)
select p.id, 'TP-CPL-' || lpad(v.n::text, 2, '0') || '-' || s.code, s.code, c.id
  from (values
  ('old-cinema-couple-hoodies', 'lavender', 1),
  ('coordinates-couple-hoodies', 'black-bone', 2),
  ('anatomy-heart-names-couple-hoodies', 'sand', 3),
  ('bears-forever-couple-hoodies', 'sand', 4),
  ('pinky-love-couple-hoodies', 'black-white', 5),
  ('puzzle-heart-couple-hoodies', 'sand-forest', 6),
  ('full-of-you-couple-hoodies', 'black', 7),
  ('fik-minni-couple-hoodies', 'black-white', 8),
  ('bunnies-couple-hoodies', 'black-sage', 9),
  ('always-with-you-couple-hoodies', 'royal-white', 10),
  ('little-chicks-couple-hoodies', 'black', 11),
  ('ocean-heart-couple-hoodies', 'white', 12),
  ('initial-heart-couple-hoodies', 'black-red', 13),
  ('stitch-hug-couple-hoodies', 'heather', 14),
  ('pinky-promise-date-couple-hoodies', 'black-white', 15),
  ('stitch-angel-couple-hoodies', 'black-white', 16)
  ) as v(slug, color, n)
  join public.products p on p.slug = v.slug
  join public.colors c on c.code = v.color
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

-- the cover of the couples page, if it has none yet
update public.collections set image_url = '/products/couples/coordinates-couple-hoodies.webp'
 where slug = 'couples' and image_url is null;
