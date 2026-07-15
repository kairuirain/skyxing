import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import BlogPage from './pages/BlogPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ArticlePage from './pages/ArticlePage';
import WritePage from './pages/WritePage';
import EditPage from './pages/EditPage';
import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import SettingsPage from './pages/SettingsPage';
import DownloadPage from './pages/DownloadPage';
import MyPage from './pages/MyPage';
import LinkRedirect from './pages/LinkRedirect';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/me" element={<MyPage />} />
        <Route path="/article/:id" element={<ArticlePage />} />
        <Route path="/write" element={<WritePage />} />
        <Route path="/edit/:id" element={<EditPage />} />
        <Route path="/user/:id" element={<UserPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:convId" element={<ConversationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/link" element={<LinkRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
