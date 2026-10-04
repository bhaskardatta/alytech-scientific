/** Company facts — single source of truth. Phone numbers are deliberately absent: the client is WhatsApp-only. */
export const site = {
  legalName: 'ALYTECH SCIENTIFIC EQUIPMENT TRADING LLC',
  name: 'AlyTech Scientific',
  url: 'https://www.alytechme.com',
  parent: 'AlyTech France',
  founded: '2015',
  email: 'alytech@alytechme.ae',
  // ponytail: placeholder until the client sends the WhatsApp Business number (digits only, intl format).
  whatsapp: '971000000000',
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
  social: {
    linkedin: 'https://www.linkedin.com/company/alytech/',
    youtube: 'https://www.youtube.com/@AlyTech-e7u',
  },
} as const;

export const waLink = (text: string) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
