/** Admin panel behaviour: collapsible menu, copy-to-clipboard, trend chart tooltips. Everything works as plain HTML without it. */

// ---------- menu (below 1280px) ----------
document.querySelectorAll<HTMLButtonElement>('[data-admin-menu]').forEach((btn) => {
  const panel = document.getElementById(btn.getAttribute('aria-controls')!)!;
  const set = (open: boolean) => { btn.setAttribute('aria-expanded', String(open)); panel.classList.toggle('hidden', !open); };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
});

// ---------- copy buttons (temporary passwords) ----------
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy!); btn.textContent = 'Copied'; } catch { btn.textContent = 'Select and copy it by hand'; }
    setTimeout(() => (btn.textContent = label), 2500);
  });
});

// ---------- trend charts: one crosshair + one tooltip across the stacked panels ----------
interface TrendData { labels: string[]; series: { name: string; color: string; values: number[] }[]; x0: number; step: number; w: number }

document.querySelectorAll<HTMLElement>('[data-trend]').forEach((root) => {
  const data: TrendData = JSON.parse(root.querySelector('script[type="application/json"]')!.textContent!);
  const tt = root.querySelector<HTMLElement>('.tt')!;
  const panels = [...root.querySelectorAll<SVGSVGElement>('svg[data-panel]')];
  const n = data.labels.length;
  let at = -1;

  const hide = () => { at = -1; tt.hidden = true; panels.forEach((p) => p.querySelectorAll('[data-cross]').forEach((el) => el.setAttribute('visibility', 'hidden'))); };

  function show(i: number, anchor: SVGSVGElement) {
    at = Math.max(0, Math.min(n - 1, i));
    const x = data.x0 + at * data.step;
    panels.forEach((p, k) => {
      p.querySelectorAll('[data-cross]').forEach((el) => el.setAttribute('visibility', 'visible'));
      p.querySelector('[data-cross="line"]')!.setAttribute('x1', String(x));
      p.querySelector('[data-cross="line"]')!.setAttribute('x2', String(x));
      const dot = p.querySelector('[data-cross="dot"]')!;
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(Number(p.dataset.baseY) - (data.series[k].values[at] / Number(p.dataset.max)) * Number(p.dataset.plotH)));
    });
    const head = document.createElement('p');
    head.className = 'mb-1 text-[12px] text-white/70';
    head.textContent = data.labels[at];
    const rows = data.series.map((s) => {
      const row = document.createElement('p');
      row.className = 'flex items-center gap-2';
      const key = document.createElement('span');
      key.className = 'inline-block h-[3px] w-3 shrink-0 rounded-full';
      key.style.background = s.color; // CSSOM, not a style attribute: allowed by the CSP
      const val = document.createElement('b');
      val.textContent = new Intl.NumberFormat('en-GB').format(s.values[at]);
      const name = document.createElement('span');
      name.className = 'text-white/70';
      name.textContent = s.name;
      row.append(key, val, name);
      return row;
    });
    tt.replaceChildren(head, ...rows);
    tt.hidden = false;
    const box = root.getBoundingClientRect(), svg = anchor.getBoundingClientRect();
    const px = svg.left - box.left + (x / data.w) * svg.width;
    tt.style.left = `${px > box.width * 0.6 ? px - tt.offsetWidth - 12 : px + 12}px`;
    tt.style.top = `${svg.top - box.top + 4}px`;
  }

  panels.forEach((p) => {
    p.querySelector('.hit')!.addEventListener('pointermove', (e) => {
      const r = p.getBoundingClientRect();
      const vx = ((e as PointerEvent).clientX - r.left) / r.width * data.w;
      show(n === 1 ? 0 : Math.round((vx - data.x0) / data.step), p);
    });
    p.querySelector('.hit')!.addEventListener('pointerleave', hide);
  });
  root.addEventListener('focus', () => show(n - 1, panels[0]));
  root.addEventListener('blur', hide);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return hide();
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -n : e.key === 'End' ? n : 0;
    if (!d) return;
    e.preventDefault();
    show(at < 0 ? n - 1 : at + d, panels[0]);
  });
});
