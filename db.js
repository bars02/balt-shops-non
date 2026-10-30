// ==============================================================================
// NOON Platform - Resilient Security & Unified Data Access Layer (db.js)
// Provides XSS protection, Supabase Cloud Synchronization & Local Storage Fallback
// ==============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { initialStores, initialProducts, initialGameConfig } from './menu-data.js';

// --- 1. XSS SANITIZATION HELPER ---
export function sanitizeHtml(str) {
  if (str === null || str === undefined) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

// Sanitize deep object strings
export function sanitizeData(data) {
  if (typeof data === 'string') return sanitizeHtml(data);
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (data !== null && typeof data === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      clean[k] = sanitizeData(v);
    }
    return clean;
  }
  return data;
}

// --- 2. SUPABASE INITIALIZATION ---
let supabaseClient = null;
let isSupabaseOnline = false;

const SB_URL = SUPABASE_URL || localStorage.getItem('SB_URL') || '';
const SB_KEY = SUPABASE_ANON_KEY || localStorage.getItem('SB_KEY') || '';

if (SB_URL && SB_KEY && window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
    isSupabaseOnline = true;
  } catch (err) {
    console.warn('[NOON DB] Supabase client init warning:', err);
    isSupabaseOnline = false;
  }
}

export const getSupabase = () => supabaseClient;

// --- 3. UNIFIED DATA ACCESS METHODS ---
export const db = {
  isCloudReady: () => isSupabaseOnline && !!supabaseClient,

  // --- STORES ---
  async getStores() {
    if (this.isCloudReady()) {
      try {
        const { data, error } = await supabaseClient
          .from('stores')
          .select('*')
          .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) {
          // Normalize column names
          const stores = data.map(s => ({
            id: s.id,
            slug: s.slug || s.id,
            nameAr: s.name_ar,
            nameEn: s.name_en,
            badgeAr: s.badge_ar,
            badgeEn: s.badge_en,
            descriptionAr: s.description_ar,
            descriptionEn: s.description_en,
            banner: s.banner || '',
            avatar: s.avatar || '',
            whatsapp: s.whatsapp || '',
            instagram: s.instagram || '',
            facebook: s.facebook || '',
            order: s.display_order,
            active: s.is_active,
            categories: []
          }));

          // Fetch categories
          const { data: catData } = await supabaseClient.from('categories').select('*');
          if (catData) {
            stores.forEach(st => {
              st.categories = catData
                .filter(c => c.store_id === st.id)
                .map(c => ({ id: c.id, titleAr: c.title_ar, titleEn: c.title_en }));
              if (!st.categories.some(c => c.id === 'all')) {
                st.categories.unshift({ id: 'all', titleAr: 'الكل', titleEn: 'All' });
              }
            });
          }
          localStorage.setItem('noon_stores', JSON.stringify(stores));
          return stores;
        }
      } catch (e) {
        console.warn('[NOON DB] Falling back to local stores cache:', e);
      }
    }
    // Fallback: LocalStorage / Initial
    const local = localStorage.getItem('noon_stores');
    if (local) {
      try { return JSON.parse(local); } catch(e) {}
    }
    return initialStores;
  },

  async saveStore(store) {
    // 1. Save local
    const local = await this.getStores();
    const idx = local.findIndex(s => s.id === store.id);
    if (idx > -1) {
      local[idx] = { ...local[idx], ...store };
    } else {
      local.push(store);
    }
    localStorage.setItem('noon_stores', JSON.stringify(local));

    // 2. Sync to Supabase
    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('stores').upsert({
          id: store.id,
          slug: store.slug || store.id,
          name_ar: store.nameAr,
          name_en: store.nameEn,
          badge_ar: store.badgeAr,
          badge_en: store.badgeEn,
          description_ar: store.descriptionAr,
          description_en: store.descriptionEn,
          banner: store.banner,
          avatar: store.avatar || 'images/logo.png',
          whatsapp: store.whatsapp,
          instagram: store.instagram,
          facebook: store.facebook,
          display_order: store.order || 1,
          is_active: store.active !== false
        });
      } catch (e) {
        console.error('[NOON DB] Cloud store sync error:', e);
      }
    }
    return local;
  },

  // --- PRODUCTS ---
  async getProducts(storeId = null) {
    if (this.isCloudReady()) {
      try {
        let q = supabaseClient
          .from('products')
          .select('*')
          .order('id', { ascending: false });
        if (storeId) q = q.eq('store_id', storeId);
        const { data, error } = await q;

        if (!error && data && data.length > 0) {
          const prods = data.map(p => ({
            id: p.id,
            storeId: p.store_id,
            category: p.category,
            nameAr: p.name_ar,
            nameEn: p.name_en,
            price: Number(p.price) || 0,
            currencyAr: p.currency_ar || 'د.ع ',
            currencyEn: p.currency_en || 'IQD ',
            image: p.image,
            images: p.images || (p.image ? [p.image] : []),
            descriptionAr: p.description_ar,
            descriptionEn: p.description_en,
            heritageAr: p.heritage_ar,
            heritageEn: p.heritage_en,
            colors: p.colors || [],
            variants: p.colors || [],
            sizes: Array.isArray(p.sizes) ? p.sizes : ['Standard'],
            available: p.is_available !== false
          }));
          if (!storeId) {
            localStorage.setItem('noon_products', JSON.stringify(prods));
          }
          return prods;
        }
      } catch (e) {
        console.warn('[NOON DB] Falling back to local products cache:', e);
      }
    }
    const local = localStorage.getItem('noon_products');
    if (local) {
      try {
        let prods = JSON.parse(local);
        if (storeId) prods = prods.filter(p => p.storeId === storeId);
        return prods;
      } catch(e) {}
    }
    let fallback = initialProducts;
    if (storeId) fallback = fallback.filter(p => p.storeId === storeId);
    return fallback;
  },

  async saveProduct(prod) {
    const prodObj = {
      ...prod,
      id: Number(prod.id),
      colors: prod.variants || prod.colors || [],
      variants: prod.variants || prod.colors || [],
      images: prod.images || (prod.image ? [prod.image] : [])
    };

    const local = await this.getProducts();
    const idx = local.findIndex(p => p.id === prodObj.id);
    if (idx > -1) {
      local[idx] = { ...local[idx], ...prodObj };
    } else {
      local.unshift(prodObj);
    }
    localStorage.setItem('noon_products', JSON.stringify(local));

    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('products').upsert({
          id: prodObj.id,
          store_id: prodObj.storeId,
          category: prodObj.category,
          name_ar: prodObj.nameAr,
          name_en: prodObj.nameEn,
          price: prodObj.price,
          currency_ar: prodObj.currencyAr || 'د.ع ',
          currency_en: prodObj.currencyEn || 'IQD ',
          image: prodObj.image,
          images: prodObj.images,
          description_ar: prodObj.descriptionAr,
          description_en: prodObj.descriptionEn,
          heritage_ar: prodObj.heritageAr,
          heritage_en: prodObj.heritageEn,
          colors: prodObj.colors,
          sizes: prodObj.sizes || ['Standard'],
          is_available: true
        });
      } catch (e) {
        console.error('[NOON DB] Cloud product sync error:', e);
      }
    }
    return local;
  },

  async deleteProduct(id) {
    const local = (await this.getProducts()).filter(p => p.id !== id);
    localStorage.setItem('noon_products', JSON.stringify(local));

    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('products').delete().eq('id', id);
      } catch (e) {
        console.error('[NOON DB] Cloud product delete error:', e);
      }
    }
    return local;
  },

  // --- REVIEWS / COMMENTS ---
  async getReviews(filter = null) {
    const storeId = typeof filter === 'string' ? filter : filter?.storeId;
    const productId = typeof filter === 'object' ? filter?.productId : null;
    const includeUnapproved = filter?.includeUnapproved === true;

    if (this.isCloudReady()) {
      try {
        let q = supabaseClient.from('reviews').select('*').order('created_at', { ascending: false });
        if (storeId) q = q.eq('store_id', storeId);
        if (productId) q = q.eq('product_id', productId);
        if (!includeUnapproved) q = q.eq('is_approved', true);
        const { data, error } = await q;
        if (!error && data) {
          const storeNames = {
            'elegance': 'إليجانس نون',
            'casual': 'كاجوال نون',
            'royal': 'رويال نون'
          };
          return data.map(r => {
            let formattedDate = 'مؤخراً';
            if (r.created_at) {
              try {
                const d = new Date(r.created_at);
                formattedDate = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' });
              } catch(e) {
                formattedDate = String(r.created_at);
              }
            }
            return {
              id: r.id,
              storeId: r.store_id,
              productId: r.product_id,
              storeName: storeNames[r.store_id] || 'منصة نون',
              authorName: sanitizeHtml(r.author_name),
              content: sanitizeHtml(r.content),
              rating: r.rating || 5,
              approved: r.is_approved !== false,
              createdAt: formattedDate
            };
          });
        }
      } catch (e) {
        console.warn('[NOON DB] Fallback to local reviews:', e);
      }
    }
    const local = localStorage.getItem('noon_reviews');
    let reviewsList = [];
    if (local) {
      try { reviewsList = JSON.parse(local); } catch (e) {}
    }
    if (!includeUnapproved) {
      reviewsList = reviewsList.filter(r => r.approved !== false);
    }
    if (storeId) reviewsList = reviewsList.filter(r => r.storeId === storeId);
    if (productId) reviewsList = reviewsList.filter(r => r.productId === productId);
    return reviewsList;
  },

  async addReview(review) {
    const cleanReview = {
      id: Date.now(),
      storeId: review.storeId || 'elegance',
      productId: review.productId || null,
      storeName: review.storeName || 'منصة نون',
      authorName: sanitizeHtml(review.authorName || 'عميلة نون'),
      content: sanitizeHtml(review.content || ''),
      rating: 5,
      approved: true,
      createdAt: 'الآن'
    };

    // Save local
    const reviews = JSON.parse(localStorage.getItem('noon_reviews') || '[]');
    reviews.unshift(cleanReview);
    localStorage.setItem('noon_reviews', JSON.stringify(reviews));

    // Save Cloud
    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('reviews').insert({
          store_id: cleanReview.storeId,
          product_id: cleanReview.productId,
          author_name: cleanReview.authorName,
          content: cleanReview.content,
          rating: 5,
          is_approved: true
        });
      } catch (e) {
        console.error('[NOON DB] Cloud review insert error:', e);
      }
    }
    return cleanReview;
  },

  async toggleReviewApproval(id, approved) {
    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('reviews').update({ is_approved: approved }).eq('id', id);
      } catch(e) {}
    }
    let reviews = JSON.parse(localStorage.getItem('noon_reviews') || '[]');
    const target = reviews.find(r => r.id === id);
    if (target) {
      target.approved = approved;
      localStorage.setItem('noon_reviews', JSON.stringify(reviews));
    }
    return reviews;
  },

  async deleteReview(id) {
    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('reviews').delete().eq('id', id);
      } catch (err) {
        console.warn('[NOON DB] deleteReview cloud error:', err);
      }
    }
    let reviews = JSON.parse(localStorage.getItem('noon_reviews') || '[]');
    reviews = reviews.filter(r => r.id !== id);
    localStorage.setItem('noon_reviews', JSON.stringify(reviews));
    return reviews;
  },

  // --- ORDERS ---
  async createOrder(order) {
    const cleanOrder = {
      orderCode: 'NOON-' + Math.floor(100000 + Math.random() * 900000),
      storeId: order.storeId || 'elegance',
      customerName: sanitizeHtml(order.customerName || 'عميلة نون'),
      customerPhone: sanitizeHtml(order.customerPhone || ''),
      deliveryCity: sanitizeHtml(order.deliveryCity || ''),
      deliveryAddress: sanitizeHtml(order.deliveryAddress || ''),
      items: order.items || [],
      subtotal: order.subtotal || 0,
      total: order.total || 0,
      status: 'pending',
      date: new Date().toISOString()
    };

    // Local
    const orders = JSON.parse(localStorage.getItem('noon_orders') || '[]');
    orders.unshift(cleanOrder);
    localStorage.setItem('noon_orders', JSON.stringify(orders));

    // Cloud
    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('orders').insert({
          order_code: cleanOrder.orderCode,
          store_id: cleanOrder.storeId,
          customer_name: cleanOrder.customerName,
          customer_phone: cleanOrder.customerPhone,
          delivery_city: cleanOrder.deliveryCity,
          delivery_address: cleanOrder.deliveryAddress,
          items: cleanOrder.items,
          subtotal: cleanOrder.subtotal,
          total: cleanOrder.total,
          status: 'pending'
        });
      } catch (e) {
        console.error('[NOON DB] Cloud order sync error:', e);
      }
    }
    return cleanOrder;
  },

  // --- GAME CONFIG & SPINS ---
  async getGameConfig() {
    if (this.isCloudReady()) {
      try {
        const { data: prizes } = await supabaseClient.from('game_prizes').select('*').eq('is_active', true);
        const { data: settings } = await supabaseClient.from('game_settings').select('*').eq('id', 1).single();

        if (prizes && prizes.length > 0) {
          const config = {
            dailyAttemptsAllowed: settings?.daily_attempts_allowed || 1,
            enabled: settings?.is_enabled !== false,
            prizes: prizes.map(p => ({
              id: p.id,
              nameAr: p.name_ar,
              nameEn: p.name_en,
              code: p.code,
              icon: p.icon,
              color: p.color,
              weight: p.weight,
              symbol: p.symbol
            }))
          };
          localStorage.setItem('noon_game_config', JSON.stringify(config));
          return config;
        }
      } catch (e) {
        console.warn('[NOON DB] Fallback to local game config:', e);
      }
    }
    const local = localStorage.getItem('noon_game_config');
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }
    return initialGameConfig;
  },

  async saveGameConfig(config) {
    localStorage.setItem('noon_game_config', JSON.stringify(config));
    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('game_settings').upsert({
          id: 1,
          daily_attempts_allowed: config.dailyAttemptsAllowed || 1,
          is_enabled: config.enabled !== false,
          updated_at: new Date().toISOString()
        });
        if (config.prizes && config.prizes.length > 0) {
          for (const p of config.prizes) {
            await supabaseClient.from('game_prizes').upsert({
              id: String(p.id || p.code || 'prize_' + Math.random()),
              name_ar: p.nameAr,
              name_en: p.nameEn,
              code: p.code || null,
              icon: p.icon || '🎁',
              color: p.color || '#D4AF37',
              weight: p.weight || 10,
              symbol: p.symbol || p.icon || '💎',
              is_active: true
            });
          }
        }
      } catch (err) {
        console.warn('[NOON DB] saveGameConfig cloud note:', err);
      }
    }
    return config;
  },

  async recordDailySpin(userId, prize) {
    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('daily_spins').insert({
          user_identifier: userId,
          prize_id: prize?.id || null,
          prize_code: prize?.code || null,
          spin_date: new Date().toISOString().split('T')[0]
        });
      } catch (e) {
        console.warn('[NOON DB] Daily spin sync failed:', e);
      }
    }
  },

  // --- STORIES & BROADCASTS (قصص واستوريات المنصة) ---
  async getStories() {
    if (this.isCloudReady()) {
      try {
        const { data, error } = await supabaseClient
          .from('stories')
          .select('*')
          .eq('is_active', true)
          .order('id', { ascending: false });

        if (!error && data) {
          const storeNames = {
            'elegance': 'بيلوز',
            'casual': 'كاجوال نون',
            'royal': 'رويال نون'
          };
          const mapped = data.map(s => ({
            id: s.id,
            storeId: s.store_id || 'platform',
            storeNameAr: storeNames[s.store_id] || s.store_name_ar || 'منصة نون',
            storeNameEn: s.store_name_en || 'NOON Platform',
            avatar: s.avatar || '',
            titleAr: sanitizeHtml(s.title_ar),
            titleEn: sanitizeHtml(s.title_en || s.title_ar),
            captionAr: sanitizeHtml(s.caption_ar || s.title_ar),
            captionEn: sanitizeHtml(s.caption_en || ''),
            image: s.media_url,
            ctaAr: sanitizeHtml(s.cta_ar || 'استعراض التشكيلة'),
            ctaEn: sanitizeHtml(s.cta_en || 'Explore Collection'),
            ctaAction: s.link_target ? `store:${s.link_target}` : (s.store_id ? `store:${s.store_id}` : 'hub'),
            time: 'مؤخراً',
            active: s.is_active !== false
          }));
          localStorage.setItem('noon_stories', JSON.stringify(mapped));
          return mapped;
        }
      } catch (e) {
        console.warn('[NOON DB] Fallback to local stories:', e);
      }
    }
    const local = localStorage.getItem('noon_stories');
    if (local !== null) {
      try { return JSON.parse(local); } catch (e) {}
    }
    return [];
  },

  async saveStory(story) {
    const local = await this.getStories();
    const idx = local.findIndex(s => s.id === story.id);
    if (idx > -1) {
      local[idx] = { ...local[idx], ...story };
    } else {
      local.unshift(story);
    }
    localStorage.setItem('noon_stories', JSON.stringify(local));

    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('stories').upsert({
          id: story.id,
          store_id: story.storeId,
          title_ar: story.titleAr,
          title_en: story.titleEn,
          caption_ar: story.captionAr || story.titleAr,
          caption_en: story.captionEn || '',
          media_url: story.image,
          link_target: story.storeId,
          cta_ar: story.ctaAr || 'استعراض التشكيلة',
          cta_en: story.ctaEn || 'Explore Collection',
          is_active: story.active !== false
        });
      } catch (e) {
        console.warn('[NOON DB] Cloud story sync error:', e);
      }
    }
    return local;
  },

  async deleteStory(id) {
    const local = (await this.getStories()).filter(s => s.id !== id);
    localStorage.setItem('noon_stories', JSON.stringify(local));

    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('stories').delete().eq('id', id);
      } catch (e) {
        console.warn('[NOON DB] Cloud story delete skipped:', e);
      }
    }
    return local;
  },

  // --- PLATFORM SETTINGS (الشعار والتوصيل والتواصل وواجهة الهيرو) ---
  async getPlatformSettings() {
    if (this.isCloudReady()) {
      try {
        const { data, error } = await supabaseClient.from('platform_settings').select('*').eq('id', 1).single();
        if (!error && data) {
          const s = {
            logo: data.logo_url || '',
            whatsapp: data.whatsapp || '',
            instagram: data.instagram || '',
            deliveryFee: Number(data.delivery_fee) || 0,
            currencyAr: data.currency_ar || 'د.ع',
            currencyEn: data.currency_en || 'IQD',
            heroBg: data.hero_bg || '',
            heroBadgeAr: data.hero_badge_ar || '',
            heroBadgeEn: data.hero_badge_en || '',
            heroTitleAr: data.hero_title_ar || '',
            heroTitleEn: data.hero_title_en || '',
            heroDescAr: data.hero_desc_ar || '',
            heroDescEn: data.hero_desc_en || '',
            heroBtnAr: data.hero_btn_ar || '',
            heroBtnEn: data.hero_btn_en || '',
            wheelPrizes: data.wheel_prizes || null,
            storyDuration: Number(data.story_duration) || 6,
            reviewsEnabled: data.reviews_enabled !== false
          };
          localStorage.setItem('noon_platform_settings', JSON.stringify(s));
          return s;
        }
      } catch (e) {
        console.warn('[NOON DB] Falling back to local platform settings:', e);
      }
    }
    const local = localStorage.getItem('noon_platform_settings');
    if (local) {
      try { return { ...initialPlatformSettings, ...JSON.parse(local) }; } catch(e) {}
    }
    return initialPlatformSettings;
  },

  async savePlatformSettings(settings) {
    const current = await this.getPlatformSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem('noon_platform_settings', JSON.stringify(updated));

    if (this.isCloudReady()) {
      try {
        await supabaseClient.from('platform_settings').upsert({
          id: 1,
          logo_url: updated.logo,
          whatsapp: updated.whatsapp,
          instagram: updated.instagram,
          delivery_fee: updated.deliveryFee,
          currency_ar: updated.currencyAr,
          currency_en: updated.currencyEn,
          hero_bg: updated.heroBg,
          hero_badge_ar: updated.heroBadgeAr,
          hero_badge_en: updated.heroBadgeEn,
          hero_title_ar: updated.heroTitleAr,
          hero_title_en: updated.heroTitleEn,
          hero_desc_ar: updated.heroDescAr,
          hero_desc_en: updated.heroDescEn,
          hero_btn_ar: updated.heroBtnAr,
          hero_btn_en: updated.heroBtnEn,
          wheel_prizes: updated.wheelPrizes || null,
          story_duration: updated.storyDuration || 6,
          reviews_enabled: updated.reviewsEnabled !== false,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('[NOON DB] Cloud platform settings sync error:', e);
      }
    }
    return updated;
  },

  // --- CLIENT AUTHENTICATION ---
  async clientSignUp(email, password, displayNameOrOptions) {
    const displayName = typeof displayNameOrOptions === 'object'
      ? (displayNameOrOptions?.display_name || displayNameOrOptions?.name || '')
      : (displayNameOrOptions || '');
    const fallbackName = displayName || email.split('@')[0];

    if (!this.isCloudReady()) {
      const mockUser = { id: 'u_' + Date.now(), email, name: fallbackName, isGuest: false };
      localStorage.setItem('noon_user', JSON.stringify(mockUser));
      return { user: mockUser, error: null };
    }
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: fallbackName } }
      });
      if (error) return { user: null, error: error.message };
      const user = {
        id: data.user.id,
        email: data.user.email,
        name: fallbackName,
        isGuest: false
      };
      localStorage.setItem('noon_user', JSON.stringify(user));
      return { user, error: null };
    } catch (err) {
      return { user: null, error: err.message };
    }
  },

  async clientSignIn(email, password) {
    if (!this.isCloudReady()) {
      const mockUser = { id: 'u_' + Date.now(), email, name: email.split('@')[0], isGuest: false };
      localStorage.setItem('noon_user', JSON.stringify(mockUser));
      return { user: mockUser, error: null };
    }
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      const user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.display_name || email.split('@')[0],
        isGuest: false
      };
      localStorage.setItem('noon_user', JSON.stringify(user));
      return { user, error: null };
    } catch (err) {
      return { user: null, error: err.message };
    }
  },

  async clientSignOut() {
    if (this.isCloudReady()) {
      try { await supabaseClient.auth.signOut(); } catch(e) {}
    }
    localStorage.removeItem('noon_user');
  },

  async clientResetPasswordRequest(email) {
    if (!this.isCloudReady()) {
      return { success: true, message: 'تم إرسال كود التحقق الافتراضي: 123456' };
    }
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async clientVerifyResetOtp(email, token, newPassword) {
    if (!this.isCloudReady()) {
      return { success: true };
    }
    try {
      const { error: otpError } = await supabaseClient.auth.verifyOtp({
        email,
        token,
        type: 'recovery'
      });
      if (otpError) return { success: false, error: otpError.message };
      const { error: pwdError } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (pwdError) return { success: false, error: pwdError.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// Initial Platform Default Settings (فارغ لتمكين البدء من الصفر تماماً)
export const initialPlatformSettings = {
  logo: '',
  whatsapp: '',
  instagram: '',
  deliveryFee: 0,
  currencyAr: 'د.ع',
  currencyEn: 'IQD',
  heroBg: '',
  heroBadgeAr: '',
  heroBadgeEn: '',
  heroTitleAr: '',
  heroTitleEn: '',
  heroDescAr: '',
  heroDescEn: '',
  heroBtnAr: '',
  heroBtnEn: '',
  storyDuration: 6,
  reviewsEnabled: true
};

// Initial Luxury Fashion Stories (فارغ لمسح الداتا الافتراضية)
export const initialStories = [];
