/** Dashboard numbers: SQL does the aggregating (supabase/schema.sql admin_overview / admin_kpis); this file fetches and shapes them. */
import { rpc } from './db';
import { num } from './admin';

export interface Kpis { pageviews: number; visitors: number; enquiries: number; partials: number; whatsapp: number; converted: number; won_count: number; won_value: number }
type Row = { k: string; n: number };
export interface Overview {
  kpis: Kpis;
  daily: { day: string; pageviews: number; enquiries: number; whatsapp: number }[];
  channels: Row[]; referrers: Row[]; campaigns: Row[]; countries: Row[]; devices: Row[]; pages: Row[]; products_viewed: Row[]; products_enquired: Row[];
  funnel: { viewed: number; opened: number; submitted: number };
  searches: { total: number; with_results: number; no_results: number; top: { q: string; n: number; results: number | null }[] };
  orgs: { ip_org: string; visitors: number; pageviews: number; last_seen: string; products: string[]; country: string | null }[];
}
interface Span { from: Date; to: Date; prevFrom: Date; prevTo: Date }

const args = (a: Date, b: Date) => ({ p_from: a.toISOString(), p_to: b.toISOString() });

/** The current period in full, plus the headline numbers of the previous equal period. */
export async function overview(p: Span) {
  const [cur, prev] = await Promise.all([rpc<Overview>('admin_overview', args(p.from, p.to)), rpc<Kpis>('admin_kpis', args(p.prevFrom, p.prevTo))]);
  return { cur, prev };
}

/** One period only (pages that don't compare). */
export const overviewOf = (p: Pick<Span, 'from' | 'to'>) => rpc<Overview>('admin_overview', args(p.from, p.to));

/** Of the visitors who accepted cookies, the share who sent an enquiry or started a WhatsApp chat (0–1). */
export const conversion = (k: Kpis) => (k.visitors ? k.converted / k.visitors : 0);

export interface Delta { dir: 'up' | 'down' | 'flat'; text: string; label: string }

/** Change against the previous period. dir drives the arrow; text is always shown, so colour is never the only signal. */
export function delta(cur: number, prev: number): Delta {
  if (cur === prev) return { dir: 'flat', text: 'No change', label: 'no change' };
  if (!prev) return { dir: 'up', text: `New (was 0)`, label: `up from 0 to ${num(cur)}` };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { dir: 'flat', text: '0%', label: 'about the same' };
  return { dir: pct > 0 ? 'up' : 'down', text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`, label: `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)} percent` };
}

/** Same, for a percentage (conversion rate): the change is in percentage points. */
export function deltaPoints(cur: number, prev: number): Delta {
  const pts = Math.round((cur - prev) * 1000) / 10;
  if (pts === 0) return { dir: 'flat', text: 'No change', label: 'no change' };
  return { dir: pts > 0 ? 'up' : 'down', text: `${pts > 0 ? '+' : '−'}${Math.abs(pts)} pts`, label: `${pts > 0 ? 'up' : 'down'} ${Math.abs(pts)} percentage points` };
}

// ISPs, mobile carriers and big clouds say nothing about the visitor's employer — hide them by default.
// Whole-word match on named providers only, so a company that merely contains "tata", "meta", "orange" or "du" stays visible.
const ISP = /(?<![a-z0-9])(?:etisalat|emirates telecommunications|emirates integrated telecommunications|eitc|e&|stc|saudi telecom|mobily|zain|ooredoo|omantel|batelco|telecom egypt|vodafone|orange (?:s\.?a|egypt|jordan)|airtel|jio|bsnl|tata (?:communications|teleservices)|starlink|cloudflare|google|amazon|microsoft|digitalocean|ovh|hetzner|akamai|apple inc|facebook|meta platforms)(?![a-z0-9])/i;
export const isIsp = (org: string) => ISP.test(org);
