-- AlyTech lead engine + admin panel v2. Run in the Supabase SQL editor (or via MCP apply_migration).
-- Safe to re-run on an existing database: every statement is create-if-not-exists / add-column-if-not-exists / create-or-replace.
-- Only the server (service-role key) touches these tables and functions; RLS is on with no policies, so the
-- public anon key can read/write nothing.

-- Admin panel accounts. Passwords are PBKDF2-SHA256 hashes ("pbkdf2$iterations$salt$hash"), never plain text.
create table if not exists admin_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  name        text not null,
  role        text not null default 'viewer' check (role in ('owner', 'sales', 'viewer')),
  password_hash text not null,
  must_change_password boolean not null default false,  -- set when an owner issues a temporary password
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  last_login_at timestamptz,
  constraint admin_users_email_lower check (email = lower(email))
);
create unique index if not exists admin_users_email_key on admin_users (email);

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
  ph_session  text,                             -- PostHog session id (admin links to the replay)
  visitor_id  text,
  session_id  text,
  ip          inet,
  ip_org      text,                             -- network owner: often the company on corporate networks
  geo_country text,
  geo_city    text,
  user_agent  text,
  handled     boolean not null default false,   -- legacy flag from the first admin build; the pipeline stage replaces it
  notes       text,                             -- legacy single notes box; shown read-only as the oldest timeline entry
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Existing databases: the create table above is skipped, so add the newer columns here (safe to re-run).
alter table leads add column if not exists landing_page text;
alter table leads add column if not exists attribution jsonb;
alter table leads add column if not exists ph_session text;

-- Enquiry pipeline. Old `handled` leads become 'contacted' exactly once (when the stage column is first created).
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'leads' and column_name = 'stage') then
    alter table leads add column stage text not null default 'new' check (stage in ('new', 'contacted', 'quoted', 'won', 'lost'));
    update leads set stage = 'contacted' where handled;
  end if;
end $$;
alter table leads add column if not exists value_aed numeric(14,2) check (value_aed is null or value_aed >= 0);
alter table leads add column if not exists assigned_to uuid references admin_users (id) on delete set null;
alter table leads add column if not exists follow_up date;
alter table leads add column if not exists lost_reason text;
alter table leads add column if not exists spam boolean not null default false;
alter table leads add column if not exists tags text[] not null default '{}';
alter table leads add column if not exists wa_ref text;        -- WhatsApp "Ref XXXXX" when the lead was created from a chat click
alter table leads add column if not exists won_at timestamptz; -- set by the admin panel when the stage becomes 'won'

create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_visitor_idx on leads (visitor_id);
create index if not exists leads_stage_idx on leads (stage, created_at desc);
create index if not exists leads_assigned_idx on leads (assigned_to) where assigned_to is not null;
create index if not exists leads_follow_up_idx on leads (follow_up) where follow_up is not null;
create index if not exists leads_wa_ref_idx on leads (wa_ref) where wa_ref is not null;
create index if not exists leads_won_idx on leads (won_at) where won_at is not null;

-- Notes timeline per lead ('system' rows record stage / assignee changes).
create table if not exists lead_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads (id) on delete cascade,
  author_id   uuid references admin_users (id) on delete set null,
  kind        text not null default 'note' check (kind in ('note', 'system')),
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists lead_notes_lead_idx on lead_notes (lead_id, created_at);
create index if not exists lead_notes_author_idx on lead_notes (author_id) where author_id is not null;

-- Site settings owned by the business (WhatsApp number, alert recipients, contact email, office hours, announcement bar, publish status).
create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references admin_users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists settings_updated_by_idx on settings (updated_by) where updated_by is not null;

-- Who did what in the admin panel (owner-only page).
create table if not exists admin_audit (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  user_id     uuid,                              -- no FK: the trail outlives the account
  actor       text,                              -- email at the time, or 'break-glass'
  action      text not null,
  target      text,
  details     jsonb
);
create index if not exists admin_audit_ts_idx on admin_audit (ts desc);

create table if not exists events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  type        text not null,                    -- pageview | lead_open | search | nudge | whatsapp | admin_login_fail (data.ip + data.email, for login lockout)
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
-- Privacy-friendly counting for visitors who have not accepted cookies: anon = true rows carry no visitor/session id, no ip_org, no city
-- (only path, referrer host, country, device class, language). `device` is also set for consented page views.
alter table events add column if not exists anon boolean not null default false;
alter table events add column if not exists device text;       -- mobile | tablet | desktop
create index if not exists events_ts_idx on events (ts desc);
create index if not exists events_visitor_idx on events (visitor_id, ts);
create index if not exists events_type_idx on events (type, ts desc);

alter table leads enable row level security;
alter table events enable row level security;
alter table admin_users enable row level security;
alter table lead_notes enable row level security;
alter table settings enable row level security;
alter table admin_audit enable row level security;

-- Admin dashboard aggregates (last 30 days). security_invoker keeps RLS in force for anon/auth roles.
-- (The v_* views are only used by the previous admin build; the dashboard now calls admin_overview() below. Kept so both versions work during a rollout.)
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

revoke all on leads, events, v_org_activity, v_top_products, v_top_searches, v_daily, admin_users, lead_notes, settings, admin_audit from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Dashboard aggregates. Period = [p_from, p_to) as timestamptz; the app passes Asia/Dubai midnights.
-- Everything is aggregated here (PostgREST caps responses at 1000 rows), invoked as RPC by the server with the service-role key.
-- ---------------------------------------------------------------------------------------------------------------------

-- "https://www.google.com/search?q=x" or just "google.com" (anonymous page views store the host only) -> "google.com"
create or replace function host_of(u text) returns text language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(coalesce(substring(u from '^(?:[a-zA-Z][a-zA-Z0-9+.-]*://)?([^/:?#]+)'), ''), '^www\.', '')), '')
$$;

-- direct / search / social / referral / campaign (utm present). 'internal' (our own site) is excluded from the source charts.
create or replace function traffic_channel(src text, med text, host text) returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(src, '') <> '' or coalesce(med, '') <> '' then 'campaign'
    when coalesce(host, '') = '' then 'direct'
    when host ~ '(^|\.)alytechme\.(com|ae)$' or host ~ '\.vercel\.app$' or host ~ '^localhost' then 'internal'
    when host ~ '(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|startpage|qwant)\.[a-z.]+$' or host = 'search.brave.com' then 'search'
    when host ~ '(^|\.)(facebook\.com|fb\.com|instagram\.com|linkedin\.com|lnkd\.in|twitter\.com|t\.co|x\.com|youtube\.com|youtu\.be|whatsapp\.com|wa\.me|tiktok\.com|pinterest\.com|reddit\.com)$' then 'social'
    else 'referral'
  end
$$;

-- Headline numbers for one period (the dashboard calls it for the current and the previous equal period).
-- Page views count every recorded view (consented and anonymous; the copy re-sent when a visitor clicks Accept is flagged dup and skipped).
-- "visitors" are distinct visitor ids, which exist only for visitors who accepted cookies. Spam leads are excluded everywhere.
-- "converted" = identified visitors who submitted an enquiry or started a WhatsApp chat (same population as the visitors figure).
create or replace function admin_kpis(p_from timestamptz, p_to timestamptz) returns jsonb language sql stable set search_path = public as $$
  with pv as (
    select 1 from events
    where type = 'pageview' and ts >= p_from and ts < p_to and coalesce(data->>'dup', '') <> 'true'
  ),
  idv as (
    select distinct visitor_id from events
    where type = 'pageview' and ts >= p_from and ts < p_to and visitor_id is not null
  ),
  act as (
    select visitor_id from leads
    where status = 'submitted' and not spam and created_at >= p_from and created_at < p_to and visitor_id is not null
    union
    select visitor_id from events
    where type = 'whatsapp' and ts >= p_from and ts < p_to and visitor_id is not null
  )
  select jsonb_build_object(
    'pageviews', (select count(*) from pv),
    'visitors', (select count(*) from idv),
    'enquiries', (select count(*) from leads where status = 'submitted' and not spam and wa_ref is null and created_at >= p_from and created_at < p_to),
    'partials', (select count(*) from leads where status = 'partial' and not spam and created_at >= p_from and created_at < p_to),
    'whatsapp', (select count(*) from events where type = 'whatsapp' and ts >= p_from and ts < p_to),
    'converted', (select count(*) from idv where visitor_id in (select visitor_id from act)),
    'won_count', (select count(*) from leads where not spam and won_at >= p_from and won_at < p_to),
    'won_value', (select coalesce(sum(value_aed), 0) from leads where not spam and won_at >= p_from and won_at < p_to)
  )
$$;

create or replace function admin_overview(p_from timestamptz, p_to timestamptz) returns jsonb language sql stable set search_path = public as $$
  with pv_all as materialized (
    select visitor_id, path, product, referrer, geo_country, device, ip_org, ts,
           data->>'utm_source' as utm_source, data->>'utm_medium' as utm_medium, data->>'utm_campaign' as utm_campaign,
           coalesce(data->>'dup', '') = 'true' as dup
    from events
    where type = 'pageview' and ts >= p_from and ts < p_to
  ),
  pv as materialized (select * from pv_all where not dup),
  days as (
    select d::date as day
    from generate_series((p_from at time zone 'Asia/Dubai')::date, ((p_to - interval '1 second') at time zone 'Asia/Dubai')::date, interval '1 day') d
  ),
  pvd as (select (ts at time zone 'Asia/Dubai')::date as day, count(*) as n from pv group by 1),
  enqd as (
    select (created_at at time zone 'Asia/Dubai')::date as day, count(*) as n from leads
    where status = 'submitted' and not spam and wa_ref is null and created_at >= p_from and created_at < p_to group by 1
  ),
  wad as (
    select (ts at time zone 'Asia/Dubai')::date as day, count(*) as n from events
    where type = 'whatsapp' and ts >= p_from and ts < p_to group by 1
  ),
  chan as (select traffic_channel(utm_source, utm_medium, host_of(referrer)) as k, count(*) as n from pv group by 1),
  refs as (
    select host_of(referrer) as k, count(*) as n from pv
    where traffic_channel(utm_source, utm_medium, host_of(referrer)) in ('search', 'social', 'referral') group by 1
  ),
  camps as (select utm_campaign as k, count(*) as n from pv where coalesce(utm_campaign, '') <> '' group by 1),
  fa as (select distinct visitor_id from pv_all where product is not null and visitor_id is not null),
  fb as (select distinct visitor_id from events where type = 'lead_open' and ts >= p_from and ts < p_to and visitor_id in (select visitor_id from fa)),
  fc as (
    select distinct visitor_id from leads
    where status = 'submitted' and not spam and created_at >= p_from and created_at < p_to and visitor_id in (select visitor_id from fb)
  ),
  se as (
    select lower(trim(data->>'q')) as q, case when data->>'results' ~ '^[0-9]+$' then (data->>'results')::int end as results
    from events where type = 'search' and ts >= p_from and ts < p_to and coalesce(trim(data->>'q'), '') <> ''
  ),
  orgs as (
    select ip_org, count(distinct visitor_id) as visitors, count(*) as pageviews, max(ts) as last_seen,
           array_remove(array_agg(distinct product), null) as products, mode() within group (order by geo_country) as country
    from pv_all where ip_org is not null group by ip_org
  )
  select jsonb_build_object(
    'kpis', admin_kpis(p_from, p_to),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'pageviews', coalesce(pvd.n, 0), 'enquiries', coalesce(enqd.n, 0), 'whatsapp', coalesce(wad.n, 0)) order by d.day)
      from days d left join pvd using (day) left join enqd using (day) left join wad using (day)
    ), '[]'::jsonb),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from chan where k <> 'internal'), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (select * from refs order by n desc, k limit 8) t), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc) from (select * from camps order by n desc, k limit 8) t), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (select coalesce(geo_country, '') as k, count(*) as n from pv group by 1 order by 2 desc limit 10) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (select coalesce(device, 'unknown') as k, count(*) as n from pv group by 1) t
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (select path as k, count(*) as n from pv where path is not null group by 1 order by 2 desc, 1 limit 10) t
    ), '[]'::jsonb),
    'products_viewed', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (select product as k, count(*) as n from pv where product is not null group by 1 order by 2 desc, 1 limit 10) t
    ), '[]'::jsonb),
    'products_enquired', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (
        select product as k, count(*) as n from leads
        where status = 'submitted' and not spam and product is not null and created_at >= p_from and created_at < p_to
        group by 1 order by 2 desc, 1 limit 10
      ) t
    ), '[]'::jsonb),
    'funnel', jsonb_build_object('viewed', (select count(*) from fa), 'opened', (select count(*) from fb), 'submitted', (select count(*) from fc)),
    'searches', jsonb_build_object(
      'total', (select count(*) from se),
      'with_results', (select count(*) from se where results > 0),
      'no_results', (select count(*) from se where results = 0),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('q', q, 'n', n, 'results', results) order by n desc, q)
        from (select q, count(*) as n, max(results) as results from se group by q order by 2 desc, 1 limit 40) t
      ), '[]'::jsonb)
    ),
    'orgs', coalesce((
      select jsonb_agg(jsonb_build_object('ip_org', ip_org, 'visitors', visitors, 'pageviews', pageviews, 'last_seen', last_seen, 'products', products, 'country', country) order by pageviews desc)
      from (select * from orgs order by pageviews desc, ip_org limit 150) t
    ), '[]'::jsonb)
  )
$$;

-- Data retention, matching the privacy policy: enquiry records up to 5 years after last contact,
-- page-view (event) records up to 24 months. Failed-admin-login events (they hold an IP) are only needed for the lockout, so 30 days.
-- leads.updated_at moves on every save from the site form, so it is the "last contact" clock. The admin activity log keeps 24 months.
create or replace function purge_old_data() returns void language sql set search_path = public as $$
  delete from events where type = 'admin_login_fail' and ts < now() - interval '30 days';
  delete from events where ts < now() - interval '24 months';
  delete from leads  where updated_at < now() - interval '5 years';
  delete from admin_audit where ts < now() - interval '24 months';
$$;

-- Only the server (service_role) may call these; public / anon / authenticated cannot.
revoke all on function host_of(text), traffic_channel(text, text, text), admin_kpis(timestamptz, timestamptz), admin_overview(timestamptz, timestamptz), purge_old_data()
  from public, anon, authenticated;
-- Server-only access, granted explicitly: new Supabase projects may not expose tables to the Data API by default.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant select, insert, update, delete on leads, events, admin_users, lead_notes, settings, admin_audit to service_role;
    grant select on v_org_activity, v_top_products, v_top_searches, v_daily to service_role;
    grant usage, select on all sequences in schema public to service_role;
    grant execute on function host_of(text), traffic_channel(text, text, text), admin_kpis(timestamptz, timestamptz), admin_overview(timestamptz, timestamptz), purge_old_data() to service_role;
  end if;
end $$;

-- purge_old_data() runs daily from the /api/cron/daily/ job (vercel.json). pg_cron is an optional extra:
--   select cron.schedule('purge-old-data', '0 3 * * *', 'select purge_old_data()');
--   select cron.unschedule('purge-old-data');   -- to remove it later
-- To run it by hand: select purge_old_data();

-- Make PostgREST pick up the new tables and functions immediately.
notify pgrst, 'reload schema';
