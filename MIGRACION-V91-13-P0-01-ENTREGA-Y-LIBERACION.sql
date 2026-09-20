-- P0-01 solamente. Aplicar despues de V91-10/11/12 y del flujo V91 de entrega.
-- No modifica RPCs existentes, RLS, tokens, importes ni estados financieros.
-- delivered: repartidor asignado + entrega registrada por el flujo existente.
-- Pago del restaurante: ademas, ambas confirmaciones de esa misma entrega.
begin;
set local lock_timeout = '5s';

do $preflight$
declare
  v_table text;
  v_role text;
begin
  if to_regprocedure('public.update_delivery_assignment_status(uuid,text)') is null
     or to_regprocedure('public.record_delivery_completion_confirmation(uuid,text,text)') is null
     or to_regprocedure('public.rc_ordera_customer_token_matches(uuid,text)') is null
     or to_regprocedure('public.transition_customer_order_status(uuid,text,text)') is null then
    raise exception 'P0-01: falta el flujo de entrega/confirmacion V91. No se aplico el parche.';
  end if;
  -- La prueba solo es fiable si sigue cerrada la escritura directa del navegador.
  -- Verificamos los permisos previos; no los cambiamos ni sustituimos RLS.
  foreach v_table in array array[
    'customer_orders', 'delivery_assignments',
    'delivery_completion_confirmations', 'marketplace_payment_allocations'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'P0-01: falta public.%', v_table;
    end if;
    foreach v_role in array array['anon', 'authenticated'] loop
      if has_any_column_privilege(v_role, 'public.' || v_table, 'INSERT, UPDATE')
         or has_table_privilege(v_role, 'public.' || v_table, 'DELETE') then
        raise exception 'P0-01: % conserva escritura directa en %. Verificar migraciones previas.', v_role, v_table;
      end if;
    end loop;
  end loop;
end;
$preflight$;

-- Esta barrera se ejecuta tambien dentro de las RPCs SECURITY DEFINER de
-- restaurante/caja/manager/dispatch; auth.uid() conserva al actor original.
create or replace function public.rc_ordera_guard_delivery_completed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.order_type <> 'Domicilio' or new.status <> 'delivered' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = new.status and old.order_type = new.order_type then
      return new;
    end if;
  end if;

  if auth.uid() is null or auth.uid() = new.user_id
     or new.courier_assignment_status is distinct from 'delivered'
     or not exists (
       select 1
       from public.delivery_completion_confirmations dc
       join public.delivery_assignments da on da.id = dc.delivery_assignment_id
       where dc.customer_order_id = new.id
         and da.customer_order_id = new.id
         and da.restaurant_user_id = new.user_id
         and da.courier_user_id = auth.uid()
         and da.courier_user_id = new.assigned_courier_user_id
         and dc.courier_user_id = da.courier_user_id
         and da.status = 'delivered'
         and da.delivered_at is not null
         and dc.courier_confirmed_at is not null
     ) then
    raise exception 'DELIVERY_CONFIRMATION_REQUIRED'
      using errcode = '42501',
            detail = 'Domicilio must be completed by the assigned courier delivery flow, not by restaurant or station transitions.';
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_guard_delivery_completed on public.customer_orders;
create trigger rc_ordera_guard_delivery_completed
before insert or update of status, order_type on public.customer_orders
for each row execute function public.rc_ordera_guard_delivery_completed();

-- Consultas por PK: no escanea pedidos ni depende de un flag enviado por cliente.
create or replace function public.rc_ordera_delivery_release_proven(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.customer_orders co
    join public.delivery_completion_confirmations dc on dc.customer_order_id = co.id
    join public.delivery_assignments da on da.id = dc.delivery_assignment_id
    where co.id = p_order_id
      and co.status = 'delivered'
      and lower(trim(coalesce(co.payment_status, ''))) = 'paid'
      and da.customer_order_id = co.id
      and da.restaurant_user_id = co.user_id
      and da.courier_user_id = co.assigned_courier_user_id
      and dc.courier_user_id = da.courier_user_id
      and dc.customer_user_id is not distinct from co.customer_user_id
      and da.status = 'delivered'
      and da.delivered_at is not null
      and dc.courier_confirmed_at is not null
      and dc.customer_confirmed_at is not null
      and dc.completed_at is not null
  );
$$;

-- Cubre el trigger delivered, allocation tardia, conciliacion de disputa y
-- marketplace-release-order (service_role). No revierte cobros ni conciliacion:
-- simplemente no deja persistir una elegibilidad sin prueba.
create or replace function public.rc_ordera_guard_delivery_release()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.restaurant_release_eligible_at is not null
     and exists (
       select 1 from public.customer_orders co
       where co.id = new.customer_order_id and co.order_type = 'Domicilio'
     )
     and not public.rc_ordera_delivery_release_proven(new.customer_order_id) then
    new.restaurant_release_eligible_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_guard_delivery_release on public.marketplace_payment_allocations;
create trigger rc_ordera_guard_delivery_release
before insert or update of restaurant_release_eligible_at, customer_order_id
on public.marketplace_payment_allocations
for each row execute function public.rc_ordera_guard_delivery_release();

-- La confirmacion valida puede llegar DESPUES del status delivered.
-- Reutiliza las pruebas y la cola existentes, sin cambiar el RPC ni sus tokens.
create or replace function public.rc_ordera_release_confirmed_delivery()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.courier_confirmed_at is not null
     and new.customer_confirmed_at is not null
     and new.completed_at is not null
     and exists (
       select 1 from public.customer_orders co
       where co.id = new.customer_order_id and co.order_type = 'Domicilio'
     )
     and public.rc_ordera_delivery_release_proven(new.customer_order_id) then
    update public.marketplace_payment_allocations a
    set restaurant_release_eligible_at = new.completed_at,
        updated_at = now()
    where a.customer_order_id = new.customer_order_id
      and a.restaurant_release_eligible_at is null
      and a.financial_hold = false
      and a.status not in ('settled', 'refunded');
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_release_confirmed_delivery on public.delivery_completion_confirmations;
create trigger rc_ordera_release_confirmed_delivery
after insert or update on public.delivery_completion_confirmations
for each row execute function public.rc_ordera_release_confirmed_delivery();

revoke all on function public.rc_ordera_guard_delivery_completed() from public, anon, authenticated;
revoke all on function public.rc_ordera_delivery_release_proven(uuid) from public, anon, authenticated;
revoke all on function public.rc_ordera_guard_delivery_release() from public, anon, authenticated;
revoke all on function public.rc_ordera_release_confirmed_delivery() from public, anon, authenticated;

-- Cierra elegibilidades heredadas falsas que aun NO fueron transferidas.
-- No elimina pedidos/pruebas, no cambia importes/holds y no revierte transferencias.
update public.marketplace_payment_allocations a
set restaurant_release_eligible_at = null
from public.customer_orders co
where co.id = a.customer_order_id
  and co.order_type = 'Domicilio'
  and a.restaurant_release_eligible_at is not null
  and coalesce(a.restaurant_transfer_id, '') = ''
  and a.restaurant_transferred_at is null
  and not public.rc_ordera_delivery_release_proven(co.id);

notify pgrst, 'reload schema';
commit;
