// ==============================================================================
// منصة نون | NOON Multi-Store Platform - Central Admin Dashboard Engine
// Secured against unauthorized bypass, XSS injection & state corruption
// ==============================================================================

import { db, sanitizeHtml, getSupabase } from '../db.js';
import { ADMIN_EMAIL } from '../config.js';

// --- State ---
let stores = [];
let products = [];
let stories = [];
let gameConfig = { dailyAttemptsAllowed: 1, prizes: [] };
let currentSection = 'stores';
let editingStoreId = null;
let editingProductId = null;

// --- Toast ---
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerHTML = sanitizeHtml(msg);
    t.style.background = isError ? '#b91c1c' : 'var(--primary)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

// --- Image File Upload Handler (Direct Import from Device/Mobile) ---
window.handleImageUpload = (inputEl, targetInputId, previewImgId) => {
    if (!inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    if (file.size > 5 * 1024 * 1024) {
        showToast("حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 5 ميجابايت", true);
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Data = e.target.result;
        const targetInput = document.getElementById(targetInputId);
        if (targetInput) targetInput.value = base64Data;
        if (previewImgId) {
            const previewImg = document.getElementById(previewImgId);
            if (previewImg) previewImg.src = base64Data;
        }
        showToast("تم استيراد الصورة بنجاح من جهازكِ!");
    };
    reader.onerror = () => {
        showToast("فشل استيراد الصورة من الجهاز", true);
    };
    reader.readAsDataURL(file);
};

// --- Strict Supabase Auth Handling ---
const checkSession = async () => {
    const overlay = document.getElementById('auth-overlay');
    const sb = getSupabase();
    if (sb) {
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.user?.email) {
                const userEmail = session.user.email.toLowerCase().trim();
                const targetAdmin = (ADMIN_EMAIL || '').toLowerCase().trim();

                if (!targetAdmin || userEmail === targetAdmin) {
                    overlay?.classList.remove('active');
                    await init();
                    return;
                } else {
                    console.warn('[Auth] Logged in user does not match authorized admin email');
                    await sb.auth.signOut();
                }
            }
        } catch (e) {
            console.warn('[Auth] Session check failed:', e);
        }
    }
    overlay?.classList.add('active');
};

document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-password');
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');

    const email = emailEl?.value.trim().toLowerCase();
    const pass = passEl?.value.trim();

    if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.innerText = '';
    }

    if (!email || !pass) {
        if (errorEl) {
            errorEl.innerText = "يرجى كتابة البريد الإلكتروني وكلمة المرور!";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const sb = getSupabase();
    if (!sb) {
        if (errorEl) {
            errorEl.innerText = "تعذر الاتصال بخدمة Supabase. يرجى التأكد من الاتصال بالإنترنت.";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "جاري التحقق من الهوية...";
        }

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: pass
        });

        if (error || !data?.user) {
            let msg = "البريد الإلكتروني أو كلمة المرور غير صحيحة!";
            if (error?.message?.includes("Invalid login credentials")) {
                msg = "بيانات الدخول غير صحيحة. يرجى التأكد من البريد وكلمة المرور.";
            } else if (error?.message?.includes("Email not confirmed")) {
                msg = "البريد الإلكتروني لم يتم تأكيده بعد في Supabase!";
            }
            if (errorEl) {
                errorEl.innerText = msg;
                errorEl.classList.remove('hidden');
            }
            showToast(msg, true);
            return;
        }

        // Check if restricted to a specific ADMIN_EMAIL
        const userEmail = (data.user.email || '').toLowerCase().trim();
        const targetAdmin = (ADMIN_EMAIL || '').toLowerCase().trim();

        if (targetAdmin && userEmail !== targetAdmin) {
            await sb.auth.signOut();
            const msg = `هذا البريد (${userEmail}) غير مصرح له بالدخول كمدير للنظام!`;
            if (errorEl) {
                errorEl.innerText = msg;
                errorEl.classList.remove('hidden');
            }
            showToast(msg, true);
            return;
        }

        // Successfully authenticated!
        document.getElementById('auth-overlay')?.classList.remove('active');
        if (emailEl) emailEl.value = '';
        if (passEl) passEl.value = '';
        await init();
        showToast(`مرحباً بكِ في لوحة الإدارة (${userEmail})`);

    } catch (err) {
        console.error('[Dashboard Login Exception]:', err);
        if (errorEl) {
            errorEl.innerText = "حدث خطأ غير متوقع أثناء تسجيل الدخول.";
            errorEl.classList.remove('hidden');
        }
        showToast("فشل تسجيل الدخول", true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "تسجيل الدخول الآمن";
        }
    }
});

window.logout = async () => {
    const sb = getSupabase();
    if (sb) {
        try {
            await sb.auth.signOut();
        } catch(e) {}
    }
    document.getElementById('auth-overlay')?.classList.add('active');
    showToast("تم تسجيل الخروج بنجاح");
};

// --- Sidebar Toggle for Mobile ---
window.toggleSidebar = (open) => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (open) {
        sb?.classList.add('open');
        ov?.classList.add('active');
    } else {
        sb?.classList.remove('open');
        ov?.classList.remove('active');
    }
};

// --- Section Navigation ---
window.showSection = (sec) => {
    currentSection = sec;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const activeSec = document.getElementById(`section-${sec}`);
    const activeBtn = document.getElementById(`nav-${sec}`);
    if (activeSec) activeSec.classList.add('active');
    if (activeBtn) activeBtn.classList.add('active');

    toggleSidebar(false);

    if (sec === 'stores') renderStoresSection();
    if (sec === 'hero') renderHeroSection();
    if (sec === 'categories') renderCategoriesSection();
    if (sec === 'products') renderProductsSection();
    if (sec === 'game') renderGameSection();
    if (sec === 'comments') renderCommentsSection();
    if (sec === 'stories') renderStoriesSection();
    if (sec === 'settings') renderSettingsSection();
};

// ============================================================
// 1. STORES MANAGEMENT (إدارة المتاجر)
// ============================================================
function renderStoresSection() {
    const grid = document.getElementById('stores-admin-grid');
    if (!grid) return;

    grid.innerHTML = stores.map(store => {
        const prodCount = products.filter(p => p.storeId === store.id).length;
        const catCount = store.categories?.length || 0;
        const nameAr = sanitizeHtml(store.nameAr);
        const nameEn = sanitizeHtml(store.nameEn);
        const badge = sanitizeHtml(store.badgeAr || '-');
        const banner = sanitizeHtml(store.banner || '../images/hero_noon.jpg');
        const whatsapp = sanitizeHtml(store.whatsapp || '');
        const desc = sanitizeHtml(store.descriptionAr || '');
        const sId = sanitizeHtml(store.id);

        return `
            <div class="card overflow-hidden flex flex-col justify-between">
                <div>
                    <div class="h-36 relative overflow-hidden">
                        <img src="${banner}" class="w-full h-full object-cover" onerror="this.src='../images/hero_noon.jpg'">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                        <div class="absolute top-3 right-3 flex gap-2">
                            <span class="badge ${store.active !== false ? 'badge-active' : 'badge-inactive'}">
                                ${store.active !== false ? 'متجر نشط' : 'متجر مخفي'}
                            </span>
                        </div>
                        <div class="absolute bottom-3 right-3 left-3 text-white">
                            <h4 class="font-serif text-lg font-bold">${nameAr}</h4>
                            <p class="text-[10px] text-white/70">${nameEn}</p>
                        </div>
                    </div>
                    <div class="p-4 space-y-2 text-xs">
                        <div class="flex justify-between text-primary/70">
                            <span>الشعار:</span>
                            <span class="font-bold text-accent">${badge}</span>
                        </div>
                        <div class="flex justify-between text-primary/70">
                            <span>واتساب الطلبات:</span>
                            <span class="font-mono" dir="ltr">${whatsapp}</span>
                        </div>
                        <div class="flex justify-between text-primary/70">
                            <span>إحصائيات المتجر:</span>
                            <span class="font-bold">${prodCount} منتج | ${catCount} قسم</span>
                        </div>
                        <p class="text-[11px] text-primary/60 line-clamp-2 pt-1 font-light">${desc}</p>
                    </div>
                </div>
                <div class="p-4 border-t border-primary/5 flex gap-2 bg-primary/2">
                    <button class="btn-gold flex-1 py-2 rounded-xl text-xs flex items-center justify-center gap-1" onclick="editStore('${sId}')">
                        <span class="material-symbols-outlined text-sm">edit</span> تعديل
                    </button>
                    <button class="btn-outline px-3 py-2 rounded-xl text-xs flex items-center justify-center" onclick="toggleStoreActive('${sId}')" title="${store.active !== false ? 'إخفاء المتجر' : 'تفعيل المتجر'}">
                        <span class="material-symbols-outlined text-sm">${store.active !== false ? 'visibility_off' : 'visibility'}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.openStoreModal = () => {
    editingStoreId = null;
    document.getElementById('store-modal-title').innerText = 'إضافة متجر جديد للمنصة';
    document.getElementById('store-form')?.reset();
    document.getElementById('store-edit-id').value = '';
    document.getElementById('store-active-check').checked = true;
    document.getElementById('store-modal')?.classList.add('open');
};

window.closeStoreModal = () => {
    document.getElementById('store-modal')?.classList.remove('open');
};

window.editStore = (id) => {
    const s = stores.find(x => x.id === id);
    if (!s) return;
    editingStoreId = id;

    document.getElementById('store-modal-title').innerText = `تعديل متجر: ${s.nameAr}`;
    document.getElementById('store-edit-id').value = s.id;
    document.getElementById('store-name-ar').value = s.nameAr || '';
    document.getElementById('store-name-en').value = s.nameEn || '';
    document.getElementById('store-badge-ar').value = s.badgeAr || '';
    document.getElementById('store-badge-en').value = s.badgeEn || '';
    document.getElementById('store-desc-ar').value = s.descriptionAr || '';
    document.getElementById('store-banner-url').value = s.banner || '';
    document.getElementById('store-whatsapp').value = s.whatsapp || '';
    document.getElementById('store-instagram').value = s.instagram || '';
    document.getElementById('store-order').value = s.order || 1;
    document.getElementById('store-active-check').checked = s.active !== false;

    document.getElementById('store-modal')?.classList.add('open');
};

window.saveStore = async (e) => {
    e.preventDefault();
    const id = document.getElementById('store-edit-id').value.trim() || ('store_' + Date.now());
    const nameAr = document.getElementById('store-name-ar').value.trim();
    const nameEn = document.getElementById('store-name-en').value.trim();
    const badgeAr = document.getElementById('store-badge-ar').value.trim();
    const badgeEn = document.getElementById('store-badge-en').value.trim();
    const descAr = document.getElementById('store-desc-ar').value.trim();
    const banner = document.getElementById('store-banner-url').value.trim() || 'images/hero_noon.jpg';
    const whatsapp = document.getElementById('store-whatsapp').value.trim();
    const instagram = document.getElementById('store-instagram').value.trim();
    const order = parseInt(document.getElementById('store-order').value) || 1;
    const active = document.getElementById('store-active-check').checked;

    const storeObj = {
        id,
        nameAr,
        nameEn,
        badgeAr,
        badgeEn,
        descriptionAr: descAr,
        descriptionEn: nameEn + " bespoke collection.",
        banner,
        whatsapp,
        instagram,
        order,
        active,
        categories: [
            { id: "all", titleAr: "الكل", titleEn: "All" },
            { id: "new", titleAr: "وصل حديثاً", titleEn: "New In" }
        ]
    };

    stores = await db.saveStore(storeObj);
    showToast(editingStoreId ? "تم تحديث بيانات المتجر بنجاح" : "تمت إضافة المتجر الجديد إلى المنصة بنجاح!");

    closeStoreModal();
    renderStoresSection();
};

window.toggleStoreActive = async (id) => {
    const s = stores.find(x => x.id === id);
    if (!s) return;
    s.active = s.active === false ? true : false;
    stores = await db.saveStore(s);
    renderStoresSection();
    showToast(s.active ? `تم تفعيل متجر ${s.nameAr}` : `تم إخفاء متجر ${s.nameAr}`);
};

// ============================================================
// 1.5. HERO SECTION MANAGEMENT (تخصيص واجهة الهيرو الرئيسية)
// ============================================================
async function renderHeroSection() {
    platformSettings = await db.getPlatformSettings();
    const bgUrlInput = document.getElementById('hero-bg-url');
    const bgPreview = document.getElementById('hero-bg-preview');
    const badgeAr = document.getElementById('hero-badge-ar');
    const badgeEn = document.getElementById('hero-badge-en');
    const titleAr = document.getElementById('hero-title-ar');
    const titleEn = document.getElementById('hero-title-en');
    const descAr = document.getElementById('hero-desc-ar');
    const descEn = document.getElementById('hero-desc-en');
    const btnAr = document.getElementById('hero-btn-ar');
    const btnEn = document.getElementById('hero-btn-en');

    if (bgUrlInput) bgUrlInput.value = platformSettings.heroBg || 'images/hero_noon.jpg';
    if (bgPreview) bgPreview.src = platformSettings.heroBg ? (platformSettings.heroBg.startsWith('http') || platformSettings.heroBg.startsWith('data:') ? platformSettings.heroBg : '../' + platformSettings.heroBg) : '../images/hero_noon.jpg';
    if (badgeAr) badgeAr.value = platformSettings.heroBadgeAr || 'منصة نون للأزياء النسائية';
    if (badgeEn) badgeEn.value = platformSettings.heroBadgeEn || "WOMEN'S MULTI-STORE PLATFORM";
    if (titleAr) titleAr.value = platformSettings.heroTitleAr || 'أناقة نسائية لا متناهية';
    if (titleEn) titleEn.value = platformSettings.heroTitleEn || 'Timeless Fluidity & Grace';
    if (descAr) descAr.value = platformSettings.heroDescAr || 'تصفحي أرقى دور الأزياء النسائية المستقلة تحت سقف واحد';
    if (descEn) descEn.value = platformSettings.heroDescEn || "Discover distinct independent women's fashion boutiques under one roof";
    if (btnAr) btnAr.value = platformSettings.heroBtnAr || 'اكتشفي المتاجر';
    if (btnEn) btnEn.value = platformSettings.heroBtnEn || 'EXPLORE BOUTIQUES';
}

window.saveHeroSection = async (e) => {
    e.preventDefault();
    const bg = document.getElementById('hero-bg-url')?.value.trim() || 'images/hero_noon.jpg';
    const badgeAr = document.getElementById('hero-badge-ar')?.value.trim();
    const badgeEn = document.getElementById('hero-badge-en')?.value.trim();
    const titleAr = document.getElementById('hero-title-ar')?.value.trim();
    const titleEn = document.getElementById('hero-title-en')?.value.trim();
    const descAr = document.getElementById('hero-desc-ar')?.value.trim();
    const descEn = document.getElementById('hero-desc-en')?.value.trim();
    const btnAr = document.getElementById('hero-btn-ar')?.value.trim();
    const btnEn = document.getElementById('hero-btn-en')?.value.trim();

    platformSettings = await db.savePlatformSettings({
        heroBg: bg,
        heroBadgeAr: badgeAr,
        heroBadgeEn: badgeEn,
        heroTitleAr: titleAr,
        heroTitleEn: titleEn,
        heroDescAr: descAr,
        heroDescEn: descEn,
        heroBtnAr: btnAr,
        heroBtnEn: btnEn
    });

    showToast("تم حفظ ونشر إعدادات واجهة الهيرو بنجاح!");
};

window.autoTranslateHeroBadge = async () => {
    const ar = document.getElementById('hero-badge-ar')?.value;
    if (!ar) return showToast("يرجى كتابة الشارة بالعربي أولاً", true);
    showToast("جاري ترجمة الشارة...");
    const en = await translateArabicToEnglish(ar);
    const enEl = document.getElementById('hero-badge-en');
    if (enEl) enEl.value = en.toUpperCase();
    showToast("تمت الترجمة بنجاح!");
};

window.autoTranslateHeroTitle = async () => {
    const ar = document.getElementById('hero-title-ar')?.value;
    if (!ar) return showToast("يرجى كتابة العنوان بالعربي أولاً", true);
    showToast("جاري ترجمة العنوان الرئيسي...");
    const en = await translateArabicToEnglish(ar);
    const enEl = document.getElementById('hero-title-en');
    if (enEl) enEl.value = en;
    showToast("تمت ترجمة العنوان بنجاح!");
};

window.autoTranslateHeroDesc = async () => {
    const ar = document.getElementById('hero-desc-ar')?.value;
    if (!ar) return showToast("يرجى كتابة الوصف بالعربي أولاً", true);
    showToast("جاري ترجمة الوصف...");
    const en = await translateArabicToEnglish(ar);
    const enEl = document.getElementById('hero-desc-en');
    if (enEl) enEl.value = en;
    showToast("تمت ترجمة الوصف بنجاح!");
};

window.autoTranslateHeroBtn = async () => {
    const ar = document.getElementById('hero-btn-ar')?.value;
    if (!ar) return showToast("يرجى كتابة نص الزر بالعربي أولاً", true);
    showToast("جاري ترجمة نص الزر...");
    const en = await translateArabicToEnglish(ar);
    const enEl = document.getElementById('hero-btn-en');
    if (enEl) enEl.value = en.toUpperCase();
    showToast("تمت ترجمة نص الزر بنجاح!");
};

// ============================================================
// 2. CATEGORIES MANAGEMENT (إدارة الأقسام)
// ============================================================
function populateStoreCategorySelect() {
    const select = document.getElementById('category-store-select');
    if (!select) return;
    select.innerHTML = stores.map(s => `
        <option value="${sanitizeHtml(s.id)}">${sanitizeHtml(s.nameAr)} (${sanitizeHtml(s.nameEn)})</option>
    `).join('');
}

function renderCategoriesSection() {
    populateStoreCategorySelect();
    const select = document.getElementById('category-store-select');
    const storeId = select?.value || stores[0]?.id;
    const store = stores.find(s => s.id === storeId);
    if (!store) return;

    const titleEl = document.getElementById('categories-store-title');
    if (titleEl) titleEl.innerText = `أقسام وتصنيفات متجر: ${store.nameAr}`;

    const list = document.getElementById('categories-admin-list');
    if (!list) return;

    const cats = store.categories || [];
    list.innerHTML = cats.map(c => `
        <div class="p-3.5 rounded-xl border border-primary/10 flex items-center justify-between bg-primary/2 hover:bg-white transition-all">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-accent text-lg">label</span>
                <div>
                    <h5 class="font-bold text-xs">${sanitizeHtml(c.titleAr)} <span class="text-primary/50 font-normal">(${sanitizeHtml(c.titleEn)})</span></h5>
                    <code class="text-[10px] text-primary/40 font-mono">id: ${sanitizeHtml(c.id)}</code>
                </div>
            </div>
            ${c.id !== 'all' ? `
                <button onclick="deleteCategory('${sanitizeHtml(store.id)}', '${sanitizeHtml(c.id)}')" class="text-red-500 hover:text-red-700 p-1">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            ` : '<span class="text-[10px] text-primary/40 italic">قسم أساسي</span>'}
        </div>
    `).join('');
}

window.openCategoryModal = () => {
    document.getElementById('category-form')?.reset();
    document.getElementById('category-modal')?.classList.add('open');
};

window.closeCategoryModal = () => {
    document.getElementById('category-modal')?.classList.remove('open');
};

window.saveCategory = async (e) => {
    e.preventDefault();
    const select = document.getElementById('category-store-select');
    const storeId = select?.value;
    const store = stores.find(s => s.id === storeId);
    if (!store) return;

    const titleAr = document.getElementById('cat-name-ar').value.trim();
    const titleEn = document.getElementById('cat-name-en').value.trim();
    const id = document.getElementById('cat-id').value.trim().toLowerCase().replace(/\s+/g, '_');

    if (!store.categories) store.categories = [{ id: 'all', titleAr: 'الكل', titleEn: 'All' }];
    
    if (store.categories.some(c => c.id === id)) {
        showToast("معرف القسم موجود مسبقاً لهذا المتجر", true);
        return;
    }

    store.categories.push({ id, titleAr, titleEn });
    stores = await db.saveStore(store);
    closeCategoryModal();
    renderCategoriesSection();
    showToast(`تمت إضافة قسم ${titleAr} إلى ${store.nameAr}`);
};

window.deleteCategory = async (storeId, catId) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return;
    if (confirm(`هل أنتِ متأكدة من حذف هذا القسم من متجر ${store.nameAr}؟`)) {
        store.categories = store.categories.filter(c => c.id !== catId);
        stores = await db.saveStore(store);
        renderCategoriesSection();
        showToast("تم حذف القسم بنجاح");
    }
};

// ============================================================
// 3. PRODUCTS MANAGEMENT (إدارة المنتجات)
// ============================================================
function populateProductStoreFilter(currentVal = 'all') {
    const filter = document.getElementById('product-store-filter');
    if (!filter) return;
    const existingVal = currentVal || filter.value || 'all';
    filter.innerHTML = `
        <option value="all" ${existingVal === 'all' ? 'selected' : ''}>عرض جميع منتجات المتاجر (${products.length})</option>
        ${stores.map(s => `<option value="${sanitizeHtml(s.id)}" ${s.id === existingVal ? 'selected' : ''}>متجر: ${sanitizeHtml(s.nameAr)}</option>`).join('')}
    `;
    filter.value = existingVal;
}

function renderProductsSection() {
    const filterEl = document.getElementById('product-store-filter');
    const selectedStore = filterEl ? filterEl.value : 'all';
    populateProductStoreFilter(selectedStore);
    const filterVal = filterEl ? filterEl.value : 'all';
    const grid = document.getElementById('products-admin-grid');
    if (!grid) return;

    let filtered = filterVal === 'all' ? products : products.filter(p => p.storeId === filterVal);

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-center py-16 opacity-40 text-xs">لا توجد منتجات مسجلة في هذا المتجر</div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const store = stores.find(s => s.id === p.storeId);
        const nameAr = sanitizeHtml(p.nameAr);
        const nameEn = sanitizeHtml(p.nameEn);
        const category = sanitizeHtml(p.category);
        const storeName = sanitizeHtml(store ? store.nameAr : p.storeId);
        const img = sanitizeHtml(p.image || '../images/hero_noon.jpg');
        const price = Number(p.price || 0).toLocaleString();

        return `
            <div class="card overflow-hidden flex flex-col justify-between">
                <div>
                    <div class="h-44 relative">
                        <img src="${img}" class="w-full h-full object-cover" onerror="this.src='../images/hero_noon.jpg'">
                        <span class="absolute top-2 right-2 bg-primary/80 backdrop-blur-md text-white text-[9px] px-2.5 py-1 rounded-full border border-accent/40 font-bold">
                            ${storeName}
                        </span>
                    </div>
                    <div class="p-4 space-y-1 text-xs">
                        <h4 class="font-serif text-sm font-bold truncate text-primary">${nameAr}</h4>
                        <p class="text-[10px] text-primary/50">${nameEn}</p>
                        <p class="text-accent font-bold text-sm pt-1">${price} د.ع</p>
                        <p class="text-[10px] text-primary/60">القسم: <strong class="text-primary">${category}</strong></p>
                    </div>
                </div>
                <div class="p-3 border-t border-primary/5 flex gap-2 bg-primary/2">
                    <button class="btn-gold flex-1 py-1.5 rounded-lg text-xs" onclick="editProduct(${Number(p.id)})">تعديل</button>
                    <button class="btn-outline px-3 py-1.5 rounded-lg text-xs text-red-500 border-red-200 hover:bg-red-50" onclick="deleteProduct(${Number(p.id)})">حذف</button>
                </div>
            </div>
        `;
    }).join('');
}

window.openProductModal = () => {
    editingProductId = null;
    document.getElementById('product-modal-title').innerText = 'إضافة قطعة جديدة';
    document.getElementById('product-form')?.reset();
    document.getElementById('product-edit-id').value = '';

    const storeSelect = document.getElementById('product-store-select');
    if (storeSelect) {
        storeSelect.innerHTML = stores.map(s => `<option value="${sanitizeHtml(s.id)}">${sanitizeHtml(s.nameAr)}</option>`).join('');
    }
    updateProductCategoryOptions();
    document.getElementById('product-modal')?.classList.add('open');
};

window.closeProductModal = () => {
    document.getElementById('product-modal')?.classList.remove('open');
};

window.updateProductCategoryOptions = () => {
    const storeId = document.getElementById('product-store-select')?.value;
    const store = stores.find(s => s.id === storeId);
    const catSelect = document.getElementById('product-category-select');
    if (!catSelect || !store) return;

    const cats = store.categories || [{ id: 'all', titleAr: 'عام' }];
    catSelect.innerHTML = cats.filter(c => c.id !== 'all').map(c => `
        <option value="${sanitizeHtml(c.id)}">${sanitizeHtml(c.titleAr)}</option>
    `).join('');
};

window.editProduct = (id) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    editingProductId = id;

    document.getElementById('product-modal-title').innerText = 'تعديل بيانات القطعة';
    document.getElementById('product-edit-id').value = p.id;

    const storeSelect = document.getElementById('product-store-select');
    if (storeSelect) {
        storeSelect.innerHTML = stores.map(s => `<option value="${s.id}" ${s.id === p.storeId ? 'selected' : ''}>${s.nameAr}</option>`).join('');
    }
    updateProductCategoryOptions();

    document.getElementById('product-name-ar').value = p.nameAr || '';
    document.getElementById('product-name-en').value = p.nameEn || '';
    document.getElementById('product-category-select').value = p.category || '';
    document.getElementById('product-price').value = p.price || '';
    document.getElementById('product-image-url').value = p.image || '';
    document.getElementById('product-sizes').value = (p.sizes || []).join(', ');
    document.getElementById('product-desc-ar').value = p.descriptionAr || '';

    document.getElementById('product-modal')?.classList.add('open');
};

window.saveProduct = async (e) => {
    e.preventDefault();
    const storeId = document.getElementById('product-store-select').value;
    const nameAr = document.getElementById('product-name-ar').value.trim();
    const nameEn = document.getElementById('product-name-en').value.trim();
    const category = document.getElementById('product-category-select').value;
    const price = parseInt(document.getElementById('product-price').value) || 0;
    const image = document.getElementById('product-image-url').value.trim() || 'images/hero_noon.jpg';
    const sizes = document.getElementById('product-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
    const desc = document.getElementById('product-desc-ar').value.trim();

    const prodObj = {
        id: editingProductId || Date.now(),
        storeId,
        nameAr,
        nameEn,
        category,
        price,
        currencyAr: "د.ع ",
        currencyEn: "IQD ",
        image,
        sizes: sizes.length ? sizes : ["Standard"],
        descriptionAr: desc,
        descriptionEn: nameEn + " exquisite piece."
    };

    products = await db.saveProduct(prodObj);
    showToast(editingProductId ? "تم تحديث المنتج بنجاح" : "تمت إضافة المنتج الجديد بنجاح!");

    closeProductModal();
    renderProductsSection();
};

window.deleteProduct = async (id) => {
    if (confirm("هل تودين حذف هذا المنتج نهائياً من المتجر؟")) {
        products = await db.deleteProduct(id);
        renderProductsSection();
        showToast("تم حذف المنتج");
    }
};

// ============================================================
// 4. DAILY GAME CONFIG (إدارة لعبة اليوم - استوديو عجلة الحظ)
// ============================================================
const defaultWheelPrizes = [
    { id: 1, nameAr: 'خصم 20% على إجمالي طلبكِ', nameEn: '20% OFF Entire Order', code: 'NOON-20VIP', color: '#1B2E1D', textColor: '#D4AF37', icon: '👑', weight: 25, type: 'voucher', note: 'ألف مبروك! حصلتِ على خصم 20% على كامل الفاتورة' },
    { id: 2, nameAr: 'توصيل مجاني فوري لطلبكِ', nameEn: 'Free Delivery', code: 'FREE-DELIVERY', color: '#D4AF37', textColor: '#1B2E1D', icon: '🚚', weight: 30, type: 'voucher', note: 'ألف مبروك! حصلتِ على توصيل مجاني لطلبكِ القادم' },
    { id: 3, nameAr: 'قسيمة بقيمة 15,000 د.ع', nameEn: '15,000 IQD Voucher', code: 'NOON-15K', color: '#142716', textColor: '#FCFAE8', icon: '💎', weight: 15, type: 'voucher', note: 'ألف مبروك! قسيمة بقيمة 15,000 د.ع لطلبكِ' },
    { id: 4, nameAr: 'خصم 10% إضافي فوري', nameEn: '10% Extra Discount', code: 'EXTRA-10', color: '#C9A02C', textColor: '#1B2E1D', icon: '✨', weight: 35, type: 'voucher', note: 'ألف مبروك! خصم 10% إضافي فوري' },
    { id: 5, nameAr: 'هدية وشاح حريري فاخر', nameEn: 'Silk Scarf Gift', code: 'SILK-GIFT', color: '#1B2E1D', textColor: '#D4AF37', icon: '🎁', weight: 10, type: 'gift', note: 'ألف مبروك! هدية وشاح حريري فاخر يُضاف لطلبكِ' },
    { id: 6, nameAr: 'خصم 30% للمشتريات الكبرى', nameEn: '30% Grand Discount', code: 'NOON-30VIP', color: '#D4AF37', textColor: '#1B2E1D', icon: '⭐', weight: 8, type: 'voucher', note: 'ألف مبروك! خصم 30% فوري' }
];

function renderGameSection() {
    const attemptsInput = document.getElementById('game-attempts-input');
    const activeToggle = document.getElementById('game-active-toggle');
    const tbody = document.getElementById('game-prizes-tbody');

    if (attemptsInput) attemptsInput.value = gameConfig.dailyAttemptsAllowed || 1;
    if (activeToggle) activeToggle.checked = gameConfig.enabled !== false;

    if (!gameConfig.prizes || gameConfig.prizes.length === 0) {
        gameConfig.prizes = [...defaultWheelPrizes];
    }

    if (tbody) {
        tbody.innerHTML = gameConfig.prizes.map((p, i) => `
            <tr class="border-b border-primary/5 hover:bg-primary/2 transition-colors">
                <td class="p-3">
                    <span class="text-2xl">${sanitizeHtml(p.icon || p.symbol || '🎁')}</span>
                </td>
                <td class="p-3 font-bold text-primary">
                    ${sanitizeHtml(p.nameAr)}
                    ${p.note ? `<div class="text-[10px] text-primary/40 font-normal line-clamp-1">${sanitizeHtml(p.note)}</div>` : ''}
                </td>
                <td class="p-3 text-primary/60">${sanitizeHtml(p.nameEn)}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <span class="w-4 h-4 rounded-full border border-black/10 shadow-sm" style="background-color: ${sanitizeHtml(p.color || '#1B2E1D')}"></span>
                        <code class="text-[11px] font-mono">${sanitizeHtml(p.color || '#1B2E1D')}</code>
                    </div>
                </td>
                <td class="p-3">
                    ${p.code ? `<span class="bg-accent/20 text-primary font-mono font-bold px-2.5 py-1 rounded-lg text-xs">${sanitizeHtml(p.code)}</span>` : '<span class="text-primary/40 text-[11px]">بدون كود</span>'}
                </td>
                <td class="p-3">
                    <div class="flex items-center gap-1">
                        <input type="number" min="1" max="100" class="input-field py-1 px-2 w-16 text-center text-xs font-bold" value="${Number(p.weight || 10)}" id="prize-weight-${i}">
                        <span class="text-primary/40 text-[10px]">%</span>
                    </div>
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="openPrizeModal(${i})" class="btn-gold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1" title="تعديل الشريحة">
                            <span class="material-symbols-outlined text-xs">edit</span>
                            <span>تعديل</span>
                        </button>
                        <button onclick="deletePrize(${i})" class="btn-outline px-2 py-1 rounded-lg text-xs text-red-500 border-red-200 hover:bg-red-50" title="حذف الشريحة">
                            <span class="material-symbols-outlined text-xs">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

window.openPrizeModal = (index = -1) => {
    const editIndexEl = document.getElementById('prize-edit-index');
    const titleModal = document.getElementById('prize-modal-title');
    const form = document.getElementById('prize-form');
    if (form) form.reset();

    if (index >= 0 && gameConfig.prizes[index]) {
        const p = gameConfig.prizes[index];
        if (editIndexEl) editIndexEl.value = index;
        if (titleModal) titleModal.innerText = `تعديل الشريحة: ${p.nameAr}`;
        document.getElementById('prize-icon').value = p.icon || p.symbol || '🎁';
        document.getElementById('prize-color').value = p.color || '#1B2E1D';
        document.getElementById('prize-color-picker').value = p.color || '#1B2E1D';
        document.getElementById('prize-name-ar').value = p.nameAr || '';
        document.getElementById('prize-name-en').value = p.nameEn || '';
        document.getElementById('prize-weight').value = p.weight || 15;
        document.getElementById('prize-type-select').value = p.type || (p.code ? 'voucher' : 'gift');
        document.getElementById('prize-voucher-code').value = p.code || '';
        document.getElementById('prize-note').value = p.note || '';
    } else {
        if (editIndexEl) editIndexEl.value = -1;
        if (titleModal) titleModal.innerText = 'إضافة شريحة / جائزة جديدة';
        document.getElementById('prize-icon').value = '🎁';
        document.getElementById('prize-color').value = '#1B2E1D';
        document.getElementById('prize-color-picker').value = '#1B2E1D';
        document.getElementById('prize-weight').value = 15;
        document.getElementById('prize-type-select').value = 'voucher';
        document.getElementById('prize-voucher-code').value = '';
        document.getElementById('prize-note').value = '';
    }

    togglePrizeVoucherField();
    document.getElementById('prize-modal')?.classList.add('open');
};

window.closePrizeModal = () => {
    document.getElementById('prize-modal')?.classList.remove('open');
};

window.togglePrizeVoucherField = () => {
    const type = document.getElementById('prize-type-select')?.value;
    const vGroup = document.getElementById('prize-voucher-group');
    if (vGroup) {
        if (type === 'voucher') {
            vGroup.classList.remove('hidden');
        } else {
            vGroup.classList.add('hidden');
        }
    }
};

window.autoTranslatePrize = async () => {
    const ar = document.getElementById('prize-name-ar')?.value;
    if (!ar) return showToast("يرجى كتابة اسم الجائزة بالعربي أولاً", true);
    showToast("جاري ترجمة اسم الجائزة...");
    const en = await translateArabicToEnglish(ar);
    const enEl = document.getElementById('prize-name-en');
    if (enEl) enEl.value = en;
    showToast("تمت الترجمة بنجاح!");
};

window.savePrize = async (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('prize-edit-index')?.value);
    const icon = document.getElementById('prize-icon')?.value.trim() || '🎁';
    const color = document.getElementById('prize-color')?.value.trim() || '#1B2E1D';
    const nameAr = document.getElementById('prize-name-ar')?.value.trim();
    const nameEn = document.getElementById('prize-name-en')?.value.trim() || nameAr;
    const weight = parseInt(document.getElementById('prize-weight')?.value) || 10;
    const type = document.getElementById('prize-type-select')?.value || 'voucher';
    const code = type === 'voucher' ? document.getElementById('prize-voucher-code')?.value.trim().toUpperCase() : '';
    const note = document.getElementById('prize-note')?.value.trim() || '';

    const prizeObj = {
        id: index >= 0 && gameConfig.prizes[index]?.id ? gameConfig.prizes[index].id : ('prize_' + Date.now()),
        nameAr,
        nameEn,
        icon,
        symbol: icon,
        color,
        textColor: (color === '#1B2E1D' || color.toLowerCase().includes('1b2e')) ? '#D4AF37' : '#1B2E1D',
        weight,
        type,
        code,
        note
    };

    if (!gameConfig.prizes) gameConfig.prizes = [];

    if (index >= 0) {
        gameConfig.prizes[index] = prizeObj;
    } else {
        gameConfig.prizes.push(prizeObj);
    }

    await db.saveGameConfig(gameConfig);
    closePrizeModal();
    renderGameSection();
    showToast(index >= 0 ? "تم تحديث الشريحة بنجاح!" : "تمت إضافة الشريحة الجديدة إلى العجلة بنجاح!");
};

window.deletePrize = async (index) => {
    if (gameConfig.prizes.length <= 2) {
        showToast("يجب أن تحتوي العجلة على شريحتين على الأقل!", true);
        return;
    }
    if (!confirm(`هل أنتِ متأكدة من حذف شريحة "${gameConfig.prizes[index]?.nameAr}"؟`)) return;

    gameConfig.prizes.splice(index, 1);
    await db.saveGameConfig(gameConfig);
    renderGameSection();
    showToast("تم حذف الشريحة بنجاح");
};

window.saveGameConfigChanges = async () => {
    const attempts = parseInt(document.getElementById('game-attempts-input')?.value) || 1;
    const enabled = document.getElementById('game-active-toggle')?.checked;

    if (gameConfig.prizes) {
        gameConfig.prizes.forEach((p, i) => {
            const wInput = document.getElementById(`prize-weight-${i}`);
            if (wInput) p.weight = parseInt(wInput.value) || 10;
        });
    }

    gameConfig.dailyAttemptsAllowed = attempts;
    gameConfig.enabled = enabled;
    await db.saveGameConfig(gameConfig);
    showToast("تم حفظ إعدادات ونسب الفوز في العجلة بنجاح!");
};

// ============================================================
// 5. COMMENTS & REVIEWS (إدارة التقييمات)
// ============================================================
async function renderCommentsSection() {
    const list = document.getElementById('comments-admin-list');
    if (!list) return;

    const reviews = await db.getReviews();

    list.innerHTML = reviews.map(c => `
        <div class="card p-4 flex justify-between items-center text-xs mb-2">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <strong class="font-bold text-primary">${sanitizeHtml(c.authorName)}</strong>
                    <span class="badge bg-primary/10 text-primary">${sanitizeHtml(c.storeName || 'منصة نون')}</span>
                    <span class="text-primary/40 text-[10px]">${sanitizeHtml(c.createdAt || '')}</span>
                </div>
                <p class="text-primary/70 font-light">${sanitizeHtml(c.content)}</p>
            </div>
            <button class="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50" onclick="deleteComment(${c.id})">حذف</button>
        </div>
    `).join('');
}

window.deleteComment = async (id) => {
    if (!confirm("هل أنتِ متأكدة من حذف هذا التعليق نهائياً من قاعدة البيانات؟")) return;
    await db.deleteReview(id);
    await renderCommentsSection();
    showToast("تم حذف التعليق نهائياً من المنصة");
};

// ============================================================
// 6. STORIES & ARCHIVES (إدارة الستوريات والقصص)
// ============================================================
async function renderStoriesSection() {
    const grid = document.getElementById('stories-admin-grid');
    if (!grid) return;

    stories = await db.getStories();

    if (!stories || stories.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-primary/50 text-xs">
                <span class="material-symbols-outlined text-4xl block mb-2 opacity-40">auto_stories</span>
                <p>لا توجد قصص أو ستوريات منشورة حالياً. يمكنك إضافة ستوري جديد لعرضه لزائرات المنصة عند النقر على الشعار.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = stories.map(s => {
        const titleAr = sanitizeHtml(s.titleAr || '');
        const storeNameAr = sanitizeHtml(s.storeNameAr || 'منصة نون');
        const captionAr = sanitizeHtml(s.captionAr || '');
        const image = sanitizeHtml(s.image || '../images/hero_noon.jpg');
        const time = sanitizeHtml(s.time || 'الآن');
        const ctaAr = sanitizeHtml(s.ctaAr || 'عرض التفاصيل');

        return `
            <div class="card overflow-hidden flex flex-col justify-between border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
                <div>
                    <div class="h-48 relative overflow-hidden bg-primary/5">
                        <img src="${image.startsWith('http') || image.startsWith('data:') ? image : '../' + image}" class="w-full h-full object-cover" onerror="this.src='../images/store_elegance.jpg'">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"></div>
                        <div class="absolute top-3 right-3 flex items-center gap-2">
                            <span class="badge bg-black/60 backdrop-blur-md text-accent border border-accent/30 font-bold">${storeNameAr}</span>
                        </div>
                        <div class="absolute top-3 left-3">
                            <span class="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded-full">${time}</span>
                        </div>
                        <div class="absolute bottom-3 right-3 left-3 text-white">
                            <h4 class="font-bold text-sm leading-tight line-clamp-1 mb-1">${titleAr}</h4>
                            <p class="text-[11px] opacity-80 line-clamp-2">${captionAr}</p>
                        </div>
                    </div>
                    <div class="p-3 bg-white text-xs border-t border-black/5 flex items-center justify-between">
                        <span class="text-[11px] text-primary/60 flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs text-accent">touch_app</span>
                            <span>الزر: <strong>${ctaAr}</strong></span>
                        </span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">نشط في الواجهة</span>
                    </div>
                </div>
                <div class="p-3 bg-[#fafaf5] border-t border-black/5 flex justify-end gap-2">
                    <button class="text-xs text-red-600 hover:text-red-800 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1" onclick="deleteStory(${s.id})">
                        <span class="material-symbols-outlined text-xs">delete</span>
                        <span>حذف</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.openStoryModal = () => {
    const sel = document.getElementById('story-store-select');
    if (sel) {
        sel.innerHTML = `
            <option value="platform">منصة نون العامة (الرئيسية)</option>
            ${stores.map(st => `<option value="${sanitizeHtml(st.id)}">${sanitizeHtml(st.nameAr)} (${sanitizeHtml(st.nameEn)})</option>`).join('')}
        `;
    }
    const form = document.getElementById('story-form');
    if (form) form.reset();
    document.getElementById('story-modal')?.classList.add('open');
};

window.closeStoryModal = () => {
    document.getElementById('story-modal')?.classList.remove('open');
};

window.saveStory = async (e) => {
    e.preventDefault();
    const storeId = document.getElementById('story-store-select')?.value || 'platform';
    const titleAr = document.getElementById('story-title-ar')?.value.trim();
    const titleEn = document.getElementById('story-title-en')?.value.trim();
    const imageUrl = document.getElementById('story-image-url')?.value.trim();
    const captionAr = document.getElementById('story-caption-ar')?.value.trim();
    const ctaText = document.getElementById('story-cta-text')?.value.trim() || 'استعراض التشكيلة';

    if (!titleAr || !imageUrl) {
        showToast("يرجى ملء عنوان وصورة الستوري!", true);
        return;
    }

    const matchedStore = stores.find(s => s.id === storeId);
    const storeNameAr = matchedStore ? matchedStore.nameAr : 'منصة نون';
    const storeNameEn = matchedStore ? matchedStore.nameEn : 'NOON Platform';

    const newStory = {
        id: Date.now(),
        storeId: storeId,
        storeNameAr: storeNameAr,
        storeNameEn: storeNameEn,
        avatar: 'images/logo.png',
        titleAr: titleAr,
        titleEn: titleEn || titleAr,
        captionAr: captionAr || titleAr,
        captionEn: '',
        image: imageUrl,
        ctaAr: ctaText,
        ctaEn: 'Explore',
        ctaAction: storeId !== 'platform' ? `store:${storeId}` : 'hub',
        time: 'الآن',
        active: true
    };

    await db.saveStory(newStory);
    closeStoryModal();
    await renderStoriesSection();
    showToast("تم نشر الستوري بنجاح وربطه بالواجهة!");
};

window.deleteStory = async (id) => {
    if (!confirm("هل أنتِ متأكدة من حذف هذا الستوري؟")) return;
    await db.deleteStory(id);
    await renderStoriesSection();
    showToast("تم حذف الستوري بنجاح");
};

// ============================================================
// 7. PLATFORM IDENTITY & SETTINGS (إعدادات وهوية المنصة)
// ============================================================
let platformSettings = null;

async function renderSettingsSection() {
    platformSettings = await db.getPlatformSettings();
    const logoInput = document.getElementById('settings-logo-url');
    const logoPreview = document.getElementById('settings-logo-preview');
    const waInput = document.getElementById('settings-whatsapp');
    const igInput = document.getElementById('settings-instagram');
    const feeInput = document.getElementById('settings-delivery-fee');

    if (logoInput) logoInput.value = platformSettings.logo || 'images/logo.png';
    if (logoPreview) logoPreview.src = platformSettings.logo ? (platformSettings.logo.startsWith('http') ? platformSettings.logo : '../' + platformSettings.logo) : '../images/logo.png';
    if (waInput) waInput.value = platformSettings.whatsapp || '';
    if (igInput) igInput.value = platformSettings.instagram || '';
    if (feeInput) feeInput.value = platformSettings.deliveryFee || 5000;
}

window.savePlatformSettings = async (e) => {
    e.preventDefault();
    const logo = document.getElementById('settings-logo-url')?.value.trim() || 'images/logo.png';
    const wa = document.getElementById('settings-whatsapp')?.value.trim() || '';
    const ig = document.getElementById('settings-instagram')?.value.trim() || '';
    const fee = Number(document.getElementById('settings-delivery-fee')?.value) || 5000;

    platformSettings = await db.savePlatformSettings({
        logo: logo,
        whatsapp: wa,
        instagram: ig,
        deliveryFee: fee
    });

    showToast("تم حفظ إعدادات الهوية والتوصيل وتحديث الشعار بنجاح!");
};

// ============================================================
// 8. AUTO-TRANSLATION ENGINE (ترجمة تلقائية للإنجليزية)
// ============================================================
async function translateArabicToEnglish(arabicText) {
    if (!arabicText || !arabicText.trim()) return '';
    const text = arabicText.trim();

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data && data[0] && Array.isArray(data[0])) {
                return data[0].map(item => item[0]).join('').trim();
            }
        }
    } catch (e) {
        console.warn('[Translate] Fallback to dictionary/secondary:', e);
    }

    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.responseData?.translatedText) {
                return data.responseData.translatedText.trim();
            }
        }
    } catch (e) {}

    return text;
}

window.autoTranslateStore = async () => {
    const nameAr = document.getElementById('store-name-ar')?.value;
    const badgeAr = document.getElementById('store-badge-ar')?.value;
    if (!nameAr && !badgeAr) {
        showToast("يرجى كتابة الاسم بالعربي أولاً", true);
        return;
    }
    showToast("جاري الترجمة التلقائية...");
    if (nameAr) {
        const nameEn = await translateArabicToEnglish(nameAr);
        const nameEnEl = document.getElementById('store-name-en');
        if (nameEnEl) nameEnEl.value = nameEn;
    }
    if (badgeAr) {
        const badgeEn = await translateArabicToEnglish(badgeAr);
        const badgeEnEl = document.getElementById('store-badge-en');
        if (badgeEnEl) badgeEnEl.value = badgeEn;
    }
    showToast("تمت الترجمة للإنجليزية بنجاح!");
};

window.autoTranslateProduct = async () => {
    const nameAr = document.getElementById('product-name-ar')?.value;
    if (!nameAr) {
        showToast("يرجى كتابة اسم المنتج بالعربي أولاً", true);
        return;
    }
    showToast("جاري الترجمة التلقائية للمنتج...");
    const nameEn = await translateArabicToEnglish(nameAr);
    const nameEnEl = document.getElementById('product-name-en');
    if (nameEnEl) nameEnEl.value = nameEn;
    showToast("تمت ترجمة اسم المنتج بنجاح!");
};

// --- Init Dashboard ---
async function init() {
    stores = await db.getStores();
    products = await db.getProducts();
    gameConfig = await db.getGameConfig();
    stories = await db.getStories();
    platformSettings = await db.getPlatformSettings();
    showSection('stores');
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
