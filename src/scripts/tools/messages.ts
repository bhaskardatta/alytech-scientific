/** Validation strings shared by the calculators. Serialised into each tool page and read by the page script. */
type Lang = 'en' | 'ar';

const err = {
  en: {
    required: 'Enter a value.',
    number: 'Enter a plain number, for example 12.5.',
    gt0: 'Must be greater than zero.',
    ge0: 'Must be zero or more.',
    range: 'Must be between {lo} and {hi}.',
    int: 'Enter a whole number.',
    ctGeCs: 'The target must be lower than the source concentration. A diluter can only reduce concentration.',
    cmaxLtCmin: 'The highest target must be above the lowest target.',
    temp: 'Temperature must be above absolute zero (−273.15 °C).',
    summary: 'Fix the fields that show a message to see the result.',
  },
  ar: {
    required: 'أدخل قيمة.',
    number: 'أدخل رقماً بسيطاً، مثل 12.5.',
    gt0: 'يجب أن تكون القيمة أكبر من الصفر.',
    ge0: 'يجب أن تكون القيمة صفراً أو أكثر.',
    range: 'يجب أن تكون القيمة بين {lo} و{hi}.',
    int: 'أدخل عدداً صحيحاً.',
    ctGeCs: 'يجب أن يكون التركيز المستهدف أقل من تركيز المصدر، فالمخفِّف لا يستطيع إلا خفض التركيز.',
    cmaxLtCmin: 'يجب أن يكون أعلى هدف أكبر من أدنى هدف.',
    temp: 'يجب أن تكون درجة الحرارة أعلى من الصفر المطلق (‎−273.15 °C).',
    summary: 'صحّح الحقول التي تظهر تحتها رسالة لعرض النتيجة.',
  },
};
export const errMsgs = (lang: Lang) => err[lang];
