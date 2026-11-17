-- =====================================================================
-- TPAC — catalog search (SECURITY INVOKER: RLS still applies, so anonymous
-- visitors only ever see published products).
-- p = { q, category, collection, sizes[], colors[], min_price, max_price,
--       in_stock, new, best, limited, customizable, sort, limit, offset, exclude }
-- sort: newest | popular | price_asc | price_desc
-- =====================================================================
create or replace function public.catalog_search(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_q text := nullif(trim(p ->> 'q'), '');
  v_limit int := least(greatest(coalesce((p ->> 'limit')::int, 24), 1), 60);
  v_offset int := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  v_sort text := coalesce(p ->> 'sort', 'newest');
  v_sizes text[] := case when jsonb_typeof(p -> 'sizes') = 'array' then array(select jsonb_array_elements_text(p -> 'sizes')) end;
  v_colors text[] := case when jsonb_typeof(p -> 'colors') = 'array' then array(select jsonb_array_elements_text(p -> 'colors')) end;
  v_result jsonb;
begin
  with base as (
    select pr.*,
           (select min(coalesce(v.price_override, pr.base_price)) from product_variants v where v.product_id = pr.id and v.is_active) as min_price
      from products pr
     where pr.is_published
       and (v_q is null or pr.name_ar ilike '%' || v_q || '%' or pr.name_en ilike '%' || v_q || '%'
            or exists (select 1 from unnest(pr.tags) t where t ilike '%' || v_q || '%')
            or exists (select 1 from categories c where c.id = pr.category_id and (c.name_ar ilike '%' || v_q || '%' or c.name_en ilike '%' || v_q || '%')))
       and (p ->> 'category' is null or pr.category_id in (
             select c.id from categories c where c.slug = p ->> 'category'
             union select c2.id from categories c2 join categories c1 on c2.parent_id = c1.id where c1.slug = p ->> 'category'))
       and (p ->> 'collection' is null or exists (
             select 1 from product_collections pc join collections co on co.id = pc.collection_id
              where pc.product_id = pr.id and co.slug = p ->> 'collection'))
       and (v_sizes is null or exists (select 1 from product_variants v where v.product_id = pr.id and v.is_active and v.size_code = any(v_sizes)))
       and (v_colors is null or exists (select 1 from product_variants v join colors c on c.id = v.color_id
             where v.product_id = pr.id and v.is_active and c.code = any(v_colors)))
       and (coalesce((p ->> 'in_stock')::boolean, false) = false or exists (
             select 1 from product_variants v join inventory i on i.variant_id = v.id
              where v.product_id = pr.id and v.is_active and i.quantity > 0
                and (v_sizes is null or v.size_code = any(v_sizes))))
       and (coalesce((p ->> 'new')::boolean, false) = false or pr.is_new_arrival)
       and (coalesce((p ->> 'best')::boolean, false) = false or pr.sales_count > 0 or pr.is_featured)
       and (coalesce((p ->> 'limited')::boolean, false) = false or pr.is_limited)
       and (coalesce((p ->> 'customizable')::boolean, false) = false or pr.is_customizable)
       and (p ->> 'exclude' is null or pr.id <> (p ->> 'exclude')::uuid)
  ), filtered as (
    select * from base
     where (p ->> 'min_price' is null or coalesce(min_price, base_price) >= (p ->> 'min_price')::int)
       and (p ->> 'max_price' is null or coalesce(min_price, base_price) <= (p ->> 'max_price')::int)
  ), ranked as (
    select f.*, row_number() over (order by
       case when v_sort = 'price_asc' then coalesce(f.min_price, f.base_price) end asc,
       case when v_sort = 'price_desc' then coalesce(f.min_price, f.base_price) end desc,
       case when v_sort = 'popular' then f.sales_count end desc,
       coalesce(f.published_at, f.created_at) desc, f.id) as rn
      from filtered f
  ), page as (
    select * from ranked where rn > v_offset and rn <= v_offset + v_limit
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pg.id, 'slug', pg.slug, 'name_ar', pg.name_ar, 'name_en', pg.name_en,
        'price', coalesce(pg.min_price, pg.base_price), 'compare_at_price', pg.compare_at_price,
        'is_new_arrival', pg.is_new_arrival, 'is_limited', pg.is_limited, 'is_customizable', pg.is_customizable,
        'images', coalesce((select jsonb_agg(jsonb_build_object('url', pi.url, 'alt_ar', pi.alt_ar, 'alt_en', pi.alt_en) order by pi.sort_order)
                              from (select * from product_images where product_id = pg.id order by sort_order limit 2) pi), '[]'::jsonb),
        'colors', coalesce((select jsonb_agg(distinct c.hex) from product_variants v join colors c on c.id = v.color_id
                              where v.product_id = pg.id and v.is_active), '[]'::jsonb),
        'in_stock', exists (select 1 from product_variants v join inventory i on i.variant_id = v.id
                             where v.product_id = pg.id and v.is_active and i.quantity > 0)
      ) order by pg.rn) from page pg), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

grant execute on function public.catalog_search(jsonb) to anon, authenticated, service_role;
