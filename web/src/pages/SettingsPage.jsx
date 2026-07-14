import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  Bug, Download, RefreshCw, Info, User, Shield, LogOut, ExternalLink,
  CheckCircle2, AlertCircle, Github,
} from 'lucide-react';

const APP_VERSION = '1.1.0';
const PLATFORM = 'web';
const CHANNEL_KEY = 'skyxing_update_channel';

function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [channel, setChannel] = useState(
    () => localStorage.getItem(CHANNEL_KEY) || 'stable'
  );
  const [update, setUpdate] = useState({
    checking: false, error: null, hasUpdate: false,
    latest: null, checked: false,
  });

  const onChannelChange = (ch) => {
    setChannel(ch);
    localStorage.setItem(CHANNEL_KEY, ch);
    setUpdate((u) => ({ ...u, checked: false, hasUpdate: false, latest: null }));
  };

  const checkUpdate = useCallback(async () => {
    setUpdate((u) => ({ ...u, checking: true, error: null }));
    try {
      const data = await api.checkUpdate(PLATFORM, APP_VERSION, channel);
      setUpdate((u) => ({
        ...u, checking: false, checked: true,
        hasUpdate: data.hasUpdate, latest: data.release,
      }));
    } catch (e) {
      setUpdate((u) => ({ ...u, checking: false, error: e.message || '检查失败' }));
    }
  }, [channel]);

  useEffect(() => { checkUpdate(); }, [checkUpdate]);

  const handleDownload = () => {
    const url = update.latest?.download?.recommendedUrl || update.latest?.download?.url;
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-sm text-gray-500 mt-1">调试 · 更新 · 关于软件</p>
      </div>

      {/* 调试 */}
      <Section icon={Bug} title="调试" desc="更新通道与当前账户诊断信息">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">更新通道</div>
            <div className="flex gap-2">
              {['stable', 'beta'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => onChannelChange(ch)}
                  className={
                    'px-4 py-1.5 rounded-md text-sm font-medium border transition-colors ' +
                    (channel === ch
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50')
                  }
                >
                  {ch === 'stable' ? '稳定版' : '测试版'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              测试版可能包含未稳定的功能，仅建议在体验新特性时开启。
            </p>
          </div>

          {user && (
            <div className="pt-2 border-t border-gray-100">
              <Row label="用户 ID" value={user.id} />
              <Row label="角色" value={{ user: '用户', author: '作者', admin: '管理员' }[user.role] || user.role} />
              <Row label="登录状态" value="已登录" />
            </div>
          )}
        </div>
      </Section>

      {/* 更新 */}
      <Section icon={Download} title="更新" desc="检查并获取最新安装包">
        <div className="space-y-4">
          <Row label="当前版本" value={`v${APP_VERSION}`} />
          <Row label="更新通道" value={channel === 'stable' ? '稳定版' : '测试版'} />

          <button
            onClick={checkUpdate}
            disabled={update.checking}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={update.checking ? 'animate-spin' : ''} />
            {update.checking ? '检查中...' : '检查更新'}
          </button>

          {update.error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{update.error}</span>
            </div>
          )}

          {update.checked && !update.error && !update.hasUpdate && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>已是最新版本</span>
            </div>
          )}

          {update.hasUpdate && update.latest && (
            <div className="border border-primary-200 rounded-lg p-4 bg-primary-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">
                  发现新版本 v{update.latest.version}
                </div>
                {update.latest.prerelease && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    预发布
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {update.latest.notes || '（无更新说明）'}
              </div>
              {update.latest.proxyApplied && (
                <div className="text-xs text-primary-600">
                  已启用下载加速代理，下载将自动走代理地址。
                </div>
              )}
              <button
                onClick={handleDownload}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Download size={16} />
                下载更新
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* 关于软件 */}
      <Section icon={Info} title="关于软件" desc="版本信息与账户">
        <div className="space-y-4">
          <div>
            <div className="text-lg font-bold text-gray-900">SkyXing</div>
            <div className="text-sm text-gray-500">版本 v{APP_VERSION} · Web 端</div>
          </div>

          <div className="flex gap-2">
            <a
              href="https://skyxing.dpdns.org"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={14} /> 官网
            </a>
            <a
              href="https://github.com/kairuirain/skyxing"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Github size={14} /> GitHub
            </a>
          </div>

          {user ? (
            <div className="pt-2 border-t border-gray-100 space-y-1">
              <Link to={`/user/${user.id}`} className="flex items-center gap-3 py-2.5 text-sm text-gray-700 hover:text-gray-900">
                <User size={16} /> 我的主页
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="flex items-center gap-3 py-2.5 text-sm text-gray-700 hover:text-gray-900">
                  <Shield size={16} /> 管理后台
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 py-2.5 text-sm text-red-600 hover:text-red-700"
              >
                <LogOut size={16} /> 退出登录
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-gray-100 flex gap-2">
              <Link to="/login" className="flex-1 text-center py-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                登录
              </Link>
              <Link to="/register" className="flex-1 text-center py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                注册
              </Link>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
