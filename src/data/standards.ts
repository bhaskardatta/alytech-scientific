/**
 * Test-standards hub: one entry per standard that gets its own page (/standards/<slug>/).
 *
 * Source of truth for WHICH instruments belong to a standard is the Tier-1 catalogue (`standards` arrays in
 * src/data/catalog/*.json) plus the Tier-2 category standards in equipment.json. This file only holds the
 * verified official title and our own plain-language summary for each standard that qualifies for a page.
 *
 * Inclusion rules (do not relax without re-verifying):
 *  - a specific designation (organisation + number), not a bare organisation ("ASTM", "OIML", "ICUMSA");
 *  - a test method, practice, guide or specification, not a mark or regulation (CE, 21 CFR Part 11, UL, CSA);
 *  - official title confirmed on the publisher's page or a national-body catalogue (URL in the comment above
 *    each entry); anything unconfirmed, withdrawn or superseded is left out;
 *  - summaries are original paraphrases of the scope, never text from the standard, and make no compliance claim.
 *
 * Titles are the editions read on 9 Oct 2026. ISO pages could not be fetched from iso.org itself (403 to
 * automated clients), so ISO/EN titles were read from BSI, Austrian Standards, iTeh or SIS catalogue pages that
 * reproduce the ISO title; those entries say "national-body catalogue".
 */
import { allProducts, type Product } from './catalog';
import type { Brand } from './brands';
import { categories as tier2, type Category, type Family } from './equipment';
import { industries, type Industry } from './industries';

type Bi = { en: string; ar: string };

export type OrgKey = 'ASTM' | 'ISO' | 'EN' | 'DIN' | 'AASHTO' | 'IEEE' | 'IP' | 'JIS' | 'GB/T' | 'CEC' | 'JSMS' | 'JPI';

/** Display order on the index page. */
export const orgOrder: OrgKey[] = ['ASTM', 'ISO', 'EN', 'DIN', 'AASHTO', 'IP', 'IEEE', 'JIS', 'GB/T', 'CEC', 'JSMS', 'JPI'];
export const orgs: Record<OrgKey, { name: Bi }> = {
  ASTM: { name: { en: 'ASTM International', ar: 'ASTM الدولية' } },
  ISO: { name: { en: 'ISO', ar: 'ISO (المنظمة الدولية للتوحيد القياسي)' } },
  EN: { name: { en: 'European Standards (EN)', ar: 'المعايير الأوروبية (EN)' } },
  DIN: { name: { en: 'DIN', ar: 'DIN (المعهد الألماني للتوحيد القياسي)' } },
  AASHTO: { name: { en: 'AASHTO', ar: 'AASHTO (الرابطة الأمريكية لمسؤولي الطرق السريعة والنقل)' } },
  IP: { name: { en: 'Energy Institute (IP methods)', ar: 'معهد الطاقة (طرق IP)' } },
  IEEE: { name: { en: 'IEEE', ar: 'IEEE' } },
  JIS: { name: { en: 'Japanese Industrial Standards (JIS)', ar: 'المعايير الصناعية اليابانية (JIS)' } },
  'GB/T': { name: { en: 'China national standards (GB/T)', ar: 'المعايير الوطنية الصينية (GB/T)' } },
  CEC: { name: { en: 'CEC (Coordinating European Council)', ar: 'CEC (المجلس الأوروبي المنسِّق)' } },
  JSMS: { name: { en: 'Society of Materials Science, Japan (JSMS)', ar: 'جمعية علوم المواد اليابانية (JSMS)' } },
  JPI: { name: { en: 'Japan Petroleum Institute (JPI)', ar: 'معهد البترول الياباني (JPI)' } },
};

/** What the instruments are called in the page headline ("ASTM D5334 test equipment"). */
export type EquipKey = 'test' | 'mixing' | 'generators' | 'calgas';
export const equipLabel: Record<EquipKey, Bi> = {
  test: { en: 'test equipment', ar: 'أجهزة اختبار' },
  mixing: { en: 'gas mixing equipment', ar: 'أجهزة خلط الغازات' },
  generators: { en: 'gas generators', ar: 'مولدات الغاز' },
  calgas: { en: 'calibration gas equipment', ar: 'معدات غازات المعايرة' },
};

export interface Standard {
  /** Base designation without year or edition, e.g. "ASTM D5334". */
  designation: string;
  /** URL segment, e.g. "astm-d5334". */
  slug: string;
  org: OrgKey;
  /** Official title, as published (English). */
  title: string;
  /** Our own plain-language summary. */
  summary: Bi;
  equip: EquipKey;
  /** Tier-1 products the catalogue lists against this standard. */
  products: { brand: Brand; product: Product }[];
  /** Tier-2 (unbranded) categories that reference it. */
  categories: { family: Family; category: Category }[];
  /** Industries of those products, most common first. */
  industries: Industry[];
  /** Other standards sharing at least one product, closest first. */
  related: string[];
}

export const standardPath = (s: Pick<Standard, 'slug'>) => `/standards/${s.slug}/`;
export const slugify = (designation: string) => designation.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Reduces a raw catalogue string to its base designation:
 * "ASTM D5334-22a" -> "ASTM D5334", "ISO 22007-2:2022" -> "ISO 22007-2", "AASHTO T283 (TSR)" -> "AASHTO T 283",
 * "ASTM C136/C136M" -> "ASTM C136", "CEC L-45-A-99 (KRL option)" -> "CEC L-45-99".
 */
export function normalizeStandard(raw: string): string {
  let x = raw.replace(/\s*\([^)]*\)/g, '').replace(/\s+Procedure\s+[A-C]\b/i, '').replace(/\s+/g, ' ').trim();
  x = x.replace(/\/[A-Z]\d+M$/, ''); // dual-unit twin: D2950/D2950M
  let m: RegExpMatchArray | null;
  if ((m = x.match(/^ASTM ([A-Z]) ?(\d+)(?:-\d{2}[a-z]?)?$/))) return `ASTM ${m[1]}${m[2]}`;
  if ((m = x.match(/^AASHTO (T|R|TP) ?(\d+)$/))) return `AASHTO ${m[1]} ${m[2]}`;
  if ((m = x.match(/^(ISO|EN) (\d+(?:-\d+)?)(?::\d{4})?$/))) return `${m[1]} ${m[2]}`;
  if ((m = x.match(/^IEEE (\d+)-\d{4}$/))) return `IEEE ${m[1]}`;
  if ((m = x.match(/^GB\/T (\d+)-\d{4}$/))) return `GB/T ${m[1]}`;
  if ((m = x.match(/^JIS ([A-Z]) ?(\d+(?:-\d+)?)$/))) return `JIS ${m[1]} ${m[2]}`;
  if (/^CEC L-45(?:-A)?-99$/.test(x)) return 'CEC L-45-99';
  return x;
}

/** "GB/T 32064" -> GB/T, "JPI-5S-50-98" -> JPI, "DIN ISO 7148-1" -> DIN. */
const orgOf = (d: string) => d.split(/[ -]/)[0] as OrgKey;

type Base = Pick<Standard, 'designation' | 'slug' | 'org' | 'title' | 'summary' | 'equip'>;
const e = (designation: string, title: string, en: string, ar: string, equip: EquipKey = 'test'): Base =>
  ({ designation, slug: slugify(designation), org: orgOf(designation), title, summary: { en, ar }, equip });

// ---------------------------------------------------------------------------------------------------------
// Entries. The comment above each one is the page the official title was read from.
// ---------------------------------------------------------------------------------------------------------
const base: Base[] = [
  // https://www.astm.org/Standards/D5334.htm (publisher; D5334-22ae1)
  e("ASTM D5334", "Standard Test Method for Determination of Thermal Conductivity of Soil and Rock by Thermal Needle Probe Procedure",
    "Measures the thermal conductivity of intact or reconstituted soil and of rock using a thermal needle probe. A thin heated needle is pushed into the sample and the temperature rise over time gives the conductivity. It can be run in the laboratory or in the field.",
    "تقيس الموصلية الحرارية للتربة والصخور، سواء كانت سليمة أو معاد تشكيلها، بمسبار إبرة حراري. تُدخَل إبرة رفيعة مسخّنة في العينة، ويعطي ارتفاع درجة حرارتها مع الزمن قيمة الموصلية. ويمكن إجراء الاختبار في المختبر أو في الموقع."),
  // https://www.astm.org/Standards/D7896.htm (publisher; D7896-26)
  e("ASTM D7896", "Standard Test Method for Thermal Conductivity, Thermal Diffusivity, and Volumetric Heat Capacity of Engine Coolants and Related Fluids by Transient Hot Wire Liquid Thermal Conductivity Method",
    "Measures thermal conductivity, thermal diffusivity and volumetric heat capacity of liquids such as engine coolants. A transient hot-wire sensor is immersed in the sample in the laboratory, and heat capacity is derived from the other two results. It is a method for liquids, not for solids.",
    "تقيس الموصلية الحرارية والانتشارية الحرارية والسعة الحرارية الحجمية للسوائل مثل سوائل تبريد المحركات. يُغمَر في العينة مستشعر سلك ساخن عابر داخل المختبر، وتُشتق السعة الحرارية من النتيجتين الأخريين. وهي طريقة للسوائل وليست للمواد الصلبة."),
  // https://astm.org/Standards/D2950.htm (publisher; D2950/D2950M-22)
  e("ASTM D2950", "Standard Test Method for Density of Asphalt Mixtures in Place by Nuclear Methods",
    "Determines the in-place density of compacted asphalt mixtures from the attenuation of gamma radiation measured by a nuclear gauge. The gauge works in backscatter mode, or in direct transmission with the source or detector placed at depths of up to 300 mm.",
    "تحدد الكثافة في الموقع للخلائط الأسفلتية المدموكة من تخامد إشعاع غاما الذي يقيسه مقياس نووي. يعمل المقياس بنمط الارتداد (الاستطارة العكسية) أو بالنفاذ المباشر مع وضع المصدر أو الكاشف على عمق يصل إلى 300 mm."),
  // https://www.astm.org/Standards/D2266.htm (publisher; D2266-23)
  e("ASTM D2266", "Standard Test Method for Wear Preventive Characteristics of Lubricating Grease (Four-Ball Method)",
    "Evaluates how well a lubricating grease prevents wear in sliding steel-on-steel contact, using the four-ball wear machine. The result is a measurement of the wear scar left on the balls. It is not intended to rate extreme-pressure behaviour, which ASTM D2596 covers.",
    "تقيّم مدى منع الشحم المزلّق للتآكل في التلامس الانزلاقي بين الفولاذ والفولاذ باستخدام آلة الكرات الأربع، والنتيجة قياس لأثر التآكل على الكرات. وهي لا تهدف إلى تقدير سلوك الضغط الشديد الذي تتناوله الطريقة ASTM D2596."),
  // https://www.astm.org/Standards/D2596.htm (publisher; D2596-26)
  e("ASTM D2596", "Standard Test Method for Measurement of Extreme-Pressure Properties of Lubricating Grease (Four-Ball Method)",
    "Determines the load-carrying, or extreme-pressure, properties of lubricating greases on a four-ball EP tester. Results are reported as a load-wear index, a weld point and the last non-seizure load. Fluid lubricants are covered by ASTM D2783.",
    "تحدد قدرة الشحوم المزلّقة على تحمّل الأحمال، أي خصائص الضغط الشديد، على جهاز الكرات الأربع الخاص بالضغط الشديد. وتُسجَّل النتائج بوصفها مؤشر الحمل والتآكل ونقطة اللحام وآخر حمل دون التصاق. أما السوائل المزلّقة فتتناولها الطريقة ASTM D2783."),
  // https://www.astm.org/Standards/D2783.htm (publisher; D2783-25)
  e("ASTM D2783", "Standard Test Method for Measurement of Extreme-Pressure Properties of Lubricating Fluids (Four-Ball Method)",
    "Determines the load-carrying, or extreme-pressure, properties of lubricating fluids on a four-ball EP tester, giving a load-wear index and a weld point. Greases are tested under ASTM D2596 instead.",
    "تحدد قدرة السوائل المزلّقة على تحمّل الأحمال، أي خصائص الضغط الشديد، على جهاز الكرات الأربع الخاص بالضغط الشديد، وتعطي مؤشر الحمل والتآكل ونقطة اللحام. أما الشحوم فتُختبر وفق ASTM D2596."),
  // https://www.astm.org/Standards/D4172.htm (publisher; D4172-25)
  e("ASTM D4172", "Standard Test Method for Wear Preventive Characteristics of Lubricating Fluid (Four-Ball Method)",
    "Gives a preliminary ranking of the anti-wear properties of fluid lubricants in sliding contact, using the four-ball wear test machine. Greases run on the same machine are covered by ASTM D2266.",
    "تعطي ترتيباً أولياً لخصائص مقاومة التآكل في السوائل المزلّقة في التلامس الانزلاقي باستخدام آلة اختبار التآكل ذات الكرات الأربع. أما الشحوم التي تُختبر على الآلة نفسها فتتناولها الطريقة ASTM D2266."),
  // https://www.astm.org/Standards/D5183.htm (publisher; D5183-25)
  e("ASTM D5183", "Standard Test Method for Determination of the Coefficient of Friction of Lubricants Using the Four-Ball Wear Test Machine",
    "Determines the coefficient of friction of a lubricant by running it in the four-ball wear test machine. It lets you compare how much friction different lubricants produce under the same test conditions.",
    "تحدد معامل الاحتكاك لمادة تزليق بتشغيلها في آلة اختبار التآكل ذات الكرات الأربع. وتتيح مقارنة مقدار الاحتكاك الذي تعطيه مواد تزليق مختلفة في ظروف الاختبار نفسها."),
  // https://www.astm.org/Standards/D5930.htm (publisher; D5930-26)
  e("ASTM D5930", "Standard Test Method for Thermal Conductivity of Plastics by Transient Line-Source Technique",
    "Measures the thermal conductivity of plastics, filled or unfilled, including thermoplastics, thermosets and rubbers, with a transient line-source probe. It suits materials from about 0.08 to 10 W/m·K and temperatures from −40 to 450 °C.",
    "تقيس الموصلية الحرارية للبلاستيك، المملوء وغير المملوء، ويشمل ذلك اللدائن الحرارية والمتصلبة حرارياً والمطاط، بمسبار مصدر خطي عابر. وتناسب مواد تتراوح موصليتها بين نحو 0.08 و10 W/m·K ودرجات حرارة من ‎−40 إلى 450 °C."),
  // https://www.astm.org/Standards/D6938.htm (publisher; D6938-23)
  e("ASTM D6938", "Standard Test Methods for In-Place Density and Water Content of Soil and Soil-Aggregate by Nuclear Methods (Shallow Depth)",
    "Measures the in-place density and surface moisture content of soil and soil-aggregate with a nuclear density and moisture gauge. Density can be read by direct transmission, backscatter or backscatter with an air gap, which makes it a common way to check compaction in the field.",
    "تقيس الكثافة في الموقع ومحتوى الرطوبة السطحي للتربة والركام الترابي بمقياس نووي للكثافة والرطوبة. وتُقرأ الكثافة بالنفاذ المباشر أو بالارتداد أو بالارتداد مع فجوة هوائية، وهي طريقة شائعة للتحقق من الدمك في الموقع."),
  // https://www.astm.org/Standards/D7013.htm (publisher; D7013/D7013M-24)
  e("ASTM D7013", "Standard Guide for Calibration Facility Setup for Nuclear Surface Gauges",
    "A guide to setting up a facility, either a shielded bay or an unshielded area, in which nuclear surface density and moisture gauges can be calibrated. It describes the facility, not the calibration procedure itself.",
    "دليل لتجهيز منشأة، سواء كانت حجرة محمية بدروع أو منطقة غير محمية، تُعاير فيها مقاييس الكثافة والرطوبة النووية السطحية. ويصف الدليل المنشأة وليس إجراء المعايرة نفسه."),
  // https://www.astm.org/Standards/D7759.htm (publisher; D7759/D7759M-21)
  e("ASTM D7759", "Standard Guide for Nuclear Surface Moisture and Density Gauge Calibration",
    "A guide to calibrating a nuclear surface moisture and density gauge by relating the response of its density system to known density standards. It also explains how to verify the gauge's readings afterwards.",
    "دليل لمعايرة مقياس نووي سطحي للرطوبة والكثافة بربط استجابة منظومة الكثافة فيه بمعايير كثافة معلومة، ويشرح كذلك كيفية التحقق من قراءات المقياس بعد المعايرة."),
  // https://www.astm.org/Standards/D1218.htm (publisher; D1218-21)
  e("ASTM D1218", "Standard Test Method for Refractive Index and Refractive Dispersion of Hydrocarbon Liquids",
    "Measures the refractive index of transparent, light-coloured hydrocarbon liquids between 1.3300 and 1.5000 at 20 to 30 °C. The manual procedure also gives refractive dispersion.",
    "تقيس معامل الانكسار للسوائل الهيدروكربونية الشفافة فاتحة اللون بين 1.3300 و1.5000 عند درجات حرارة من 20 إلى 30 °C، وتعطي الإجراءات اليدوية كذلك التشتت الانكساري."),
  // https://www.astm.org/Standards/D2041.htm (publisher; D2041/D2041M-26e1)
  e("ASTM D2041", "Standard Test Method for Theoretical Maximum Specific Gravity and Density of Asphalt Mixtures",
    "Determines the theoretical maximum specific gravity and density of loose, uncompacted asphalt mixtures at 25 °C. This void-free reference value is what air-void calculations on compacted mixtures are measured against.",
    "تحدد أقصى كثافة نوعية نظرية وكثافة الخلائط الأسفلتية السائبة غير المدموكة عند 25 °C. وهذه القيمة الخالية من الفراغات هي المرجع الذي تُحسب بالنسبة إليه نسب الفراغات الهوائية في الخلائط المدموكة."),
  // https://www.astm.org/Standards/D2500.htm (publisher; D2500-23)
  e("ASTM D2500", "Standard Test Method for Cloud Point of Petroleum Products and Liquid Fuels",
    "Determines the cloud point of petroleum products and biodiesel that are transparent in 40 mm layers and cloud below 49 °C. The sample is cooled in a manual bath and checked by eye until wax crystals first cloud it.",
    "تحدد نقطة التعكر للمنتجات البترولية والديزل الحيوي التي تكون شفافة في طبقة سماكتها 40 mm وتتعكر دون 49 °C. تُبرَّد العينة يدوياً وتُراقَب بالعين حتى تظهر أول بلورات شمعية تعكّرها."),
  // https://www.astm.org/Standards/D3702.htm (publisher; D3702-24)
  e("ASTM D3702", "Standard Test Method for Wear Rate and Coefficient of Friction of Materials in Self-Lubricated Rubbing Contact Using a Thrust Washer Testing Machine",
    "Determines the wear rate and coefficient of friction of self-lubricated materials in rubbing contact. A thrust-washer testing machine presses a ring-shaped specimen against a counter-face under a set load and speed.",
    "تحدد معدل التآكل ومعامل الاحتكاك للمواد ذاتية التزليق في التلامس الاحتكاكي. وتستخدم آلة اختبار بعينة على هيئة حلقة مسطحة (ثورست واشر) تُضغط على سطح مقابل تحت حمل وسرعة محددين."),
  // https://www.astm.org/Standards/D5001.htm (publisher; D5001-26)
  e("ASTM D5001", "Standard Test Method for Measurement of Lubricity of Aviation Turbine Fuels by the Ball-on-Cylinder Lubricity Evaluator (BOCLE)",
    "Assesses the lubricity of aviation turbine fuels, meaning how well the fuel protects rubbing steel surfaces from wear. It uses the ball-on-cylinder lubricity evaluator (BOCLE), either semi-automated or fully automated.",
    "تقيّم الخاصية التزليقية لوقود التوربينات الجوية، أي مدى حماية الوقود للأسطح الفولاذية المحتكة من التآكل. وتستخدم مقيّم التزليق بكرة على أسطوانة (BOCLE)، بنسخته شبه الآلية أو الآلية بالكامل."),
  // https://store.astm.org/d5220_d5220m-26.html (publisher; D5220/D5220M-26)
  e("ASTM D5220", "Standard Test Method for Water Mass per Unit Volume of Soil and Rock In-Place by the Neutron Depth Probe Method",
    "Measures the water content of soil and rock in place, as water mass per unit volume, by slowing fast neutrons. A neutron source and a thermal-neutron detector are lowered to depth inside a lined borehole.",
    "تقيس محتوى الماء في التربة والصخور في الموقع، بوصفه كتلة ماء لكل وحدة حجم، عبر إبطاء النيوترونات السريعة. يُنزَل مصدر نيوتروني وكاشف نيوترونات حرارية إلى العمق داخل ثقب حفر مبطّن."),
  // https://www.astm.org/Standards/D5771.htm (publisher; D5771-21)
  e("ASTM D5771", "Standard Test Method for Cloud Point of Petroleum Products and Liquid Fuels (Optical Detection Stepped Cooling Method)",
    "Determines the cloud point of petroleum products and biodiesel that are transparent in 40 mm layers. An automatic instrument cools the sample in steps and an optical detector spots the first clouding. It is one of three automatic cloud-point methods, with ASTM D5772 and D5773.",
    "تحدد نقطة التعكر للمنتجات البترولية والديزل الحيوي الشفافة في طبقة سماكتها 40 mm. يبرّد جهاز آلي العينة على مراحل ويرصد كاشف بصري أول تعكر. وهي إحدى ثلاث طرق آلية لنقطة التعكر مع ASTM D5772 وD5773."),
  // https://www.astm.org/Standards/D5772.htm (publisher; D5772-21)
  e("ASTM D5772", "Standard Test Method for Cloud Point of Petroleum Products and Liquid Fuels (Linear Cooling Rate Method)",
    "Determines the cloud point of petroleum products and biodiesel that are transparent in 40 mm layers. An automatic instrument cools the sample at a linear rate and detects the first clouding. It sits alongside ASTM D5771 and D5773 in the automatic cloud-point series.",
    "تحدد نقطة التعكر للمنتجات البترولية والديزل الحيوي الشفافة في طبقة سماكتها 40 mm. يبرّد جهاز آلي العينة بمعدل خطي ويرصد أول تعكر. وهي ضمن سلسلة طرق نقطة التعكر الآلية إلى جانب ASTM D5771 وD5773."),
  // https://www.astm.org/Standards/D5773.htm (publisher; D5773-21)
  e("ASTM D5773", "Standard Test Method for Cloud Point of Petroleum Products and Liquid Fuels (Constant Cooling Rate Method)",
    "Determines the cloud point of petroleum products and biodiesel that are transparent in 40 mm layers. An automatic instrument cools the sample at a constant rate and detects the first clouding. It sits alongside ASTM D5771 and D5772 in the automatic cloud-point series.",
    "تحدد نقطة التعكر للمنتجات البترولية والديزل الحيوي الشفافة في طبقة سماكتها 40 mm. يبرّد جهاز آلي العينة بمعدل ثابت ويرصد أول تعكر. وهي ضمن سلسلة طرق نقطة التعكر الآلية إلى جانب ASTM D5771 وD5772."),
  // https://www.astm.org/Standards/D5800.htm (publisher; D5800-21)
  e("ASTM D5800", "Standard Test Method for Evaporation Loss of Lubricating Oils by the Noack Method",
    "Determines the evaporation loss of lubricating oils, especially engine oils, by the Noack method, reported as percent total mass loss. The standard contains four procedures, A to D.",
    "تحدد فاقد التبخر في زيوت التزليق، ولا سيما زيوت المحركات، بطريقة نواك، ويُعبَّر عنه بنسبة الفقد الكلي في الكتلة. ويتضمن المعيار أربعة إجراءات من A إلى D."),
  // https://store.astm.org/d5853-24.html (publisher; D5853-24)
  e("ASTM D5853", "Standard Test Method for Pour Point of Crude Oils",
    "Finds the pour point of crude oil, reporting both an upper (maximum) and a lower (minimum) pour point, for crudes down to about −36 °C. Other petroleum products are tested under ASTM D97.",
    "تحدد نقطة الانسكاب للنفط الخام، وتعطي نقطتي انسكاب عليا (قصوى) ودنيا، للخامات حتى نحو ‎−36 °C. أما المنتجات البترولية الأخرى فتُختبر وفق ASTM D97."),
  // https://store.astm.org/d5950-25.html (publisher; D5950-25)
  e("ASTM D5950", "Standard Test Method for Pour Point of Petroleum Products (Automatic Tilt Method)",
    "Determines the pour point of petroleum products with an automatic instrument. It tilts the sample jar as it cools and uses an optical sensor to detect when the surface stops moving. It is not intended for crude oils.",
    "تحدد نقطة الانسكاب للمنتجات البترولية بجهاز آلي يميل وعاء العينة أثناء تبريدها ويستخدم مستشعراً بصرياً لرصد اللحظة التي يتوقف فيها سطح السائل عن الحركة. وهي غير مخصصة للنفط الخام."),
  // https://store.astm.org/d6079-26.html (publisher; D6079-26)
  e("ASTM D6079", "Standard Test Method for Evaluating Lubricity of Diesel Fuels by the High-Frequency Reciprocating Rig (HFRR)",
    "Rates the lubricity of diesel and similar middle-distillate fuels, meaning how well the fuel protects moving parts from wear. A small ball is rubbed against a disk immersed in the fuel on the high-frequency reciprocating rig (HFRR), and the wear scar is measured.",
    "تقيّم الخاصية التزليقية للديزل والوقود المماثل من المقطرات المتوسطة، أي مدى حماية الوقود للأجزاء المتحركة من التآكل. تُحَكّ كرة صغيرة بقرص مغمور في الوقود على جهاز HFRR الترددي عالي التردد، ثم يُقاس أثر التآكل."),
  // https://store.astm.org/d6667-21.html (publisher; D6667-21)
  e("ASTM D6667", "Standard Test Method for Determination of Total Volatile Sulfur in Gaseous Hydrocarbons and Liquefied Petroleum Gases by Ultraviolet Fluorescence",
    "Measures total volatile sulfur, roughly 1 to 196 mg/kg, in gaseous hydrocarbon streams and liquefied petroleum gas. The sample is burned and the resulting sulfur dioxide is detected by ultraviolet fluorescence.",
    "تقيس الكبريت المتطاير الكلي، بنحو 1 إلى 196 mg/kg، في تيارات الهيدروكربونات الغازية والغاز البترولي المسال. تُحرَق العينة ويُكشف ثاني أكسيد الكبريت الناتج بالتألق فوق البنفسجي."),
  // https://store.astm.org/d6752_d6752m-26.html (publisher; D6752/D6752M-26)
  e("ASTM D6752", "Standard Test Method for Bulk Specific Gravity and Density of Compacted Asphalt Mixtures Using Automatic Vacuum Sealing Method",
    "Determines the bulk specific gravity and density of compacted asphalt mixture specimens, laboratory or field cylinders and cubes. Each specimen is sealed in a vacuum bag and weighed in water.",
    "تحدد الكثافة النوعية الكلية والكثافة لعينات الخلائط الأسفلتية المدموكة، من أسطوانات ومكعبات مخبرية أو حقلية. تُغلَّف كل عينة في كيس مفرَّغ من الهواء وتُوزَن في الماء."),
  // https://store.astm.org/d6857_d6857m-25.html (publisher; D6857/D6857M-25)
  e("ASTM D6857", "Standard Test Method for Maximum Specific Gravity and Density of Asphalt Mixtures Using Automatic Vacuum Sealing Method",
    "Determines the maximum, or theoretical void-free, specific gravity and density of loose asphalt mixture at 25 °C. A sample is sealed in a vacuum bag to remove trapped air.",
    "تحدد أقصى كثافة نوعية نظرية، أي الخالية من الفراغات، وكثافة الخليط الأسفلتي السائب عند 25 °C، بإغلاق العينة في كيس مفرَّغ لإزالة الهواء المحبوس."),
  // https://store.astm.org/d7227_d7227m-22.html (publisher; D7227/D7227M-22)
  e("ASTM D7227", "Standard Practice for Rapid Drying of Compacted Asphalt Mixture Specimens Using Vacuum Drying Apparatus",
    "A practice for drying water-saturated, compacted asphalt specimens quickly at room temperature in a vacuum drying chamber. The specimens can then be weighed or tested without damage from heat.",
    "ممارسة لتجفيف عينات الأسفلت المدموكة المشبعة بالماء بسرعة عند درجة حرارة الغرفة داخل حجرة تجفيف مفرَّغة، بحيث يمكن وزنها أو اختبارها دون ضرر ناتج عن الحرارة."),
  // https://store.astm.org/d7688-26.html (publisher; D7688-26)
  e("ASTM D7688", "Standard Test Method for Evaluating Lubricity of Diesel Fuels by the High-Frequency Reciprocating Rig (HFRR) by Visual Observation",
    "Rates diesel-fuel lubricity on the same HFRR rubbing test as ASTM D6079, but the wear scar is judged by visual observation instead of being measured under a microscope.",
    "تقيّم الخاصية التزليقية للديزل باختبار الاحتكاك HFRR نفسه المستخدم في ASTM D6079، لكن أثر التآكل يُحكَم عليه بالملاحظة البصرية بدلاً من قياسه تحت المجهر."),
  // https://store.astm.org/d7870_d7870m-20.html (publisher; D7870/D7870M-20)
  e("ASTM D7870", "Standard Practice for Moisture Conditioning Compacted Asphalt Mixture Specimens by Using Hydrostatic Pore Pressure",
    "A practice for conditioning compacted asphalt specimens with water and cyclic hydrostatic pore pressure at elevated temperature. Moisture susceptibility is then judged by testing the conditioned specimens.",
    "ممارسة لتهيئة عينات الأسفلت المدموكة بالماء وضغط مسامي هيدروستاتيكي دوري عند درجة حرارة مرتفعة، ثم يُحكَم على الحساسية للرطوبة باختبار العينات بعد التهيئة."),
  // https://store.astm.org/d7984-21.html (publisher; D7984-21)
  e("ASTM D7984", "Standard Test Method for Measurement of Thermal Effusivity of Fabrics Using a Modified Transient Plane Source (MTPS) Instrument",
    "Measures thermal effusivity, how readily a fabric absorbs heat on contact, for woven, knitted and non-woven textiles. A guarded modified transient plane source sensor is used in dry ambient conditions, and the method needs calibration with specimens of known effusivity.",
    "تقيس الفعالية الحرارية (thermal effusivity)، أي مدى سرعة امتصاص القماش للحرارة عند التلامس، للأقمشة المنسوجة والمحبوكة وغير المنسوجة. يُستخدم مستشعر مصدر مستوٍ عابر معدَّل ومحمي في ظروف محيطة جافة، وتتطلب الطريقة معايرة بعينات معلومة الفعالية."),
  // https://store.astm.org/d8044-23.html (publisher; D8044-23)
  e("ASTM D8044", "Standard Test Method for Evaluation of Asphalt Mixture Cracking Resistance Using the Semi-Circular Bend Test (SCB) at Intermediate Temperatures",
    "Ranks the cracking resistance of laboratory-made or cored asphalt mixture at intermediate temperatures. A notched half-disk specimen is loaded in a semi-circular bend test, and the critical strain energy release rate (Jc) is derived from the load-displacement curve.",
    "تصنّف مقاومة التشقق للخليط الأسفلتي المصنوع مخبرياً أو المستخرج على هيئة لباب عند درجات حرارة متوسطة. يُحمَّل نصف قرص مشقوق في اختبار الانحناء شبه الدائري، ويُشتق معدل تحرر طاقة الإجهاد الحرج (Jc) من منحنى الحمل والإزاحة."),
  // https://store.astm.org/d8159-19.html (publisher; D8159-19)
  e("ASTM D8159", "Standard Test Method for Automated Extraction of Asphalt Binder from Asphalt Mixtures",
    "Determines how much asphalt binder is in an asphalt mixture or pavement specimen. A computer-controlled solvent extraction apparatus automates the extraction.",
    "تحدد كمية الرابط الأسفلتي في خليط أسفلتي أو عينة من الرصف، باستخدام جهاز استخلاص بالمذيب يُتحكَّم فيه بالحاسوب لأتمتة الاستخلاص."),
  // https://store.astm.org/d8225-26.html (publisher; D8225-26)
  e("ASTM D8225", "Standard Test Method for Determination of Cracking Tolerance Index of Asphalt Mixture Using the Indirect Tensile Cracking Test at Intermediate Temperature",
    "Evaluates the cracking resistance of asphalt mixture by loading gyratory specimens or cores in indirect tension at an intermediate temperature. A Cracking Tolerance Index is computed from the load-displacement curve; the test is often called IDEAL-CT.",
    "تقيّم مقاومة التشقق للخليط الأسفلتي بتحميل عينات دوّارة (جايراتوري) أو لباب في شد غير مباشر عند درجة حرارة متوسطة، ويُحسب مؤشر تحمّل التشقق من منحنى الحمل والإزاحة. ويُعرف الاختبار شائعاً باسم IDEAL-CT."),
  // https://store.astm.org/standards/d92 (publisher; D92-24)
  e("ASTM D92", "Standard Test Method for Flash and Fire Points by Cleveland Open Cup Tester",
    "Finds the flash point and fire point of petroleum products with flash points from about 79 to 400 °C. The sample is heated in an open cup and a small test flame is passed over it. Fuel oils are outside its scope.",
    "تحدد نقطة الوميض ونقطة الاشتعال للمنتجات البترولية التي تتراوح نقطة وميضها بين نحو 79 و400 °C. تُسخَّن العينة في كأس مفتوحة ويمرَّر فوقها لهب اختبار صغير. وزيوت الوقود خارج نطاقها."),
  // https://store.astm.org/standards/d93 (publisher; D93-26)
  e("ASTM D93", "Standard Test Methods for Flash Point by Pensky-Martens Closed Cup Tester",
    "Determines the flash point of petroleum products (40 to 370 °C) and biodiesel (60 to 190 °C) in a closed Pensky-Martens cup. Separate procedures cover distillate fuels and lubricating oils, residual and viscous fuels, and B100 biodiesel.",
    "تحدد نقطة الوميض للمنتجات البترولية (من 40 إلى 370 °C) والديزل الحيوي (من 60 إلى 190 °C) في كأس بنسكي-مارتنز المغلقة. وتغطي إجراءات منفصلة وقود المقطرات وزيوت التزليق، والوقود المتبقي واللزج، والديزل الحيوي B100."),
  // https://store.astm.org/d0097-17br22.html (publisher; D97-17b)
  e("ASTM D97", "Standard Test Method for Pour Point of Petroleum Products",
    "Gives the manual procedure for finding the pour point of any petroleum product, including black specimens, cylinder stock and non-distillate fuel oil. Crude oil has its own method, ASTM D5853.",
    "تعرض الإجراء اليدوي لتحديد نقطة الانسكاب لأي منتج بترولي، بما في ذلك العينات السوداء وزيوت الأسطوانات وزيت الوقود غير المقطّر. وللنفط الخام طريقته الخاصة ASTM D5853."),
  // https://store.astm.org/standards/b611 (publisher; B611-21)
  e("ASTM B611", "Standard Test Method for Determining the High Stress Abrasion Resistance of Hard Materials",
    "Ranks the high-stress abrasion resistance of cemented carbides and other hard materials, above about 55 HRC. The specimen is pressed against a rotating steel wheel while an abrasive slurry is fed between them.",
    "تصنّف مقاومة الكشط الشديد الإجهاد للكربيدات الملبّدة ولغيرها من المواد الصلبة التي تتجاوز نحو 55 HRC. تُضغط العينة على عجلة فولاذية دوّارة بينما يُغذّى بينهما ملاط كاشط."),
  // https://store.astm.org/standards/c518 (publisher; C518-21)
  e("ASTM C518", "Standard Test Method for Steady-State Thermal Transmission Properties by Means of the Heat Flow Meter Apparatus",
    "Measures steady-state heat flow through a flat slab held between two plates at different temperatures, giving thermal conductivity, thermal resistance and related properties. The apparatus is calibrated with reference specimens, so it is a comparative method.",
    "تقيس تدفق الحرارة المستقر عبر عينة مسطحة موضوعة بين لوحين مختلفين في درجة الحرارة، فتعطي الموصلية الحرارية والمقاومة الحرارية وخصائص أخرى مرتبطة بهما. ويُعاير الجهاز بعينات مرجعية، لذا فهي طريقة مقارنة."),
  // https://store.astm.org/c1784-20.html (publisher; C1784-20)
  e("ASTM C1784", "Standard Test Method for Using a Heat Flow Meter Apparatus for Measuring Thermal Storage Properties of Phase Change Materials and Products",
    "Uses a heat flow meter with flux sensors on both plates to measure how much heat a flat specimen of phase change material, or a product containing it, stores as its temperature changes. It separates sensible from latent heat. This is a dynamic test, unlike the steady-state ASTM C518.",
    "تستخدم جهاز قياس تدفق الحرارة بمستشعرات تدفق على اللوحين لقياس كمية الحرارة التي تخزنها عينة مسطحة من مادة متغيرة الطور، أو منتج يحتويها، عند تغير درجة حرارتها، وتفصل بين الحرارة المحسوسة والحرارة الكامنة. وهو اختبار ديناميكي بخلاف الطريقة المستقرة ASTM C518."),
  // https://store.astm.org/standards/c1040 (publisher; C1040/C1040M-24)
  e("ASTM C1040", "Standard Test Methods for In-Place Density of Unhardened and Hardened Concrete, Including Roller Compacted Concrete, By Nuclear Methods",
    "Determines the in-place density of fresh and hardened concrete, including roller-compacted concrete, with a nuclear gauge that uses gamma radiation. Readings are taken by direct transmission or backscatter.",
    "تحدد الكثافة في الموقع للخرسانة الطازجة والمتصلدة، بما فيها الخرسانة المدموكة بالمدحلة، بمقياس نووي يستخدم إشعاع غاما. وتؤخذ القراءات بالنفاذ المباشر أو بالارتداد."),
  // https://store.astm.org/e0915-21.html (publisher; E915-21)
  e("ASTM E915", "Standard Practice for Verifying the Alignment of X-Ray Diffraction Instruments for Residual Stress Measurement",
    "A practice for checking the alignment of an X-ray diffractometer before residual stress work. A flat, stress-free reference specimen is measured (iron powder for ferritic and martensitic steel) so that the error from misalignment can be quantified.",
    "ممارسة للتحقق من محاذاة مقياس حيود الأشعة السينية قبل قياس الإجهاد المتبقي. تُقاس عينة مرجعية مسطحة خالية من الإجهاد (مسحوق حديد للفولاذ الفريتي والمارتنزيتي) لتحديد الخطأ الناتج عن اختلال المحاذاة."),
  // https://store.astm.org/e1426-14r24.html (publisher; E1426-14)
  e("ASTM E1426", "Standard Test Method for Determining the X-Ray Elastic Constants for Use in the Measurement of Residual Stress Using X-Ray Diffraction Techniques",
    "Gives an experimental procedure for finding the X-ray elastic constants of a polycrystalline material when they are not already known. These constants link macroscopic stress to lattice strain in a chosen crystallographic direction and are needed to turn diffraction measurements into stress.",
    "تقدّم إجراءً تجريبياً لتحديد الثوابت المرنة بالأشعة السينية لمادة متعددة البلورات عندما لا تكون معروفة مسبقاً. تربط هذه الثوابت الإجهاد العياني بانفعال الشبكة البلورية في اتجاه بلوري مختار، وهي لازمة لتحويل قياسات الحيود إلى إجهاد."),
  // https://store.astm.org/e2860-20.html (publisher; E2860-20)
  e("ASTM E2860", "Standard Test Method for Residual Stress Measurement by X-Ray Diffraction for Bearing Steels",
    "Covers the measurement of macroscopic residual stress in bearing steels by X-ray diffraction. Stress tensor components are determined from interplanar-spacing measurements at several specimen orientations, for quasi-isotropic bearing steels.",
    "تغطي قياس الإجهاد المتبقي العياني في فولاذ المحامل بحيود الأشعة السينية. تُحدَّد مركبات موتّر الإجهاد من قياسات المسافة بين المستويات البلورية عند عدة اتجاهات للعينة، وذلك لفولاذ المحامل شبه المتماثل الخواص."),
  // https://store.astm.org/e3088-25.html (publisher; E3088-25)
  e("ASTM E3088", "Standard Test Methods for Thermal Conductivity and Thermal Diffusivity Using a Double-Spiral Configuration of the Transient Plane Source Method",
    "Gives three test methods for thermal conductivity and thermal diffusivity using a double-spiral transient plane source sensor, a flat element that heats the sample and reads its temperature at the same time. They cover bulk isotropic solids, anisotropic solids and thin isotropic slabs.",
    "تقدّم ثلاث طرق لقياس الموصلية والانتشارية الحرارية بمستشعر مصدر مستوٍ عابر حلزوني مزدوج، وهو عنصر مسطح يسخّن العينة ويقرأ درجة حرارتها في الوقت نفسه. وتغطي المواد الصلبة الكتلية المتماثلة الخواص، والمواد الصلبة غير المتماثلة، والألواح الرقيقة المتماثلة الخواص."),
  // https://store.astm.org/e1530-25.html (publisher; E1530-25)
  e("ASTM E1530", "Standard Test Method for Evaluating the Resistance to Thermal Transmission by the Guarded Heat Flow Meter Technique",
    "A steady-state method that gives the thermal resistance of materials under 25 mm thick, whether homogeneous, multilayer or composite. The specimen is sandwiched between two plates at different temperatures and the heat flux is measured with a guarded heat flow meter.",
    "طريقة مستقرة تعطي المقاومة الحرارية للمواد التي يقل سمكها عن 25 mm، سواء كانت متجانسة أو متعددة الطبقات أو مركبة. توضع العينة بين لوحين مختلفين في درجة الحرارة ويقاس تدفق الحرارة بمقياس تدفق حراري محمي."),
  // https://store.astm.org/g0102-23.html (publisher; G102-23)
  e("ASTM G102", "Standard Practice for Calculation of Corrosion Rates and Related Information from Electrochemical Measurements",
    "A practice that explains how to convert electrochemical results, corrosion current density or polarization resistance, into mass-loss or penetration corrosion rates for engineering alloys. It uses Faraday's law and the equivalent weight of the alloy.",
    "ممارسة تشرح كيفية تحويل النتائج الكهروكيميائية، أي كثافة تيار التآكل أو مقاومة الاستقطاب، إلى معدلات تآكل بفقد الكتلة أو بالاختراق للسبائك الهندسية، باستخدام قانون فاراداي والوزن المكافئ للسبيكة."),
  // https://store.astm.org/g0105-26.html (publisher; G105-26)
  e("ASTM G105", "Standard Test Method for Conducting Wet Sand/Rubber Wheel Abrasion Tests",
    "A laboratory test that ranks metallic materials by their resistance to scratching abrasion. A rubber-rimmed wheel turns in a wet sand slurry against a stationary specimen, and the result is reported as volume loss in mm³.",
    "اختبار مخبري يصنّف المواد المعدنية بحسب مقاومتها للتآكل الخدشي. تدور عجلة ذات إطار مطاطي في ملاط رمل رطب مقابل عينة ثابتة، وتُسجَّل النتيجة بوصفها فقداً في الحجم بوحدة mm³."),
  // https://store.astm.org/g0133-22.html (publisher; G133-22)
  e("ASTM G133", "Standard Test Method for Linearly Reciprocating Ball-on-Flat Sliding Wear",
    "Measures the sliding wear of ceramics, metals and other wear-resistant materials. A ball slides back and forth in a straight line on a flat plate, dry or lubricated, and wear is reported as the wear volumes of the ball and the flat.",
    "تقيس التآكل الانزلاقي للسيراميك والمعادن وغيرها من المواد المقاومة للتآكل. تنزلق كرة ذهاباً وإياباً في خط مستقيم على صفيحة مسطحة، جافة أو مزلّقة، ويُعبَّر عن التآكل بحجم المادة المفقودة من الكرة ومن الصفيحة."),
  // https://store.astm.org/g0059-23.html (publisher; G59-23)
  e("ASTM G59", "Standard Test Method for Conducting Potentiodynamic Polarization Resistance Measurements",
    "Gives a procedure for small-signal potentiodynamic polarization resistance measurements on a metal sample near its corrosion potential. It is used to verify potentiostat and cell set-ups, to train operators and to estimate the general corrosion rate.",
    "تقدّم إجراءً لقياس مقاومة الاستقطاب الديناميكي الجهدي بإشارة صغيرة على عينة معدنية قرب جهد تآكلها. وتُستخدم للتحقق من تجهيزات مضبط الجهد والخلية، ولتدريب المشغلين، ولتقدير معدل التآكل العام."),
  // https://store.astm.org/g0065-16r21.html (publisher; G65-16)
  e("ASTM G65", "Standard Test Method for Measuring Abrasion Using the Dry Sand/Rubber Wheel Apparatus",
    "A laboratory test that ranks metallic materials by scratching-abrasion resistance. A specimen is pressed against a rotating rubber-lined wheel while dry sand is fed between them, and the result is volume loss in mm³. Five procedures, A to E, suit different levels of resistance.",
    "اختبار مخبري يصنّف المواد المعدنية بحسب مقاومتها للتآكل الخدشي. تُضغط العينة على عجلة دوّارة مبطّنة بالمطاط بينما يُغذّى بينهما رمل جاف، والنتيجة فقد الحجم بوحدة mm³. وتناسب خمسة إجراءات من A إلى E مستويات مقاومة مختلفة."),
  // https://store.astm.org/g0077-17r22.html (publisher; G77-17)
  e("ASTM G77", "Standard Test Method for Ranking Resistance of Materials to Sliding Wear Using Block-on-Ring Wear Test",
    "Ranks pairs of materials by sliding wear. A stationary block is pressed against a rotating ring, with the lubricant or atmosphere chosen to match service conditions, and wear is reported as volume loss.",
    "تصنّف أزواج المواد بحسب التآكل الانزلاقي. تُضغط كتلة ثابتة على حلقة دوّارة مع اختيار المزلّق أو الجو المحيط بما يطابق ظروف الخدمة، ويُعبَّر عن التآكل بفقد الحجم."),
  // https://store.astm.org/g0099-23.html (publisher; G99-23)
  e("ASTM G99", "Standard Test Method for Wear and Friction Testing with a Pin-on-Disk or Ball-on-Disk Apparatus",
    "Measures wear, and optionally the coefficient of friction, of material pairs in non-abrasive sliding. A pin or a ball is loaded against a flat rotating disk.",
    "تقيس التآكل، واختيارياً معامل الاحتكاك، لأزواج المواد في الانزلاق غير الكاشط. يُحمَّل دبوس أو كرة على قرص مسطح دوّار."),
  // https://downloads.transportation.org/T%20283-22-Errata.pdf (publisher; T 283-22)
  e("AASHTO T 283", "Resistance of Compacted Asphalt Mixtures to Moisture-Induced Damage",
    "Compares the indirect tensile strength of compacted asphalt specimens kept dry with matched specimens that are vacuum-saturated, freeze-thaw conditioned and soaked in warm water. The ratio shows how susceptible the mixture is to moisture damage (stripping).",
    "تقارن مقاومة الشد غير المباشر لعينات أسفلتية مدموكة جافة بمقاومة عينات مماثلة شُبِّعت بالتفريغ وعُرِّضت لدورات تجمد وذوبان ثم نُقعت في ماء دافئ. وتدل النسبة بينهما على مدى حساسية الخليط للتلف بالرطوبة (التجريد)."),
  // https://store.transportation.org/item/publicationdetail/4864 (publisher; T 310-22)
  e("AASHTO T 310", "In-Place Density and Moisture Content of Soil and Soil-Aggregate by Nuclear Methods (Shallow Depth)",
    "Uses a nuclear gauge to measure the in-place density and moisture content of soil and soil-aggregate. Density is read by direct transmission to about 300 mm, by backscatter or by backscatter with an air gap, and moisture by slowing neutrons, giving field wet and dry density.",
    "تستخدم مقياساً نووياً لقياس الكثافة ومحتوى الرطوبة في الموقع للتربة والركام الترابي. تُقرأ الكثافة بالنفاذ المباشر حتى نحو 300 mm أو بالارتداد أو بالارتداد مع فجوة هوائية، وتُقاس الرطوبة بإبطاء النيوترونات، لتُستخرج الكثافة الرطبة والجافة في الموقع."),
  // https://store.transportation.org/Item/PublicationDetail?ID=5149 (publisher; T 324-23)
  e("AASHTO T 324", "Hamburg Wheel-Track Testing of Compacted Asphalt Mixtures",
    "Runs a submerged compacted asphalt slab or gyratory specimen under a repeatedly rolling steel wheel in a Hamburg device. It measures permanent deformation (rutting) and the susceptibility of the mixture to moisture damage.",
    "تشغّل لوحاً أسفلتياً مدموكاً أو عينة جايراتورية مغمورة تحت عجلة فولاذية تدور ذهاباً وإياباً في جهاز هامبورغ، وتقيس التشوه الدائم (التخدد) وحساسية الخليط للتلف بالرطوبة."),
  // https://store.transportation.org/Common/DownloadContentFiles?id=2374 (publisher; R 79-22)
  e("AASHTO R 79", "Vacuum Drying Compacted Asphalt Specimens",
    "A practice for drying compacted laboratory or field asphalt specimens with a vacuum device so they stay near room temperature. Drying is repeated until the change in mass between cycles is negligible.",
    "ممارسة لتجفيف عينات الأسفلت المدموكة المخبرية أو الحقلية بجهاز تفريغ بحيث تبقى قريبة من درجة حرارة الغرفة، مع تكرار التجفيف حتى يصبح التغير في الكتلة بين الدورات ضئيلاً."),
  // https://store.transportation.org/Item/PublicationDetail?ID=5494 (publisher; T 209-23)
  e("AASHTO T 209", "Theoretical Maximum Specific Gravity (Gmm) and Density of Asphalt Mixtures",
    "Determines the theoretical maximum specific gravity (Gmm, also called Rice gravity) and density of loose asphalt mixture at 25 °C. It is the reference value for air-void calculations.",
    "تحدد أقصى كثافة نوعية نظرية (Gmm، وتُسمى أيضاً كثافة رايس) وكثافة الخليط الأسفلتي السائب عند 25 °C، وهي القيمة المرجعية لحسابات الفراغات الهوائية."),
  // https://store.transportation.org/Common/DownloadContentFiles?id=2374 (publisher; T 331-23)
  e("AASHTO T 331", "Bulk Specific Gravity (Gmb) and Density of Compacted Asphalt Mixtures Using Automatic Vacuum Sealing Method",
    "Finds the bulk specific gravity and density of a compacted asphalt specimen by sealing it in an evacuated bag and weighing it in water. It is intended for specimens with open or interconnected voids or high water absorption.",
    "تحدد الكثافة النوعية الكلية والكثافة لعينة أسفلتية مدموكة بإغلاقها في كيس مفرَّغ ووزنها في الماء. وهي مخصصة للعينات ذات الفراغات المفتوحة أو المتصلة أو الامتصاص العالي للماء."),
  // https://store.transportation.org/Common/DownloadContentFiles?id=2374 (publisher; T 355-22)
  e("AASHTO T 355", "In-Place Density of Asphalt Mixtures by Nuclear Methods",
    "Uses a nuclear density gauge on the pavement surface to measure the in-place density of compacted asphalt without destroying the pavement. It is used for quality control and roller-pattern work.",
    "تستخدم مقياس كثافة نووياً على سطح الرصف لقياس الكثافة في الموقع للأسفلت المدموك دون إتلاف الرصف، وتُستعمل في ضبط الجودة وتحديد نمط عمل المدحلة."),
  // https://store.transportation.org/Common/DownloadContentFiles?id=2374 (publisher; TP 140-22)
  e("AASHTO TP 140", "Moisture Sensitivity Using Hydrostatic Pore Pressure to Determine Cohesion and Adhesion Strength of Compacted Asphalt Mixture Specimens",
    "A provisional method that conditions compacted asphalt specimens with prolonged moisture and cyclic hydrostatic pore pressure in a sealed chamber. The loss of tensile strength and the swelling are then evaluated to judge cohesion and adhesion (stripping) resistance.",
    "طريقة مؤقتة تهيّئ عينات الأسفلت المدموكة بالرطوبة المطوّلة وضغط مسامي هيدروستاتيكي دوري داخل حجرة مغلقة. ثم يُقيَّم فقد مقاومة الشد والانتفاخ للحكم على مقاومة التماسك والالتصاق (التجريد)."),
  // https://www.austrian-standards.at/en/shop/onorm-en-iso-6145-7-2019-06-15~p2477407 (national-body catalogue; ISO 6145-7:2018)
  e("ISO 6145-7", "Gas analysis — Preparation of calibration gas mixtures using dynamic methods — Part 7: Thermal mass-flow controllers",
    "Describes how to prepare calibration gas mixtures continuously by blending pure gases or premixes through thermal mass-flow controllers. It applies to components that do not react with one another, and it covers the uncertainty of the resulting mixture, down to about 2 % relative expanded uncertainty.",
    "تصف كيفية تحضير مزائج غازات المعايرة بصورة مستمرة بمزج غازات نقية أو مزائج جاهزة عبر وحدات تحكم حرارية بالتدفق الكتلي. وتنطبق على مكوّنات لا يتفاعل بعضها مع بعض، وتتناول عدم اليقين في المزيج الناتج، بنحو 2 % كعدم يقين نسبي موسَّع في أفضل الأحوال.", 'mixing'),
  // https://knowledge.bsigroup.com/products/compressed-air-contaminants-and-purity-classes (national-body catalogue; ISO 8573-1:2010)
  e("ISO 8573-1", "Compressed air — Part 1: Contaminants and purity classes",
    "Defines purity classes for compressed air, set by its content of solid particles, water and oil, and also lists gaseous and microbiological contaminants. A class is quoted for each contaminant, so the air that a generator or analyser needs can be specified and checked.",
    "تحدد فئات نقاء الهواء المضغوط بحسب محتواه من الجسيمات الصلبة والماء والزيت، وتسرد كذلك الملوثات الغازية والميكروبيولوجية. وتُذكر فئة لكل ملوث، فيمكن تحديد جودة الهواء الذي يحتاجه مولّد أو محلل والتحقق منها.", 'generators'),
  // https://www.asn.sn/en/node/49982 (national-body catalogue; ISO 8301:1991)
  e("ISO 8301", "Thermal insulation — Determination of steady-state thermal resistance and related properties — Heat flow meter apparatus",
    "Specifies the heat flow meter method for measuring steady-state heat transfer through flat slab specimens of thermal insulation. Thermal resistance and related properties are calculated from the measured heat flux and the temperature difference.",
    "تحدد طريقة مقياس تدفق الحرارة لقياس انتقال الحرارة المستقر عبر عينات مسطحة من مواد العزل الحراري، وتُحسب المقاومة الحرارية والخصائص المرتبطة بها من تدفق الحرارة المقيس وفرق درجة الحرارة."),
  // https://www.sis.se/en/produkter/rubber-and-plastic-industries/plastics/general/iso-22007-22022/ (national-body catalogue; ISO 22007-2:2022)
  e("ISO 22007-2", "Plastics — Determination of thermal conductivity and thermal diffusivity — Part 2: Transient plane heat source (hot disc) method",
    "Gives the transient plane heat source (hot disc) method for the thermal conductivity and thermal diffusivity of plastics, from which volumetric heat capacity follows. It covers isotropic and uniaxially anisotropic specimens over roughly 0.01 to 500 W/(m·K).",
    "تقدّم طريقة مصدر الحرارة المستوي العابر (القرص الساخن) لقياس الموصلية والانتشارية الحرارية للبلاستيك، وتُستنتج منها السعة الحرارية الحجمية. وتغطي عينات متماثلة الخواص وأحادية الاتجاه في مدى يقارب 0.01 إلى 500 W/(m·K)."),
  // https://cdn.standards.iteh.ai/samples/81222/271b1b7ad16d4a4ab515492c379fae0b/ISO-22007-7-2023.pdf (national-body catalogue; ISO 22007-7:2023)
  e("ISO 22007-7", "Plastics — Determination of thermal conductivity and thermal diffusivity — Part 7: Transient measurement of thermal effusivity using a plane heat source",
    "Specifies a transient plane heat source method that measures thermal effusivity, how readily a material absorbs heat on contact, rather than conductivity or diffusivity directly. It covers a wide range of effusivity values and temperatures.",
    "تحدد طريقة مصدر حرارة مستوٍ عابر تقيس الفعالية الحرارية (thermal effusivity)، أي مدى سرعة امتصاص المادة للحرارة عند التلامس، وليس الموصلية أو الانتشارية مباشرة. وتغطي مدى واسعاً من قيم الفعالية ودرجات الحرارة."),
  // https://www.dinmedia.de/en/standard/iso-20623/284007834 (national-body catalogue; ISO 20623:2017)
  e("ISO 20623", "Petroleum and related products — Determination of the extreme-pressure and anti-wear properties of lubricants — Four-ball method (European conditions)",
    "Describes a four-ball machine test, run under European test conditions, that rates the extreme-pressure (load-carrying) and anti-wear behaviour of liquid lubricants and greases. The results show how a lubricant behaves under heavy sliding load and how much wear it prevents.",
    "تصف اختباراً على آلة الكرات الأربع، يُجرى وفق الظروف الأوروبية للاختبار، يقيّم سلوك الضغط الشديد (تحمّل الأحمال) ومقاومة التآكل في زيوت التزليق السائلة والشحوم. وتبيّن النتائج سلوك المزلّق تحت أحمال انزلاق ثقيلة ومقدار التآكل الذي يمنعه."),
  // https://www.sis.se/en/produkter/petroleum-and-related-technologies/fuels/liquid-fuels/iso-12156-12023/ (national-body catalogue; ISO 12156-1:2023)
  e("ISO 12156-1", "Diesel fuel — Assessment of lubricity using the high-frequency reciprocating rig (HFRR) — Part 1: Test method",
    "Describes the HFRR bench test, read with a digital camera, that ranks the lubricating quality of diesel fuels from the wear scar on a reciprocating ball. It covers middle-distillate, paraffinic and biodiesel-blend diesel, with scar diameters of 350 to 700 µm.",
    "تصف اختبار HFRR المخبري، مع قراءة بكاميرا رقمية، الذي يرتّب جودة التزليق في وقود الديزل بحسب أثر التآكل على كرة ترددية. وتشمل ديزل المقطرات المتوسطة والبارافيني ومخاليط الديزل الحيوي، لأقطار أثر من 350 إلى 700 µm."),
  // https://knowledge.bsigroup.com/products/determination-of-flash-point-abel-closed-cup-method-2 (national-body catalogue; ISO 13736:2021)
  e("ISO 13736", "Determination of flash point — Abel closed-cup method",
    "Gives a closed-cup method using the Abel apparatus, manual or automated, for the flash point of combustible liquids from −30 to 75 °C. Precision is stated only from −8.5 to 75 °C, and water-borne paints are excluded.",
    "تقدّم طريقة الكأس المغلقة بجهاز آبل، يدوياً أو آلياً، لتحديد نقطة الوميض للسوائل القابلة للاشتعال من ‎−30 إلى 75 °C. ولا تُذكر الدقة إلا من ‎−8.5 إلى 75 °C، وتُستثنى الدهانات المائية."),
  // https://www.austrian-standards.at/en/shop/iso-14687-2025-2025-02-12~p4074055 (national-body catalogue; ISO 14687:2025)
  e("ISO 14687", "Hydrogen fuel quality — Product specification",
    "Sets the minimum quality characteristics that hydrogen fuel must meet as distributed for residential, commercial, industrial, vehicular and stationary applications. Measuring impurities against these limits relies on calibration gas mixtures.",
    "تحدد الحد الأدنى لخصائص جودة وقود الهيدروجين كما يُوزَّع للتطبيقات السكنية والتجارية والصناعية والمركبات والتطبيقات الثابتة. ويعتمد قياس الشوائب بالنسبة إلى هذه الحدود على مزائج غازات المعايرة.", 'calgas'),
  // https://www.sis.se/en/produkter/petroleum-and-related-technologies/petroluem-products-general/iso1516/ (national-body catalogue; ISO 1516:2002)
  e("ISO 1516", "Determination of flash/no flash — Closed cup equilibrium method",
    "A closed-cup equilibrium test that answers a yes-or-no question: does a paint, varnish, solvent or petroleum product give off enough vapour to ignite at one chosen temperature (flash or no flash)? Depending on the apparatus it can be used from about −30 to 110 °C.",
    "اختبار كأس مغلقة بالاتزان يجيب عن سؤال بنعم أو لا: هل يطلق الطلاء أو الورنيش أو المذيب أو المنتج البترولي بخاراً كافياً للاشتعال عند درجة حرارة واحدة مختارة (وميض أو لا وميض)؟ ويمكن استخدامه، بحسب الجهاز، من نحو ‎−30 إلى 110 °C."),
  // https://knowledge.bsigroup.com/products/petroleum-and-related-products-determination-of-flash-and-fire-points-cleveland-open-cup-method (national-body catalogue; ISO 2592:2017)
  e("ISO 2592", "Petroleum and related products — Determination of flash and fire points — Cleveland open cup method",
    "Uses the Cleveland open-cup apparatus to find the flash point and fire point of petroleum products whose open-cup flash point lies between 79 and 400 °C. Fuel oils are excluded.",
    "تستخدم جهاز كليفلاند ذا الكأس المفتوحة لتحديد نقطة الوميض ونقطة الاشتعال للمنتجات البترولية التي تقع نقطة وميضها في الكأس المفتوحة بين 79 و400 °C. وتُستثنى زيوت الوقود."),
  // https://www.austrian-standards.at/en/shop/iso-2719-2025-2025-11-21~p4585304 (national-body catalogue; ISO 2719:2025)
  e("ISO 2719", "Determination of flash point — Pensky-Martens closed cup method",
    "Gives three Pensky-Martens closed-cup procedures, A, B and C, for the flash point of combustible liquids, of liquids with suspended solids or surface films, and of biodiesel, between 40 and 370 °C.",
    "تقدّم ثلاثة إجراءات A وB وC بكأس بنسكي-مارتنز المغلقة لتحديد نقطة الوميض للسوائل القابلة للاشتعال، وللسوائل التي تحوي مواد صلبة عالقة أو أغشية سطحية، وللديزل الحيوي، بين 40 و370 °C."),
  // https://knowledge.bsigroup.com/products/petroleum-and-related-products-from-natural-or-synthetic-sources-determination-of-cloud-point (national-body catalogue; ISO 3015:2019)
  e("ISO 3015", "Petroleum and related products from natural or synthetic sources — Determination of cloud point",
    "Determines the cloud point of transparent petroleum products that cloud below 49 °C, such as diesel containing up to 30 % FAME, neat FAME and lubricants. The sample is cooled under set conditions and the temperature at which wax crystals first cloud it is recorded.",
    "تحدد نقطة التعكر للمنتجات البترولية الشفافة التي تتعكر دون 49 °C، مثل الديزل المحتوي على FAME حتى 30 % وFAME الصافي وزيوت التزليق. تُبرَّد العينة في ظروف محددة وتُسجَّل درجة الحرارة التي تعكّرها عندها بلورات الشمع أول مرة."),
  // https://knowledge.bsigroup.com/products/petroleum-and-related-products-from-natural-or-synthetic-sources-determination-of-pour-point (national-body catalogue; ISO 3016:2019)
  e("ISO 3016", "Petroleum and related products from natural or synthetic sources — Determination of pour point",
    "Determines the pour point, the lowest temperature at which a cooled petroleum product still flows. An extra procedure covers the lower pour point of fuel oils and heavy lubricant base stocks. It is not suitable for crude oils.",
    "تحدد نقطة الانسكاب، أي أدنى درجة حرارة يظل عندها المنتج البترولي المبرَّد قادراً على الجريان. ويغطي إجراء إضافي نقطة الانسكاب الدنيا لزيوت الوقود وزيوت الأساس الثقيلة. وهي غير مناسبة للنفط الخام."),
  // https://cdn.standards.iteh.ai/samples/82715/e31837ecb0264868ad144d4ade9ed8c0/ISO-3679-2022.pdf (national-body catalogue; ISO 3679:2022)
  e("ISO 3679", "Determination of flash point — Method for flash no-flash and flash point by small scale closed cup tester",
    "Describes small-scale closed-cup procedures: rapid-equilibrium flash/no-flash (A) and flash point (B) tests, plus an automated non-equilibrium flash point procedure (C). It covers paints, varnishes, adhesives, solvents, petroleum fuels and FAME.",
    "تصف إجراءات الكأس المغلقة صغيرة النطاق: اختبارا الوميض/لا وميض (A) ونقطة الوميض (B) بالاتزان السريع، وإجراء آلي لنقطة الوميض بلا اتزان (C). وتشمل الدهانات والورنيشات والمواد اللاصقة والمذيبات والوقود البترولي وFAME."),
  // https://www.austrian-standards.at/en/shop/onorm-en-12667-2025-11-01~p4518356 (national-body catalogue; EN 12667:2025)
  e("EN 12667", "Thermal performance of building materials and products - Determination of thermal resistance by means of guarded hot plate and heat flow meter methods - Products of high and medium thermal resistance",
    "Specifies guarded hot plate and heat flow meter procedures for the thermal resistance of dry building-material specimens with high or medium thermal resistance, at least 0.5 m²·K/W. The equipment operates between about −100 and +100 °C.",
    "تحدد إجراءات اللوح الساخن المحمي ومقياس تدفق الحرارة للمقاومة الحرارية لعينات جافة من مواد البناء ذات المقاومة الحرارية العالية أو المتوسطة، أي 0.5 m²·K/W فأكثر. وتعمل المعدات بين نحو ‎−100 و‎+100 °C."),
  // https://www.austrian-standards.at/en/shop/onorm-en-12664-2025-11-01~p4511507 (national-body catalogue; EN 12664:2025)
  e("EN 12664", "Thermal performance of building materials and products - Determination of thermal resistance by means of guarded hot plate and heat flow meter methods - Dry and moist products of medium and low thermal resistance",
    "The companion to EN 12667 for products of medium and low thermal resistance, at least 0.1 m²·K/W with conductivity up to 2.0 W/(m·K). Specimens are tested dry or moisture-equilibrated with guarded hot plate or heat flow meter equipment.",
    "المعيار المكمّل لـ EN 12667 للمنتجات ذات المقاومة الحرارية المتوسطة والمنخفضة، أي 0.1 m²·K/W فأكثر وبموصلية حتى 2.0 W/(m·K). وتُختبر العينات جافة أو متوازنة الرطوبة بمعدات اللوح الساخن المحمي أو مقياس تدفق الحرارة."),
  // https://knowledge.bsigroup.com/products/stationary-source-emissions-quality-assurance-of-automated-measuring-systems-1 (national-body catalogue; EN 14181:2014)
  e("EN 14181", "Stationary source emissions - Quality assurance of automated measuring systems",
    "Defines the QAL2 calibration, the QAL3 drift monitoring and the annual surveillance test procedures that keep continuous flue-gas analysers (automated measuring systems) at industrial plants fit for purpose once the instrument has been certified as suitable. Routine checks need reference gas mixtures, which is where gas dilution equipment comes in.",
    "تحدد معايرة QAL2 ومراقبة الانحراف QAL3 واختبارات المراقبة السنوية التي تُبقي محللات غازات المداخن المستمرة (أنظمة القياس الآلية) في المنشآت الصناعية صالحة للغرض بعد اعتماد ملاءمة الجهاز. وتحتاج الفحوص الدورية إلى مزائج غازية مرجعية، وهنا يأتي دور معدات تخفيف الغازات.", 'calgas'),
  // https://knowledge.bsigroup.com/products/non-destructive-testing-test-method-for-residual-stress-analysis-by-x-ray-diffraction (national-body catalogue; EN 15305:2008)
  e("EN 15305", "Non-destructive testing - Test method for residual stress analysis by X-ray diffraction",
    "Describes how to measure macroscopic residual or applied stress non-destructively in the near-surface layer of polycrystalline specimens or components, from shifts in X-ray diffraction lines. It uses angular-dispersive reflection geometry; synchrotron methods are excluded.",
    "تصف كيفية قياس الإجهاد المتبقي أو المطبَّق العياني دون إتلاف في الطبقة القريبة من السطح للعينات أو المكوّنات متعددة البلورات، من إزاحات خطوط حيود الأشعة السينية. وتستخدم هندسة انعكاس مشتتة زاوياً، وتُستثنى طرق السنكروترون."),
  // https://genorma.com/en/standards/en-590-2025 (national-body catalogue; EN 590:2025)
  e("EN 590", "Automotive fuels - Diesel - Requirements and test methods",
    "Specifies requirements and test methods for automotive diesel fuel sold and delivered for diesel-engine vehicles, including fuel containing up to 7 % (V/V) fatty acid methyl ester (FAME). Fuel lubricity, tested by HFRR, is one of the properties it limits.",
    "تحدد متطلبات وطرق اختبار وقود الديزل المخصص للمركبات والذي يُباع ويُسلَّم لمركبات محركات الديزل، بما في ذلك الوقود المحتوي على ما يصل إلى 7 % (حجماً) من مثيل استر الأحماض الدهنية (FAME). وتُعد الخاصية التزليقية، المختبرة بجهاز HFRR، من الخصائص التي تضع لها حدوداً."),
  // https://genorma.com/en/standards/en-924-2003 (national-body catalogue; EN 924:2003)
  e("EN 924", "Adhesives - Solvent-borne and solvent-free adhesives - Determination of flashpoint",
    "Determines the flashpoint of solvent-borne and solvent-free adhesives containing volatile organic compounds, using a closed-cup procedure with allowance for departures from standard atmospheric pressure. It does not apply to water-borne adhesives with less than 10 % solvent.",
    "تحدد نقطة الوميض للمواد اللاصقة ذات المذيبات أو الخالية منها والتي تحتوي على مركبات عضوية متطايرة، بإجراء الكأس المغلقة مع مراعاة الانحراف عن الضغط الجوي القياسي. ولا تنطبق على المواد اللاصقة المائية التي تقل نسبة المذيب فيها عن 10 %."),
  // https://standards.ieee.org/ieee/442/6891/ (publisher; IEEE Std 442-2017)
  e("IEEE 442", "IEEE Guide for Thermal Resistivity Measurements of Soils and Backfill Materials",
    "An IEEE guide to measuring the thermal resistivity of soil and backfill materials, including concrete, engineered backfill, grout, rock and sand, around buried cables. It uses a line-heat-source probe, in the field or on recompacted laboratory samples. It is a guide, not a test method.",
    "دليل من IEEE لقياس المقاومة الحرارية النوعية للتربة ومواد الردم، ومنها الخرسانة والردم الهندسي والمونة والصخور والرمل، حول الكابلات المدفونة. ويستخدم مسبار مصدر حرارة خطي في الموقع أو على عينات مخبرية معاد دمكها. وهو دليل وليس طريقة اختبار."),
  // https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+A+1412-2%3A1999 (publisher; JIS A 1412-1:2016; JIS A 1412-2:1999)
  e("JIS A 1412", "Test method for thermal resistance and related properties of thermal insulations",
    "A three-part Japanese standard series for the steady-state thermal resistance and thermal conductivity of insulation. Part 1 uses the guarded hot plate, Part 2 the heat flow meter on flat specimens and Part 3 a circular pipe apparatus. Heat flow meters fall under Part 2.",
    "سلسلة معايير يابانية من ثلاثة أجزاء للمقاومة الحرارية والموصلية الحرارية المستقرتين لمواد العزل. يستخدم الجزء 1 اللوح الساخن المحمي، والجزء 2 مقياس تدفق الحرارة على عينات مسطحة، والجزء 3 جهازاً بأنبوب دائري. وتندرج مقاييس تدفق الحرارة تحت الجزء 2."),
  // https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+K+2265-4%3A2007 (publisher; JIS K 2265-4:2007)
  e("JIS K 2265-4", "Determination of flash point — Part 4: Cleveland open cup method",
    "Specifies the Cleveland open-cup method for the flash point and fire point of petroleum products with a flash point above 79 °C. Crude oil and fuel oils are excluded; they are tested under JIS K 2265-3.",
    "تحدد طريقة كليفلاند بالكأس المفتوحة لنقطة الوميض ونقطة الاشتعال للمنتجات البترولية التي تتجاوز نقطة وميضها 79 °C. ويُستثنى النفط الخام وزيوت الوقود، وتُختبر وفق JIS K 2265-3."),
  // https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=08D612E74EAF82EB52EB49CA0A167F34 (publisher; GB/T 32064-2015)
  e("GB/T 32064", "Determination of thermal conductivity and thermal diffusivity of building materials: transient plane heat source method",
    "A Chinese national standard for the thermal conductivity and thermal diffusivity of building materials by the transient plane heat source method. It covers isotropic and uniaxially anisotropic materials, roughly 0.01 to 500 W/(m·K) and −50 to 300 °C.",
    "معيار وطني صيني لقياس الموصلية والانتشارية الحرارية لمواد البناء بطريقة مصدر الحرارة المستوي العابر. ويشمل المواد المتماثلة الخواص وأحادية الاتجاه، في مدى يقارب 0.01 إلى 500 W/(m·K) ومن ‎−50 إلى 300 °C."),
  // https://www.dinmedia.de/en/standard/din-51350-2/215607845 (publisher; 2015-03)
  e("DIN 51350-2", "Testing of lubricants - Testing in the four-ball tester - Part 2: Determination of welding load of liquid lubricants",
    "Part of the German four-ball series. It finds the loads at which a liquid extreme-pressure oil, additised and liquid at room temperature, stays acceptable and then welds the balls together in the four-ball machine.",
    "جزء من سلسلة آلة الكرات الأربع الألمانية. يحدد الأحمال التي يبقى عندها الزيت السائل المحتوي على إضافات الضغط الشديد، في درجة حرارة الغرفة، مقبولاً ثم تلحم عندها الكرات ببعضها في آلة الكرات الأربع."),
  // https://www.dinmedia.de/en/standard/din-51350-3/215609354 (publisher; 2015-03)
  e("DIN 51350-3", "Testing of lubricants - Testing in the four-ball tester - Part 3: Determination of wearing characteristics of liquid lubricants",
    "Rates the anti-wear behaviour of lubricants that are liquid at room temperature by the size of the wear crater left on the balls in a four-ball tester.",
    "يقيّم سلوك مقاومة التآكل في المزلّقات السائلة في درجة حرارة الغرفة بحسب حجم فوهة التآكل المتكونة على الكرات في آلة الكرات الأربع."),
  // https://www.dinmedia.de/en/standard/din-51350-4/215610530 (publisher; 2015-03)
  e("DIN 51350-4", "Testing of lubricants - Testing in the four-ball tester - Part 4: Determination of welding load of consistent lubricants",
    "Finds the load-carrying limits, namely the acceptable load and the welding load, of additive-containing greases of NLGI grade 3 and softer in a four-ball tester.",
    "يحدد حدود تحمّل الأحمال، أي الحمل المقبول وحمل اللحام، للشحوم المحتوية على إضافات من الدرجة 3 وفق NLGI أو الأكثر ليونة في آلة الكرات الأربع."),
  // https://dinmedia.de/en/standard/din-51350-5/215611468 (publisher; 2015-03)
  e("DIN 51350-5", "Testing of lubricants - Testing in the four-ball tester - Part 5: Determination of wearing characteristics for consistent lubricants",
    "Rates the anti-wear behaviour of greases containing wear-reducing additives by the diameter of the wear crater produced in a four-ball tester.",
    "يقيّم سلوك مقاومة التآكل في الشحوم المحتوية على إضافات مخفِّضة للتآكل بحسب قطر فوهة التآكل المتكونة في آلة الكرات الأربع."),
  // https://dinmedia.de/en/standard/din-51350-6/2796974 (publisher; 1996-08)
  e("DIN 51350-6", "Testing of lubricants - Testing in the Shell four-ball tester - Part 6: Determination of shear stability of lubricating oils containing polymers",
    "Determines how much a lubricating oil containing polymer (viscosity-modifier) additives is permanently thinned by mechanical shear, using the Shell four-ball apparatus.",
    "يحدد مقدار الانخفاض الدائم في لزوجة زيت التزليق المحتوي على إضافات بوليمرية (محسّنات اللزوجة) بفعل القص الميكانيكي باستخدام جهاز شل ذي الكرات الأربع."),
  // https://www.dinmedia.de/en/standard/din-iso-7148-1/206430916 (publisher; 2014-07)
  e("DIN ISO 7148-1", "Plain bearings - Testing of the tribological behaviour of bearing materials - Part 1: Testing of bearing metals (ISO 7148-1:2012)",
    "Specifies a tribological test of metallic plain-bearing materials under boundary lubrication, so that friction and wear of different combinations of bearing material, counterpart and lubricant can be compared.",
    "تحدد اختباراً ترايبولوجياً لمواد المحامل الانزلاقية المعدنية تحت التزليق الحدّي، لمقارنة الاحتكاك والتآكل لتوليفات مختلفة من مادة المحمل والسطح المقابل والمزلّق."),
  // https://dinmedia.de/en/standard/din-iso-7148-2/206430943 (publisher; 2014-07)
  e("DIN ISO 7148-2", "Plain bearings - Testing of the tribological behaviour of bearing materials - Part 2: Testing of polymer-based plain bearing materials (ISO 7148-2:2012)",
    "Specifies tribological tests of polymer-based plain-bearing materials at set load, speed and temperature, run dry and lubricated, to obtain friction and wear values.",
    "تحدد اختبارات ترايبولوجية لمواد المحامل الانزلاقية البوليمرية عند حمل وسرعة ودرجة حرارة محددة، جافة ومزلّقة، للحصول على قيم الاحتكاك والتآكل."),
  // https://cectests.org/test-methods-publications (publisher; CEC L-45-99)
  e("CEC L-45-99", "Viscosity Shear Stability of Transmission Lubricants (Taper Roller Bearing Rig)",
    "Measures how much a transmission or gear lubricant loses viscosity through mechanical shearing when run in a tapered roller bearing rig, a test often known as the KRL test.",
    "تقيس مقدار ما يفقده مزلّق ناقل الحركة (التروس) من لزوجته بفعل القص الميكانيكي عند تشغيله في جهاز محمل أسطواني مخروطي، ويُعرف الاختبار غالباً باسم اختبار KRL."),
  // https://x-ray.jsms.jp/standard/ (publisher; 2005)
  e("JSMS-SD-10-05", "Standard Method for X-Ray Stress Measurement",
    "An English-language edition from the Society of Materials Science, Japan, that merges its separate steel and ceramics standards for X-ray stress measurement into one 21-page document. It is a reference for laboratories that measure residual stress by X-ray diffraction.",
    "إصدار بالإنجليزية من جمعية علوم المواد اليابانية يجمع معاييرها المنفصلة للفولاذ والسيراميك في قياس الإجهاد بالأشعة السينية في وثيقة واحدة من 21 صفحة. ويرجع إليه من يقيسون الإجهاد المتبقي بحيود الأشعة السينية."),
  // https://sekiyu-gakkai.or.jp/en/index5s.html (publisher; JPI-5S-50-98)
  e("JPI-5S-50-98", "Gas oil - Testing Method for Lubricity",
    "A Japan Petroleum Institute method that rates the lubricity of gas oil (diesel fuel) from the wear scar it allows on a test steel ball, checked against high- and low-lubricity reference fluids.",
    "طريقة من معهد البترول الياباني تقيّم الخاصية التزليقية لزيت الغاز (وقود الديزل) بحسب أثر التآكل الذي يسمح به على كرة فولاذية للاختبار، مع المقارنة بسوائل مرجعية عالية ومنخفضة التزليق."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-239-determination-of-extreme-pressure-and-anti-wear-properties-of-lubricating-fluids-and-greases-four-ball-method-european-conditions2 (publisher; February 2014)
  e("IP 239", "Determination of extreme pressure and anti-wear properties of lubricating fluids and greases - Four ball method (European conditions)",
    "The Energy Institute's four-ball method for lubricating oils, fluids and greases, run under European test conditions. It measures how well they carry load and resist wear, and is used for research, quality control and ranking of fluids.",
    "طريقة معهد الطاقة بآلة الكرات الأربع لزيوت التزليق والسوائل والشحوم، وتُجرى وفق الظروف الأوروبية للاختبار. تقيس مدى تحمّلها للأحمال ومقاومتها للتآكل، وتُستخدم في البحث وضبط الجودة وترتيب السوائل."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-15.-petroleum-and-related-products-from-natural-or-synthetic-sources-determination-of-pour-point-iso-30162019 (publisher; Published June 2022)
  e("IP 15", "Petroleum and related products from natural or synthetic sources – Determination of pour point (ISO 3016:2019)",
    "Determines the pour point of petroleum products, with a separate procedure for the lower pour point of fuel oils, heavy lubricant base stocks and products containing residual fuel. It is not suitable for crude oils.",
    "تحدد نقطة الانسكاب للمنتجات البترولية، مع إجراء منفصل لنقطة الانسكاب الدنيا لزيوت الوقود وزيوت الأساس الثقيلة والمنتجات المحتوية على وقود متبقٍ. وهي غير مناسبة للنفط الخام."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-170-determination-of-flash-point-abel-closed-cup-method-iso-137362022 (publisher; Published August 2023)
  e("IP 170", "Determination of flash point – Abel closed-cup method (ISO 13736:2021)",
    "Gives the manual and automated Abel closed-cup method for the flash point of combustible liquids from −30 to 75 °C, with precision valid only from −8.5 to 75 °C. It is not for water-borne paints, and it is the Energy Institute's edition of ISO 13736.",
    "تقدّم طريقة آبل اليدوية والآلية بالكأس المغلقة لنقطة الوميض للسوائل القابلة للاشتعال من ‎−30 إلى 75 °C، والدقة صالحة فقط من ‎−8.5 إلى 75 °C. ولا تنطبق على الدهانات المائية، وهي إصدار معهد الطاقة المقابل للمعيار ISO 13736."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-219-petroleum-products-determination-of-cloud-point (publisher; Published June 2020, reapproved 2025)
  e("IP 219", "Petroleum products - Determination of cloud point",
    "Determines the cloud point of petroleum products that stay transparent in a 40 mm layer and cloud below 49 °C, including diesel containing FAME, paraffinic diesel, neat FAME and lubricants.",
    "تحدد نقطة التعكر للمنتجات البترولية التي تبقى شفافة في طبقة سماكتها 40 mm وتتعكر دون 49 °C، ومنها الديزل المحتوي على FAME والديزل البارافيني وFAME الصافي وزيوت التزليق."),
  // https://www.energyinst.org/technical/publications/topics/ip-test-methods/ip-34-determination-of-flash-point-pensky-martens-closed-cup-method2 (publisher; Published July 2026)
  e("IP 34", "Determination of flash point — Pensky-Martens closed cup method",
    "Determines the flash point, between 40 and 370 °C, of combustible liquids in a Pensky-Martens closed cup, using procedure A, B or C. It covers liquids with suspended solids, liquids that form a surface film, and biodiesel.",
    "تحدد نقطة الوميض بين 40 و370 °C للسوائل القابلة للاشتعال في كأس بنسكي-مارتنز المغلقة بالإجراء A أو B أو C، وتشمل السوائل التي تحوي مواد صلبة عالقة أو التي تكوّن غشاءً سطحياً، والديزل الحيوي."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-36-determination-of-flash-and-fire-points-cleveland-open-cup-method2 (publisher; Published January 2002, reapproved 2017)
  e("IP 36", "Determination of flash and fire points - Cleveland open cup method",
    "Determines the flash point and fire point of petroleum products with an open-cup flash point above 79 °C, using the Cleveland open-cup apparatus. Fuel oils are excluded because they are normally tested in a closed cup.",
    "تحدد نقطة الوميض ونقطة الاشتعال للمنتجات البترولية التي تتجاوز نقطة وميضها في الكأس المفتوحة 79 °C، بجهاز كليفلاند ذي الكأس المفتوحة. وتُستثنى زيوت الوقود لأنها تُختبر عادةً في كأس مغلقة."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-441-determination-of-the-pour-point-of-crude-petroleum2 (publisher; Published January 2022)
  e("IP 441", "Determination of the pour point of crude petroleum",
    "Measures the pour point of crude petroleum down to −36 °C. One procedure gives the maximum (upper) pour point and the other the minimum (lower) pour point.",
    "تقيس نقطة الانسكاب للنفط الخام حتى ‎−36 °C. يعطي أحد الإجراءين نقطة الانسكاب القصوى (العليا) ويعطي الآخر الدنيا."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-444-determination-of-the-cloud-point-of-petroleum-products-automatic-stepped-cooling-method (publisher; Published January 2009, reapproved 2021)
  e("IP 444", "Determination of the cloud point of petroleum products - Automatic stepped cooling method",
    "Finds the cloud point of petroleum products and biodiesel that are transparent in 40 mm layers, up to +49 °C. An automatic microprocessor-controlled instrument cools the sample in steps and detects clouding optically.",
    "تحدد نقطة التعكر للمنتجات البترولية والديزل الحيوي الشفافة في طبقة سماكتها 40 mm حتى ‎+49 °C. يبرّد جهاز آلي يتحكم فيه معالج دقيق العينة على مراحل ويرصد التعكر بصرياً."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-445-determination-of-the-cloud-point-of-petroleum-products-automatic-linear-cooling-rate-method (publisher; Published January 2021, reapproved 2021)
  e("IP 445", "Determination of the cloud point of petroleum products - Automatic linear cooling rate method",
    "Finds the cloud point of petroleum products and biodiesel that are transparent in 40 mm layers, up to +49 °C. An automatic instrument cools the sample at a linear rate and detects clouding optically.",
    "تحدد نقطة التعكر للمنتجات البترولية والديزل الحيوي الشفافة في طبقة سماكتها 40 mm حتى ‎+49 °C. يبرّد جهاز آلي العينة بمعدل خطي ويرصد التعكر بصرياً."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-446-determination-of-the-cloud-point-of-petroleum-products-automatic-constant-cooling-rate-method (publisher; Published January 2021, reapproved 2021)
  e("IP 446", "Determination of the cloud point of petroleum products - Automatic constant cooling rate method",
    "Finds the cloud point of petroleum products and biodiesel that are transparent in 40 mm layers. An automatic instrument detects scattered, reflected light while the sample is cooled at a constant rate.",
    "تحدد نقطة التعكر للمنتجات البترولية والديزل الحيوي الشفافة في طبقة سماكتها 40 mm. يرصد جهاز آلي الضوء المنعكس المبعثر بينما تُبرَّد العينة بمعدل ثابت."),
  // https://www.energyinst.org/technical/publications/topics/ip-test-methods/ip-450-diesel-fuel-assessment-of-lubricity-using-the-highfrequency-reciprocating-rig-hfrr-part-1-test-method-iso-1215612018 (publisher; Published September 2023)
  e("IP 450", "Diesel fuel - Assessment of lubricity using the high-frequency reciprocating rig (HFRR) - Part 1: Test method (ISO 12156-1:2018)",
    "Assesses the lubricity of middle-distillate, paraffinic and biodiesel-blend diesel fuels, with or without lubricity additives, on a high-frequency reciprocating rig with a digital camera. It covers wear scar diameters of 350 to 700 µm and is the Energy Institute's edition of ISO 12156-1.",
    "تقيّم الخاصية التزليقية لوقود الديزل من المقطرات المتوسطة والبارافيني ومخاليط الديزل الحيوي، مع إضافات تحسين التزليق أو بدونها، على جهاز ترددي عالي التردد مزود بكاميرا رقمية. وتغطي أقطار أثر التآكل من 350 إلى 700 µm، وهي إصدار معهد الطاقة المقابل للمعيار ISO 12156-1."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-491-determination-of-flashno-flash-closed-cup-equilibrium-method (publisher; Published January 2003)
  e("IP 491", "Determination of flash/no flash - Closed cup equilibrium method",
    "Tells whether a paint, varnish, binder, solvent, petroleum product or related material gives off enough vapour to ignite at one chosen temperature, in an equilibrium closed cup. Depending on the apparatus it can be used from −30 to 110 °C.",
    "تحدد ما إذا كان الطلاء أو الورنيش أو المادة الرابطة أو المذيب أو المنتج البترولي أو ما يماثلها يطلق بخاراً كافياً للاشتعال عند درجة حرارة واحدة مختارة، في كأس مغلقة بالاتزان. ويمكن استخدامها، بحسب الجهاز، من ‎−30 إلى 110 °C."),
  // https://www.energyinst.org/industry/publications/topics/ip-test-methods/ip-492-determination-of-flash-point-closed-cup-equilibrium-method (publisher; Published January 2003)
  e("IP 492", "Determination of flash point - Closed cup equilibrium method",
    "Determines the flash point of paints, varnishes, binders, solvents, petroleum and related products in an equilibrium closed cup. It can be used from −30 to 110 °C depending on the apparatus chosen.",
    "تحدد نقطة الوميض للدهانات والورنيشات والمواد الرابطة والمذيبات والمنتجات البترولية وما يماثلها في كأس مغلقة بالاتزان. ويمكن استخدامها من ‎−30 إلى 110 °C بحسب الجهاز المختار."),
];

// ---------------------------------------------------------------------------------------------------------
// Join with the catalogue.
// ---------------------------------------------------------------------------------------------------------
const bySlug = new Map(base.map((s) => [s.slug, s]));

/** The page slug for a raw catalogue/category string, or null when that standard has no page. */
export function standardSlug(raw: string): string | null {
  const slug = slugify(normalizeStandard(raw));
  return bySlug.has(slug) ? slug : null;
}

const productsBy = new Map<string, { brand: Brand; product: Product }[]>();
for (const item of allProducts()) {
  for (const slug of new Set(item.product.standards.map(standardSlug))) {
    if (slug) productsBy.set(slug, [...(productsBy.get(slug) ?? []), item]);
  }
}
const categoriesBy = new Map<string, { family: Family; category: Category }[]>();
for (const item of tier2) {
  for (const slug of new Set(item.category.standards.map(standardSlug))) {
    if (slug) categoriesBy.set(slug, [...(categoriesBy.get(slug) ?? []), item]);
  }
}

const rank = { flagship: 0, core: 1, niche: 2 } as const;
const sharedWith = (slug: string) => {
  const mine = new Set((productsBy.get(slug) ?? []).map((x) => `${x.brand.slug}/${x.product.slug}`));
  const counts = new Map<string, number>();
  for (const [other, items] of productsBy) {
    if (other === slug) continue;
    const n = items.filter((x) => mine.has(`${x.brand.slug}/${x.product.slug}`)).length;
    if (n) counts.set(other, n);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true })).map(([s]) => s);
};

/** Every standard that has a page, with its instruments, categories and industries attached. */
export const standards: Standard[] = base
  .map((s) => {
    const products = [...(productsBy.get(s.slug) ?? [])].sort((a, b) => rank[a.product.priority] - rank[b.product.priority]);
    const tally = new Map<string, number>();
    for (const { product } of products) for (const i of product.industries) tally.set(i, (tally.get(i) ?? 0) + 1);
    return {
      ...s,
      products,
      categories: categoriesBy.get(s.slug) ?? [],
      industries: [...tally].sort((a, b) => b[1] - a[1]).map(([i]) => industries.find((x) => x.slug === i)).filter((x): x is Industry => !!x),
      related: sharedWith(s.slug).slice(0, 6),
    };
  })
  // A standard with no instrument attached would be an empty page; the catalogue is the authority.
  .filter((s) => s.products.length > 0);

export const standardBySlug = (slug: string) => standards.find((s) => s.slug === slug);

/** Standards grouped for the index page, in display order. */
export const standardsByOrg = () =>
  orgOrder
    .map((org) => ({ org, items: standards.filter((s) => s.org === org).sort((a, b) => a.designation.localeCompare(b.designation, 'en', { numeric: true })) }))
    .filter((g) => g.items.length > 0);
