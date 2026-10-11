/** Live filter for the /standards/ index: hides non-matching cards, empty publisher groups and their jump chips. */
const input = document.querySelector<HTMLInputElement>('[data-std-input]');
if (input) {
  const I = JSON.parse(document.getElementById('std-i18n')?.textContent || '{}');
  const items = [...document.querySelectorAll<HTMLElement>('[data-std-item]')];
  const groups = [...document.querySelectorAll<HTMLElement>('[data-std-group]')];
  const status = document.querySelector<HTMLElement>('[data-std-status]')!;
  const none = document.querySelector<HTMLElement>('[data-std-none]')!;
  const nav = document.querySelector<HTMLElement>('[data-std-nav]')!;
  const chips = [...document.querySelectorAll<HTMLElement>('[data-std-chip]')].map((li) => ({ li, group: document.getElementById(li.dataset.stdChip!)!, n: li.querySelector<HTMLElement>('[data-std-n]')! }));
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const hay = new Map(items.map((li) => [li, norm(li.dataset.hay || '')]));

  const apply = () => {
    const terms = norm(input.value).split(' ').filter(Boolean);
    let shown = 0;
    for (const li of items) {
      const ok = terms.every((t) => hay.get(li)!.includes(t));
      li.hidden = !ok;
      if (ok) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-std-item]:not([hidden])');
    // A chip only makes sense while its publisher still has results; its number follows the filter.
    for (const c of chips) { c.li.hidden = c.group.hidden; c.n.textContent = String(c.group.querySelectorAll('[data-std-item]:not([hidden])').length); }
    nav.hidden = shown === 0;
    none.hidden = shown > 0;
    status.textContent = terms.length ? String(I.count || '{n}').replace('{n}', String(shown)) : '';
  };
  input.addEventListener('input', apply);
}
