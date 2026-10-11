/** Meta length budget: titles stay under 60 where possible (never over 65), descriptions 120–155 (never over 160). */
export const TITLE_MAX = 65;
export const DESC_MAX = 160;

// Words that must not end a trimmed sentence ("…specific heat and").
const DANGLING = /(?:\s|^)(?:a|an|and|or|the|of|to|for|in|on|with|by|from|at|as|via|than|&|\+|و|في|من|إلى|على|مع|أو|عن)$/i;

// Words that open a modifier phrase, English and Arabic: a safe place to stop a sentence.
const ADJUNCT = / (?:by|under|with|while|using|via|during|when|which|where|including|from|across|through|within|between|at|into|as|إلى|مع|عبر|حيث|بينما|خلال|عند) /gi;

/**
 * Trim to `max` chars on a word boundary, preferring a sentence end, then a clause end. No ellipsis, no dangling
 * connector; ends with sentence punctuation so it reads as a complete line.
 */
export function fit(text: string, max: number, floor = Math.floor(max * 0.55)): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const win = s.slice(0, max + 1);
  // `floor`: the shortest result we accept just to land on a sentence/clause end (default ~55% of the budget)
  const stop = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '), win.lastIndexOf('؟ '));
  if (stop >= floor) return win.slice(0, stop + 1);
  const clause = Math.max(win.lastIndexOf(', '), win.lastIndexOf('، '), win.lastIndexOf('; '), win.lastIndexOf(' — '), win.lastIndexOf(': '));
  // no clause end in reach: cut before the last word that opens a modifier ("… by forcing", "… under pressure"), so the left side stays a whole phrase
  let adjunct = -1;
  for (const m of win.matchAll(ADJUNCT)) adjunct = m.index!;
  let cut = clause >= floor ? clause : adjunct >= floor ? adjunct : win.lastIndexOf(' ');
  if (cut < 1) cut = max;
  let out = win.slice(0, cut).replace(/[\s,;:،—–-]+$/, '');
  while (DANGLING.test(out)) out = out.replace(DANGLING, '').replace(/[\s,;:،—–-]+$/, '');
  return `${out}.`;
}

/**
 * "Main | Suffix": tries each suffix in order (richest first, '' = none) within the soft `max`, then within the hard cap
 * (65); only if nothing fits does it trim `main` on a word boundary.
 */
export function titleOf(main: string, suffixes: string[], max = 60, hard = TITLE_MAX): string {
  const tails = suffixes.length ? suffixes : [''];
  for (const limit of [max, hard]) {
    for (const tail of tails) {
      const t = tail ? `${main} | ${tail}` : main;
      if (t.length <= limit) return t;
    }
  }
  const tail = tails.find((x) => x) ?? '';
  const trimmed = fit(main, max - (tail ? tail.length + 3 : 0)).replace(/\.$/, '');
  return tail ? `${trimmed} | ${tail}` : trimmed;
}

/**
 * Picks the first candidate (most descriptive first) that fits with a suffix — within the soft `max`, else the hard cap —
 * then the first that fits bare. A long product name gives way to a shorter but still whole phrase instead of being cut
 * mid-phrase.
 */
export function titleFrom(candidates: (string | false | undefined)[], suffixes: string[], max = 60, hard = TITLE_MAX): string {
  const list = [...new Set(candidates.filter((c): c is string => !!c).map((c) => c.replace(/\s+/g, ' ').trim()))];
  const tails = suffixes.filter(Boolean);
  for (const c of list) for (const limit of [max, hard]) for (const tail of tails) if (`${c} | ${tail}`.length <= limit) return `${c} | ${tail}`;
  for (const c of list) if (c.length <= hard) return c;
  return titleOf(list[list.length - 1], suffixes, max, hard);
}

/**
 * Description built from whole sentences: the fewest leading sentences of `body` (plus the richest closing line from
 * `tails` that fits) landing in min..max. Only if no whole-sentence combination fits is the body trimmed on a clause boundary.
 */
export function descOf(body: string, tails: string | string[] = [], max = 155, min = 120, hard = DESC_MAX): string {
  const closers = [...(Array.isArray(tails) ? tails : [tails]).filter(Boolean), ''];
  const sentences = body.replace(/\s+/g, ' ').trim().split(/(?<=[.!?؟])\s+/);
  for (let n = 1; n <= sentences.length; n++) {
    const head = sentences.slice(0, n).join(' ');
    for (const tail of closers) {
      const text = tail ? `${head} ${tail}` : head;
      if (text.length >= min && text.length <= hard) return text;
    }
  }
  const tail = closers[closers.length - 2] ?? '';
  const used = tail ? tail.length + 1 : 0;
  const room = max - used;
  const b = fit(body, room, Math.min(room, Math.max(0, min - used)));
  return tail ? `${b} ${tail}` : b;
}

/** Drops "(…)" qualifiers: "Thermal Properties Analyzer (Multi-Method)" -> "Thermal Properties Analyzer". */
export const plain = (s: string) => s.replace(/\s*[(（][^)）]*[)）]/g, '').replace(/\s+/g, ' ').trim();
