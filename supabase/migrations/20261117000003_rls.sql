-- =====================================================================
-- TPAC — Row Level Security
-- Principle: deny by default. Customers see only their own private data;
-- staff (role staff/admin) manage the store; settings & roles are admin-only.
-- Writes that involve money or stock go through SECURITY DEFINER
-- functions, never direct table writes from the browser.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'customer_profiles','addresses','categories','collections','colors','sizes','products','product_collections',
    'product_images','product_variants','inventory','inventory_transactions','custom_garment_types','print_locations',
    'custom_designs','bulk_order_requests','bulk_pricing_rules','uploaded_artwork','delivery_zones','discount_codes',
    'orders','order_items','order_status_history','order_notes','quotations','discount_usage','carts','cart_items',
    'reviews','favorites','newsletter_subscribers','contact_inquiries','promo_banners','campaigns','homepage_sections',
    'website_settings','notifications','admin_activity_logs','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Profiles & addresses
-- ---------------------------------------------------------------------
create policy profiles_select_own on public.customer_profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.customer_profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy addresses_own on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_staff_read on public.addresses for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- Public catalog (read), staff write
-- ---------------------------------------------------------------------
create policy categories_read on public.categories for select to anon, authenticated using (is_active or public.is_staff());
create policy categories_write on public.categories for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy collections_read on public.collections for select to anon, authenticated using (is_active or public.is_staff());
create policy collections_write on public.collections for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy colors_read on public.colors for select to anon, authenticated using (true);
create policy colors_write on public.colors for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy sizes_read on public.sizes for select to anon, authenticated using (true);
create policy sizes_write on public.sizes for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy products_read on public.products for select to anon, authenticated using (is_published or public.is_staff());
create policy products_write on public.products for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy product_collections_read on public.product_collections for select to anon, authenticated using (true);
create policy product_collections_write on public.product_collections for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy product_images_read on public.product_images for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_published or public.is_staff())));
create policy product_images_write on public.product_images for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy product_variants_read on public.product_variants for select to anon, authenticated using (
  (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_published)) or public.is_staff());
create policy product_variants_write on public.product_variants for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Stock levels are public (needed to show availability); changes only through adjust_inventory()/place_order().
create policy inventory_read on public.inventory for select to anon, authenticated using (true);
create policy inventory_staff_insert on public.inventory for insert to authenticated with check (public.is_staff());
create policy inventory_staff_update_threshold on public.inventory for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy inventory_tx_read on public.inventory_transactions for select to authenticated using (public.is_staff());

create policy garment_types_read on public.custom_garment_types for select to anon, authenticated using (is_active or public.is_staff());
create policy garment_types_write on public.custom_garment_types for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy print_locations_read on public.print_locations for select to anon, authenticated using (is_active or public.is_staff());
create policy print_locations_write on public.print_locations for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- Customisation & bulk
-- custom_designs / uploads / bulk requests are created by the server
-- (service role) after validation; customers can read their own.
-- ---------------------------------------------------------------------
create policy custom_designs_read on public.custom_designs for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy uploaded_artwork_read on public.uploaded_artwork for select to authenticated
  using (uploaded_by = auth.uid() or public.is_staff());

create policy bulk_requests_read on public.bulk_order_requests for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy bulk_requests_staff_update on public.bulk_order_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy bulk_requests_staff_delete on public.bulk_order_requests for delete to authenticated using (public.is_admin());

create policy bulk_pricing_read on public.bulk_pricing_rules for select to anon, authenticated using (is_active or public.is_staff());
create policy bulk_pricing_write on public.bulk_pricing_rules for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy quotations_staff on public.quotations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy quotations_customer_read on public.quotations for select to authenticated using (
  status in ('sent', 'approved', 'converted') and exists (
    select 1 from public.bulk_order_requests b where b.id = bulk_request_id and b.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Delivery & discounts
-- ---------------------------------------------------------------------
create policy delivery_zones_read on public.delivery_zones for select to anon, authenticated using (is_active or public.is_staff());
create policy delivery_zones_write on public.delivery_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Discount codes are never listable by customers (validated server-side).
create policy discount_codes_staff on public.discount_codes for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy discount_usage_staff on public.discount_usage for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- Orders — customers read their own; staff read/update. Inserts happen
-- only via place_order() / convert_quotation_to_order().
-- ---------------------------------------------------------------------
create policy orders_read on public.orders for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy orders_staff_update on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy order_items_read on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));

create policy order_history_read on public.order_status_history for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));

create policy order_notes_staff on public.order_notes for all to authenticated using (public.is_staff()) with check (public.is_staff() and author_id = auth.uid());

-- Prevent staff from rewriting money columns or status directly (status must go through update_order_status()).
create or replace function public.guard_order_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.status is distinct from old.status
       or new.total is distinct from old.total or new.subtotal is distinct from old.subtotal
       or new.discount_total is distinct from old.discount_total or new.delivery_fee is distinct from old.delivery_fee
       or new.stock_committed is distinct from old.stock_committed or new.user_id is distinct from old.user_id
       or new.order_number is distinct from old.order_number then
      raise exception 'protected_order_columns' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger orders_guard before update on public.orders for each row execute function public.guard_order_update();

-- Same idea for inventory quantity: only via functions.
create or replace function public.guard_inventory_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.quantity is distinct from old.quantity then
    raise exception 'use_adjust_inventory' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger inventory_guard before update on public.inventory for each row execute function public.guard_inventory_update();

create or replace function public.guard_inventory_insert()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.quantity <> 0 then
    raise exception 'use_adjust_inventory' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger inventory_guard_insert before insert on public.inventory for each row execute function public.guard_inventory_insert();

-- ---------------------------------------------------------------------
-- Carts, favourites, reviews
-- ---------------------------------------------------------------------
create policy carts_own on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

create policy favorites_own on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reviews_read on public.reviews for select to anon, authenticated using (is_approved or user_id = auth.uid() or public.is_staff());
create policy reviews_insert_own on public.reviews for insert to authenticated with check (user_id = auth.uid() and not is_approved);
create policy reviews_staff on public.reviews for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy reviews_delete on public.reviews for delete to authenticated using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------
-- Marketing / CMS / settings
-- ---------------------------------------------------------------------
create policy newsletter_staff on public.newsletter_subscribers for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy inquiries_staff on public.contact_inquiries for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy banners_read on public.promo_banners for select to anon, authenticated using (
  (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())) or public.is_staff());
create policy banners_write on public.promo_banners for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy campaigns_staff on public.campaigns for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy homepage_read on public.homepage_sections for select to anon, authenticated using (is_visible or public.is_staff());
create policy homepage_write on public.homepage_sections for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Settings are public configuration (no secrets are ever stored here). Only admins can change them.
create policy settings_read on public.website_settings for select to anon, authenticated using (true);
create policy settings_write on public.website_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Notifications & logs
-- ---------------------------------------------------------------------
create policy notifications_customer on public.notifications for select to authenticated using (
  (audience = 'customer' and user_id = auth.uid()) or (audience = 'admin' and public.is_staff()));
create policy notifications_mark_read on public.notifications for update to authenticated using (
  (audience = 'customer' and user_id = auth.uid()) or (audience = 'admin' and public.is_staff()))
  with check ((audience = 'customer' and user_id = auth.uid()) or (audience = 'admin' and public.is_staff()));

create policy activity_logs_staff_read on public.admin_activity_logs for select to authenticated using (public.is_staff());

-- rate_limits: no policies => no access except service_role.

-- Customers can only flip read_at on their notifications.
create or replace function public.guard_notification_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
      raise exception 'only_read_at_is_editable' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function public.guard_notification_update();
