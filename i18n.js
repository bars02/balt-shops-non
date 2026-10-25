import { translations } from './data.js';

class I18n {
  constructor() {
    this.currentLang = localStorage.getItem('noon_lang') || 'ar';
    this.init();
  }

  init() {
    this.applyLanguage(this.currentLang);
  }

  applyLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('noon_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    document.body.classList.toggle('lang-ar', lang === 'ar');
    document.body.classList.toggle('lang-en', lang === 'en');

    // Update document title
    document.title = lang === 'ar' ? 'متجر نون | Shop Noon' : 'NOON | Shop Noon';

    // Update static translations
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang] && translations[lang][key]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = translations[lang][key];
        } else {
          el.innerText = translations[lang][key];
        }
      }
    });

    // Update manual switchers
    const switchers = document.querySelectorAll('.lang-toggle-text');
    switchers.forEach(s => {
        s.innerText = lang === 'en' ? 'العربية' : 'English';
    });
  }

  toggleLanguage() {
    const newLang = this.currentLang === 'en' ? 'ar' : 'en';
    this.applyLanguage(newLang);
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: newLang } }));
  }
}

export const i18n = new I18n();
