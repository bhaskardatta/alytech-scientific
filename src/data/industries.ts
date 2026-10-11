export interface Industry { slug: string; name: { en: string; ar: string }; line: { en: string; ar: string } }

export const industries: Industry[] = [
  {
    slug: 'oil-gas',
    name: { en: 'Oil & Gas', ar: 'النفط والغاز' },
    line: { en: 'Reservoir and core analysis, analyzer calibration gases, lubricant wear testing.', ar: 'تحليل المكامن والعينات اللبية، غازات معايرة المحللات، اختبار بلى مواد التشحيم.' },
  },
  {
    slug: 'petrochemical-refining',
    name: { en: 'Petrochemical & Refining', ar: 'البتروكيماويات والتكرير' },
    line: { en: 'Process-analyzer calibration gases, product viscosity and quality control.', ar: 'غازات معايرة محللات العمليات، لزوجة المنتجات ومراقبة الجودة.' },
  },
  {
    slug: 'construction-infrastructure',
    name: { en: 'Construction & Infrastructure', ar: 'البناء والبنية التحتية' },
    line: { en: 'Asphalt, concrete, soil and aggregate testing for roads, ports and buildings.', ar: 'اختبار الأسفلت والخرسانة والتربة والركام للطرق والموانئ والمباني.' },
  },
  {
    slug: 'materials-manufacturing',
    name: { en: 'Materials & Manufacturing', ar: 'المواد والتصنيع' },
    line: { en: 'Residual stress, mechanical strength, friction and wear of metals and coatings.', ar: 'الإجهاد المتبقي والمتانة الميكانيكية والاحتكاك والبلى للمعادن والطلاءات.' },
  },
  {
    slug: 'pharmaceutical-biotech',
    name: { en: 'Pharmaceutical & Biotech', ar: 'الصناعات الدوائية والتقنية الحيوية' },
    line: { en: 'Optical rotation, refractive index, viscosity and stability testing.', ar: 'قياس الدوران الضوئي ومعامل الانكسار واللزوجة واختبارات الثبات.' },
  },
  {
    slug: 'food-beverage',
    name: { en: 'Food & Beverage', ar: 'الأغذية والمشروبات' },
    line: { en: 'Sugar content, density, texture and rheology for QC laboratories.', ar: 'محتوى السكر والكثافة والقوام والريولوجيا لمختبرات الجودة.' },
  },
  {
    slug: 'environmental-monitoring',
    name: { en: 'Environmental Monitoring', ar: 'الرصد البيئي' },
    line: { en: 'Calibration mixtures for air-quality and stack-emission analyzers.', ar: 'مخاليط معايرة لمحللات جودة الهواء وانبعاثات المداخن.' },
  },
  {
    slug: 'power-energy',
    name: { en: 'Power & Energy', ar: 'الطاقة والكهرباء' },
    line: { en: 'Soil thermal resistivity for buried cables, hydrogen and nitrogen generation.', ar: 'المقاومة الحرارية للتربة للكابلات المدفونة، وتوليد الهيدروجين والنيتروجين.' },
  },
  {
    slug: 'research-academia',
    name: { en: 'Research & Academia', ar: 'البحث العلمي والجامعات' },
    line: { en: 'Thermal, structural and rheological characterization for university labs.', ar: 'التوصيف الحراري والبنيوي والريولوجي لمختبرات الجامعات.' },
  },
];
