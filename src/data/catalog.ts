/** Principal (Tier 1) product catalog — JSON synced from /research by tools/sync-catalog.py. */
import images from './catalog/images.json';
import { brands, type Brand } from './brands';

export interface Spec { label: string; value: string }
export interface Product {
  name: string;
  model?: string;
  slug: string;
  category: string;
  priority: 'flagship' | 'core' | 'niche';
  summary: string;
  description: string;
  keySpecs: Spec[];
  standards: string[];
  applications: string[];
  industries: string[];
  searchKeywords: string[];
  whyMiddleEast?: string;
  datasheetUrl?: string | null;
  /** Arabic overrides, filled in by the translation pass. */
  ar?: Partial<Pick<Product, 'name' | 'category' | 'summary' | 'description' | 'applications'>>;
}
interface BrandFile { brandSlug: string; brandSummary: string; brandSummaryAr?: string; headquarters: string; products: Product[] }

const files = import.meta.glob<BrandFile>('./catalog/*.json', { eager: true, import: 'default' });
const byBrand = new Map<string, BrandFile>();
for (const [path, file] of Object.entries(files)) if (!path.endsWith('images.json')) byBrand.set(file.brandSlug, file);

const rank = { flagship: 0, core: 1, niche: 2 } as const;

export const brandInfo = (slug: string) => byBrand.get(slug);
export const productsOf = (brand: string) =>
  [...(byBrand.get(brand)?.products ?? [])].sort((a, b) => rank[a.priority] - rank[b.priority]);

export const allProducts = () =>
  brands.flatMap((b) => productsOf(b.slug).map((p) => ({ brand: b, product: p })));

/** GasMix lives at /gasmix/, everything else under /principals/<brand>/. */
export const brandPath = (b: Pick<Brand, 'slug'>) => (b.slug === 'gasmix' ? '/gasmix/' : `/principals/${b.slug}/`);
export const productPath = (b: Pick<Brand, 'slug'>, p: Pick<Product, 'slug'>) => `${brandPath(b)}${p.slug}/`;

export const imageOf = (brand: string, slug: string) =>
  (images as Record<string, { src: string; w: number; h: number; opaque?: boolean; dark?: boolean }>)[`${brand}/${slug}`];

/** Short display name: "Aiolos III Gas Mixer and Gas Diluter" -> "Aiolos III" when a model code exists.
 *  Arabic names keep the English shape (model first), so the same rule applies to them. */
export const shortName = (p: Product, lang: 'en' | 'ar' = 'en') => {
  const name = (lang === 'ar' && p.ar?.name) || p.name;
  return p.model && name.startsWith(p.model) ? p.model : name;
};
