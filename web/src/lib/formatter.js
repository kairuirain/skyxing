/** 文章标准化 */

function escHtml(t) {
  return t.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'})[c]);
}

export function standardizeContent(input) {
  if (!input) return '';
  let html = input.trim();
  const isHtml = /^\s*</.test(html);

  if (!isHtml) {
    const lines = html.split('\n');
    const out = [];
    let inList = false, listType = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
        continue;
      }
      const hM = line.match(/^#{1,6}\s+(.+)/);
      if (hM) {
        if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
        const lv = hM[0].startsWith('######') ? 6 : hM[0].startsWith('#####') ? 5 : hM[0].startsWith('####') ? 4 : hM[0].startsWith('###') ? 3 : hM[0].startsWith('##') ? 2 : 3;
        out.push(`<h${lv}>${escHtml(hM[1])}</h${lv}>`); continue;
      }
      const sM = line.match(/^[第第]?[一二三四五六七八九十\d]+[、\.]\s*(.+)/);
      if (sM && line.length < 30) {
        if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
        out.push(`<h2>${escHtml(line)}</h2>`); continue;
      }
      const subM = line.match(/^\d+\.\d+\s+(.+)/);
      if (subM || (line.endsWith('）') || line.endsWith(')')) && line.length < 25) {
        if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
        out.push(`<h3>${escHtml(line)}</h3>`); continue;
      }
      const uM = line.match(/^[-*]\s+(.+)/);
      if (uM) {
        if (!inList || listType !== 'ul') { if (inList) out.push('</ol>'); out.push('<ul>'); inList = true; listType = 'ul'; }
        out.push(`<li>${escHtml(uM[1])}</li>`); continue;
      }
      const oM = line.match(/^\d+[\.\、]\s+(.+)/);
      if (oM) {
        if (!inList || listType !== 'ol') { if (inList) out.push('</ul>'); out.push('<ol>'); inList = true; listType = 'ol'; }
        out.push(`<li>${escHtml(oM[1])}</li>`); continue;
      }
      const qM = line.match(/^>\s+(.+)/);
      if (qM) { if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; } out.push(`<blockquote>${escHtml(qM[1])}</blockquote>`); continue; }
      if (/^(-{3,}|\*{3,})$/.test(line)) { if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; } out.push('<hr />'); continue; }
      if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      out.push(`<p>${escHtml(line)}</p>`);
    }
    if (inList) out.push(listType === 'ul' ? '</ul>' : '</ol>');
    html = out.join('\n');
  } else {
    html = html.replace(/<h1\b[^>]*>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>')
      .replace(/<h[4-6]\b[^>]*>/gi, '<h3>').replace(/<\/h[4-6]>/gi, '</h3>')
      .replace(/([^>\n])\n{2,}(?!<)/g, '$1</p>\n<p>').replace(/\n{3,}/g, '\n\n').trim();
    if (!html.startsWith('<')) html = `<p>${html}</p>`;
  }
  return html;
}
