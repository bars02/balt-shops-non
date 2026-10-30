-- ==============================================================================
-- منصة نون | NOON Multi-Store Platform
-- Database Schema & Security Definition (PostgreSQL / Supabase)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STORES TABLE (سجل المتاجر المستقلة)
CREATE TABLE IF NOT EXISTS public.stores (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    badge_ar TEXT,
    badge_en TEXT,
    description_ar TEXT,
    description_en TEXT,
    banner TEXT NOT NULL DEFAULT 'images/hero_noon.jpg',
    avatar TEXT DEFAULT 'images/logo.png',
    whatsapp TEXT NOT NULL,
    instagram TEXT,
    facebook TEXT,
    display_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIES TABLE (أقسام وتصنيفات المتاجر)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT NOT NULL,
    store_id TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    title_ar TEXT NOT NULL,
    title_en TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (store_id, id)
);

-- 4. PRODUCTS TABLE (المنتجات والقطع المعروضة)
CREATE TABLE IF NOT EXISTS public.products (
    id BIGINT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency_ar TEXT DEFAULT 'د.ع ',
    currency_en TEXT DEFAULT 'IQD ',
    image TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    description_ar TEXT,
    description_en TEXT,
    heritage_ar TEXT,
    heritage_en TEXT,
    colors JSONB DEFAULT '[]'::jsonb,
    sizes JSONB DEFAULT '["Standard"]'::jsonb,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. REVIEWS & COMMENTS (تقييمات العميلات)
CREATE TABLE IF NOT EXISTS public.reviews (
    id BIGSERIAL PRIMARY KEY,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    rating INT DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ORDERS TABLE (سجل الطلبات الواردة)
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    order_code TEXT UNIQUE NOT NULL,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    delivery_city TEXT,
    delivery_address TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_cost NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. GAME PRIZES TABLE (جوائز لعبة آلة الحظ)
CREATE TABLE IF NOT EXISTS public.game_prizes (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    code TEXT,
    icon TEXT DEFAULT 'redeem',
    color TEXT DEFAULT '#D4AF37',
    weight INT DEFAULT 10,
    symbol TEXT DEFAULT '💎',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DAILY SPINS TABLE (سجل محاولات السحب اليومي)
CREATE TABLE IF NOT EXISTS public.daily_spins (
    id BIGSERIAL PRIMARY KEY,
    user_identifier TEXT NOT NULL,
    prize_id TEXT REFERENCES public.game_prizes(id) ON DELETE SET NULL,
    prize_code TEXT,
    spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_spin_per_user UNIQUE (user_identifier, spin_date)
);

-- 9. GAME SETTINGS TABLE (إعدادات لعبة الحظ)
CREATE TABLE IF NOT EXISTS public.game_settings (
    id INT PRIMARY KEY DEFAULT 1,
    daily_attempts_allowed INT DEFAULT 1,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. STORIES TABLE (ستوريات وقصص المنصة والمتاجر)
CREATE TABLE IF NOT EXISTS public.stories (
    id BIGINT PRIMARY KEY,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    caption_ar TEXT,
    caption_en TEXT,
    media_url TEXT NOT NULL,
    link_target TEXT,
    cta_ar TEXT DEFAULT 'استعراض التشكيلة',
    cta_en TEXT DEFAULT 'Explore Collection',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PLATFORM SETTINGS TABLE (إعدادات وهوية المنصة والتوصيل وواجهة الهيرو)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id INT PRIMARY KEY DEFAULT 1,
    logo_url TEXT DEFAULT 'images/logo.png',
    whatsapp TEXT DEFAULT '9647835544744',
    instagram TEXT DEFAULT '@noon.boutique',
    delivery_fee NUMERIC(12, 2) DEFAULT 5000,
    currency_ar TEXT DEFAULT 'د.ع',
    currency_en TEXT DEFAULT 'IQD',
    hero_bg TEXT DEFAULT 'images/hero_noon.jpg',
    hero_badge_ar TEXT DEFAULT 'منصة نون للأزياء النسائية',
    hero_badge_en TEXT DEFAULT 'WOMEN''S MULTI-STORE PLATFORM',
    hero_title_ar TEXT DEFAULT 'أناقة نسائية لا متناهية',
    hero_title_en TEXT DEFAULT 'Timeless Fluidity & Grace',
    hero_desc_ar TEXT DEFAULT 'تصفحي أرقى دور الأزياء النسائية المستقلة تحت سقف واحد',
    hero_desc_en TEXT DEFAULT 'Discover distinct independent women''s fashion boutiques under one roof',
    hero_btn_ar TEXT DEFAULT 'اكتشفي المتاجر',
    hero_btn_en TEXT DEFAULT 'EXPLORE BOUTIQUES',
    wheel_prizes JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration helpers for existing platform_settings installations:
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_bg TEXT DEFAULT 'images/hero_noon.jpg';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_badge_ar TEXT DEFAULT 'منصة نون للأزياء النسائية';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_badge_en TEXT DEFAULT 'WOMEN''S MULTI-STORE PLATFORM';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_title_ar TEXT DEFAULT 'أناقة نسائية لا متناهية';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_title_en TEXT DEFAULT 'Timeless Fluidity & Grace';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_desc_ar TEXT DEFAULT 'تصفحي أرقى دور الأزياء النسائية المستقلة تحت سقف واحد';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_desc_en TEXT DEFAULT 'Discover distinct independent women''s fashion boutiques under one roof';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_btn_ar TEXT DEFAULT 'اكتشفي المتاجر';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS hero_btn_en TEXT DEFAULT 'EXPLORE BOUTIQUES';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS wheel_prizes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS story_duration INT DEFAULT 6;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN DEFAULT TRUE;

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES - حماية وتأمين البيانات
-- ==============================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 10.1 STORES POLICIES
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;
CREATE POLICY "Public can view active stores" ON public.stores
    FOR SELECT USING (is_active = TRUE OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage stores" ON public.stores;
CREATE POLICY "Admins can manage stores" ON public.stores
    FOR ALL USING (auth.role() = 'authenticated');

-- 10.2 CATEGORIES POLICIES
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories" ON public.categories
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
    FOR ALL USING (auth.role() = 'authenticated');

-- 10.3 PRODUCTS POLICIES
DROP POLICY IF EXISTS "Public can view available products" ON public.products;
CREATE POLICY "Public can view available products" ON public.products
    FOR SELECT USING (is_available = TRUE OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
    FOR ALL USING (auth.role() = 'authenticated');

-- 10.4 REVIEWS POLICIES
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;
CREATE POLICY "Public can view approved reviews" ON public.reviews
    FOR SELECT USING (is_approved = TRUE);

DROP POLICY IF EXISTS "Anyone can submit reviews" ON public.reviews;
CREATE POLICY "Anyone can submit reviews" ON public.reviews
    FOR INSERT WITH CHECK (LENGTH(content) > 0 AND LENGTH(author_name) > 0);

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews" ON public.reviews
    FOR ALL USING (auth.role() = 'authenticated');

-- 10.5 ORDERS POLICIES
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders
    FOR INSERT WITH CHECK (LENGTH(customer_name) > 0);

DROP POLICY IF EXISTS "Admins can view and manage all orders" ON public.orders;
CREATE POLICY "Admins can view and manage all orders" ON public.orders
    FOR ALL USING (auth.role() = 'authenticated');

-- 10.6 GAME PRIZES & SETTINGS POLICIES
DROP POLICY IF EXISTS "Public can view active prizes" ON public.game_prizes;
CREATE POLICY "Public can view active prizes" ON public.game_prizes
    FOR SELECT USING (is_active = TRUE OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage game prizes" ON public.game_prizes;
CREATE POLICY "Admins can manage game prizes" ON public.game_prizes
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public can view game settings" ON public.game_settings;
CREATE POLICY "Public can view game settings" ON public.game_settings
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage game settings" ON public.game_settings;
CREATE POLICY "Admins can manage game settings" ON public.game_settings
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public can record daily spins" ON public.daily_spins;
CREATE POLICY "Public can record daily spins" ON public.daily_spins
    FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public can view own daily spins" ON public.daily_spins;
CREATE POLICY "Public can view own daily spins" ON public.daily_spins
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage daily spins" ON public.daily_spins;
CREATE POLICY "Admins can manage daily spins" ON public.daily_spins
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- 11.7 STORIES POLICIES
DROP POLICY IF EXISTS "Public can view active stories" ON public.stories;
CREATE POLICY "Public can view active stories" ON public.stories
    FOR SELECT USING (is_active = TRUE OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage stories" ON public.stories;
CREATE POLICY "Admins can manage stories" ON public.stories
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- 12.8 PLATFORM SETTINGS POLICIES
DROP POLICY IF EXISTS "Public can view platform settings" ON public.platform_settings;
CREATE POLICY "Public can view platform settings" ON public.platform_settings
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins can manage platform settings" ON public.platform_settings
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- ==============================================================================
-- 13. SEED DATA - البيانات التأسيسية للمنصة والمتاجر
-- ==============================================================================

-- 11.1 المتاجر الثلاثة
INSERT INTO public.stores (id, slug, name_ar, name_en, badge_ar, badge_en, description_ar, description_en, banner, avatar, whatsapp, instagram, facebook, display_order, is_active)
VALUES 
(
    'elegance', 
    'elegance', 
    'إليجانس نون', 
    'Elegance NOON', 
    'أزياء السهرة والراقية', 
    'Couture & Evening', 
    'أرقى فساتين السهرة والأزياء المخملية الفاخرة المصممة خصيصاً للمناسبات الاستثنائية.', 
    'Haute couture evening gowns and luxury velvet dresses tailored for unforgettable moments.', 
    'images/store_elegance.jpg', 
    'images/logo.png', 
    '9647835544744', 
    '@elegance.noon', 
    'EleganceNoonFashion', 
    1, 
    TRUE
),
(
    'casual', 
    'casual', 
    'كاجوال نون', 
    'Casual NOON', 
    'ملابس يومية عصرية', 
    'Modern Casual', 
    'أحدث صيحات الملابس اليومية العصرية بتصاميم مريحة وأقمشة لِنين وحريرية راقية.', 
    'Contemporary chic daily wear, breathable linen sets and elegant silk blouses.', 
    'images/store_casual.jpg', 
    'images/logo.png', 
    '9647835544744', 
    '@casual.noon', 
    'CasualNoonFashion', 
    2, 
    TRUE
),
(
    'royal', 
    'royal', 
    'رويال نون', 
    'Royal NOON', 
    'عبايات ملكية وتراث', 
    'Royal Abayas', 
    'عبايات ملكية وبشوت مطرزة يدوياً بخيوط الذهب، تجمع بين الأصالة والترف المعاصر.', 
    'Hand-embroidered royal abayas and bishts adorned with gold threads and heritage luxury.', 
    'images/store_royal.jpg', 
    'images/logo.png', 
    '9647835544744', 
    '@royal.noon', 
    'RoyalNoonFashion', 
    3, 
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    banner = EXCLUDED.banner,
    whatsapp = EXCLUDED.whatsapp;

-- 11.2 أقسام المتاجر
INSERT INTO public.categories (store_id, id, title_ar, title_en, display_order)
VALUES
('elegance', 'all', 'الكل', 'All', 0),
('elegance', 'gowns', 'فساتين سهرة', 'Evening Gowns', 1),
('elegance', 'cocktail', 'أزياء كوكتيل', 'Cocktail Dresses', 2),
('elegance', 'velvet', 'مخمل وتطريز', 'Velvet & Embroidery', 3),

('casual', 'all', 'الكل', 'All', 0),
('casual', 'linen_sets', 'أطقم لِنين', 'Linen Sets', 1),
('casual', 'blouses', 'بلايز وقمصان', 'Blouses & Shirts', 2),
('casual', 'blazers', 'بليزرات أنيقة', 'Chic Blazers', 3),

('royal', 'all', 'الكل', 'All', 0),
('royal', 'royal_abayas', 'عبايات ملكية', 'Royal Abayas', 1),
('royal', 'embroidered_bishts', 'بشوت مطرزة', 'Embroidered Bishts', 2),
('royal', 'silk_scarves', 'شالات وأوشحة', 'Silk Scarves', 3)
ON CONFLICT (store_id, id) DO NOTHING;

-- 11.3 المنتجات
INSERT INTO public.products (id, store_id, category, name_ar, name_en, price, currency_ar, currency_en, image, description_ar, description_en, heritage_ar, heritage_en, colors, sizes, is_available)
VALUES
(
    101, 'elegance', 'gowns', 
    'فستان السهرة الزمردي الملكي', 'Emerald Royal Gala Gown', 
    1450000, 'د.ع ', 'IQD ', 
    'images/store_elegance.jpg',
    'فستان سهرة من الكريب الحريري المطرز بالخيوط الذهبية يدوياً مع كيب ملكي انسيابي.',
    'Sculpted silk crepe evening gown hand-finished with gold metallic thread and draped cape.',
    'مستوحى من قصور الشرق مع لمسات خياطة فرنسية راقية.',
    'Crafted with couture techniques that blend royal heritage with sharp modern aesthetics.',
    '[{"name":"Emerald Gold","ar":"زمردي وذهبي","hex":"#1a402a"},{"name":"Royal Noir","ar":"أسود ملكي","hex":"#0a0a0a"}]'::jsonb,
    '["36", "38", "40", "42", "44"]'::jsonb,
    TRUE
),
(
    102, 'elegance', 'cocktail', 
    'فستان كريب دي شين عاجي', 'Ivory Crepe de Chine Dress', 
    980000, 'د.ع ', 'IQD ', 
    'images/hero_noon.jpg',
    'قصة انسيابية راقية تبرز القوام بياقة مفتوحة وأكمام فرنسية واسعة.',
    'Fluid silk crepe with soft sheen, designed for effortless elegance and timeless grace.',
    'خياطة يدوية دقيقة في أتيليه إليجانس نون.',
    'Hand-finished seams ensuring fluid silhouette movement.',
    '[{"name":"Ivory Silk","ar":"حرير عاجي","hex":"#FCFAE8"},{"name":"Rose Gold","ar":"وردي ذهبي","hex":"#b76e79"}]'::jsonb,
    '["38", "40", "42"]'::jsonb,
    TRUE
),
(
    103, 'elegance', 'velvet', 
    'فستان مخمل أسود مطرز يدوي', 'Midnight Embroidered Velvet Gown', 
    1250000, 'د.ع ', 'IQD ', 
    'images/store_elegance.jpg',
    'مخمل إيطالي فاخر بلون الليل مع تطريز نباتي ذهبي على الأكتاف والمعصم.',
    'Italian midnight velvet gown with botanical gold thread embroidery.',
    'تطريز يدوي استغرق أكثر من 60 ساعة عمل متواصلة.',
    'Over 60 hours of artisanal hand-embroidery work.',
    '[{"name":"Midnight Black","ar":"أسود داكن","hex":"#000000"}]'::jsonb,
    '["36", "38", "40", "42"]'::jsonb,
    TRUE
),
(
    201, 'casual', 'linen_sets', 
    'طقم لِنين صيفي عاجي فاخر', 'Chic Ivory Linen Co-ord Set', 
    320000, 'د.ع ', 'IQD ', 
    'images/store_casual.jpg',
    'طقم قطعتين من كتان اللِنين الطبيعي البارد، بنطال واسع مريح مع قميص بياقة كلاسيكية.',
    'Two-piece pure European linen set with wide-leg trousers and relaxed button-up shirt.',
    'نسيج كتان نقي 100% يمنحك الراحة والانتعاش طوال اليوم.',
    '100% organic breathable linen tailored for contemporary daily chic.',
    '[{"name":"Soft Ivory","ar":"عاجي ناعم","hex":"#f5f3e9"},{"name":"Olive Green","ar":"زيتوني هادئ","hex":"#556b2f"}]'::jsonb,
    '["S", "M", "L", "XL"]'::jsonb,
    TRUE
),
(
    202, 'casual', 'blazers', 
    'بليزر أوفر سايز راقي بلون الكراميل', 'Caramel Oversized Tailored Blazer', 
    2850000, 'د.ع ', 'IQD ', 
    'images/store_casual.jpg',
    'بليزر واسع بقصة كتف معماري مبطنة، يمنحك مظهراً عملياً مفعماً بالثقة.',
    'Structured double-breasted blazer in warm caramel wool blend.',
    'تصميم كلاسيكي بريطاني مجدد بأسلوب حضري عصري.',
    'British tailoring heritage reimagined for today dynamic woman.',
    '[{"name":"Caramel","ar":"كراميل دافئ","hex":"#c68a4c"},{"name":"Off White","ar":"أوف وايت","hex":"#f8f8f2"}]'::jsonb,
    '["S", "M", "L"]'::jsonb,
    TRUE
),
(
    203, 'casual', 'blouses', 
    'قميص حريري بأكمام منسدلة', 'Fluid Mulberry Silk Blouse', 
    195000, 'د.ع ', 'IQD ', 
    'images/store_casual.jpg',
    'حرير طبيعي خفيف بلمسة ساتان فاخرة، مناسب للمكتب والإطلالات اليومية.',
    'Pure mulberry silk with subtle luster and elegant French cuffs.',
    'أزرار صدفية طبيعية منحوتة بدقة.',
    'Natural mother-of-pearl buttons with clean artisanal stitching.',
    '[{"name":"Champagne","ar":"شامبين ذهبي","hex":"#edd9be"},{"name":"Pure White","ar":"أبيض ناصع","hex":"#ffffff"}]'::jsonb,
    '["XS", "S", "M", "L", "XL"]'::jsonb,
    TRUE
),
(
    301, 'royal', 'royal_abayas', 
    'عباية ملكية كريب بتطريز قصب ذهبي', 'Royal Gold-Zari Embroidered Abaya', 
    890000, 'د.ع ', 'IQD ', 
    'images/hero_noon.jpg',
    'عباية بقماش الكريب الملكي الفاحم السواد مع حواف مطرزة بخيوط القصب الذهبي الأصيل.',
    'Deep-black royal crepe abaya finished with hand-embroidered metallic gold zardozi borders.',
    'صناعة حرفية أصيلة مستلهمة من التراث الأندلسي والخليجي الملكي.',
    'Preserving ancient royal embroidery arts with contemporary majesty.',
    '[{"name":"Royal Jet Black","ar":"أسود ملكي فاخر","hex":"#0b0b0c"}]'::jsonb,
    '["52", "54", "56", "58", "60"]'::jsonb,
    TRUE
),
(
    302, 'royal', 'embroidered_bishts', 
    'بشت نسائي مخمل مطرز بالزري الذهبي', 'Royal Velvet Bisht with Gold Zari', 
    940000, 'د.ع ', 'IQD ', 
    'images/store_royal.jpg',
    'بشت نسائي ملكي من المخمل الألماني الكثيف، بتطريز زري ذهبي عريض على الصدر والأكمام.',
    'Opulent velvet bisht featuring traditional hand-spun golden zari ornamentation.',
    'قطعة مقتنيات فاخرة تناسب حفلات الاستقبال والأعياد.',
    'An heirloom-grade masterpiece crafted for grand celebrations.',
    '[{"name":"Imperial Emerald","ar":"أخضر ملكي داكن","hex":"#1B2E1D"},{"name":"Royal Black","ar":"أسود كلاسيكي","hex":"#000000"}]'::jsonb,
    '["Free Size (قياس موحد)"]'::jsonb,
    TRUE
),
(
    303, 'royal', 'silk_scarves', 
    'شال كشمير نقي بحواف زري مذهبة', 'Pure Cashmere Shawl with Gold Borders', 
    310000, 'د.ع ', 'IQD ', 
    'images/hero_noon.jpg',
    'كشمير خالص فائق النعومة والدفء مع لمسات تطريز خفيفة عند الأطراف.',
    'Hand-woven pure cashmere shawl edged with delicate gilded embroidery.',
    'غزل يدوي في أنقى ورش الصوف الجبلي الأصيل.',
    'Artisanal hand-spun cashmere of the highest micron grade.',
    '[{"name":"Desert Sand","ar":"رملي دافئ","hex":"#d8c4a5"},{"name":"Emerald Noir","ar":"زمردي داكن","hex":"#122316"}]'::jsonb,
    '["One Size"]'::jsonb,
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 11.4 جوائز لعبة اليوم
INSERT INTO public.game_prizes (id, name_ar, name_en, code, icon, color, weight, symbol, is_active)
VALUES
('p1', 'قسيمة 50,000 د.ع', '50,000 IQD Voucher', 'NOON50K', 'redeem', '#D4AF37', 15, '💎', TRUE),
('p2', 'خصم 20% على طلبك', '20% Discount Code', 'NOON20', 'percent', '#E5C76B', 25, '👑', TRUE),
('p3', 'شحن مجاني لكل المحافظات', 'Free Express Shipping', 'FREESHIP', 'local_shipping', '#2A8F53', 30, '✨', TRUE),
('p4', 'خصم 10% فوري', '10% Instant Discount', 'NOON10', 'sell', '#b8860b', 20, '⭐', TRUE),
('p5', 'حظ أوفر غداً', 'Better Luck Tomorrow', NULL, 'sentiment_satisfied', '#888888', 10, '🌙', TRUE)
ON CONFLICT (id) DO UPDATE SET
    weight = EXCLUDED.weight,
    code = EXCLUDED.code;

-- 11.5 تقييمات العملاء الابتدائية
INSERT INTO public.reviews (store_id, author_name, content, rating, is_approved)
VALUES
('elegance', 'سارة العبيدي', 'الفستان الزمردي من متجر إليجانس فاق التوقعات، تطريز متقن جداً وتوصيل سريع.', 5, TRUE),
('royal', 'ريم الهاشمي', 'عباية الكريب الملكية من رويال نون تبارك الرحمن قمة في الفخامة والرزانة.', 5, TRUE),
('casual', 'هدى جاسم', 'طقم اللِنين مريح جداً وأنيق للدوام، شكراً منصة نون على حسن الترتيب.', 5, TRUE)
ON CONFLICT DO NOTHING;

-- 12.6 إعدادات لعبة الحظ
INSERT INTO public.game_settings (id, daily_attempts_allowed, is_enabled)
VALUES (1, 1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 12.7 ستوريات المنصة الافتتاحية
INSERT INTO public.stories (id, store_id, title_ar, title_en, caption_ar, media_url, link_target, cta_ar, is_active)
VALUES
(
    1, 'elegance',
    'وصول تشكيلة السهرة الاستثنائية لعام 2026',
    'Haute Couture Evening Gala Gowns',
    'أرقى فساتين السهرة من الكريب الحريري والمخمل الإيطالي المطرز بالخيوط الذهبية يدوياً للمناسبات الكبرى.',
    'images/store_elegance.jpg',
    'elegance',
    'استعراض فساتين السهرة',
    TRUE
),
(
    2, 'royal',
    'عبايات وبشوت ملكية بتطريز الزري الأصيل',
    'Royal Gold-Zari Abayas & Bishts',
    'فخامة وأصالة التراث العربي المعاصر بأقمشة ملكية فاخرة تناسب كافة الأعياد والاستقبالات.',
    'images/store_royal.jpg',
    'royal',
    'تسوق عبايات رويال',
    TRUE
),
(
    3, 'casual',
    'أطقم اللِنين العاجية والحرير الطبيعي',
    'Pure European Linen & Silk Co-ords',
    'إطلالات يومية ناعمة بقصات مريحة وباردة تمنحك الأناقة والانتعاش طوال اليوم.',
    'images/store_casual.jpg',
    'casual',
    'اكتشفي كاجوال نون',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 13.8 إعدادات وهوية المنصة الافتراضية
INSERT INTO public.platform_settings (id, logo_url, whatsapp, instagram, delivery_fee)
VALUES (1, 'images/logo.png', '9647835544744', '@noon.boutique', 5000)
ON CONFLICT (id) DO NOTHING;
