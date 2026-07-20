import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { detectOSLanguage, translate, DEFAULT_LANG } from '../lib/i18n';

const I18nContext = createContext(null);
const LANG_KEY = 'skyxing_lang';

function getStoredLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'zh' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }) {
  // 初始：显式选择 > 系统语言
  const [lang, setLangState] = useState(() => getStoredLang() || detectOSLanguage());

  const setLang = useCallback((l) => {
    if (l !== 'zh' && l !== 'en') return;
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  }, []);

  // 语言变化时更新 <html lang>
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const t = useCallback((key, vars) => translate(key, lang, vars), [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
