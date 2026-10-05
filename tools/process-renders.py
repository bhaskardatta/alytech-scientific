#!/usr/bin/env python3
"""Turn generated category renders into site assets.

Input: a text file of "<index> <url>" lines, where index is the category's position in
src/data/equipment.json (families flattened in order). Writes public/images/equipment/<slug>.webp
and src/data/equipment-images.json (src/w/h per slug).
Usage: python3 tools/process-renders.py path/to/urls.txt
"""
import io, json, sys, pathlib, urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
slugs = [c['slug'] for f in json.loads((ROOT / 'src/data/equipment.json').read_text())['families'] for c in f['categories']]
out = ROOT / 'public/images/equipment'; out.mkdir(parents=True, exist_ok=True)
man_path = ROOT / 'src/data/equipment-images.json'
manifest = json.loads(man_path.read_text()) if man_path.exists() else {}

for line in pathlib.Path(sys.argv[1]).read_text().split('\n'):
    if not line.strip():
        continue
    i, url = line.split()
    slug = slugs[int(i)]
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert('RGB')
    im.thumbnail((1200, 1200), Image.LANCZOS)
    im.save(out / f'{slug}.webp', 'WEBP', quality=82, method=6)
    sm = im.copy(); sm.thumbnail((480, 480), Image.LANCZOS)
    sm.save(out / f'{slug}-sm.webp', 'WEBP', quality=80, method=6)
    manifest[slug] = {'src': f'/images/equipment/{slug}.webp', 'sm': f'/images/equipment/{slug}-sm.webp', 'w': im.width, 'h': im.height}
    print('ok', i, slug, im.size)

man_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
print(len(manifest), 'renders in manifest')
