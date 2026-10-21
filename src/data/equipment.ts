/**
 * Tier 2 — unbranded equipment categories. NEVER add vendor names, model numbers or vendor images here.
 * Typical spec *values* must never be rendered into page HTML: pages show labels only; values are
 * returned by /api/lead/ after the visitor submits an inquiry (see specsFor).
 */
import data from './equipment.json';
import renders from './equipment-images.json';

export interface Category {
  name: string; slug: string; summary: string; description: string;
  typicalSpecRanges: { label: string; value: string }[];
  variants: string[]; standards: string[]; applications: string[]; industries: string[];
  searchKeywords: string[]; faq: { q: string; a: string }[];
  ar?: Partial<{ name: string; summary: string; description: string; variants: string[]; applications: string[]; specLabels: string[]; specValues: string[]; faq: { q: string; a: string }[]; searchKeywords: string[] }>;
}
export interface Family { name: string; slug: string; intro: string; categories: Category[]; ar?: { name?: string; intro?: string } }

export const families = (data as { families: Family[] }).families;
export const categories = families.flatMap((f) => f.categories.map((c) => ({ family: f, category: c })));
export const categoryPath = (c: Pick<Category, 'slug'>) => `/equipment/${c.slug}/`;

/** Server-side only: the gated spec ranges for a category, by slug or display name; Arabic labels/values where translated. */
export const specsFor = (key: string, lang: 'en' | 'ar' = 'en') => {
  const c = categories.find(({ category: x }) => x.slug === key || x.name === key || x.ar?.name === key)?.category;
  if (!c) return null;
  if (lang !== 'ar') return c.typicalSpecRanges;
  const { specLabels = [], specValues = [] } = c.ar ?? {};
  return c.typicalSpecRanges.map((s, i) => ({ label: specLabels[i] || s.label, value: specValues[i] || s.value }));
};

/** Category photos, by slug. Empty since the generated renders were removed (owner's request, Oct 2026); real photographs go
 *  in equipment-images.json and appear on every card and page automatically. Never vendor photos (Tier 2). */
export const renderOf = (slug: string) => (renders as Record<string, { src: string; sm: string; w: number; h: number }>)[slug];
