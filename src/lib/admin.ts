export const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

/** Strip PostgREST operator characters from free-text search. */
export const safeQ = (q: string) => q.replace(/[,()*:%\\."]/g, ' ').trim().slice(0, 60);

export const waHref = (phone: string, name?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello${name ? ` ${name}` : ''}, this is AlyTech Scientific following up on your enquiry.`)}`;

export const modeLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', datasheet: 'Datasheet', price: 'Pricing', quote: 'Quote', specs: 'Specs', interest: 'Interest',
};
