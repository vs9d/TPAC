-- =====================================================================
-- TPAC: "For couples" page (/couples).
-- It shows the products of the collection "للمرتبطين" (slug: couples).
-- To put a hoodie on the page: Dashboard → Products → (add or edit) →
-- Collections → tick «للمرتبطين». The page's text and cover photo are
-- edited in Dashboard → Categories & collections.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================
insert into public.collections (slug, name_ar, name_en, description_ar, description_en, is_active, is_featured, sort_order)
values ('couples', 'للمرتبطين', 'For couples',
        'هوديات بالأزواج لك ولشريكك — تصاميم تكمّل بعض، ونقدر نطبع أسماءكم وتاريخكم.',
        'Matching hoodies for you and your other half — designs that complete each other, with your names and date if you like.',
        true, false, 0)
on conflict (slug) do nothing;
