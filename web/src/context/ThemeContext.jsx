import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const THEME_KEY = 'theme';
const THEME_SET_KEY = 'theme_set'; // 标记用户是否“显式”选择过主题，避免自动默认值锁死偏好

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 3600 * 1000);
  document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/`;
}

function getLoose(name) {
  try { return localStorage.getItem(name); } catch (e) { return null; }
}

// 解析已存储的主题：
// - 'dark' 始终信任（含旧版遗留），保留用户的深色意图；
// - 'light' 仅在用户“显式”设置过（存在 theme_set 标记）时才信任，
//   否则视为“未设置”，交由系统偏好决定，避免旧版本自动写入的 light 锁死深色。
function getStoredTheme() {
  const cookieTheme = getCookie(THEME_KEY);
  const lsTheme = getLoose(THEME_KEY);
  const mark = getCookie(THEME_SET_KEY) || getLoose(THEME_SET_KEY);
  const stored = cookieTheme || lsTheme;
  if (!stored) return null;
  if (stored === 'dark') return 'dark';
  if (stored === 'light' && mark) return 'light';
  return null;
}

function getInitialTheme() {
  const stored = getStoredTheme();
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function persistTheme(t) {
  setCookie(THEME_KEY, t);
  setCookie(THEME_SET_KEY, '1');
  try {
    localStorage.setItem(THEME_KEY, t);
    localStorage.setItem(THEME_SET_KEY, '1');
  } catch (e) {}
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  // 仅根据当前主题切换 <html> 上的 dark 类；持久化由 setTheme/toggleTheme 显式触发
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const setTheme = (t) => {
    if (t === 'light' || t === 'dark') {
      setThemeState(t);
      persistTheme(t);
    }
  };
  const toggleTheme = () =>
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      return next;
    });

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
