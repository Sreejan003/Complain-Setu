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
    <div className="space-y-4">
      {/* Official Header */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#003366]">Government of India &bull; AICTE Administrative Alerts</div>
          <h1 className="text-base sm:text-lg font-bold text-[#002147] tracking-tight">
            Official Notification Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit alerts for newly detected overlaps, approaching SLA deadlines, case transfers, and escalations.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#cbd5e1] text-slate-700 hover:bg-slate-50 rounded-xs text-xs font-semibold shadow-none self-start sm:self-auto cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5 text-[#003366]" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-3 shadow-none flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold text-slate-700">Filter By Type:</span>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1 text-slate-700 focus:border-[#003366] focus:outline-none"
          >
            <option value="">All Notification Types</option>
            <option value="Overlap Alert">Overlap Alerts</option>
            <option value="Overdue">Overdue Deadlines</option>
            <option value="Transfer">Case Transfers</option>
            <option value="Status Update">Status Updates</option>
          </select>

          <label className="flex items-center space-x-1.5 cursor-pointer ml-3 text-slate-700 select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={e => setUnreadOnly(e.target.checked)}
              className="rounded-xs text-[#003366] focus:ring-0"
            />
            <span className="font-medium">Unread Only</span>
          </label>
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          Showing {filtered.length} of {notifications.length} alerts
        </span>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none divide-y divide-[#e2e8f0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No official notifications recorded.</div>
        ) : (
          filtered.map(notif => (
            <div
              key={notif.id}
              className={`p-3.5 transition flex items-start space-x-3 ${
                !notif.isRead ? "bg-[#f0f9ff]/50 border-l-3 border-[#003366]" : "hover:bg-slate-50"
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-xs bg-[#f1f5f9] border border-[#cbd5e1] shrink-0">
                {getIcon(notif.notificationType)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#002147]">{notif.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-normal">{notif.message}</p>
                <div className="flex items-center space-x-3 pt-1 text-[11px]">
                  {notif.notificationType === "Overlap Alert" ? (
                    <Link to="/overlaps" className="text-[#003366] font-semibold hover:underline">
                      Review in Overlap Center &rarr;
                    </Link>
                  ) : (
                    <Link to="/cases" className="text-[#003366] font-semibold hover:underline">
                      Inspect Case File &rarr;
                    </Link>
                  )}
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-slate-500 hover:text-slate-800 underline text-[10px] cursor-pointer"
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
