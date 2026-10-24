import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Clock,
  Filter,
  CheckCheck,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { api } from "../services/api.js";
import { Notification } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    await api.markNotificationRead(id);
    fetchNotifs();
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    fetchNotifs();
  };

  const filtered = notifications.filter(n => {
    if (filterType && n.notificationType !== filterType) return false;
    if (unreadOnly && n.isRead) return false;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "Overlap Alert":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "Overdue":
        return <Clock className="w-4 h-4 text-red-500" />;
      case "Transfer":
        return <ArrowRightLeft className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
            Official Notification Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit alerts for newly detected overlaps, approaching SLA deadlines, case transfers, and escalations.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-semibold shadow-xs self-start sm:self-auto"
        >
          <CheckCheck className="w-4 h-4 text-blue-600" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Filter:</span>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700"
          >
            <option value="">All Notification Types</option>
            <option value="Overlap Alert">Overlap Alerts</option>
            <option value="Overdue">Overdue Deadlines</option>
            <option value="Transfer">Case Transfers</option>
            <option value="Status Update">Status Updates</option>
          </select>

          <label className="flex items-center space-x-1.5 cursor-pointer ml-2 text-slate-700 select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={e => setUnreadOnly(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span>Unread Only</span>
          </label>
        </div>

        <span className="text-[11px] text-slate-400">
          Showing {filtered.length} of {notifications.length} alerts
        </span>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No notifications found.</div>
        ) : (
          filtered.map(notif => (
            <div
              key={notif.id}
              className={`p-4 transition flex items-start space-x-3.5 ${
                !notif.isRead ? "bg-blue-50/30" : "hover:bg-slate-50"
              }`}
            >
              <div className="mt-0.5 p-2 rounded-full bg-slate-100">{getIcon(notif.notificationType)}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{notif.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-normal">{notif.message}</p>
                <div className="flex items-center space-x-3 pt-1 text-[11px]">
                  {notif.notificationType === "Overlap Alert" ? (
                    <Link to="/overlaps" className="text-blue-700 font-semibold hover:underline">
                      Review in Overlap Center &rarr;
                    </Link>
                  ) : (
                    <Link to="/cases" className="text-blue-700 font-semibold hover:underline">
                      Inspect Case File &rarr;
                    </Link>
                  )}
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-slate-400 hover:text-slate-700 underline text-[10px]"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
