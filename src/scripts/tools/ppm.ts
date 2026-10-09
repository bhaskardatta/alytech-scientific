/** ppm <-> mg/m3 converter: wires the server-rendered form to the maths in calc.ts. */
import { molarVolume, ppmToMgm3, mgm3ToPpm, GASES, CONDITIONS, PRESSURE_KPA, fmt, parseNum, type PressureUnit } from './calc';
import { $, h, row, list, setError, readField, type Msgs } from './ui';

type Dir = 'toMass' | 'toPpm';
/** Gas-phase units in ppm, mass-concentration units in mg/m3. */
const GAS_UNIT: Record<string, number> = { ppm: 1, ppb: 0.001 };
const MASS_UNIT: Record<string, number> = { mg: 1, ug: 0.001 };

const root = document.querySelector<HTMLElement>('[data-tool="ppm"]');
if (root) init(root);

function init(root: HTMLElement) {
  const M = JSON.parse($(root, 'script[type="application/json"]').textContent || '{}');
  const form = $<HTMLFormElement>(root, 'form');
  const out = $(root, '[data-readout]');
  const touched = new Set<string>();
  const msgs: Msgs = { required: M.err.required, number: M.err.number, gt0: M.err.gt0, ge0: M.err.ge0, range: (lo, hi) => M.err.range.replace('{lo}', String(lo)).replace('{hi}', String(hi)), int: M.err.int };
  const f = (n: string) => $<HTMLInputElement & HTMLSelectElement>(form, `[name="${n}"]`);
  const dir = () => form.querySelector<HTMLInputElement>('[name="dir"]:checked')!.value as Dir;

  /** Input/output unit lists depend on the direction; rebuild them and keep sensible defaults. */
  function syncUnits() {
    const inGas = dir() === 'toMass';
    const fill = (sel: HTMLSelectElement, keys: string[]) => {
      const prev = sel.value;
      sel.replaceChildren(...keys.map((k) => { const o = h('option', '', M.units[k]); o.value = k; return o; }));
      sel.value = keys.includes(prev) ? prev : keys[0];
    };
    fill(f('inUnit'), inGas ? ['ppm', 'ppb'] : ['mg', 'ug']);
    fill(f('outUnit'), inGas ? ['mg', 'ug'] : ['ppm', 'ppb']);
  }

  function update(submitted = false) {
    if (submitted) form.querySelectorAll<HTMLInputElement>('input[type="text"]').forEach((i) => touched.add(i.name));
    const errors: Record<string, string> = {};
    const v = readField(form, 'value', { min: 0 }, msgs, touched, errors);
    const mm = readField(form, 'mm', { gt: 0 }, msgs, touched, errors);
    const tRaw = readField(form, 'temp', {}, msgs, touched, errors);
    const pRaw = readField(form, 'press', { gt: 0 }, msgs, touched, errors);
    const tK = f('tempUnit').value === 'k' ? tRaw : tRaw + 273.15;
    const pKpa = pRaw * PRESSURE_KPA[f('pressUnit').value as PressureUnit];
    if (!Number.isNaN(tRaw) && !(tK > 0)) errors.temp = M.err.temp;

    for (const name of ['value', 'mm', 'temp', 'press']) setError(form, name, errors[name] ?? null);
    if (Object.keys(errors).length) return void out.replaceChildren(h('p', 'text-[15px] leading-relaxed text-white/70', M.err.summary));
    if ([v, mm, tK, pKpa].some(Number.isNaN)) return void out.replaceChildren(h('p', 'text-[15px] leading-relaxed text-white/70', M.hint));

    const vm = molarVolume(tK, pKpa);
    const toMass = dir() === 'toMass';
    const inF = (toMass ? GAS_UNIT : MASS_UNIT)[f('inUnit').value];
    const outF = (toMass ? MASS_UNIT : GAS_UNIT)[f('outUnit').value];
    const base = v * inF; // ppm or mg/m3
    const res = (toMass ? ppmToMgm3(base, mm, vm) : mgm3ToPpm(base, mm, vm)) / outF;
    const outU = M.units[f('outUnit').value];

    const working = toMass
      ? `mg/m³ = ppm × M / Vₘ = ${fmt(base)} × ${fmt(mm)} / ${fmt(vm, 6)} = ${fmt(ppmToMgm3(base, mm, vm))}`
      : `ppm = mg/m³ × Vₘ / M = ${fmt(base)} × ${fmt(vm, 6)} / ${fmt(mm)} = ${fmt(mgm3ToPpm(base, mm, vm))}`;
    const factor = toMass ? `1 ppm = ${fmt(mm / vm)} mg/m³` : `1 mg/m³ = ${fmt(vm / mm)} ppm`;
    out.replaceChildren(list(
      row(M.r.result, `${fmt(res)} ${outU}`, undefined, true),
      row(M.r.vm, `${fmt(vm, 5)} L/mol`, `${fmt(tK - 273.15, 6)} °C · ${fmt(tK, 6)} K · ${fmt(pKpa, 6)} kPa`),
      row(M.r.factor, factor, working),
    ));
  }

  // Presets keep the molar mass in sync; typing a mass that matches no preset flips the menu to Custom.
  f('gas').addEventListener('change', () => {
    const g = GASES.find((x) => x.id === f('gas').value);
    if (g) { f('mm').value = String(g.m); touched.add('mm'); }
    else f('mm').focus();
  });
  f('mm').addEventListener('input', () => {
    const m = parseNum(f('mm').value);
    f('gas').value = GASES.find((g) => g.m === m)?.id ?? 'custom';
  });
  f('cond').addEventListener('change', () => {
    const c = CONDITIONS.find((x) => x.id === f('cond').value);
    if (!c) return;
    f('temp').value = String(c.tC); f('tempUnit').value = 'c';
    f('press').value = String(c.pKpa); f('pressUnit').value = 'kpa';
    touched.add('temp'); touched.add('press');
  });
  for (const n of ['temp', 'tempUnit', 'press', 'pressUnit']) f(n).addEventListener('input', () => { f('cond').value = 'custom'; });
  form.querySelectorAll('[name="dir"]').forEach((r) => r.addEventListener('change', () => { syncUnits(); update(); }));

  form.addEventListener('input', (e) => { const n = (e.target as HTMLInputElement).name; if (n) touched.add(n); update(); });
  form.addEventListener('focusout', (e) => { const t = e.target as HTMLInputElement; if (t.name && t.type === 'text') { touched.add(t.name); update(); } });
  form.addEventListener('change', () => update());
  form.addEventListener('submit', (e) => { e.preventDefault(); update(true); });
  syncUnits();
  update();
  root.dataset.ready = '';
}
