-- Run once in Supabase → SQL Editor to enable the hero slideshow with video support. Safe to run again.
-- Hero slideshow: slides can carry a video (mp4/webm/mov), uploaded from the dashboard.
alter table public.promo_banners add column if not exists video_url text check (video_url is null or length(video_url) <= 1000);

-- site-media now accepts short videos (40 MB) next to images.
update storage.buckets
   set file_size_limit = 41943040,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'site-media';
