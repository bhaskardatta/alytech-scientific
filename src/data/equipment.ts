/**
 * Tier 2 — unbranded equipment categories. NEVER add vendor names, model numbers or vendor images here.
 * Typical spec *values* must never be rendered into page HTML: pages show labels only; values are
 * returned by /api/lead/ after the visitor submits an inquiry (see specsFor).
 */
import data from './equipment.json';

export interface Category {
  name: string; slug: string; summary: string; description: string;
  typicalSpecRanges: { label: string; value: string }[];
  variants: string[]; standards: string[]; applications: string[]; industries: string[];
  searchKeywords: string[]; faq: { q: string; a: string }[];
  ar?: Partial<{ name: string; summary: string; description: string; variants: string[]; applications: string[]; specLabels: string[]; faq: { q: string; a: string }[] }>;
}
export interface Family { name: string; slug: string; intro: string; categories: Category[]; ar?: { name?: string; intro?: string } }

export const families = (data as { families: Family[] }).families;
export const categories = families.flatMap((f) => f.categories.map((c) => ({ family: f, category: c })));
export const categoryPath = (c: Pick<Category, 'slug'>) => `/equipment/${c.slug}/`;

/** Server-side only: the gated spec ranges for a category, by slug or display name. */
export const specsFor = (key: string) =>
  categories.find(({ category: c }) => c.slug === key || c.name === key)?.category.typicalSpecRanges ?? null;
