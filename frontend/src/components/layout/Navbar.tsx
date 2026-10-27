import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Shield,
  ChevronDown,
  Database,
  Menu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  LogOut,
  User,
  Building2
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { api } from "../../services/api.js";
import { Notification } from "../../services/types.js";

export const Navbar: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
  const { user, demoAccounts, switchUserRole, logout } = useAuth();
  const navigate = useNavigate();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch {
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
    <header className="bg-white border-b border-slate-300 sticky top-0 z-30">
      {/* 1. Official Tricolor Top Stripe */}
      <div className="gov-tricolor-bar" />

      {/* 2. Top Ministry & National Portal Identification Bar */}
      <div className="bg-[#0b2545] text-slate-200 text-[11px] px-4 py-1 flex items-center justify-between border-b border-[#12375b]">
        <div className="flex items-center space-x-2 font-medium tracking-wide">
          <span className="text-white font-semibold">भारत सरकार</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-200">Government of India</span>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-slate-300 hidden sm:inline">शिक्षा मंत्रालय (Ministry of Education)</span>
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span className="hidden md:inline text-slate-300">
            अखिल भारतीय तकनीकी शिक्षा परिषद (AICTE)
          </span>
          <span className="text-slate-400 hidden md:inline">|</span>
          <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded-xs font-mono text-[10px]">
            DEMO ENVIRONMENT
          </span>
        </div>
      </div>

      {/* 3. Official Government Portal Masthead */}
      <div className="px-4 py-2 flex items-center justify-between gap-4 bg-white">
        {/* Left: Emblem Representation & Official Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded text-slate-700 hover:text-[#003366] hover:bg-slate-100 border border-slate-300 transition cursor-pointer"
            title="Toggle Menu"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center space-x-2.5">
            {/* National Crest / AICTE Seal Representation */}
            <div className="w-9 h-9 rounded-xs bg-[#003366] border border-[#002147] flex items-center justify-center text-white shrink-0">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-600 leading-none">
                अखिल भारतीय तकनीकी शिक्षा परिषद • AICTE
              </div>
              <div className="text-base font-bold text-[#003366] tracking-tight leading-tight mt-0.5">
                Complaint Monitoring System
              </div>
              <div className="text-[10px] text-slate-500 font-medium hidden sm:block">
                Inter-Bureau Grievance Redressal & Statutory SLA Compliance Portal
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Primary Administrative Reference Search */}
        <form onSubmit={handleGlobalSearch} className="hidden lg:flex items-center flex-1 max-w-sm mx-4">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search Complaint ID (AICTE/...) or Permanent ID..."
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xs pl-8 pr-3 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366] transition"
            />
          </div>
        </form>

        {/* Right: Administrative Utility Bar */}
        <div className="flex items-center space-x-2.5">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-1.5 rounded-xs text-slate-600 hover:text-[#003366] hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
              title="Official Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-700 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white border border-slate-300 rounded-xs shadow-md z-50 overflow-hidden">
                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>NOTIFICATIONS ({unreadCount} UNREAD)</span>
                  <button
                    onClick={async () => {
                      await api.markAllNotificationsRead();
                      loadNotifications();
                    }}
                    className="text-[11px] text-[#003366] hover:underline font-normal cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No active notifications</div>
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
                        className={`p-2.5 hover:bg-slate-50 cursor-pointer transition flex items-start space-x-2 ${!n.isRead ? "bg-blue-50/60" : ""}`}
                      >
                        <div className="mt-0.5">
                          {n.notificationType === "Overlap Alert" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Bell className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{n.title}</div>
                          <div className="text-slate-600 text-[11px] line-clamp-2 mt-0.5">{n.message}</div>
                          <div className="text-slate-400 text-[10px] mt-1">{new Date(n.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-200 bg-slate-50 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setShowNotifMenu(false)}
                    className="text-xs text-[#003366] hover:underline font-semibold"
                  >
                    View All Notifications &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Officer Role & Profile Utility Box */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-xs transition cursor-pointer text-left"
            >
              <div className="w-6 h-6 rounded-xs bg-[#003366] text-white flex items-center justify-center text-xs font-bold font-mono">
                {user?.fullName.charAt(0) || "O"}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[150px]">
                  {user?.fullName || "Officer"}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {user?.role || "Logged In"} {user?.bureauId ? `• ${user.bureauId}` : ""}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-300 rounded-xs shadow-md z-50 p-2">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 mb-1">
                  Active Officer / Role Context
                </div>
                <div className="space-y-0.5">
                  {demoAccounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        switchUserRole(acc.email);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left p-2 rounded-xs hover:bg-slate-50 text-xs transition flex items-start space-x-2 cursor-pointer ${
                        user?.email === acc.email ? "bg-blue-50/80 border border-blue-200 font-medium" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 flex items-center justify-between">
                          <span className="truncate">{acc.fullName}</span>
                          {user?.email === acc.email && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#003366]" />
                          )}
                        </div>
                        <div className="text-[11px] text-[#003366] font-medium">{acc.role}</div>
                        <div className="text-[10px] text-slate-400 truncate">{acc.designation}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      logout();
                      navigate("/login");
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-xs transition flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Close Session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
