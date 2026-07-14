import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, Alert, ActivityIndicator, Switch, Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../lib/api';

const APP_VERSION = '1.0.0';
const PLATFORM = 'android';

export default function ProfileScreen({ navigation }) {
  const { user, login, logout, register, updateProfile } = useAuth();
  const { settings, updateSetting, clearCache } = useSettings();

  // Auth form state
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);

  // OTA update state
  const [update, setUpdate] = useState({ checking: false, error: null, hasUpdate: false, latest: null, checked: false });
  const channel = settings.updateChannel || 'stable';

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setAuthError('请填写用户名和密码');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await login(username.trim(), password);
      setShowLogin(false);
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message || '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password || !email.trim()) {
      setAuthError('请填写所有必填字段');
      return;
    }
    if (username.trim().length < 3) {
      setAuthError('用户名至少 3 个字符');
      return;
    }
    if (password.length < 6) {
      setAuthError('密码至少 6 位');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await register({
        username: username.trim(),
        password,
        email: email.trim(),
        displayName: displayName.trim() || username.trim(),
      });
      setShowRegister(false);
      setUsername('');
      setPassword('');
      setEmail('');
      setDisplayName('');
    } catch (err) {
      setAuthError(err.message || '注册失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const startEdit = () => {
    setEditName(user.displayName || '');
    setEditBio(user.bio || '');
    setEditing(true);
  };

  const saveProfile = async () => {
    setEditLoading(true);
    try {
      await updateProfile({
        displayName: editName.trim(),
        bio: editBio.trim(),
      });
      setEditing(false);
    } catch (err) {
      Alert.alert('保存失败', err.message || '请稍后重试');
    } finally {
      setEditLoading(false);
    }
  };

  const handleClearCache = async () => {
    setCacheClearing(true);
    try {
      await clearCache();
      Alert.alert('清理完成', '缓存已清除');
    } catch {
      Alert.alert('清理失败', '请稍后重试');
    } finally {
      setCacheClearing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          logout();
          setShowSettings(false);
        },
      },
    ]);
  };

  const checkUpdate = useCallback(async () => {
    setUpdate((u) => ({ ...u, checking: true, error: null }));
    try {
      const data = await api.checkUpdate(PLATFORM, APP_VERSION, channel);
      setUpdate((u) => ({ ...u, checking: false, checked: true, hasUpdate: data.hasUpdate, latest: data.release }));
    } catch (e) {
      setUpdate((u) => ({ ...u, checking: false, error: e.message || '检查失败' }));
    }
  }, [channel]);

  const handleDownload = () => {
    const url = update.latest?.download?.recommendedUrl || update.latest?.download?.url;
    if (!url) return;
    Alert.alert(
      '下载更新',
      `确认下载 SkyXing v${update.latest.version} 安装包？${update.latest.proxyApplied ? '\n（已启用下载加速代理）' : ''}`,
      [
        { text: '取消', style: 'cancel' },
        { text: '下载', onPress: () => Linking.openURL(url).catch(() => Alert.alert('打开失败', '无法打开下载链接')) },
      ]
    );
  };

  // 未登录状态
  if (!user) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>?</Text>
          </View>
          <Text style={styles.welcomeTitle}>欢迎来到 SkyXing</Text>
          <Text style={styles.welcomeSubtitle}>登录后享受完整功能</Text>
        </View>

        {authError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{authError}</Text>
          </View>
        ) : null}

        {!showLogin && !showRegister ? (
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => { setShowLogin(true); setAuthError(''); }}
            >
              <Text style={styles.btnPrimaryText}>登录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => { setShowRegister(true); setAuthError(''); }}
            >
              <Text style={styles.btnOutlineText}>注册账号</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showLogin && (
          <View style={styles.authForm}>
            <Text style={styles.formTitle}>登录</Text>
            <TextInput
              style={styles.input}
              placeholder="用户名"
              placeholderTextColor="#9ca3af"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="密码"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.btnPrimary, authLoading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>登录</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowLogin(false); setAuthError(''); }}
            >
              <Text style={styles.linkText}>返回</Text>
            </TouchableOpacity>
          </View>
        )}

        {showRegister && (
          <View style={styles.authForm}>
            <Text style={styles.formTitle}>注册</Text>
            <TextInput
              style={styles.input}
              placeholder="用户名 (3-30 字符)"
              placeholderTextColor="#9ca3af"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="邮箱"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="显示名称 (可选)"
              placeholderTextColor="#9ca3af"
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextInput
              style={styles.input}
              placeholder="密码 (至少 6 位)"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.btnPrimary, authLoading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>注册</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowRegister(false); setAuthError(''); }}
            >
              <Text style={styles.linkText}>已有账号？去登录</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 未登录时也显示设置入口 */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowSettings(!showSettings)}
          >
            <Text style={styles.settingIcon}>⚙️</Text>
            <Text style={styles.settingLabel}>设置</Text>
            <Text style={styles.settingArrow}>{showSettings ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showSettings && (
            <View style={styles.settingsPanel}>
              <View style={styles.settingItem}>
                <Text style={styles.settingItemLabel}>字体大小</Text>
                <View style={styles.fontSizeSelector}>
                  {['small', 'medium', 'large'].map(size => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.fontSizeBtn,
                        settings.fontSize === size && styles.fontSizeBtnActive,
                      ]}
                      onPress={() => updateSetting('fontSize', size)}
                    >
                      <Text style={[
                        styles.fontSizeBtnText,
                        settings.fontSize === size && styles.fontSizeBtnTextActive,
                      ]}>
                        {{ small: '小', medium: '中', large: '大' }[size]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingItemRow}>
                  <Text style={styles.settingItemLabel}>离线缓存</Text>
                  <Switch
                    value={settings.offlineCache}
                    onValueChange={(v) => updateSetting('offlineCache', v)}
                    trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
                    thumbColor={settings.offlineCache ? '#2563eb' : '#d1d5db'}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={handleClearCache}
                disabled={cacheClearing}
              >
                <View style={styles.settingItemRow}>
                  <Text style={styles.settingItemLabel}>清除缓存</Text>
                  {cacheClearing ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Text style={styles.settingItemValue}>
                      {settings.cacheSize > 0
                        ? `${(settings.cacheSize / 1024).toFixed(1)} KB`
                        : '0 KB'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // 已登录状态
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 用户信息 */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {(user.displayName || user.username).charAt(0).toUpperCase()}
          </Text>
        </View>
        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              style={styles.input}
              placeholder="显示名称"
              placeholderTextColor="#9ca3af"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="个人简介"
              placeholderTextColor="#9ca3af"
              value={editBio}
              onChangeText={setEditBio}
              multiline
              numberOfLines={3}
            />
            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setEditing(false)}>
                <Text style={styles.btnSecondaryText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, editLoading && styles.btnDisabled]}
                onPress={saveProfile}
                disabled={editLoading}
              >
                {editLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>保存</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.displayName}>{user.displayName || user.username}</Text>
            <Text style={styles.username}>@{user.username}</Text>
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
            <View style={styles.roleRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {{ user: '用户', author: '作者', admin: '管理员' }[user.role] || user.role}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
              <Text style={styles.editBtnText}>编辑资料</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 调试 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>调试</Text>
        <View style={styles.settingsPanel}>
          <View style={styles.settingItem}>
            <Text style={styles.settingItemLabel}>字体大小</Text>
            <View style={styles.fontSizeSelector}>
              {['small', 'medium', 'large'].map(size => (
                <TouchableOpacity
                  key={size}
                  style={[styles.fontSizeBtn, settings.fontSize === size && styles.fontSizeBtnActive]}
                  onPress={() => updateSetting('fontSize', size)}
                >
                  <Text style={[styles.fontSizeBtnText, settings.fontSize === size && styles.fontSizeBtnTextActive]}>
                    {{ small: '小', medium: '中', large: '大' }[size]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemRow}>
              <Text style={styles.settingItemLabel}>离线缓存</Text>
              <Switch
                value={settings.offlineCache}
                onValueChange={(v) => updateSetting('offlineCache', v)}
                trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
                thumbColor={settings.offlineCache ? '#2563eb' : '#d1d5db'}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.settingItem} onPress={handleClearCache} disabled={cacheClearing}>
            <View style={styles.settingItemRow}>
              <Text style={styles.settingItemLabel}>清除缓存</Text>
              {cacheClearing ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text style={styles.settingItemValue}>
                  {settings.cacheSize > 0 ? `${(settings.cacheSize / 1024).toFixed(1)} KB` : '0 KB'}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.settingItem}>
            <Text style={styles.settingItemLabel}>更新通道</Text>
            <View style={styles.fontSizeSelector}>
              {['stable', 'beta'].map(ch => (
                <TouchableOpacity
                  key={ch}
                  style={[styles.fontSizeBtn, channel === ch && styles.fontSizeBtnActive]}
                  onPress={() => updateSetting('updateChannel', ch)}
                >
                  <Text style={[styles.fontSizeBtnText, channel === ch && styles.fontSizeBtnTextActive]}>
                    {ch === 'stable' ? '稳定版' : '测试版'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* 更新 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>更新</Text>
        <View style={styles.settingsPanel}>
          <View style={styles.settingItemRow}>
            <Text style={styles.settingItemLabel}>当前版本</Text>
            <Text style={styles.settingItemValue}>v{APP_VERSION} · {channel === 'beta' ? '测试版' : '稳定版'}</Text>
          </View>
          <TouchableOpacity style={styles.updateBtn} onPress={checkUpdate} disabled={update.checking}>
            <Text style={styles.updateBtnText}>{update.checking ? '检查中...' : '检查更新'}</Text>
          </TouchableOpacity>
          {update.error && <Text style={styles.errorText}>检查失败：{update.error}</Text>}
          {update.checked && !update.error && !update.hasUpdate && (
            <Text style={styles.okText}>已是最新版本</Text>
          )}
          {update.hasUpdate && update.latest && (
            <View style={styles.updateCard}>
              <Text style={styles.updateTitle}>发现新版本 v{update.latest.version}</Text>
              <Text style={styles.updateNotes}>{update.latest.notes || '（无更新说明）'}</Text>
              {update.latest.proxyApplied && <Text style={styles.proxyText}>已启用下载加速代理</Text>}
              <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
                <Text style={styles.downloadBtnText}>下载更新</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* 关于软件 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>关于软件</Text>
        <View style={styles.settingsPanel}>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Article', { id: null, title: '写文章' })}>
            <Text style={styles.menuIcon}>✏️</Text>
            <Text style={styles.menuLabel}>写文章</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Messages')}>
            <Text style={styles.menuIcon}>💬</Text>
            <Text style={styles.menuLabel}>私信</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          {user.role === 'admin' && (
            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Admin')}>
              <Text style={styles.menuIcon}>🔧</Text>
              <Text style={styles.menuLabel}>管理后台</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>退出登录</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.versionText}>SkyXing v{APP_VERSION} · Android</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { paddingBottom: 40 },
  profileHeader: {
    alignItems: 'center', paddingVertical: 32,
    backgroundColor: '#fff', marginBottom: 12,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  welcomeTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  welcomeSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  displayName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  username: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  bio: { fontSize: 14, color: '#374151', marginTop: 8, paddingHorizontal: 32, textAlign: 'center' },
  roleRow: { marginTop: 8 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#eff6ff' },
  roleText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  editBtn: {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db',
  },
  editBtnText: { fontSize: 14, color: '#374151' },
  editForm: { width: '100%', paddingHorizontal: 24, marginTop: 12 },
  editButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  authButtons: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },
  authForm: { paddingHorizontal: 24, paddingTop: 16 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  errorBox: { marginHorizontal: 24, marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#fef2f2' },
  errorText: { fontSize: 13, color: '#dc2626' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1f2937', marginBottom: 12,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  btnPrimary: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  btnSecondary: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnSecondaryText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  btnOutline: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  linkText: { textAlign: 'center', marginTop: 16, fontSize: 14, color: '#2563eb' },
  section: { backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6, borderRadius: 12, overflow: 'hidden', padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 15, color: '#374151' },
  menuArrow: { fontSize: 20, color: '#d1d5db' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  settingIcon: { fontSize: 18, marginRight: 12 },
  settingLabel: { flex: 1, fontSize: 15, color: '#374151' },
  settingArrow: { fontSize: 12, color: '#d1d5db' },
  settingsPanel: { paddingTop: 4 },
  settingItem: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f3f4f6' },
  settingItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingItemLabel: { fontSize: 14, color: '#374151' },
  settingItemValue: { fontSize: 13, color: '#6b7280' },
  fontSizeSelector: { flexDirection: 'row', gap: 8, marginTop: 8 },
  fontSizeBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  fontSizeBtnActive: { backgroundColor: '#2563eb' },
  fontSizeBtnText: { fontSize: 13, color: '#6b7280' },
  fontSizeBtnTextActive: { color: '#fff' },
  updateBtn: { marginTop: 4, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  updateBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  okText: { marginTop: 8, fontSize: 13, color: '#16a34a' },
  updateCard: { marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  updateTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },
  updateNotes: { fontSize: 12, color: '#374151', marginTop: 6 },
  proxyText: { fontSize: 12, color: '#2563eb', marginTop: 6 },
  downloadBtn: { marginTop: 10, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  downloadBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  logoutBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  logoutBtnText: { fontSize: 15, color: '#dc2626', fontWeight: '600' },
  versionText: { textAlign: 'center', marginTop: 12, fontSize: 12, color: '#d1d5db' },
});
