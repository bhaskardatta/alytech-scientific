/** Long-form industry copy + FAQs (FAQPage schema). Facts trace back to the researched catalog. */
type T = { en: string; ar: string };
export interface IndustryContent { intro: T; brands: string[]; faqs: { q: T; a: T }[] }

export const industryContent: Record<string, IndustryContent> = {
  'oil-gas': {
    brands: ['vinci', 'gasmix', 'ducom', 'thermtest'],
    intro: {
      en: 'Upstream and midstream laboratories in the region need reservoir data they can defend and analyzers they can trust. We supply Vinci Technologies core-analysis and PVT systems, GasMix gas mixers and diluters for process and emissions analyzers, and Ducom lubricant testers — installed, commissioned and supported by our own engineers.',
      ar: 'تحتاج مختبرات قطاع الاستكشاف والإنتاج والنقل في المنطقة إلى بيانات مكامن موثوقة ومحللات يمكن الاعتماد عليها. نورّد أنظمة Vinci Technologies لتحليل العينات اللبية واختبارات PVT، وخلاطات ومخففات الغاز من GasMix لمحللات العمليات والانبعاثات، وأجهزة Ducom لاختبار مواد التشحيم — مع التركيب والتشغيل والدعم بواسطة مهندسينا.',
    },
    faqs: [
      {
        q: { en: 'Who supplies Vinci Technologies core analysis equipment in Qatar?', ar: 'من يورّد أجهزة Vinci Technologies لتحليل العينات اللبية في قطر؟' },
        a: { en: 'AlyTech Scientific is the exclusive distributor of Vinci Technologies in Qatar and an authorized distributor across the wider Middle East. We supply, install and support Vinci core-analysis, PVT and enhanced-oil-recovery systems.', ar: 'AlyTech Scientific هي الموزع الحصري لشركة Vinci Technologies في قطر والموزع المعتمد في بقية الشرق الأوسط. نورّد أنظمة Vinci لتحليل العينات اللبية واختبارات PVT والاستخلاص المعزز للنفط ونركّبها وندعمها.' },
      },
      {
        q: { en: 'Can we generate calibration gas for H2S and hydrocarbon analyzers on site?', ar: 'هل يمكننا توليد غاز المعايرة لمحللات H2S والهيدروكربونات في الموقع؟' },
        a: { en: 'Yes. GasMix dynamic diluters such as Aiolos III and Zephyr II blend a certified high-concentration standard with a diluent through mass flow controllers, producing each lower concentration on demand instead of a separate cylinder for every level.', ar: 'نعم. تمزج مخففات GasMix الديناميكية مثل Aiolos III وZephyr II معياراً معتمداً عالي التركيز مع غاز مخفف عبر وحدات تحكم بالتدفق الكتلي، فتنتج كل تركيز أقل عند الحاجة بدلاً من أسطوانة منفصلة لكل مستوى.' },
      },
      {
        q: { en: 'Do you install and train on site anywhere in the Middle East?', ar: 'هل تقدمون التركيب والتدريب في الموقع في أي مكان في الشرق الأوسط؟' },
        a: { en: 'Our engineers install and commission every instrument we supply, train your operators at handover and offer annual maintenance contracts. We are based in Mussafah, Abu Dhabi and support customers across the Middle East.', ar: 'يركّب مهندسونا كل جهاز نورّده ويشغّلونه، ويدرّبون المشغلين عند التسليم، ونقدم عقود صيانة سنوية. مقرنا في مصفح بأبوظبي وندعم العملاء في جميع أنحاء الشرق الأوسط.' },
      },
    ],
  },
  'petrochemical-refining': {
    brands: ['gasmix', 'f-dgs', 'ducom', 'lamy-rheology'],
    intro: {
      en: 'Refinery and petrochemical labs run on gas chromatographs, process analyzers and petroleum test methods. We cover the gases those instruments depend on — calibration mixtures, LPG vaporization, hydrogen, nitrogen and zero air — and the physical tests behind product release, from flash point to viscosity.',
      ar: 'تعتمد مختبرات المصافي والبتروكيماويات على أجهزة الكروماتوغرافيا الغازية ومحللات العمليات وطرق اختبار المنتجات البترولية. نوفر الغازات التي تحتاجها هذه الأجهزة — مخاليط المعايرة وتبخير غاز البترول المسال والهيدروجين والنيتروجين والهواء الصفري — والاختبارات الفيزيائية اللازمة للإفراج عن المنتجات، من نقطة الوميض إلى اللزوجة.',
    },
    faqs: [
      {
        q: { en: 'How do we inject LPG into a GC without discriminating the sample?', ar: 'كيف نحقن غاز البترول المسال في جهاز الكروماتوغرافيا دون تحيّز في العينة؟' },
        a: { en: 'The GasMix AURA II vaporizer converts LPG and other liquefied gases into a fully gaseous sample in a regulated heating chamber, then delivers it through a heated transfer line so lighter and heavier components reach the GC in the right proportions.', ar: 'يحوّل مبخّر GasMix AURA II غاز البترول المسال والغازات المسالة الأخرى إلى عينة غازية بالكامل داخل حجرة تسخين منظَّمة، ثم ينقلها عبر خط نقل مسخَّن لتصل المكونات الخفيفة والثقيلة إلى جهاز الكروماتوغرافيا بنسبها الصحيحة.' },
      },
      {
        q: { en: 'Can a gas generator replace hydrogen and nitrogen cylinders in the lab?', ar: 'هل يمكن لمولّد الغاز أن يحل محل أسطوانات الهيدروجين والنيتروجين في المختبر؟' },
        a: { en: 'For most GC carrier and detector gases, yes. F-DGS hydrogen, nitrogen and zero-air generators produce gas continuously at the bench, which removes cylinder changes and reduces the amount of compressed gas stored in the laboratory.', ar: 'نعم في معظم غازات الحمل والكواشف في الكروماتوغرافيا. تنتج مولّدات F-DGS للهيدروجين والنيتروجين والهواء الصفري الغاز باستمرار بجوار الجهاز، ما يلغي تبديل الأسطوانات ويقلل كمية الغاز المضغوط المخزن في المختبر.' },
      },
      {
        q: { en: 'Which flash point methods can you supply instruments for?', ar: 'ما طرق قياس نقطة الوميض التي توفرون أجهزتها؟' },
        a: { en: 'Ducom offers Pensky-Martens closed-cup, Cleveland open-cup and Abel flash point testers, alongside cloud and pour point and Noack volatility testers for fuels and lubricants.', ar: 'توفر Ducom أجهزة نقطة الوميض بطريقة Pensky-Martens بالكأس المغلق وCleveland بالكأس المفتوح وAbel، إلى جانب أجهزة نقطة التعكّر والانسكاب واختبار التطاير Noack للوقود ومواد التشحيم.' },
      },
    ],
  },
  'construction-infrastructure': {
    brands: ['instrotek', 'thermtest'],
    intro: {
      en: 'Roads, ports and buildings across the region are specified to ASTM and AASHTO methods. We supply InstroTek density gauges and asphalt laboratory systems, Thermtest instruments for soil thermal properties, and a full range of concrete, cement, soil and aggregate test equipment.',
      ar: 'تُصمَّم الطرق والموانئ والمباني في المنطقة وفق طرق ASTM وAASHTO. نورّد مقاييس الكثافة وأنظمة مختبرات الأسفلت من InstroTek، وأجهزة Thermtest لقياس الخواص الحرارية للتربة، ومجموعة كاملة من معدات اختبار الخرسانة والإسمنت والتربة والركام.',
    },
    faqs: [
      {
        q: { en: 'Does a nuclear density gauge need a license in the UAE?', ar: 'هل يحتاج مقياس الكثافة النووي إلى ترخيص في الإمارات؟' },
        a: { en: 'Yes. Nuclear moisture-density gauges contain sealed radioactive sources, so owning and operating one requires authorization from the national regulator — in the UAE, the Federal Authority for Nuclear Regulation. Talk to us early so licensing can run in parallel with supply.', ar: 'نعم. تحتوي مقاييس الكثافة والرطوبة النووية على مصادر مشعة مغلقة، لذا يتطلب امتلاكها وتشغيلها تصريحاً من الجهة الرقابية الوطنية — وهي في الإمارات الهيئة الاتحادية للرقابة النووية. تواصل معنا مبكراً ليسير الترخيص بالتوازي مع التوريد.' },
      },
      {
        q: { en: 'What is a Hamburg wheel tracker used for?', ar: 'ما استخدام جهاز Hamburg لتتبع العجلات؟' },
        a: { en: 'It rolls a loaded wheel over asphalt specimens submerged in hot water to measure rutting and moisture susceptibility, following AASHTO T 324. InstroTek’s SmarTracker automates the test and data capture.', ar: 'يمرّر عجلة محمّلة فوق عينات أسفلت مغمورة في ماء ساخن لقياس التخدد والحساسية للرطوبة وفق AASHTO T 324. يقوم جهاز SmarTracker من InstroTek بأتمتة الاختبار وتسجيل البيانات.' },
      },
      {
        q: { en: 'Do you supply concrete, cement and soil testing equipment?', ar: 'هل توردون معدات اختبار الخرسانة والإسمنت والتربة؟' },
        a: { en: 'Yes. Alongside InstroTek, we specify and supply compression testing machines, cement and aggregate apparatus and soil testing equipment to your standards. Tell us the methods you run and we will propose a complete set.', ar: 'نعم. إلى جانب InstroTek، نحدد ونورّد آلات اختبار الضغط وأجهزة اختبار الإسمنت والركام ومعدات اختبار التربة وفق المعايير التي تعتمدها. أخبرنا بالطرق التي تطبقها وسنقترح مجموعة متكاملة.' },
      },
    ],
  },
  'materials-manufacturing': {
    brands: ['proto', 'ducom', 'thermtest'],
    intro: {
      en: 'Fabrication shops, aerospace MRO and metal producers need to know how components behave under load, heat and wear. We supply Proto XRD systems for residual stress, Ducom tribometers for friction and wear, Thermtest thermal-property instruments and universal testing machines.',
      ar: 'تحتاج ورش التصنيع وصيانة الطائرات ومنتجو المعادن إلى معرفة سلوك المكونات تحت الحمل والحرارة والبلى. نورّد أنظمة حيود الأشعة السينية من Proto لقياس الإجهاد المتبقي، وأجهزة Ducom للاحتكاك والبلى، وأجهزة Thermtest للخواص الحرارية، وآلات الاختبار الشاملة.',
    },
    faqs: [
      {
        q: { en: 'How is residual stress measured without cutting the part?', ar: 'كيف يُقاس الإجهاد المتبقي دون قطع القطعة؟' },
        a: { en: 'X-ray diffraction measures the spacing of atomic planes near the surface; changes in that spacing reveal stress. Proto’s portable iXRD systems take this measurement in the field or on the shop floor without damaging the component.', ar: 'يقيس حيود الأشعة السينية المسافات بين المستويات الذرية قرب السطح، ويكشف تغيّر هذه المسافات عن الإجهاد. تُجري أنظمة iXRD المحمولة من Proto هذا القياس في الموقع أو في الورشة دون إتلاف المكوّن.' },
      },
      {
        q: { en: 'What does a pin-on-disk tribometer measure?', ar: 'ماذا يقيس جهاز الاحتكاك بطريقة الدبوس على القرص؟' },
        a: { en: 'It presses a pin against a rotating disk under controlled load and speed, recording the friction coefficient and wear of the material pair. Ducom’s POD 4.0 follows methods such as ASTM G99.', ar: 'يضغط دبوساً على قرص دوّار تحت حمل وسرعة مضبوطين، ويسجل معامل الاحتكاك والبلى لزوج المواد. يتبع جهاز POD 4.0 من Ducom طرقاً مثل ASTM G99.' },
      },
      {
        q: { en: 'Can you supply universal testing machines?', ar: 'هل يمكنكم توريد آلات الاختبار الشاملة؟' },
        a: { en: 'Yes. We specify and supply universal testing machines for tensile, compression and bend testing, sized to your capacity and standards, with installation and operator training included.', ar: 'نعم. نحدد ونورّد آلات اختبار شاملة لاختبارات الشد والضغط والانحناء بالسعة والمعايير التي تحتاجها، مع التركيب وتدريب المشغلين.' },
      },
    ],
  },
  'pharmaceutical-biotech': {
    brands: ['schmidt-haensch', 'lamy-rheology'],
    intro: {
      en: 'Pharmaceutical QC labs work to pharmacopeia methods and audit trails. We supply Schmidt + Haensch polarimeters, refractometers and density meters, and Lamy Rheology viscometers and rheometers, with installation, operator training and maintenance contracts delivered locally.',
      ar: 'تعمل مختبرات مراقبة الجودة الدوائية وفق طرق دساتير الأدوية وسجلات التدقيق. نورّد أجهزة قياس الاستقطاب والانكسار والكثافة من Schmidt + Haensch، ومقاييس اللزوجة والريولوجيا من Lamy Rheology، مع التركيب وتدريب المشغلين وعقود الصيانة محلياً.',
    },
    faqs: [
      {
        q: { en: 'Which instrument measures optical rotation for pharmacopeia testing?', ar: 'ما الجهاز الذي يقيس الدوران الضوئي لاختبارات دساتير الأدوية؟' },
        a: { en: 'A polarimeter. Schmidt + Haensch polarimeters measure optical and specific rotation for identity and purity testing; we help you choose by accuracy, temperature control and data-handling features.', ar: 'مقياس الاستقطاب. تقيس أجهزة Schmidt + Haensch الدوران الضوئي والدوران النوعي لاختبارات الهوية والنقاء، ونساعدك في الاختيار حسب الدقة والتحكم بالحرارة وخصائص إدارة البيانات.' },
      },
      {
        q: { en: 'What is the difference between a viscometer and a rheometer?', ar: 'ما الفرق بين مقياس اللزوجة ومقياس الريولوجيا؟' },
        a: { en: 'A viscometer reports viscosity at set conditions, which suits routine QC. A rheometer characterizes how flow behavior changes with shear rate, stress or time — needed for gels, creams and suspensions. Lamy Rheology offers both.', ar: 'يقيس مقياس اللزوجة اللزوجة عند ظروف محددة، وهو مناسب لمراقبة الجودة الروتينية. أما مقياس الريولوجيا فيصف تغيّر سلوك الجريان مع معدل القص أو الإجهاد أو الزمن، وهو ضروري للمواد الهلامية والكريمات والمعلّقات. توفر Lamy Rheology النوعين.' },
      },
      {
        q: { en: 'Can you supply stability and climatic test chambers?', ar: 'هل توردون غرف اختبار الثبات والظروف المناخية؟' },
        a: { en: 'Yes. We specify and supply temperature and humidity chambers for stability studies, sized to your sample load and set-points, with installation and qualification support.', ar: 'نعم. نحدد ونورّد غرف الحرارة والرطوبة لدراسات الثبات بالسعة ونقاط الضبط التي تحتاجها، مع التركيب ودعم التأهيل.' },
      },
    ],
  },
  'food-beverage': {
    brands: ['schmidt-haensch', 'lamy-rheology'],
    intro: {
      en: 'Sugar refiners, dairies and beverage plants release product on sugar content, density, viscosity and texture. We supply Schmidt + Haensch saccharimeters, refractometers and density meters, and Lamy Rheology viscometers and texture analyzers.',
      ar: 'تعتمد مصافي السكر ومصانع الألبان والمشروبات في الإفراج عن منتجاتها على محتوى السكر والكثافة واللزوجة والقوام. نورّد أجهزة قياس السكر والانكسار والكثافة من Schmidt + Haensch، ومقاييس اللزوجة ومحللات القوام من Lamy Rheology.',
    },
    faqs: [
      {
        q: { en: 'How is sugar content measured in a refinery laboratory?', ar: 'كيف يُقاس محتوى السكر في مختبر مصفاة السكر؟' },
        a: { en: 'With a saccharimeter — a polarimeter scaled in International Sugar Scale degrees (°Z). The Schmidt + Haensch Saccharomat V is built for this routine, following ICUMSA methods.', ar: 'بجهاز قياس السكر، وهو مقياس استقطاب مدرّج بدرجات المقياس الدولي للسكر (°Z). صُمم جهاز Saccharomat V من Schmidt + Haensch لهذا العمل الروتيني وفق طرق ICUMSA.' },
      },
      {
        q: { en: 'What does a texture analyzer measure?', ar: 'ماذا يقيس محلل القوام؟' },
        a: { en: 'It applies controlled compression or tension to a sample and records force against distance or time, giving values such as hardness, firmness and adhesiveness. Lamy Rheology’s TX-700 is designed for food and cosmetic products.', ar: 'يطبّق ضغطاً أو شداً مضبوطاً على العينة ويسجل القوة مقابل المسافة أو الزمن، فيعطي قيماً مثل الصلابة والتماسك والالتصاق. صُمم جهاز TX-700 من Lamy Rheology للمنتجات الغذائية ومستحضرات التجميل.' },
      },
      {
        q: { en: 'Which refractometer is suitable for Brix measurement?', ar: 'ما مقياس الانكسار المناسب لقياس Brix؟' },
        a: { en: 'Automatic refractometers from Schmidt + Haensch read refractive index and Brix with temperature compensation. We help you choose by range, resolution and sample type.', ar: 'تقرأ مقاييس الانكسار الآلية من Schmidt + Haensch معامل الانكسار وBrix مع تعويض الحرارة، ونساعدك في الاختيار حسب المدى والدقة ونوع العينة.' },
      },
    ],
  },
  'environmental-monitoring': {
    brands: ['gasmix', 'f-dgs'],
    intro: {
      en: 'Air-quality stations and stack-emission systems are only as good as their calibration. GasMix diluters produce traceable mixtures down to ppb on site, Nephos generates standards for VOCs that cannot be stored in cylinders, and F-DGS generators supply zero air and nitrogen.',
      ar: 'لا تتجاوز دقة محطات جودة الهواء وأنظمة رصد انبعاثات المداخن دقة معايرتها. تنتج مخففات GasMix مخاليط قابلة للتتبع حتى مستوى أجزاء في البليون في الموقع، ويولّد جهاز Nephos معايير للمركبات العضوية المتطايرة التي لا يمكن تخزينها في أسطوانات، وتوفر مولّدات F-DGS الهواء الصفري والنيتروجين.',
    },
    faqs: [
      {
        q: { en: 'How can we produce ppb-level calibration standards for air-quality analyzers?', ar: 'كيف ننتج معايير معايرة بمستوى أجزاء في البليون لمحللات جودة الهواء؟' },
        a: { en: 'By dynamic dilution. A GasMix diluter blends a certified standard with zero air through mass flow controllers to reach percent-to-ppb concentrations, and AlySoft calculates the uncertainty of each point.', ar: 'بالتخفيف الديناميكي. يمزج مخفف GasMix معياراً معتمداً مع الهواء الصفري عبر وحدات تحكم بالتدفق الكتلي للوصول إلى تراكيز من النسب المئوية حتى أجزاء في البليون، ويحسب برنامج AlySoft عدم اليقين لكل نقطة.' },
      },
      {
        q: { en: 'What is zero air and why generate it?', ar: 'ما الهواء الصفري ولماذا يتم توليده؟' },
        a: { en: 'Zero air is air with hydrocarbons and other contaminants removed, used to zero analyzers and feed FID detectors. F-DGS zero-air generators produce it continuously, avoiding cylinder supply.', ar: 'الهواء الصفري هواء أُزيلت منه الهيدروكربونات والملوثات الأخرى، ويُستخدم لتصفير المحللات وتغذية كواشف FID. تنتجه مولّدات F-DGS باستمرار دون الحاجة إلى أسطوانات.' },
      },
      {
        q: { en: 'Can you generate calibration standards for VOCs and moisture that aren’t available in cylinders?', ar: 'هل يمكنكم توليد معايير معايرة للمركبات العضوية المتطايرة والرطوبة غير المتوفرة في أسطوانات؟' },
        a: { en: 'Yes. GasMix Nephos doses pure liquids or liquid mixtures and vaporizes them into a carrier gas, so you can generate gas-phase calibration standards on site for VOCs, alcohols, siloxanes and water vapor.', ar: 'نعم. يجرّع جهاز GasMix Nephos سوائل نقية أو مخاليط سائلة ويبخّرها في غاز حامل، فيمكنك توليد معايير معايرة في الطور الغازي في الموقع للمركبات العضوية المتطايرة والكحولات والسيلوكسانات وبخار الماء.' },
      },
    ],
  },
  'power-energy': {
    brands: ['thermtest', 'f-dgs', 'gasmix'],
    intro: {
      en: 'Utilities and renewable developers need to know how heat moves through soil, backfill and insulation. We supply Thermtest instruments for soil thermal resistivity and building materials, F-DGS hydrogen and nitrogen generators, and GasMix systems for gas-blend testing.',
      ar: 'تحتاج شركات المرافق ومطورو الطاقة المتجددة إلى معرفة انتقال الحرارة عبر التربة ومواد الردم والعزل. نورّد أجهزة Thermtest لقياس المقاومة الحرارية للتربة ومواد البناء، ومولّدات F-DGS للهيدروجين والنيتروجين، وأنظمة GasMix لاختبار مخاليط الغازات.',
    },
    faqs: [
      {
        q: { en: 'How is soil thermal resistivity measured for buried cable routes?', ar: 'كيف تُقاس المقاومة الحرارية للتربة لمسارات الكابلات المدفونة؟' },
        a: { en: 'With a transient line-source probe inserted into the soil or backfill, following methods such as ASTM D5334 and IEEE 442. Thermtest’s portable TLS-100 is built for this field and lab measurement.', ar: 'بمسبار المصدر الخطي العابر الذي يُدخل في التربة أو مادة الردم، وفق طرق مثل ASTM D5334 وIEEE 442. صُمم جهاز TLS-100 المحمول من Thermtest لهذا القياس في الموقع والمختبر.' },
      },
      {
        q: { en: 'Which instrument measures the thermal conductivity of insulation?', ar: 'ما الجهاز الذي يقيس الموصلية الحرارية للعوازل؟' },
        a: { en: 'A heat flow meter, which follows ASTM C518 and ISO 8301 for insulation boards and building materials. Thermtest offers several HFM models sized by sample and temperature range.', ar: 'جهاز قياس التدفق الحراري، ويتبع ASTM C518 وISO 8301 لألواح العزل ومواد البناء. توفر Thermtest عدة طرازات HFM حسب حجم العينة ومدى الحرارة.' },
      },
      {
        q: { en: 'Do you maintain instruments after installation?', ar: 'هل تقدمون صيانة الأجهزة بعد التركيب؟' },
        a: { en: 'Yes. We offer annual maintenance contracts, warranty service, spare parts and repairs coordinated with the manufacturer, from our base in Abu Dhabi.', ar: 'نعم. نقدم عقود الصيانة السنوية وخدمة الضمان وقطع الغيار والإصلاحات بالتنسيق مع المصنّع، من مقرنا في أبوظبي.' },
      },
    ],
  },
  'research-academia': {
    brands: ['thermtest', 'proto', 'lamy-rheology', 'ducom'],
    intro: {
      en: 'University and research labs need instruments that cover many materials and methods, and a supplier who stays after installation. We supply Thermtest, Proto, Lamy Rheology and Ducom systems for thermal, structural, rheological and tribological characterization.',
      ar: 'تحتاج مختبرات الجامعات ومراكز الأبحاث إلى أجهزة تغطي مواد وطرقاً متعددة، وإلى مورّد يبقى معها بعد التركيب. نورّد أنظمة Thermtest وProto وLamy Rheology وDucom للتوصيف الحراري والبنيوي والريولوجي والاحتكاكي.',
    },
    faqs: [
      {
        q: { en: 'What is the transient plane source method?', ar: 'ما طريقة المصدر المستوي العابر؟' },
        a: { en: 'A sensor placed between two sample pieces delivers a short heat pulse and records the temperature response, giving thermal conductivity and diffusivity in one measurement. It is standardized in ISO 22007-2 and used in Thermtest TPS instruments.', ar: 'يوضع حسّاس بين قطعتين من العينة ويطلق نبضة حرارية قصيرة ويسجل استجابة الحرارة، فيعطي الموصلية والانتشارية الحرارية في قياس واحد. الطريقة معتمدة في ISO 22007-2 وتستخدمها أجهزة Thermtest TPS.' },
      },
      {
        q: { en: 'Can you help us compare instruments before a tender?', ar: 'هل يمكنكم مساعدتنا في مقارنة الأجهزة قبل المناقصة؟' },
        a: { en: 'Yes. Our application engineers review your methods, samples and budget and recommend a configuration, so the specification you publish matches what your research actually needs.', ar: 'نعم. يراجع مهندسو التطبيقات لدينا طرقك وعيناتك وميزانيتك ويوصون بالتهيئة المناسبة، لتتطابق المواصفات التي تنشرها مع ما يحتاجه بحثك فعلاً.' },
      },
      {
        q: { en: 'Do you train students and technicians on new instruments?', ar: 'هل تدرّبون الطلاب والفنيين على الأجهزة الجديدة؟' },
        a: { en: 'Operator training is part of every installation. We can run additional sessions for new cohorts of students or technicians as part of a maintenance contract.', ar: 'تدريب المشغلين جزء من كل عملية تركيب، ويمكننا تنظيم جلسات إضافية للدفعات الجديدة من الطلاب أو الفنيين ضمن عقد الصيانة.' },
      },
    ],
  },
};
