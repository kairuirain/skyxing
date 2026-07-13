/**
 * SkyXing 共享 HTML 净化器
 * 跨平台复用，防止 XSS 攻击
 */

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

const ALLOWED_ATTRS = new Set([
  'href', 'title', 'alt', 'src',
  'width', 'height',
  'class', 'id',
  'target', 'rel',
  'colspan', 'rowspan',
  'start', 'type',
]);

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;
const DANGEROUS_ATTR_PATTERNS = [
  /^on\w+/i, /^formaction$/i, /^formmethod$/i,
  /^xlink:href$/i, /^style$/i, /^action$/i,
];
const VOID_TAGS = new Set(['br', 'hr', 'img']);

function isDangerousAttr(name) {
  const lower = name.toLowerCase().trim();
  return DANGEROUS_ATTR_PATTERNS.some(p => p.test(lower));
}

function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (DANGEROUS_PROTOCOLS.test(trimmed)) return '';
  const decoded = decodeHTMLEntities(trimmed);
  if (DANGEROUS_PROTOCOLS.test(decoded)) return '';
  if (/^(https?:|mailto:|ftp:|\.{0,2}\/|#)/i.test(decoded)) return trimmed;
  if (/^\/\//.test(decoded)) return trimmed;
  return '';
}

function decodeHTMLEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0*58;?/gi, ':').replace(/&#0*47;?/gi, '/')
    .replace(/&#x0*3A;?/gi, ':').replace(/&#x0*2F;?/gi, '/');
}

function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

function parseAttributes(attrStr) {
  const attrs = [];
  const regex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))|([\w-]+)/gi;
  let match;
  while ((match = regex.exec(attrStr)) !== null) {
    if (match[1]) {
      attrs.push({
        name: match[1].toLowerCase(),
        value: match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : match[4])
      });
    } else if (match[5]) {
      attrs.push({ name: match[5].toLowerCase(), value: '' });
    }
  }
  return attrs;
}

export function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return '';

  let result = '';
  let pos = 0;
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1] ? match[1].toLowerCase() : null;

    if (pos < match.index) {
      result += escapeHTML(html.slice(pos, match.index));
    }

    if (!tagName) { pos = match.index + fullMatch.length; continue; }

    const isClosing = fullMatch.startsWith('</');
    const attrStr = match[2] || '';

    if (isClosing) {
      if (ALLOWED_TAGS.has(tagName)) result += `</${tagName}>`;
    } else {
      if (!ALLOWED_TAGS.has(tagName)) {
        result += escapeHTML(fullMatch);
        pos = match.index + fullMatch.length;
        continue;
      }
      const parsedAttrs = parseAttributes(attrStr);
      const safeAttrs = [];
      for (const attr of parsedAttrs) {
        if (isDangerousAttr(attr.name)) continue;
        if (!ALLOWED_ATTRS.has(attr.name)) continue;
        if (attr.name === 'href' || attr.name === 'src') {
          const safeUrl = sanitizeUrl(attr.value);
          if (!safeUrl) continue;
          safeAttrs.push(`${attr.name}="${escapeHTML(safeUrl)}"`);
        } else {
          safeAttrs.push(`${attr.name}="${escapeHTML(attr.value)}"`);
        }
      }
      if (tagName === 'a') {
        if (!safeAttrs.some(a => a.startsWith('rel='))) safeAttrs.push('rel="noopener noreferrer"');
        if (!safeAttrs.some(a => a.startsWith('target='))) safeAttrs.push('target="_blank"');
      }
      if (tagName === 'img') {
        if (!safeAttrs.some(a => a.startsWith('src='))) {
          pos = match.index + fullMatch.length;
          continue;
        }
      }
      const attrStr2 = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
      result += VOID_TAGS.has(tagName) ? `<${tagName}${attrStr2} />` : `<${tagName}${attrStr2}>`;
    }
    pos = match.index + fullMatch.length;
  }

  if (pos < html.length) result += escapeHTML(html.slice(pos));
  return result;
}

/**
 * 从 HTML 内容中提取纯文本摘要
 */
export function extractExcerpt(html, maxLength = 200) {
  if (!html || typeof html !== 'string') return '';
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

/**
 * 格式化日期为相对时间
 */
export function formatRelativeTime(dateStr) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

export default sanitizeHTML;
