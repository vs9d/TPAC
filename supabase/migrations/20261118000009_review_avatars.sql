-- Reviews page v2: customer profile photo + category label ("تيشيرتات", "طلبات خاصة"…)
-- and a satisfaction percentage (share of 4–5★ reviews) in review_stats().
alter table public.reviews add column if not exists avatar_url text check (avatar_url is null or length(avatar_url) <= 1000);
alter table public.reviews add column if not exists label text check (label is null or length(label) <= 40);

create or replace function public.review_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'satisfaction', case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where rating >= 4) / count(*)) end,
    'with_photos', count(*) filter (where coalesce(array_length(photos, 1), 0) > 0),
    'by_rating', jsonb_build_object('5', count(*) filter (where rating = 5), '4', count(*) filter (where rating = 4),
      '3', count(*) filter (where rating = 3), '2', count(*) filter (where rating = 2), '1', count(*) filter (where rating = 1)))
  from public.reviews where is_approved
$$;
grant execute on function public.review_stats() to anon, authenticated;
