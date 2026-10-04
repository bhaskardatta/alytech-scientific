/** JSON-LD builders — rendered into the initial HTML by Base.astro. */
import { site } from './site';

const abs = (p: string) => new URL(p, site.url).href;

export const breadcrumbLd = (items: { label: string; href?: string }[], current: string) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.label,
    item: abs(it.href ?? current),
  })),
});

export const productLd = (o: {
  name: string; model?: string; description: string; category: string; brand: string; brandUrl: string;
  image?: string; url: string; specs: { label: string; value: string }[];
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: o.name,
  ...(o.model && { model: o.model, mpn: o.model }),
  description: o.description,
  category: o.category,
  brand: { '@type': 'Brand', name: o.brand },
  manufacturer: { '@type': 'Organization', name: o.brand, url: o.brandUrl },
  ...(o.image && { image: abs(o.image) }),
  url: abs(o.url),
  additionalProperty: o.specs.map((s) => ({ '@type': 'PropertyValue', name: s.label, value: s.value })),
});

export const faqLd = (faqs: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
