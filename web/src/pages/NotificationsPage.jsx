import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import NotificationsList from '../components/NotificationsList';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.getNotifications();
      setNotifications(d.notifications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch (e) {
      /* 忽略标记已读失败 */
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell size={22} /> 系统通知
        </h1>
      </div>
      <NotificationsList
        notifications={notifications}
        loading={loading}
        onMarkRead={handleMarkRead}
      />
    </div>
  );
}
