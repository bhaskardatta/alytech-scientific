/**
 * Company facts — single source of truth. Phone numbers are deliberately absent: the client is WhatsApp-only.
 * `whatsapp` and `email` are only the DEFAULTS: owners change them in /admin/settings/ and the pages read them through src/lib/settings.ts.
 */
export const site = {
  legalName: 'ALYTECH SCIENTIFIC EQUIPMENT TRADING LLC',
  name: 'AlyTech Scientific',
  url: 'https://www.alytechme.com',
  founded: '2015',
  email: 'alytech@alytechme.ae',
  // ponytail: placeholder until the client sends the WhatsApp Business number (digits only, intl format).
  whatsapp: '971501811657',
  address: {
    street: 'Mussafah M40',
    poBox: 'PO Box 8909',
    city: 'Abu Dhabi',
    country: 'United Arab Emirates',
    countryCode: 'AE',
  },
  geo: { lat: 24.3515556, lng: 54.4871667 },
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=24.3515556,54.4871667',
  certifications: ['ISO 9001'],
} as const;
