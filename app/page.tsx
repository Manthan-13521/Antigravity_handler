"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trash, Flag, Search, AlertCircle, CheckCircle, Info } from "lucide-react";

import { getAccounts, saveStorage, getGlobalDuration, setGlobalDuration, addAccount, deleteAccount, importData, exportData, reconcileExpiration, seedAccountsIfEmpty } from "./lib/account-manager/storage";
import { getCountdownText, getStatusLabel, getSortOrder, getRecommendedSortOrder, checkExpiration } from "./lib/account-manager/expiration";
import { DEFAULT_GLOBAL_DURATION, Account } from "./lib/account-manager/types";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const TODAY = new Date();

function AccountCheckbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 ${
        checked
          ? "bg-green-600 border-2 border-green-500 text-white shadow-md shadow-green-600/30"
          : "bg-gray-700 border-2 border-gray-500 text-transparent hover:border-green-500 hover:bg-gray-600"
      }`}
    >
      {checked && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

const STATUS_CLASSES: Record<string, string> = {
  available: "bg-green-600/20 text-green-400 border-green-500/30",
  used: "bg-amber-600/20 text-amber-400 border-amber-500/30",
  expiringSoon: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30",
};

function StatusBadge({ label, countdown }: { label: string; countdown: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${STATUS_CLASSES[label] || "bg-red-600/20 text-red-400 border-red-500/30"}`}>
      {label}
      {countdown !== "—" && <span className="ml-1 opacity-70">| {countdown}</span>}
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

function getDaysAgo(resetAt: number): string {
  const diff = Math.floor((Date.now() - resetAt) / 86400000);
  if (diff === 0) return "Used today";
  if (diff === 1) return "Used 1 day ago";
  if (diff < 7) return `Used ${diff} days ago`;
  if (diff < 30) { const w = Math.floor(diff / 7); return `Used ${w} week${w > 1 ? "s" : ""} ago`; }
  const m = Math.floor(diff / 30);
  return `Used ${m} month${m > 1 ? "s" : ""} ago`;
}

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

  // Load once
  useEffect(() => {
    seedAccountsIfEmpty();
    setAccounts(getAccounts());
    setGlobalDur(getGlobalDuration());
  }, []);

  // Debounced save to localStorage
  useEffect(() => {
    if (accounts.length === 0 && !isModalOpen) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveStorage({ accounts, globalDuration });
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [accounts, globalDuration, isModalOpen]);

  // Check expiration on mount
  useEffect(() => { checkExpiration(); }, []);

  // Build account map for O(1) lookups
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  // Filter
  const filtered = useMemo(() => {
    if (!searchQuery) return accounts;
    const q = searchQuery.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [accounts, searchQuery]);

  // Sort
  const sorted = useMemo(() => getSortOrder(filtered, sortBy), [filtered, sortBy]);

  // Stats in one pass
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

  // Next available
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

  // Toast auto-dismiss
  const showToast = useCallback((type: "success" | "info" | "error", title: string, description: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, title, description });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Handlers
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
    <div className="min-h-screen bg-gray-900">
      <header className="border-b border-gray-700 bg-gray-800 py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="21" x2="21" y2="3" />
              <line x1="9" y1="21" x2="3" y2="3" />
            </svg>
            <span className="text-xl font-bold">ANTIGRAVITY ACCOUNT MANAGER</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="pl-8 bg-gray-800 border border-gray-700 rounded-full h-10 w-56 focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              {(["recommended", "availableFirst", "resetSoonest", "accountName"] as const).map((key, i) => (
                <span key={key}>
                  {i > 0 && <span className="mx-1 text-gray-600">•</span>}
                  <button
                    onClick={() => setSortBy(key)}
                    className={`transition-colors ${sortBy === key ? "font-semibold text-green-400" : "text-gray-400 hover:text-gray-300"}`}
                  >
                    {key === "recommended" ? "ALL" : key === "availableFirst" ? "AVAILABLE" : key === "resetSoonest" ? "EXPIRING" : "NAME"}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-2 border-b border-gray-700">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            { label: "TOTAL", value: stats.total, cls: "border-gray-700", text: "text-white" },
            { label: "AVAILABLE", value: stats.available, cls: "border-green-600/20", text: "text-green-300", labelCls: "text-green-400" },
            { label: "IN USE", value: stats.used, cls: "border-amber-500/20", text: "text-amber-300", labelCls: "text-amber-400" },
            { label: "EXPIRING SOON", value: stats.expiringSoon, cls: "border-yellow-500/20", text: "text-yellow-300", labelCls: "text-yellow-400" },
            { label: "RESET TODAY", value: stats.resetToday, cls: "border-red-500/20", text: "text-red-300", labelCls: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className={`bg-gray-800 border ${s.cls} rounded-lg p-3`}>
              <span className={`text-xs ${s.labelCls || "text-gray-400"}`}>{s.label}</span>
              <span className={`text-xl font-bold ${s.text} ml-2`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <Flag className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">NEXT AVAILABLE</p>
              {nextAvailable ? (
                <div className="mt-1">
                  <span className={nextAvailable.label === "Available now" ? "text-green-400 font-medium" : "text-yellow-400"}>
                    {nextAvailable.label}
                  </span>
                  {nextAvailable.resetText && <span className="text-xs text-gray-500 ml-2">Resets {nextAvailable.resetText}</span>}
                </div>
              ) : (
                <p className="text-gray-500 mt-1">No accounts with availability info</p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <button onClick={() => { setIsModalOpen(true); setFormData({ name: "", email: "", notes: "", duration: globalDuration }); }} className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
            + Add Account
          </button>
          <button onClick={toggleDeleteMode} className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-colors ${deleteMode ? "bg-red-600 text-white hover:bg-red-700" : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"}`}>
            <Trash className="w-4 h-4" />
            {deleteMode ? `Cancel (${selectedForDelete.size})` : "Delete Accounts"}
          </button>
          {deleteMode && selectedForDelete.size > 0 && (
            <button onClick={handleDeleteSelected} className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
              <Trash className="w-4 h-4" />
              Delete {selectedForDelete.size}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={handleExport} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors border border-gray-600">Export</button>
            <label className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors border border-gray-600 cursor-pointer">
              Import
              <input type="file" accept=".json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-white mb-4">Add Account</h3>
              <form onSubmit={(e) => { e.preventDefault(); if (formData.name.trim() && formData.email.trim()) handleAdd(formData); }}>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Account name</label>
                    <input type="text" name="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Account 01" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 transition-colors" required autoFocus />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="account@example.com" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 resize-none transition-colors" rows={2} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Usage duration</label>
                    <select value={formData.duration} onChange={(e) => setFormData((p) => ({ ...p, duration: parseInt(e.target.value, 10) }))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 appearance-none">
                      {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700 transition-colors font-medium">ADD</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
            <Flag className="w-12 h-12 mx-auto mb-4 text-gray-600 opacity-50" />
            <h3 className="text-xl font-bold text-gray-300">No accounts yet</h3>
            <p className="text-gray-500 mt-2">Add your accounts to start tracking rotation</p>
            <button onClick={() => { setIsModalOpen(true); setFormData({ name: "", email: "", notes: "", duration: globalDuration }); }} className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
              + Add Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800">
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 w-12">#</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">ACCOUNT</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">EMAIL</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">STATUS</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">RESET</th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-gray-400 w-16">{deleteMode ? "SELECT" : "USE"}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((id: string, idx: number) => {
                  const acc = accountMap.get(id);
                  if (!acc) return null;
                  const { label, countdown } = getStatusLabel(acc.resetAt, acc.usageDuration);
                  const isUsed = acc.status === "used";
                  return (
                    <tr key={id} className={`border-b border-gray-800/50 transition-colors duration-150 ${deleteMode && selectedForDelete.has(id) ? "bg-red-900/20 ring-1 ring-red-500/30" : acc.status === "available" ? "bg-gray-900 hover:bg-gray-800/70" : "bg-gray-800/50 hover:bg-gray-700/50"}`}>
                      <td className="px-4 py-4 text-sm text-gray-500 w-12">{idx + 1}</td>
                      <td className="px-4 py-4 text-white font-medium text-base">{acc.name}</td>
                      <td className="px-4 py-4 text-sm text-gray-400">{acc.email}</td>
                      <td className="px-4 py-4"><StatusBadge label={label} countdown={countdown} /></td>
                      <td className="px-4 py-4 text-sm text-gray-400">{acc.resetAt ? new Date(acc.resetAt).toLocaleString() : "—"}</td>
                      <td className="px-4 py-4 text-right">
                        <AccountCheckbox
                          checked={deleteMode ? selectedForDelete.has(id) : isUsed}
                          onToggle={() => deleteMode ? toggleSelect(id) : handleToggle(id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-6 py-3 shadow-lg text-sm font-medium z-50 ${
            toast.type === "success" ? "bg-green-600/90 text-white" : toast.type === "info" ? "bg-blue-600/90 text-white" : "bg-red-600/90 text-white"
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === "success" && <CheckCircle className="w-4 h-4" />}
              {toast.type === "info" && <Info className="w-4 h-4" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
              <span>{toast.title}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}