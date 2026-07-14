import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import SettingsModal from './components/SettingsModal';

// 懒加载页面组件 - 按需渲染优化启动速度
import { lazy, Suspense } from 'react';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const WritePage = lazy(() => import('./pages/WritePage'));
const EditPage = lazy(() => import('./pages/EditPage'));
const UserPage = lazy(() => import('./pages/UserPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ConversationPage = lazy(() => import('./pages/ConversationPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/article/:id" element={<ArticlePage />} />
            <Route path="/write" element={<WritePage />} />
            <Route path="/edit/:id" element={<EditPage />} />
            <Route path="/user/:id" element={<UserPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:convId" element={<ConversationPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
      <SettingsModal />
    </>
  );
}
