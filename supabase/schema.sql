-- AlyTech lead engine. Run once in the Supabase SQL editor (or via MCP apply_migration).
-- Only the server (service-role key) touches these tables; RLS is on with no policies, so the
-- public anon key can read/write nothing.

create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  lead_key    uuid not null unique,            -- one per form opening; partial saves upsert onto it
  status      text not null default 'partial' check (status in ('partial', 'submitted')),
  mode        text,                             -- whatsapp | datasheet | price | quote | specs | interest
  name        text,
  company     text,
  email       text,
  phone       text,
  country     text,
  message     text,
  product     text,
  brand       text,
  category    text,
  marketing_consent boolean not null default false,  -- opted in to product news (unticked by default)
  lang        text,
  path        text,
  referrer    text,
  landing_page text,                            -- first campaign landing path of the session (ad clicks)
  attribution jsonb,                            -- utm_* / gclid / gbraid / wbraid / msclkid / li_fat_id from that landing URL
  visitor_id  text,
  session_id  text,
  ip          inet,
  ip_org      text,                             -- network owner: often the company on corporate networks
  geo_country text,
  geo_city    text,
  user_agent  text,
  handled     boolean not null default false,   -- ticked in the admin panel once followed up
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Existing databases: the create table above is skipped, so add the newer columns here (safe to re-run).
alter table leads add column if not exists landing_page text;
alter table leads add column if not exists attribution jsonb;

create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_visitor_idx on leads (visitor_id);

create table if not exists events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  type        text not null,                    -- pageview | lead_open | search | nudge | admin_login_fail (data.ip, for login lockout)
  visitor_id  text,
  session_id  text,
  path        text,
  title       text,
  product     text,
  referrer    text,
  lang        text,
  ip_org      text,
  geo_country text,
  geo_city    text,
  data        jsonb
);
create index if not exists events_ts_idx on events (ts desc);
create index if not exists events_visitor_idx on events (visitor_id, ts);
create index if not exists events_type_idx on events (type, ts desc);

alter table leads enable row level security;
alter table events enable row level security;

-- Admin dashboard aggregates (last 30 days). security_invoker keeps RLS in force for anon/auth roles.
create or replace view v_org_activity with (security_invoker = on) as
  select ip_org,
         count(distinct visitor_id) as visitors,
         count(*) as pageviews,
         max(ts) as last_seen,
         array_remove(array_agg(distinct product), null) as products,
         mode() within group (order by geo_country) as country
  from events
  where type = 'pageview' and ip_org is not null and ts > now() - interval '30 days'
  group by ip_org;

create or replace view v_top_products with (security_invoker = on) as
  select product, count(*) as views, count(distinct visitor_id) as visitors
  from events
  where type = 'pageview' and product is not null and ts > now() - interval '30 days'
  group by product;

create or replace view v_top_searches with (security_invoker = on) as
  select lower(trim(data->>'q')) as q, count(*) as searches, max(ts) as last_seen
  from events
  where type = 'search' and ts > now() - interval '30 days'
  group by 1;

create or replace view v_daily with (security_invoker = on) as
  select date_trunc('day', ts at time zone 'Asia/Dubai')::date as day,
         count(*) filter (where type = 'pageview') as pageviews,
         count(distinct visitor_id) as visitors
  from events
  where ts > now() - interval '30 days'
  group by 1;

revoke all on leads, events, v_org_activity, v_top_products, v_top_searches, v_daily from anon, authenticated;

-- Data retention, matching the privacy policy: enquiry records up to 5 years after last contact,
-- page-view (event) records up to 24 months. Failed-admin-login events (they hold an IP) are only needed for the lockout, so 30 days.
-- leads.updated_at moves on every save from the site form, so it is the "last contact" clock.
create or replace function purge_old_data() returns void language sql as $$
  delete from events where type = 'admin_login_fail' and ts < now() - interval '30 days';
  delete from events where ts < now() - interval '24 months';
  delete from leads  where updated_at < now() - interval '5 years';
$$;
revoke all on function purge_old_data() from public, anon, authenticated;

-- Run it daily at 03:00 UTC with pg_cron (Supabase: Database > Extensions > enable "pg_cron", then run once):
--   select cron.schedule('purge-old-data', '0 3 * * *', 'select purge_old_data()');
-- To change or remove it later:
--   select cron.unschedule('purge-old-data');
-- To run it by hand: select purge_old_data();
