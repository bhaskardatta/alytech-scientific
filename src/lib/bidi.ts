/**
 * Right-to-left pages scramble Latin runs with numbers and units ("150 °C" shows as "C° 150", "2–6" as "6–2").
 * `ltr()` returns escaped HTML with each Latin/number run isolated left-to-right (<bdi dir="ltr">); on English pages it
 * only escapes. Use it with set:html wherever Arabic prose carries specs, model names or ranges.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BODY = `[A-Za-z0-9_.,:/%°µ²³⁴⁵⁶⁷⁸⁹⁻⁰¹×·'"()+−–~≈′″Ͱ-ϿÀ-ÿ-]`;
const LTR_RUN = new RegExp(`(?:[<>≤≥±~+−–-]\\s?)?[A-Za-z0-9]${BODY}*(?: [A-Za-z0-9°%±+<>≤≥−–~µ]${BODY}*)*`, 'g');

export function ltr(s: string, lang: 'en' | 'ar', mono = false): string {
  if (lang !== 'ar') return esc(s);
  let out = '', last = 0;
  for (const m of s.matchAll(LTR_RUN)) {
    let core = m[0], tail = '';
    // trailing sentence punctuation and an unmatched ")" belong to the Arabic sentence, not the run
    for (;;) {
      const open = (core.match(/\(/g) ?? []).length, close = (core.match(/\)/g) ?? []).length;
      const c = core.slice(-1);
      if (/[.,:;(]/.test(c) || (c === ')' && close > open)) { tail = c + tail; core = core.slice(0, -1); } else break;
    }
    out += esc(s.slice(last, m.index)) + `<bdi dir="ltr" class="${mono ? 'font-mono ' : ''}${core.length <= 18 ? 'whitespace-nowrap' : ''}">${esc(core)}</bdi>` + esc(tail);
    last = m.index! + m[0].length;
  }
  return out + esc(s.slice(last));
}
