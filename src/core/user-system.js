/**
 * 用户系统核心模块
 * 注册 / 登录 / 个人资料 / 安全信息 / 二次认证
 */
import { hashPassword, verifyPassword, signToken, createSecureCookie, extractToken, verifyToken } from '../utils/auth.js';
import { getJSON, putJSON, getUser, putUser } from '../utils/kv.js';
import { generateCaptcha, storeCaptcha, verifyCaptcha } from '../../Safety/Human_machine_verification/captcha.js';
import { generateSecret, generateUri, generateTOTP, verifyTOTP, generateBackupCodes } from '../utils/twofactor.js';

const ROLE = { ADMIN: 'admin', FEATURE_ADMIN: 'feature_admin', USER: 'user' };
const ADMIN_USERS = ['kairui2011120'];

// 风控：登录后5分钟内可免安全认证
const SECURITY_GRACE_PERIOD = 5 * 60 * 1000;

// ── 工具 ──
function json(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

function sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, passwordSalt, password, totpSecret, backupCodes, ...safe } = user;
    return safe;
}

function checkRateLimit(env, key, window, max) {
    return (async () => {
        const k = `rl:${key}:${Date.now() - Date.now() % window}`;
        const n = parseInt(await env.SkyXing.get(k) || '0') + 1;
        await env.SkyXing.put(k, String(n), { expirationTtl: Math.ceil(window / 1000) });
        return { allowed: n <= max, retryAfter: n > max ? Math.ceil(window / 1000) : 0 };
    })();
}

/** 风控等级：判断是否需要安全认证 */
function needsSecurityCheck(user) {
    if (!user.lastLogin) return true;
    return (Date.now() - user.lastLogin) > SECURITY_GRACE_PERIOD;
}

// ── 验证码 ──
export async function handleCaptchaGenerate(request, env) {
    const { id, svg, answer } = generateCaptcha();
    await storeCaptcha(env, id, answer);
    return json({ success: true, captchaId: id, captchaSvg: svg });
}

// ── 注册 ──
export async function handleRegister(request, env) {
    const rc = await checkRateLimit(env, 'register', 3600000, 5);
    if (!rc.allowed) return json({ success: false, message: '注册太频繁，请稍后再试' }, 429);

    const { username, password, captchaId, captchaAnswer } = await request.json();

    // 验证用户名
    if (!username || username.length < 3 || username.length > 12)
        return json({ success: false, message: '用户名需3-12位' });
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username))
        return json({ success: false, message: '用户名只能包含中英文、数字和下划线' });
    if (await getUser(env, username))
        return json({ success: false, message: '用户名已存在' });

    // 验证密码
    if (!password || password.length < 6)
        return json({ success: false, message: '密码至少6位' });

    // 人机验证
    if (!captchaId || captchaAnswer === undefined)
        return json({ success: false, message: '请完成人机验证' });
    const captchaResult = await verifyCaptcha(env, captchaId, captchaAnswer);
    if (!captchaResult.valid)
        return json({ success: false, message: captchaResult.reason });

    // 创建用户
    const { hash, salt } = await hashPassword(password);
    const now = Date.now();
    const user = {
        username, passwordHash: hash, passwordSalt: salt,
        email: '', bio: '', avatar: '',
        role: ROLE.USER,
        twoFactorEnabled: false,
        createdAt: now, lastLogin: now,
        securityLog: []
    };
    await putUser(env, username, user);

    const token = await signToken(username, now);
    await env.SkyXing.put(`token:${token}`, username);

    return new Response(JSON.stringify({
        success: true, message: '注册成功',
        user: sanitizeUser(user),
        token,
        redirect: '/'
    }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': createSecureCookie('auth_token', token) } });
}

// ── 登录 ──
export async function handleLogin(request, env) {
    const rc = await checkRateLimit(env, 'login', 60000, 10);
    if (!rc.allowed) return json({ success: false, message: '登录尝试过多，请稍后再试' }, 429);

    const { username, password, captchaId, captchaAnswer, twoFactorCode } = await request.json();

    // 人机验证
    if (!captchaId || captchaAnswer === undefined)
        return json({ success: false, message: '请完成人机验证' });
    const captchaResult = await verifyCaptcha(env, captchaId, captchaAnswer);
    if (!captchaResult.valid)
        return json({ success: false, message: captchaResult.reason });

    // 查找用户（支持用户名或邮箱）
    let user = null;
    if (username) {
        user = await getUser(env, username);
        if (!user && username.includes('@')) {
            // 用邮箱查找
            const userList = await env.SkyXing.list({ prefix: 'user:' });
            for (const k of userList.keys) {
                const u = await getUser(env, k.name.substring(5));
                if (u && u.email === username.toLowerCase()) { user = u; break; }
            }
        }
    }
    if (!user) return json({ success: false, message: '用户名或邮箱不存在' });
    if (!password) return json({ success: false, message: '请输入密码' });

    // 密码验证
    let valid = false;
    if (typeof user.password === 'string') {
        if (user.password === password) {
            const { hash, salt } = await hashPassword(password);
            user.passwordHash = hash; user.passwordSalt = salt;
            delete user.password; valid = true;
        }
    } else if (user.passwordHash) {
        valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    }
    if (!valid) return json({ success: false, message: '密码错误' });

    // 二次认证
    if (user.twoFactorEnabled) {
        if (!twoFactorCode)
            return json({ success: false, need2FA: true, message: '需要二次认证验证码' });
        // 尝试 TOTP
        let faValid = user.totpSecret ? await verifyTOTP(user.totpSecret, twoFactorCode) : false;
        // 尝试备用码
        if (!faValid && user.backupCodes) {
            const idx = user.backupCodes.indexOf(twoFactorCode);
            if (idx >= 0) {
                user.backupCodes.splice(idx, 1);
                faValid = true;
            }
        }
        if (!faValid)
            return json({ success: false, need2FA: true, message: '二次认证验证失败' });
    }

    // 升级角色
    if (ADMIN_USERS.includes(user.username) && user.role !== ROLE.ADMIN) user.role = ROLE.ADMIN;

    user.lastLogin = Date.now();
    user.lastLoginIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    await putUser(env, user.username, user);

    const token = await signToken(user.username, Date.now());
    await env.SkyXing.put(`token:${token}`, user.username);

    return new Response(JSON.stringify({
        success: true, message: '登录成功',
        user: sanitizeUser(user),
        token,
        redirect: (user.role === ROLE.ADMIN || user.role === ROLE.FEATURE_ADMIN) ? '/admin' : '/'
    }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': createSecureCookie('auth_token', token) } });
}

// ── 个人资料 ──
export async function handleGetProfile(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    return json({
        success: true,
        user: sanitizeUser(user),
        hasPassword: !!(user.passwordHash || user.password),
        hasEmail: !!user.email,
        has2FA: !!user.twoFactorEnabled,
        needsSecurityCheck: needsSecurityCheck(user)
    });
}

export async function handleUpdateProfile(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    const { username: newName, bio, avatar } = await request.json();
    const target = newName || user.username;

    if (newName && newName !== user.username) {
        if (newName.length < 3 || newName.length > 12)
            return json({ success: false, message: '用户名需3-12位' });
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(newName))
            return json({ success: false, message: '用户名只能包含中英文、数字和下划线' });
        if (await getUser(env, newName))
            return json({ success: false, message: '用户名已被使用' });
        // 迁移用户数据
        const oldUser = { ...user };
        await env.SkyXing.delete(`user:${user.username}`);
        user.username = newName;
        await putUser(env, newName, user);
    }

    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    await putUser(env, user.username, user);

    return json({ success: true, message: '更新成功', user: sanitizeUser(user) });
}

// ── 安全信息查看 ──
export async function handleGetSecurity(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    return json({
        success: true,
        security: {
            email: user.email ? maskEmail(user.email) : null,
            hasEmail: !!user.email,
            twoFactorEnabled: !!user.twoFactorEnabled,
            twoFactorType: user.totpSecret ? 'totp' : (user.email ? 'email' : 'none'),
            lastLogin: user.lastLogin,
            lastLoginIP: user.lastLoginIP || 'unknown',
            createdAt: user.createdAt,
            securityLog: (user.securityLog || []).slice(-10).reverse()
        }
    });
}

// ── 安全认证（修改敏感信息前的验证） ──
export async function handleSecurityVerify(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    const { password, twoFactorCode } = await request.json();

    if (!password) return json({ success: false, message: '请输入密码' });

    // 密码验证
    let valid = false;
    if (typeof user.password === 'string') valid = user.password === password;
    else if (user.passwordHash) valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!valid) return json({ success: false, message: '密码错误' });

    // 第二因素：2FA（TOTP 或备用码）
    if (user.twoFactorEnabled && user.totpSecret) {
        if (!twoFactorCode)
            return json({ success: false, message: '请输入二次认证验证码' });
        let faValid = await verifyTOTP(user.totpSecret, twoFactorCode);
        if (!faValid && user.backupCodes) {
            const idx = user.backupCodes.indexOf(twoFactorCode);
            if (idx >= 0) { user.backupCodes.splice(idx, 1); faValid = true; }
        }
        if (!faValid)
            return json({ success: false, message: '二次认证验证失败' });
    }

    // 生成临时安全令牌 (5分钟有效)
    const safeToken = await signToken(user.username + ':safe', Date.now());
    await env.SkyXing.put(`safe:${safeToken}`, user.username, { expirationTtl: 300 });

    return json({ success: true, message: '安全认证通过', safeToken });
}

// ── 修改密码 ──
export async function handleChangePassword(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    const { oldPassword, newPassword, safeToken } = await request.json();

    if (!newPassword || newPassword.length < 6)
        return json({ success: false, message: '新密码至少6位' });

    // 风控：是否需要安全认证
    if (needsSecurityCheck(user)) {
        if (!safeToken) return json({ success: false, message: '需要安全认证' }, 403);
        const safeUser = await env.SkyXing.get(`safe:${safeToken}`);
        if (!safeUser || safeUser !== user.username)
            return json({ success: false, message: '安全认证已过期，请重新验证' }, 403);
        await env.SkyXing.delete(`safe:${safeToken}`);
    }

    // 验证旧密码
    if (oldPassword) {
        let valid = false;
        if (typeof user.password === 'string') valid = user.password === oldPassword;
        else if (user.passwordHash) valid = await verifyPassword(oldPassword, user.passwordHash, user.passwordSalt);
        if (!valid) return json({ success: false, message: '旧密码错误' });
    }

    const { hash, salt } = await hashPassword(newPassword);
    user.passwordHash = hash; user.passwordSalt = salt;
    delete user.password;
    user.lastPasswordChange = Date.now();
    if (!user.securityLog) user.securityLog = [];
    user.securityLog.push({ time: Date.now(), action: 'change_password' });
    if (user.securityLog.length > 50) user.securityLog.length = 50;
    await putUser(env, user.username, user);

    return json({ success: true, message: '密码修改成功' });
}

// ── 修改邮箱 ──
export async function handleChangeEmail(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    const { newEmail, safeToken } = await request.json();

    if (!newEmail) return json({ success: false, message: '请输入新邮箱' });

    // 风控
    if (needsSecurityCheck(user)) {
        if (!safeToken) return json({ success: false, message: '需要安全认证' }, 403);
        const safeUser = await env.SkyXing.get(`safe:${safeToken}`);
        if (!safeUser || safeUser !== user.username)
            return json({ success: false, message: '安全认证已过期，请重新验证' }, 403);
        await env.SkyXing.delete(`safe:${safeToken}`);
    }

    // 检查新邮箱是否已被使用
    const userList = await env.SkyXing.list({ prefix: 'user:' });
    for (const k of userList.keys) {
        const u = await getUser(env, k.name.substring(5));
        if (u && u.email === newEmail.toLowerCase() && u.username !== user.username)
            return json({ success: false, message: '此邮箱已被其他账号使用' });
    }

    user.email = newEmail.toLowerCase();
    if (!user.securityLog) user.securityLog = [];
    user.securityLog.push({ time: Date.now(), action: 'change_email' });
    if (user.securityLog.length > 50) user.securityLog.length = 50;
    await putUser(env, user.username, user);

    return json({ success: true, message: '邮箱修改成功', email: maskEmail(user.email) });
}

// ── 二次认证设置 ──
export async function handle2FASetup(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    const secret = generateSecret();
    const uri = generateUri(secret, user.username);
    const backupCodes = generateBackupCodes();

    // 暂存设置信息（待验证后激活）
    await putJSON(env, `2fa_setup:${user.username}`, {
        secret, backupCodes, createdAt: Date.now()
    });

    return json({
        success: true,
        secret,
        uri,
        backupCodes,
        message: '请使用身份验证器App扫描QR码，然后输入验证码完成设置'
    });
}

export async function handle2FAVerify(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    const { code } = await request.json();
    if (!code) return json({ success: false, message: '请输入验证码' });

    const setup = await getJSON(env, `2fa_setup:${user.username}`);
    if (!setup) return json({ success: false, message: '请先进行2FA设置' });

    const isValid = await verifyTOTP(setup.secret, code);
    if (!isValid) return json({ success: false, message: '验证码错误，请重试' });

    // 激活 2FA
    user.twoFactorEnabled = true;
    user.totpSecret = setup.secret;
    user.backupCodes = setup.backupCodes;
    if (!user.securityLog) user.securityLog = [];
    user.securityLog.push({ time: Date.now(), action: 'enable_2fa' });
    if (user.securityLog.length > 50) user.securityLog.length = 50;
    await putUser(env, user.username, user);
    await env.SkyXing.delete(`2fa_setup:${user.username}`);

    return json({
        success: true,
        message: '二次认证已启用',
        backupCodes: setup.backupCodes
    });
}

export async function handle2FAToggle(request, env) {
    const user = await verifyUserRaw(request, env);
    if (!user) return json({ success: false, message: '未登录' }, 401);

    const { enable } = await request.json();

    if (enable === false) {
        // 关闭2FA需要安全认证
        user.twoFactorEnabled = false;
        user.totpSecret = null;
        user.backupCodes = null;
        if (!user.securityLog) user.securityLog = [];
        user.securityLog.push({ time: Date.now(), action: 'disable_2fa' });
        await putUser(env, user.username, user);
        return json({ success: true, message: '二次认证已关闭' });
    }

    // 启用：需要先 setup
    return json({ success: false, message: '请先完成2FA设置' });
}

// ── 登出 ──
export async function handleLogout(request, env) {
    const token = extractToken(request);
    if (token) {
        await env.SkyXing.delete(`token:${token}`);
        // 清除安全令牌
        const safeKeys = await env.SkyXing.list({ prefix: 'safe:' });
        for (const k of safeKeys.keys) {
            const u = await env.SkyXing.get(k.name);
            const user = await verifyUserRaw(request, env);
            if (user && u === user.username) await env.SkyXing.delete(k.name);
        }
    }
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'auth_token=; Path=/; Max-Age=0' }
    });
}

// ── 内部函数 ──
async function verifyUserRaw(request, env) {
    const token = extractToken(request);
    if (!token) return null;
    const payload = await verifyToken(token);
    if (payload) return getUser(env, payload.username);
    const username = await env.SkyXing.get(`token:${token}`);
    return username ? getUser(env, username) : null;
}

function maskEmail(email) {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    const visible = name.length <= 2 ? name[0] + '*' : name[0] + '***' + name[name.length - 1];
    return visible + '@' + domain;
}
