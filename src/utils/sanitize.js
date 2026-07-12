/**
 * HTML 内容安全净化器
 * 严格限制允许的 HTML 标签和属性，防止 XSS 攻击、脚本注入等安全威胁
 */

// 白名单：仅允许安全的排版和内容标签
const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'strong', 'b', 'em', 'i', 'u', 's', 'del',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
  'sub', 'sup', 'small', 'mark',
]);

// 白名单：仅允许安全的属性
const ALLOWED_ATTRS = new Set([
  'href', 'title', 'alt', 'src',
  'width', 'height',
  'class', 'id',
  'target', 'rel',
  'colspan', 'rowspan',
  'start', 'type',  // ol start/type
]);

// 危险的 URL 协议（用于 href 和 src）
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

// 危险的事件属性和其他危险属性前缀
const DANGEROUS_ATTR_PATTERNS = [
  /^on\w+/i,        // onclick, onerror, onload 等所有事件
  /^formaction$/i,
  /^formmethod$/i,
  /^xlink:href$/i,
  /^style$/i,       // 禁止内联样式（可包含 expression() 等）
  /^action$/i,
  /^formaction$/i,
];

// 自闭合标签
const VOID_TAGS = new Set(['br', 'hr', 'img']);

/**
 * 检查属性名是否危险
 */
function isDangerousAttr(attrName) {
  const lower = attrName.toLowerCase().trim();
  for (const pattern of DANGEROUS_ATTR_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

/**
 * 检查 URL 是否安全（用于 href 和 src）
 */
function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  // 检查危险协议
  if (DANGEROUS_PROTOCOLS.test(trimmed)) return '';
  // 检查 HTML 实体编码绕过（如 &#106;avascript）
  const decoded = decodeHTMLEntities(trimmed);
  if (DANGEROUS_PROTOCOLS.test(decoded)) return '';
  // 允许 http/https/mailto/相对路径
  if (/^(https?:|mailto:|ftp:|\.{0,2}\/|#)/i.test(decoded)) {
    return trimmed;
  }
  // 如果是以 // 开头的协议相对 URL，允许
  if (/^\/\//.test(decoded)) return trimmed;
  return '';
}

/**
 * 解码常见的 HTML 实体（用于检测绕过攻击）
 */
function decodeHTMLEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*58;?/gi, ':')
    .replace(/&#0*47;?/gi, '/')
    .replace(/&#x0*3A;?/gi, ':')
    .replace(/&#x0*2F;?/gi, '/');
}

/**
 * 转义 HTML 特殊字符（用于文本内容）
 */
function escapeHTML(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, c => map[c]);
}

/**
 * 解析属性字符串为键值对数组
 * 处理带引号和不带引号的属性值
 */
function parseAttributes(attrStr) {
  const attrs = [];
  const regex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))|([\w-]+)/gi;
  let match;
  while ((match = regex.exec(attrStr)) !== null) {
    if (match[1]) {
      const name = match[1].toLowerCase();
      const value = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : match[4]);
      attrs.push({ name, value });
    } else if (match[5]) {
      // 无值属性（如 disabled、checked 等），在 HTML5 中不常见，跳过
      const name = match[5].toLowerCase();
      attrs.push({ name, value: '' });
    }
  }
  return attrs;
}

/**
 * 净化 HTML 内容
 * @param {string} html - 原始 HTML 字符串
 * @returns {string} - 安全的 HTML 字符串
 */
export function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return '';

  let result = '';
  let pos = 0;

  // 标签匹配正则
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1] ? match[1].toLowerCase() : null;

    // 添加标签前的文本（已转义）
    if (pos < match.index) {
      const text = html.slice(pos, match.index);
      result += escapeHTML(text);
    }

    if (!tagName) {
      // 注释或 CDATA，直接跳过（不输出）
      pos = match.index + fullMatch.length;
      continue;
    }

    const isClosing = fullMatch.startsWith('</');
    const attrStr = match[2] || '';

    if (isClosing) {
      // 闭合标签：仅输出白名单内的标签
      if (ALLOWED_TAGS.has(tagName)) {
        result += `</${tagName}>`;
      }
    } else {
      // 开标签：检查白名单
      if (!ALLOWED_TAGS.has(tagName)) {
        // 不在白名单中，转义整个标签为文本
        result += escapeHTML(fullMatch);
        pos = match.index + fullMatch.length;
        continue;
      }

      // 解析并过滤属性
      const parsedAttrs = parseAttributes(attrStr);
      const safeAttrs = [];

      for (const attr of parsedAttrs) {
        if (isDangerousAttr(attr.name)) continue;
        if (!ALLOWED_ATTRS.has(attr.name)) continue;

        // 对 href 和 src 进行 URL 安全检查
        if (attr.name === 'href' || attr.name === 'src') {
          const safeUrl = sanitizeUrl(attr.value);
          if (!safeUrl) continue; // 危险的 URL，移除该属性
          safeAttrs.push(`${attr.name}="${escapeHTML(safeUrl)}"`);
        } else {
          safeAttrs.push(`${attr.name}="${escapeHTML(attr.value)}"`);
        }
      }

      // 对 a 标签强制添加安全属性
      if (tagName === 'a') {
        if (!safeAttrs.some(a => a.startsWith('rel='))) {
          safeAttrs.push('rel="noopener noreferrer"');
        }
        if (!safeAttrs.some(a => a.startsWith('target='))) {
          safeAttrs.push('target="_blank"');
        }
      }

      // 对 img 标签检查是否有 src（防止 XSS via img onerror）
      if (tagName === 'img') {
        const hasSrc = safeAttrs.some(a => a.startsWith('src='));
        if (!hasSrc) {
          // 没有有效 src 的 img 不安全（可能通过 onerror 触发），移除整个标签
          pos = match.index + fullMatch.length;
          continue;
        }
      }

      const attrStr2 = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
      if (VOID_TAGS.has(tagName)) {
        result += `<${tagName}${attrStr2} />`;
      } else {
        result += `<${tagName}${attrStr2}>`;
      }
    }

    pos = match.index + fullMatch.length;
  }

  // 添加剩余文本
  if (pos < html.length) {
    result += escapeHTML(html.slice(pos));
  }

  return result;
}

export default sanitizeHTML;
