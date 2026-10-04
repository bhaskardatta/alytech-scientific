#!/usr/bin/env python3
"""Copy researched catalog JSON into the site and mirror product images locally as WebP.

Usage: python3 tools/sync-catalog.py [brandSlug ...]   (default: every file in ../research/catalog)
Writes src/data/catalog/<brand>.json and public/images/products/<brand>/<product>.webp,
and records each image's size in src/data/catalog/images.json (needed for width/height attrs).
"""
import io, json, sys, pathlib, urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT.parent / 'research' / 'catalog'
OUT = ROOT / 'src' / 'data' / 'catalog'
IMG = ROOT / 'public' / 'images' / 'products'
OUT.mkdir(parents=True, exist_ok=True)
manifest_path = OUT / 'images.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (AlyTech catalog sync)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def short(brand, slug):
    for prefix in (brand + '-', brand.replace('-', '') + '-'):
        if slug.startswith(prefix):
            return slug[len(prefix):]
    return slug

files = [SRC / f'{b}.json' for b in sys.argv[1:]] or sorted(SRC.glob('*.json'))
for f in files:
    data = json.loads(f.read_text())
    brand = data['brandSlug']
    (IMG / brand).mkdir(parents=True, exist_ok=True)
    for p in data['products']:
        p['slug'] = short(brand, p['slug'])
        key = f'{brand}/{p["slug"]}'
        if key in manifest and (IMG / brand / f'{p["slug"]}.webp').exists():
            continue
        for url in p.get('imageUrls') or []:
            try:
                im = Image.open(io.BytesIO(fetch(url)))
                im = im.convert('RGBA') if im.mode in ('P', 'LA', 'RGBA') else im.convert('RGB')
                im.thumbnail((1200, 1200), Image.LANCZOS)
                dest = IMG / brand / f'{p["slug"]}.webp'
                im.save(dest, 'WEBP', quality=84, method=6)
                manifest[key] = {'src': f'/images/products/{brand}/{p["slug"]}.webp', 'w': im.width, 'h': im.height}
                print('ok  ', key, im.size)
                break
            except Exception as e:  # try the next candidate URL
                print('skip', key, url, e)
        else:
            print('NONE', key)
    (OUT / f'{brand}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))

manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
