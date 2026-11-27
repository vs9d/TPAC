-- TPAC: group members design their own piece in the studio (move / resize their name, add text and images).
-- Each member keeps their layout, the images they used and a front / back preview for the organiser and the print shop.
alter table public.group_order_members add column if not exists design jsonb;
alter table public.group_order_members add column if not exists artwork_ids uuid[] not null default '{}';
alter table public.group_order_members add column if not exists preview_front_path text;
alter table public.group_order_members add column if not exists preview_back_path text;
