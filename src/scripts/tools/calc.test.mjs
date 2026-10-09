// Self-check for the tool maths. Run: node src/scripts/tools/calc.test.mjs
// Every expected value below is worked out by hand in the comment beside it.
import assert from 'node:assert/strict';
import { dilute, flowsForTarget, curve, toPpm, fromPpm, toMl, autoUnit, molarVolume, ppmToMgm3, mgm3ToPpm, GASES, parseNum, fmt } from './calc.ts';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

// ---- Units ----
ok('1 % = 10 000 ppm, 1 ppm = 1 000 ppb', () => {
  near(toPpm(1, 'pct'), 10000); near(toPpm(1000, 'ppb'), 1); near(fromPpm(10000, 'pct'), 1);
  near(toMl(2, 'l'), 2000);
  assert.equal(autoUnit(20000), 'pct'); assert.equal(autoUnit(50), 'ppm'); assert.equal(autoUnit(0.5), 'ppb');
});

// ---- Gas dilution, forward: C_out = Cs·Qs/(Qs+Qd) ----
ok('forward: 1000 ppm, 10 + 990 mL/min -> 10 ppm, ratio 100', () => {
  const r = dilute(1000, 10, 990);              // 1000·10/1000 = 10 ;  (10+990)/10 = 100
  near(r.cOutPpm, 10); near(r.ratio, 100); near(r.qt, 1000);
});
ok('forward: 1 % source, 5 mL/min + 4.995 L/min (as mL) -> 10 ppm', () => {
  const r = dilute(toPpm(1, 'pct'), 5, toMl(4.995, 'l')); // 10000·5/5000 = 10
  near(r.cOutPpm, 10); near(r.ratio, 1000);
});
ok('forward: equal flows halve the concentration', () => near(dilute(200, 7, 7).cOutPpm, 100));

// ---- Gas dilution, inverse: Qs = Qt·Ct/Cs ; Qd = Qt - Qs ----
ok('inverse: 1 % source, 50 ppm target, 2 L/min total -> Qs 10 mL/min, Qd 1990 mL/min', () => {
  const r = flowsForTarget(toPpm(1, 'pct'), 50, toMl(2, 'l')); // 2000·50/10000 = 10 ; 2000-10 = 1990 ; 10000/50 = 200
  assert.ok(r.ok); near(r.qs, 10); near(r.qd, 1990); near(r.ratio, 200);
});
ok('inverse round-trips through forward', () => {
  const r = flowsForTarget(5000, 37.5, 800);
  assert.ok(r.ok); near(dilute(5000, r.qs, r.qd).cOutPpm, 37.5);
});
ok('inverse validation: 0 < Ct < Cs, Cs>0, Qt>0', () => {
  assert.deepEqual(flowsForTarget(100, 100, 1000), { ok: false, error: 'ct-ge-cs' });
  assert.deepEqual(flowsForTarget(100, 150, 1000), { ok: false, error: 'ct-ge-cs' });
  assert.equal(flowsForTarget(100, 0, 1000).error, 'ct');
  assert.equal(flowsForTarget(0, 10, 1000).error, 'cs');
  assert.equal(flowsForTarget(100, 10, 0).error, 'qt');
});
ok('curve: 100 ppm source, 10-50 ppm in 5 steps, 1000 mL/min -> Qs 100..500', () => {
  const c = curve(100, 10, 50, 5, 1000); // targets 10,20,30,40,50 ; Qs = 1000·C/100 = 100,200,300,400,500
  assert.ok(c.ok); assert.equal(c.rows.length, 5);
  [10, 20, 30, 40, 50].forEach((v, i) => { near(c.rows[i].c, v); near(c.rows[i].qs, v * 10); near(c.rows[i].qd, 1000 - v * 10); });
});

// ---- ppm <-> mg/m3 ----
ok('molar volume: 0 °C/101.325 kPa = 22.414 ; 25 °C/101.325 kPa = 24.465', () => {
  near(molarVolume(273.15, 101.325), 22.414);
  near(molarVolume(298.15, 101.325), 24.465437, 1e-7); // 22.414 · 298.15/273.15 = 6682.7341/273.15 = 24.46544
  near(molarVolume(298.15, 50.6625), 2 * 24.465437, 1e-7); // half the pressure, double the volume
});
ok('50 ppm CO at 25 °C -> 57.24 mg/m3  (1400.5/24.46544)', () => {
  near(ppmToMgm3(50, 28.01, molarVolume(298.15, 101.325)), 57.24402, 1e-6);
});
ok('100 mg/m3 SO2 at 25 °C -> 38.19 ppm  (2446.544/64.07)', () => {
  near(mgm3ToPpm(100, 64.07, molarVolume(298.15, 101.325)), 38.18548, 1e-6);
});
ok('0 °C: 1 ppm of any gas = M/22.414 mg/m3 (NO2: 2.0527)', () => {
  near(ppmToMgm3(1, 46.01, molarVolume(273.15, 101.325)), 46.01 / 22.414, 1e-12);
});
ok('round trip ppm -> mg/m3 -> ppm', () => {
  const vm = molarVolume(310.15, 98.2);
  near(mgm3ToPpm(ppmToMgm3(12.3, 17.03, vm), 17.03, vm), 12.3);
});
ok('gas presets: molar masses from IUPAC atomic weights (C 12.011, H 1.008, N 14.007, O 15.999, S 32.06)', () => {
  const w = { C: 12.011, H: 1.008, N: 14.007, O: 15.999, S: 32.06 };
  const calc = { co: w.C + w.O, co2: w.C + 2 * w.O, no: w.N + w.O, no2: w.N + 2 * w.O, so2: w.S + 2 * w.O, h2s: 2 * w.H + w.S, ch4: w.C + 4 * w.H, nh3: w.N + 3 * w.H, o3: 3 * w.O, c6h6: 6 * w.C + 6 * w.H };
  // S is quoted as 32.06 (IUPAC conventional; sources use 32.06-32.07), so sulfur gases get a wider band.
  for (const g of GASES) assert.ok(Math.abs(g.m - calc[g.id]) < (/S/.test(g.f) ? 0.015 : 0.006), `${g.f}: ${g.m} vs ${calc[g.id]}`);
});

// ---- Input parsing + formatting ----
ok('parseNum', () => {
  assert.equal(parseNum('1.5'), 1.5); assert.equal(parseNum('1,5'), 1.5); assert.equal(parseNum('1,234.5'), 1234.5);
  assert.equal(parseNum('٣٫٥'), 3.5); assert.equal(parseNum(' 25 '), 25); assert.equal(parseNum('1e3'), 1000);
  assert.ok(Number.isNaN(parseNum(''))); assert.ok(Number.isNaN(parseNum('abc'))); assert.ok(Number.isNaN(parseNum('1,000')));
});
ok('fmt', () => {
  assert.equal(fmt(57.2437), '57.24'); assert.equal(fmt(10000), '10,000'); assert.equal(fmt(0.00012346), '1.235 × 10⁻⁴'); assert.equal(fmt(0), '0');
});

console.log(`\n${n} checks passed`);
