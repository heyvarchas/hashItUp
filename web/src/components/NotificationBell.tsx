import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AppNotification {
  notification_id: string;
  recipient_id: string;
  recipient_role?: string;
  title: string;
  message: string;
  request_id?: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch('http://localhost:8000/notifications', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data: AppNotification[] = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000); // 12s poll
    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notifId: string) => {
    try {
      await fetch(`http://localhost:8000/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === notifId ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('http://localhost:8000/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border transition-colors flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-field-primary" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] text-[10px] font-bold rounded-full bg-triage-red text-white flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-field-surface border border-field-border rounded-lg shadow-2xl z-50 overflow-hidden font-sans">
          <div className="p-3 border-b border-field-border flex items-center justify-between bg-field-surface-subtle">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-field-primary">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-command-blue/20 text-command-blue border border-command-blue/40">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-field-muted hover:text-command-blue font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-field-border">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-field-muted">
                No notifications at this time.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => !n.is_read && markAsRead(n.notification_id)}
                  className={`p-3 text-xs transition-colors cursor-pointer flex items-start gap-2.5 ${
                    n.is_read
                      ? 'bg-field-surface opacity-80'
                      : 'bg-field-surface-elevated/70 hover:bg-field-surface-elevated'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                      n.is_read ? 'bg-transparent' : 'bg-command-blue'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-field-primary truncate">
                        {n.title}
                      </span>
                      <span className="text-[10px] text-field-muted shrink-0">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-field-muted text-[11px] leading-relaxed whitespace-pre-line">
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
