/**
 * Pure maths for the engineering tools (no DOM). Imported by the page scripts, by the server-side
 * worked examples (so the numbers printed in the HTML come from the same code) and by calc.test.mjs.
 * Keep to erasable TypeScript so `node` can run it directly.
 */

// ---------- Units ----------
export type ConcUnit = 'pct' | 'ppm' | 'ppb';
export type FlowUnit = 'ml' | 'l';
/** 1 % = 10 000 ppm; 1 ppm = 1 000 ppb. */
export const PPM_PER: Record<ConcUnit, number> = { pct: 10_000, ppm: 1, ppb: 0.001 };
/** Flows are held in mL/min internally. */
export const ML_PER: Record<FlowUnit, number> = { ml: 1, l: 1000 };

export const toPpm = (v: number, u: ConcUnit) => v * PPM_PER[u];
export const fromPpm = (ppm: number, u: ConcUnit) => ppm / PPM_PER[u];
export const toMl = (v: number, u: FlowUnit) => v * ML_PER[u];
export const fromMl = (ml: number, u: FlowUnit) => ml / ML_PER[u];

/** Pick the unit that keeps a concentration readable: % from 1 %, ppm from 1 ppm, else ppb. */
export const autoUnit = (ppm: number): ConcUnit => (ppm >= 10_000 ? 'pct' : ppm >= 1 ? 'ppm' : 'ppb');

// ---------- Gas dilution (single-stage, ideal mixing) ----------
/** Forward: C_out = C_s · Q_s / (Q_s + Q_d). Concentration in ppm, flows in any one common unit. */
export function dilute(csPpm: number, qs: number, qd: number) {
  const qt = qs + qd;
  return { cOutPpm: (csPpm * qs) / qt, ratio: qt / qs, qt };
}

export type DilErr = 'cs' | 'qs' | 'qd' | 'ct' | 'qt' | 'ct-ge-cs';

/** Inverse: Q_s = Q_t · C_t / C_s,  Q_d = Q_t − Q_s.  Requires 0 < C_t < C_s. */
export function flowsForTarget(csPpm: number, ctPpm: number, qt: number): { ok: true; qs: number; qd: number; ratio: number } | { ok: false; error: DilErr } {
  if (!(csPpm > 0)) return { ok: false, error: 'cs' };
  if (!(ctPpm > 0)) return { ok: false, error: 'ct' };
  if (!(qt > 0)) return { ok: false, error: 'qt' };
  if (ctPpm >= csPpm) return { ok: false, error: 'ct-ge-cs' };
  const qs = (qt * ctPpm) / csPpm;
  return { ok: true, qs, qd: qt - qs, ratio: csPpm / ctPpm };
}

/** n evenly spaced targets from cMin to cMax (inclusive), each with the flows that make it. */
export function curve(csPpm: number, cMinPpm: number, cMaxPpm: number, n: number, qt: number) {
  const rows: { c: number; qs: number; qd: number; ratio: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = n === 1 ? cMinPpm : cMinPpm + ((cMaxPpm - cMinPpm) * i) / (n - 1);
    const r = flowsForTarget(csPpm, c, qt);
    if (!r.ok) return r;
    rows.push({ c, qs: r.qs, qd: r.qd, ratio: r.ratio });
  }
  return { ok: true as const, rows };
}

// ---------- ppm <-> mg/m3 ----------
/** Molar volume of an ideal gas, L/mol: 22.414 · (T/273.15) · (101.325/P), T in K, P in kPa. */
export const molarVolume = (tK: number, pKpa: number) => 22.414 * (tK / 273.15) * (101.325 / pKpa);
/** mg/m3 = ppm · M / V_m */
export const ppmToMgm3 = (ppm: number, molarMass: number, vm: number) => (ppm * molarMass) / vm;
/** ppm = mg/m3 · V_m / M */
export const mgm3ToPpm = (mg: number, molarMass: number, vm: number) => (mg * vm) / molarMass;

/** Common gases. Molar masses g/mol, rounded to 2 dp from IUPAC standard atomic weights. */
export const GASES = [
  { id: 'co', f: 'CO', m: 28.01, en: 'Carbon monoxide', ar: 'أول أكسيد الكربون' },
  { id: 'co2', f: 'CO₂', m: 44.01, en: 'Carbon dioxide', ar: 'ثاني أكسيد الكربون' },
  { id: 'no', f: 'NO', m: 30.01, en: 'Nitric oxide', ar: 'أكسيد النيتريك' },
  { id: 'no2', f: 'NO₂', m: 46.01, en: 'Nitrogen dioxide', ar: 'ثاني أكسيد النيتروجين' },
  { id: 'so2', f: 'SO₂', m: 64.07, en: 'Sulfur dioxide', ar: 'ثاني أكسيد الكبريت' },
  { id: 'h2s', f: 'H₂S', m: 34.08, en: 'Hydrogen sulfide', ar: 'كبريتيد الهيدروجين' },
  { id: 'ch4', f: 'CH₄', m: 16.04, en: 'Methane', ar: 'الميثان' },
  { id: 'nh3', f: 'NH₃', m: 17.03, en: 'Ammonia', ar: 'الأمونيا' },
  { id: 'o3', f: 'O₃', m: 48.0, en: 'Ozone', ar: 'الأوزون' },
  { id: 'c6h6', f: 'C₆H₆', m: 78.11, en: 'Benzene', ar: 'البنزين' },
] as const;

/** Reference conditions offered as quick-sets (°C, kPa). */
export const CONDITIONS = [
  { id: '25', tC: 25, pKpa: 101.325 },
  { id: '20', tC: 20, pKpa: 101.325 },
  { id: '0', tC: 0, pKpa: 101.325 },
] as const;

export const PRESSURE_KPA = { kpa: 1, mbar: 0.1, atm: 101.325 } as const;
export type PressureUnit = keyof typeof PRESSURE_KPA;

// ---------- Parsing + formatting ----------
/**
 * Accepts "1.5", "1,5", "1,234.5", Arabic-Indic digits and the Arabic decimal separator.
 * Returns NaN for anything else, including an ambiguous lone "1,000" (never guess a silent misread).
 */
export function parseNum(raw: string): number {
  let s = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[\s٬_]/g, '')
    .replace(/٫/g, '.');
  if (s.includes(',')) {
    if (s.includes('.')) s = s.replace(/,/g, '');
    else if (/^[+-]?\d*,\d{3}$/.test(s)) return NaN;
    else s = s.replace(',', '.');
  }
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? Number(s) : NaN;
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** 4 significant figures, plain for 0.001 ≤ |x| < 10 000 000, otherwise a × 10ⁿ form. */
export function fmt(x: number, sig = 4): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 0.001 && a < 1e7) return Number(x.toPrecision(sig)).toLocaleString('en-US', { maximumFractionDigits: 12 });
  const [m, e] = x.toExponential(sig - 1).split('e');
  return `${Number(m)} × 10${String(Number(e)).replace(/./g, (c) => SUP[c])}`;
}
