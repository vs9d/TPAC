/** Default copy for informational pages. Admins can override each page from Settings → Pages. */
export const PAGE_SLUGS = ["about", "shipping", "returns", "size-guide", "faq", "privacy", "terms"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export const DEFAULT_PAGES: Record<PageSlug, { title_ar: string; title_en: string; body_ar: string; body_en: string }> = {
  about: {
    title_ar: "قصة TPAC",
    title_en: "The TPAC story",
    body_ar: "TPAC علامة ستريت وير عراقية انطلقت من بغداد.\n\nبدأنا كورشة طباعة صغيرة تطبع لأصدقائنا وطلاب الجامعات، واليوم نصمّم مجموعاتنا الخاصة ونطبع لمئات الجهات في كل أنحاء العراق.\n\nنؤمن أن الستريت وير لغة، وأن لهجتنا وحروفنا ورموزنا تستحق أن تُلبس بفخر. لذلك نمزج الخط العربي والذاكرة العراقية بقصّات عالمية وخامات ثقيلة.\n\nكل قطعة تُطبع في ورشتنا وتمر بفحص الجودة قبل أن تصلك.",
    body_en: "TPAC is an Iraqi streetwear label born in Baghdad.\n\nWe started as a small print studio making pieces for friends and university students. Today we design our own collections and print for hundreds of organisations across Iraq.\n\nWe believe streetwear is a language — and that our dialect, our letters and our symbols deserve to be worn with pride. So we blend Arabic lettering and Iraqi memory with global silhouettes and heavyweight fabrics.\n\nEvery piece is printed in our studio and quality-checked before it reaches you.",
  },
  shipping: {
    title_ar: "الشحن والتوصيل",
    title_en: "Shipping & delivery",
    body_ar: "نوصل لكل محافظات العراق.\n\n• بغداد: ١–٢ يوم عمل، مع خيار التوصيل السريع خلال ٢٤ ساعة.\n• باقي المحافظات: ٢–٥ أيام عمل.\n• الطلبات المطبوعة حسب الطلب تحتاج ٢–٤ أيام إضافية للإنتاج.\n\nرسوم التوصيل تظهر عند إتمام الطلب حسب المحافظة. التوصيل مجاني للطلبات فوق ١٥٠ ألف دينار.\n\nالدفع نقداً عند الاستلام.",
    body_en: "We deliver to every governorate in Iraq.\n\n• Baghdad: 1–2 business days, with express delivery within 24 hours.\n• Other governorates: 2–5 business days.\n• Custom printed orders need an extra 2–4 days for production.\n\nDelivery fees are shown at checkout based on your governorate. Free delivery on orders over 150,000 IQD.\n\nPay cash on delivery.",
  },
  returns: {
    title_ar: "الاستبدال والإرجاع",
    title_en: "Exchanges & returns",
    body_ar: "يمكنك استبدال المقاس أو المنتج خلال ٧ أيام من الاستلام بشرط أن تكون القطعة بحالتها الأصلية وغير مغسولة.\n\nالمنتجات المطبوعة حسب الطلب أو بتصميم خاص لا تُستبدل ولا تُرجع إلا في حال وجود خطأ في الطباعة أو عيب في التصنيع.\n\nللاستبدال تواصل معنا عبر واتساب مع رقم الطلب.",
    body_en: "You can exchange a size or product within 7 days of delivery, provided the item is in its original condition and unwashed.\n\nCustom or personalised printed items can't be exchanged or returned unless there's a printing error or manufacturing defect.\n\nTo request an exchange, message us on WhatsApp with your order number.",
  },
  "size-guide": {
    title_ar: "دليل المقاسات",
    title_en: "Size guide",
    body_ar: "قِس عرض الصدر من تحت الإبط إلى تحت الإبط والقطعة مفرودة على سطح مستوٍ، وقارنه بالجدول في صفحة كل منتج.\n\nقصّة الأوفرسايز أوسع بمقاس تقريباً — إذا كنت تفضّل لبساً عادياً اختر مقاساً أصغر.\n\nتيشيرت: S ٤٩سم، M ٥٢سم، L ٥٥سم، XL ٥٨سم، XXL ٦١سم.\nأوفرسايز: S ٥٦سم، M ٥٩سم، L ٦٢سم، XL ٦٥سم، XXL ٦٨سم.\nهودي: S ٥٤سم، M ٥٧سم، L ٦٠سم، XL ٦٣سم، XXL ٦٦سم.",
    body_en: "Measure chest width armpit to armpit with the garment laid flat and compare with the chart on each product page.\n\nOversized fits run roughly one size larger — size down for a regular fit.\n\nT-shirt: S 49cm, M 52cm, L 55cm, XL 58cm, XXL 61cm.\nOversized: S 56cm, M 59cm, L 62cm, XL 65cm, XXL 68cm.\nHoodie: S 54cm, M 57cm, L 60cm, XL 63cm, XXL 66cm.",
  },
  faq: {
    title_ar: "الأسئلة الشائعة",
    title_en: "FAQ",
    body_ar: "هل يمكنني الطلب بدون حساب؟\nنعم، يمكنك إتمام الطلب كزائر وتتبعه برقم الطلب ورقم الهاتف.\n\nكيف أدفع؟\nحالياً الدفع نقداً عند الاستلام في كل المحافظات.\n\nما الحد الأدنى لطلبات الجملة؟\n٢٠ قطعة، مع أسعار تنخفض كلما زادت الكمية.\n\nما جودة الطباعة على تصميمي الخاص؟\nنطبع بتقنية DTF عالية الدقة. ننصح برفع صورة PNG بخلفية شفافة ودقة ٣٠٠ DPI.",
    body_en: "Can I order without an account?\nYes — check out as a guest and track your order with the order number and phone.\n\nHow do I pay?\nCash on delivery across all governorates.\n\nWhat's the minimum for bulk orders?\n20 pieces, with prices dropping as quantity grows.\n\nHow good is the print on my own design?\nWe print with high-definition DTF. Upload a transparent PNG at 300 DPI for best results.",
  },
  privacy: {
    title_ar: "سياسة الخصوصية",
    title_en: "Privacy policy",
    body_ar: "نجمع فقط المعلومات اللازمة لتنفيذ طلبك: الاسم، رقم الهاتف، العنوان، والبريد الإلكتروني إن وُجد.\n\nنستخدم هذه المعلومات لتوصيل الطلب والتواصل معك بخصوصه، ولا نبيعها أو نشاركها مع أي طرف ثالث باستثناء شركة التوصيل.\n\nالتصاميم والصور التي ترفعها تُحفظ في تخزين خاص ولا يطّلع عليها إلا فريق الإنتاج.\n\nيمكنك طلب حذف بياناتك في أي وقت عبر صفحة التواصل.",
    body_en: "We only collect what we need to fulfil your order: name, phone, address and email if provided.\n\nWe use this to deliver your order and contact you about it. We never sell or share it with third parties other than our delivery partner.\n\nArtwork and images you upload are kept in private storage and are only seen by our production team.\n\nYou can request deletion of your data at any time via the contact page.",
  },
  terms: {
    title_ar: "الشروط والأحكام",
    title_en: "Terms & conditions",
    body_ar: "باستخدامك لموقع TPAC فأنت توافق على هذه الشروط.\n\nالأسعار بالدينار العراقي وقد تتغير دون إشعار مسبق، والسعر المعتمد هو السعر وقت تأكيد الطلب.\n\nأنت مسؤول عن امتلاك حقوق أي تصميم أو صورة ترفعها للطباعة. نحتفظ بحق رفض طباعة أي محتوى مسيء أو مخالف للقانون أو منتهك لحقوق الآخرين.\n\nنحتفظ بحق إلغاء أي طلب يتعذر التحقق منه.",
    body_en: "By using the TPAC website you agree to these terms.\n\nPrices are in Iraqi dinar and may change without notice; the price at order confirmation applies.\n\nYou are responsible for owning the rights to any artwork you upload. We may refuse to print content that is offensive, unlawful or infringes others' rights.\n\nWe reserve the right to cancel orders we cannot verify.",
  },
};
