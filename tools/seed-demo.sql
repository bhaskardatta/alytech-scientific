-- ============================================================================================================
-- DEMO DATA - fake people, example.com emails, for LOCAL/DEV demos ONLY.
-- NEVER run this on the production database.
-- ============================================================================================================
-- Targets supabase/schema.sql. ~90 days of events ending today (always relative to now()), 60 leads,
-- ~60 WhatsApp clicks. Creates no admin_users and no lead_notes. Run again = does nothing (guard below).
--   psql -v ON_ERROR_STOP=1 -d alytech -f tools/seed-demo.sql
do $seed$
begin
  if exists (select 1 from leads where name like 'Demo Lead%') then
    raise notice 'demo seed already applied - skipping';
    return;
  end if;

  perform setseed(0.42);

  -- ---------- helpers (session-local, vanish at disconnect) ----------------------------------------
  -- a timestamp d days ago inside the Dubai working day (bell around 13:00, ~10% evening), never in the future
  create function pg_temp.dubai_ts(d int) returns timestamptz language sql volatile as $f$
    select least(
      (((now() at time zone 'Asia/Dubai')::date - d)::timestamp
        + make_interval(secs => case when random() < 0.1 then 19*3600 + random()*4*3600
                                     else 7*3600 + ((random() + random()) / 2) * 11*3600 end)) at time zone 'Asia/Dubai',
      now() - random() * interval '3 hours')
  $f$;
  -- days-ago with a mild skew toward recent (the upward trend)
  create function pg_temp.recent_day() returns int language sql volatile as $f$
    select floor(89 * power(random(), 1.25))::int
  $f$;
  create function pg_temp.pick_cc(r float8) returns text language sql immutable as $f$
    select case when r < .62 then 'AE' when r < .72 then 'SA' when r < .78 then 'QA' when r < .82 then 'OM'
                when r < .86 then 'KW' when r < .91 then 'EG' when r < .95 then 'IN' when r < .98 then 'FR' else 'US' end
  $f$;
  create function pg_temp.cc_name(cc text) returns text language sql immutable as $f$
    select case cc when 'AE' then 'United Arab Emirates' when 'SA' then 'Saudi Arabia' when 'QA' then 'Qatar' when 'OM' then 'Oman'
                   when 'KW' then 'Kuwait' when 'EG' then 'Egypt' when 'IN' then 'India' when 'FR' then 'France' else 'United States' end
  $f$;
  create function pg_temp.pick_city(cc text, r float8) returns text language sql immutable as $f$
    select cities[1 + floor(power(r, 1.5) * array_length(cities, 1))::int]
    from (values ('AE', array['Abu Dhabi','Dubai','Sharjah','Al Ain','Ras Al Khaimah']), ('SA', array['Riyadh','Jeddah','Dammam']),
                 ('QA', array['Doha']), ('OM', array['Muscat','Sohar']), ('KW', array['Kuwait City']), ('EG', array['Cairo','Alexandria']),
                 ('IN', array['Mumbai','Delhi','Chennai']), ('FR', array['Paris','Lyon']), ('US', array['Houston','New York'])) v(c, cities)
    where c = cc
  $f$;
  create function pg_temp.pick_org(cc text, r float8) returns text language sql immutable as $f$
    select orgs[1 + floor(power(r, 1.2) * array_length(orgs, 1))::int]
    from (values
      ('AE', array['AS8966 Emirates Telecommunications Group (Etisalat)','AS15802 Emirates Integrated Telecommunications Company (du)','AS16509 Amazon.com, Inc.',
                   'AS64500 Demo Petrochem Co','AS64501 Demo Cement Labs LLC','AS64502 Demo University Research Network','AS64503 Demo Pharma Labs FZ-LLC']),
      ('SA', array['AS64504 Demo Saudi Telecom Network','AS64505 Demo Gulf Refining Co']),
      ('QA', array['AS64506 Demo Qatar Telecom Network','AS64507 Demo Energy Services Qatar']),
      ('OM', array['AS64508 Demo Oman Telecom Network']),
      ('KW', array['AS64509 Demo Kuwait Telecom Network']),
      ('EG', array['AS64510 Demo Egypt Telecom Network','AS64511 Demo Cairo Materials Institute']),
      ('IN', array['AS64512 Demo India Broadband','AS16509 Amazon.com, Inc.']),
      ('FR', array['AS64513 Demo France Telecom Network']),
      ('US', array['AS16509 Amazon.com, Inc.','AS64514 Demo US Hosting'])) v(c, orgs)
    where c = cc
  $f$;

  -- ---------- lookup tables ------------------------------------------------------------------------
  -- pages + weights (hi = running total; pick = first row with hi > random * total)
  create temp table _pages on commit drop as
  select t.*, sum(w) over (order by idx) as hi
  from (values
    (1,  '/',                                              'AlyTech Scientific | Laboratory and materials testing equipment', null,                    null,                null,                          20),
    (2,  '/gasmix/',                                       'GasMix by AlyTech',                                               null,                    null,                null,                          12),
    (3,  '/gasmix/aiolos-iii/',                            'GasMix Aiolos III',                                               'GasMix Aiolos III',     'GasMix',            'Gas mixers',                  10),
    (4,  '/gasmix/zephyr-ii/',                             'GasMix Zephyr II',                                                'GasMix Zephyr II',      'GasMix',            'Gas mixers',                   7),
    (5,  '/principals/thermtest/',                         'Thermtest',                                                       null,                    null,                null,                           5),
    (6,  '/principals/thermtest/mp-1/',                    'Thermtest MP-1',                                                  'Thermtest MP-1',        'Thermtest',         'Thermal conductivity',         5),
    (7,  '/principals/ducom/te-77/',                       'Ducom TE-77',                                                     'Ducom TE-77',           'Ducom',             'Tribology',                    4),
    (8,  '/principals/instrotek/pavetest/',                'InstroTek Pavetest',                                              'InstroTek Pavetest',    'InstroTek',         'Asphalt and pavement testing', 4),
    (9,  '/principals/vinci-technologies/core-analysis/',  'Vinci Core Analysis',                                             'Vinci Core Analysis',   'Vinci Technologies','Core analysis',                4),
    (10, '/equipment/',                                    'Equipment',                                                       null,                    null,                null,                           9),
    (11, '/industries/oil-gas/',                           'Oil and gas',                                                     null,                    null,                null,                           6),
    (12, '/contact/',                                      'Contact',                                                         null,                    null,                null,                           5),
    (13, '/ar/',                                           'AlyTech Scientific',                                              null,                    null,                null,                           7),
    (14, '/ar/gasmix/',                                    'GasMix',                                                          null,                    null,                null,                           3)
  ) t(idx, path, title, product, brand, category, w);

  create temp table _prod on commit drop as
  select idx, path, title, product, brand, category, sum(w) over (order by idx) as hi
  from _pages where product is not null;

  create temp table _q on commit drop as
  select t.*, sum(w) over (order by idx) as hi
  from (values (1,'viscometer',3,9), (2,'gas mixer',4,8), (3,'thermal conductivity',2,5), (4,'tribometer',1,3), (5,'penetrometer',2,3),
               (6,'asphalt',3,4), (7,'rheometer',2,3), (8,'bomb calorimeter',0,4), (9,'karl fischer',0,3), (10,'xrd',0,3), (11,'flash point',0,2)
  ) t(idx, q, results, w);

  -- ~150 returning visitors, each with a fixed country / city / network / device
  create temp table _vis on commit drop as
  select n, 'v-demo-' || lpad(n::text, 3, '0') as vid, cc,
         pg_temp.pick_city(cc, rci) as city, pg_temp.pick_org(cc, ro) as org,
         case when rd < .5 then 'desktop' when rd < .88 then 'mobile' else 'tablet' end as device
  from (select n, pg_temp.pick_cc(random()) as cc, random() as rci, random() as ro, random() as rd from generate_series(1, 150) n) s;

  -- ---------- pageviews: weekday-heavy, rising ~70% -> 120% of baseline over the 90 days -------------
  create temp table _days on commit drop as
  select d, (now() at time zone 'Asia/Dubai')::date - d as day,
         greatest(2, round(41.7
           * (case when extract(isodow from (now() at time zone 'Asia/Dubai')::date - d) in (6, 7) then 0.35 else 1 end)
           * (0.7 + 0.5 * (89 - d) / 89.0)
           * (0.85 + 0.3 * random())))::int as n
  from generate_series(0, 89) d;

  create temp table _pvb on commit drop as
  select dd.d, pg_temp.dubai_ts(dd.d) as ts,
         random() as ra, random() as rv, random() as rp, random() as rr, random() as ru, random() as rd, random() as rc, random() as rx
  from _days dd cross join lateral generate_series(1, dd.n) g;

  insert into events (ts, type, visitor_id, session_id, path, title, product, referrer, lang, ip_org, geo_country, geo_city, device, anon, data)
  select b.ts, 'pageview',
         case when not x.anon then v.vid end,
         case when not x.anon then 's-demo-' || lpad(v.n::text, 3, '0') || '-' || b.d end,
         p.path,
         case when not x.anon then p.title end,
         p.product,
         case
           when x.anon then case when b.rr < .60 then null when b.rr < .88 then 'google.com' when b.rr < .93 then 'bing.com' when b.rr < .97 then 'linkedin.com' else 'example-partner.com' end
           when x.utm = 'google'   then 'https://www.google.com/'
           when x.utm = 'linkedin' then 'https://www.linkedin.com/'
           when b.rr < .38 then null
           when b.rr < .64 then 'https://www.google.com/'
           when b.rr < .69 then 'https://www.bing.com/'
           when b.rr < .77 then 'https://www.linkedin.com/'
           when b.rr < .82 then 'https://l.facebook.com/'
           when b.rr < .88 then 'https://www.example-partner.com/links'
           else 'https://www.alytechme.com/gasmix/'
         end,
         case when p.path like '/ar/%' or p.path = '/ar/' then 'ar' else 'en' end,
         case when not x.anon then v.org end,
         case when x.anon then pg_temp.pick_cc(b.rc) else v.cc end,
         case when not x.anon then v.city end,
         case when x.anon then case when b.rd < .45 then 'desktop' when b.rd < .88 then 'mobile' else 'tablet' end else v.device end,
         x.anon,
         case
           when x.anon then null
           when b.rx < .007 then '{"dup": true}'::jsonb                                  -- the copy re-sent when a visitor clicks Accept
           when x.utm = 'google'   then '{"utm_source":"google","utm_medium":"cpc","utm_campaign":"adipec-2026"}'::jsonb
           when x.utm = 'linkedin' then '{"utm_source":"linkedin","utm_medium":"social","utm_campaign":"gasmix-launch"}'::jsonb
         end
  from _pvb b
  cross join lateral (select b.ra < .25 as anon,
                             case when b.ru < .03 + .08 * (89 - b.d) / 89.0 then 'google' when b.ru < .03 + .08 * (89 - b.d) / 89.0 + .04 then 'linkedin' end as utm) x
  join lateral (select * from _pages where hi > b.rp * (select max(hi) from _pages) order by hi limit 1) p on true
  join _vis v on v.n = 1 + floor(power(b.rv, 1.4) * 150)::int;

  -- ---------- WhatsApp clicks (60) -------------------------------------------------------------------
  create temp table _wa on commit drop as
  select s.n, s.ts, s.vis_n, v.vid, p.path, p.product, p.brand, p.category,
         case when s.vis_n is not null then v.cc else pg_temp.pick_cc(s.rc) end as cc,
         case when s.vis_n is not null then v.city end as city,
         case when s.vis_n is not null then v.org else null end as vorg,
         s.ru, s.rco,
         upper(substr(md5('demo-wa-' || s.n), 1, 5)) as ref
  from (select n, pg_temp.dubai_ts(pg_temp.recent_day()) as ts,
               case when n in (7, 19) or random() < .55 then 1 + floor(random() * 150)::int end as vis_n,
               random() as rp, random() as rc, random() as ru, random() as rco
        from generate_series(1, 60) n) s
  join lateral (select * from _prod where hi > s.rp * (select max(hi) from _prod) order by hi limit 1) p on true
  left join _vis v on v.n = s.vis_n;

  insert into events (ts, type, visitor_id, session_id, path, title, product, referrer, lang, ip_org, geo_country, geo_city, device, anon, data)
  select w.ts, 'whatsapp', w.vid, case when w.vid is not null then 's-demo-' || lpad(w.vis_n::text, 3, '0') || '-wa' || w.n end,
         w.path, null, w.product, null, 'en',
         coalesce(w.vorg, pg_temp.pick_org(w.cc, w.rco)), w.cc, w.city, null, false,
         jsonb_build_object('ref', w.ref, 'product', w.product, 'brand', w.brand, 'category', w.category, 'ph', 'demo-session-' || w.n)
           || case when w.ru < .20 then '{"attribution":{"utm_source":"google","utm_medium":"cpc","utm_campaign":"adipec-2026"}}'::jsonb
                   when w.ru < .33 then '{"attribution":{"utm_source":"linkedin","utm_medium":"social","utm_campaign":"gasmix-launch"}}'::jsonb
                   else '{}'::jsonb end
  from _wa w;

  -- ---------- leads (60): 48 submitted + 12 partial ---------------------------------------------------
  -- i 1-6 won, 7-10 lost, 11-22 quoted, 23-40 contacted, 41-48 new (46-48 spam), 49-60 partial (new)
  create temp table _ld on commit drop as
  select i,
         case when i <= 6 then 'won' when i <= 10 then 'lost' when i <= 22 then 'quoted' when i <= 40 then 'contacted' else 'new' end as stage,
         i <= 48 as submitted,
         i in (46, 47, 48) as spam,
         random() as r_d, random() as r_m, random() as r_p, random() as r_v, random() as r_vn, random() as r_l, random() as r_a, random() as r_r,
         random() as r_c, random() as r_ci, random() as r_o, random() as r_t, random() as r_val, random() as r_u, random() as r_x, random() as r_con
  from generate_series(1, 60) i;

  insert into leads (lead_key, status, mode, name, company, email, phone, country, message, product, brand, category, marketing_consent, lang, path,
                     referrer, landing_page, attribution, ph_session, visitor_id, session_id, ip, ip_org, geo_country, geo_city, user_agent, handled,
                     stage, value_aed, follow_up, lost_reason, spam, tags, wa_ref, won_at, created_at, updated_at)
  select gen_random_uuid(),
         case when l.submitted then 'submitted' else 'partial' end,
         case when w.n is not null then 'whatsapp'
              when not l.submitted then case when l.r_m < .5 then 'quote' when l.r_m < .8 then 'price' else 'datasheet' end
              else case when l.r_m < .40 then 'quote' when l.r_m < .60 then 'price' when l.r_m < .75 then 'datasheet' when l.r_m < .87 then 'specs' else 'interest' end end,
         case when l.i in (52, 57, 60) then null else 'Demo Lead ' || lpad(l.i::text, 2, '0') end,
         case when not l.submitted then null
              when l.spam then 'Demo Spam Co'
              else (array['Demo Petrochem Co','Demo Cement Labs LLC','Demo University Research','Demo Pharma Labs','Demo Materials Testing',
                          'Demo Gulf Refining Co','Demo Asphalt Works','Demo Food Safety Lab','Demo Environmental Services','Demo Construction Materials'])[1 + (l.i % 10)] end,
         'demo' || lpad(l.i::text, 2, '0') || '@example.com',
         case when not l.submitted and l.i % 2 = 0 then null else '+97150000' || lpad(l.i::text, 4, '0') end,
         pg_temp.cc_name(g.cc),
         case when not l.submitted then null
              when l.spam then 'Demo spam: cheap SEO packages, visit example.com/seo'
              else 'Demo enquiry (' || case when w.n is not null then 'whatsapp' else 'form' end || ') about ' || p.product || '. Fake data for local testing.' end,
         p.product, p.brand, p.category,
         l.submitted and l.r_con < .3,
         case when l.r_l < .15 then 'ar' else 'en' end,
         case when l.r_l < .15 then '/ar' || p.path else p.path end,
         case when l.attr is not null and l.attr = 'google' then 'https://www.google.com/'
              when l.attr is not null then 'https://www.linkedin.com/'
              when l.r_r < .35 then null when l.r_r < .65 then 'https://www.google.com/' when l.r_r < .80 then 'https://www.bing.com/' else 'https://www.example-partner.com/links' end,
         case l.attr when 'google' then '/gasmix/?utm_source=google&utm_medium=cpc&utm_campaign=adipec-2026'
                     when 'linkedin' then '/gasmix/?utm_source=linkedin&utm_medium=social&utm_campaign=gasmix-launch' end,
         case l.attr when 'google' then '{"utm_source":"google","utm_medium":"cpc","utm_campaign":"adipec-2026"}'::jsonb
                     when 'linkedin' then '{"utm_source":"linkedin","utm_medium":"social","utm_campaign":"gasmix-launch"}'::jsonb end,
         case when l.i % 7 = 0 then 'demo-session-' || (100 + l.i) end,
         v.vid,
         case when v.vid is not null then 's-demo-' || lpad(v.n::text, 3, '0') || '-' || c.d end,
         ('203.0.113.' || (1 + l.i % 250))::inet,
         coalesce(v.org, pg_temp.pick_org(g.cc, l.r_o)),
         g.cc,
         coalesce(v.city, pg_temp.pick_city(g.cc, l.r_ci)),
         (array['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'])[1 + (l.i % 3)],
         l.stage <> 'new',
         l.stage,
         case l.stage when 'won' then round((15000 + l.r_val * 165000)::numeric, -2)
                      when 'quoted' then round((20000 + l.r_val * 100000)::numeric, -2) end,
         (now() at time zone 'Asia/Dubai')::date + (array[-3,-1,0,0,2,4,7,-5,1,12])[array_position(array[12,15,17,20,24,27,30,33,36,38], l.i)],
         case when l.stage = 'lost' then (array['Went with another supplier','Budget not approved','Project cancelled','No response after quote'])[1 + (l.i % 4)] end,
         l.spam,
         case when l.spam or l.r_t < .45 then '{}'::text[]
              else string_to_array((array['oil-gas,priority','construction','pharma','academia,follow-up','oil-gas','priority,repeat-customer','food-beverage'])[1 + floor(l.r_t * 7)::int % 7], ',') end,
         w.ref,
         c.won_at,
         c.created_at,
         case when l.stage = 'won' then c.won_at
              when l.stage = 'lost' then least(c.created_at + (1 + l.r_x * 20) * interval '1 day', now())
              when l.submitted and l.stage <> 'new' then least(c.created_at + (0.2 + l.r_x * 14) * interval '1 day', now())
              when l.submitted then least(c.created_at + l.r_x * interval '2 hours', now())
              else least(c.created_at + l.r_x * interval '10 minutes', now()) end
  from (select _ld.*,
               case when not _ld.spam and _ld.submitted and _ld.r_a < .35 then case when _ld.r_x < .6 then 'google' else 'linkedin' end end as attr,
               case when _ld.i = 15 then 7 when _ld.i = 30 then 19 end as wa_n   -- two leads that came from a WhatsApp click
        from _ld) l
  left join _wa w on w.n = l.wa_n
  join lateral (select * from _prod where hi > l.r_p * (select max(hi) from _prod) order by hi limit 1) p0 on true
  join lateral (select coalesce(w.path, p0.path) as path, coalesce(w.product, p0.product) as product,
                       coalesce(w.brand, p0.brand) as brand, coalesce(w.category, p0.category) as category) p on true
  left join _vis v on v.n = coalesce(w.vis_n, case when not l.spam and l.r_v < .75 then 1 + floor(l.r_vn * 150)::int end)
  join lateral (select coalesce(v.cc, pg_temp.pick_cc(l.r_c)) as cc) g on true
  join lateral (
    select z.d, z.created_at,
           case when l.stage = 'won' then least(z.created_at + (3 + l.r_u * 25) * interval '1 day', now() - interval '1 hour') end as won_at
    from (select s.d, case when w.n is not null then least(w.ts + interval '2 minutes', now()) else pg_temp.dubai_ts(s.d) end as created_at
          from (select case l.stage when 'won'  then 15 + floor(l.r_d * 74)::int
                                    when 'lost' then 10 + floor(l.r_d * 79)::int
                                    else floor(89 * power(l.r_d, 1.25))::int end as d) s) z
  ) c on true;

  -- lead_open for every lead that carries a visitor id (so the funnel cohort is non-empty) ...
  insert into events (ts, type, visitor_id, session_id, path, title, product, referrer, lang, ip_org, geo_country, geo_city, device, anon, data)
  select l.created_at - (1 + random() * 6) * interval '1 minute', 'lead_open', l.visitor_id, l.session_id, l.path, null, l.product, null, l.lang,
         l.ip_org, l.geo_country, l.geo_city, null, false,
         jsonb_build_object('mode', l.mode, 'product', l.product)
  from leads l where l.visitor_id like 'v-demo-%';

  -- ... plus ~90 more that never turned into a lead
  insert into events (ts, type, visitor_id, session_id, path, title, product, referrer, lang, ip_org, geo_country, geo_city, device, anon, data)
  select s.ts, 'lead_open', v.vid, 's-demo-' || lpad(v.n::text, 3, '0') || '-lo' || s.n, p.path, null, p.product, null, 'en', v.org, v.cc, v.city, null, false,
         jsonb_build_object('mode', case when s.rm < .55 then 'quote' when s.rm < .75 then 'price' when s.rm < .90 then 'datasheet' else 'specs' end, 'product', p.product)
  from (select n, pg_temp.dubai_ts(pg_temp.recent_day()) as ts, random() as rp, random() as rm, 1 + floor(random() * 150)::int as vn from generate_series(1, 90) n) s
  join lateral (select * from _prod where hi > s.rp * (select max(hi) from _prod) order by hi limit 1) p on true
  join _vis v on v.n = s.vn;

  -- ---------- searches (~110; a mix of hits and zero-result queries) ----------------------------------
  insert into events (ts, type, visitor_id, session_id, path, title, product, referrer, lang, ip_org, geo_country, geo_city, device, anon, data)
  select s.ts, 'search', v.vid, 's-demo-' || lpad(v.n::text, 3, '0') || '-se' || s.n, case when s.rp < .5 then '/' else '/equipment/' end, null, null, null, 'en',
         v.org, v.cc, v.city, null, false, jsonb_build_object('q', q.q, 'results', q.results)
  from (select n, pg_temp.dubai_ts(pg_temp.recent_day()) as ts, random() as rq, random() as rp, 1 + floor(random() * 150)::int as vn from generate_series(1, 110) n) s
  join lateral (select * from _q where hi > s.rq * (select max(hi) from _q) order by hi limit 1) q on true
  join _vis v on v.n = s.vn;

  raise notice 'demo seed applied: % events, % leads', (select count(*) from events), (select count(*) from leads);
end
$seed$;
