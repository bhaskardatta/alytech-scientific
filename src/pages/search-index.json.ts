import type { APIRoute } from 'astro';
import { allProducts, productPath, brandPath, shortName } from '../data/catalog';
import { brands } from '../data/brands';
import { categories, categoryPath } from '../data/equipment';
import { industries } from '../data/industries';

/** Static client-side search index. Contains no gated spec values. */
export const GET: APIRoute = () => {
  const entries = [
    ...allProducts().map(({ brand: b, product: p }) => ({
      u: productPath(b, p),
      en: { t: `${b.name} ${shortName(p)}`, s: p.category },
      ar: { t: `${b.name} ${shortName(p)}`, s: p.ar?.category ?? p.category },
      k: [p.name, p.model, p.category, p.ar?.category, ...p.standards, ...p.searchKeywords, ...p.applications].filter(Boolean).join(' '),
    })),
    ...categories.map(({ family: f, category: c }) => ({
      u: categoryPath(c),
      en: { t: c.name, s: f.name },
      ar: { t: c.ar?.name ?? c.name, s: f.ar?.name ?? f.name },
      k: [...c.searchKeywords, ...(c.ar?.searchKeywords ?? []), ...c.standards, ...c.variants, ...c.applications].join(' '),
    })),
    ...brands.map((b) => ({ u: brandPath(b), en: { t: b.name, s: b.discipline.en }, ar: { t: b.name, s: b.discipline.ar }, k: b.discipline.en })),
    ...industries.map((i) => ({ u: `/industries/${i.slug}/`, en: { t: i.name.en, s: i.line.en }, ar: { t: i.name.ar, s: i.line.ar }, k: i.line.en })),
  ];
  return new Response(JSON.stringify(entries), { headers: { 'content-type': 'application/json' } });
};
