/** Reporting periods in Asia/Dubai (UTC+4 all year, no daylight saving). A period is [from, to): `to` is midnight after the last day shown. */
const HOUR = 3600_000, DAY = 24 * HOUR;

/** Dubai calendar date (YYYY-MM-DD) of an instant. */
export const dubaiDay = (d: Date) => new Date(d.getTime() + 4 * HOUR).toISOString().slice(0, 10);
export const dayStart = (ymd: string) => new Date(`${ymd}T00:00:00+04:00`);
const shift = (ymd: string, days: number) => dubaiDay(new Date(dayStart(ymd).getTime() + days * DAY + 12 * HOUR));
export const validDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dayStart(s).getTime()) && dubaiDay(dayStart(s)) === s;
const MAX_DAYS = 366;

const short = (ymd: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' }).format(dayStart(ymd));

export interface Period {
  key: 'today' | '7' | '30' | '90' | 'month' | 'custom';
  label: string;      // "Last 30 days"
  prevLabel: string;  // "previous 30 days"
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  fromDay: string;    // first day shown, inclusive
  toDay: string;      // last day shown, inclusive
  days: number;
  query: string;      // keeps the period when linking to another page: "p=30" or "p=custom&from=…&to=…"
}

export const PRESETS: { key: Period['key']; short: string }[] = [
  { key: 'today', short: 'Today' }, { key: '7', short: '7 days' }, { key: '30', short: '30 days' }, { key: '90', short: '90 days' }, { key: 'month', short: 'This month' },
];

export function parsePeriod(sp: URLSearchParams, now = new Date()): Period {
  const today = dubaiDay(now);
  let key = (sp.get('p') ?? '30') as Period['key'];
  let fromDay = today, toDay = today;
  if (key === '7' || key === '30' || key === '90') fromDay = shift(today, -(Number(key) - 1));
  else if (key === 'month') fromDay = `${today.slice(0, 8)}01`;
  else if (key === 'custom' && validDay(sp.get('from')) && validDay(sp.get('to'))) {
    fromDay = sp.get('from')!; toDay = sp.get('to')!;
    if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
    if (toDay > today) toDay = today;
    if (fromDay > toDay) fromDay = toDay;
    if ((dayStart(toDay).getTime() - dayStart(fromDay).getTime()) / DAY + 1 > MAX_DAYS) fromDay = shift(toDay, -(MAX_DAYS - 1));
  } else if (key !== 'today') { key = '30'; fromDay = shift(today, -29); }

  const from = dayStart(fromDay);
  const to = new Date(dayStart(toDay).getTime() + DAY);
  const days = Math.round((to.getTime() - from.getTime()) / DAY);
  const label = ({ today: 'Today', '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', month: 'This month', custom: `${short(fromDay)} – ${short(toDay)}` })[key];
  return {
    key, label, from, to, days, fromDay, toDay,
    prevFrom: new Date(from.getTime() - days * DAY), prevTo: from,
    prevLabel: days === 1 ? 'yesterday' : `previous ${days} days`,
    query: key === 'custom' ? `p=custom&from=${fromDay}&to=${toDay}` : `p=${key}`,
  };
}

/** Last `n` full days ending at the start of today (used by the weekly digest). */
export function lastDays(n: number, now = new Date()): Pick<Period, 'from' | 'to' | 'prevFrom' | 'prevTo' | 'fromDay' | 'toDay' | 'days'> {
  const to = dayStart(dubaiDay(now));
  const from = new Date(to.getTime() - n * DAY);
  return { from, to, prevFrom: new Date(from.getTime() - n * DAY), prevTo: from, fromDay: dubaiDay(from), toDay: shift(dubaiDay(to), -1), days: n };
}
