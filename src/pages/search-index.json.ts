import type { APIRoute } from 'astro';
import { allProducts, productPath, brandPath, shortName, imageOf } from '../data/catalog';
import { brands } from '../data/brands';
import { categories, categoryPath, renderOf } from '../data/equipment';
import { industries } from '../data/industries';
import { standards, standardPath } from '../data/standards';

/** Static client-side search index. Contains no gated spec values. `i` = thumbnail; `x` = the names and one-line focus of the
 *  industries an item is tagged for, so a sector phrase ("air quality") finds the instruments that serve it. */
const sectorWords = (slugs: string[] = []) =>
  industries.filter((i) => slugs.includes(i.slug)).flatMap((i) => [i.name.en, i.name.ar, i.line.en, i.line.ar]);
export const GET: APIRoute = () => {
  const entries = [
    ...allProducts().map(({ brand: b, product: p }) => ({
      u: productPath(b, p),
      en: { t: `${b.name} ${shortName(p)}`, s: p.category },
      ar: { t: `${b.name} ${shortName(p, 'ar')}`, s: p.ar?.category ?? p.category },
      k: [p.name, p.model, p.category, p.ar?.name, p.ar?.category, ...p.standards, ...p.searchKeywords, ...p.applications].filter(Boolean).join(' '),
      n: [p.name, p.ar?.name, p.category, p.ar?.category].filter(Boolean).join(' '),
      x: sectorWords(p.industries).join(' '),
      i: imageOf(b.slug, p.slug)?.src,
    })),
    ...categories.map(({ family: f, category: c }) => ({
      u: categoryPath(c),
      en: { t: c.name, s: f.name },
      ar: { t: c.ar?.name ?? c.name, s: f.ar?.name ?? f.name },
      k: [...c.searchKeywords, ...(c.ar?.searchKeywords ?? []), ...c.standards, ...c.variants, ...c.applications].join(' '),
      x: sectorWords(c.industries).join(' '),
      i: renderOf(c.slug)?.sm,
    })),
    ...brands.map((b) => ({ u: brandPath(b), en: { t: b.name, s: b.discipline.en }, ar: { t: b.name, s: b.discipline.ar }, k: b.discipline.en })),
    ...industries.map((i) => ({ u: `/industries/${i.slug}/`, en: { t: i.name.en, s: i.line.en }, ar: { t: i.name.ar, s: i.line.ar }, k: i.line.en })),
    // Test standards: found by method number or by what they measure.
    ...standards.map((s) => ({
      u: standardPath(s),
      en: { t: s.designation, s: s.title },
      ar: { t: s.designation, s: s.title },
      k: [s.summary.en, s.summary.ar, ...s.products.map((x) => `${x.brand.name} ${x.product.name}`)].join(' '),
    })),
    // Free calculators.
    { u: '/tools/gas-dilution-calculator/', en: { t: 'Gas dilution calculator', s: 'Free tool: ppm, %, ppb flows and concentrations' }, ar: { t: 'حاسبة تخفيف الغازات', s: 'أداة مجانية: التدفقات والتراكيز بوحدات ppm و% و ppb' }, k: 'gas dilution calculator mixer diluter ppm ppb dilution ratio zero gas calibration curve mass flow controller حاسبة تخفيف الغازات نسبة التخفيف' },
    { u: '/tools/ppm-to-mg-m3/', en: { t: 'ppm to mg/m³ converter', s: 'Free tool: gas concentration conversion' }, ar: { t: 'محوّل ppm إلى mg/m³', s: 'أداة مجانية: تحويل تراكيز الغازات' }, k: 'ppm to mg/m3 mg/m³ converter molar volume molar mass CO NO2 SO2 H2S NH3 emissions محوّل ppm ملغ' },
  ];
  return new Response(JSON.stringify(entries), { headers: { 'content-type': 'application/json' } });
};
