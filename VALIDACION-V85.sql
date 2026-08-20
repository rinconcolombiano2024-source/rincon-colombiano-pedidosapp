-- RC ORDERA V85 - validacion de estructura posterior a migraciones.
-- Solo consulta metadatos y configuracion. No modifica datos.

select
  to_regclass('public.restaurant_menu_backups') is not null as menu_backups_ok,
  to_regclass('public.order_station_tasks') is not null as station_tasks_ok,
  to_regclass('public.employee_time_entries') is not null as employee_hours_ok,
  to_regclass('public.waiter_monthly_closures') is not null as waiter_monthly_closures_ok,
  to_regclass('public.marketplace_payment_allocations') is not null as payment_allocations_ok,
  to_regclass('public.delivery_completion_confirmations') is not null as delivery_confirmations_ok;

select
  to_regprocedure('public.save_current_restaurant_menu(jsonb,bigint)') is not null as safe_menu_save_ok,
  to_regprocedure('public.clear_current_restaurant_menu(text)') is not null as safe_menu_clear_ok,
  to_regprocedure('public.list_my_station_orders(uuid)') is not null as station_orders_ok,
  to_regprocedure('public.close_my_waiter_month(uuid,date)') is not null as waiter_month_close_ok,
  to_regprocedure('public.close_current_restaurant_period(text,date)') is not null as restaurant_closures_ok,
  to_regprocedure('public.record_delivery_completion_confirmation(uuid,text,text)') is not null as delivery_confirmation_ok;

select restaurant_fee_bps, courier_fee_bps,
  restaurant_fee_bps = 500 as restaurant_fee_5_percent,
  courier_fee_bps = 10 as courier_fee_0_1_percent
from public.marketplace_finance_config
where id = true;

select country_code, provider, online_payments_enabled, marketplace_split_enabled, public_message
from public.marketplace_provider_availability
order by country_code;

select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where oid in (
  'public.restaurant_menu_backups'::regclass,
  'public.order_station_tasks'::regclass,
  'public.employee_time_entries'::regclass,
  'public.waiter_daily_closures'::regclass,
  'public.waiter_monthly_closures'::regclass,
  'public.restaurant_period_closures'::regclass,
  'public.marketplace_accounts'::regclass,
  'public.marketplace_payment_allocations'::regclass,
  'public.delivery_completion_confirmations'::regclass,
  'public.payment_provider_events'::regclass
)
order by relname;

select
  has_function_privilege('authenticated', 'public.close_my_waiter_month(uuid,date)', 'execute') as waiter_can_close_month,
  not has_function_privilege('anon', 'public.close_my_waiter_month(uuid,date)', 'execute') as anonymous_cannot_close_month,
  not has_function_privilege('authenticated', 'public.rc_ordera_calculate_marketplace_allocation(uuid)', 'execute') as browser_cannot_allocate_money,
  has_function_privilege('service_role', 'public.rc_ordera_calculate_marketplace_allocation(uuid)', 'execute') as backend_can_allocate_money;

select not exists (
  select 1 from pg_trigger
  where tgname = 'rc_ordera_restaurant_release_eligibility_trigger'
    and not tgisinternal
) as restaurant_money_requires_explicit_confirmation;

do $validation$
begin
  if to_regclass('public.restaurant_menu_backups') is null
     or to_regclass('public.order_station_tasks') is null
     or to_regclass('public.waiter_monthly_closures') is null
     or to_regclass('public.marketplace_payment_allocations') is null
     or to_regprocedure('public.close_my_waiter_month(uuid,date)') is null
     or to_regprocedure('public.record_delivery_completion_confirmation(uuid,text,text)') is null then
    raise exception 'RC ORDERA V85 validation failed: required objects are missing';
  end if;
  if not exists (
    select 1 from public.marketplace_finance_config
    where id = true and restaurant_fee_bps = 500 and courier_fee_bps = 10
  ) then
    raise exception 'RC ORDERA V85 validation failed: marketplace fees differ from 5%% and 0.1%%';
  end if;
  if exists (
    select 1 from pg_trigger
    where tgname = 'rc_ordera_restaurant_release_eligibility_trigger'
      and not tgisinternal
  ) then
    raise exception 'RC ORDERA V85 validation failed: automatic restaurant release trigger is still active';
  end if;
end;
$validation$;

select 'RC ORDERA V85 STRUCTURE OK' as validation_result;
