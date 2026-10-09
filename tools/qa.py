#!/usr/bin/env python3
"""Post-build quality gate over dist/client: SEO tags, structured data, links, images, CSP and legal rules.
Run after `npm run build`: `python3 tools/qa.py`. Exits 1 when anything fails (CI uses this).
Optional: pass the path of a JSON file with Tier-2 vendor names (never committed) as argv[1] to also scan for leaks."""
import glob, html, json, os, re, sys, collections

root = 'dist/client'
pages = sorted(glob.glob(f'{root}/**/*.html', recursive=True))
if not pages:
    sys.exit('no built pages in dist/client — run npm run build first')

vendors = set()
if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
    for entries in json.load(open(sys.argv[1])).values():
        vendors.update(e['vendor'] for e in entries if len(e.get('vendor', '')) >= 3)

titles = collections.Counter()
issues = collections.defaultdict(list)
for p in pages:
    rel = '/' + os.path.relpath(p, root).replace('index.html', '')
    s = open(p, encoding='utf-8').read()
    is404 = rel.startswith(('/404', '/ar/404'))
    t = re.search(r'<title>(.*?)</title>', s, re.S)
    t = html.unescape(t.group(1)) if t else ''
    titles[t] += 1
    if not t: issues['missing title'].append(rel)
    elif len(t) > 65: issues['title > 65 chars'].append((rel, len(t)))
    d = re.search(r'<meta name="description" content="([^"]*)"', s)
    d = html.unescape(d.group(1)) if d else ''
    if not d: issues['missing description'].append(rel)
    elif len(d) > 160: issues['description > 160 chars'].append((rel, len(d)))
    if not is404:
        if 'rel="canonical"' not in s: issues['missing canonical'].append(rel)
        if len(re.findall(r'hreflang="(en|ar|x-default)"', s)) < 3: issues['hreflang en/ar/x-default'].append(rel)
        if 'http-equiv="content-security-policy"' not in s: issues['missing CSP meta'].append(rel)
    og = re.search(r'property="og:image" content="([^"]+)"', s)
    if og and not os.path.exists(root + re.sub(r'^https?://[^/]+', '', og.group(1)).split('?')[0]):
        issues['og:image file missing'].append(rel)
    for m in re.finditer(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', s, re.S):
        try: json.loads(m.group(1))
        except ValueError: issues['invalid JSON-LD'].append(rel)
    if re.search(r'href="tel:|\+971\s?\d|\b0(50|52|54|55|56|58)\s?\d{3}', s): issues['phone number shown'].append(rel)
    if rel.startswith('/ar/') and not re.search(r'<html[^>]*lang="ar"[^>]*dir="rtl"', s): issues['ar page not lang=ar dir=rtl'].append(rel)
    if re.search(r'<(?!svg|path|g |rect|circle|line|polyline|polygon|stop|use)[a-z][a-z0-9]*\b[^>]*\sstyle="', s):
        issues['inline style attribute (blocked by CSP)'].append(rel)
    for m in re.finditer(r'<a\b[^>]*href="(https?://[^"]+)"[^>]*>', s):
        if 'alytechme.com' not in m.group(1) and not ('noopener' in m.group(0) and 'noreferrer' in m.group(0)):
            issues['external link without rel="noopener noreferrer"'].append((rel, m.group(1)))
    for m in re.finditer(r'href="(/[^"#?]*)', s):
        u = m.group(1)
        if u.startswith(('/api/', '/admin', '/ingest/')): continue
        if not os.path.exists(root + u + ('index.html' if u.endswith('/') else '')): issues['broken internal link'].append((rel, u))
    for m in re.finditer(r'<img\b[^>]*>', s):
        if not all(a in m.group(0) for a in ('width=', 'height=', 'alt=')): issues['img missing width/height/alt'].append((rel, m.group(0)[:80]))
    low = s.lower()
    for v in vendors:
        if re.search(r'(?<![a-z0-9])' + re.escape(v.lower()) + r'(?![a-z0-9])', low): issues['Tier-2 vendor name leaked'].append((rel, v))

# On the Cloudflare admin host (admin.alytechme.com) "/x/" means the admin route /admin/x/, but a public file at /x/ would be served first.
for name in os.listdir('src/pages/admin'):
    route = os.path.splitext(name)[0]
    if route != 'index' and os.path.exists(f'{root}/{route}/index.html'): issues['public page shadows an admin-host route'].append(f'/{route}/')

for t, n in titles.items():
    if t and n > 1: issues['duplicate title'].append((t, n))

print(f'{len(pages)} pages checked' + (f', {len(vendors)} vendor names scanned' if vendors else ''))
for k, v in issues.items():
    print(f'FAIL {k}: {len(v)}  e.g. {v[:3]}')
sys.exit(1 if issues else 0)
