/** Live filter for the /standards/ index: hides non-matching cards and empty publisher groups. */
const input = document.querySelector<HTMLInputElement>('[data-std-input]');
if (input) {
  const I = JSON.parse(document.getElementById('std-i18n')?.textContent || '{}');
  const items = [...document.querySelectorAll<HTMLElement>('[data-std-item]')];
  const groups = [...document.querySelectorAll<HTMLElement>('[data-std-group]')];
  const status = document.querySelector<HTMLElement>('[data-std-status]')!;
  const none = document.querySelector<HTMLElement>('[data-std-none]')!;
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
    none.hidden = shown > 0;
    status.textContent = terms.length ? String(I.count || '{n}').replace('{n}', String(shown)) : '';
  };
  input.addEventListener('input', apply);
}
