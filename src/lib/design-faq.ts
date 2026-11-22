/** Questions customers ask before ordering a printed piece — shown on /design, edited in Dashboard → Print designer → Settings. */
export interface FaqItem { q_ar: string; a_ar: string; q_en: string; a_en: string }

export function defaultFaq(s: { lead_days_min: number; lead_days_max: number; min_dpi: number }): FaqItem[] {
  return [
    {
      q_ar: "شگد ياخذ الطلب حتى يوصلني؟",
      a_ar: `نطبع قطعتك خلال ${s.lead_days_min}–${s.lead_days_max} أيام عمل، وبعدها التوصيل ياخذ ١–٣ أيام لبغداد و٢–٥ أيام لباقي المحافظات.`,
      q_en: "How long until my order arrives?",
      a_en: `We print your piece in ${s.lead_days_min}–${s.lead_days_max} working days, then delivery takes 1–3 days in Baghdad and 2–5 days elsewhere.`,
    },
    {
      q_ar: "شگد سعر التوصيل؟",
      a_ar: "سعر التوصيل يعتمد على محافظتك، ويطلعلك بالضبط بصفحة الدفع قبل ما تأكد الطلب.",
      q_en: "How much is delivery?",
      a_en: "Delivery depends on your governorate; you see the exact fee at checkout before confirming.",
    },
    {
      q_ar: "شلون أدفع؟",
      a_ar: "الدفع عند الاستلام، تدفع للمندوب لما توصلك القطعة.",
      q_en: "How do I pay?",
      a_en: "Cash on delivery — you pay the courier when your piece arrives.",
    },
    {
      q_ar: "أگدر أرجّع أو أبدّل القطعة؟",
      a_ar: "القطع المطبوعة حسب الطلب تنطبع إلك خصيصاً فما تنرجع. إذا وصلتك بيها مشكلة بالطباعة راسلنا على الواتساب ونشوف الحل.",
      q_en: "Can I return or exchange the piece?",
      a_en: "Printed-to-order pieces are made just for you, so they can't be returned. If there's a printing problem, message us on WhatsApp and we'll sort it out.",
    },
    {
      q_ar: "شنو أحسن صورة للطباعة؟",
      a_ar: `صورة PNG بخلفية شفافة وبدقة عالية، ${s.min_dpi} DPI أو أكثر بحجم الطباعة. الأداة تنبّهك إذا الصورة دقتها قليلة.`,
      q_en: "What image prints best?",
      a_en: `A high-resolution PNG with a transparent background, ${s.min_dpi} DPI or more at the printed size. The studio warns you if an image is too small.`,
    },
    {
      q_ar: "وين أگدر أطبع؟",
      a_ar: "على الأمام، الخلف، الصدر، والكمّين — حسب القطعة. كل مكان إله سعره ويطلعلك قبل ما تضيف للسلة.",
      q_en: "Where can I print?",
      a_en: "Front, back, chest and both sleeves — depending on the garment. Each spot has its own price, shown before you add to the bag.",
    },
    {
      q_ar: "أريد كمية لشركة أو مناسبة",
      a_ar: "عدنا خصم على الكميات، ولطلبات الجامعات والشركات اطلب عرض سعر من صفحة «الجامعات والشركات».",
      q_en: "I need a quantity for a company or an event",
      a_en: "There's a quantity discount, and universities and companies can request a quote on the “Universities & teams” page.",
    },
  ];
}

/** Saved list (website_settings.design_faq.items) or the defaults. */
export function faqFrom(value: unknown, s: { lead_days_min: number; lead_days_max: number; min_dpi: number }): FaqItem[] {
  const items = (value as { items?: FaqItem[] } | null)?.items;
  return Array.isArray(items) && items.length ? items.filter((i) => i && i.q_ar && i.a_ar) : defaultFaq(s);
}
