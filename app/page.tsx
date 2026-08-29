"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trash, Flag, Search, AlertCircle, CheckCircle, Info, Zap } from "lucide-react";

import { getAccounts, saveStorage, getGlobalDuration, setGlobalDuration, addAccount, deleteAccount, importData, exportData, reconcileExpiration, seedAccountsIfEmpty } from "./lib/account-manager/storage";
import { getCountdownText, getStatusLabel, getSortOrder, getRecommendedSortOrder, checkExpiration } from "./lib/account-manager/expiration";
import { DEFAULT_GLOBAL_DURATION, Account } from "./lib/account-manager/types";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const TODAY = new Date();

function AccountCheckbox({ checked, onToggle, deleteMode }: { checked: boolean; onToggle: () => void; deleteMode: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150 ${
        checked
          ? "bg-[var(--accent)] border border-[var(--accent-dim)] text-white checkbox-checked"
          : deleteMode
            ? "border-2 border-[var(--text-muted)] text-transparent hover:border-[var(--accent)] hover:bg-[var(--accent-glow)]"
            : "border-2 border-[var(--border)] text-transparent hover:border-[var(--accent)] hover:bg-[var(--accent-glow)]"
      }`}
    >
      {checked && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function StatusBadge({ label, countdown }: { label: string; countdown: string }) {
  const cls = label === "available"
    ? "bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)]/20"
    : label === "used"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : label === "expiringSoon"
        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
        : "bg-red-500/10 text-red-400 border-red-500/20";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${cls}`}>
      {label === "available" && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
      {label}
      {countdown !== "—" && <span className="opacity-60">| {countdown}</span>}
    </span>
  );
}

const DURATION_OPTIONS = [
  { value: 1, label: "1 Day" },
  { value: 2, label: "2 Days" },
  { value: 3, label: "3 Days" },
  { value: 7, label: "7 Days" },
  { value: 15, label: "15 Days" },
  { value: 30, label: "1 Month" },
];

function formatMs(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Page() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [globalDuration, setGlobalDur] = useState<number>(DEFAULT_GLOBAL_DURATION);
  const [sortBy, setSortBy] = useState<"recommended" | "availableFirst" | "resetSoonest" | "accountName">("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", notes: "", duration: SEVEN_DAYS });
  const [toast, setToast] = useState<{ type: "success" | "info" | "error"; title: string; description: string } | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    seedAccountsIfEmpty();
    setAccounts(getAccounts());
    setGlobalDur(getGlobalDuration());
  }, []);

  useEffect(() => {
    if (accounts.length === 0 && !isModalOpen) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveStorage({ accounts, globalDuration });
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [accounts, globalDuration, isModalOpen]);

  useEffect(() => { checkExpiration(); }, []);

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const filtered = useMemo(() => {
    if (!searchQuery) return accounts;
    const q = searchQuery.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [accounts, searchQuery]);

  const sorted = useMemo(() => getSortOrder(filtered, sortBy), [filtered, sortBy]);

  const stats = useMemo(() => {
    let total = 0, available = 0, used = 0, expiringSoon = 0, resetToday = 0;
    const now = Date.now();
    const todayStart = TODAY.getFullYear() * 10000 + TODAY.getMonth() * 100 + TODAY.getDate();
    for (const a of accounts) {
      total++;
      if (a.status === "available") { available++; continue; }
      if (a.status === "used") {
        used++;
        if (a.resetAt) {
          if (now < a.resetAt && now > a.resetAt - 86400000) expiringSoon++;
          const r = new Date(a.resetAt);
          const rd = r.getFullYear() * 10000 + r.getMonth() * 100 + r.getDate();
          if (rd === todayStart) resetToday++;
        }
      }
    }
    return { total, available, used, expiringSoon, resetToday };
  }, [accounts]);

  const nextAvailable = useMemo(() => {
    const rec = getRecommendedSortOrder(accounts);
    for (const id of rec) {
      const a = accountMap.get(id);
      if (a && a.status === "available") return { id, label: "Available now", resetText: "" };
    }
    let earliest: Account | null = null;
    for (const a of accounts) {
      if (a.status === "used" && a.resetAt) {
        if (!earliest || a.resetAt < earliest.resetAt!) earliest = a;
      }
    }
    if (earliest && earliest.resetAt) {
      const remaining = earliest.resetAt - Date.now();
      const h = Math.max(0, Math.ceil(remaining / 3600000));
      const m = Math.max(0, Math.ceil((remaining % 3600000) / 60000));
      return { id: earliest.id, label: `in ${h}h ${m}m`, resetText: new Date(earliest.resetAt).toLocaleString() };
    }
    return null;
  }, [accounts, accountMap]);

  const showToast = useCallback((type: "success" | "info" | "error", title: string, description: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, title, description });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleAdd = useCallback((data: { name: string; email: string; notes?: string; duration: number }) => {
    const newAcc = addAccount({ name: data.name, email: data.email, notes: data.notes, status: "available", usageDuration: data.duration });
    setAccounts((p) => [...p, newAcc]);
    setIsModalOpen(false);
    showToast("success", "Account added", `"${data.name}" added successfully`);
  }, [showToast]);

  const handleToggle = useCallback((id: string) => {
    const acc = accountMap.get(id);
    if (!acc) return;
    if (acc.status === "available") {
      const dur = acc.usageDuration ?? globalDuration;
      const now = Date.now();
      setAccounts((p) => p.map((a) => a.id === id ? { ...a, status: "used", usedAt: now, resetAt: now + dur, usageDuration: dur } : a));
      showToast("success", "Account used", `"${acc.name}" resets in ${formatMs(dur)}`);
    } else {
      setAccounts((p) => p.map((a) => a.id === id ? { ...a, status: "available", usedAt: null, resetAt: null } : a));
      showToast("success", "Account available", `"${acc.name}" is now available`);
    }
  }, [accountMap, globalDuration, showToast]);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedForDelete.size;
    if (!count) return;
    setAccounts((p) => p.filter((a) => !selectedForDelete.has(a.id)));
    setDeleteMode(false);
    setSelectedForDelete(new Set());
    showToast("info", `${count} account${count > 1 ? "s" : ""} deleted`, "Removed from your tracker");
  }, [selectedForDelete, showToast]);

  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "antigravity-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Exported", "Data exported successfully");
  }, [showToast]);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result !== "string") return;
      const result = importData(JSON.parse(e.target.result));
      if (result.success) {
        setAccounts(getAccounts());
        showToast("success", "Import successful", `${result.imported} accounts imported`);
      } else {
        showToast("error", "Import failed", "Could not parse data");
      }
    };
    reader.readAsText(file);
  }, [showToast]);

  const toggleDeleteMode = useCallback(() => { setDeleteMode((p) => !p); setSelectedForDelete(new Set()); }, []);
  const toggleSelect = useCallback((id: string) => {
    setSelectedForDelete((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-glow)" }}>
              <Zap className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Antigravity</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-9 rounded-lg h-9 w-48 text-sm focus:outline-none focus:ring-1 transition-all"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", ['--tw-ring-color' as string]: "var(--accent)" }}
              />
            </div>
            <div className="flex items-center gap-1 text-xs">
              {(["recommended", "availableFirst", "resetSoonest", "accountName"] as const).map((key, i) => (
                <span key={key}>
                  {i > 0 && <span style={{ color: "var(--text-muted)" }} className="mx-0.5">/</span>}
                  <button
                    onClick={() => setSortBy(key)}
                    className="px-2 py-1 rounded transition-all"
                    style={{
                      color: sortBy === key ? "var(--accent)" : "var(--text-muted)",
                      background: sortBy === key ? "var(--accent-glow)" : "transparent",
                    }}
                  >
                    {key === "recommended" ? "ALL" : key === "availableFirst" ? "AVAIL" : key === "resetSoonest" ? "EXPIRING" : "NAME"}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "TOTAL", value: stats.total, color: "var(--text-primary)" },
              { label: "AVAILABLE", value: stats.available, color: "var(--accent)" },
              { label: "IN USE", value: stats.used, color: "var(--warning)" },
              { label: "EXPIRING", value: stats.expiringSoon, color: "#eab308" },
              { label: "RESET TODAY", value: stats.resetToday, color: "var(--danger)" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                <div className="text-2xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Next Available */}
        <div className="rounded-xl p-4 mb-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(234, 179, 8, 0.1)" }}>
              <Flag className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Next Available</div>
              {nextAvailable ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-semibold" style={{ color: nextAvailable.label === "Available now" ? "var(--accent)" : "var(--warning)" }}>
                    {nextAvailable.label}
                  </span>
                  {nextAvailable.resetText && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Resets {nextAvailable.resetText}</span>}
                </div>
              ) : (
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>All accounts available</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => { setIsModalOpen(true); setFormData({ name: "", email: "", notes: "", duration: globalDuration }); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
            Add Account
          </button>
          <button
            onClick={toggleDeleteMode}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: deleteMode ? "var(--danger)" : "var(--surface-elevated)",
              color: deleteMode ? "white" : "var(--text-secondary)",
              border: `1px solid ${deleteMode ? "var(--danger)" : "var(--border)"}`,
            }}
          >
            <Trash className="w-4 h-4" />
            {deleteMode ? `Cancel (${selectedForDelete.size})` : "Delete"}
          </button>
          {deleteMode && selectedForDelete.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: "var(--danger)", color: "white" }}
            >
              <Trash className="w-4 h-4" />
              Delete {selectedForDelete.size}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={handleExport} className="px-4 py-2 rounded-lg text-xs font-medium transition-colors" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Export</button>
            <label className="px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Import
              <input type="file" accept=".json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setIsModalOpen(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-5" style={{ color: "var(--text-primary)" }}>Add Account</h3>
              <form onSubmit={(e) => { e.preventDefault(); if (formData.name.trim() && formData.email.trim()) handleAdd(formData); }}>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Name</label>
                    <input type="text" name="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Antigravity 16" className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }} required autoFocus />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Email</label>
                    <input type="email" name="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="account@gmail.com" className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 resize-none transition-all" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }} rows={2} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Duration</label>
                    <select value={formData.duration} onChange={(e) => setFormData((p) => ({ ...p, duration: parseInt(e.target.value, 10) }))} className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 appearance-none transition-all" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
                  <button type="submit" className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors" style={{ background: "var(--accent)", color: "white" }}>Add</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        {accounts.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>No accounts yet</h3>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Add accounts to start tracking</p>
            <button onClick={() => { setIsModalOpen(true); setFormData({ name: "", email: "", notes: "", duration: globalDuration }); }} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "white" }}>
              + Add Account
            </button>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium w-12" style={{ color: "var(--text-muted)" }}>#</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Account</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Email</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Resets</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-medium w-16" style={{ color: "var(--text-muted)" }}>{deleteMode ? "Select" : "Use"}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((id: string, idx: number) => {
                  const acc = accountMap.get(id);
                  if (!acc) return null;
                  const { label, countdown } = getStatusLabel(acc.resetAt, acc.usageDuration);
                  const isUsed = acc.status === "used";
                  const isSelected = deleteMode && selectedForDelete.has(id);
                  return (
                    <tr
                      key={id}
                      className="table-row transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        background: isSelected ? "rgba(239, 68, 68, 0.08)" : acc.status === "available" ? "var(--surface)" : "transparent",
                      }}
                    >
                      <td className="px-4 py-3 text-xs w-12" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-sm" style={{ color: "var(--text-primary)" }}>{acc.name}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{acc.email}</td>
                      <td className="px-4 py-3"><StatusBadge label={label} countdown={countdown} /></td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{acc.resetAt ? new Date(acc.resetAt).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <AccountCheckbox
                          checked={isSelected || (!deleteMode && isUsed)}
                          onToggle={() => deleteMode ? toggleSelect(id) : handleToggle(id)}
                          deleteMode={deleteMode}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl px-5 py-3 shadow-2xl text-sm font-medium z-50 flex items-center gap-2" style={{
            background: toast.type === "success" ? "var(--accent)" : toast.type === "info" ? "#3b82f6" : "var(--danger)",
            color: "white",
          }}>
            {toast.type === "success" && <CheckCircle className="w-4 h-4" />}
            {toast.type === "info" && <Info className="w-4 h-4" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
            <span>{toast.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}