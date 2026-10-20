-- RC ORDERA inventory v1. Additive only. Do not execute until staging review.
-- Tables are private to service-role: RLS enabled with NO user policies.
-- Server-side restaurant authorization must be implemented before exposing write RPCs.
begin;
create table if not exists public.rc_inventory_warehouses (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 120),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(restaurant_id,id),
 unique(restaurant_id,name)
);
create table if not exists public.rc_inventory_ingredients (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 160),
 brand text,
 supplier text,
 category text not null check(length(btrim(category)) between 1 and 80),
 base_unit text not null check(base_unit in ('g','ml','unit')),
 purchase_unit_label text not null check(length(btrim(purchase_unit_label)) between 1 and 100),
 purchase_factor_milli bigint not null check(purchase_factor_milli>0 and purchase_factor_milli<=1000000000000),
 min_stock_milli bigint not null default 0 check(min_stock_milli>=0),
 reorder_lead_days integer not null default 0 check(reorder_lead_days between 0 and 365),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(restaurant_id,id)
);
create table if not exists public.rc_inventory_lots (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null,
 warehouse_id uuid not null,
 ingredient_id uuid not null,
 received_at timestamptz not null default now(),
 original_milli bigint not null check(original_milli>0),
 available_milli bigint not null check(available_milli>=0),
 original_cost_minor bigint not null check(original_cost_minor>=0),
 currency text not null check(currency in ('PLN','COP')),
 created_at timestamptz not null default now(),
 check(available_milli<=original_milli),
 unique(restaurant_id,id),
 foreign key(restaurant_id,warehouse_id) references public.rc_inventory_warehouses(restaurant_id,id),
 foreign key(restaurant_id,ingredient_id) references public.rc_inventory_ingredients(restaurant_id,id)
);
create table if not exists public.rc_inventory_movements (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null,
 warehouse_id uuid not null,
 ingredient_id uuid not null,
 lot_id uuid,
 idempotency_key text not null check(length(btrim(idempotency_key)) between 1 and 128),
 movement_type text not null check(movement_type in ('receipt','sale','waste','adjustment_in','adjustment_out','transfer_in','transfer_out','return')),
 waste_reason text check(waste_reason in ('desperdicio','rotura','consumo_personal','error_cocina')),
 quantity_milli bigint not null check(quantity_milli>0),
 cost_minor bigint not null check(cost_minor>=0),
 created_at timestamptz not null default now(),
 check((movement_type='waste')=(waste_reason is not null)),
 unique(restaurant_id,idempotency_key),
 foreign key(restaurant_id,warehouse_id) references public.rc_inventory_warehouses(restaurant_id,id),
 foreign key(restaurant_id,ingredient_id) references public.rc_inventory_ingredients(restaurant_id,id),
 foreign key(restaurant_id,lot_id) references public.rc_inventory_lots(restaurant_id,id)
);
create index if not exists rc_inventory_lots_fifo_idx on public.rc_inventory_lots(restaurant_id,warehouse_id,ingredient_id,received_at,id) where available_milli>0;
create index if not exists rc_inventory_movements_history_idx on public.rc_inventory_movements(restaurant_id,ingredient_id,created_at);
alter table public.rc_inventory_warehouses enable row level security;
alter table public.rc_inventory_ingredients enable row level security;
alter table public.rc_inventory_lots enable row level security;
alter table public.rc_inventory_movements enable row level security;
create table if not exists public.rc_inventory_counts (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null,
 warehouse_id uuid not null,
 status text not null default 'draft' check(status in ('draft','submitted','approved','cancelled')),
 started_at timestamptz not null default now(),
 submitted_at timestamptz,
 approved_at timestamptz,
 unique(restaurant_id,id),
 foreign key(restaurant_id,warehouse_id) references public.rc_inventory_warehouses(restaurant_id,id)
);
create table if not exists public.rc_inventory_count_lines (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null,
 count_id uuid not null,
 ingredient_id uuid not null,
 counted_milli bigint not null check(counted_milli>=0),
 theoretical_milli bigint check(theoretical_milli>=0),
 theoretical_value_minor bigint check(theoretical_value_minor>=0),
 variance_value_minor bigint,
 created_at timestamptz not null default now(),
 unique(restaurant_id,count_id,ingredient_id),
 foreign key(restaurant_id,count_id) references public.rc_inventory_counts(restaurant_id,id),
 foreign key(restaurant_id,ingredient_id) references public.rc_inventory_ingredients(restaurant_id,id)
);
create index if not exists rc_inventory_counts_status_idx on public.rc_inventory_counts(restaurant_id,warehouse_id,status);
alter table public.rc_inventory_counts enable row level security;
alter table public.rc_inventory_count_lines enable row level security;
revoke all on public.rc_inventory_counts,public.rc_inventory_count_lines from anon,authenticated;
-- Explicitly revoke direct access. No policies are created in this migration.
revoke all on public.rc_inventory_warehouses,public.rc_inventory_ingredients,public.rc_inventory_lots,public.rc_inventory_movements from anon,authenticated;
commit;
