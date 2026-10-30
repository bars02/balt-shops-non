// NOON Multi-Store Platform - Core Data & Multi-Tenant Registry

export const platformInfo = {
  nameAr: "منصة نون",
  nameEn: "NOON Platform",
  logo: "",
  sloganAr: "",
  sloganEn: ""
};

// 1. STORES REGISTRY (المتاجر الثلاثة المستقلة)
export const initialStores = [
  {
    id: "elegance",
    nameAr: "بيلوز",
    nameEn: "B.Loz",
    slug: "elegance",
    badgeAr: "أزياء ولانجري",
    badgeEn: "Lingerie & Couture",
    descriptionAr: "تصاميم تُبرز جمالكِ وتمنحكِ الراحة والأنوثة التي تستحقينها",
    descriptionEn: "B.Loz bespoke collection.",
    banner: "",
    avatar: "",
    whatsapp: "",
    instagram: "",
    facebook: "",
    order: 1,
    active: true,
    categories: [
      { id: "all", titleAr: "الكل", titleEn: "All" }
    ]
  },
  {
    id: "casual",
    nameAr: "كاجوال نون",
    nameEn: "Casual NOON",
    slug: "casual",
    badgeAr: "ملابس يومية عصرية",
    badgeEn: "Modern Casual",
    descriptionAr: "أحدث صيحات الملابس اليومية العصرية بتصاميم مريحة.",
    descriptionEn: "Contemporary chic daily wear.",
    banner: "",
    avatar: "",
    whatsapp: "",
    instagram: "",
    facebook: "",
    order: 2,
    active: true,
    categories: [
      { id: "all", titleAr: "الكل", titleEn: "All" }
    ]
  },
  {
    id: "royal",
    nameAr: "رويال نون",
    nameEn: "Royal NOON",
    slug: "royal",
    badgeAr: "عبايات ملكية وتراث",
    badgeEn: "Royal Abayas",
    descriptionAr: "عبايات ملكية وبشوت مطرزة يدوياً.",
    descriptionEn: "Hand-embroidered royal abayas and bishts.",
    banner: "",
    avatar: "",
    whatsapp: "",
    instagram: "",
    facebook: "",
    order: 3,
    active: true,
    categories: [
      { id: "all", titleAr: "الكل", titleEn: "All" }
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
