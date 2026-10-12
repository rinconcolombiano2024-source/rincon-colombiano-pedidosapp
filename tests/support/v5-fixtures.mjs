import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export const sql=name=>readFileSync(name,'utf8');
export const R=randomUUID(),B=randomUUID(),O=randomUUID(),D=randomUUID(),token='a'.repeat(64);
export async function bootstrap(db){await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${R}'),('${B}');
create schema extensions;create extension pgcrypto with schema extensions;set search_path=public,extensions;
grant usage on schema public,auth,extensions to anon,authenticated,service_role;`);}

export async function setupOrders(db){
 await db.exec(`
 create function public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric) returns boolean language sql as $$select true$$;
 create table customer_orders(
 id uuid primary key,user_id uuid,customer_user_id uuid,idempotency_key text,public_token text,status text,table_label text,
 customer_name text,order_type text,order_json jsonb,total numeric,currency text,subtotal numeric,
 base_delivery_fee numeric,distance_fee numeric,operational_adjustment numeric,platform_adjustment numeric,final_delivery_fee numeric,
 payment_method text,payment_status text,payment_amount numeric,payment_currency text,created_at timestamptz,updated_at timestamptz);
 create table customer_order_access_secrets(customer_order_id uuid primary key,token_plaintext text,created_at timestamptz,updated_at timestamptz);
 create table restaurant_profiles(user_id uuid primary key,country_code text,region text,active boolean,deleted_at timestamptz,operational_mode text,opening_hours jsonb,timezone text,operational_open boolean);
 create table app_settings(user_id uuid primary key,menu jsonb,settings jsonb);
 create table delivery_quotes(id uuid primary key,restaurant_user_id uuid,token_hash text,used_at timestamptz,expires_at timestamptz,customer_user_id uuid,fee_breakdown jsonb,final_fee numeric,currency text,distance_km numeric,duration_seconds int,used_by_order_id uuid);
 create function rc_ordera_customer_token_matches(uuid,text) returns boolean language sql as $$select exists(select 1 from customer_order_access_secrets where customer_order_id=$1 and token_plaintext=$2)$$;
 create function restaurant_schedule_is_open(jsonb,text,timestamptz) returns boolean language sql as $$select true$$;
 create function rc_ordera_jsonb_numeric(jsonb,numeric) returns numeric language sql as $$select coalesce(($1 #>> '{}')::numeric,$2)$$;
 insert into restaurant_profiles values('${R}','PL','warsaw',true,null,'manual','{}','Europe/Warsaw',true);
 insert into app_settings values('${R}','{"Main":[{"id":"dish","name":"Arepa","price":15.50,"available":true,"vatRate":"8"}]}','{}');
 `);
 await db.exec(sql('MIGRACION-V91-29A-RPC-INTERNO-PEDIDOS.sql'));
 await db.exec(sql('MIGRACION-V5-20261010-02-ORDEN-IDEMPOTENTE-IVA.sql'));
}
