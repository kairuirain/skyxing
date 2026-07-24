import { Routes, Route, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import BlogPage from './pages/BlogPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WritePage from './pages/WritePage';
import ArticlePage from './pages/ArticlePage';
import UserPage from './pages/UserPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import SlideOutlet from './components/SlideOutlet';

function MainLayout() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/write" element={<WritePage />} />
        <Route path="/article/:id" element={<ArticlePage />} />
        <Route path="/user/:id" element={<UserPage />} />
        <Route path="/me" element={<UserPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<ConversationPage />} />
        <Route path="/edit/:id" element={<WritePage />} />
        <Route path="/download" element={<div className="sk-card p-8 text-center"><h1 className="text-2xl font-bold mb-4">下载客户端</h1><p className="text-[var(--text-secondary)]">敬请期待</p></div>} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<MainLayout />} />
      <Route element={<SlideOutlet />}>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
