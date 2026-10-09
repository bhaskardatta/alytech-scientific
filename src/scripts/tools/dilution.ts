/** Gas dilution calculator: wires the server-rendered form to the maths in calc.ts. */
import { dilute, flowsForTarget, curve, toPpm, fromPpm, toMl, fromMl, autoUnit, fmt, type ConcUnit, type FlowUnit } from './calc';
import { $, h, row, list, setError, readField, type Msgs } from './ui';

type Mode = 'forward' | 'inverse' | 'curve';
const UNITS: ConcUnit[] = ['pct', 'ppm', 'ppb'];

const root = document.querySelector<HTMLElement>('[data-tool="dilution"]');
if (root) init(root);

function init(root: HTMLElement) {
  const M = JSON.parse($(root, 'script[type="application/json"]').textContent || '{}');
  const form = $<HTMLFormElement>(root, 'form');
  const out = $(root, '[data-readout]');
  const touched = new Set<string>();
  const msgs: Msgs = { required: M.err.required, number: M.err.number, gt0: M.err.gt0, ge0: M.err.ge0, range: (lo, hi) => M.err.range.replace('{lo}', String(lo)).replace('{hi}', String(hi)), int: M.err.int };
  const val = (n: string) => ($<HTMLSelectElement | HTMLInputElement>(form, `[name="${n}"]`)).value;
  const mode = () => (form.querySelector<HTMLInputElement>('[name="mode"]:checked')!.value as Mode);
  const unitLabel = (u: ConcUnit) => M.units[u];
  const flowLabel = (u: FlowUnit) => M.flow[u];

  const conc = (ppm: number) => {
    const u = autoUnit(ppm);
    return `${fmt(fromPpm(ppm, u))} ${unitLabel(u)}`;
  };
  const concAlt = (ppm: number) => UNITS.filter((u) => u !== autoUnit(ppm)).map((u) => `${fmt(fromPpm(ppm, u))} ${unitLabel(u)}`).join('  ·  ');
  /** A flow held in mL/min, shown in the chosen unit with the other unit alongside. */
  const flow = (ml: number, u: FlowUnit) => {
    const other: FlowUnit = u === 'ml' ? 'l' : 'ml';
    return { main: `${fmt(fromMl(ml, u))} ${flowLabel(u)}`, alt: `${fmt(fromMl(ml, other))} ${flowLabel(other)}` };
  };

  const show = (...kids: Node[]) => out.replaceChildren(...kids);
  const message = (text: string) => show(h('p', 'text-[15px] leading-relaxed text-white/70', text));

  function update(submitted = false) {
    const m = mode();
    // Only the fields for the active mode are shown, read and validated.
    root!.querySelectorAll<HTMLElement>('[data-for]').forEach((e) => { e.hidden = !e.dataset.for!.split(' ').includes(m); });
    if (submitted) form.querySelectorAll<HTMLInputElement>('input[type="text"]').forEach((i) => touched.add(i.name));

    const errors: Record<string, string> = {};
    const fu = val('flowUnit') as FlowUnit;
    const cs = readField(form, 'cs', { gt: 0 }, msgs, touched, errors);
    const csPpm = toPpm(cs, val('csUnit') as ConcUnit);
    const tPpm = (n: string) => toPpm(readField(form, n, { gt: 0 }, msgs, touched, errors), val(n + 'Unit') as ConcUnit);
    const fl = (n: string, strict = true) => toMl(readField(form, n, strict ? { gt: 0 } : { min: 0 }, msgs, touched, errors), fu);

    let result: Node | null = null;
    if (m === 'forward') {
      const qs = fl('qs'), qd = fl('qd', false);
      if (![csPpm, qs, qd].some(Number.isNaN)) {
        const r = dilute(csPpm, qs, qd);
        const t = flow(r.qt, fu);
        result = list(row(M.r.out, conc(r.cOutPpm), concAlt(r.cOutPpm), true), row(M.r.ratio, `${fmt(r.ratio)} : 1`), row(M.r.total, t.main, t.alt));
      }
    } else if (m === 'inverse') {
      const ct = tPpm('ct'), qt = fl('qt');
      if (![csPpm, ct, qt].some(Number.isNaN)) {
        const r = flowsForTarget(csPpm, ct, qt);
        if (!r.ok) errors.ct = M.err.ctGeCs;
        else {
          const s = flow(r.qs, fu), d = flow(r.qd, fu);
          result = list(row(M.r.qs, s.main, s.alt, true), row(M.r.qd, d.main, d.alt, true), row(M.r.ratio, `${fmt(r.ratio)} : 1`));
        }
      }
    } else {
      const lo = tPpm('cmin'), hi = tPpm('cmax'), qt = fl('qt');
      const n = readField(form, 'n', { min: 2, max: 10, int: true }, msgs, touched, errors);
      if (![csPpm, lo, hi, qt, n].some(Number.isNaN)) {
        if (hi <= lo) errors.cmax = M.err.cmaxLtCmin;
        else if (hi >= csPpm) errors.cmax = M.err.ctGeCs;
        else {
          const c = curve(csPpm, lo, hi, n, qt);
          if (c.ok) result = curveTable(c.rows, fu);
        }
      }
    }

    // Reflect errors on the fields (clear the rest) and in the live region.
    for (const name of ['cs', 'qs', 'qd', 'ct', 'qt', 'cmin', 'cmax', 'n']) setError(form, name, errors[name] ?? null);
    if (Object.keys(errors).length) return message(M.err.summary);
    if (result) return show(result);
    message(M.hint);
  }

  function curveTable(rows: { c: number; qs: number; qd: number; ratio: number }[], fu: FlowUnit) {
    const wrap = h('div', 'overflow-x-auto');
    wrap.dir = 'ltr';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', M.r.curve);
    const t = h('table', 'w-full border-collapse text-end font-mono text-[13.5px] text-white');
    t.dir = 'ltr';
    t.append(h('caption', 'sr-only', M.r.curve));
    const head = h('tr');
    for (const c of ['#', M.r.target, `${M.r.qsShort} (${flowLabel(fu)})`, `${M.r.qdShort} (${flowLabel(fu)})`, M.r.ratioShort]) {
      const th = h('th', 'border-b border-white/20 px-2 py-2 text-end text-[12px] font-medium text-white/60 first:text-start', c);
      th.scope = 'col';
      head.append(th);
    }
    t.createTHead().append(head);
    const body = t.createTBody();
    rows.forEach((r, i) => {
      const tr = h('tr', 'border-b border-white/10 last:border-0');
      const th = h('th', 'px-2 py-2 text-start font-normal text-white/60', String(i + 1));
      th.scope = 'row';
      tr.append(th);
      for (const v of [conc(r.c), fmt(fromMl(r.qs, fu)), fmt(fromMl(r.qd, fu)), `${fmt(r.ratio)} : 1`]) tr.append(h('td', 'px-2 py-2 whitespace-nowrap', v));
      body.append(tr);
    });
    wrap.append(t);
    return wrap;
  }

  // Field -> touched on first edit or blur; everything recalculates live.
  form.addEventListener('input', (e) => { const n = (e.target as HTMLInputElement).name; if (n) touched.add(n); update(); });
  form.addEventListener('focusout', (e) => { const n = (e.target as HTMLInputElement).name; if (n && (e.target as HTMLInputElement).type === 'text') { touched.add(n); update(); } });
  form.addEventListener('change', () => update());
  form.addEventListener('submit', (e) => { e.preventDefault(); update(true); });
  update();
  root.dataset.ready = '';
}
