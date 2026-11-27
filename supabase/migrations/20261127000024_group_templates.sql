-- TPAC: group orders with a shared design.
-- The organiser picks the garment and colour, uploads the fixed design(s) (e.g. the front),
-- and decides what each member adds and where: their name on a fixed placement, or their own
-- design for one placement. Members see the piece live with their name / design on it.
alter table public.group_orders add column if not exists garment text;
alter table public.group_orders add column if not exists color_id uuid references public.colors(id) on delete set null;
-- { fixed: { front?: artwork id, back?: …, left_chest?: … },
--   member: { kind: 'none' | 'name' | 'design', placement: 'front' | 'back' | 'left_chest', font, color } }
alter table public.group_orders add column if not exists template jsonb not null default '{}'::jsonb;
alter table public.group_order_members add column if not exists artwork_id uuid references public.uploaded_artwork(id) on delete set null;
