/**
 * SkyXing - Cloudflare Workers 主入口
 * 用户系统 / 博客 / 文件分享 / 管理后台 / 双流中学 / 通知私信
 */
import { hashPassword, verifyPassword, signToken, createSecureCookie, extractToken, getClientIP, verifyToken } from './utils/auth.js';
import { getJSON, putJSON, getList, putList, getUser, putUser, prependToList, findInList, removeFromList } from './utils/kv.js';
import { Monitor, RetryCircuit, SelfHeal } from './core/monitor.js';
import { handleCaptchaGenerate, handleRegister, handleLogin, handleGetProfile, handleUpdateProfile, handleGetSecurity, handleSecurityVerify, handleChangePassword, handleChangeEmail, handle2FASetup, handle2FAVerify, handle2FAToggle, handleLogout } from './core/user-system.js';

const ROLE = { ADMIN: 'admin', FEATURE_ADMIN: 'feature_admin', USER: 'user' };
const FEATURES = { USERS:'users', BLOGS:'blogs', FILES:'files', SLZX:'slzx', NOTIFICATIONS:'notifs', MESSAGES:'messages', CONFIG:'config' };
const ADMIN_USERS = ['kairui2011120'];
const RATE_LIMITS = {
    login: { window:60000, max:10 }, register: { window:3600000, max:20 },
    blog_create: { window:60000, max:3 }, file_upload: { window:60000, max:10 },
    message_send: { window:60000, max:20 }, api_global: { window:10000, max:60 }
};

// ==================== 静态资源 ====================
async function serveAsset(request, env) {
    try { return await env.assets.fetch(request); }
    catch (e) { return new Response('Not Found', { status: 404 }); }
}

// ==================== 主入口 ====================
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/admin') {
            try {
                return await env.assets.fetch(new Request(url.origin + '/admin.html'));
            } catch (e) { return new Response('Not Found', { status: 404 }); }
        }

        if (path === '/user') {
            try {
                return await env.assets.fetch(new Request(url.origin + '/user.html'));
            } catch (e) { return new Response('Not Found', { status: 404 }); }
        }

        if (path === '/blog') {
            try {
                return await env.assets.fetch(new Request(url.origin + '/blog.html'));
            } catch (e) { return new Response('Not Found', { status: 404 }); }
        }

        if (path.startsWith('/api/')) {
            const rateCheck = await checkRateLimit(env, 'api_global', RATE_LIMITS.api_global.window, RATE_LIMITS.api_global.max);
            if (!rateCheck.allowed) return jsonResponse({ success: false, message: '请求过于频繁' }, 429, { 'Retry-After': String(rateCheck.retryAfter) });
            return handleAPI(request, env, ctx);
        }
        return serveAsset(request, env);
    },

    async scheduled(controller, env, ctx) {
        const m = Monitor.instance;
        m.info('Cron', '系统维护开始');
        try {
            await m.load(env);
            const healReport = await SelfHeal.run(env);
            m.info('Cron', '自愈完成', { fixed: healReport.fixed.length, skipped: healReport.skipped.length });
            await m.persist(env);
            m.info('Cron', '系统维护完成');
        } catch (err) { m.error('Cron', '维护失败: ' + err.message); }
    }
};

// ==================== API 路由 ====================
async function handleAPI(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
        // ── 验证码 ──
        if (path === '/api/captcha/generate' && method === 'GET') return handleCaptchaGenerate(request, env);

        // ── 用户系统 ──
        if (path === '/api/user/register' && method === 'POST') return handleRegister(request, env);
        if (path === '/api/user/login' && method === 'POST') return handleLogin(request, env);
        if (path === '/api/user/me' && method === 'GET') return handleGetProfile(request, env);
        if (path === '/api/user/logout' && method === 'POST') return handleLogout(request, env);
        if (path === '/api/user/update' && method === 'POST') return handleUpdateProfile(request, env);
        if (path === '/api/user/security' && method === 'GET') return handleGetSecurity(request, env);
        if (path === '/api/user/security-verify' && method === 'POST') return handleSecurityVerify(request, env);
        if (path === '/api/user/changepassword' && method === 'POST') return handleChangePassword(request, env);
        if (path === '/api/user/changeemail' && method === 'POST') return handleChangeEmail(request, env);
        if (path === '/api/user/2fa/setup' && method === 'POST') return handle2FASetup(request, env);
        if (path === '/api/user/2fa/verify' && method === 'POST') return handle2FAVerify(request, env);
        if (path === '/api/user/2fa/toggle' && method === 'POST') return handle2FAToggle(request, env);
        if (path === '/api/user/delete' && method === 'POST') return deleteUser(request, env);
        if (path === '/api/users/search' && method === 'GET') return searchUsers(request, env);

        // ── 博客 ──
        if (path === '/api/blog/create' && method === 'POST') return createBlog(request, env);
        if (path === '/api/blog/list' && method === 'GET') return listBlogs(request, env);
        if (path === '/api/blog/detail' && method === 'GET') return blogDetail(request, env);
        if (path === '/api/blog/update' && method === 'POST') return updateBlog(request, env);
        if (path === '/api/blog/delete' && method === 'POST') return deleteBlog(request, env);

        // ── 博客评论 ──
        if (path === '/api/blog/comments' && method === 'GET') return getComments(request, env);
        if (path === '/api/blog/comment' && method === 'POST') return addComment(request, env);
        if (path === '/api/blog/comment/delete' && method === 'POST') return deleteComment(request, env);

        // ── 文件分享 ──
        if (path === '/api/share/upload' && method === 'POST') return uploadFile(request, env);
        if (path === '/api/share/list' && method === 'GET') return listFiles(request, env);
        if (path === '/api/share/download' && method === 'GET') return downloadFile(request, env);
        if (path === '/api/share/delete' && method === 'POST') return deleteFile(request, env);

        // ── 管理员 ──
        if (path === '/api/admin/verify' && method === 'POST') return adminLogin(request, env);
        if (path === '/api/admin/config' && method === 'GET') return adminGetConfig(request, env);
        if (path === '/api/admin/config' && method === 'POST') return adminSaveConfig(request, env);
        if (path === '/api/admin/export' && method === 'GET') return adminExportData(request, env);
        if (path === '/api/admin/users' && method === 'GET') return adminGetUsers(request, env);
        if (path === '/api/admin/users/delete' && method === 'POST') return adminDeleteUser(request, env);
        if (path === '/api/admin/blogs' && method === 'GET') return adminGetBlogs(request, env);
        if (path === '/api/admin/blog/delete' && method === 'POST') return adminDeleteBlog(request, env);
        if (path === '/api/admin/files' && method === 'GET') return adminGetFiles(request, env);
        if (path === '/api/admin/file/delete' && method === 'POST') return adminDeleteFile(request, env);
        if (path === '/api/admin/users/logs' && method === 'GET') return adminGetLogs(request, env);
        if (path === '/api/admin/permissions/list' && method === 'GET') return adminGetPermissions(request, env);
        if (path === '/api/admin/permissions/set' && method === 'POST') return adminSetPermissions(request, env);
        if (path === '/api/admin/permissions/revoke' && method === 'POST') return adminRevokePermissions(request, env);
        if (path === '/api/admin/optimization/run' && method === 'POST') return adminRunOptimization(request, env);
        if (path === '/api/admin/optimization/log' && method === 'GET') return adminGetOptimizationLog(request, env);

        // ── 监控 & 自愈 ──
        if (path === '/api/admin/monitor/health' && method === 'GET') return monitorHealth(request, env);
        if (path === '/api/admin/monitor/circuits' && method === 'GET') return monitorCircuits(request, env);
        if (path === '/api/admin/selfheal/run' && method === 'POST') return selfHealRun(request, env);

        // ── 通知 ──
        if (path === '/api/notifications/list' && method === 'GET') return getNotifications(request, env);
        if (path === '/api/notifications/unread-count' && method === 'GET') return getUnreadCount(request, env);
        if (path === '/api/notifications/read' && method === 'POST') return markRead(request, env);
        if (path === '/api/notifications/read-all' && method === 'POST') return markAllRead(request, env);
        if (path === '/api/notifications/send' && method === 'POST') return sendNotification(request, env);
        if (path === '/api/notifications/delete' && method === 'POST') return deleteNotification(request, env);

        // ── 私信 ──
        if (path === '/api/messages/list' && method === 'GET') return getConversations(request, env);
        if (path === '/api/messages/conversation' && method === 'GET') return getMessages(request, env);
        if (path === '/api/messages/send' && method === 'POST') return sendMessage(request, env);
        if (path === '/api/messages/delete' && method === 'POST') return deleteConversation(request, env);
        if (path === '/api/admin/messages/list' && method === 'GET') return adminGetConversations(request, env);
        if (path === '/api/admin/messages/delete' && method === 'POST') return adminDeleteConversation(request, env);

        // ── 双流中学 ──
        if (path === '/api/slzx/content') return slzxGetContent(request, env);
        if (path === '/api/slzx/scores' && method === 'GET') return slzxGetScores(request, env);
        if (path === '/api/slzx/scores/excel' && method === 'POST') return slzxImportExcel(request, env);
        if (path === '/api/slzx/scores/delete' && method === 'POST') return slzxDeleteScore(request, env);
        if (path === '/api/slzx/scores/update' && method === 'POST') return slzxUpdateScore(request, env);
        if (path === '/api/slzx/duty' && method === 'GET') return slzxGetDuty(request, env);
        if (path === '/api/slzx/duty' && method === 'POST') return slzxSaveDuty(request, env);
        if (path === '/api/slzx/logs' && method === 'GET') return slzxGetLogs(request, env);
        if (path === '/api/slzx/logs' && method === 'POST') return slzxAddLog(request, env);

        return jsonResponse({ success: false, message: 'API not found' }, 404);
    } catch (e) {
        console.error('[API] Error:', e.message);
        return jsonResponse({ success: false, message: '服务器错误' }, 500);
    }
}

// ==================== 工具函数 ====================
function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
}

async function checkRateLimit(env, key, window, max) {
    const k = `rl:${key}:${Date.now() - Date.now() % window}`;
    const n = parseInt(await env.SkyXing.get(k) || '0') + 1;
    await env.SkyXing.put(k, String(n), { expirationTtl: Math.max(60, Math.ceil(window / 1000)) });
    return { allowed: n <= max, retryAfter: n > max ? Math.ceil(window / 1000) : 0 };
}

async function verifyUser(request, env) {
    const token = extractToken(request);
    if (!token) return null;
    // 无状态签名验证
    const payload = await verifyToken(token);
    if (payload) {
        const user = await getUser(env, payload.username);
        return user || null;
    }
    // 回退 KV 查找
    const username = await env.SkyXing.get(`token:${token}`);
    return username ? getUser(env, username) : null;
}

async function verifyFeatureAccess(request, env, feature) {
    const user = await verifyUser(request, env);
    if (!user) return { authorized: false, message: '请先登录' };
    if (user.role === ROLE.ADMIN) return { authorized: true, user, isGlobalAdmin: true };
    if (user.role === ROLE.FEATURE_ADMIN) {
        if (user.permissions && user.permissions.includes(feature)) return { authorized: true, user, isGlobalAdmin: false };
        return { authorized: false, message: '您没有此功能模块的管理权限' };
    }
    return { authorized: false, message: '需要管理员权限' };
}


// ==================== 用户系统 (旧兼容) ====================
async function deleteUser(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '未登录' }, 401);

    const { target } = await request.json();
    const targetName = target || user.username;
    if (user.role !== ROLE.ADMIN && user.username !== targetName)
        return jsonResponse({ success: false, message: '无权限' });

    if (targetName === user.username) {
        const token = extractToken(request);
        if (token) await env.SkyXing.delete(`token:${token}`);
    }
    await env.SkyXing.delete(`user:${targetName}`);
    return jsonResponse({ success: true, message: '账户已删除' });
}

async function searchUsers(request, env) {
    const q = new URL(request.url).searchParams.get('q') || '';
    const list = await env.SkyXing.list({ prefix: 'user:' });
    const results = [];
    for (const key of list.keys) {
        if (results.length >= 10) break;
        const name = key.name.substring(5);
        if (name.toLowerCase().includes(q.toLowerCase())) {
            const u = await getUser(env, name);
            if (u) results.push({ username: u.username, role: u.role, avatar: u.avatar });
        }
    }
    return jsonResponse({ success: true, users: results });
}

// ==================== 博客 ====================
async function createBlog(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const rc = await checkRateLimit(env, `blog:${user.username}`, RATE_LIMITS.blog_create.window, RATE_LIMITS.blog_create.max);
    if (!rc.allowed) return jsonResponse({ success: false, message: '发布太频繁' }, 429);

    const { title, content } = await request.json();
    if (!title || !content) return jsonResponse({ success: false, message: '标题和内容不能为空' });

    const blog = { id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6), title, content, author: user.username, createdAt: Date.now() };
    await prependToList(env, 'blogs', blog);
    return jsonResponse({ success: true, blog });
}

async function listBlogs(request, env) {
    const page = parseInt(new URL(request.url).searchParams.get('page') || '1');
    const blogs = await getList(env, 'blogs');
    const pSize = 10, start = (page - 1) * pSize;
    return jsonResponse({ success: true, blogs: blogs.slice(start, start + pSize), total: blogs.length, page, pageSize: pSize });
}

async function blogDetail(request, env) {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonResponse({ success: false, message: '缺少ID' });
    const found = await findInList(env, 'blogs', id);
    return found ? jsonResponse({ success: true, blog: found.item }) : jsonResponse({ success: false, message: '文章不存在' }, 404);
}

async function updateBlog(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const { id, title, content } = await request.json();
    const found = await findInList(env, 'blogs', id);
    if (!found) return jsonResponse({ success: false, message: '文章不存在' });
    if (user.role !== ROLE.ADMIN && found.item.author !== user.username) return jsonResponse({ success: false, message: '无权限' });

    found.item.title = title || found.item.title;
    found.item.content = content || found.item.content;
    found.item.updatedAt = Date.now();
    await putList(env, 'blogs', found.list);
    return jsonResponse({ success: true, blog: found.item });
}

async function deleteBlog(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const { id } = await request.json();
    const found = await findInList(env, 'blogs', id);
    if (!found) return jsonResponse({ success: false, message: '文章不存在' });
    if (user.role !== ROLE.ADMIN && found.item.author !== user.username) return jsonResponse({ success: false, message: '无权限' });

    found.list.splice(found.index, 1);
    await putList(env, 'blogs', found.list);
    return jsonResponse({ success: true, message: '已删除' });
}

// ==================== 评论系统 ====================
async function getComments(request, env) {
    const blogId = new URL(request.url).searchParams.get('id');
    if (!blogId) return jsonResponse({ success: false, message: '缺少文章ID' });
    const comments = await getJSON(env, `comments:${blogId}`, []);
    return jsonResponse({ success: true, comments });
}

async function addComment(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const { blogId, content } = await request.json();
    if (!blogId || !content) return jsonResponse({ success: false, message: '缺少参数' });
    if (content.length > 2000) return jsonResponse({ success: false, message: '评论内容过长' });

    const comment = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        blogId, content,
        author: user.username,
        createdAt: Date.now()
    };

    const comments = await getJSON(env, `comments:${blogId}`, []);
    comments.push(comment);
    if (comments.length > 500) comments.splice(0, comments.length - 500);
    await putJSON(env, `comments:${blogId}`, comments);

    return jsonResponse({ success: true, comment });
}

async function deleteComment(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const { blogId, commentId } = await request.json();
    const comments = await getJSON(env, `comments:${blogId}`, []);
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx === -1) return jsonResponse({ success: false, message: '评论不存在' });

    if (user.role !== ROLE.ADMIN && comments[idx].author !== user.username)
        return jsonResponse({ success: false, message: '无权限' });

    comments.splice(idx, 1);
    await putJSON(env, `comments:${blogId}`, comments);
    return jsonResponse({ success: true, message: '已删除' });
}

// ==================== 文件分享 ====================
async function uploadFile(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const rc = await checkRateLimit(env, `upload:${user.username}`, RATE_LIMITS.file_upload.window, RATE_LIMITS.file_upload.max);
    if (!rc.allowed) return jsonResponse({ success: false, message: '上传太频繁' }, 429);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return jsonResponse({ success: false, message: '未选择文件' });

    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const arrayBuffer = await file.arrayBuffer();
    const binary = String.fromCharCode(...new Uint8Array(arrayBuffer));

    const fileInfo = { id, name: file.name, type: file.type, size: file.size, uploader: user.username, downloads: 0, createdAt: Date.now(), storage: 'kv' };
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        fileInfo.storage = 'r2';
        return jsonResponse({ success: false, message: '大文件暂不支持' });
    }
    await env.SkyXing.put(`file:${id}`, btoa(binary));
    await prependToList(env, 'files', fileInfo);
    return jsonResponse({ success: true, file: { id, name: file.name, size: file.size } });
}

async function listFiles(request, env) {
    const files = await getList(env, 'files');
    return jsonResponse({ success: true, files });
}

async function downloadFile(request, env) {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonResponse({ success: false, message: '缺少ID' });

    const found = await findInList(env, 'files', id);
    if (!found) return jsonResponse({ success: false, message: '文件不存在' }, 404);

    found.item.downloads = (found.item.downloads || 0) + 1;
    found.list[found.index] = found.item;
    await putList(env, 'files', found.list);

    const base64 = await env.SkyXing.get(`file:${id}`);
    if (!base64) return jsonResponse({ success: false, message: '文件数据丢失' }, 404);

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return new Response(bytes, {
        headers: {
            'Content-Type': found.item.type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(found.item.name)}"`
        }
    });
}

async function deleteFile(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const { id } = await request.json();
    const found = await findInList(env, 'files', id);
    if (!found) return jsonResponse({ success: false, message: '文件不存在' });
    if (user.role !== ROLE.ADMIN && found.item.uploader !== user.username) return jsonResponse({ success: false, message: '无权限' });

    await env.SkyXing.delete(`file:${id}`);
    found.list.splice(found.index, 1);
    await putList(env, 'files', found.list);
    return jsonResponse({ success: true, message: '已删除' });
}

// ==================== 管理员 ====================
async function adminLogin(request, env) {
    const rc = await checkRateLimit(env, 'login', RATE_LIMITS.login.window, RATE_LIMITS.login.max);
    if (!rc.allowed) return jsonResponse({ success: false, message: '尝试过多' }, 429);

    const { username, password } = await request.json();
    if (!username || !password) return jsonResponse({ success: false, message: '请填写完整信息' });

    const user = await getUser(env, username);
    if (!user) return jsonResponse({ success: false, message: '用户不存在' });

    let valid = false;
    if (typeof user.password === 'string') valid = user.password === password;
    else if (user.passwordHash) valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!valid) return jsonResponse({ success: false, message: '密码错误' });

    if (user.role !== ROLE.ADMIN && user.role !== ROLE.FEATURE_ADMIN)
        return jsonResponse({ success: false, message: '您没有管理员权限' });

    const token = await signToken(username, Date.now());
    await env.SkyXing.put(`token:${token}`, username);

    return new Response(JSON.stringify({ success: true, token, redirect: '/admin' }), {
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': createSecureCookie('auth_token', token) }
    });
}

async function adminGetConfig(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.CONFIG);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    return jsonResponse({ success: true, config: await getJSON(env, 'site_config', {}) });
}

async function adminSaveConfig(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.CONFIG);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);

    const data = await request.json();
    const config = await getJSON(env, 'site_config', {});
    Object.assign(config, data);
    await putJSON(env, 'site_config', config);
    return jsonResponse({ success: true, message: '配置已保存' });
}

async function adminExportData(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.CONFIG);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);

    const users = await getJSON(env, 'users', []);
    const blogs = await getList(env, 'blogs');
    const files = await getList(env, 'files');
    const config = await getJSON(env, 'site_config', {});
    return jsonResponse({ success: true, data: { users, blogs, files, config } });
}

async function adminGetUsers(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);

    const list = await env.SkyXing.list({ prefix: 'user:' });
    const users = [];
    for (const k of list.keys) {
        const u = await getUser(env, k.name.substring(5));
        if (u) users.push(u);
    }
    return jsonResponse({ success: true, users });
}

async function adminDeleteUser(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);

    const { username } = await request.json();
    if (ADMIN_USERS.includes(username)) return jsonResponse({ success: false, message: '不能删除全局管理员' });
    await env.SkyXing.delete(`user:${username}`);
    return jsonResponse({ success: true, message: '用户已删除' });
}

async function adminGetBlogs(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.BLOGS);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    return jsonResponse({ success: true, blogs: await getList(env, 'blogs') });
}

async function adminDeleteBlog(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.BLOGS);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    return deleteBlog(request, env);
}

async function adminGetFiles(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.FILES);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    return jsonResponse({ success: true, files: await getList(env, 'files') });
}

async function adminDeleteFile(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.FILES);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    return deleteFile(request, env);
}

async function adminGetLogs(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.USERS);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    return jsonResponse({ success: true, logs: await getJSON(env, 'activity_log', []) });
}

async function adminGetPermissions(request, env) {
    if (!check.isGlobalAdmin && !check.authorized) {
        const check2 = await verifyFeatureAccess(request, env, FEATURES.USERS);
        if (!check2.authorized) return jsonResponse({ success: false, message: check2.message }, 401);
        if (!check2.isGlobalAdmin) return jsonResponse({ success: false, message: '仅全局管理员可管理权限' }, 403);
    }
    const list = await env.SkyXing.list({ prefix: 'user:' });
    const users = [];
    for (const k of list.keys) {
        const u = await getUser(env, k.name.substring(5));
        if (u && u.role === ROLE.FEATURE_ADMIN) users.push({ username: u.username, role: u.role, permissions: u.permissions || [] });
    }
    return jsonResponse({ success: true, featureAdmins: users });
}

async function adminSetPermissions(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role !== ROLE.ADMIN) return jsonResponse({ success: false, message: '仅全局管理员可操作' }, 403);

    const { username, permissions } = await request.json();
    const target = await getUser(env, username);
    if (!target) return jsonResponse({ success: false, message: '用户不存在' });
    target.role = ROLE.FEATURE_ADMIN;
    target.permissions = permissions || [];
    await putUser(env, username, target);
    return jsonResponse({ success: true, message: '权限已更新' });
}

async function adminRevokePermissions(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role !== ROLE.ADMIN) return jsonResponse({ success: false, message: '仅全局管理员可操作' }, 403);

    const { username } = await request.json();
    const target = await getUser(env, username);
    if (!target) return jsonResponse({ success: false, message: '用户不存在' });
    target.role = ROLE.USER;
    target.permissions = [];
    await putUser(env, username, target);
    return jsonResponse({ success: true, message: '权限已撤销' });
}

async function adminRunOptimization(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role !== ROLE.ADMIN) return jsonResponse({ success: false, message: '仅全局管理员可操作' }, 403);

    const report = await compactOversizedLists(env);
    const logEntry = { time: Date.now(), report };
    const logs = await getJSON(env, 'optimization_log', []);
    logs.unshift(logEntry);
    if (logs.length > 50) logs.length = 50;
    await putJSON(env, 'optimization_log', logs);
    return jsonResponse({ success: true, report });
}

async function adminGetOptimizationLog(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role !== ROLE.ADMIN) return jsonResponse({ success: false, message: '仅全局管理员可操作' }, 403);
    return jsonResponse({ success: true, logs: await getJSON(env, 'optimization_log', []) });
}

async function compactOversizedLists(env) {
    const report = {};
    for (const key of ['blogs', 'files']) {
        const list = await getList(env, key);
        if (list.length > 500) {
            const trimmed = list.slice(0, 500);
            await putList(env, key, trimmed);
            report[key] = { before: list.length, after: 500, removed: list.length - 500 };
        }
    }
    return report;
}

// ==================== 通知系统 ====================
async function getNotifications(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);
    const notifs = await getJSON(env, `notif:${user.username}`, []);
    return jsonResponse({ success: true, notifications: notifs });
}

async function getUnreadCount(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, unread: 0 });
    const notifs = await getJSON(env, `notif:${user.username}`, []);
    return jsonResponse({ success: true, unread: notifs.filter(n => !n.read).length });
}

async function markRead(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);
    const { id } = await request.json();
    const notifs = await getJSON(env, `notif:${user.username}`, []);
    const n = notifs.find(x => x.id === id);
    if (n) { n.read = true; await putJSON(env, `notif:${user.username}`, notifs); }
    return jsonResponse({ success: true });
}

async function markAllRead(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);
    const notifs = await getJSON(env, `notif:${user.username}`, []);
    notifs.forEach(n => n.read = true);
    await putJSON(env, `notif:${user.username}`, notifs);
    return jsonResponse({ success: true });
}

async function sendNotification(request, env) {
    const user = await verifyUser(request, env);
    if (!user || (user.role !== ROLE.ADMIN && user.role !== ROLE.FEATURE_ADMIN))
        return jsonResponse({ success: false, message: '无权限发送通知' }, 403);

    const { target, title, content } = await request.json();
    if (!target || !title) return jsonResponse({ success: false, message: '缺少参数' });

    const targets = target === 'all' ? [] : target.split(',');
    if (target === 'all') {
        const list = await env.SkyXing.list({ prefix: 'user:' });
        for (const k of list.keys) targets.push(k.name.substring(5));
    }

    const notif = { id: Date.now().toString(36) + Math.random().toString(36).substring(2, 4), title, content: content || '', from: user.username, read: false, createdAt: Date.now() };
    for (const t of targets) {
        const notifs = await getJSON(env, `notif:${t}`, []);
        notifs.unshift({ ...notif });
        if (notifs.length > 100) notifs.length = 100;
        await putJSON(env, `notif:${t}`, notifs);
    }
    return jsonResponse({ success: true, message: `已通知 ${targets.length} 人` });
}

async function deleteNotification(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);
    const { id } = await request.json();
    const notifs = await getJSON(env, `notif:${user.username}`, []);
    await putJSON(env, `notif:${user.username}`, notifs.filter(n => n.id !== id));
    return jsonResponse({ success: true });
}

// ==================== 私信系统 ====================
async function getConversations(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);
    const convs = await getJSON(env, `conv:${user.username}`, []);
    return jsonResponse({ success: true, conversations: convs });
}

async function getMessages(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);
    const withUser = new URL(request.url).searchParams.get('with');
    if (!withUser) return jsonResponse({ success: false, message: '缺少参数' });

    const msgs = await getJSON(env, `msg:${user.username}:${withUser}`, []);
    // 标记已读
    let changed = false;
    for (const m of msgs) { if (m.to === user.username && !m.read) { m.read = true; changed = true; } }
    if (changed) await putJSON(env, `msg:${user.username}:${withUser}`, msgs);
    return jsonResponse({ success: true, messages: msgs });
}

async function sendMessage(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);

    const rc = await checkRateLimit(env, `msg:${user.username}`, RATE_LIMITS.message_send.window, RATE_LIMITS.message_send.max);
    if (!rc.allowed) return jsonResponse({ success: false, message: '发送太频繁' }, 429);

    const { to, content } = await request.json();
    if (!to || !content) return jsonResponse({ success: false, message: '缺少参数' });
    if (!(await getUser(env, to))) return jsonResponse({ success: false, message: '收件人不存在' });

    const msg = { id: Date.now().toString(36), from: user.username, to, content, read: false, createdAt: Date.now() };

    // 存储双方对话
    for (const participant of [user.username, to]) {
        const other = participant === user.username ? to : user.username;
        const msgs = await getJSON(env, `msg:${participant}:${other}`, []);
        msgs.push(msg);
        if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
        await putJSON(env, `msg:${participant}:${other}`, msgs);

        // 更新对话列表
        const convs = await getJSON(env, `conv:${participant}`, []);
        const idx = convs.findIndex(c => c.with === other);
        if (idx >= 0) convs.splice(idx, 1);
        convs.unshift({ with: other, lastMessage: content.substring(0, 50), time: Date.now(), unread: participant === to ? 1 : 0 });
        if (convs.length > 50) convs.length = 50;
        await putJSON(env, `conv:${participant}`, convs);
    }

    return jsonResponse({ success: true, message: msg });
}

async function deleteConversation(request, env) {
    const user = await verifyUser(request, env);
    if (!user) return jsonResponse({ success: false, message: '请先登录' }, 401);
    const { withUser } = await request.json();

    await env.SkyXing.delete(`msg:${user.username}:${withUser}`);
    const convs = await getJSON(env, `conv:${user.username}`, []);
    await putJSON(env, `conv:${user.username}`, convs.filter(c => c.with !== withUser));
    return jsonResponse({ success: true });
}

async function adminGetConversations(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.MESSAGES);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    return jsonResponse({ success: true, conversations: [] });
}

async function adminDeleteConversation(request, env) {
    const check = await verifyFeatureAccess(request, env, FEATURES.MESSAGES);
    if (!check.authorized) return jsonResponse({ success: false, message: check.message }, 401);
    const { username } = await request.json();
    const list = await env.SkyXing.list({ prefix: `msg:${username}:` });
    for (const k of list.keys) await env.SkyXing.delete(k.name);
    await env.SkyXing.delete(`conv:${username}`);
    return jsonResponse({ success: true, message: `已清除 ${username} 的私信` });
}

// ==================== 双流中学 ====================
async function slzxGetContent(request, env) {
    const content = await getJSON(env, 'slzx_content', {});
    return jsonResponse({ success: true, content });
}

async function slzxGetScores(request, env) {
    const scores = await getJSON(env, 'slzx_scores', []);
    const q = new URL(request.url).searchParams;
    const name = q.get('name'), cls = q.get('class');
    let result = scores;
    if (name) result = result.filter(s => s.name.includes(name));
    if (cls) result = result.filter(s => s.className === cls);
    return jsonResponse({ success: true, scores: result, total: scores.length });
}

async function slzxImportExcel(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role === ROLE.USER) return jsonResponse({ success: false, message: '需要管理员权限' }, 403);

    const { data } = await request.json();
    if (!data || !Array.isArray(data)) return jsonResponse({ success: false, message: '数据格式错误' });

    const scores = await getJSON(env, 'slzx_scores', []);
    const now = Date.now();
    for (const row of data) {
        scores.push({
            id: now.toString(36) + Math.random().toString(36).substring(2, 5),
            name: row.name || '', className: row.className || '',
            score: parseInt(row.score) || 0, category: row.category || '操行分',
            reason: row.reason || '', createdAt: now
        });
    }
    await putJSON(env, 'slzx_scores', scores);

    // 日志
    const logs = await getJSON(env, 'slzx_logs', []);
    logs.unshift({ id: now.toString(36), action: 'import', user: user.username, count: data.length, time: now });
    if (logs.length > 100) logs.length = 100;
    await putJSON(env, 'slzx_logs', logs);

    return jsonResponse({ success: true, message: `导入 ${data.length} 条记录`, total: scores.length });
}

async function slzxDeleteScore(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role === ROLE.USER) return jsonResponse({ success: false, message: '需要管理员权限' }, 403);

    const { id } = await request.json();
    const scores = await getJSON(env, 'slzx_scores', []);
    const idx = scores.findIndex(s => s.id === id);
    if (idx === -1) return jsonResponse({ success: false, message: '记录不存在' });
    scores.splice(idx, 1);
    await putJSON(env, 'slzx_scores', scores);
    return jsonResponse({ success: true, message: '已删除' });
}

async function slzxUpdateScore(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role === ROLE.USER) return jsonResponse({ success: false, message: '需要管理员权限' }, 403);

    const { id, data } = await request.json();
    const scores = await getJSON(env, 'slzx_scores', []);
    const s = scores.find(x => x.id === id);
    if (!s) return jsonResponse({ success: false, message: '记录不存在' });
    Object.assign(s, data);
    await putJSON(env, 'slzx_scores', scores);
    return jsonResponse({ success: true, message: '已更新' });
}

async function slzxGetDuty(request, env) {
    const duty = await getJSON(env, 'slzx_duty', []);
    return jsonResponse({ success: true, duty });
}

async function slzxSaveDuty(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role === ROLE.USER) return jsonResponse({ success: false, message: '需要管理员权限' }, 403);
    const { duty } = await request.json();
    await putJSON(env, 'slzx_duty', duty || []);
    return jsonResponse({ success: true, message: '已保存' });
}

async function slzxGetLogs(request, env) {
    const logs = await getJSON(env, 'slzx_logs', []);
    return jsonResponse({ success: true, logs });
}

async function slzxAddLog(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role === ROLE.USER) return jsonResponse({ success: false, message: '需要管理员权限' }, 403);
    const { action, detail } = await request.json();
    const logs = await getJSON(env, 'slzx_logs', []);
    logs.unshift({ id: Date.now().toString(36), action: action || 'manual', user: user.username, detail, time: Date.now() });
    if (logs.length > 100) logs.length = 100;
    await putJSON(env, 'slzx_logs', logs);
    return jsonResponse({ success: true });
}

// ==================== 监控 & 自愈 ====================
async function monitorHealth(request, env) {
    const user = await verifyUser(request, env);
    if (!user || (user.role !== ROLE.ADMIN && user.role !== ROLE.FEATURE_ADMIN))
        return jsonResponse({ success: false, message: '需要管理员权限' }, 403);

    const m = Monitor.instance;
    await m.load(env);
    const health = m.getHealth();
    const page = parseInt(new URL(request.url).searchParams.get('page') || '1');
    const pSize = 50;
    const allLogs = m.logs.slice().reverse();
    const logsPage = allLogs.slice((page - 1) * pSize, page * pSize);

    return jsonResponse({
        success: true,
        health,
        logs: logsPage,
        logPage: page,
        logTotal: allLogs.length,
        logPageSize: pSize
    });
}

async function monitorCircuits(request, env) {
    const user = await verifyUser(request, env);
    if (!user || (user.role !== ROLE.ADMIN && user.role !== ROLE.FEATURE_ADMIN))
        return jsonResponse({ success: false, message: '需要管理员权限' }, 403);

    return jsonResponse({
        success: true,
        circuits: RetryCircuit.getAllStates(),
        kvWraps: {} // 预留：KV 包装状态
    });
}

async function selfHealRun(request, env) {
    const user = await verifyUser(request, env);
    if (!user || user.role !== ROLE.ADMIN)
        return jsonResponse({ success: false, message: '仅全局管理员可执行' }, 403);

    const m = Monitor.instance;
    m.info('SelfHeal', '管理员手动触发自愈');
    const report = await SelfHeal.run(env);
    await m.persist(env);
    m.info('SelfHeal', '自愈完成', { fixed: report.fixed.length, skipped: report.skipped.length });

    return jsonResponse({ success: true, report });
}
