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

// --- Image Path Helper for Dashboard Subdirectory ---
function resolveDashboardImg(src, fallback = '../images/hero_noon.jpg') {
    if (!src) return fallback;
    const s = String(src).trim();
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('../') || s.startsWith('/')) {
        return s;
    }
    return '../' + s;
}

// --- Format Bytes Helper (عرض الحجم بالبايتات والكيلوبايتات بدقة) ---
function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateDataUrlBytes(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const base64Index = dataUrl.indexOf(',');
    if (base64Index === -1) return new Blob([dataUrl]).size;
    const base64 = dataUrl.slice(base64Index + 1);
    return Math.round((base64.length * 3) / 4);
}

// --- Smart Byte-Level Client-Side Image Compressor ---
function compressImageFileWithStats(file, modeOverride = null) {
    return new Promise((resolve, reject) => {
        const modeSelect = document.getElementById('image-compression-mode');
        const mode = modeOverride || (modeSelect ? modeSelect.value : 'ultra');

        // Configure target byte budget & max dimensions per mode
        const config = {
            ultra: { maxDim: 920, startQ: 0.74, minQ: 0.38, targetBytes: 62 * 1024 },
            smart: { maxDim: 1120, startQ: 0.82, minQ: 0.48, targetBytes: 105 * 1024 },
            hd:    { maxDim: 1360, startQ: 0.88, minQ: 0.60, targetBytes: 185 * 1024 }
        }[mode] || { maxDim: 960, startQ: 0.76, minQ: 0.40, targetBytes: 68 * 1024 };

        const originalBytes = file.size || 0;
        const reader = new FileReader();

        reader.onload = (e) => {
            const rawDataUrl = e.target.result;
            const img = new Image();
            img.onload = () => {
                try {
                    let w = img.width;
                    let h = img.height;
                    if (w > config.maxDim || h > config.maxDim) {
                        if (w > h) {
                            h = Math.round((h * config.maxDim) / w);
                            w = config.maxDim;
                        } else {
                            w = Math.round((w * config.maxDim) / h);
                            h = config.maxDim;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const renderAtScale = (scaleFactor, quality) => {
                        const cw = Math.max(240, Math.round(w * scaleFactor));
                        const ch = Math.max(240, Math.round(h * scaleFactor));
                        canvas.width = cw;
                        canvas.height = ch;
                        ctx.clearRect(0, 0, cw, ch);
                        ctx.drawImage(img, 0, 0, cw, ch);

                        // Try WebP first for superior byte reduction, fallback to JPEG
                        let webpUrl = '';
                        try {
                            webpUrl = canvas.toDataURL('image/webp', quality);
                        } catch (_) {}
                        const jpegUrl = canvas.toDataURL('image/jpeg', quality);

                        if (webpUrl && webpUrl.startsWith('data:image/webp') && webpUrl.length < jpegUrl.length) {
                            return webpUrl;
                        }
                        return jpegUrl;
                    };

                    let q = config.startQ;
                    let scale = 1.0;
                    let bestUrl = renderAtScale(scale, q);
                    let currentBytes = estimateDataUrlBytes(bestUrl);

                    // Iteratively compress down until target byte budget is met
                    let attempts = 0;
                    while (currentBytes > config.targetBytes && attempts < 7) {
                        attempts++;
                        if (q > config.minQ + 0.06) {
                            q = Math.max(config.minQ, +(q - 0.10).toFixed(2));
                        } else {
                            scale = +(scale * 0.85).toFixed(2);
                        }
                        const candidate = renderAtScale(scale, q);
                        const candidateBytes = estimateDataUrlBytes(candidate);
                        if (candidateBytes < currentBytes) {
                            bestUrl = candidate;
                            currentBytes = candidateBytes;
                        }
                    }

                    const rawBytes = estimateDataUrlBytes(rawDataUrl) || originalBytes;
                    const finalUrl = currentBytes < rawBytes ? bestUrl : rawDataUrl;
                    const finalBytes = Math.min(currentBytes, rawBytes);
                    const baseOrig = Math.max(originalBytes, rawBytes, finalBytes);
                    const savedPercent = baseOrig > 0 ? Math.max(0, Math.round((1 - finalBytes / baseOrig) * 100)) : 0;

                    resolve({
                        dataUrl: finalUrl,
                        originalBytes: baseOrig,
                        compressedBytes: finalBytes,
                        savedPercent
                    });
                } catch (err) {
                    const fallbackBytes = estimateDataUrlBytes(rawDataUrl) || originalBytes;
                    resolve({
                        dataUrl: rawDataUrl,
                        originalBytes: fallbackBytes,
                        compressedBytes: fallbackBytes,
                        savedPercent: 0
                    });
                }
            };
            img.onerror = () => {
                const fallbackBytes = estimateDataUrlBytes(rawDataUrl) || originalBytes;
                resolve({ dataUrl: rawDataUrl, originalBytes: fallbackBytes, compressedBytes: fallbackBytes, savedPercent: 0 });
            };
            img.src = rawDataUrl;
        };
        reader.onerror = () => reject(new Error('File read error'));
        reader.readAsDataURL(file);
    });
}

async function compressImageFile(file) {
    const res = await compressImageFileWithStats(file);
    return res.dataUrl;
}

// --- Image File Upload Handler (Direct Import from Device/Mobile with Byte Stats) ---
window.handleImageUpload = async (inputEl, targetInputId, previewImgId, byteBadgeId) => {
    if (!inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    if (file.size > 15 * 1024 * 1024) {
        showToast("حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 15 ميجابايت", true);
        return;
    }
    try {
        const stats = await compressImageFileWithStats(file);
        const targetInput = document.getElementById(targetInputId);
        if (targetInput) targetInput.value = stats.dataUrl;
        if (previewImgId) {
            const previewImg = document.getElementById(previewImgId);
            if (previewImg) previewImg.src = stats.dataUrl;
        }
        if (byteBadgeId) {
            const badge = document.getElementById(byteBadgeId);
            if (badge) {
                badge.innerText = `⚡ مضغوطة: ${formatBytes(stats.originalBytes)} ← ${formatBytes(stats.compressedBytes)} (وفّرت ${stats.savedPercent}%)`;
                badge.classList.remove('hidden');
            }
        }
        showToast(`⚡ تم ضغط الصورة بالبايتات: ${formatBytes(stats.originalBytes)} ← ${formatBytes(stats.compressedBytes)} (توفير ${stats.savedPercent}%)`);
    } catch (err) {
        showToast("فشل استيراد وضغط الصورة من الجهاز", true);
    }
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
        const banner = sanitizeHtml(resolveDashboardImg(store.banner));
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
                            <span class="font-mono text-accent font-bold" dir="ltr">${whatsapp}</span>
                        </div>
                        <div class="flex justify-between text-primary/70">
                            <span>إحصائيات المتجر:</span>
                            <span class="font-bold">${prodCount} منتج | ${catCount} قسم</span>
                        </div>
                        <p class="text-[11px] text-primary/60 line-clamp-2 pt-1 font-light">${desc}</p>

                        <!-- Quick Navigation Buttons -->
                        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10">
                            <button type="button" class="btn-outline py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-primary/5 transition-colors" onclick="goToStoreCategories('${sId}')" title="الانتقال لإدارة وتعديل أقسام هذا المتجر">
                                <span class="material-symbols-outlined text-sm text-accent">category</span>
                                <span>أقسام المتجر</span>
                            </button>
                            <button type="button" class="btn-outline py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-primary/5 transition-colors" onclick="goToStoreProducts('${sId}')" title="الانتقال لإدارة وعرض منتجات هذا المتجر">
                                <span class="material-symbols-outlined text-sm text-accent">checkroom</span>
                                <span>منتجات المتجر</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-4 border-t border-primary/5 flex gap-2 bg-primary/2">
                    <button class="btn-gold flex-1 py-2 rounded-xl text-xs flex items-center justify-center gap-1 font-bold shadow-sm" onclick="editStore('${sId}')">
                        <span class="material-symbols-outlined text-sm">edit</span> تعديل المتجر
                    </button>
                    <button class="btn-outline px-3 py-2 rounded-xl text-xs flex items-center justify-center" onclick="toggleStoreActive('${sId}')" title="${store.active !== false ? 'إخفاء المتجر' : 'تفعيل المتجر'}">
                        <span class="material-symbols-outlined text-sm">${store.active !== false ? 'visibility_off' : 'visibility'}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Format Helpers
function formatWhatsAppNumber(num) {
    if (!num) return '';
    let cleaned = String(num).replace(/[^0-9]/g, '');
    if (cleaned.startsWith('00964')) cleaned = cleaned.substring(2);
    else if (cleaned.startsWith('07')) cleaned = '964' + cleaned.substring(1);
    else if (cleaned.startsWith('7') && cleaned.length === 10) cleaned = '964' + cleaned;
    return cleaned;
}

function formatInstagramHandle(ig) {
    if (!ig) return '';
    let val = String(ig).trim();
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    val = val.replace(/^@+/, '');
    return `https://instagram.com/${val}`;
}

window.goToStoreCategories = (storeId) => {
    showSection('categories');
    const select = document.getElementById('category-store-select');
    if (select) {
        select.value = storeId;
        renderCategoriesSection();
    }
};

window.goToStoreProducts = (storeId) => {
    showSection('products');
    const filter = document.getElementById('product-store-filter');
    if (filter) {
        filter.value = storeId;
        renderProductsSection();
    }
};

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
    let whatsapp = document.getElementById('store-whatsapp').value.trim();
    let instagram = document.getElementById('store-instagram').value.trim();
    const order = parseInt(document.getElementById('store-order').value) || 1;
    const active = document.getElementById('store-active-check').checked;

    // Clean & format
    whatsapp = formatWhatsAppNumber(whatsapp);
    instagram = formatInstagramHandle(instagram);

    const existingStore = stores.find(x => x.id === id);
    const existingCategories = existingStore?.categories || [
        { id: "all", titleAr: "الكل", titleEn: "All" },
        { id: "new", titleAr: "وصل حديثاً", titleEn: "New In" }
    ];

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
        categories: existingCategories
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
                <div class="flex items-center gap-1.5">
                    <button onclick="editCategory('${sanitizeHtml(store.id)}', '${sanitizeHtml(c.id)}')" class="btn-gold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1" title="تعديل القسم">
                        <span class="material-symbols-outlined text-xs">edit</span>
                        <span>تعديل</span>
                    </button>
                    <button onclick="deleteCategory('${sanitizeHtml(store.id)}', '${sanitizeHtml(c.id)}')" class="text-red-500 hover:text-red-700 p-1 rounded-lg border border-red-200 hover:bg-red-50" title="حذف القسم">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            ` : '<span class="text-[10px] text-primary/40 italic">قسم أساسي</span>'}
        </div>
    `).join('');
}

window.openCategoryModal = () => {
    document.getElementById('category-form')?.reset();
    const origId = document.getElementById('cat-edit-original-id');
    if (origId) origId.value = '';
    const titleEl = document.getElementById('category-modal-title');
    if (titleEl) titleEl.innerText = 'إضافة قسم جديد';
    document.getElementById('category-modal')?.classList.add('open');
};

window.editCategory = (storeId, catId) => {
    const store = stores.find(s => s.id === storeId);
    if (!store || !store.categories) return;
    const cat = store.categories.find(c => c.id === catId);
    if (!cat) return;

    const origId = document.getElementById('cat-edit-original-id');
    if (origId) origId.value = cat.id;
    const titleEl = document.getElementById('category-modal-title');
    if (titleEl) titleEl.innerText = `تعديل القسم: ${cat.titleAr}`;

    document.getElementById('cat-name-ar').value = cat.titleAr || '';
    document.getElementById('cat-name-en').value = cat.titleEn || '';
    document.getElementById('cat-id').value = cat.id || '';
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

    const origId = document.getElementById('cat-edit-original-id')?.value.trim();
    const titleAr = document.getElementById('cat-name-ar').value.trim();
    const titleEn = document.getElementById('cat-name-en').value.trim();
    const id = document.getElementById('cat-id').value.trim().toLowerCase().replace(/\s+/g, '_');

    if (!store.categories) store.categories = [{ id: 'all', titleAr: 'الكل', titleEn: 'All' }];

    if (origId) {
        const idx = store.categories.findIndex(c => c.id === origId);
        if (idx > -1) {
            store.categories[idx] = { id, titleAr, titleEn };
        }
        stores = await db.saveStore(store);
        closeCategoryModal();
        renderCategoriesSection();
        showToast(`تم تحديث قسم ${titleAr} بنجاح!`);
        return;
    }

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
        const img = sanitizeHtml(resolveDashboardImg(p.image));
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

// ============================================================
// 3B. INTERACTIVE 360° COLOR WHEEL PICKER & UNLIMITED FIELDS STUDIO
// ============================================================
let productVariants = [];
let colorWheelState = {
    target: null, // 'primary' or variant index (0, 1, 2...)
    hue: 126,     // 0 - 360
    sat: 41,      // 0 - 100
    val: 18,      // 5 - 100
    hex: '#1B2E1D',
    suggestedAr: 'أخضر زمردي ملكي',
    suggestedEn: 'Emerald Green',
    isDragging: false,
    canvasInitialized: false
};

function hsvToRgb(h, s, v) {
    const sNorm = s / 100;
    const vNorm = v / 100;
    const c = vNorm * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = vNorm - c;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}

function rgbToHex(r, g, b) {
    const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hexStr) {
    let clean = String(hexStr || '#1B2E1D').trim().replace('#', '');
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(clean)) {
        return { h: 126, s: 41, v: 18 };
    }
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (max !== min) {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
            case g: h = ((b - r) / d + 2) * 60; break;
            case b: h = ((r - g) / d + 4) * 60; break;
        }
    }
    return { h: Math.round(h), s: Math.round(s * 100), v: Math.max(5, Math.round(v * 100)) };
}

function detectFashionColorName(h, s, v) {
    if (v <= 16) return { ar: 'أسود ملكي', en: 'Royal Black' };
    if (s <= 10 && v >= 88) return { ar: 'أبيض لؤلؤي', en: 'Pearl White' };
    if (s <= 14 && v >= 60) return { ar: 'فضي رمادي ناعم', en: 'Soft Silver Grey' };
    if (s <= 15) return { ar: 'رمادي داكن فحمي', en: 'Charcoal Grey' };
    if (h >= 25 && h <= 52 && s >= 15 && s <= 45 && v >= 78) return { ar: 'بيج شامبين كريمي', en: 'Champagne Beige' };
    if (h >= 15 && h <= 42 && v <= 48) return { ar: 'بني شوكولا', en: 'Chocolate Brown' };
    if ((h >= 345 || h < 14) && v <= 55) return { ar: 'ماروني / عنابي ملكي', en: 'Royal Burgundy' };
    if (h >= 345 || h < 14) return s < 45 ? { ar: 'وردي بودر ناعم', en: 'Blush Rose' } : { ar: 'أحمر ياقوتي', en: 'Ruby Red' };
    if (h >= 14 && h < 36) return { ar: 'مرجاني / مشمشي دافئ', en: 'Warm Coral Peach' };
    if (h >= 36 && h < 64) return v < 65 ? { ar: 'ذهبي معتّق', en: 'Antique Gold' } : { ar: 'ذهبي ملكي', en: 'Royal Gold' };
    if (h >= 64 && h < 95) return { ar: 'زيتوني فستقي', en: 'Olive Pistachio' };
    if (h >= 95 && h < 168) return v < 50 ? { ar: 'أخضر زمردي ملكي', en: 'Emerald Green' } : { ar: 'أخضر نعناعي ناعم', en: 'Mint Emerald' };
    if (h >= 168 && h < 205) return { ar: 'فيروزي محيطي', en: 'Turquoise Teal' };
    if (h >= 205 && h < 252) return v < 48 ? { ar: 'كحلي ليلي ملكي', en: 'Midnight Navy' } : { ar: 'أزرق سماوي ملكي', en: 'Royal Sky Blue' };
    if (h >= 252 && h < 298) return s < 45 ? { ar: 'لافندر ناعم', en: 'Soft Lavender' } : { ar: 'بنفسجي ملكي', en: 'Royal Purple' };
    return { ar: 'وردي فوشيا أنيق', en: 'Magenta Rose' };
}

function drawColorWheelCanvas(brightnessVal = 100) {
    const canvas = document.getElementById('color-wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const radius = size / 2;
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - radius;
            const dy = y - radius;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const idx = (y * size + x) * 4;
            if (dist <= radius) {
                let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                if (angle < 0) angle += 360;
                const sat = Math.min(100, (dist / radius) * 100);
                const rgb = hsvToRgb(angle, sat, brightnessVal);
                data[idx] = rgb.r;
                data[idx + 1] = rgb.g;
                data[idx + 2] = rgb.b;
                data[idx + 3] = 255;
            } else {
                data[idx + 3] = 0;
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

function syncColorWheelUI(skipHexInput = false) {
    const { hue, sat, val } = colorWheelState;
    const rgb = hsvToRgb(hue, sat, val);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    colorWheelState.hex = hex;

    const names = detectFashionColorName(hue, sat, val);
    colorWheelState.suggestedAr = names.ar;
    colorWheelState.suggestedEn = names.en;

    // Position the draggable circle handle
    const cursor = document.getElementById('color-wheel-cursor');
    const canvas = document.getElementById('color-wheel-canvas');
    if (cursor && canvas) {
        const radius = canvas.width / 2;
        const rad = (hue * Math.PI) / 180;
        const dist = (sat / 100) * radius;
        const cx = radius + Math.cos(rad) * dist;
        const cy = radius + Math.sin(rad) * dist;
        cursor.style.left = `${cx}px`;
        cursor.style.top = `${cy}px`;
        cursor.style.backgroundColor = hex;
    }

    const swatch = document.getElementById('color-wheel-live-swatch');
    if (swatch) swatch.style.backgroundColor = hex;

    if (!skipHexInput) {
        const hexInput = document.getElementById('color-wheel-hex-input');
        if (hexInput) hexInput.value = hex;
    }

    const nameEl = document.getElementById('color-wheel-suggested-name');
    if (nameEl) nameEl.innerText = `${names.ar} (${names.en})`;

    const valSlider = document.getElementById('color-wheel-brightness');
    if (valSlider) valSlider.value = val;

    const valLabel = document.getElementById('color-wheel-val-label');
    if (valLabel) valLabel.innerText = `${val}%`;
}

function handleColorWheelPointer(clientX, clientY) {
    const stage = document.getElementById('color-wheel-stage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = clientX - (rect.left + radius);
    const dy = clientY - (rect.top + radius);
    const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    colorWheelState.hue = Math.round(angle);
    colorWheelState.sat = Math.round((dist / radius) * 100);
    syncColorWheelUI();
}

function initColorWheelEventsOnce() {
    if (colorWheelState.canvasInitialized) return;
    const stage = document.getElementById('color-wheel-stage');
    if (!stage) return;
    colorWheelState.canvasInitialized = true;

    stage.addEventListener('pointerdown', (e) => {
        colorWheelState.isDragging = true;
        stage.setPointerCapture?.(e.pointerId);
        handleColorWheelPointer(e.clientX, e.clientY);
    });
    stage.addEventListener('pointermove', (e) => {
        if (!colorWheelState.isDragging) return;
        handleColorWheelPointer(e.clientX, e.clientY);
    });
    const endDrag = () => { colorWheelState.isDragging = false; };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
}

window.openColorWheelPicker = (target) => {
    colorWheelState.target = target;
    initColorWheelEventsOnce();

    let initialHex = '#1B2E1D';
    if (target === 'primary') {
        initialHex = document.getElementById('product-primary-color-hex')?.value || '#1B2E1D';
    } else if (typeof target === 'number' && productVariants[target]) {
        initialHex = productVariants[target].hex || '#1B2E1D';
    }

    const hsv = hexToHsv(initialHex);
    colorWheelState.hue = hsv.h;
    colorWheelState.sat = hsv.s;
    colorWheelState.val = hsv.v;

    drawColorWheelCanvas(colorWheelState.val);
    syncColorWheelUI();
    document.getElementById('color-wheel-picker-modal')?.classList.add('open');
};

window.closeColorWheelPicker = () => {
    document.getElementById('color-wheel-picker-modal')?.classList.remove('open');
};

window.onColorWheelBrightnessChange = (val) => {
    colorWheelState.val = Math.max(5, Math.min(100, Number(val) || 100));
    drawColorWheelCanvas(colorWheelState.val);
    syncColorWheelUI();
};

window.onColorWheelHexManualInput = (val) => {
    const clean = String(val || '').trim();
    if (/^#?[0-9A-Fa-f]{6}$/.test(clean)) {
        const formatted = clean.startsWith('#') ? clean.toUpperCase() : `#${clean.toUpperCase()}`;
        const hsv = hexToHsv(formatted);
        colorWheelState.hue = hsv.h;
        colorWheelState.sat = hsv.s;
        colorWheelState.val = hsv.v;
        drawColorWheelCanvas(colorWheelState.val);
        syncColorWheelUI(true);
    }
};

window.selectPresetOnWheel = (hex, nameAr, nameEn) => {
    const hsv = hexToHsv(hex);
    colorWheelState.hue = hsv.h;
    colorWheelState.sat = hsv.s;
    colorWheelState.val = hsv.v;
    drawColorWheelCanvas(colorWheelState.val);
    syncColorWheelUI();
    if (nameAr) colorWheelState.suggestedAr = nameAr;
    if (nameEn) colorWheelState.suggestedEn = nameEn;
    const nameEl = document.getElementById('color-wheel-suggested-name');
    if (nameEl) nameEl.innerText = `${colorWheelState.suggestedAr} (${colorWheelState.suggestedEn})`;
};

window.applyColorWheelSelection = () => {
    const { target, hex, suggestedAr, suggestedEn } = colorWheelState;
    if (target === 'primary') {
        const hexInput = document.getElementById('product-primary-color-hex');
        const preview = document.getElementById('primary-color-swatch-preview');
        const arInput = document.getElementById('product-primary-color-ar');
        const enInput = document.getElementById('product-primary-color-en');
        if (hexInput) hexInput.value = hex;
        if (preview) preview.style.backgroundColor = hex;
        if (arInput && !arInput.value.trim()) arInput.value = suggestedAr;
        if (enInput && !enInput.value.trim()) enInput.value = suggestedEn;
        showToast(`🎨 تم اختيار لون العرض الأساسي (${suggestedAr})`);
    } else if (typeof target === 'number' && productVariants[target]) {
        productVariants[target].hex = hex;
        if (!productVariants[target].colorNameAr?.trim()) {
            productVariants[target].colorNameAr = suggestedAr;
        }
        if (!productVariants[target].colorNameEn?.trim()) {
            productVariants[target].colorNameEn = suggestedEn;
        }
        renderProductVariantsUI();
        showToast(`🎨 تم اعتماد اللون (${productVariants[target].colorNameAr || hex}) للحقل #${target + 1}`);
    }
    closeColorWheelPicker();
};

window.addQuickSize = (size) => {
    const input = document.getElementById('product-sizes');
    if (!input) return;
    const current = input.value.split(',').map(s => s.trim()).filter(Boolean);
    if (!current.includes(size)) {
        current.push(size);
        input.value = current.join(', ');
    }
};

window.addVariantQuickSize = (index, size) => {
    if (!productVariants[index]) return;
    const current = Array.isArray(productVariants[index].sizes)
        ? [...productVariants[index].sizes]
        : String(productVariants[index].sizes || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!current.includes(size)) {
        current.push(size);
        productVariants[index].sizes = current;
        const sizeInput = document.getElementById(`variant-sizes-${index}`);
        if (sizeInput) sizeInput.value = current.join(', ');
    }
};

window.renderProductVariantsUI = () => {
    const container = document.getElementById('product-variants-list');
    const countBadge = document.getElementById('variants-count-badge');
    if (countBadge) {
        countBadge.innerText = `${productVariants.length} حقول إضافية`;
    }
    if (!container) return;

    if (productVariants.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 px-4 bg-white/80 rounded-2xl border border-dashed border-primary/20 text-primary/50 text-[11px] space-y-1">
                <p class="font-bold text-primary/70">لا توجد حقول إضافية مفتوحة حالياً (يتم عرض الحقل الأساسي #1 فقط).</p>
                <p>اضغطي على <strong>"+ فتح حقل جديد (صورة ولون)"</strong> لفتح عدد لا نهائي من الحقول لنفس المنتج، كل حقل بصورته المضغوطة ولونه من دائرة الألوان وتفاصيله الخاصة.</p>
            </div>
        `;
        return;
    }

    const quickSizesList = ['S', 'M', 'L', 'XL', 'XXL', 'Free Size', '36', '38', '40', '42', '44'];

    container.innerHTML = productVariants.map((v, i) => {
        const previewSrc = v.image ? resolveDashboardImg(v.image) : '../images/hero_noon.jpg';
        const sizesStr = Array.isArray(v.sizes) ? v.sizes.join(', ') : (v.sizes || '');
        const byteStatsHtml = v.byteBadgeText
            ? `<span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">${sanitizeHtml(v.byteBadgeText)}</span>`
            : `<span class="text-[9px] text-primary/40">يتم ضغط الصورة تلقائياً بالبايتات عند الرفع</span>`;

        return `
        <div class="p-4 bg-white rounded-2xl border-2 border-primary/10 hover:border-accent/50 shadow-sm space-y-3 relative transition-all">
            <!-- Header: Field Number + Interactive Color Wheel Button + Actions -->
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-2.5">
                <div class="flex items-center gap-2">
                    <span class="bg-primary text-accent font-bold text-[10px] px-2.5 py-1 rounded-lg">حقل إضافي #${i + 1}</span>
                    <button type="button" onclick="openColorWheelPicker(${i})"
                            class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 hover:bg-accent/15 border border-accent/60 transition-all shadow-sm"
                            title="افتحي دائرة الألوان وحرّكي المؤشر لاختيار اللون">
                        <span class="w-5 h-5 rounded-full border-2 border-white shadow-md inline-block shrink-0" style="background-color: ${sanitizeHtml(v.hex || '#1B2E1D')};"></span>
                        <span class="font-bold text-[11px] text-primary">🎨 دائرة الألوان (حرّك الدائرة)</span>
                        <span class="font-mono text-[10px] text-primary/60">${sanitizeHtml(v.hex || '#1B2E1D')}</span>
                    </button>
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="duplicateProductVariant(${i})" class="px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1 transition-colors" title="نسخ هذا الحقل لفتح حقل مشابه بسرعة">
                        <span class="material-symbols-outlined text-xs">content_copy</span> نسخ الحقل
                    </button>
                    <button type="button" onclick="removeProductVariant(${i})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold flex items-center gap-0.5 transition-colors">
                        <span class="material-symbols-outlined text-xs">delete</span> حذف
                    </button>
                </div>
            </div>

            <!-- Single Image per Field + Live Preview + Byte Compressor Badge -->
            <div class="p-2.5 rounded-xl bg-primary/3 border border-primary/10 space-y-1.5">
                <div class="flex flex-wrap items-center justify-between gap-1">
                    <label class="text-[10px] text-primary font-bold flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs text-accent">photo_camera</span>
                        <span>صورة هذا الحقل / اللون (تُضغط بالبايتات تلقائياً) *</span>
                    </label>
                    <div id="variant-byte-badge-${i}">${byteStatsHtml}</div>
                </div>
                <div class="flex gap-2 items-center">
                    <img id="variant-img-preview-${i}" src="${sanitizeHtml(previewSrc)}" class="w-12 h-12 rounded-xl object-cover border border-primary/15 shrink-0 bg-white" onerror="this.src='../images/hero_noon.jpg'">
                    <input type="text" value="${sanitizeHtml(v.image || '')}" id="variant-img-${i}"
                           oninput="updateVariantField(${i}, 'image', this.value); const p=document.getElementById('variant-img-preview-${i}'); if(p) p.src=this.value || '../images/hero_noon.jpg';"
                           class="input-field py-1.5 text-xs flex-1 text-left font-mono" dir="ltr" placeholder="استوردي صورة هذا الحقل أو ضعي الرابط">
                    <label class="btn-gold px-3 py-2 rounded-xl cursor-pointer text-[10px] flex items-center gap-1 font-bold shrink-0 shadow-sm" title="اختاري صورة هذا الحقل وسيتم ضغطها بالبايتات تلقائياً">
                        <span class="material-symbols-outlined text-xs">upload_file</span>
                        <span>رفع وضغط 📁</span>
                        <input type="file" accept="image/*" class="hidden" onchange="handleVariantImageUpload(this, ${i})">
                    </label>
                </div>
            </div>

            <!-- Color Name AR / EN + Optional Custom Price -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                    <label class="text-[10px] text-primary/75 block mb-0.5 font-bold">اسم اللون / الموديل (عربي) *</label>
                    <input type="text" value="${sanitizeHtml(v.colorNameAr || '')}" oninput="updateVariantField(${i}, 'colorNameAr', this.value)" class="input-field py-1.5 text-xs" placeholder="مثال: ماروني ملكي">
                </div>
                <div>
                    <label class="text-[10px] text-primary/75 block mb-0.5 font-bold">اسم اللون (EN)</label>
                    <input type="text" value="${sanitizeHtml(v.colorNameEn || '')}" oninput="updateVariantField(${i}, 'colorNameEn', this.value)" class="input-field py-1.5 text-xs" placeholder="Royal Burgundy">
                </div>
                <div>
                    <label class="text-[10px] text-primary/75 block mb-0.5 font-bold">سعر خاص لهذا الحقل (اختياري)</label>
                    <input type="number" value="${v.price ? Number(v.price) : ''}" oninput="updateVariantField(${i}, 'price', this.value)" class="input-field py-1.5 text-xs text-left font-mono" dir="ltr" placeholder="اتركيه فارغاً لاعتماد السعر الرئيسي">
                </div>
            </div>

            <!-- Custom Description + Custom Sizes with Quick Chips -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                    <label class="text-[10px] text-primary/75 block mb-0.5 font-bold">تفاصيل / وصف خاص بهذا الحقل (اختياري)</label>
                    <input type="text" value="${sanitizeHtml(v.descriptionAr || '')}" oninput="updateVariantField(${i}, 'descriptionAr', this.value)" class="input-field py-1.5 text-xs" placeholder="مثال: تطريز يدوي باللون الماروني الفاخر...">
                </div>
                <div>
                    <label class="text-[10px] text-primary/75 block mb-0.5 font-bold">مقاسات هذا الحقل (اختياري)</label>
                    <input type="text" id="variant-sizes-${i}" value="${sanitizeHtml(sizesStr)}" oninput="updateVariantField(${i}, 'sizes', this.value)" class="input-field py-1.5 text-xs" placeholder="S, M, L أو 38, 40, 42">
                    <div class="flex flex-wrap gap-1 mt-1">
                        ${quickSizesList.map(sz => `
                            <button type="button" onclick="addVariantQuickSize(${i}, '${sz}')" class="px-1.5 py-0.5 rounded bg-primary/5 hover:bg-primary/15 border border-primary/10 text-[9px] font-bold">${sz}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
};

window.addProductVariant = () => {
    const paletteRotation = [
        { hex: '#800020', ar: 'ماروني / عنابي', en: 'Burgundy' },
        { hex: '#0F0F0F', ar: 'أسود ملكي', en: 'Royal Black' },
        { hex: '#D4AF37', ar: 'ذهبي ملكي', en: 'Royal Gold' },
        { hex: '#1E293B', ar: 'كحلي ليلي', en: 'Midnight Navy' },
        { hex: '#E8D8C8', ar: 'بيج شامبين', en: 'Champagne Beige' },
        { hex: '#F4ACB7', ar: 'وردي بودر', en: 'Blush Pink' }
    ];
    const preset = paletteRotation[productVariants.length % paletteRotation.length];

    productVariants.push({
        id: 'var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        hex: preset.hex,
        colorNameAr: '',
        colorNameEn: '',
        image: '',
        price: '',
        descriptionAr: '',
        descriptionEn: '',
        sizes: [],
        byteBadgeText: ''
    });
    renderProductVariantsUI();
};

window.duplicateProductVariant = (index) => {
    const src = productVariants[index];
    if (!src) return;
    productVariants.splice(index + 1, 0, {
        id: 'var_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        hex: src.hex || '#1B2E1D',
        colorNameAr: src.colorNameAr ? `${src.colorNameAr} (نسخة)` : '',
        colorNameEn: src.colorNameEn || '',
        image: src.image || '',
        price: src.price || '',
        descriptionAr: src.descriptionAr || '',
        descriptionEn: src.descriptionEn || '',
        sizes: Array.isArray(src.sizes) ? [...src.sizes] : [],
        byteBadgeText: src.byteBadgeText || ''
    });
    renderProductVariantsUI();
    showToast(`تم نسخ الحقل #${index + 1} — يمكنكِ الآن تغيير صورته ولونه من دائرة الألوان`);
};

window.removeProductVariant = (index) => {
    productVariants.splice(index, 1);
    renderProductVariantsUI();
};

window.updateVariantField = (index, field, value) => {
    if (!productVariants[index]) return;
    if (field === 'sizes') {
        productVariants[index].sizes = value.split(',').map(s => s.trim()).filter(Boolean);
    } else if (field === 'price') {
        productVariants[index].price = value ? parseInt(value, 10) || '' : '';
    } else {
        productVariants[index][field] = value;
    }
};

window.handleVariantImageUpload = async (inputEl, index) => {
    if (!inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    if (file.size > 15 * 1024 * 1024) {
        showToast("حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 15 ميجابايت", true);
        return;
    }
    try {
        const stats = await compressImageFileWithStats(file);
        updateVariantField(index, 'image', stats.dataUrl);
        const badgeText = `⚡ ${formatBytes(stats.originalBytes)} ← ${formatBytes(stats.compressedBytes)} (-${stats.savedPercent}%)`;
        if (productVariants[index]) {
            productVariants[index].byteBadgeText = badgeText;
        }
        const input = document.getElementById(`variant-img-${index}`);
        if (input) input.value = stats.dataUrl;
        const preview = document.getElementById(`variant-img-preview-${index}`);
        if (preview) preview.src = stats.dataUrl;
        const badgeWrap = document.getElementById(`variant-byte-badge-${index}`);
        if (badgeWrap) {
            badgeWrap.innerHTML = `<span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">${sanitizeHtml(badgeText)}</span>`;
        }
        showToast(`⚡ تم ضغط ورفع صورة الحقل #${index + 1}: ${formatBytes(stats.originalBytes)} ← ${formatBytes(stats.compressedBytes)} (وفّرت ${stats.savedPercent}%)`);
    } catch (err) {
        showToast("فشل استيراد صورة الحقل", true);
    }
};

window.autoTranslateAllProductFields = async () => {
    const nameAr = document.getElementById('product-name-ar')?.value;
    const descAr = document.getElementById('product-desc-ar')?.value;
    const primaryColorAr = document.getElementById('product-primary-color-ar')?.value;

    if (!nameAr && !descAr && !primaryColorAr && productVariants.length === 0) {
        showToast("يرجى كتابة اسم أو وصف المنتج بالعربي أولاً", true);
        return;
    }

    showToast("جاري ترجمة كافة نصوص القطعة وحقولها للإنكليزية...");

    if (nameAr) {
        const nameEn = await translateArabicToEnglish(nameAr);
        const nameEnEl = document.getElementById('product-name-en');
        if (nameEnEl) nameEnEl.value = nameEn;
    }

    if (primaryColorAr) {
        const primaryColorEnEl = document.getElementById('product-primary-color-en');
        if (primaryColorEnEl && !primaryColorEnEl.value.trim()) {
            primaryColorEnEl.value = await translateArabicToEnglish(primaryColorAr);
        }
    }

    for (let i = 0; i < productVariants.length; i++) {
        const v = productVariants[i];
        if (v.colorNameAr && !v.colorNameEn) {
            v.colorNameEn = await translateArabicToEnglish(v.colorNameAr);
        }
        if (v.descriptionAr && !v.descriptionEn) {
            v.descriptionEn = await translateArabicToEnglish(v.descriptionAr);
        }
    }

    renderProductVariantsUI();
    showToast("تمت ترجمة كافة الحقول وتشكيلات الألوان بنجاح!");
};

window.openProductModal = () => {
    editingProductId = null;
    document.getElementById('product-modal-title').innerText = 'إضافة قطعة جديدة';
    document.getElementById('product-form')?.reset();
    document.getElementById('product-edit-id').value = '';

    const primaryPreview = document.getElementById('product-primary-img-preview');
    if (primaryPreview) primaryPreview.src = '../images/hero_noon.jpg';
    const primaryByteBadge = document.getElementById('primary-img-byte-badge');
    if (primaryByteBadge) {
        primaryByteBadge.innerText = '';
        primaryByteBadge.classList.add('hidden');
    }
    const primarySwatch = document.getElementById('primary-color-swatch-preview');
    if (primarySwatch) primarySwatch.style.backgroundColor = '#1B2E1D';
    const primaryHex = document.getElementById('product-primary-color-hex');
    if (primaryHex) primaryHex.value = '#1B2E1D';

    productVariants = [];
    renderProductVariantsUI();

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

window.updateProductCategoryOptions = (selectedCategory = '') => {
    const storeId = document.getElementById('product-store-select')?.value;
    const store = stores.find(s => s.id === storeId);
    const catSelect = document.getElementById('product-category-select');
    if (!catSelect || !store) return;

    const rawCats = Array.isArray(store.categories) && store.categories.length > 0
        ? store.categories
        : [{ id: 'all', titleAr: 'الكل / عام' }];

    const customCats = rawCats.filter(c => c.id !== 'all');
    const optionsList = customCats.length > 0
        ? [...customCats, { id: 'all', titleAr: 'الكل / عام' }]
        : [{ id: 'all', titleAr: 'الكل / عام' }];

    if (selectedCategory && !optionsList.some(c => c.id === selectedCategory)) {
        optionsList.unshift({ id: selectedCategory, titleAr: selectedCategory });
    }

    catSelect.innerHTML = optionsList.map(c => `
        <option value="${sanitizeHtml(c.id)}" ${c.id === selectedCategory ? 'selected' : ''}>${sanitizeHtml(c.titleAr)}</option>
    `).join('');
};

window.editProduct = (id) => {
    const numId = Number(id);
    const p = products.find(x => Number(x.id) === numId);
    if (!p) return;
    editingProductId = numId;

    document.getElementById('product-modal-title').innerText = 'تعديل بيانات القطعة وحقولها';
    document.getElementById('product-edit-id').value = p.id;

    const storeSelect = document.getElementById('product-store-select');
    if (storeSelect) {
        storeSelect.innerHTML = stores.map(s => `<option value="${sanitizeHtml(s.id)}" ${s.id === p.storeId ? 'selected' : ''}>${sanitizeHtml(s.nameAr)}</option>`).join('');
        storeSelect.value = p.storeId || stores[0]?.id || '';
    }
    updateProductCategoryOptions(p.category || 'all');

    document.getElementById('product-name-ar').value = p.nameAr || '';
    document.getElementById('product-name-en').value = p.nameEn || '';
    document.getElementById('product-category-select').value = p.category || 'all';
    document.getElementById('product-price').value = p.price || 0;
    document.getElementById('product-image-url').value = p.image || '';
    document.getElementById('product-sizes').value = (p.sizes || []).join(', ');
    document.getElementById('product-desc-ar').value = p.descriptionAr || '';

    const primaryPreview = document.getElementById('product-primary-img-preview');
    if (primaryPreview) primaryPreview.src = resolveDashboardImg(p.image);
    const primaryByteBadge = document.getElementById('primary-img-byte-badge');
    if (primaryByteBadge) {
        if (p.image && p.image.startsWith('data:')) {
            primaryByteBadge.innerText = `حجم الصورة: ${formatBytes(estimateDataUrlBytes(p.image))}`;
            primaryByteBadge.classList.remove('hidden');
        } else {
            primaryByteBadge.classList.add('hidden');
        }
    }

    const pHex = p.primaryColorHex || '#1B2E1D';
    const primarySwatch = document.getElementById('primary-color-swatch-preview');
    if (primarySwatch) primarySwatch.style.backgroundColor = pHex;
    const primaryHexInput = document.getElementById('product-primary-color-hex');
    if (primaryHexInput) primaryHexInput.value = pHex;
    const primaryArInput = document.getElementById('product-primary-color-ar');
    if (primaryArInput) primaryArInput.value = p.primaryColorNameAr || '';
    const primaryEnInput = document.getElementById('product-primary-color-en');
    if (primaryEnInput) primaryEnInput.value = p.primaryColorNameEn || '';

    // Load Unlimited Color/Image Variants
    if (Array.isArray(p.colors) && p.colors.length > 0) {
        productVariants = p.colors.map(c => {
            if (typeof c === 'object') {
                const imgVal = c.image || '';
                const existingBytes = imgVal.startsWith('data:') ? `الحجم: ${formatBytes(estimateDataUrlBytes(imgVal))}` : '';
                return {
                    id: c.id || ('var_' + Math.random().toString(36).substr(2, 9)),
                    hex: c.hex || '#1B2E1D',
                    colorNameAr: c.colorNameAr || c.ar || c.name || '',
                    colorNameEn: c.colorNameEn || c.name || '',
                    image: imgVal,
                    price: c.price || '',
                    descriptionAr: c.descriptionAr || '',
                    descriptionEn: c.descriptionEn || '',
                    sizes: Array.isArray(c.sizes) ? c.sizes : [],
                    byteBadgeText: existingBytes
                };
            }
            return {
                id: 'var_' + Math.random().toString(36).substr(2, 9),
                hex: String(c),
                colorNameAr: '',
                colorNameEn: '',
                image: '',
                price: '',
                descriptionAr: '',
                descriptionEn: '',
                sizes: [],
                byteBadgeText: ''
            };
        });
    } else {
        productVariants = [];
    }
    renderProductVariantsUI();

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

    const primaryColorHex = document.getElementById('product-primary-color-hex')?.value || '#1B2E1D';
    const primaryColorNameAr = document.getElementById('product-primary-color-ar')?.value.trim() || '';
    const primaryColorNameEn = document.getElementById('product-primary-color-en')?.value.trim() || '';

    // Collect all images from unlimited variants
    const allImages = [image];
    productVariants.forEach(v => {
        if (v.image && !allImages.includes(v.image)) {
            allImages.push(v.image);
        }
    });

    const formattedColors = productVariants.map((v, idx) => ({
        id: v.id || ('var_' + Math.random().toString(36).substr(2, 9)),
        hex: v.hex || '#1B2E1D',
        colorNameAr: v.colorNameAr || `لون #${idx + 1}`,
        colorNameEn: v.colorNameEn || `Color #${idx + 1}`,
        image: v.image || image,
        price: v.price ? Number(v.price) : price,
        descriptionAr: v.descriptionAr || desc,
        descriptionEn: v.descriptionEn || (nameEn + ' exquisite piece.'),
        sizes: (Array.isArray(v.sizes) && v.sizes.length) ? v.sizes : (sizes.length ? sizes : ["Standard"])
    }));

    const existingProd = editingProductId ? products.find(x => Number(x.id) === Number(editingProductId)) : null;

    const prodObj = {
        id: editingProductId ? Number(editingProductId) : Date.now(),
        storeId,
        nameAr,
        nameEn: nameEn || nameAr,
        category: category || 'all',
        price,
        currencyAr: "د.ع ",
        currencyEn: "IQD ",
        image,
        images: allImages,
        primaryColorHex,
        primaryColorNameAr,
        primaryColorNameEn,
        colors: formattedColors,
        sizes: sizes.length ? sizes : ["Standard"],
        descriptionAr: desc,
        descriptionEn: existingProd?.descriptionEn || ((nameEn || nameAr) + " exquisite piece."),
        heritageAr: existingProd?.heritageAr || '',
        heritageEn: existingProd?.heritageEn || ''
    };

    products = await db.saveProduct(prodObj);
    showToast(editingProductId ? "تم تحديث المنتج وحقوله وألوانه بنجاح!" : "تمت إضافة المنتج الجديد وكافة حقوله بنجاح!");

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

function updateGameStatusBadge(isEnabled) {
    const badge = document.getElementById('game-status-badge');
    if (!badge) return;
    if (isEnabled) {
        badge.className = 'badge badge-active';
        badge.innerText = 'مفعلة وشغالة ✅';
    } else {
        badge.className = 'badge badge-inactive';
        badge.innerText = 'متوقفة حالياً ⛔';
    }
}

function renderGameSection() {
    const attemptsInput = document.getElementById('game-attempts-input');
    const activeToggle = document.getElementById('game-active-toggle');
    const tbody = document.getElementById('game-prizes-tbody');

    const isEnabled = gameConfig.enabled !== false;
    if (attemptsInput) attemptsInput.value = gameConfig.dailyAttemptsAllowed || 1;
    if (activeToggle) activeToggle.checked = isEnabled;
    updateGameStatusBadge(isEnabled);

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

window.toggleGameActiveStatus = async (checked) => {
    const isEnabled = Boolean(checked);
    gameConfig.enabled = isEnabled;
    updateGameStatusBadge(isEnabled);

    const attempts = parseInt(document.getElementById('game-attempts-input')?.value) || gameConfig.dailyAttemptsAllowed || 1;
    gameConfig.dailyAttemptsAllowed = attempts;

    if (gameConfig.prizes) {
        gameConfig.prizes.forEach((p, i) => {
            const wInput = document.getElementById(`prize-weight-${i}`);
            if (wInput) p.weight = parseInt(wInput.value) || 10;
        });
    }

    gameConfig = await db.saveGameConfig(gameConfig);
    showToast(isEnabled
        ? "تم تفعيل عجلة الحظ على المنصة وحفظ الحالة بنجاح! ✅"
        : "تم إيقاف عجلة الحظ مؤقتاً وحفظ الحالة بنجاح! ⛔");
};

window.saveGameConfigChanges = async () => {
    const attempts = parseInt(document.getElementById('game-attempts-input')?.value) || 1;
    const toggleEl = document.getElementById('game-active-toggle');
    const enabled = toggleEl ? Boolean(toggleEl.checked) : true;

    if (gameConfig.prizes) {
        gameConfig.prizes.forEach((p, i) => {
            const wInput = document.getElementById(`prize-weight-${i}`);
            if (wInput) p.weight = parseInt(wInput.value) || 10;
        });
    }

    gameConfig.dailyAttemptsAllowed = attempts;
    gameConfig.enabled = enabled;
    updateGameStatusBadge(enabled);
    gameConfig = await db.saveGameConfig(gameConfig);
    showToast(enabled
        ? "تم حفظ إعدادات العجلة وتفعيلها بنجاح! ✅"
        : "تم حفظ إعدادات العجلة وإيقافها مؤقتاً بنجاح! ⛔");
};

// ============================================================
// 5. COMMENTS & REVIEWS (إدارة التقييمات)
// ============================================================
async function renderCommentsSection() {
    const list = document.getElementById('comments-admin-list');
    const toggle = document.getElementById('reviews-active-toggle');
    if (toggle) {
        toggle.checked = platformSettings?.reviewsEnabled !== false;
    }

    if (!list) return;

    // Fetch all reviews including unapproved ones for admin
    const reviews = await db.getReviews(true);

    if (!reviews || reviews.length === 0) {
        list.innerHTML = `
            <div class="card p-8 text-center text-primary/40 text-xs">
                لا توجد تعليقات أو تقييمات مسجلة حالياً.
            </div>
        `;
        return;
    }

    list.innerHTML = reviews.map(c => `
        <div class="card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs mb-2">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <strong class="font-bold text-primary">${sanitizeHtml(c.authorName)}</strong>
                    <span class="badge bg-primary/10 text-primary">${sanitizeHtml(c.storeName || 'منصة نون')}</span>
                    <span class="badge ${c.isApproved !== false ? 'badge-active' : 'badge-inactive'}">
                        ${c.isApproved !== false ? 'معروض للعميلات' : 'مخفي مؤقتاً'}
                    </span>
                    <span class="text-primary/40 text-[10px] font-mono">${sanitizeHtml(c.createdAt || '')}</span>
                </div>
                <p class="text-primary/75 font-light leading-relaxed">${sanitizeHtml(c.content)}</p>
            </div>
            <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${c.isApproved !== false ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}" onclick="toggleCommentApproval(${c.id}, ${c.isApproved !== false})">
                    ${c.isApproved !== false ? 'إخفاء التعليق' : 'إظهار للعميلات'}
                </button>
                <button class="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 font-bold transition-colors" onclick="deleteComment(${c.id})">حذف نهائي</button>
            </div>
        </div>
    `).join('');
}

window.saveReviewsGlobalSetting = async () => {
    const enabled = document.getElementById('reviews-active-toggle')?.checked;
    platformSettings.reviewsEnabled = enabled;
    await db.savePlatformSettings(platformSettings);
    showToast(enabled ? "تم تفعيل نظام التقييمات في المنصة" : "تم إيقاف نظام التقييمات في المنصة");
};

window.toggleCommentApproval = async (id, currentApproved) => {
    await db.toggleReviewApproval(id, !currentApproved);
    await renderCommentsSection();
    showToast(!currentApproved ? "تم إظهار التعليق للعميلات بنجاح" : "تم إخفاء التعليق عن العميلات بنجاح");
};

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
    const durInput = document.getElementById('story-duration-input');
    if (durInput) {
        durInput.value = platformSettings?.storyDuration || 6;
    }

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
                <div class="p-3 bg-[#fafaf5] border-t border-black/5 flex justify-between gap-2">
                    <button class="btn-gold flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1" onclick="editStory(${Number(s.id)})">
                        <span class="material-symbols-outlined text-xs">edit</span>
                        <span>تعديل الستوري</span>
                    </button>
                    <button class="text-xs text-red-600 hover:text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 flex items-center gap-1" onclick="deleteStory(${Number(s.id)})">
                        <span class="material-symbols-outlined text-xs">delete</span>
                        <span>حذف</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.saveStoryDurationSetting = async () => {
    const dur = parseInt(document.getElementById('story-duration-input')?.value) || 6;
    platformSettings.storyDuration = Math.max(2, Math.min(30, dur));
    await db.savePlatformSettings(platformSettings);
    showToast(`تم حفظ مدة عرض كل ستوري بنجاح (${platformSettings.storyDuration} ثوانٍ)!`);
};

function populateStoryStoreSelect(selectedVal = 'platform') {
    const sel = document.getElementById('story-store-select');
    if (sel) {
        sel.innerHTML = `
            <option value="platform" ${selectedVal === 'platform' ? 'selected' : ''}>منصة نون العامة (الرئيسية)</option>
            ${stores.map(st => `<option value="${sanitizeHtml(st.id)}" ${st.id === selectedVal ? 'selected' : ''}>${sanitizeHtml(st.nameAr)} (${sanitizeHtml(st.nameEn)})</option>`).join('')}
        `;
        sel.value = selectedVal || 'platform';
    }
}

window.openStoryModal = () => {
    populateStoryStoreSelect('platform');
    const form = document.getElementById('story-form');
    if (form) form.reset();
    const editIdEl = document.getElementById('story-edit-id');
    if (editIdEl) editIdEl.value = '';
    const titleEl = document.getElementById('story-modal-title');
    if (titleEl) titleEl.innerText = 'نشر ستوري جديد';
    const submitBtn = document.getElementById('story-submit-btn');
    if (submitBtn) submitBtn.innerText = 'نشر الستوري الآن';
    document.getElementById('story-modal')?.classList.add('open');
};

window.editStory = (id) => {
    const numId = Number(id);
    const s = stories.find(x => Number(x.id) === numId);
    if (!s) return;

    populateStoryStoreSelect(s.storeId || 'platform');
    const editIdEl = document.getElementById('story-edit-id');
    if (editIdEl) editIdEl.value = s.id;
    const titleEl = document.getElementById('story-modal-title');
    if (titleEl) titleEl.innerText = 'تعديل الستوري المنشور';
    const submitBtn = document.getElementById('story-submit-btn');
    if (submitBtn) submitBtn.innerText = 'حفظ التعديلات';

    document.getElementById('story-title-ar').value = s.titleAr || '';
    document.getElementById('story-title-en').value = s.titleEn || '';
    document.getElementById('story-image-url').value = s.image || '';
    document.getElementById('story-caption-ar').value = s.captionAr || '';
    document.getElementById('story-cta-text').value = s.ctaAr || 'استعراض التشكيلة';

    document.getElementById('story-modal')?.classList.add('open');
};

window.closeStoryModal = () => {
    document.getElementById('story-modal')?.classList.remove('open');
};

window.saveStory = async (e) => {
    e.preventDefault();
    const editIdVal = document.getElementById('story-edit-id')?.value.trim();
    const isEditing = Boolean(editIdVal);
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

    const storyObj = {
        id: isEditing ? Number(editIdVal) : Date.now(),
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
        time: isEditing ? 'تم التحديث' : 'الآن',
        active: true
    };

    stories = await db.saveStory(storyObj);
    closeStoryModal();
    await renderStoriesSection();
    showToast(isEditing ? "تم تحديث الستوري بنجاح!" : "تم نشر الستوري بنجاح وربطه بالواجهة!");
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
    let wa = document.getElementById('settings-whatsapp')?.value.trim() || '';
    let ig = document.getElementById('settings-instagram')?.value.trim() || '';
    const fee = Number(document.getElementById('settings-delivery-fee')?.value) || 5000;

    // Clean & format
    wa = formatWhatsAppNumber(wa);
    ig = formatInstagramHandle(ig);

    platformSettings = await db.savePlatformSettings({
        ...platformSettings,
        logo: logo,
        whatsapp: wa,
        instagram: ig,
        deliveryFee: fee
    });

    if (document.getElementById('settings-whatsapp')) document.getElementById('settings-whatsapp').value = wa;
    if (document.getElementById('settings-instagram')) document.getElementById('settings-instagram').value = ig;

    showToast("تم حفظ إعدادات الهوية والتوصيل وتحديث الشعار ورقم الواتساب بنجاح!");
};

window.purgeAllMockData = async () => {
    if (!confirm("هل أنتِ متأكدة من رغبتكِ في تفريغ وحذف كافة المنتجات والتقييمات التجريبية القديمة المخزنة في المتصفح؟ ستبقى فقط المنتجات المسجلة في السيرفر.")) return;
    try {
        localStorage.removeItem('noon_products');
        localStorage.removeItem('noon_reviews');
        products = await db.getProducts();
        renderProductsSection();
        renderStoresSection();
        showToast("تم تنظيف وتفريغ كافة البيانات التجريبية بنجاح!");
    } catch(err) {
        showToast("حدث خطأ أثناء التنظيف", true);
    }
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

// --- Init & Refresh Dashboard ---
window.refreshDashboardData = async () => {
    showToast("جاري تحديث ومزامنة البيانات من قاعدة البيانات...");
    [stores, products, gameConfig, stories, platformSettings] = await Promise.all([
        db.getStores(),
        db.getProducts(),
        db.getGameConfig(),
        db.getStories(),
        db.getPlatformSettings()
    ]);
    showSection(currentSection || 'stores');
    showToast("تمت مزامنة أحدث البيانات بنجاح! ✅");
};

async function init() {
    [stores, products, gameConfig, stories, platformSettings] = await Promise.all([
        db.getStores(),
        db.getProducts(),
        db.getGameConfig(),
        db.getStories(),
        db.getPlatformSettings()
    ]);
    showSection('stores');
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
