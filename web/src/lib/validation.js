// 前端输入合法性校验工具，规则与后端 src/routes/auth.js 保持一致

export function validateUsername(value) {
  const v = (value || '').trim();
  if (!v) return '请输入用户名';
  if (v.length < 3 || v.length > 30) return '用户名长度需为 3-30 个字符';
  if (/\s/.test(v)) return '用户名不能包含空格';
  return '';
}

export function validateEmail(value) {
  const v = (value || '').trim();
  if (!v) return '请输入邮箱';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(v)) return '邮箱格式不正确';
  return '';
}

export function validateDisplayName(value) {
  const v = (value || '').trim();
  if (v && v.length > 30) return '显示名称不能超过 30 个字符';
  return '';
}

export function validatePassword(value) {
  if (!value) return '请输入密码';
  if (value.length < 6) return '密码长度至少 6 位';
  return '';
}

export function validateConfirmPassword(password, confirm) {
  if (!confirm) return '请再次输入密码';
  if (password !== confirm) return '两次输入的密码不一致';
  return '';
}

// 注册表单整体校验，返回 { errors, firstErrorField }
export function validateRegisterForm(form) {
  const errors = {};
  const order = ['username', 'email', 'displayName', 'password', 'confirmPassword'];
  const checks = {
    username: () => validateUsername(form.username),
    email: () => validateEmail(form.email),
    displayName: () => validateDisplayName(form.displayName),
    password: () => validatePassword(form.password),
    confirmPassword: () => validateConfirmPassword(form.password, form.confirmPassword),
  };
  order.forEach((field) => {
    const msg = checks[field]();
    if (msg) errors[field] = msg;
  });
  const firstErrorField = order.find((f) => errors[f]) || null;
  return { errors, firstErrorField };
}
