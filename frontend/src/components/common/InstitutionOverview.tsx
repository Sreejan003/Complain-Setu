import { EmptyState, LoadingSkeleton, ErrorState } from "../ui/Interface.js";
import React, { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../../i18n/index.js";
import { formatNumber } from "../../i18n/localeUtils.js";
import { field, button, panel } from "../dashboard/DashboardUI.js";
import type { Institution, InstitutionDashboardMetrics } from "../../services/types.js";

type Row = Institution & { pendingComplaintsCount?: number; handlingBureaus?: string[] };
const t = (key: string, values?: Record<string, unknown>) => tr("complaints:institutionOverview." + key, values);

const DEFAULT_REGION_STATE_MAP: Record<string, string[]> = {
  "Central Region (Bhopal)": ["Chhattisgarh", "Gujarat", "Madhya Pradesh"],
  "Eastern Region (Kolkata)": ["Andaman and Nicobar Islands", "Arunachal Pradesh", "Assam", "Bihar", "Jharkhand", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Orissa", "Sikkim", "Tripura", "West Bengal"],
  "Northern Region (Kanpur)": ["Uttar Pradesh", "Uttarakhand"],
  "North-Western Region (Chandigarh)": ["Chandigarh", "Delhi", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Punjab", "Rajasthan"],
  "South-Central Region (Hyderabad)": ["Andhra Pradesh"],
  "South-Western Region (Bangalore)": ["Karnataka", "Kerala"],
  "Southern Region (Chennai)": ["Puducherry", "Tamil Nadu"],
  "Western Region (Mumbai)": ["Dadra and Nagar Haveli", "Daman and Diu", "Goa", "Maharashtra"]
};

export function InstitutionSearch({ onSelect }: { onSelect: (id: string) => void }) {
  useLocaleRender();
  const [filters, setFilters] = useState({
    search: "",
    stateOrRegion: "",
    institutionType: "",
    complaintStatus: ""
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [pages, setPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regionStateMap, setRegionStateMap] = useState<Record<string, string[]>>(DEFAULT_REGION_STATE_MAP);
  const [regionsList, setRegionsList] = useState<string[]>(Object.keys(DEFAULT_REGION_STATE_MAP));

  useEffect(() => {
    async function loadMeta() {
      try {
        const meta = await api.getInstitutionFilters();
        if (meta.regions && meta.regions.length > 0) setRegionsList(meta.regions);
        if (meta.stateRegionPairs && meta.stateRegionPairs.length > 0) {
          const map: Record<string, string[]> = {};
          for (const pair of meta.stateRegionPairs) {
            if (!map[pair.region]) map[pair.region] = [];
            if (!map[pair.region].includes(pair.state)) map[pair.region].push(pair.state);
          }
          setRegionStateMap(map);
        }
      } catch (err) {
        console.error("Failed to load region/state metadata:", err);
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const params: any = {
          search: filters.search.trim() || undefined,
          institutionType: filters.institutionType || undefined,
          complaintStatus: filters.complaintStatus || undefined,
          page,
          limit: 10
        };
        if (filters.stateOrRegion) {
          if (filters.stateOrRegion.startsWith("region:")) {
            params.region = filters.stateOrRegion.replace("region:", "");
          } else if (filters.stateOrRegion.startsWith("state:")) {
            params.state = filters.stateOrRegion.replace("state:", "");
          } else {
            params.stateOrRegion = filters.stateOrRegion;
          }
        }
        const result = await api.getInstitutions(params);
        if (active) {
          setRows(result.data);
          setPages(result.pagination.totalPages);
          setTotalCount(result.pagination.total);
          setError("");
        }
      } catch (e) {
        if (active) {
          setRows([]);
          setTotalCount(0);
          setError(localizeError(e instanceof Error ? e.message : ""));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    setLoading(true);
    const debounce = setTimeout(load, 250);
    const poll = setInterval(load, 30000);
    return () => {
      active = false;
      clearTimeout(debounce);
      clearInterval(poll);
    };
  }, [filters, page]);

  const activeScopeName = filters.stateOrRegion
    ? filters.stateOrRegion.replace(/^(region|state):/, "")
    : t("allStatesRegions");

  return (
    <section className={panel} id="institution-directory">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="font-bold text-base text-aicte-navy-900">{tr("navigation:ui.directoryTitle")}</h2>
          <p className="text-xs text-slate-500">
            {t("directorySubtitle", { count: formatNumber(totalCount) })}
          </p>
        </div>
        {filters.stateOrRegion && (
          <span className="text-xs font-semibold text-aicte-navy-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
            {t("territoryScope", { scope: activeScopeName })}
          </span>
        )}
      </div>

      <div className="filter-bar mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Merged State & Region Filter Dropdown */}
        <label className="text-xs font-semibold text-slate-700">
          {t("location")}
          <select
            className={`${field} block w-full mt-1 font-medium`}
            value={filters.stateOrRegion}
            onChange={e => {
              setFilters({ ...filters, stateOrRegion: e.target.value });
              setPage(1);
            }}
          >
            <option value="">{t("allStatesRegions")}</option>
            {regionsList.map(r => {
              const states = regionStateMap[r] || [];
              return (
                <optgroup key={r} label={r}>
                  <option value={`region:${r}`}>{t("all")} {r}</option>
                  {states.map(st => (
                    <option key={st} value={`state:${st}`}>
                      {st} ({r.split(" ")[0]})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>

        {/* Search Institution Among These */}
        <label className="text-xs font-semibold text-slate-700 sm:col-span-1 lg:col-span-2">
          <span>{t("searchAmongThese")}</span>
          <div className="relative mt-1">
            <input
              id="swp-global-search"
              placeholder={t("searchPlaceholder")}
              className={`${field} block w-full pe-8`}
              value={filters.search}
              onChange={e => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => {
                  setFilters({ ...filters, search: "" });
                  setPage(1);
                }}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 text-xs"
                title={tr("complaints:clearSearch")}
              >
                ✕
              </button>
            )}
          </div>
        </label>

        {/* Institution Type Filter */}
        <label className="text-xs font-semibold text-slate-700">
          {t("institutionType")}
          <select
            className={`${field} block w-full mt-1`}
            value={filters.institutionType}
            onChange={e => {
              setFilters({ ...filters, institutionType: e.target.value });
              setPage(1);
            }}
          >
            <option value="">{t("all")}</option>
            {["Engineering", "Management", "Pharmacy", "Polytechnic", "Architecture"].map(v => (
              <option key={v} value={v}>
                {localizeLabel(v)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-slate-500 font-medium">
          {filters.search
            ? t("matchingInScope", { search: filters.search, scope: activeScopeName })
            : t("showingInScope", { scope: activeScopeName })}
        </span>
        {(filters.search || filters.stateOrRegion || filters.institutionType || filters.complaintStatus) && (
          <button
            className="text-aicte-navy-700 hover:underline font-semibold cursor-pointer"
            onClick={() => {
              setFilters({ search: "", stateOrRegion: "", institutionType: "", complaintStatus: "" });
              setPage(1);
            }}
          >
            {t("clear")} ({tr("complaints:resetAllFilters")})
          </button>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {loading ? (
        <LoadingSkeleton label={t("loading")} />
      ) : rows.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 border border-slate-200 rounded-lg p-4 mt-2">
          <p className="font-semibold text-slate-800 text-sm">{t("empty")}</p>
          <p className="text-xs text-slate-500 mt-1">
            {filters.search
              ? t("noFoundInScope", { search: filters.search, scope: activeScopeName })
              : t("noRecordsInScope", { scope: activeScopeName })}
          </p>
          <button
            className="mt-3 text-xs font-semibold text-white bg-aicte-navy-700 hover:bg-aicte-navy-800 px-3.5 py-1.5 rounded cursor-pointer transition shadow-xs"
            onClick={() => {
              setFilters({ search: "", stateOrRegion: "", institutionType: "", complaintStatus: "" });
              setPage(1);
            }}
          >
            {tr("complaints:resetAllFilters")}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm text-start">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th scope="col" className="p-2.5 text-start">{t("name")}</th>
                <th scope="col" className="p-2.5 text-start">{t("permanentId")}</th>
                <th scope="col" className="p-2.5 text-start">{t("location")}</th>
                <th scope="col" className="p-2.5 text-center">{t("total")}</th>
                <th scope="col" className="p-2.5 text-center">{t("pending")}</th>
                <th scope="col" className="p-2.5 text-start">{t("bureaus")}</th>
                <th scope="col" className="p-2.5 text-center">{t("overlaps")}</th>
                <th scope="col" className="p-2.5 text-end">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(i => (
                <tr key={i.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-2.5 font-medium text-slate-900">
                    <bdi>{i.name}</bdi>
                    <div className="text-xs text-slate-500 font-normal">{i.city}{i.district ? `, ${i.district}` : ""}</div>
                  </td>
                  <td className="p-2.5 font-mono text-xs font-bold text-aicte-navy-900">
                    <bdi dir="ltr">{i.aictePermanentId}</bdi>
                  </td>
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-800 text-xs">{i.state || t("unavailable")}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{i.region || t("unavailable")}</div>
                  </td>
                  <td className="p-2.5 text-center font-mono font-bold text-xs">{formatNumber(i.totalComplaintsCount)}</td>
                  <td className="p-2.5 text-center font-mono text-xs">
                    {(i.pendingComplaintsCount || 0) > 0 ? (
                      <span className="font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {formatNumber(i.pendingComplaintsCount)}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="p-2.5 text-xs text-slate-600">{i.handlingBureaus?.join(", ") || t("unavailable")}</td>
                  <td className="p-2.5 text-center font-mono text-xs">{formatNumber(i.overlapCount)}</td>
                  <td className="p-2.5 text-end">
                    <button
                      className={`${button} text-xs py-1 px-3 bg-aicte-navy-700 hover:bg-aicte-navy-800 text-white font-semibold cursor-pointer transition`}
                      onClick={() => {
                        onSelect(i.id);
                        setTimeout(() => {
                          const el = document.getElementById("institution-command-center") || document.querySelector(".page-header");
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }, 80);
                      }}
                      title={t("selectViewTitle", { name: i.name })}
                    >
                      {t("selectView")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="flex gap-3 items-center justify-between mt-4 pt-3 border-t border-slate-100" aria-label={t("directory")}>
        <button className={field} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          {tr("dashboard:previous")}
        </button>
        <span className="text-xs text-slate-600 font-medium">
          {formatNumber(page)} / {formatNumber(Math.max(1, pages))} ({formatNumber(totalCount)} {tr("complaints:records_c7b99")})
        </span>
        <button className={field} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
          {tr("dashboard:next")}
        </button>
      </nav>
    </section>
  );
}

export function InstitutionInvolvement({ metrics }: { metrics: InstitutionDashboardMetrics | null }) {
  useLocaleRender();
  if (!metrics) return null;
  const institution = metrics.institution;
  return (
    <section className={panel}>
      <div className="flex flex-wrap justify-between gap-3 mb-5">
        <h2 className="font-semibold">{t("profile")}</h2>
        <a href="#institution-directory" className="text-sm text-aicte-navy-700 underline">
          {tr("navigation:ui.directoryTitle")}
        </a>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <dl className="grid sm:grid-cols-2 gap-x-5 gap-y-4 text-sm">
          {["institutionType", "address", "contactEmail", "contactPhone", "accreditationStatus"].map(key => (
            <div key={key}>
              <dt className="text-xs text-slate-500 mb-1">{t(key)}</dt>
              <dd className="font-medium">
                <bdi dir="auto">{String(institution[key as keyof Institution] || t("unavailable"))}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="font-semibold mb-3">{t("bureaus")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr>
                  {["bureaus", "total", "pending"].map(k => (
                    <th scope="col" key={k}>
                      {t(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.bureauInvolvement?.map(b => (
                  <tr key={b.bureau}>
                    <td>
                      <bdi dir="ltr">{b.bureau}</bdi>
                    </td>
                    <td>{formatNumber(b.total)}</td>
                    <td>{formatNumber(b.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-3 text-slate-600">
            {localizeLabel("Overdue")}: {formatNumber(metrics.kpis.overdueCount)} · {localizeLabel("High")}: {formatNumber(metrics.kpis.highPriorityCount)} · {localizeLabel("Transferred")}: {formatNumber(metrics.kpis.transferredCount)}
          </p>
        </div>
      </div>
      <details className="mt-5 border-t border-slate-100 pt-4">
        <summary className="font-medium text-sm text-aicte-navy-700 cursor-pointer">{t("coordination")}</summary>
        {metrics.coordination?.length ? (
          metrics.coordination.map((o, i) => (
            <p className="text-sm mt-3" key={i}>
              <bdi dir="ltr">{o.bureauA} / {o.bureauB}</bdi> · {localizeLabel(o.status)}
            </p>
          ))
        ) : (
          <p className="text-sm mt-3">{t("emptyCoordination")}</p>
        )}
      </details>
    </section>
  );
}
