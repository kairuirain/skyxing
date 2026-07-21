import { Hono } from 'hono';
import { kvGet, kvPut, PREFIX } from '../utils/kv.js';
import { authOptional, adminRequired } from '../middleware/rbac.js';

const feedback = new Hono();

const MAX_STORED = 500;
const VALID_TYPES = ['bug', 'suggestion', 'other'];

/**
 * 系统内提交反馈（需求：设置-反馈-提交反馈）
 * 登录用户或匿名均可提交；匿名需提供联系方式以便回访。
 */
feedback.post('/submit', authOptional, async (c) => {
  try {
    const user = c.get('user');
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: '请求格式错误' }, 400);
    }
    const type = VALID_TYPES.includes(body.type) ? body.type : 'other';
    const message = (body.message || '').toString().trim();
    if (!message) return c.json({ error: '反馈内容不能为空' }, 400);
    if (message.length > 2000) return c.json({ error: '反馈内容过长（最多 2000 字）' }, 400);
    const contact = (body.contact || '').toString().trim().slice(0, 200);

    const entry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      contact,
      userId: user?.id || null,
      username: user?.username || null,
      createdAt: new Date().toISOString(),
      status: 'new',
    };

    const all = (await kvGet(c.env, PREFIX.FEEDBACK)) || [];
    all.unshift(entry);
    await kvPut(c.env, PREFIX.FEEDBACK, all.slice(0, MAX_STORED));
    return c.json({ message: '反馈已提交，感谢你的支持！', id: entry.id });
  } catch (e) {
    return c.json({ error: '提交失败：' + (e.message || e) }, 500);
  }
});

/**
 * 管理员查看反馈列表
 */
feedback.get('/list', adminRequired, async (c) => {
  try {
    const all = (await kvGet(c.env, PREFIX.FEEDBACK)) || [];
    return c.json({ feedback: all });
  } catch (e) {
    return c.json({ error: '读取失败：' + (e.message || e) }, 500);
  }
});

/**
 * 管理员删除单条反馈
 */
feedback.delete('/:id', adminRequired, async (c) => {
  try {
    const id = c.req.param('id');
    const all = (await kvGet(c.env, PREFIX.FEEDBACK)) || [];
    const next = all.filter((f) => f.id !== id);
    await kvPut(c.env, PREFIX.FEEDBACK, next);
    return c.json({ message: '已删除', count: next.length });
  } catch (e) {
    return c.json({ error: '删除失败：' + (e.message || e) }, 500);
  }
});

export default feedback;
