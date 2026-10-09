export type Lang = 'en' | 'ar';
export const langs: Lang[] = ['en', 'ar'];

/** '/products/x/' -> '/ar/products/x/' for Arabic; English lives at the root. */
export const localize = (lang: Lang, path: string) => (lang === 'ar' ? `/ar${path}` : path);
/** Strip the locale prefix so a page can link to its other-language twin. */
export const unlocalize = (path: string) => path.replace(/^\/ar(?=\/|$)/, '') || '/';
export const dir = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr');

// ponytail: one flat dictionary; Arabic is machine-quality-checked by us, needs a native reviewer before launch.
const strings = {
  'nav.products': { en: 'Products', ar: 'المنتجات' },
  'nav.gasmix': { en: 'GasMix', ar: 'GasMix' },
  'nav.principals': { en: 'Principals', ar: 'الشركاء' },
  'nav.equipment': { en: 'Lab & Test Equipment', ar: 'معدات المختبرات والاختبار' },
  'nav.standards': { en: 'Test standards', ar: 'المعايير الاختبارية' },
  'nav.tools': { en: 'Engineering tools', ar: 'أدوات هندسية' },
  'nav.industries': { en: 'Industries', ar: 'القطاعات' },
  'nav.services': { en: 'Service & Support', ar: 'الخدمة والدعم' },
  'nav.about': { en: 'About', ar: 'من نحن' },
  'nav.contact': { en: 'Contact', ar: 'تواصل معنا' },
  'nav.menu': { en: 'Menu', ar: 'القائمة' },
  'nav.close': { en: 'Close menu', ar: 'إغلاق القائمة' },
  'nav.search': { en: 'Search instruments', ar: 'ابحث عن جهاز' },
  'nav.switch': { en: 'العربية', ar: 'English' },
  'nav.skip': { en: 'Skip to content', ar: 'انتقل إلى المحتوى' },

  'cta.quote': { en: 'Request a quote', ar: 'اطلب عرض سعر' },
  'cta.whatsapp': { en: 'WhatsApp an engineer', ar: 'راسل مهندساً عبر واتساب' },
  'cta.explore': { en: 'Explore instruments', ar: 'استكشف الأجهزة' },
  'cta.datasheet': { en: 'Get the datasheet', ar: 'احصل على النشرة الفنية' },
  'cta.price': { en: 'Get pricing', ar: 'اطلب السعر' },
  'cta.specs': { en: 'Unlock full specifications', ar: 'اعرض المواصفات الكاملة' },
  'cta.interest': { en: 'Register your interest', ar: 'سجّل اهتمامك' },

  'lead.title.whatsapp': { en: 'Chat with an AlyTech engineer', ar: 'تحدث مع مهندس من AlyTech' },
  'lead.title.datasheet': { en: 'Get the datasheet', ar: 'احصل على النشرة الفنية' },
  'lead.title.price': { en: 'Get pricing', ar: 'اطلب السعر' },
  'lead.title.quote': { en: 'Request a quote', ar: 'اطلب عرض سعر' },
  'lead.title.specs': { en: 'Unlock full specifications', ar: 'اعرض المواصفات الكاملة' },
  'lead.title.interest': { en: 'Register your interest', ar: 'سجّل اهتمامك' },
  'lead.sub.default': { en: 'An application engineer replies within one working day — usually much sooner.', ar: 'يرد عليك مهندس تطبيقات خلال يوم عمل واحد، وغالباً أسرع بكثير.' },
  'lead.name': { en: 'Full name', ar: 'الاسم الكامل' },
  'lead.company': { en: 'Company / organisation', ar: 'الشركة / الجهة' },
  'lead.email': { en: 'Work email', ar: 'البريد الإلكتروني للعمل' },
  'lead.phone': { en: 'Mobile / WhatsApp', ar: 'الجوال / واتساب' },
  'lead.country': { en: 'Country', ar: 'الدولة' },
  'lead.message': { en: 'What do you need?', ar: 'ما الذي تحتاجه؟' },
  'lead.interest': { en: 'Interested in', ar: 'مهتم بـ' },
  'lead.required': { en: 'Required', ar: 'مطلوب' },
  'lead.contactHint': { en: 'Give us an email or a mobile number — either is fine.', ar: 'أدخل بريداً إلكترونياً أو رقم جوال — أيهما يكفي.' },
  'lead.submit.default': { en: 'Send request', ar: 'إرسال الطلب' },
  'lead.sending': { en: 'Sending…', ar: 'جارٍ الإرسال…' },
  'lead.privacy': { en: 'We save the details you type in this form so an engineer can follow up, even if you don’t finish.', ar: 'نحفظ البيانات التي تكتبها في هذا النموذج حتى يتمكن مهندس من متابعتك، حتى لو لم تكمله.' },
  'lead.marketing': { en: 'Send me occasional product news, application notes and offers. You can unsubscribe at any time.', ar: 'أرسلوا لي أخبار المنتجات والملاحظات التطبيقية والعروض من حين لآخر. يمكنني إلغاء الاشتراك في أي وقت.' },
  'lead.done.title': { en: 'Request received', ar: 'تم استلام طلبك' },
  'lead.done.body': { en: 'Thank you. An AlyTech engineer will contact you shortly.', ar: 'شكراً لك. سيتواصل معك مهندس من AlyTech قريباً.' },
  'lead.err.name': { en: 'Please enter your name.', ar: 'يرجى إدخال اسمك.' },
  'lead.err.contact': { en: 'Please enter a valid email or mobile number.', ar: 'يرجى إدخال بريد إلكتروني أو رقم جوال صحيح.' },
  'lead.close': { en: 'Close', ar: 'إغلاق' },

  'wa.greeting': { en: 'Hello AlyTech, I am interested in', ar: 'مرحباً AlyTech، أنا مهتم بـ' },
  'wa.general': { en: 'your laboratory instruments and services', ar: 'أجهزتكم المخبرية وخدماتكم' },

  'footer.tagline': { en: 'Precision instruments for Middle East laboratories — supplied, installed and supported by our own engineers.', ar: 'أجهزة دقيقة لمختبرات الشرق الأوسط — نوردها ونركّبها وندعمها بمهندسينا.' },
  'footer.subsidiary': { en: 'A subsidiary of AlyTech France, maker of GasMix™.', ar: 'شركة تابعة لـ AlyTech فرنسا، الشركة المصنعة لأجهزة GasMix™.' },
  'footer.office': { en: 'Office', ar: 'المكتب' },
  'footer.explore': { en: 'Explore', ar: 'استكشف' },
  'footer.company': { en: 'Company', ar: 'الشركة' },
  'footer.privacy': { en: 'Privacy policy', ar: 'سياسة الخصوصية' },
  'footer.rights': { en: 'All rights reserved.', ar: 'جميع الحقوق محفوظة.' },
  'footer.iso': { en: 'ISO 9001 certified', ar: 'حاصلة على شهادة ISO 9001' },

  'consent.text': { en: 'We use cookies to understand which instruments you’re researching and to follow up on your requests.', ar: 'نستخدم ملفات تعريف الارتباط لفهم الأجهزة التي تبحث عنها ولمتابعة طلباتك.' },
  'consent.accept': { en: 'Accept', ar: 'موافق' },
  'consent.decline': { en: 'Essential only', ar: 'الضرورية فقط' },
  'lead.err.unavailable': { en: 'We couldn’t send your request. Please try again in a moment, or email us at', ar: 'تعذّر إرسال طلبك. حاول مرة أخرى بعد قليل، أو راسلنا عبر البريد الإلكتروني:' },
  'img.onRequest': { en: 'Product image on request', ar: 'صورة المنتج عند الطلب' },
  'ind.equip.title': { en: 'Lab & test equipment for this sector', ar: 'معدات المختبرات والاختبار لهذا القطاع' },
  'ind.equip.lead': { en: 'Specified to your standard and capacity, then supplied, installed and supported by AlyTech.', ar: 'تُحدَّد المواصفات وفق المعيار والسعة المطلوبين، ثم تتولى AlyTech التوريد والتركيب والدعم.' },
  'ind.equip.all': { en: 'All lab & test equipment', ar: 'كل معدات المختبرات والاختبار' },
  'prod.region': { en: 'In the region:', ar: 'في المنطقة:' },
  'consent.label': { en: 'Cookie consent', ar: 'الموافقة على ملفات تعريف الارتباط' },
  'footer.cookies': { en: 'Cookie settings', ar: 'إعدادات ملفات تعريف الارتباط' },
} as const;

export type Key = keyof typeof strings;
export const t = (lang: Lang, key: Key) => strings[key][lang];
/** Pick the right language from a {en, ar} pair (content data uses this shape). */
export const pick = <T>(lang: Lang, v: { en: T; ar?: T }) => (lang === 'ar' && v.ar != null ? v.ar : v.en);
