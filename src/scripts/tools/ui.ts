/** Tiny DOM helpers shared by the tool scripts. Everything is built with textContent, never innerHTML. */
import { parseNum } from './calc';

export const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** A value that must read left-to-right (numbers, units, formulas) even inside an RTL page. */
export function ltr(text: string, cls = ''): HTMLElement {
  const e = h('bdi', cls, text);
  e.dir = 'ltr';
  return e;
}

/** Shows or clears the message under a field and flags it for assistive tech. */
export function setError(root: ParentNode, name: string, msg: string | null) {
  const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  const out = root.querySelector<HTMLElement>(`[data-err="${name}"]`);
  if (input) input.setAttribute('aria-invalid', String(!!msg));
  if (out) { out.textContent = msg ?? ''; out.hidden = !msg; }
}

export type Rule = { min?: number; max?: number; gt?: number; lt?: number; int?: boolean };
export interface Msgs { required: string; number: string; gt0: string; ge0: string; range: (lo: number, hi: number) => string; int: string }

/**
 * Reads one field. Returns the number, or NaN after recording an error (only once the field is `touched`,
 * so an untouched empty form stays calm instead of shouting at the visitor).
 */
export function readField(root: ParentNode, name: string, rule: Rule, m: Msgs, touched: Set<string>, errors: Record<string, string>): number {
  const el = root.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const raw = el.value.trim();
  const v = parseNum(raw);
  let err: string | null = null;
  if (!raw) err = m.required;
  else if (Number.isNaN(v)) err = m.number;
  else if (rule.int && !Number.isInteger(v)) err = m.int;
  else if (rule.gt !== undefined && !(v > rule.gt)) err = rule.gt === 0 ? m.gt0 : m.range(rule.gt, rule.max ?? Infinity);
  else if (rule.min !== undefined && v < rule.min) err = rule.min === 0 ? m.ge0 : m.range(rule.min, rule.max ?? Infinity);
  else if (rule.max !== undefined && v > rule.max) err = m.range(rule.min ?? rule.gt ?? -Infinity, rule.max);
  if (err) { if (touched.has(name)) errors[name] = err; return NaN; }
  return v;
}

/** One labelled value in the dark readout panel; `alt` is the same value in other units. */
export function row(label: string, value: string, alt?: string, big = false): HTMLElement {
  const r = h('div', 'border-t border-white/10 py-4 first:border-t-0 first:pt-0');
  r.append(h('dt', 'label text-white/60', label));
  const dd = h('dd', 'mt-2');
  dd.append(ltr(value, big ? 'block font-mono text-[clamp(1.9rem,4.2vw,2.6rem)] font-medium leading-tight text-white' : 'block font-mono text-xl font-medium text-white'));
  if (alt) dd.append(ltr(alt, 'mt-1 block font-mono text-[13px] text-white/60'));
  r.append(dd);
  return r;
}
export const list = (...rows: Node[]) => { const d = h('dl'); d.append(...rows); return d; };

/** What a screen reader should hear for the current readout: each headline value, or the message, or the size of the table. */
function speak(out: HTMLElement): string {
  const rows = [...out.querySelectorAll('dl > div')];
  if (rows.length) return rows.map((r) => `${r.querySelector('dt')!.textContent}: ${r.querySelector('dd > bdi')!.textContent}`).join('. ');
  const cap = out.querySelector('caption');
  return cap ? `${cap.textContent}: ${out.querySelectorAll('tbody tr').length}` : out.textContent || '';
}

/**
 * Owns the readout. It is not a live region (typing would make it speak on every keystroke), so the result is
 * announced through the hidden [data-announce] region once input has paused for 600 ms. The first render is never announced.
 * `main` ([label, value]) is mirrored into the phone pill [data-result-bar] while the form is on screen and the readout is not;
 * omit it when there is no result to show.
 */
export function createReadout(root: HTMLElement, out: HTMLElement) {
  const live = document.querySelector<HTMLElement>('[data-announce]');
  const bar = document.querySelector<HTMLElement>('[data-result-bar]');
  const label = bar?.querySelector<HTMLElement>('[data-bar-label]');
  const value = bar?.querySelector<HTMLElement>('[data-bar-value]');
  let inRoot = false, inOut = false, has = false, timer: number | undefined, last: string | undefined;
  const sync = () => bar?.toggleAttribute('data-show', has && inRoot && !inOut);

  if (bar) {
    // The bottom 88px is where the pill sits, so a readout peeking in there doesn't count as visible.
    const io = new IntersectionObserver((es) => { for (const e of es) e.target === out ? (inOut = e.isIntersecting) : (inRoot = e.isIntersecting); sync(); }, { rootMargin: '0px 0px -88px 0px' });
    io.observe(root);
    io.observe(out);
  }

  return (node: Node, main?: [label: string, value: string]) => {
    out.replaceChildren(node);
    has = !!main;
    if (main && label && value) { label.textContent = main[0]; value.replaceChildren(ltr(main[1])); }
    sync();
    const text = speak(out);
    if (last === undefined) { last = text; return; }
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (live && text !== last) live.textContent = last = text; }, 600);
  };
}
