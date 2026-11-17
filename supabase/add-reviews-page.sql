-- Run in Supabase → SQL Editor to enable / update the customer reviews page. Safe to run again.
-- =====================================================================
-- Store-wide customer reviews ("آراء الزبائن"):
--  * reviews may be about the store in general (product_id null)
--  * guests can submit (user_id null) — always moderated before showing
--  * photos (customer uploads / admin-added screenshots), city, source,
--    verified-buyer flag (order number + phone matched) and featuring
-- =====================================================================
alter table public.reviews alter column product_id drop not null;
alter table public.reviews alter column user_id drop not null;
alter table public.reviews add column if not exists author_city text check (author_city is null or length(author_city) <= 80);
alter table public.reviews add column if not exists photos text[] not null default '{}';
alter table public.reviews add column if not exists source text not null default 'site' check (source in ('site', 'instagram', 'whatsapp', 'tiktok', 'other'));
alter table public.reviews add column if not exists is_verified boolean not null default false;
alter table public.reviews add column if not exists is_featured boolean not null default false;
alter table public.reviews add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.reviews drop constraint if exists reviews_photos_max;
alter table public.reviews add constraint reviews_photos_max check (coalesce(array_length(photos, 1), 0) <= 6);
create index if not exists reviews_public_idx on public.reviews (is_featured desc, created_at desc) where is_approved;

-- Aggregates for the reviews page header (approved only).
create or replace function public.review_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'with_photos', count(*) filter (where coalesce(array_length(photos, 1), 0) > 0),
    'by_rating', jsonb_build_object('5', count(*) filter (where rating = 5), '4', count(*) filter (where rating = 4),
      '3', count(*) filter (where rating = 3), '2', count(*) filter (where rating = 2), '1', count(*) filter (where rating = 1)))
  from public.reviews where is_approved
$$;
grant execute on function public.review_stats() to anon, authenticated;

-- New reviews alert the admins.
create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_approved then
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'review.created', 'رأي جديد بانتظار الموافقة: ' || coalesce(new.author_name, ''), left(coalesce(new.body, ''), 140), '/admin/reviews');
  end if;
  return new;
end $$;
drop trigger if exists reviews_notify on public.reviews;
create trigger reviews_notify after insert on public.reviews for each row execute function public.notify_new_review();

-- Staff can add testimonials (published directly).
drop policy if exists reviews_staff_insert on public.reviews;
create policy reviews_staff_insert on public.reviews for insert to authenticated with check (public.is_staff());

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
