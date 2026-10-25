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
    if (sec === 'categories') renderCategoriesSection();
    if (sec === 'products') renderProductsSection();
    if (sec === 'game') renderGameSection();
    if (sec === 'comments') renderCommentsSection();
    if (sec === 'stories') renderStoriesSection();
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
function populateProductStoreFilter() {
    const filter = document.getElementById('product-store-filter');
    if (!filter) return;
    filter.innerHTML = `
        <option value="all">عرض جميع منتجات المتاجر (${products.length})</option>
        ${stores.map(s => `<option value="${sanitizeHtml(s.id)}">متجر: ${sanitizeHtml(s.nameAr)}</option>`).join('')}
    `;
}

function renderProductsSection() {
    populateProductStoreFilter();
    const filterVal = document.getElementById('product-store-filter')?.value || 'all';
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
// 4. DAILY GAME CONFIG (إدارة لعبة اليوم)
// ============================================================
function renderGameSection() {
    const attemptsInput = document.getElementById('game-attempts-input');
    const activeToggle = document.getElementById('game-active-toggle');
    const tbody = document.getElementById('game-prizes-tbody');

    if (attemptsInput) attemptsInput.value = gameConfig.dailyAttemptsAllowed || 1;
    if (activeToggle) activeToggle.checked = gameConfig.enabled !== false;

    if (tbody && gameConfig.prizes) {
        tbody.innerHTML = gameConfig.prizes.map((p, i) => `
            <tr class="border-b border-primary/5 hover:bg-primary/2">
                <td class="p-2 text-xl">${sanitizeHtml(p.symbol || '💎')}</td>
                <td class="p-2 font-bold">${sanitizeHtml(p.nameAr)}</td>
                <td class="p-2 text-primary/60">${sanitizeHtml(p.nameEn)}</td>
                <td class="p-2 font-mono text-accent font-bold">${sanitizeHtml(p.code || 'بدون كود')}</td>
                <td class="p-2">
                    <input type="number" min="0" max="100" class="input-field py-1 px-2 w-16 text-center text-xs" value="${Number(p.weight)}" id="prize-weight-${i}">
                </td>
            </tr>
        `).join('');
    }
}

window.saveGameConfigChanges = () => {
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
    localStorage.setItem("noon_game_config", JSON.stringify(gameConfig));
    showToast("تم حفظ إعدادات لعبة اليوم بنجاح!");
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
    let reviews = await db.getReviews();
    reviews = reviews.filter(r => r.id !== id);
    localStorage.setItem('noon_reviews', JSON.stringify(reviews));
    await renderCommentsSection();
    showToast("تمت أرشفة وحذف التعليق بنجاح");
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

// --- Init Dashboard ---
async function init() {
    stores = await db.getStores();
    products = await db.getProducts();
    gameConfig = await db.getGameConfig();
    stories = await db.getStories();
    showSection('stores');
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
