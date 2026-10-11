#!/usr/bin/env python3
"""Copy researched catalog JSON into the site and mirror product images locally as WebP.

Usage: python3 tools/sync-catalog.py [--force] [brandSlug ...]   (default: every file in ../research/catalog)
Writes src/data/catalog/<brand>.json and public/images/products/<brand>/<product>.webp,
and records each image's size in src/data/catalog/images.json (needed for width/height attrs).

  --force      re-download images for the listed brands (default skips products that already have one)
  --selftest   run the border-trim self-check and exit

`imageUrls` are tried in order, first that works wins. An entry starting with `file:` is a local
file relative to research/ (e.g. `file:images/schmidt-haensch/varipol.jpg`), so photos downloaded
by hand can be dropped in without a URL.

Every image is auto-trimmed (transparent margins, uniform solid borders, thin frame lines on a flat
background), given an even ~4% white/transparent padding, then scaled to max 1200px.
"""
import io, json, sys, pathlib, urllib.request
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT.parent / 'research' / 'catalog'
OUT = ROOT / 'src' / 'data' / 'catalog'
IMG = ROOT / 'public' / 'images' / 'products'
OUT.mkdir(parents=True, exist_ok=True)
manifest_path = OUT / 'images.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

def fetch(url):
    if url.startswith('file:'):
        return (ROOT.parent / 'research' / url[5:]).read_bytes()
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (AlyTech catalog sync)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def trim(im, pad=0.04, tol=12):
    """Crop transparent margins + uniform borders/frames (judged from the corner pixels), then pad evenly."""
    im = im.convert('RGBA')
    opaque = im.getchannel('A').getextrema()[0] > 250
    bd = (255, 255, 255)  # backdrop: the last uniform layer peeled off (white for studio shots, dark for dark ones)
    for _ in range(6):  # each pass peels one layer: frame line, then the white behind it, ...
        w, h = im.size
        flat = Image.alpha_composite(Image.new('RGBA', im.size, 'white'), im).convert('RGB')
        box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        c = [flat.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
        uniform = all(max(abs(x - y) for x, y in zip(c[0], q)) <= tol for q in c)
        if uniform:
            d = ImageChops.difference(flat, Image.new('RGB', im.size, c[0])).convert('L')
            d = d.point(lambda v: 255 if v > tol else 0).getbbox()
            box = d if box is None else (max(box[0], d[0]), max(box[1], d[1]), min(box[2], d[2]), min(box[3], d[3])) if d else box
        if not box or box == (0, 0, w, h):
            break
        if uniform:
            bd = c[0]
        im = im.crop(box)
    p = round(max(im.size) * pad)
    # opaque photos are padded with their own backdrop colour, so a dark studio shot doesn't get a white frame
    fill = bd if opaque else (255, 255, 255, 0)
    out = Image.new('RGB' if opaque else 'RGBA', (im.width + 2 * p, im.height + 2 * p), fill)
    out.paste(im.convert(out.mode), (p, p))
    return out

def selftest():
    prod = Image.new('RGB', (100, 60), (30, 30, 120))
    for bg, frame in (((255, 255, 255), None), ((255, 255, 255), (150, 150, 150)), ((240, 240, 240), (200, 0, 0)), ((36, 36, 36), (255, 255, 255))):
        im = Image.new('RGB', (400, 300), frame or bg)
        if frame: im.paste(Image.new('RGB', (392, 292), bg), (4, 4))
        im.paste(prod, (150, 120))
        out = trim(im, pad=0.1)  # product 100x60, pad 10px each side
        assert out.size == (120, 80), (bg, frame, out.size)
        assert out.getpixel((60, 40)) == (30, 30, 120) and out.getpixel((0, 0)) == bg, (bg, out.getpixel((0, 0)))  # padded with its backdrop
    t = Image.new('RGBA', (400, 300), (0, 0, 0, 0)); t.paste(prod, (150, 120))
    out = trim(t, pad=0.1)
    assert out.size == (120, 80) and out.mode == 'RGBA' and out.getpixel((0, 0))[3] == 0
    full = Image.new('RGB', (100, 60), (30, 30, 120))  # product fills the frame: nothing to trim
    assert trim(full, pad=0).size == (100, 60)
    print('selftest ok')

if '--selftest' in sys.argv:
    selftest(); sys.exit()

def short(brand, slug):
    for prefix in (brand + '-', brand.replace('-', '') + '-'):
        if slug.startswith(prefix):
            return slug[len(prefix):]
    return slug

missing = []
force = '--force' in sys.argv
brands = [a for a in sys.argv[1:] if not a.startswith('--')]
files = [SRC / f'{b}.json' for b in brands] or sorted(SRC.glob('*.json'))
for f in files:
    data = json.loads(f.read_text())
    brand = data['brandSlug']
    (IMG / brand).mkdir(parents=True, exist_ok=True)
    for p in data['products']:
        p['slug'] = short(brand, p['slug'])
        key = f'{brand}/{p["slug"]}'
        if not force and key in manifest and (IMG / brand / f'{p["slug"]}.webp').exists():
            continue
        for url in p.get('imageUrls') or []:
            try:
                im = Image.open(io.BytesIO(fetch(url)))
                im = trim(im)
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
        if not (IMG / brand / f'{p["slug"]}.webp').exists():
            missing.append(key)
    (OUT / f'{brand}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))

# Products the catalog no longer lists drop out of the manifest; `opaque` marks photos shot on a solid white
# background (the site blends those into light stages instead of drawing a white box), `dark` a solid dark backdrop.
listed = {f'{json.loads(f.read_text())["brandSlug"]}/{short(json.loads(f.read_text())["brandSlug"], p["slug"])}' for f in sorted(SRC.glob('*.json')) for p in json.loads(f.read_text())['products']}
for key in [k for k in manifest if k not in listed]:
    del manifest[key]
def backdrop(path):
    """'white' or 'dark' when the photo sits on a solid opaque backdrop (judged from 8 edge points), else None."""
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    pts = [im.getpixel(q) for q in [(x, y) for x in (1, w // 2, w - 2) for y in (1, h - 2)] + [(1, h // 2), (w - 2, h // 2)]]
    if not all(px[3] == 255 for px in pts): return None
    if all(min(px[:3]) >= 235 for px in pts): return 'white'
    if all(max(px[:3]) <= 60 for px in pts): return 'dark'
    return None
def opaque_white(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    pts = [(x, y) for x in (1, w // 2, w - 2) for y in (1, h - 2)] + [(1, h // 2), (w - 2, h // 2)]
    return all(im.getpixel(q)[3] == 255 and min(im.getpixel(q)[:3]) >= 235 for q in pts)
for key, entry in manifest.items():
    entry.pop('opaque', None); entry.pop('dark', None)
    kind = backdrop(ROOT / 'public' / entry['src'].lstrip('/'))
    if kind == 'white': entry['opaque'] = True
    if kind == 'dark': entry['dark'] = True  # shown on a matching dark stage
manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
print('MISSING (no image):', *missing) if missing else print('all products have an image')
