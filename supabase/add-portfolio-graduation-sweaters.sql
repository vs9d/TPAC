-- =====================================================================
-- Our work: graduation sweaters for Iraqi university classes
-- (photos shipped with the site in /public/portfolio). Safe to run again.
-- =====================================================================
insert into public.portfolio_projects (title_ar, title_en, description_ar, description_en, category, photos, is_featured, sort_order)
select
  'سويترات تخرج — دفعات جامعات العراق', 'Graduation sweaters — Iraqi university classes',
  'سويترات تخرج بتصميم خاص لكل دفعة: القانون، الصيدلة، اللغة الإنكليزية، علوم الحاسوب بالجامعة التكنولوجية وغيرها — بألوان تختارها الدفعة وتطلع بيها بيوم التخرج.',
  'Graduation sweaters designed for each class — law, pharmacy, English, computer science at the University of Technology and more — in the colours each class chose for its graduation day.',
  'university',
  '[
    {"url": "/portfolio/graduation-1.webp", "path": null},
    {"url": "/portfolio/graduation-2.webp", "path": null},
    {"url": "/portfolio/graduation-3.webp", "path": null},
    {"url": "/portfolio/graduation-4.webp", "path": null},
    {"url": "/portfolio/graduation-5.webp", "path": null},
    {"url": "/portfolio/graduation-6.webp", "path": null},
    {"url": "/portfolio/graduation-7.webp", "path": null},
    {"url": "/portfolio/graduation-8.webp", "path": null},
    {"url": "/portfolio/graduation-9.webp", "path": null},
    {"url": "/portfolio/graduation-10.webp", "path": null},
    {"url": "/portfolio/graduation-11.webp", "path": null}
  ]'::jsonb,
  true,
  coalesce((select min(sort_order) - 1 from public.portfolio_projects), 0)
where not exists (select 1 from public.portfolio_projects where title_ar = 'سويترات تخرج — دفعات جامعات العراق');
