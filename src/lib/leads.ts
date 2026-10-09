/** Enquiry list filters: one parser shared by the list page and the CSV export, so "Export" always means "what I'm looking at". */
import { isStage, isUuid, safeQ } from './admin';
import { dayStart, dubaiDay, validDay } from './period';

export const MODES = ['whatsapp', 'datasheet', 'price', 'quote', 'specs', 'interest'] as const;
export const SORTS: Record<string, { label: string; order: string }> = {
  new: { label: 'Newest first', order: 'created_at.desc,id.desc' },
  old: { label: 'Oldest first', order: 'created_at.asc,id.asc' },
  value: { label: 'Highest value', order: 'value_aed.desc.nullslast,created_at.desc' },
  follow: { label: 'Follow-up date', order: 'follow_up.asc.nullslast,created_at.desc' },
};

export interface LeadFilters {
  status: 'submitted' | 'partial' | 'all';
  stage: string; assignee: string; mode: string; product: string; country: string;
  from: string; to: string; campaign: boolean; spam: 'hide' | 'only' | 'all'; due: boolean; q: string; sort: string;
}

export function parseLeadFilters(sp: URLSearchParams): LeadFilters {
  const pick = <T extends string>(k: string, ok: readonly T[], d: T) => (ok.includes(sp.get(k) as T) ? (sp.get(k) as T) : d);
  const assignee = sp.get('assignee') ?? '';
  return {
    status: pick('status', ['submitted', 'partial', 'all'], 'submitted'),
    stage: isStage(sp.get('stage')) ? sp.get('stage')! : '',
    assignee: assignee === 'me' || assignee === 'none' || isUuid(assignee) ? assignee : '',
    mode: (MODES as readonly string[]).includes(sp.get('mode') ?? '') ? sp.get('mode')! : '',
    product: safeQ(sp.get('product') ?? ''),
    country: safeQ(sp.get('country') ?? ''),
    from: validDay(sp.get('from')) ? sp.get('from')! : '',
    to: validDay(sp.get('to')) ? sp.get('to')! : '',
    campaign: sp.get('campaign') === '1',
    spam: pick('spam', ['hide', 'only', 'all'], 'hide'),
    due: sp.get('due') === '1',
    q: safeQ(sp.get('q') ?? ''),
    sort: sp.get('sort') && SORTS[sp.get('sort')!] ? sp.get('sort')! : 'new',
  };
}

const like = (cols: string[], v: string) => `or(${cols.map((c) => `${c}.ilike.*${encodeURIComponent(v)}*`).join(',')})`;

/** PostgREST filter string for these filters. `me` resolves assignee=me. `skipStage` is for the per-stage counts. */
export function leadQuery(f: LeadFilters, me: string | null, skipStage = false) {
  const p: string[] = [];
  if (f.status !== 'all') p.push(`status=eq.${f.status}`);
  if (f.stage && !skipStage) p.push(`stage=eq.${f.stage}`);
  if (f.due) p.push(`follow_up=lte.${dubaiDay(new Date())}`, 'stage=not.in.(won,lost)');
  if (f.assignee === 'none') p.push('assigned_to=is.null');
  else if (f.assignee === 'me') p.push(`assigned_to=eq.${me ?? '00000000-0000-0000-0000-000000000000'}`);
  else if (f.assignee) p.push(`assigned_to=eq.${f.assignee}`);
  if (f.mode) p.push(`mode=eq.${f.mode}`);
  if (f.from) p.push(`created_at=gte.${dayStart(f.from).toISOString()}`);
  if (f.to) p.push(`created_at=lt.${new Date(dayStart(f.to).getTime() + 864e5).toISOString()}`);
  if (f.campaign) p.push('attribution=not.is.null');
  if (f.spam === 'hide') p.push('spam=eq.false');
  else if (f.spam === 'only') p.push('spam=eq.true');
  const any: string[] = [];
  if (f.product) any.push(like(['product', 'brand', 'category'], f.product));
  if (f.country) any.push(`or(country.ilike.*${encodeURIComponent(f.country)}*${f.country.length === 2 ? `,geo_country.eq.${encodeURIComponent(f.country.toUpperCase())}` : ''})`);
  if (f.q) any.push(like(['name', 'email', 'company', 'product', 'phone', 'ip_org', 'wa_ref'], f.q));
  if (any.length === 1) p.push(any[0].replace(/^or/, 'or=')); // or(a,b) -> or=(a,b)
  else if (any.length > 1) p.push(`and=(${any.join(',')})`);
  return p.join('&');
}

/** Number of non-default filters, for the "Filters (3)" label. */
export const activeFilters = (f: LeadFilters) =>
  [f.assignee, f.mode, f.product, f.country, f.from, f.to, f.campaign, f.due, f.spam !== 'hide', f.status !== 'submitted'].filter(Boolean).length;
