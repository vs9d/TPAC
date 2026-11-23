-- =====================================================================
-- TPAC: previous clients from TPAC's own logo sheet (logos in /clients/…).
-- Two logos whose names could not be read for sure are added HIDDEN —
-- name them in Dashboard → Portfolio, then show them.
-- Needs add-business-features.sql first. Safe to run more than once.
-- =====================================================================
insert into public.portfolio_clients (name_ar, name_en, category, logo_url, sort_order, is_active)
select v.name_ar, v.name_en, v.category, v.logo_url, v.sort_order, v.is_active
  from (values
    ('خاشعة', 'Khashea', 'company', '/clients/khashea.png', 1, true),
    ('يونايتد سكشنز', 'United Sections', 'company', '/clients/united-sections.png', 2, true),
    ('IFMSA-Iraq', 'IFMSA-Iraq', 'organization', '/clients/ifmsa-iraq.png', 3, true),
    ('ملت', 'MLT', 'company', '/clients/mlt.png', 4, true),
    ('زيت وزعتر', 'Zait & Zaatar', 'company', '/clients/zait-zaatar.png', 5, true),
    ('البستان', 'Al Bustan', 'company', '/clients/bustan.png', 6, true),
    ('موجي — مقهى ياباني', 'Moji — Japanese café', 'company', '/clients/moji.png', 7, true),
    ('Paket', 'Paket', 'company', '/clients/paket.png', 8, true),
    ('شعار (اكتب الاسم)', null, 'company', '/clients/qaf.png', 9, false),
    ('afea (تأكد من الاسم)', null, 'company', '/clients/oafea.png', 10, false)
  ) as v(name_ar, name_en, category, logo_url, sort_order, is_active)
 where not exists (select 1 from public.portfolio_clients c where c.logo_url = v.logo_url);
