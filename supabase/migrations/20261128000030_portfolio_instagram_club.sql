-- =====================================================================
-- Our work (portfolio): sports clubs, Instagram posts, and the
-- Al-Quwa Al-Jawiya Sports Club project.
--   - new category "sports" (sports clubs and teams)
--   - portfolio_projects.instagram_url: a link to the project's post on Instagram
--   - the club as a client, and its project linked to the Instagram post
--     (photos are added from Admin → Our work)
-- Run once in the Supabase SQL Editor (safe to run again).
-- =====================================================================
alter table public.portfolio_clients drop constraint if exists portfolio_clients_category_check;
alter table public.portfolio_clients add constraint portfolio_clients_category_check
  check (category in ('university', 'college', 'company', 'organization', 'sports', 'custom'));
alter table public.portfolio_projects drop constraint if exists portfolio_projects_category_check;
alter table public.portfolio_projects add constraint portfolio_projects_category_check
  check (category in ('university', 'college', 'company', 'organization', 'sports', 'custom'));

alter table public.portfolio_projects add column if not exists instagram_url text;
do $$ begin
  alter table public.portfolio_projects add constraint portfolio_projects_instagram_url_check
    check (instagram_url is null or instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9_./-]+$');
exception when duplicate_object then null; end $$;

insert into public.portfolio_clients (name_ar, name_en, category, sort_order)
select 'نادي القوة الجوية', 'Al-Quwa Al-Jawiya SC', 'sports', coalesce((select max(sort_order) + 1 from public.portfolio_clients), 1)
where not exists (select 1 from public.portfolio_clients where name_ar = 'نادي القوة الجوية');

insert into public.portfolio_projects (client_id, title_ar, title_en, description_ar, description_en, category, instagram_url, completed_on, is_featured, sort_order)
select c.id, 'نادي القوة الجوية — أبطال دوري نجوم العراق', 'Al-Quwa Al-Jawiya SC — Iraq Stars League champions',
  'تي شيرتات لنادي الشعب من تي باك تزيّن صدور الصقور 🦅 خلال تتويجهم ببطل دوري نجوم العراق 2025–2026.',
  'TPAC T-shirts for Al-Quwa Al-Jawiya (the people''s club), worn by the Falcons 🦅 as they were crowned Iraq Stars League champions 2025–2026.',
  'sports', 'https://www.instagram.com/p/DZF_C2WjhoJ/', date '2026-06-02', true,
  coalesce((select min(sort_order) - 1 from public.portfolio_projects), 0)
from public.portfolio_clients c
where c.name_ar = 'نادي القوة الجوية'
  and not exists (select 1 from public.portfolio_projects where instagram_url = 'https://www.instagram.com/p/DZF_C2WjhoJ/');

-- the post's photos (shipped with the site in /public/portfolio); only if the project has none yet
update public.portfolio_projects set photos = '[
  {"url": "/portfolio/air-force-club-1.webp", "path": null},
  {"url": "/portfolio/air-force-club-2.webp", "path": null},
  {"url": "/portfolio/air-force-club-3.webp", "path": null},
  {"url": "/portfolio/air-force-club-4.webp", "path": null},
  {"url": "/portfolio/air-force-club-5.webp", "path": null}
]'::jsonb
where instagram_url = 'https://www.instagram.com/p/DZF_C2WjhoJ/' and jsonb_array_length(photos) = 0;
