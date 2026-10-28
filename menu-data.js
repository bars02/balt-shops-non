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

// 2. PRODUCTS (مرتبطة بالمتجر التابع له storeId) - فارغ لمسح الموك داتا
export const initialProducts = [];

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
      weight: 15,
      symbol: "💎"
    },
    {
      id: "p2",
      nameAr: "خصم 20% على طلبك",
      nameEn: "20% Discount Code",
      code: "NOON20",
      icon: "percent",
      color: "#E5C76B",
      weight: 25,
      symbol: "👑"
    },
    {
      id: "p3",
      nameAr: "شحن مجاني لكل المحافظات",
      nameEn: "Free Express Shipping",
      code: "FREESHIP",
      icon: "local_shipping",
      color: "#2A8F53",
      weight: 30,
      symbol: "✨"
    },
    {
      id: "p4",
      nameAr: "خصم 10% فوري",
      nameEn: "10% Instant Discount",
      code: "NOON10",
      icon: "sell",
      color: "#b8860b",
      weight: 20,
      symbol: "⭐"
    },
    {
      id: "p5",
      nameAr: "حظ أوفر غداً",
      nameEn: "Better Luck Tomorrow",
      code: null,
      icon: "sentiment_satisfied",
      color: "#888888",
      weight: 10,
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
