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
