-- =====================================================================
-- TPAC: couple hoodie sets cost 50,000 IQD per set (was 90,000).
-- Changes only the sets still at the old price (tagged "couples"),
-- so a price you set yourself in the dashboard is kept.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================
update public.products
   set base_price = 50000
 where 'couples' = any(tags) and base_price = 90000;
