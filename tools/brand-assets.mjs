// Regenerates the raster brand assets from public/favicon.svg and the site's own typefaces:
//   favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og/default.png, og/default-ar.png
// Run from alytech-scientific/:  node tools/brand-assets.mjs   (needs network for the Google Fonts CSS, and Chrome for the OG cards)
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pub = resolve('public');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const svg = readFileSync(join(pub, 'favicon.svg'));

// ---------- icons (emblem only) ----------
const emblem = (size, bg, pad = 0) =>
  sharp(svg, { density: 600 })
    .resize(Math.round(size * (1 - pad * 2)), Math.round(size * (1 - pad * 2)))
    .extend({ top: Math.round(size * pad), bottom: Math.round(size * pad), left: Math.round(size * pad), right: Math.round(size * pad), background: bg })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const white = { r: 255, g: 255, b: 255, alpha: 1 };
writeFileSync(join(pub, 'apple-touch-icon.png'), await emblem(180, white, 0.16));
writeFileSync(join(pub, 'icon-192.png'), await emblem(192, clear, 0.04));
writeFileSync(join(pub, 'icon-512.png'), await emblem(512, clear, 0.04));

// ICO = header + directory + PNG payloads (16, 32, 48)
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => emblem(s, clear, 0.03)));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const o = 6 + i * 16;
  head[o] = s; head[o + 1] = s;
  head.writeUInt16LE(1, o + 4); // planes
  head.writeUInt16LE(32, o + 6); // bpp
  head.writeUInt32LE(pngs[i].length, o + 8);
  head.writeUInt32LE(offset, o + 12);
  offset += pngs[i].length;
});
writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([head, ...pngs]));

// ---------- Open Graph cards (1200x630): headless Chrome renders real Archivo / Kufi / Plex ----------
// Same string-art maths as src/components/Ribbon.astro, so the card carries the GasMix motif.
function ribbon(w, h, mirror) {
  const bands = [{ c: 0.42, amp: 0.2, k: 1.1, ph: 0.6 }, { c: 0.6, amp: 0.16, k: 1.7, ph: 2.4 }];
  const lines = 30, steps = 120;
  let out = '';
  for (const b of bands) {
    for (let j = 0; j < lines; j++) {
      const s = (j / (lines - 1)) * 2 - 1;
      let d = '';
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = (mirror ? 1 - t : t) * w;
        const y = (b.c + s * b.amp * Math.sin(b.k * Math.PI * t * 2 + b.ph)) * h;
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      out += `<path d="${d}" stroke="#8f6cf5" stroke-width="1" fill="none" opacity="${(0.75 - Math.abs(s) * 0.6).toFixed(2)}"/>`;
    }
  }
  return `<svg class="ribbon" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${out}</svg>`;
}

const logo = `file://${join(pub, 'brand', 'logo-light-192.png')}`;
const fonts = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=JetBrains+Mono:wght@500&family=Noto+Kufi+Arabic:wght@700&family=IBM+Plex+Sans+Arabic:wght@500&display=block';
const card = (ar) => `<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><link rel="stylesheet" href="${fonts}"><style>
  *{box-sizing:border-box;margin:0}
  html,body{width:1200px;height:630px;overflow:hidden;background:#0f172a;color:#fff}
  .ribbon{position:absolute;inset-block:0;${ar ? 'left' : 'right'}:0;width:640px;height:630px}
  .ribbon{mask-image:linear-gradient(to ${ar ? 'right' : 'left'},#000 55%,transparent)}
  .card{position:absolute;inset:0;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
  img{width:94px;height:96px;display:block}
  .label{font:500 22px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#b9a3ff}
  h1{max-width:${ar ? 820 : 700}px;font:600 68px/1.06 ${ar ? '"Noto Kufi Arabic"' : '"Archivo"'},sans-serif;${ar ? 'font-weight:700;line-height:1.4;' : 'font-variation-settings:"wdth" 112;letter-spacing:-.02em;'}}
  .foot{display:flex;justify-content:space-between;align-items:end;font:500 22px "JetBrains Mono",monospace;letter-spacing:.06em;color:#b9a3ff}
  .bar{width:72px;height:6px;background:#6000cd;margin-bottom:28px}
</style></head><body>
  ${ribbon(640, 630, ar)}
  <div class="card">
    <img src="${logo}" width="94" height="96" alt="">
    <div><div class="bar"></div><h1>${ar ? 'أجهزة دقيقة لمختبرات الشرق الأوسط' : 'Precision instruments for Middle East laboratories'}</h1></div>
    <div class="foot"><span>ALYTECH SCIENTIFIC · ABU DHABI</span><span>www.alytechme.com</span></div>
  </div>
</body></html>`;

if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME_PATH)`);
mkdirSync(join(pub, 'og'), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'og-'));
for (const [name, ar] of [['default', false], ['default-ar', true]]) {
  const html = join(tmp, `${name}.html`);
  const shot = join(tmp, `${name}.png`);
  writeFileSync(html, card(ar));
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=15000', `--screenshot=${shot}`, `file://${html}`], { stdio: 'ignore' });
  // palette PNG: flat colours + hairlines compress to well under 100 KB
  await sharp(shot).resize(1200, 630, { fit: 'cover', position: 'top' }).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(join(pub, 'og', `${name}.png`));
}
console.log('brand assets written to public/');
