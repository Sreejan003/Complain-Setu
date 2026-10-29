import React, { useEffect, useId, useRef } from "react";
import { AlertCircle, ArrowUpRight, FolderOpen, RefreshCw, X } from "lucide-react";
import { localizeLabel, tr, useLocaleRender } from "../../i18n/index.js";
import { formatNumber } from "../../i18n/localeUtils.js";

const modalStack: HTMLDivElement[] = [];
let bodyOverflowBeforeDialog = "";
function updateModalStack() { modalStack.forEach((node, index) => { node.inert = index !== modalStack.length - 1; if (node.inert) node.setAttribute("aria-hidden", "true"); else node.removeAttribute("aria-hidden"); }); }

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
}

export function PageHeader({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: React.ReactNode; eyebrow?: string; actions?: React.ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p className="text-xs text-teal-700 font-semibold mb-2">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <div className="page-subtitle">{subtitle}</div>}</div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</header>;
}
export function SectionCard({ title, description, actions, children, className = "" }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`surface section-card ${className}`}>{(title || actions) && <div className="flex flex-wrap justify-between items-start gap-3 mb-5"><div>{title && <h2 className="font-semibold">{title}</h2>}{description && <p className="text-sm text-slate-500 mt-1">{description}</p>}</div>{actions}</div>}{children}</section>;
}
export function StatCard({ label, value, onClick, selected }: { label: string; value: number; onClick: () => void; selected?: boolean }) {
  return <button type="button" className={`surface stat-card ${selected ? "ring-1 ring-aicte-navy-400" : ""}`} onClick={onClick} aria-pressed={selected}><span className="text-[13px] font-medium text-slate-600 block pe-5">{label}</span><ArrowUpRight className="absolute end-4 top-5 w-4 h-4 text-slate-400" aria-hidden="true"/><span className="stat-value">{formatNumber(value)}</span></button>;
}
export function StatusBadge({ value, label }: { value: string; label?: string }) {
  useLocaleRender();
  const tone = /Disposed|Completed|Accepted|Approved|Active|Confirmed Related/.test(value) ? "success" : /Rejected|Escalated|Critical|Overdue/.test(value) ? "danger" : /Pending|Clarification|High|Rework|Review/.test(value) ? "warning" : /Process|Submitted|Transferred/.test(value) ? "info" : "neutral";
  return <span className="status-badge" data-tone={tone}>{label || localizeLabel(value)}</span>;
}
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="state-panel"><FolderOpen className="w-8 h-8" aria-hidden="true"/><p className="font-semibold text-slate-700">{title}</p>{description && <p className="text-sm mt-1">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  useLocaleRender();
  return <div className="error-state" role="alert"><span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true"/>{message}</span>{onRetry && <button className="btn-secondary shrink-0" onClick={onRetry}><RefreshCw className="w-4 h-4" aria-hidden="true"/>{tr("complaints:retry")}</button>}</div>;
}
export function LoadingSkeleton({ label }: { label: string }) {
  return <div role="status" className="surface section-card"><span className="sr-only">{label}</span><div aria-hidden="true" className="space-y-4"><div className="loading-line w-1/3"/><div className="loading-line w-full"/><div className="loading-line w-4/5"/><div className="loading-line w-2/3"/></div></div>;
}
/** Adds keyboard containment to existing modal actions without changing their submission logic. */
export function ModalFrame({ children, className, onClose }: { children: React.ReactNode; className?: string; onClose?: () => void }) {
  useLocaleRender();
  const root = useRef<HTMLDivElement>(null), headingId = useId();
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const node = root.current!;
    const previous = document.activeElement as HTMLElement | null;
    const heading = root.current?.querySelector("h1,h2,h3"); if (heading) heading.id = headingId; else node.removeAttribute("aria-labelledby");
    const focusable = () => Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []).filter(el => el.getClientRects().length);
    (focusable()[0] || root.current)?.focus();
    if (!modalStack.length) bodyOverflowBeforeDialog = document.body.style.overflow;
    modalStack.push(node); updateModalStack(); document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== node) return;
      if (event.key === "Escape" && closeRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); const index = modalStack.indexOf(node); if (index >= 0) modalStack.splice(index, 1); updateModalStack(); if (!modalStack.length) document.body.style.overflow = bodyOverflowBeforeDialog; if (previous?.isConnected && (!modalStack.length || modalStack.at(-1)?.contains(previous))) previous.focus(); };
  }, [headingId]);
  return <div ref={root} role="dialog" aria-modal="true" aria-label={tr("navigation:ui.reviewAction")} aria-labelledby={headingId} data-centered={className ? className.includes("items-center") : true} tabIndex={-1} className={className || "fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4 overflow-y-auto"}>{children}</div>;
}
export function ConfirmDialog({ title, description, busy, onConfirm, onClose }: { title: string; description: React.ReactNode; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  useLocaleRender();
  return <ModalFrame onClose={busy ? undefined : onClose}><section className="surface p-6 w-full max-w-md"><div className="flex justify-between items-start gap-4"><h2 className="font-semibold text-lg">{title}</h2><button type="button" className="icon-button -mt-2 -me-2" disabled={busy} onClick={onClose} aria-label={tr("common:cancel")}><X className="w-4 h-4"/></button></div><div className="text-sm text-slate-600 mt-3">{description}</div><div className="flex justify-end gap-2 mt-6"><button className="btn-secondary" disabled={busy} onClick={onClose}>{tr("common:cancel")}</button><button className="btn" disabled={busy} onClick={onConfirm}>{title}</button></div></section></ModalFrame>;
}
