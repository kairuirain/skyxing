/**
 * 多语言支持（需求 1）
 * 默认跟随操作系统语言，不支持时降级英文；支持中/英手动切换并持久化。
 */

export const SUPPORTED_LANGS = ['zh', 'en'];
export const DEFAULT_LANG = 'zh';

export function detectOSLanguage() {
  if (typeof navigator === 'undefined') return DEFAULT_LANG;
  const lang = (navigator.language || navigator.languages?.[0] || DEFAULT_LANG).toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

// 翻译字典：扁平 key，zh 为基座，en 缺失时回退 zh
const dict = {
  zh: {
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.loading': '加载中...',
    'common.delete': '删除',
    'common.ok': '好的',
    'nav.home': '主页',
    'nav.blog': '博客',
    'nav.messages': '私信',
    'nav.download': '下载',
    'nav.me': '我的',
    'nav.write': '写文章',
    'auth.login': '登录',
    'auth.register': '注册',
    'auth.loginTitle': '登录 SkyXing',
    'auth.registerTitle': '注册 SkyXing',
    'auth.username': '用户名',
    'auth.email': '邮箱',
    'auth.displayName': '显示名称',
    'auth.password': '密码',
    'auth.confirmPassword': '确认密码',
    'auth.agreeRequired': '请先阅读并同意《SkyXing 隐私政策》与《SkyXing 服务条款》',
    'auth.privacy': '《SkyXing 隐私政策》',
    'auth.terms': '《SkyXing 服务条款》',
    'auth.agreed': '我已阅读并同意',
    'settings.title': '设置',
    'settings.subtitle': '外观、安全与账号管理',
    'settings.appearance': '外观',
    'settings.language': '语言',
    'settings.animation': '动画模式',
    'settings.anim.minimal': '普通模式',
    'settings.anim.normal': '一般模式',
    'settings.anim.rich': '高级模式',
    'settings.theme': '主题',
    'settings.light': '浅色',
    'settings.dark': '深色',
    'settings.security': '安全',
    'settings.twoFactor': '2FA 双重验证',
    'settings.twoFactorDesc': '登录时需额外输入动态验证码',
    'settings.debug': '调试',
    'settings.debugDesc': '账户诊断信息',
    'settings.debugToggle': '调试日志记录',
    'settings.sync': '数据同步',
    'settings.syncDesc': '跨设备保持一致',
    'settings.syncNow': '同步数据',
    'settings.syncDone': '已同步',
    'settings.health': '服务状态检测',
    'settings.healthDesc': '检测 API 与后端服务运行状态',
    'settings.account': '账号管理',
    'settings.deleteAccount': '注销账号',
    'settings.turnstile': '请完成人机验证',
    'common.retry': '重试',
  },
  en: {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.delete': 'Delete',
    'common.ok': 'OK',
    'nav.home': 'Home',
    'nav.blog': 'Blog',
    'nav.messages': 'Messages',
    'nav.download': 'Download',
    'nav.me': 'Me',
    'nav.write': 'Write',
    'auth.login': 'Log In',
    'auth.register': 'Sign Up',
    'auth.loginTitle': 'Log in to SkyXing',
    'auth.registerTitle': 'Sign up for SkyXing',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.displayName': 'Display name',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm password',
    'auth.agreeRequired': 'Please read and agree to the SkyXing Privacy Policy and Terms of Service',
    'auth.privacy': 'SkyXing Privacy Policy',
    'auth.terms': 'SkyXing Terms of Service',
    'auth.agreed': 'I have read and agree to',
    'settings.title': 'Settings',
    'settings.subtitle': 'Appearance, security and account',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.animation': 'Animation mode',
    'settings.anim.minimal': 'Minimal',
    'settings.anim.normal': 'Normal',
    'settings.anim.rich': 'Rich',
    'settings.theme': 'Theme',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.security': 'Security',
    'settings.twoFactor': '2FA',
    'settings.twoFactorDesc': 'Require a one-time code at login',
    'settings.debug': 'Diagnostics',
    'settings.debugDesc': 'Account diagnostic info',
    'settings.debugToggle': 'Debug logging',
    'settings.sync': 'Data sync',
    'settings.syncDesc': 'Stay consistent across devices',
    'settings.syncNow': 'Sync now',
    'settings.syncDone': 'Synced',
    'settings.health': 'Service status',
    'settings.healthDesc': 'Check API and backend health',
    'settings.account': 'Account',
    'settings.deleteAccount': 'Delete account',
    'settings.turnstile': 'Please complete the human verification',
    'common.retry': 'Retry',
  },
};

/**
 * 翻译函数
 * @param {string} key 扁平 key
 * @param {string} lang 'zh' | 'en'
 * @param {object} [vars] 占位符替换 {name}
 */
export function translate(key, lang, vars) {
  const table = dict[lang] || dict[DEFAULT_LANG];
  let str = table[key];
  if (str === undefined) str = dict[DEFAULT_LANG][key] !== undefined ? dict[DEFAULT_LANG][key] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return str;
}
