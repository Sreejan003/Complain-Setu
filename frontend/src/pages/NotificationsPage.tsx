import {coordinationNotice} from "../services/coordinationNotice.js";
import { tr, localizeLabel, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
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
  useLocaleRender();
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
      <div className="page-header">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("notifications:governmentOfIndiaAicteAdministrativeAlerts")}</div>
          <h1 className="text-base sm:text-lg font-bold text-aicte-navy-900 tracking-tight">{tr("notifications:officialNotificationCenter")}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{tr("notifications:auditAlertsForNewlyDetectedOverlapsApproachingSlaDeadlines")}</p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#e5eaf0] text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-none self-start sm:self-auto cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5 text-aicte-navy-700" />
          <span>{tr("notifications:markAllRead")}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-3 shadow-none flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold text-slate-700">{tr("notifications:filterByType")}</span>
          <select
            aria-label={tr("notifications:filterByType")} value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-white border border-[#e5eaf0] rounded-lg px-2.5 py-1 text-slate-700 focus:border-[#003366] focus:outline-none"
          >
            <option value="">{tr("notifications:allNotificationTypes")}</option>
            <option value="Overlap Alert">{tr("dashboard:overlapAlerts")}</option>
            <option value="Overdue">{tr("notifications:overdueDeadlines")}</option>
            <option value="Transfer">{tr("notifications:caseTransfers")}</option>
            <option value="Status Update">{tr("notifications:statusUpdates")}</option>
          </select>

          <label className="flex items-center space-x-1.5 cursor-pointer ms-3 text-slate-700 select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={e => setUnreadOnly(e.target.checked)}
              className="rounded-lg text-aicte-navy-700 focus:ring-0"
            />
            <span className="font-medium">{tr("notifications:unreadOnly")}</span>
          </label>
        </div>

        <span className="text-xs text-slate-500 font-mono">{tr("complaints:showing")}{filtered.length} of {notifications.length}{tr("notifications:alerts")}</span>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none divide-y divide-[#e2e8f0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">{tr("notifications:loadingNotifications")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">{tr("notifications:noOfficialNotificationsRecorded")}</div>
        ) : (
          filtered.map(notif => (
            <div
              key={notif.id}
              className={`p-3.5 transition flex items-start space-x-3 ${
                !notif.isRead ? "bg-[#f0f9ff]/50 border-s-3 border-[#003366]" : "hover:bg-slate-50"
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-[#f1f5f9] border border-[#e5eaf0] shrink-0">
                {getIcon(notif.notificationType)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-aicte-navy-900"><bdi dir="auto" className="original-content">{coordinationNotice(notif,"title")}</bdi></span>
                  <span className="text-xs text-slate-500 font-mono">
                    {formatDate(notif.createdAt, true)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-normal">{coordinationNotice(notif,"message")}</p>
                <div className="flex items-center space-x-3 pt-1 text-xs">
                  {notif.referenceType==="coordination" ? <Link to={`/coordination/${notif.referenceId}`} className="underline text-aicte-navy-700">{tr("workflow:crossBureau.open")}</Link> : notif.notificationType === "Overlap Alert" ? (
                    <Link to="/overlaps" className="text-aicte-navy-700 font-semibold hover:underline">{tr("notifications:reviewInOverlapCenter")}</Link>
                  ) : (
                    <Link to="/cases" className="text-aicte-navy-700 font-semibold hover:underline">{tr("notifications:inspectCaseFile")}</Link>
                  )}
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-slate-500 hover:text-slate-800 underline text-xs cursor-pointer"
                    >{tr("notifications:markAsRead")}</button>
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
