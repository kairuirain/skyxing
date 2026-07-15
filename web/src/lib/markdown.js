/**
 * 轻量 Markdown → HTML 转换器
 * 支持常用语法，同时保留内嵌 HTML（透传不作处理）
 */

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };

function esc(t) { return t.replace(/[&<>"']/g, c => HTML_ESCAPE[c]); }

function mdToHtml(md) {
  if (!md || typeof md !== 'string') return '';
  let h = md;

  // 保护代码块
  const cbs = [];
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, l, c) => {
    const i = cbs.length;
    cbs.push(`<pre><code${l ? ` class="language-${l}"` : ''}>${esc(c.trim())}</code></pre>`);
    return `\x00CB${i}\x00`;
  });

  // 保护行内代码
  const ics = [];
  h = h.replace(/`([^`]+)`/g, (_, c) => {
    const i = ics.length;
    ics.push(`<code>${esc(c)}</code>`);
    return `\x00IC${i}\x00`;
  });

  // 行内样式处理
  function il(t) {
    if (!t) return '';
    let r = t.replace(/\x00IC(\d+)\x00/g, (_, i) => ics[+i] || '');
    r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    r = r.replace(/~~(.+?)~~/g, '<del>$1</del>');
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    return r;
  }

  const lines = h.split('\n');
  const out = [];
  let inP = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) { if (inP) { out.push('</p>'); inP = false; } continue; }

    const cbMatch = t.match(/^\x00CB(\d+)\x00$/);
    if (cbMatch) { if (inP) { out.push('</p>'); inP = false; } out.push(cbs[+cbMatch[1]]); continue; }

    if (/^(-{3,}|\*{3,})$/.test(t)) { if (inP) { out.push('</p>'); inP = false; } out.push('<hr />'); continue; }

    const hMatch = t.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) { if (inP) { out.push('</p>'); inP = false; } out.push(`<h${hMatch[1].length}>${il(hMatch[2])}</h${hMatch[1].length}>`); continue; }

    const qMatch = t.match(/^>\s+(.+)$/);
    if (qMatch) { if (inP) { out.push('</p>'); inP = false; } out.push(`<blockquote>${il(qMatch[1])}</blockquote>`); continue; }

    const lMatch = t.match(/^[-*]\s+(.+)$/);
    if (lMatch) { if (inP) { out.push('</p>'); inP = false; } out.push(`<li>${il(lMatch[1])}</li>`); continue; }
    const oMatch = t.match(/^\d+\.\s+(.+)$/);
    if (oMatch) { if (inP) { out.push('</p>'); inP = false; } out.push(`<li>${il(oMatch[1])}</li>`); continue; }

    if (!inP) { out.push('<p>'); inP = true; } else { out.push('\n'); }
    out.push(il(t));
  }
  if (inP) out.push('</p>');

  let html = out.join('');
  html = html.replace(/((?:<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*))/g, '<ul>$1</ul>');
  return html;
}

function rewriteLinks(html) {
  if (!html) return '';
  return html.replace(
    /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/gi,
    (_, b, u, a) => `<a ${b}href="/link?url=${encodeURIComponent(u)}"${a}>`
  );
}

function looksLikeHTML(c) { return /^\s*</.test(c); }

export function prepareArticleContent(content) {
  if (!content) return '';
  return rewriteLinks(looksLikeHTML(content) ? content : mdToHtml(content));
}
