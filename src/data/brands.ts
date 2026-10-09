/** The nine principals (Tier 1). Claim wording is legally approved by the client — do not edit without them. */
export interface Brand {
  slug: string;
  name: string;
  country: { en: string; ar: string };
  discipline: { en: string; ar: string };
  /** Exclusive territory, if any. Everything else is "Authorized Distributor". */
  exclusive?: { en: string; ar: string };
  url: string;
}

export const brands: Brand[] = [
  {
    slug: 'gasmix', name: 'GasMix', url: 'https://gasmix.com',
    country: { en: 'France', ar: 'فرنسا' },
    discipline: { en: 'Gas mixing & dilution', ar: 'خلط الغازات وتخفيفها' },
    exclusive: { en: 'Exclusive distributor · Middle East', ar: 'موزع حصري · الشرق الأوسط' },
  },
  {
    slug: 'thermtest', name: 'Thermtest', url: 'https://thermtest.com',
    country: { en: 'Canada', ar: 'كندا' },
    discipline: { en: 'Thermal conductivity & thermal properties', ar: 'الموصلية الحرارية والخواص الحرارية' },
  },
  {
    slug: 'proto', name: 'Proto XRD', url: 'https://www.protoxrd.com',
    country: { en: 'USA & Canada', ar: 'الولايات المتحدة وكندا' },
    discipline: { en: 'X-ray diffraction & residual stress', ar: 'حيود الأشعة السينية والإجهاد المتبقي' },
  },
  {
    slug: 'ducom', name: 'Ducom Instruments', url: 'https://www.ducom.com',
    country: { en: 'India', ar: 'الهند' },
    discipline: { en: 'Tribology — friction & wear', ar: 'علم الاحتكاك — الاحتكاك والتآكل' },
  },
  {
    slug: 'instrotek', name: 'InstroTek', url: 'https://www.instrotek.com',
    country: { en: 'USA', ar: 'الولايات المتحدة' },
    discipline: { en: 'Asphalt, concrete & soil testing', ar: 'اختبار الأسفلت والخرسانة والتربة' },
  },
  {
    slug: 'f-dgs', name: 'F-DGS', url: 'https://www.f-dgs.com',
    country: { en: 'France', ar: 'فرنسا' },
    discipline: { en: 'Laboratory gas generators', ar: 'مولدات الغاز المخبرية' },
  },
  {
    slug: 'schmidt-haensch', name: 'Schmidt + Haensch', url: 'https://schmidt-haensch.com',
    country: { en: 'Germany', ar: 'ألمانيا' },
    discipline: { en: 'Polarimetry, refractometry & density', ar: 'قياس الاستقطاب والانكسار والكثافة' },
  },
  {
    slug: 'lamy-rheology', name: 'Lamy Rheology', url: 'https://www.lamyrheology.com/en/',
    country: { en: 'France', ar: 'فرنسا' },
    discipline: { en: 'Viscometers & rheometers', ar: 'مقاييس اللزوجة والريولوجيا' },
  },
  {
    slug: 'vinci', name: 'Vinci Technologies', url: 'https://www.vinci-technologies.com',
    country: { en: 'France', ar: 'فرنسا' },
    discipline: { en: 'Core analysis, PVT & reservoir testing', ar: 'تحليل العينات اللبية واختبارات PVT والمكامن' },
    exclusive: { en: 'Exclusive distributor · Qatar', ar: 'موزع حصري · قطر' },
  },
];

export const claim = (b: Brand) => b.exclusive ?? { en: 'Authorized distributor', ar: 'موزع معتمد' };
/** Mandated Tier-1 wording (CLAUDE.md), shown on every brand hub page. "Exclusive" stays separate: only GasMix and Vinci Technologies (Qatar). */
export const claimFull = { en: 'Authorized Distributor · Supplied & supported by AlyTech', ar: 'موزع معتمد · توريد ودعم من AlyTech' };
