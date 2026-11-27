-- =====================================================================
-- TPAC Creators: the admin sets the garment's price for creators.
--
-- product_types.creator_base_price is what a creator's piece starts from
-- (e.g. a hoodie at 20,000 IQD); the creator adds their own markup on top.
-- Empty = the store's normal price for that garment (default_price).
-- Changing it reprices the creators' listings of that garment from the
-- dashboard; past sales keep the prices and earnings they were made with.
-- Run once in the Supabase SQL Editor (safe to run again).
-- =====================================================================
alter table public.product_types add column if not exists creator_base_price int;
do $$ begin
  alter table public.product_types add constraint product_types_creator_base_price_check check (creator_base_price is null or creator_base_price >= 0);
exception when duplicate_object then null; end $$;
