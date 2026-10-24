import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Shield,
  UserCheck,
  ChevronDown,
  Database,
  ExternalLink,
  Menu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { api } from "../../services/api.js";
import { Notification } from "../../services/types.js";

export const Navbar: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
  const { user, demoAccounts, switchUserRole } = useAuth();
  const navigate = useNavigate();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 20000);
    return () => clearInterval(timer);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/cases?search=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch("");
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Ministry / Regulatory Bar */}
      <div className="bg-aicte-navy-900 text-slate-200 text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="font-semibold tracking-wide text-white uppercase text-[11px]">
            Government of India • Ministry of Education
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300 hidden md:inline">
            All India Council for Technical Education (AICTE)
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded text-[11px] font-medium">
            <Database className="w-3 h-3 text-amber-400" />
            <span>SYNTHETIC DEMO DATASET</span>
          </div>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-slate-300 text-[11px] hidden sm:inline">SIH 2026 Portal</span>
        </div>
      </div>

      {/* Main Administrative Header */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand & Sidebar Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md text-slate-600 hover:text-aicte-navy-900 hover:bg-slate-100 transition"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-md bg-aicte-navy-900 flex items-center justify-center text-white font-bold text-sm shadow-xs border border-aicte-navy-700">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-base font-bold text-aicte-navy-900 tracking-tight leading-tight">
                AICTE Complaint Monitoring System
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Integrated Multi-Bureau Case Coordination & Overlap Intelligence
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Global Search */}
        <form onSubmit={handleGlobalSearch} className="hidden lg:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search by Institution, AICTE Permanent ID (1-...), or Case ID..."
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-md pl-9 pr-4 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700 focus:border-aicte-navy-700 transition"
            />
          </div>
        </form>

        {/* Right: Notifications & Role Switcher */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-2 rounded-md text-slate-600 hover:text-aicte-navy-900 hover:bg-slate-100 transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Notifications ({unreadCount} unread)
                  </span>
                  <button
                    onClick={async () => {
                      await api.markAllNotificationsRead();
                      loadNotifications();
                    }}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No recent notifications</div>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.isRead) {
                            await api.markNotificationRead(n.id);
                            loadNotifications();
                          }
                          setShowNotifMenu(false);
                          if (n.notificationType === "Overlap Alert") {
                            navigate("/overlaps");
                          } else {
                            navigate("/cases");
                          }
                        }}
                        className={`p-3 text-xs hover:bg-slate-50 cursor-pointer transition flex items-start space-x-2.5 ${!n.isRead ? "bg-blue-50/40" : ""}`}
                      >
                        <div className="mt-0.5">
                          {n.notificationType === "Overlap Alert" ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Bell className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">{n.title}</div>
                          <div className="text-slate-600 text-[11px] mt-0.5 line-clamp-2">{n.message}</div>
                          <div className="text-slate-400 text-[10px] mt-1">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setShowNotifMenu(false)}
                    className="text-xs text-aicte-navy-700 hover:underline font-medium"
                  >
                    View All Notifications &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Role Switcher for seamless demonstration */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 rounded-md transition"
            >
              <div className="w-6 h-6 rounded-full bg-aicte-navy-800 text-white flex items-center justify-center text-xs font-bold">
                {user?.fullName.charAt(0) || "U"}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold text-slate-800 leading-tight">
                  {user?.fullName || "Official"}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {user?.role || "Select Role"}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 mb-1">
                  Switch Active Role (Demo Mode)
                </div>
                {demoAccounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      switchUserRole(acc.email);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left p-2 rounded-md hover:bg-slate-50 text-xs transition flex items-start space-x-2 ${user?.email === acc.email ? "bg-blue-50 border border-blue-200" : ""}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] mt-0.5">
                      {acc.fullName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 flex items-center justify-between">
                        <span>{acc.fullName}</span>
                        {user?.email === acc.email && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="text-[11px] text-blue-700 font-medium">{acc.role}</div>
                      <div className="text-[10px] text-slate-400">{acc.designation}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
