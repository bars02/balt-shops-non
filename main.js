// ==============================================================================
// منصة نون | NOON Multi-Store Platform - Main Application Engine
// Secured & Hardened against XSS, Injection, and State Tampering
// ==============================================================================

import { i18n } from './i18n.js';
import { db, sanitizeHtml } from './db.js';

// --- Application State ---
const state = {
  user: JSON.parse(localStorage.getItem('noon_user') || 'null'),
  activeStoreId: localStorage.getItem('noon_active_store') || 'elegance',
  cart: JSON.parse(localStorage.getItem('noon_cart') || '[]'),
  favorites: JSON.parse(localStorage.getItem('noon_favs') || '[]'),
  activeCategory: 'all',
  currentProductId: null,
  currentSize: 'M',
  currentQuantity: 1,
  comments: [],
  stores: [],
  products: [],
  stories: [],
  currentStoryIndex: 0,
  isStoryPaused: false,
  gameConfig: { dailyAttemptsAllowed: 1, prizes: [] },
  isSpinning: false,
  wonPrizes: JSON.parse(localStorage.getItem('noon_won_prizes') || '[]')
};

// --- Storage Helpers ---
const saveCart = () => localStorage.setItem('noon_cart', JSON.stringify(state.cart));
const saveFavs = () => localStorage.setItem('noon_favs', JSON.stringify(state.favorites));
const saveUser = () => localStorage.setItem('noon_user', JSON.stringify(state.user));
const saveWonPrizes = () => localStorage.setItem('noon_won_prizes', JSON.stringify(state.wonPrizes));

// --- Check Daily Game Attempt ---
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDailyAttemptsLeft() {
  const today = getTodayDateString();
  const history = JSON.parse(localStorage.getItem('noon_spin_history') || '{}');
  const userKey = state.user?.id || 'guest_device';
  const usedToday = history[today]?.[userKey] || 0;
  const maxAllowed = state.gameConfig?.dailyAttemptsAllowed || 1;
  return Math.max(0, maxAllowed - usedToday);
}

function recordDailyAttempt() {
  const today = getTodayDateString();
  const history = JSON.parse(localStorage.getItem('noon_spin_history') || '{}');
  if (!history[today]) history[today] = {};
  const userKey = state.user?.id || 'guest_device';
  history[today][userKey] = (history[today][userKey] || 0) + 1;
  localStorage.setItem('noon_spin_history', JSON.stringify(history));
}

// --- Toast System ---
window.showToast = (msg, type = 'info') => {
  const safeMsg = sanitizeHtml(msg);
  const toast = document.createElement('div');
  toast.className = `fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-[11px] font-sans font-bold tracking-wider z-[500] shadow-2xl transition-all duration-500 ${type === 'error' ? 'bg-red-600 text-white' : 'bg-primary text-background border border-accent/40'}`;
  toast.style.cssText = 'opacity:0;transform:translate(-50%,20px)';
  toast.innerHTML = safeMsg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translate(-50%,0)'; });
  setTimeout(() => { 
    toast.style.opacity = '0'; 
    toast.style.transform = 'translate(-50%,20px)'; 
    setTimeout(() => toast.remove(), 500); 
  }, 3200);
};

// --- Navigation Engine ---
window.navigate = function(screenId) {
  const current = document.querySelector('.screen.active');
  const target = document.getElementById(`screen-${screenId}`);
  if (!target || current === target) return;

  if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(st => st.kill());

  if (current) {
    current.style.opacity = '0';
    current.style.transform = 'translateY(-12px)';
    setTimeout(() => {
      current.classList.remove('active');
      current.style.cssText = '';
    }, 250);
  }

  setTimeout(() => {
    target.classList.add('active');
    target.style.opacity = '0';
    target.style.transform = 'translateY(12px)';
    window.scrollTo({ top: 0, behavior: 'instant' });
    renderScreenContent(screenId);

    requestAnimationFrame(() => {
      target.style.transition = 'all 0.4s cubic-bezier(0.16,1,0.3,1)';
      target.style.opacity = '1';
      target.style.transform = 'translateY(0)';
      setTimeout(() => {
        target.style.transition = '';
      }, 400);
    });
  }, 250);

  updateBottomNav(screenId);
};

function updateBottomNav(id) {
  document.querySelectorAll('#bottom-nav .nav-btn').forEach(b => {
    b.classList.remove('text-primary', 'text-accent');
    b.classList.add('text-primary/60');
  });
  const btn = document.querySelector(`#bottom-nav .nav-btn[data-screen="${id}"]`);
  if (btn) {
    btn.classList.remove('text-primary/60');
    btn.classList.add(id === 'game' ? 'text-accent' : 'text-primary');
  }
}

function renderScreenContent(id) {
  if (id === 'hub') renderStoresHub();
  if (id === 'collections') renderCurrentStoreView();
  if (id === 'bag') updateCartUI();
  if (id === 'favorites') renderFavorites();
  if (id === 'comments') renderComments();
  if (id === 'game') updateGameUI();
  if (id === 'profile') renderProfileUI();
}

window.scrollToStores = () => {
  const el = document.getElementById('platform-stores-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

// --- Screen 1: Platform Hub (Our 3 Boutiques) ---
function renderStoresHub() {
  const container = document.getElementById('stores-hub-container');
  if (!container) return;
  const lang = i18n.currentLang;

  const activeStores = state.stores
    .filter(s => s.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  container.innerHTML = activeStores.map(store => {
    const isCurrent = store.id === state.activeStoreId;
    const name = sanitizeHtml(lang === 'en' ? store.nameEn : store.nameAr);
    const badge = sanitizeHtml(lang === 'en' ? store.badgeEn : store.badgeAr);
    const desc = sanitizeHtml(lang === 'en' ? store.descriptionEn : store.descriptionAr);
    const banner = sanitizeHtml(store.banner || 'images/hero_noon.jpg');
    const storeProdCount = state.products.filter(p => p.storeId === store.id).length;

    return `
      <div class="store-hub-card group" onclick="selectStore('${sanitizeHtml(store.id)}')">
        <div class="relative overflow-hidden">
          <img src="${banner}" class="banner-img" alt="${name}" onerror="this.src='images/hero_noon.jpg'">
          <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
          
          <!-- Top Badges -->
          <div class="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span class="bg-accent/90 text-primary text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-lg">
              ${badge}
            </span>
            ${isCurrent ? `
              <span class="bg-primary/90 text-accent text-[8px] font-bold px-2.5 py-1 rounded-full border border-accent/40 flex items-center gap-1">
                <span class="material-symbols-outlined text-[10px]">check_circle</span>
                <span>${lang === 'en' ? 'Current' : 'المتجر الحالي'}</span>
              </span>
            ` : ''}
          </div>

          <!-- Bottom Card Content -->
          <div class="absolute bottom-4 left-4 right-4 text-white">
            <h3 class="font-serif text-2xl font-bold mb-1 text-white">${name}</h3>
            <p class="text-xs text-white/80 font-light line-clamp-2 mb-3 leading-relaxed">
              ${desc}
            </p>
            <div class="flex items-center justify-between">
              <span class="text-[10px] tracking-widest uppercase font-bold text-accent flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                <span>${lang === 'en' ? 'Enter Boutique' : 'دخول المتجر والتسوق'}</span>
                <span class="material-symbols-outlined text-xs">arrow_forward</span>
              </span>
              <span class="text-[9px] text-white/50 tracking-wider">
                ${storeProdCount} ${lang === 'en' ? 'Creations' : 'قطعة معروضة'}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- Store Selection & Switcher Modal (⋮) ---
window.selectStore = (storeId) => {
  state.activeStoreId = storeId;
  localStorage.setItem('noon_active_store', storeId);
  state.activeCategory = 'all';
  toggleStoreSwitcher(false);
  navigate('collections');
};

window.toggleStoreSwitcher = (show) => {
  const modal = document.getElementById('store-switcher-modal');
  if (!modal) return;
  modal.classList.toggle('visible', show);
  if (show) renderStoreSwitcher();
};

function renderStoreSwitcher() {
  const list = document.getElementById('switcher-stores-list');
  if (!list) return;
  const lang = i18n.currentLang;

  list.innerHTML = state.stores
    .filter(s => s.active !== false)
    .map(store => {
      const isCurrent = store.id === state.activeStoreId;
      const name = sanitizeHtml(lang === 'en' ? store.nameEn : store.nameAr);
      const badge = sanitizeHtml(lang === 'en' ? store.badgeEn : store.badgeAr);
      const banner = sanitizeHtml(store.banner || 'images/hero_noon.jpg');

      return `
        <div class="p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${isCurrent ? 'bg-primary/5 border-accent shadow-sm' : 'border-primary/10 hover:border-accent/40 bg-white'}" onclick="selectStore('${sanitizeHtml(store.id)}')">
          <div class="flex items-center gap-3">
            <img src="${banner}" class="w-12 h-12 rounded-xl object-cover border border-primary/10" onerror="this.src='images/hero_noon.jpg'">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-serif text-sm font-bold text-primary">${name}</h4>
                ${isCurrent ? `<span class="bg-accent text-primary text-[8px] font-bold px-2 py-0.2 rounded-full">${lang === 'en' ? 'Active' : 'نشط'}</span>` : ''}
              </div>
              <p class="text-[10px] text-primary/60 mt-0.5 line-clamp-1">${badge}</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-sm ${isCurrent ? 'text-accent' : 'text-primary/30'}">
            ${isCurrent ? 'check_circle' : 'arrow_forward'}
          </span>
        </div>
      `;
    }).join('');
}

// --- Screen 2: Boutique Store View ---
function renderCurrentStoreView() {
  const store = state.stores.find(s => s.id === state.activeStoreId) || state.stores[0];
  if (!store) return;
  const lang = i18n.currentLang;

  const bannerEl = document.getElementById('current-store-banner');
  const badgeEl = document.getElementById('current-store-badge');
  const titleEl = document.getElementById('current-store-title');
  const descEl = document.getElementById('current-store-desc');
  const chipEl = document.getElementById('active-store-chip');

  if (bannerEl) bannerEl.src = store.banner || 'images/hero_noon.jpg';
  if (badgeEl) badgeEl.innerText = lang === 'en' ? store.badgeEn : store.badgeAr;
  if (titleEl) titleEl.innerText = lang === 'en' ? store.nameEn : store.nameAr;
  if (descEl) descEl.innerText = lang === 'en' ? store.descriptionEn : store.descriptionAr;
  if (chipEl) chipEl.innerText = lang === 'en' ? store.nameEn : store.nameAr;

  const waBtn = document.getElementById('store-whatsapp-btn');
  const igBtn = document.getElementById('store-instagram-btn');
  if (waBtn) waBtn.href = `https://wa.me/${encodeURIComponent(store.whatsapp || '9647835544744')}`;
  if (igBtn) igBtn.href = `https://instagram.com/${encodeURIComponent(store.instagram?.replace('@','') || 'noon.fashion')}`;

  renderStoreCategories(store);
  renderStoreProducts(store);
}

function renderStoreCategories(store) {
  const container = document.getElementById('category-filters');
  if (!container) return;
  const lang = i18n.currentLang;
  const cats = store.categories || [{ id: 'all', titleAr: 'الكل', titleEn: 'All' }];

  container.innerHTML = cats.map(c => `
    <button class="snap-start shrink-0 px-4 py-2 rounded-full border text-[10px] uppercase tracking-wider font-bold transition-all ${state.activeCategory === c.id ? 'bg-primary text-background border-primary shadow-sm' : 'border-primary/15 text-primary hover:border-accent'}"
            onclick="filterStoreCategory('${sanitizeHtml(c.id)}')">
      ${sanitizeHtml(lang === 'en' ? c.titleEn : c.titleAr)}
    </button>
  `).join('');
}

window.filterStoreCategory = (catId) => {
  state.activeCategory = catId;
  const store = state.stores.find(s => s.id === state.activeStoreId);
  renderStoreCategories(store);
  renderStoreProducts(store);
};

function renderStoreProducts(store) {
  const grid = document.getElementById('atelier-grid');
  if (!grid) return;
  const lang = i18n.currentLang;

  let storeProducts = state.products.filter(p => p.storeId === store.id);
  if (state.activeCategory !== 'all') {
    storeProducts = storeProducts.filter(p => p.category === state.activeCategory);
  }

  if (storeProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-span-2 py-20 text-center">
        <span class="material-symbols-outlined text-4xl text-accent/50 mb-2 block">inventory_2</span>
        <h4 class="font-serif text-base text-primary mb-1">${lang === 'en' ? 'No creations found' : 'لا توجد منتجات في هذا القسم'}</h4>
        <p class="text-xs text-primary/50">${lang === 'en' ? 'Check other categories or boutiques' : 'يرجى مراجعة الأقسام الأخرى'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = storeProducts.map(p => {
    const isFav = state.favorites.includes(p.id);
    const pName = sanitizeHtml(lang === 'en' ? p.nameEn : p.nameAr);
    const sName = sanitizeHtml(lang === 'en' ? store.nameEn : store.nameAr);
    const currency = sanitizeHtml(lang === 'en' ? p.currencyEn : p.currencyAr);
    const priceFormatted = Number(p.price || 0).toLocaleString();

    return `
      <div class="focus-grid-item group relative cursor-pointer aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-sm" onclick="viewProduct(${Number(p.id)})" data-product-id="${Number(p.id)}">
        <img src="${sanitizeHtml(p.image)}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onerror="this.src='images/hero_noon.jpg'">
        <button class="fav-btn absolute top-2 right-2 z-10 ${isFav ? 'is-fav' : ''}" onclick="event.stopPropagation(); toggleFavById(${Number(p.id)})">
          <span class="material-symbols-outlined">favorite</span>
        </button>
        <div class="product-info">
          <span class="text-[8px] bg-accent/90 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mb-1 inline-block">
            ${sName}
          </span>
          <h4 class="font-serif text-white text-xs mb-0.5 truncate">${pName}</h4>
          <p class="text-gold-light text-xs font-bold font-sans">${currency}${priceFormatted}</p>
        </div>
      </div>
    `;
  }).join('');
}

// --- Screen 3: Product Detail ---
window.viewProduct = (id) => {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const store = state.stores.find(s => s.id === p.storeId) || state.stores[0];
  const lang = i18n.currentLang;

  // Gallery
  const gallery = document.getElementById('product-gallery');
  const images = p.images || [p.image];
  gallery.innerHTML = images.map(img => `
    <div class="snap-start w-full h-full flex-shrink-0">
      <img src="${sanitizeHtml(img)}" class="w-full h-full object-cover object-top" alt="${sanitizeHtml(p.nameAr)}" onerror="this.src='images/hero_noon.jpg'">
    </div>
  `).join('');

  // Store Pill
  const storeBadge = document.getElementById('product-store-name');
  if (storeBadge) storeBadge.innerText = lang === 'en' ? `From: ${store.nameEn}` : `من متجر: ${store.nameAr}`;

  // Info
  document.getElementById('product-name').innerText = lang === 'en' ? p.nameEn : p.nameAr;
  document.getElementById('product-desc').innerText = lang === 'en' ? p.descriptionEn : p.descriptionAr;
  document.getElementById('product-price').innerText = `${lang === 'en' ? p.currencyEn : p.currencyAr}${Number(p.price || 0).toLocaleString()}`;
  document.getElementById('product-category').innerText = p.category;

  const heritageEl = document.getElementById('product-heritage');
  if (heritageEl) heritageEl.innerText = lang === 'en' ? (p.heritageEn || "Crafted with highest artisan standards.") : (p.heritageAr || "صُممت ونُفذت بأعلى معايير الخياطة الحرفية.");

  const favBtn = document.getElementById('product-fav-btn');
  if (favBtn) favBtn.classList.toggle('is-fav', state.favorites.includes(p.id));

  state.currentProductId = id;
  state.currentQuantity = 1;
  document.getElementById('product-quantity').innerText = 1;

  // Colors
  const swatchContainer = document.getElementById('color-swatches');
  if (p.colors && p.colors.length > 0) {
    swatchContainer.innerHTML = p.colors.map((c, i) => `
      <button class="color-swatch ${i === 0 ? 'active' : ''}" style="background-color:${sanitizeHtml(c.hex)}" title="${sanitizeHtml(lang === 'en' ? c.name : c.ar)}" onclick="selectColor(this, '${sanitizeHtml(c.hex)}')"></button>
    `).join('');
    swatchContainer.classList.remove('hidden');
  } else {
    swatchContainer.innerHTML = '';
  }

  // Sizes
  const sizeGrid = document.getElementById('size-selector');
  if (sizeGrid && p.sizes) {
    sizeGrid.innerHTML = p.sizes.map((s, i) => `
      <button class="py-2.5 border ${i === 0 ? 'bg-primary text-background' : 'border-primary/15 text-primary'} text-[10px] font-bold rounded-lg transition-all" onclick="selectSize(this)">${sanitizeHtml(s)}</button>
    `).join('');
    state.currentSize = p.sizes[0];
  }

  // Accordions
  const acc = document.getElementById('product-accordions');
  if (acc) {
    acc.innerHTML = `
      <div class="border-b border-primary/10">
        <button class="w-full py-4 flex justify-between items-center text-left" onclick="toggleAccordion(this)">
          <span class="text-[10px] uppercase tracking-wider font-bold">${lang === 'en' ? 'Boutique Delivery & Care' : 'الشحن والتوصيل والعناية'}</span>
          <span class="material-symbols-outlined text-sm">keyboard_arrow_down</span>
        </button>
        <div class="hidden pb-4 text-xs text-primary/70 leading-relaxed font-light">
          ${lang === 'en' ? `Direct dispatch from ${sanitizeHtml(store.nameEn)}. Orders confirmed via WhatsApp within minutes.` : `يتم شحن هذه القطعة مباشرة من دار أزياء ${sanitizeHtml(store.nameAr)}. يتم تأكيد الطلبات عبر واتساب المتجر فوراً.`}
        </div>
      </div>
    `;
  }

  navigate('product');
};

window.selectColor = (btn, hex) => {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
};

window.selectSize = (btn) => {
  document.querySelectorAll('#size-selector button').forEach(b => {
    b.classList.remove('bg-primary', 'text-background');
    b.classList.add('border-primary/15', 'text-primary');
  });
  btn.classList.add('bg-primary', 'text-background');
  state.currentSize = btn.innerText;
};

window.updateQuantity = (v) => {
  state.currentQuantity = Math.max(1, state.currentQuantity + v);
  document.getElementById('product-quantity').innerText = state.currentQuantity;
};

// --- Screen 4: Multi-Store Shopping Bag ---
window.addToBag = () => {
  const p = state.products.find(x => x.id === state.currentProductId);
  if (!p) return;
  const store = state.stores.find(s => s.id === p.storeId) || state.stores[0];

  state.cart.push({
    id: p.id,
    storeId: store.id,
    storeNameAr: store.nameAr,
    storeNameEn: store.nameEn,
    storeWhatsapp: store.whatsapp,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    price: Number(p.price) || 0,
    currencyAr: p.currencyAr || 'د.ع ',
    currencyEn: p.currencyEn || 'IQD ',
    image: p.image,
    selectedSize: state.currentSize || 'Standard',
    quantity: state.currentQuantity,
    cartId: Date.now() + Math.random()
  });

  saveCart();
  updateCartUI();
  showToast(i18n.currentLang === 'en' ? `Added to Bag (${store.nameEn})` : `تمت الإضافة للسلة (${store.nameAr})`);
};

window.updateCartUI = () => {
  const count = document.getElementById('cart-count');
  if (count) count.innerText = state.cart.length;

  const container = document.getElementById('cart-container');
  if (!container) return;
  const lang = i18n.currentLang;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center">
        <span class="material-symbols-outlined text-4xl text-primary/30 mb-2">shopping_bag</span>
        <p class="text-xs text-primary/50 tracking-wider">${lang === 'en' ? 'Your shopping bag is empty' : 'سلة التسوق فارغة حالياً'}</p>
        <button class="mt-4 px-6 py-2.5 bg-primary text-background text-[10px] rounded-xl font-bold uppercase tracking-wider" onclick="navigate('hub')">
          ${lang === 'en' ? 'Explore Boutiques' : 'تصفحي المتاجر'}
        </button>
      </div>
    `;
    const sub = document.getElementById('bag-subtotal-summary');
    const tot = document.getElementById('bag-total-summary');
    if (sub) sub.innerText = '0';
    if (tot) tot.innerText = '0';
    return;
  }

  container.innerHTML = state.cart.map(item => `
    <div class="p-4 rounded-2xl bg-white border border-primary/5 shadow-sm flex gap-3 relative">
      <img src="${sanitizeHtml(item.image)}" class="w-[70px] h-[85px] object-cover rounded-xl border border-primary/5" onerror="this.src='images/hero_noon.jpg'">
      <div class="flex-1 min-w-0">
        <span class="inline-block bg-accent/20 text-primary text-[8px] font-bold px-2 py-0.5 rounded-full mb-1">
          ${sanitizeHtml(lang === 'en' ? item.storeNameEn : item.storeNameAr)}
        </span>
        <h4 class="font-serif text-sm truncate font-semibold text-primary">${sanitizeHtml(lang === 'en' ? item.nameEn : item.nameAr)}</h4>
        <p class="text-[10px] text-primary/60 mt-0.5">${sanitizeHtml(item.selectedSize)} | ${lang === 'en' ? 'Qty' : 'الكمية'}: ${Number(item.quantity)}</p>
        <p class="text-xs font-bold text-accent mt-1">${sanitizeHtml(lang === 'en' ? item.currencyEn : item.currencyAr)}${(Number(item.price) * Number(item.quantity)).toLocaleString()}</p>
      </div>
      <button onclick="removeFromCart(${item.cartId})" class="material-symbols-outlined text-base text-primary/30 hover:text-red-500 self-start p-1">close</button>
    </div>
  `).join('');

  const subtotal = state.cart.reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0);
  const sub = document.getElementById('bag-subtotal-summary');
  const tot = document.getElementById('bag-total-summary');
  const currency = lang === 'en' ? 'IQD ' : 'د.ع ';
  if (sub) sub.innerText = `${currency}${subtotal.toLocaleString()}`;
  if (tot) tot.innerText = `${currency}${subtotal.toLocaleString()}`;
};

window.removeFromCart = (cartId) => {
  state.cart = state.cart.filter(i => i.cartId !== cartId);
  saveCart();
  updateCartUI();
};

window.orderWhatsApp = async () => {
  if (state.cart.length === 0) {
    showToast(i18n.currentLang === 'en' ? "Shopping bag is empty" : "السلة فارغة", "error");
    return;
  }

  // Group by store
  const storesInCart = {};
  state.cart.forEach(item => {
    if (!storesInCart[item.storeId]) {
      storesInCart[item.storeId] = {
        nameAr: item.storeNameAr,
        nameEn: item.storeNameEn,
        whatsapp: item.storeWhatsapp || '9647835544744',
        items: []
      };
    }
    storesInCart[item.storeId].items.push(item);
  });

  const storeKeys = Object.keys(storesInCart);
  const targetStore = storesInCart[storeKeys[0]];

  let msg = `🛍️ *طلب جديد عبر منصة نون | NOON Platform*\n`;
  msg += `─────────────────────────\n`;

  storeKeys.forEach(sId => {
    const s = storesInCart[sId];
    msg += `📍 *المتجر: ${s.nameAr}*\n`;
    s.items.forEach(i => {
      msg += `▪ ${i.nameAr} | القياس: ${i.selectedSize} | العدد: ${i.quantity} | السعر: ${Number(i.price).toLocaleString()} د.ع\n`;
    });
    msg += `\n`;
  });

  const subtotal = state.cart.reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0);
  msg += `─────────────────────────\n`;
  msg += `💰 *الإجمالي الكلي: ${subtotal.toLocaleString()} د.ع*\n`;
  msg += `👤 *العميلة:* ${state.user?.name || 'طلب مباشر من الموقع'}\n`;

  // Persist order in background to DB / local
  await db.createOrder({
    storeId: storeKeys[0],
    customerName: state.user?.name || 'عميلة مباشرة',
    items: state.cart,
    subtotal: subtotal,
    total: subtotal
  });

  window.open(`https://wa.me/${encodeURIComponent(targetStore.whatsapp)}?text=${encodeURIComponent(msg)}`, '_blank');
};

// --- Screen 5: Daily Game (Slot Machine) ---
window.updateGameUI = () => {
  const attemptsBadge = document.getElementById('game-attempts-badge');
  const attempts = getDailyAttemptsLeft();
  if (attemptsBadge) attemptsBadge.innerText = attempts;

  const spinBtn = document.getElementById('spin-btn');
  const spinBtnText = document.getElementById('spin-btn-text');

  if (attempts <= 0) {
    if (spinBtn) spinBtn.classList.add('opacity-50');
    if (spinBtnText) spinBtnText.innerText = i18n.currentLang === 'en' ? 'Attempt Used for Today' : 'استنفدتِ محاولة اليوم';
  } else {
    if (spinBtn) spinBtn.classList.remove('opacity-50');
    if (spinBtnText) spinBtnText.innerText = i18n.currentLang === 'en' ? 'PULL LEVER' : 'اسحب العتلة';
  }
};

window.pullSlotLever = () => {
  if (state.isSpinning) return;

  if (!state.user) {
    state.user = {
      id: 'guest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name: i18n.currentLang === 'en' ? 'NOON Guest' : 'زائرة نون الكريمة',
      avatarMode: 'default',
      photo: 'images/logo.png',
      isGuest: true
    };
    saveUser();
    if (typeof renderProfileUI === 'function') renderProfileUI();
  }

  const attemptsLeft = getDailyAttemptsLeft();
  if (attemptsLeft <= 0) {
    showToast(i18n.currentLang === 'en' ? "You've used your daily attempt! Come back tomorrow" : "لقد استنفدتِ محاولتكِ لهذا اليوم، ننتظركِ غداً!", "error");
    return;
  }

  state.isSpinning = true;
  const lever = document.getElementById('slot-lever');
  if (lever) lever.classList.add('pulled');
  setTimeout(() => lever && lever.classList.remove('pulled'), 400);

  const reels = [document.getElementById('reel-1'), document.getElementById('reel-2'), document.getElementById('reel-3')];
  reels.forEach(r => r && r.classList.add('spinning'));

  const prizes = state.gameConfig.prizes || [];
  const totalWeight = prizes.reduce((s, p) => s + (p.weight || 10), 0);
  let randomVal = Math.random() * (totalWeight || 1);
  let selectedPrize = prizes[0] || { nameAr: 'قسيمة نون', nameEn: 'NOON Voucher', symbol: '💎', code: 'NOON20' };

  for (const prize of prizes) {
    if (randomVal < (prize.weight || 10)) {
      selectedPrize = prize;
      break;
    }
    randomVal -= (prize.weight || 10);
  }

  const symbols = ['💎', '👑', '✨', '⭐', '🌙', '👗'];
  const spinInterval = setInterval(() => {
    reels.forEach(r => {
      if (r) r.querySelector('span').innerText = symbols[Math.floor(Math.random() * symbols.length)];
    });
  }, 100);

  setTimeout(async () => {
    clearInterval(spinInterval);
    reels.forEach(r => r && r.classList.remove('spinning'));

    const winSymbol = selectedPrize.symbol || '💎';
    reels.forEach(r => {
      if (r) r.querySelector('span').innerText = winSymbol;
    });

    state.isSpinning = false;
    recordDailyAttempt();
    updateGameUI();

    // Sync spin with cloud DB
    await db.recordDailySpin(state.user.id, selectedPrize);

    // Show Won Prize Card
    const resultCard = document.getElementById('game-result-card');
    const titleEl = document.getElementById('prize-won-title');
    const descEl = document.getElementById('prize-won-desc');
    const codeEl = document.getElementById('prize-code-text');

    if (resultCard) {
      resultCard.classList.remove('hidden');
      const lang = i18n.currentLang;
      if (titleEl) titleEl.innerText = selectedPrize.code ? (lang === 'en' ? '🎉 Congratulations!' : '🎉 مبارك! لقد ربحتِ') : (lang === 'en' ? 'Better luck tomorrow!' : 'حظاً أوفر غداً!');
      if (descEl) descEl.innerText = lang === 'en' ? selectedPrize.nameEn : selectedPrize.nameAr;
      if (codeEl) codeEl.innerText = selectedPrize.code || 'NOON-LUCK';

      if (selectedPrize.code) {
        state.wonPrizes.push({
          prize: selectedPrize,
          date: new Date().toLocaleDateString()
        });
        saveWonPrizes();
      }
    }

    showToast(i18n.currentLang === 'en' ? `You unlocked: ${selectedPrize.nameEn}` : `حصلتِ على: ${selectedPrize.nameAr}`);
  }, 1800);
};

window.copyPrizeCode = () => {
  const code = document.getElementById('prize-code-text')?.innerText;
  if (code) {
    navigator.clipboard?.writeText(code);
    showToast(i18n.currentLang === 'en' ? "Code copied to clipboard!" : "تم نسخ الكود بنجاح!");
  }
};

// --- Screen 6: User Profile & Authentication ---
function renderProfileUI() {
  const userNameEl = document.getElementById('profile-user-name');
  const avatarImg = document.getElementById('profile-avatar-img');
  const inputName = document.getElementById('input-display-name');
  const favCountEl = document.getElementById('profile-fav-count');
  const prizesCountEl = document.getElementById('profile-prizes-count');
  const authContainer = document.getElementById('profile-auth-buttons');
  const lang = i18n.currentLang;

  if (favCountEl) favCountEl.innerText = state.favorites.length;
  if (prizesCountEl) prizesCountEl.innerText = state.wonPrizes.length;

  if (state.user) {
    if (userNameEl) userNameEl.innerText = state.user.name;
    if (inputName) inputName.value = state.user.name;
    if (avatarImg) avatarImg.src = state.user.avatarMode === 'public' && state.user.photo ? state.user.photo : 'images/logo.png';
    if (authContainer) {
      authContainer.innerHTML = `
        <button class="w-full py-3 bg-red-600/10 text-red-600 border border-red-600/20 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all" onclick="signOutUser()">
          ${lang === 'en' ? 'Sign Out' : 'تسجيل الخروج'}
        </button>
      `;
    }
  } else {
    if (userNameEl) userNameEl.innerText = lang === 'en' ? 'Valued Guest' : 'زائر كريم';
    if (inputName) inputName.value = '';
    if (avatarImg) avatarImg.src = 'images/logo.png';
    if (authContainer) {
      authContainer.innerHTML = `
        <button class="w-full py-3 bg-primary text-background rounded-xl text-xs font-bold hover:bg-accent hover:text-primary transition-all" onclick="quickRegisterGuest()">
          ${lang === 'en' ? 'Save Profile / Register' : 'تسجيل حساب جديد'}
        </button>
      `;
    }
  }
}

window.quickRegisterGuest = () => {
  const input = document.getElementById('input-display-name');
  const rawName = input?.value.trim();
  const name = rawName ? sanitizeHtml(rawName) : (i18n.currentLang === 'en' ? 'Lady NOON' : 'عميلة نون الراقية');
  const avatarMode = document.querySelector('input[name="avatar_mode"]:checked')?.value || 'default';

  state.user = {
    id: 'user_' + Date.now(),
    name: name,
    avatarMode: avatarMode,
    photo: 'images/logo.png'
  };
  saveUser();
  renderProfileUI();
  updateGameUI();
  showToast(i18n.currentLang === 'en' ? `Welcome, ${name}!` : `أهلاً بكِ، ${name}!`);
};

window.saveProfileSettings = () => {
  const input = document.getElementById('input-display-name');
  const name = input?.value.trim();
  if (!name) {
    showToast(i18n.currentLang === 'en' ? "Please enter a name" : "يرجى كتابة اسم العرض", "error");
    return;
  }
  const avatarMode = document.querySelector('input[name="avatar_mode"]:checked')?.value || 'default';

  if (!state.user) {
    state.user = { id: 'user_' + Date.now() };
  }
  state.user.name = sanitizeHtml(name);
  state.user.avatarMode = avatarMode;
  saveUser();
  renderProfileUI();
  showToast(i18n.currentLang === 'en' ? "Profile saved successfully" : "تم حفظ بيانات الحساب بنجاح");
};

window.signOutUser = () => {
  state.user = null;
  localStorage.removeItem('noon_user');
  renderProfileUI();
  updateGameUI();
  showToast(i18n.currentLang === 'en' ? "Signed out" : "تم تسجيل الخروج");
};

// --- Screen 7: Favorites ---
window.toggleFavorite = () => {
  if (!state.currentProductId) return;
  toggleFavById(state.currentProductId);
  const favBtn = document.getElementById('product-fav-btn');
  if (favBtn) favBtn.classList.toggle('is-fav', state.favorites.includes(state.currentProductId));
};

window.toggleFavById = (id) => {
  const idx = state.favorites.indexOf(id);
  if (idx > -1) {
    state.favorites.splice(idx, 1);
    showToast(i18n.currentLang === 'en' ? 'Removed from Favorites' : 'تم الإزالة من المفضلة');
  } else {
    state.favorites.push(id);
    showToast(i18n.currentLang === 'en' ? 'Added to Favorites' : 'تمت الإضافة للمفضلة');
  }
  saveFavs();
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const parent = btn.closest('[data-product-id]');
    if (parent) {
      const pid = parseInt(parent.dataset.productId);
      btn.classList.toggle('is-fav', state.favorites.includes(pid));
    }
  });
};

function renderFavorites() {
  const container = document.getElementById('favorites-container');
  if (!container) return;
  const lang = i18n.currentLang;
  const favProducts = state.products.filter(p => state.favorites.includes(p.id));

  if (favProducts.length === 0) {
    container.innerHTML = `
      <div class="py-20 text-center">
        <span class="material-symbols-outlined text-4xl text-primary/30 mb-2">favorite_border</span>
        <p class="text-xs text-primary/50 tracking-wider">${lang === 'en' ? 'No favorites yet' : 'لم تضف أي قطع إلى المفضلة'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-2 gap-[4px]">
      ${favProducts.map(p => {
        const store = state.stores.find(s => s.id === p.storeId) || state.stores[0];
        const sName = sanitizeHtml(lang === 'en' ? store.nameEn : store.nameAr);
        const pName = sanitizeHtml(lang === 'en' ? p.nameEn : p.nameAr);
        const currency = sanitizeHtml(lang === 'en' ? p.currencyEn : p.currencyAr);
        const price = Number(p.price || 0).toLocaleString();

        return `
          <div class="relative cursor-pointer aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-sm" onclick="viewProduct(${Number(p.id)})" data-product-id="${Number(p.id)}">
            <img src="${sanitizeHtml(p.image)}" class="w-full h-full object-cover" onerror="this.src='images/hero_noon.jpg'">
            <button class="fav-btn is-fav absolute top-2 right-2 z-10" onclick="event.stopPropagation(); toggleFavById(${Number(p.id)}); renderFavorites();">
              <span class="material-symbols-outlined">favorite</span>
            </button>
            <div class="product-info">
              <span class="text-[8px] bg-accent/90 text-primary px-1.5 py-0.5 rounded font-bold uppercase mb-1 inline-block">
                ${sName}
              </span>
              <h4 class="font-serif text-white text-xs truncate">${pName}</h4>
              <p class="text-gold-light text-xs font-bold">${currency}${price}</p>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// --- Screen 8: Comments & Reviews ---
async function renderComments() {
  const list = document.getElementById('comments-list');
  if (!list) return;

  const reviews = await db.getReviews();

  list.innerHTML = reviews.map(c => `
    <div class="p-4 rounded-xl bg-white border border-primary/5 shadow-sm mb-3">
      <div class="flex items-center justify-between mb-1.5">
        <h5 class="font-serif text-xs font-bold text-primary">${sanitizeHtml(c.authorName)}</h5>
        <span class="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">${sanitizeHtml(c.storeName || 'منصة نون')}</span>
      </div>
      <p class="text-xs text-primary/70 font-light leading-relaxed">${sanitizeHtml(c.content)}</p>
      <span class="text-[8px] text-primary/40 mt-2 block">${sanitizeHtml(c.createdAt)}</span>
    </div>
  `).join('');
}

window.postComment = async () => {
  const textEl = document.getElementById('comment-text');
  const text = textEl?.value.trim();
  if (!text) {
    showToast(i18n.currentLang === 'en' ? "Please write your review" : "يرجى كتابة التقييم", "error");
    return;
  }

  const currentStore = state.stores.find(s => s.id === state.activeStoreId);
  const author = state.user?.name || (i18n.currentLang === 'en' ? 'Valued Client' : 'عميلة نون');

  await db.addReview({
    storeId: state.activeStoreId,
    storeName: currentStore ? (i18n.currentLang === 'en' ? currentStore.nameEn : currentStore.nameAr) : 'منصة نون',
    authorName: author,
    content: text
  });

  if (textEl) textEl.value = '';
  await renderComments();
  showToast(i18n.currentLang === 'en' ? "Thank you! Review submitted" : "شكراً لكِ! تم إرسال تقييمكِ وحفظه بنجاح");
};

// --- Overlays & Search Helpers ---
window.toggleSearch = (show) => document.getElementById('search-overlay')?.classList.toggle('visible', show);
window.toggleMoreMenu = (show) => document.getElementById('more-overlay')?.classList.toggle('visible', show);

window.handleSearch = (query) => {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) { resultsContainer.innerHTML = ''; return; }

  const lang = i18n.currentLang;
  const matches = state.products.filter(p => 
    (p.nameAr && p.nameAr.toLowerCase().includes(q)) || 
    (p.nameEn && p.nameEn.toLowerCase().includes(q)) || 
    (p.category && p.category.toLowerCase().includes(q))
  );

  if (matches.length === 0) {
    resultsContainer.innerHTML = `<p class="text-xs text-primary/50 text-center py-4">${lang === 'en' ? 'No items found' : 'لم يتم العثور على نتائج'}</p>`;
    return;
  }

  resultsContainer.innerHTML = matches.map(p => `
    <div class="p-2.5 rounded-xl bg-primary/5 flex items-center gap-3 cursor-pointer hover:bg-primary/10" onclick="toggleSearch(false); viewProduct(${Number(p.id)})">
      <img src="${sanitizeHtml(p.image)}" class="w-10 h-10 object-cover rounded-lg" onerror="this.src='images/hero_noon.jpg'">
      <div class="flex-1 min-w-0">
        <h5 class="text-xs font-serif font-bold text-primary truncate">${sanitizeHtml(lang === 'en' ? p.nameEn : p.nameAr)}</h5>
        <span class="text-[9px] text-accent font-bold">${sanitizeHtml(lang === 'en' ? p.currencyEn : p.currencyAr)}${Number(p.price || 0).toLocaleString()}</span>
      </div>
    </div>
  `).join('');
};

window.searchTag = (tag) => {
  const input = document.getElementById('store-search-input');
  if (input) {
    input.value = tag;
    handleSearch(tag);
  }
};

window.toggleAccordion = (btn) => {
  const content = btn.nextElementSibling;
  const icon = btn.querySelector('.material-symbols-outlined');
  const isOpen = !content.classList.contains('hidden');
  if (isOpen) {
    content.classList.add('hidden');
    if (icon) icon.style.transform = 'rotate(0deg)';
  } else {
    content.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
  }
};

window.toggleLanguage = () => {
  i18n.toggleLanguage();
  const active = document.querySelector('.screen.active');
  if (active) renderScreenContent(active.id.replace('screen-', ''));
  updateCartUI();
  updateGameUI();
};

window.closeSuccess = () => {
  document.getElementById('success-screen')?.classList.add('hidden');
  navigate('hub');
};

// --- NOON Luxury Stories Engine (القصص والستوريات) ---
let storyInterval = null;
let storyProgress = 0;
const STORY_DURATION = 5500; // 5.5 seconds per story

window.openStoriesModal = (startIndex = 0) => {
  if (!state.stories || state.stories.length === 0) {
    showToast(i18n.currentLang === 'en' ? "No stories published currently" : "لا توجد ستوريات منشورة حالياً");
    return;
  }
  const modal = document.getElementById('stories-modal');
  if (!modal) return;

  state.currentStoryIndex = Math.max(0, Math.min(startIndex, state.stories.length - 1));
  state.isStoryPaused = false;
  modal.classList.add('active');
  modal.classList.remove('hidden');

  renderStoryProgressBars();
  renderStorySlide(state.currentStoryIndex);
  startStoryTimer();
};

window.closeStoriesModal = () => {
  clearInterval(storyInterval);
  const modal = document.getElementById('stories-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }
};

function renderStoryProgressBars() {
  const container = document.getElementById('stories-progress-bars');
  if (!container) return;
  container.innerHTML = state.stories.map((_, i) => `
    <div class="story-bar-segment" id="story-bar-${i}">
      <div class="story-bar-fill" id="story-fill-${i}"></div>
    </div>
  `).join('');
}

function renderStorySlide(idx) {
  const story = state.stories[idx];
  if (!story) return;
  const lang = i18n.currentLang;

  const avatarEl = document.getElementById('story-boutique-avatar');
  const nameEl = document.getElementById('story-boutique-name');
  const timeEl = document.getElementById('story-time');
  const imgEl = document.getElementById('story-img');
  const titleEl = document.getElementById('story-title');
  const captionEl = document.getElementById('story-caption');
  const tagEl = document.getElementById('story-tag');
  const ctaText = document.getElementById('story-cta-text');

  if (avatarEl) avatarEl.src = story.avatar || 'images/logo.png';
  if (nameEl) nameEl.innerText = lang === 'en' ? (story.storeNameEn || 'NOON Platform') : (story.storeNameAr || 'منصة نون');
  if (timeEl) timeEl.innerText = story.time || (lang === 'en' ? 'Recently' : 'مؤخراً');
  if (titleEl) titleEl.innerText = lang === 'en' ? story.titleEn : story.titleAr;
  if (captionEl) captionEl.innerText = lang === 'en' ? (story.captionEn || '') : (story.captionAr || '');
  if (tagEl) tagEl.innerText = lang === 'en' ? (story.storeNameEn || 'Exclusive') : (story.storeNameAr || 'حصري');
  if (ctaText) ctaText.innerText = lang === 'en' ? (story.ctaEn || 'Explore') : (story.ctaAr || 'استعراض التشكيلة');

  if (imgEl) {
    imgEl.classList.remove('story-kenburns');
    void imgEl.offsetWidth; // Trigger reflow for fresh animation
    imgEl.src = story.image || 'images/hero_noon.jpg';
    imgEl.classList.add('story-kenburns');
  }

  // Update bars states
  state.stories.forEach((_, i) => {
    const fill = document.getElementById(`story-fill-${i}`);
    if (fill) {
      if (i < idx) fill.style.width = '100%';
      else if (i > idx) fill.style.width = '0%';
      else fill.style.width = '0%';
    }
  });
}

function startStoryTimer() {
  clearInterval(storyInterval);
  storyProgress = 0;
  const stepTime = 50;
  const increment = (stepTime / STORY_DURATION) * 100;

  storyInterval = setInterval(() => {
    if (state.isStoryPaused) return;

    storyProgress += increment;
    const fill = document.getElementById(`story-fill-${state.currentStoryIndex}`);
    if (fill) fill.style.width = `${Math.min(100, storyProgress)}%`;

    if (storyProgress >= 100) {
      clearInterval(storyInterval);
      nextStory();
    }
  }, stepTime);
}

window.nextStory = () => {
  clearInterval(storyInterval);
  if (state.currentStoryIndex < state.stories.length - 1) {
    state.currentStoryIndex++;
    renderStorySlide(state.currentStoryIndex);
    startStoryTimer();
  } else {
    closeStoriesModal();
  }
};

window.prevStory = () => {
  clearInterval(storyInterval);
  if (state.currentStoryIndex > 0) {
    state.currentStoryIndex--;
    renderStorySlide(state.currentStoryIndex);
    startStoryTimer();
  } else {
    renderStorySlide(0);
    startStoryTimer();
  }
};

window.toggleStoryPause = () => {
  state.isStoryPaused = !state.isStoryPaused;
  const icon = document.getElementById('story-pause-icon');
  if (icon) icon.innerText = state.isStoryPaused ? 'play_arrow' : 'pause';
};

window.executeStoryAction = () => {
  const story = state.stories[state.currentStoryIndex];
  if (!story) return;

  closeStoriesModal();

  if (story.ctaAction && story.ctaAction.startsWith('store:')) {
    const storeId = story.ctaAction.split(':')[1];
    selectStore(storeId);
  } else {
    navigate('hub');
  }
};

// --- Boot Application & Luxury Motion Entrance ---
const boot = async () => {
  const progressEl = document.getElementById('splash-progress');
  const percentEl = document.getElementById('splash-percent');

  let loadProgress = 15;
  const setLoad = (val) => {
    loadProgress = val;
    if (progressEl) progressEl.style.width = `${val}%`;
    if (percentEl) percentEl.innerText = `${val}%`;
  };

  setLoad(30);

  // 1. Load initial data through secure data layer
  state.stores = await db.getStores();
  setLoad(60);

  state.products = await db.getProducts();
  setLoad(85);

  state.gameConfig = await db.getGameConfig();
  state.stories = await db.getStories();
  setLoad(100);

  // 2. Initial renders
  renderStoresHub();
  renderStoreSwitcher();
  updateCartUI();
  updateGameUI();

  // 3. Ultra-Smooth GSAP Motion Reveal Timeline
  if (window.gsap) {
    const tl = gsap.timeline({ delay: 0.2 });
    tl.to('.splash-logo-wrap', { scale: 1.08, filter: 'drop-shadow(0 0 35px #D4AF37)', duration: 0.6, ease: 'power2.out' })
      .to('#splash-screen', { 
        opacity: 0, 
        y: -15, 
        duration: 0.85, 
        ease: 'power3.inOut',
        onComplete: () => {
          const splash = document.getElementById('splash-screen');
          if (splash) splash.classList.add('splash-hidden');
        }
      })
      .fromTo('#top-nav', { y: -25, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.35')
      .fromTo('#platform-stores-section', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.4')
      .fromTo('.store-hub-card', { y: 35, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, ease: 'power2.out' }, '-=0.5');
  } else {
    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      if (splash) splash.classList.add('splash-hidden');
    }, 600);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
