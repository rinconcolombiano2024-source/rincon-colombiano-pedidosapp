-- RC ORDERA V91-26
-- Contrato verificable de release.
-- Requiere V91-23 + V91-24 + V91-25.
-- No modifica pedidos, ventas, pagos, cierres ni datos historicos.

begin;

create or replace function public.get_rc_ordera_release_contract()
returns table (
  schema_version integer,
  release_contract_version integer,
  compatible boolean,
  missing_components text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_missing text[] := array[]::text[];
  v_definition text;
  v_sync record;
  v_core regprocedure;
  v_wrapper regprocedure;
  v_report regprocedure;
  v_close regprocedure;
begin
  --------------------------------------------------------------------
  -- Contrato base V91-07
  --------------------------------------------------------------------
  if to_regprocedure('public.get_rc_ordera_sync_contract()') is null then
    v_missing := array_append(
      v_missing,
      'V91-07.get_rc_ordera_sync_contract'
    );
  else
    begin
      select *
      into v_sync
      from public.get_rc_ordera_sync_contract();

      if v_sync.compatible is distinct from true
         or coalesce(v_sync.contract_version, 0) < 7 then
        v_missing := array_append(
          v_missing,
          'V91-07.sync_contract'
        );
      end if;
    exception
      when others then
        v_missing := array_append(
          v_missing,
          'V91-07.sync_contract'
        );
    end;
  end if;


  --------------------------------------------------------------------
  -- V91-23: seguridad de pedidos + rate limit
  --------------------------------------------------------------------
  v_core := to_regprocedure(
    'public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)'
  );

  v_wrapper := to_regprocedure(
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)'
  );

  if v_core is null then
    v_missing := array_append(
      v_missing,
      'V91-23.create_customer_order_core'
    );
  else
    if has_function_privilege(
      'anon',
      v_core::oid,
      'EXECUTE'
    ) then
      v_missing := array_append(
        v_missing,
        'V91-23.core_exposed_to_anon'
      );
    end if;

    if has_function_privilege(
      'authenticated',
      v_core::oid,
      'EXECUTE'
    ) then
      v_missing := array_append(
        v_missing,
        'V91-23.core_exposed_to_authenticated'
      );
    end if;
  end if;

  if v_wrapper is null then
    v_missing := array_append(
      v_missing,
      'V91-23.create_customer_order_wrapper'
    );
  else
    if not has_function_privilege(
      'anon',
      v_wrapper::oid,
      'EXECUTE'
    ) then
      v_missing := array_append(
        v_missing,
        'V91-23.wrapper_missing_anon_execute'
      );
    end if;

    if not has_function_privilege(
      'authenticated',
      v_wrapper::oid,
      'EXECUTE'
    ) then
      v_missing := array_append(
        v_missing,
        'V91-23.wrapper_missing_authenticated_execute'
      );
    end if;

    v_definition := lower(pg_get_functiondef(v_wrapper));

    if position(
      'rc_ordera_consume_order_rate_limit'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-23.rate_limit_wrapper'
      );
    end if;

    if position(
      'create_customer_order_v91_22_core'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-23.protected_core_call'
      );
    end if;
  end if;

  if to_regclass(
    'public.customer_order_rate_limit_buckets'
  ) is null then
    v_missing := array_append(
      v_missing,
      'V91-23.customer_order_rate_limit_buckets'
    );
  end if;

  if to_regprocedure(
    'public.rc_ordera_consume_order_rate_limit(uuid,text,text,interval,integer)'
  ) is null then
    v_missing := array_append(
      v_missing,
      'V91-23.rc_ordera_consume_order_rate_limit'
    );
  end if;


  --------------------------------------------------------------------
  -- V91-24: cierre mensual completo
  --------------------------------------------------------------------
  v_report := to_regprocedure(
    'public.get_restaurant_closure_report(text,text)'
  );

  if v_report is null then
    v_missing := array_append(
      v_missing,
      'V91-24.get_restaurant_closure_report'
    );
  else
    v_definition := lower(pg_get_functiondef(v_report));

    if position(
      'm.month_key'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-24.monthly_closure_fix'
      );
    end if;
  end if;


  --------------------------------------------------------------------
  -- V91-25: identidad estable de producto
  --------------------------------------------------------------------
  if v_report is not null then
    v_definition := lower(pg_get_functiondef(v_report));

    if position(
      'v91_25_product_identity'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-25.product_identity'
      );
    end if;

    if position(
      'product_id'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-25.product_id_report'
      );
    end if;

    if position(
      'cancelled'', ''rejected'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-25.cancelled_rejected_contract'
      );
    end if;
  end if;


  --------------------------------------------------------------------
  -- V91-25: motor unico de cierre
  --------------------------------------------------------------------
  v_close := to_regprocedure(
    'public.close_current_restaurant_period(text,date)'
  );

  if v_close is null then
    v_missing := array_append(
      v_missing,
      'V91-25.close_current_restaurant_period'
    );
  else
    v_definition := lower(pg_get_functiondef(v_close));

    if position(
      'v91_25_single_report'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-25.single_closure_engine'
      );
    end if;

    if position(
      'get_restaurant_closure_report'
      in v_definition
    ) = 0 then
      v_missing := array_append(
        v_missing,
        'V91-25.shared_closure_engine'
      );
    end if;
  end if;


  --------------------------------------------------------------------
  -- Resultado
  --------------------------------------------------------------------
  return query
  select
    91,
    25,
    cardinality(v_missing) = 0,
    v_missing;
end;
$$;


revoke all
on function public.get_rc_ordera_release_contract()
from public, anon;

grant execute
on function public.get_rc_ordera_release_contract()
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
