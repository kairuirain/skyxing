/**
 * 轻量 Markdown → HTML 转换器
 * 支持常用语法，同时保留内嵌 HTML（透传不作处理）
 * 使用场景：文章编辑器 Markdown 编写 + HTML 内嵌
 */

// 转义 HTML 特殊字符
function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

/**
 * 将 Markdown 文本转换为 HTML
 * @param {string} md - Markdown 原始文本
 * @returns {string} - HTML 字符串
 */
export function markdownToHTML(md) {
  if (!md || typeof md !== 'string') return '';

  let html = md;

  // 1. 提取代码块（```...```），保护它们不被后续规则破坏
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHTML(code.trim())}</code></pre>`);
    return `\`\`\`CODEBLOCK_${idx}\`\`\``;
  });

  // 2. 提取行内代码（`...`）
  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHTML(code)}</code>`);
    return `\`INLINECODE_${idx}\``;
  });

  // 3. 分割成行处理
  const lines = html.split('\n');
  const result = [];
  let inParagraph = false;

  function closeParagraph() {
    if (inParagraph) { result.push('</p>'); inParagraph = false; }
  }

  function processInline(text) {
    if (!text) return '';
    // 恢复行内代码保护
    let t = text.replace(/`INLINECODE_(\d+)`/g, (_, idx) => inlineCodes[parseInt(idx)] || '');
    // 粗体 **text** 或 __text__
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // 斜体 *text* 或 _text_
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    t = t.replace(/_(.+?)_/g, '<em>$1</em>');
    // 删除线 ~~text~~
    t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // 链接 [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // 图片 ![alt](url)
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    return t;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      closeParagraph();
      continue;
    }

    // 保护代码块
    if (/^```CODEBLOCK_(\d+)```$/.test(trimmed)) {
      closeParagraph();
      result.push(codeBlocks[parseInt(RegExp.$1)]);
      continue;
    }

    // 水平线 --- 或 ***
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      closeParagraph();
      result.push('<hr />');
      continue;
    }

    // 标题 # ~ ######
    if (/^(#{1,6})\s+(.+)$/.test(trimmed)) {
      closeParagraph();
      const level = RegExp.$1.length;
      result.push(`<h${level}>${processInline(RegExp.$2)}</h${level}>`);
      continue;
    }

    // 引用 > text
    if (/^>\s+(.+)$/.test(trimmed)) {
      closeParagraph();
      result.push(`<blockquote>${processInline(RegExp.$1)}</blockquote>`);
      continue;
    }

    // 无序列表 - 或 * 开头
    if (/^[-*]\s+(.+)$/.test(trimmed)) {
      closeParagraph();
      result.push(`<li>${processInline(RegExp.$1)}</li>`);
      continue;
    }

    // 有序列表 1. 2. 开头
    if (/^\d+\.\s+(.+)$/.test(trimmed)) {
      closeParagraph();
      result.push(`<li>${processInline(RegExp.$1)}</li>`);
      continue;
    }

    // 普通段落
    if (!inParagraph) {
      result.push('<p>');
      inParagraph = true;
    } else {
      result.push('\n');
    }
    result.push(processInline(trimmed));
  }
  closeParagraph();

  // 合并无序列表
  const joined = result.join('');
  return joined
    .replace(/(<li>(?:.(?!<\/li>))*?<\/li>(\s*<li>.*?<\/li>)*)/g, '<ul>$1</ul>')
    .replace(/(<li>.*?<\/li>)/g, (m) => {
      // 确保所有li都被合适的ul包裹
      return m;
    });
}

/**
 * 将文章内容中的外部链接重写为跳转页链接
 * @param {string} html - 已处理的 HTML
 * @returns {string}
 */
export function rewriteExternalLinks(html) {
  if (!html) return '';
  // 替换所有 <a href="http..."> 为跳转页链接
  return html.replace(
    /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/gi,
    (match, before, url, after) => {
      return `<a ${before}href="/link?url=${encodeURIComponent(url)}"${after}>`;
    }
  );
}

/**
 * 检查内容是否以 HTML 标签开头（判断是 Markdown 还是 HTML）
 */
export function looksLikeHTML(content) {
  return /^\s*</.test(content);
}

/**
 * 一站式处理：将 Markdown/HTML 内容转换为安全的、链接经过重写的 HTML
 * 1. 如果是 Markdown 则转换
 * 2. 如已经 HTML 则透传
 * 3. 重写外部链接
 * 4. sanitize 安全过滤由调用方执行
 */
export function prepareArticleContent(content) {
  if (!content) return '';
  // 检测是否已经是 HTML（以 < 开头）
  const isHTML = looksLikeHTML(content);
  let html = isHTML ? content : markdownToHTML(content);
  // 重写外部链接
  html = rewriteExternalLinks(html);
  return html;
}
