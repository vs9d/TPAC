-- TPAC — «نفس التصميم على قطعة ثانية» (هودي ⇄ تيشيرت …)
-- Products that carry the same artwork on different garments share one design_group.
-- Safe to run more than once.
alter table public.products add column if not exists design_group uuid;
create index if not exists products_design_group_idx on public.products(design_group) where design_group is not null;
