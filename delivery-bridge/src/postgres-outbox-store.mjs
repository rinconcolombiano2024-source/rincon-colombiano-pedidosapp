/** Inject a parameterized PostgreSQL query(sql, params) function, bound to a trusted backend.
 * One store is scoped to one restaurant. Never expose a service-role query to browsers.
 * Atomic UPDATE predicates and claim tokens fence all instances, including crash recovery.
 */
export class PostgresOutboxStore {
  durable = true;
  constructor({ query, restaurantId }) {
    if (typeof query !== 'function' || !/^[0-9a-f-]{36}$/i.test(restaurantId ?? '')) throw new Error('INVALID_STORE_CONFIG');
    this.query = query; this.restaurantId = restaurantId;
  }
  async get(id) { return (await this.query('select entry from public.rc_delivery_outbox_v5 where id=$1 and restaurant_user_id=$2', [id, this.restaurantId])).rows[0]?.entry ?? null; }
  async list({limit=100,afterId=null,states=null}={}) {
    validatePage(limit,afterId);
    if(states && (!Array.isArray(states)||states.some(s=>!['pending','processing','sent','dead','expired','unknown'].includes(s))))throw new Error('INVALID_STATES');
    return (await this.query(`select entry from public.rc_delivery_outbox_v5
      where restaurant_user_id=$1 and ($2::text is null or id>$2)
      and ($3::text[] is null or entry->>'state'=any($3)) order by id limit $4`,
      [this.restaurantId,afterId,states,limit])).rows.map(r=>r.entry);
  }
  async due(now,limit=100,blockedProviders=[]) {
    validatePage(limit);
    return (await this.query(`select entry from public.rc_delivery_outbox_v5
      where restaurant_user_id=$1 and entry->>'state'='pending'
      and (entry->>'nextAttemptAt')::bigint <= $2 and not (entry->>'provider'=any($4::text[]))
      and (entry->>'action'<>'ready' or exists(select 1 from public.rc_delivery_outbox_v5 accepted
        where accepted.restaurant_user_id=$1 and accepted.entry->>'provider'=rc_delivery_outbox_v5.entry->>'provider'
        and accepted.entry->>'orderId'=rc_delivery_outbox_v5.entry->>'orderId'
        and accepted.entry->>'action'='accept' and (accepted.entry->>'state'='sent'
          or (accepted.entry->>'state'='pending' and (accepted.entry->>'nextAttemptAt')::bigint <= $2))))
      order by case entry->>'action' when 'accept' then 0 when 'reject' then 0 when 'ready' then 1 when 'delivered' then 2 else 9 end,
      (entry->>'createdAt')::bigint,id limit $3`,[this.restaurantId,now,limit,blockedProviders])).rows.map(r=>r.entry);
  }
  async insert(entry) {
    if (entry.restaurantId !== this.restaurantId) throw new Error('TENANT_MISMATCH');
    const r = await this.query(`with changed as (
      insert into public.rc_delivery_outbox_v5(id,restaurant_user_id,entry) values($1,$2,$3::jsonb)
      on conflict(id) do nothing returning id
    ), journal as (insert into public.rc_delivery_outbox_events_v5(operation_id,restaurant_user_id,event_type)
      select id,$2,'enqueued' from changed) select id from changed`, [entry.id, this.restaurantId, JSON.stringify(entry)]);
    return r.rows.length === 1;
  }
  async claim(id, token, now, leaseMs) {
    const r = await this.query(`with changed as (
      update public.rc_delivery_outbox_v5 set entry=entry || jsonb_build_object('state','processing','claimToken',$3::text,'leaseUntil',$4::bigint + $5::bigint)
      where id=$1 and restaurant_user_id=$2 and entry->>'state'='pending'
      and (entry->>'nextAttemptAt')::bigint <= $4::bigint
      and (entry->>'action'<>'ready' or exists(select 1 from public.rc_delivery_outbox_v5 accepted
        where accepted.restaurant_user_id=$2 and accepted.entry->>'provider'=rc_delivery_outbox_v5.entry->>'provider'
        and accepted.entry->>'orderId'=rc_delivery_outbox_v5.entry->>'orderId'
        and accepted.entry->>'action'='accept' and accepted.entry->>'state'='sent')) returning id, entry
    ), journal as (insert into public.rc_delivery_outbox_events_v5(operation_id,restaurant_user_id,event_type)
      select id,$2,'claimed' from changed) select entry from changed`, [id, this.restaurantId, token, now, leaseMs]);
    return r.rows[0]?.entry ?? null;
  }
  async finish(entry, token) {
    const r = await this.query(`with changed as (
      update public.rc_delivery_outbox_v5 set entry=$4::jsonb
      where id=$1 and restaurant_user_id=$2 and entry->>'state'='processing' and entry->>'claimToken'=$3 returning id
    ), journal as (insert into public.rc_delivery_outbox_events_v5(operation_id,restaurant_user_id,event_type)
      select id,$2,$5 from changed) select id from changed`, [entry.id, this.restaurantId, token, JSON.stringify(entry), entry.state]);
    if (r.rows.length !== 1) throw new Error('CLAIM_LOST');
  }
  async recover(now,limit=100) {
    validatePage(limit);
    await this.query(`with candidates as materialized (
      select id from public.rc_delivery_outbox_v5
      where restaurant_user_id=$1 and entry->>'state'='processing' and (entry->>'leaseUntil')::bigint <= $2
      order by (entry->>'leaseUntil')::bigint,id limit $3 for update skip locked
    ), changed as (
      update public.rc_delivery_outbox_v5 set entry=entry || '{"state":"unknown","lastError":"worker_lost"}'::jsonb
      where id in (select id from candidates)
      and restaurant_user_id=$1 and entry->>'state'='processing' and (entry->>'leaseUntil')::bigint <= $2 returning id
    ) insert into public.rc_delivery_outbox_events_v5(operation_id,restaurant_user_id,event_type)
      select id,$1,'unknown' from changed`, [this.restaurantId, now,limit]);
  }
  async resolve(id, state, evidence) {
    if (!['sent','dead'].includes(state) || typeof evidence !== 'string' || !evidence.trim()) throw new Error('RECONCILIATION_EVIDENCE_REQUIRED');
    const r = await this.query(`with changed as (
      update public.rc_delivery_outbox_v5 set entry=entry || jsonb_build_object('state',$3::text,'reconciliationEvidence',$4::text)
      where id=$1 and restaurant_user_id=$2 and entry->>'state'='unknown' returning id
    ), journal as (insert into public.rc_delivery_outbox_events_v5(operation_id,restaurant_user_id,event_type)
      select id,$2,'reconciled' from changed) select id from changed`, [id,this.restaurantId,state,evidence]);
    if (!r.rows.length) throw new Error('NOT_UNKNOWN');
  }
}

function validatePage(limit,afterId=null) {
 if(!Number.isSafeInteger(limit)||limit<1||limit>500||(afterId!==null&&!/^[0-9a-f]{32}$/.test(afterId)))throw new Error('INVALID_PAGE');
}
