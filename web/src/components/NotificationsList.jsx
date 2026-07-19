import { useNavigate, Link } from 'react-router-dom';
import { Bell, MessageSquare, UserPlus } from 'lucide-react';
import Loading from './Loading';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

export default function NotificationsList({ notifications, loading, onMarkRead }) {
  const navigate = useNavigate();

  if (loading) return <Loading />;

  if (!notifications || notifications.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Bell size={40} className="mx-auto mb-3 opacity-40" />
        <p>暂无系统通知</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => {
        const Icon = n.type === 'message' ? MessageSquare : n.type === 'follow' ? UserPlus : Bell;
        const actorName = n.actor?.displayName || n.actor?.username;
        return (
          <div
            key={n.id}
            onClick={() => {
              if (n.link) {
                onMarkRead?.(n.id);
                navigate(n.link);
              }
            }}
            className={`card p-3 flex items-start gap-3 ${
              n.read ? '' : 'border-primary-300 bg-primary-50/40'
            } ${n.link ? 'cursor-pointer' : ''}`}
          >
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0 mt-0.5">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">
                {n.actor ? (
                  <Link
                    to={`/user/${n.actor.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead?.(n.id);
                    }}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {actorName}
                  </Link>
                ) : null}
                <span className="ml-1">{n.text}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
            </div>
            {!n.read && (
              <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
