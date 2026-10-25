// NOON Multi-Store Platform - Core Data & Multi-Tenant Registry

export const platformInfo = {
  nameAr: "منصة نون",
  nameEn: "NOON Platform",
  logo: "images/logo.png",
  sloganAr: "وجهتكِ الأولى للأناقة النسائية الراقية",
  sloganEn: "The Premier Destination for Women's Luxury Fashion"
};

// 1. STORES REGISTRY (المتاجر الثلاثة المستقلة)
export const initialStores = [
  {
    id: "elegance",
    nameAr: "إليجانس نون",
    nameEn: "Elegance NOON",
    slug: "elegance",
    badgeAr: "أزياء السهرة والراقية",
    badgeEn: "Couture & Evening",
    descriptionAr: "أرقى فساتين السهرة والأزياء المخملية الفاخرة المصممة خصيصاً للمناسبات الاستثنائية.",
    descriptionEn: "Haute couture evening gowns and luxury velvet dresses tailored for unforgettable moments.",
    banner: "images/store_elegance.jpg",
    avatar: "images/logo.png",
    whatsapp: "9647835544744",
    instagram: "@elegance.noon",
    facebook: "EleganceNoonFashion",
    order: 1,
    active: true,
    categories: [
      { id: "all", titleAr: "الكل", titleEn: "All" },
      { id: "gowns", titleAr: "فساتين سهرة", titleEn: "Evening Gowns" },
      { id: "cocktail", titleAr: "أزياء كوكتيل", titleEn: "Cocktail Dresses" },
      { id: "velvet", titleAr: "مخمل وتطريز", titleEn: "Velvet & Embroidery" }
    ]
  },
  {
    id: "casual",
    nameAr: "كاجوال نون",
    nameEn: "Casual NOON",
    slug: "casual",
    badgeAr: "ملابس يومية عصرية",
    badgeEn: "Modern Casual",
    descriptionAr: "أحدث صيحات الملابس اليومية العصرية بتصاميم مريحة وأقمشة لِنين وحريرية راقية.",
    descriptionEn: "Contemporary chic daily wear, breathable linen sets and elegant silk blouses.",
    banner: "images/store_casual.jpg",
    avatar: "images/logo.png",
    whatsapp: "9647835544744",
    instagram: "@casual.noon",
    facebook: "CasualNoonFashion",
    order: 2,
    active: true,
    categories: [
      { id: "all", titleAr: "الكل", titleEn: "All" },
      { id: "linen_sets", titleAr: "أطقم لِنين", titleEn: "Linen Sets" },
      { id: "blouses", titleAr: "بلايز وقمصان", titleEn: "Blouses & Shirts" },
      { id: "blazers", titleAr: "بليزرات أنيقة", titleEn: "Chic Blazers" }
    ]
  },
  {
    id: "royal",
    nameAr: "رويال نون",
    nameEn: "Royal NOON",
    slug: "royal",
    badgeAr: "عبايات ملكية وتراث",
    badgeEn: "Royal Abayas",
    descriptionAr: "عبايات ملكية وبشوت مطرزة يدوياً بخيوط الذهب، تجمع بين الأصالة والترف المعاصر.",
    descriptionEn: "Hand-embroidered royal abayas and bishts adorned with gold threads and heritage luxury.",
    banner: "images/store_royal.jpg",
    avatar: "images/logo.png",
    whatsapp: "9647835544744",
    instagram: "@royal.noon",
    facebook: "RoyalNoonFashion",
    order: 3,
    active: true,
    categories: [
      { id: "all", titleAr: "الكل", titleEn: "All" },
      { id: "royal_abayas", titleAr: "عبايات ملكية", titleEn: "Royal Abayas" },
      { id: "embroidered_bishts", titleAr: "بشوت مطرزة", titleEn: "Embroidered Bishts" },
      { id: "silk_scarves", titleAr: "شالات وأوشحة", titleEn: "Silk Scarves" }
    ]
  }
];

// 2. PRODUCTS (مرتبطة بالمتجر التابع له storeId)
export const initialProducts = [
  // --- متجر إليجانس نون (Elegance NOON) ---
  {
    id: 101,
    storeId: "elegance",
    category: "gowns",
    nameAr: "فستان السهرة الزمردي الملكي",
    nameEn: "Emerald Royal Gala Gown",
    price: 1450000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/store_elegance.jpg",
    descriptionAr: "فستان سهرة من الكريب الحريري المطرز بالخيوط الذهبية يدوياً مع كيب ملكي انسيابي.",
    descriptionEn: "Sculpted silk crepe evening gown hand-finished with gold metallic thread and draped cape.",
    heritageAr: "مستوحى من قصور الشرق مع لمسات خياطة فرنسية راقية.",
    heritageEn: "Crafted with couture techniques that blend royal heritage with sharp modern aesthetics.",
    colors: [
      { name: "Emerald Gold", ar: "زمردي وذهبي", hex: "#1a402a" },
      { name: "Royal Noir", ar: "أسود ملكي", hex: "#0a0a0a" }
    ],
    sizes: ["36", "38", "40", "42", "44"]
  },
  {
    id: 102,
    storeId: "elegance",
    category: "cocktail",
    nameAr: "فستان كريب دي شين عاجي",
    nameEn: "Ivory Crepe de Chine Dress",
    price: 980000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/hero_noon.jpg",
    descriptionAr: "قصة انسيابية راقية تبرز القوام بياقة مفتوحة وأكمام فرنسية واسعة.",
    descriptionEn: "Fluid silk crepe with soft sheen, designed for effortless elegance and timeless grace.",
    heritageAr: "خياطة يدوية دقيقة في أتيليه إليجانس نون.",
    heritageEn: "Hand-finished seams ensuring fluid silhouette movement.",
    colors: [
      { name: "Ivory Silk", ar: "حرير عاجي", hex: "#FCFAE8" },
      { name: "Rose Gold", ar: "وردي ذهبي", hex: "#b76e79" }
    ],
    sizes: ["38", "40", "42"]
  },
  {
    id: 103,
    storeId: "elegance",
    category: "velvet",
    nameAr: "فستان مخمل أسود مطرز يدوي",
    nameEn: "Midnight Embroidered Velvet Gown",
    price: 1250000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/store_elegance.jpg",
    descriptionAr: "مخمل إيطالي فاخر بلون الليل مع تطريز نباتي ذهبي على الأكتاف والمعصم.",
    descriptionEn: "Italian midnight velvet gown with botanical gold thread embroidery.",
    heritageAr: "تطريز يدوي استغرق أكثر من 60 ساعة عمل متواصلة.",
    heritageEn: "Over 60 hours of artisanal hand-embroidery work.",
    colors: [
      { name: "Midnight Black", ar: "أسود داكن", hex: "#000000" }
    ],
    sizes: ["36", "38", "40", "42"]
  },

  // --- متجر كاجوال نون (Casual NOON) ---
  {
    id: 201,
    storeId: "casual",
    category: "linen_sets",
    nameAr: "طقم لِنين صيفي عاجي فاخر",
    nameEn: "Chic Ivory Linen Co-ord Set",
    price: 320000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/store_casual.jpg",
    descriptionAr: "طقم قطعتين من كتان اللِنين الطبيعي البارد، بنطال واسع مريح مع قميص بياقة كلاسيكية.",
    descriptionEn: "Two-piece pure European linen set with wide-leg trousers and relaxed button-up shirt.",
    heritageAr: "نسيج كتان نقي 100% يمنحك الراحة والانتعاش طوال اليوم.",
    heritageEn: "100% organic breathable linen tailored for contemporary daily chic.",
    colors: [
      { name: "Soft Ivory", ar: "عاجي ناعم", hex: "#f5f3e9" },
      { name: "Olive Green", ar: "زيتوني هادئ", hex: "#556b2f" }
    ],
    sizes: ["S", "M", "L", "XL"]
  },
  {
    id: 202,
    storeId: "casual",
    category: "blazers",
    nameAr: "بليزر أوفر سايز راقي بلون الكراميل",
    nameEn: "Caramel Oversized Tailored Blazer",
    price: 2850000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/store_casual.jpg",
    descriptionAr: "بليزر واسع بقصة كتف معماري مبطنة، يمنحك مظهراً عملياً مفعماً بالثقة.",
    descriptionEn: "Structured double-breasted blazer in warm caramel wool blend.",
    heritageAr: "تصميم كلاسيكي بريطاني مجدد بأسلوب حضري عصري.",
    heritageEn: "British tailoring heritage reimagined for today's dynamic woman.",
    colors: [
      { name: "Caramel", ar: "كراميل دافئ", hex: "#c68a4c" },
      { name: "Off White", ar: "أوف وايت", hex: "#f8f8f2" }
    ],
    sizes: ["S", "M", "L"]
  },
  {
    id: 203,
    storeId: "casual",
    category: "blouses",
    nameAr: "قميص حريري بأكمام منسدلة",
    nameEn: "Fluid Mulberry Silk Blouse",
    price: 195000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/store_casual.jpg",
    descriptionAr: "حرير طبيعي خفيف بلمسة ساتان فاخرة، مناسب للمكتب والإطلالات اليومية.",
    descriptionEn: "Pure mulberry silk with subtle luster and elegant French cuffs.",
    heritageAr: "أزرار صدفية طبيعية منحوتة بدقة.",
    heritageEn: "Natural mother-of-pearl buttons with clean artisanal stitching.",
    colors: [
      { name: "Champagne", ar: "شامبين ذهبي", hex: "#edd9be" },
      { name: "Pure White", ar: "أبيض ناصع", hex: "#ffffff" }
    ],
    sizes: ["XS", "S", "M", "L", "XL"]
  },

  // --- متجر رويال نون (Royal NOON) ---
  {
    id: 301,
    storeId: "royal",
    category: "royal_abayas",
    nameAr: "عباية ملكية كريب بتطريز قصب ذهبي",
    nameEn: "Royal Gold-Zari Embroidered Abaya",
    price: 890000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/hero_noon.jpg",
    descriptionAr: "عباية بقماش الكريب الملكي الفاحم السواد مع حواف مطرزة بخيوط القصب الذهبي الأصيل.",
    descriptionEn: "Deep-black royal crepe abaya finished with hand-embroidered metallic gold zardozi borders.",
    heritageAr: "صناعة حرفية أصيلة مستلهمة من التراث الأندلسي والخليجي الملكي.",
    heritageEn: "Preserving ancient royal embroidery arts with contemporary majesty.",
    colors: [
      { name: "Royal Jet Black", ar: "أسود ملكي فاخر", hex: "#0b0b0c" }
    ],
    sizes: ["52", "54", "56", "58", "60"]
  },
  {
    id: 302,
    storeId: "royal",
    category: "embroidered_bishts",
    nameAr: "بشت نسائي مخمل مطرز بالزري الذهبي",
    nameEn: "Royal Velvet Bisht with Gold Zari",
    price: 940000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/store_royal.jpg",
    descriptionAr: "بشت نسائي ملكي من المخمل الألماني الكثيف، بتطريز زري ذهبي عريض على الصدر والأكمام.",
    descriptionEn: "Opulent velvet bisht featuring traditional hand-spun golden zari ornamentation.",
    heritageAr: "قطعة مقتنيات فاخرة تناسب حفلات الاستقبال والأعياد.",
    heritageEn: "An heirloom-grade masterpiece crafted for grand celebrations.",
    colors: [
      { name: "Imperial Emerald", ar: "أخضر ملكي داكن", hex: "#1B2E1D" },
      { name: "Royal Black", ar: "أسود كلاسيكي", hex: "#000000" }
    ],
    sizes: ["Free Size (قياس موحد)"]
  },
  {
    id: 303,
    storeId: "royal",
    category: "silk_scarves",
    nameAr: "شال كشمير نقي بحواف زري مذهبة",
    nameEn: "Pure Cashmere Shawl with Gold Borders",
    price: 310000,
    currencyAr: "د.ع ",
    currencyEn: "IQD ",
    image: "images/hero_noon.jpg",
    descriptionAr: "كشمير خالص فائق النعومة والدفء مع لمسات تطريز خفيفة عند الأطراف.",
    descriptionEn: "Hand-woven pure cashmere shawl edged with delicate gilded embroidery.",
    heritageAr: "غزل يدوي في أنقى ورش الصوف الجبلي الأصيل.",
    heritageEn: "Artisanal hand-spun cashmere of the highest micron grade.",
    colors: [
      { name: "Desert Sand", ar: "رملي دافئ", hex: "#d8c4a5" },
      { name: "Emerald Noir", ar: "زمردي داكن", hex: "#122316" }
    ],
    sizes: ["One Size"]
  }
];

// 3. DAILY GAME CONFIG (لعبة اليوم - آلة الحظ)
export const initialGameConfig = {
  dailyAttemptsAllowed: 1,
  enabled: true,
  prizes: [
    {
      id: "p1",
      nameAr: "قسيمة 50,000 د.ع",
      nameEn: "50,000 IQD Voucher",
      code: "NOON50K",
      icon: "redeem",
      color: "#D4AF37",
      weight: 15, // 15%
      symbol: "💎"
    },
    {
      id: "p2",
      nameAr: "خصم 20% على طلبك",
      nameEn: "20% Discount Code",
      code: "NOON20",
      icon: "percent",
      color: "#E5C76B",
      weight: 25, // 25%
      symbol: "👑"
    },
    {
      id: "p3",
      nameAr: "شحن مجاني لكل المحافظات",
      nameEn: "Free Express Shipping",
      code: "FREESHIP",
      icon: "local_shipping",
      color: "#2A8F53",
      weight: 30, // 30%
      symbol: "✨"
    },
    {
      id: "p4",
      nameAr: "خصم 10% فوري",
      nameEn: "10% Instant Discount",
      code: "NOON10",
      icon: "sell",
      color: "#b8860b",
      weight: 20, // 20%
      symbol: "⭐"
    },
    {
      id: "p5",
      nameAr: "حظ أوفر غداً",
      nameEn: "Better Luck Tomorrow",
      code: null,
      icon: "sentiment_satisfied",
      color: "#888888",
      weight: 10, // 10%
      symbol: "🌙"
    }
  ]
};

// Data Helper Functions (Dynamic Storage with Fallback)
export function getStoredStores() {
  const local = localStorage.getItem("noon_stores");
  if (local) {
    try { return JSON.parse(local); } catch(e) {}
  }
  return initialStores;
}

export function saveStoredStores(stores) {
  localStorage.setItem("noon_stores", JSON.stringify(stores));
}

export function getStoredProducts() {
  const local = localStorage.getItem("noon_products");
  if (local) {
    try { return JSON.parse(local); } catch(e) {}
  }
  return initialProducts;
}

export function saveStoredProducts(products) {
  localStorage.setItem("noon_products", JSON.stringify(products));
}

export function getStoredGameConfig() {
  const local = localStorage.getItem("noon_game_config");
  if (local) {
    try { return JSON.parse(local); } catch(e) {}
  }
  return initialGameConfig;
}

export function saveStoredGameConfig(config) {
  localStorage.setItem("noon_game_config", JSON.stringify(config));
}
