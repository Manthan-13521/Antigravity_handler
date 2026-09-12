"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trash, Flag, Search, AlertCircle, CheckCircle, Info, Zap, Menu, X, Pencil, Plus } from "lucide-react";

import { getAccounts, saveStorage, getGlobalDuration, setGlobalDuration, addAccount, deleteAccount, importData, exportData, reconcileExpiration, seedAccountsIfEmpty, getColumns, getColumnState, toggleAccountColumn, addTrackerColumn, renameTrackerColumn, setTrackerColumnDuration, deleteTrackerColumn, syncMissingSeeds } from "./lib/account-manager/storage";
import { getCountdownText, getStatusLabel, getSortOrder, getRecommendedSortOrder, checkExpiration } from "./lib/account-manager/expiration";
import { DEFAULT_GLOBAL_DURATION, Account, TrackerColumn } from "./lib/account-manager/types";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const TODAY = new Date();
const DELETE_COLUMN_PASSWORD = "625017172";

function AccountCheckbox({ checked, onToggle, deleteMode }: { checked: boolean; onToggle: () => void; deleteMode: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-7 h-7 min-w-[28px] min-h-[28px] rounded flex items-center justify-center transition-all"
      style={{
        background: checked ? "var(--accent)" : "transparent",
        border: `2px solid ${checked ? "var(--accent)" : deleteMode ? "var(--danger)" : "var(--border)"}`,
        color: checked ? "white" : "transparent",
        boxShadow: checked ? "0 0 12px rgba(34, 197, 94, 0.4)" : "none",
      }}
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
    ? "bg-[var(--accent-glow)] text-[var(--accent)]"
    : label === "used"
      ? "bg-amber-500/10 text-amber-400"
      : label === "expiringSoon"
        ? "bg-yellow-500/10 text-yellow-400"
        : "bg-red-500/10 text-red-400";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium ${cls}`}>
      {label === "available" && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label === "available" ? "AVAIL" : label === "used" ? "USED" : label === "expiringSoon" ? "EXP" : label}</span>
      {countdown !== "—" && <span className="opacity-60 hidden sm:inline">| {countdown}</span>}
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

const DAY_MS = 24 * 60 * 60 * 1000;
const COLUMN_DURATION_OPTIONS = [1, 2, 3, 7, 15, 30].map((d) => ({ days: d, ms: d * DAY_MS, label: d === 30 ? "1 Month" : `${d} Day${d > 1 ? "s" : ""}` }));

function columnDurationLabel(ms: number): string {
  const opt = COLUMN_DURATION_OPTIONS.find((o) => o.ms === ms);
  if (opt) return opt.label;
  return formatMs(ms);
}

function formatMs(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
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
  const [showSearch, setShowSearch] = useState(false);
  const [columns, setColumns] = useState<TrackerColumn[]>([]);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName, setEditColName] = useState("");
  const [editColDuration, setEditColDuration] = useState<number>(7 * DAY_MS);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDuration, setNewColDuration] = useState<number>(7 * DAY_MS);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    seedAccountsIfEmpty();
    setAccounts(getAccounts());
    setGlobalDur(getGlobalDuration());
    setColumns(getColumns());
  }, []);

  useEffect(() => {
    if (accounts.length === 0 && !isModalOpen) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveStorage({ accounts, globalDuration, columns });
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [accounts, globalDuration, columns, isModalOpen]);

  useEffect(() => { checkExpiration(); }, []);

  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

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
    const first = columns[0];
    if (!first) return;
    handleToggleColumn(id, first.id);
  }, [columns]);

  const handleToggleColumn = useCallback((id: string, columnId: string) => {
    const acc = accountMap.get(id);
    const col = columns.find((c) => c.id === columnId);
    if (!acc || !col) return;
    const before = getColumnState(acc, columnId, col.duration);
    toggleAccountColumn(id, columnId);
    setAccounts(getAccounts());
    setColumns(getColumns());
    if (before.status === "available") {
      showToast("success", `${col.name} used`, `"${acc.name}" resets in ${formatMs(col.duration)}`);
    } else {
      showToast("success", `${col.name} available`, `"${acc.name}" is now available`);
    }
  }, [accountMap, columns, showToast]);

  const startEditColumn = useCallback((col: TrackerColumn) => {
    setEditingColId(col.id);
    setEditColName(col.name);
    setEditColDuration(col.duration);
    setIsAddingColumn(false);
  }, []);

  const saveEditColumn = useCallback(() => {
    if (!editingColId) return;
    const nameOk = editColName.trim() ? renameTrackerColumn(editingColId, editColName) : undefined;
    // Allow duration-only change even if the name is unchanged/blank-submitted.
    setTrackerColumnDuration(editingColId, editColDuration);
    setColumns(getColumns());
    setAccounts(getAccounts());
    setEditingColId(null);
    if (nameOk || editColName.trim()) showToast("success", "Column updated", `"${editColName.trim() || "column"}" · ${columnDurationLabel(editColDuration)}`);
  }, [editingColId, editColName, editColDuration, showToast]);

  const handleAddColumn = useCallback(() => {
    const name = newColName.trim() || `COL ${columns.length + 1}`;
    addTrackerColumn(name, newColDuration);
    setColumns(getColumns());
    setAccounts(getAccounts());
    setNewColName("");
    setNewColDuration(7 * DAY_MS);
    setIsAddingColumn(false);
    showToast("success", "Column added", `"${name}" · ${columnDurationLabel(newColDuration)}`);
  }, [newColName, newColDuration, columns.length, showToast]);

  const handleDeleteColumn = useCallback((columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    const input = window.prompt(`Enter password to delete column "${col?.name ?? "column"}":`);
    if (input === null) return;
    if (input !== DELETE_COLUMN_PASSWORD) {
      showToast("error", "Wrong password", "Column was not deleted");
      return;
    }
    const ok = deleteTrackerColumn(columnId);
    if (ok) {
      setColumns(getColumns());
      setAccounts(getAccounts());
      if (editingColId === columnId) setEditingColId(null);
      showToast("info", "Column deleted", col ? `"${col.name}" removed` : "Removed");
    } else {
      showToast("error", "Cannot delete", "At least one column must remain");
    }
  }, [columns, editingColId, showToast]);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedForDelete.size;
    if (!count) return;
    setAccounts((p) => p.filter((a) => !selectedForDelete.has(a.id)));
    setDeleteMode(false);
    setSelectedForDelete(new Set());
    showToast("info", `${count} account${count > 1 ? "s" : ""} deleted`, "Removed from your tracker");
  }, [selectedForDelete, showToast]);

  const handleSyncSeeds = useCallback(() => {
    const added = syncMissingSeeds();
    setAccounts(getAccounts());
    setColumns(getColumns());
    if (added > 0) {
      showToast("success", "Seeds synced", `${added} missing account${added > 1 ? "s" : ""} added`);
    } else {
      showToast("info", "Already up to date", "No missing seed accounts");
    }
  }, [showToast]);

  const handleExport = useCallback(() => {    const data = exportData();
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
        setColumns(getColumns());
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
      <header className="border-b sticky top-0 z-40" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-glow)" }}>
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "var(--accent)" }} />
            </div>
            <span className="text-base sm:text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Antigravity</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop filters */}
            <div className="hidden md:flex items-center gap-1 text-xs">
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
                    {key === "recommended" ? "ALL" : key === "availableFirst" ? "AVAIL" : key === "resetSoonest" ? "EXP" : "NAME"}
                  </button>
                </span>
              ))}
            </div>
            {/* Mobile search toggle */}
            <button
              onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: showSearch ? "var(--accent)" : "var(--text-secondary)", background: showSearch ? "var(--accent-glow)" : "var(--surface-elevated)" }}
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {/* Mobile search bar */}
        {showSearch && (
          <div className="px-3 sm:px-6 pb-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="pl-9 rounded-lg h-10 w-full text-sm focus:outline-none"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
        )}
        {/* Desktop search bar */}
        <div className="hidden md:block px-6 pb-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts..."
              className="pl-9 rounded-lg h-9 w-full text-sm focus:outline-none"
              style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>
      </header>

      {/* Mobile filters bar */}
      <div className="md:hidden px-3 py-2 flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {(["recommended", "availableFirst", "resetSoonest", "accountName"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
            style={{
              color: sortBy === key ? "var(--accent)" : "var(--text-muted)",
              background: sortBy === key ? "var(--accent-glow)" : "var(--surface-elevated)",
              border: `1px solid ${sortBy === key ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {key === "recommended" ? "ALL" : key === "availableFirst" ? "AVAILABLE" : key === "resetSoonest" ? "EXPIRING" : "NAME"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {[
              { label: "TOTAL", value: stats.total, color: "var(--text-primary)" },
              { label: "AVAIL", value: stats.available, color: "var(--accent)" },
              { label: "USED", value: stats.used, color: "var(--warning)" },
              { label: "EXP", value: stats.expiringSoon, color: "#eab308" },
              { label: "TODAY", value: stats.resetToday, color: "var(--danger)" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg px-1.5 sm:px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="text-[8px] sm:text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                <div className="text-base sm:text-2xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Next Available */}
        <div className="rounded-xl p-3 sm:p-4 mb-4 sm:mb-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234, 179, 8, 0.1)" }}>
              <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Next Available</div>
              {nextAvailable ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: nextAvailable.label === "Available now" ? "var(--accent)" : "var(--warning)" }}>
                    {nextAvailable.label}
                  </span>
                  {nextAvailable.resetText && <span className="text-[10px] sm:text-xs hidden sm:inline" style={{ color: "var(--text-muted)" }}>Resets {nextAvailable.resetText}</span>}
                </div>
              ) : (
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>All available</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setIsModalOpen(true); setFormData({ name: "", email: "", notes: "", duration: globalDuration }); }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: "var(--accent)", color: "white", minHeight: "44px" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
              Add
            </button>
            <button
              onClick={toggleDeleteMode}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: deleteMode ? "var(--danger)" : "var(--surface-elevated)",
                color: deleteMode ? "white" : "var(--text-secondary)",
                border: `1px solid ${deleteMode ? "var(--danger)" : "var(--border)"}`,
                minHeight: "44px",
              }}
            >
              <Trash className="w-4 h-4" />
              {deleteMode ? `Cancel (${selectedForDelete.size})` : "Delete"}
            </button>
          </div>
          {deleteMode && selectedForDelete.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: "var(--danger)", color: "white", minHeight: "44px" }}
            >
              <Trash className="w-4 h-4" />
              Delete {selectedForDelete.size}
            </button>
          )}
          <div className="sm:ml-auto flex gap-2">
            <button onClick={handleSyncSeeds} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-colors" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", minHeight: "44px" }}>Sync seeds</button>
            <button onClick={handleExport} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-colors" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", minHeight: "44px" }}>Export</button>
            <label className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              Import
              <input type="file" accept=".json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {/* Mobile column manager */}
        <div className="md:hidden mb-3 rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Columns</span>
            {!isAddingColumn && (
              <button onClick={() => { setIsAddingColumn(true); setEditingColId(null); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
          <div className="space-y-2">
            {columns.map((col) => (
              <div key={col.id}>
                {editingColId === col.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editColName}
                      maxLength={24}
                      onChange={(e) => setEditColName(e.target.value)}
                      className="rounded px-2 py-1.5 text-xs w-full focus:outline-none"
                      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      autoFocus
                    />
                    <select
                      value={editColDuration}
                      onChange={(e) => setEditColDuration(Number(e.target.value))}
                      className="rounded px-1 py-1.5 text-xs focus:outline-none"
                      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    >
                      {COLUMN_DURATION_OPTIONS.map((o) => (
                        <option key={o.ms} value={o.ms}>{o.label}</option>
                      ))}
                    </select>
                    <button onClick={saveEditColumn} className="px-2 py-1.5 rounded text-xs font-medium" style={{ background: "var(--accent)", color: "white" }}>Save</button>
                    <button onClick={() => setEditingColId(null)} className="px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>{col.name} <span style={{ color: "var(--text-muted)" }}>· {columnDurationLabel(col.duration)}</span></span>
                    <button onClick={() => startEditColumn(col)} className="p-1.5 rounded" style={{ color: "var(--text-muted)" }} title={`Rename ${col.name} / change timeframe`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {columns.length > 1 && (
                      <button onClick={() => handleDeleteColumn(col.id)} className="p-1.5 rounded" style={{ color: "var(--text-muted)" }} title={`Delete ${col.name} column`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isAddingColumn && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newColName}
                  maxLength={24}
                  placeholder="Column name"
                  onChange={(e) => setNewColName(e.target.value)}
                  className="rounded px-2 py-1.5 text-xs w-full focus:outline-none"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  autoFocus
                />
                <select
                  value={newColDuration}
                  onChange={(e) => setNewColDuration(Number(e.target.value))}
                  className="rounded px-1 py-1.5 text-xs focus:outline-none"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  {COLUMN_DURATION_OPTIONS.map((o) => (
                    <option key={o.ms} value={o.ms}>{o.label}</option>
                  ))}
                </select>
                <button onClick={handleAddColumn} className="px-2 py-1.5 rounded text-xs font-medium" style={{ background: "var(--accent)", color: "white" }}>Add</button>
                <button onClick={() => setIsAddingColumn(false)} className="px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setIsModalOpen(false)}>
            <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-5" style={{ color: "var(--text-primary)" }}>Add Account</h3>
              <form onSubmit={(e) => { e.preventDefault(); if (formData.name.trim() && formData.email.trim()) handleAdd(formData); }}>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] sm:text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Name</label>
                    <input type="text" name="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="antigravity" className="w-full rounded-lg px-3 py-3 sm:py-2.5 text-sm focus:outline-none" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", minHeight: "44px" }} required autoFocus />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Email</label>
                    <input type="email" name="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="account@gmail.com" className="w-full rounded-lg px-3 py-3 sm:py-2.5 text-sm focus:outline-none" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", minHeight: "44px" }} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" className="w-full rounded-lg px-3 py-3 sm:py-2.5 text-sm focus:outline-none resize-none" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }} rows={2} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs font-medium mb-1.5 block uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Duration</label>
                    <div className="flex gap-2">
                      <label className="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer" style={{ background: formData.duration === 7 ? "var(--accent)" : "var(--surface-elevated)", color: formData.duration === 7 ? "white" : "var(--text-secondary)", border: `1px solid ${formData.duration === 7 ? "var(--accent)" : "var(--border)"}` }}>
                        <input type="radio" name="duration" value={7} checked={formData.duration === 7} className="hidden" onChange={() => setFormData((p) => ({ ...p, duration: 7 }))} />7 Days
                      </label>
                      <label className="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer" style={{ background: formData.duration === 30 ? "var(--accent)" : "var(--surface-elevated)", color: formData.duration === 30 ? "white" : "var(--text-secondary)", border: `1px solid ${formData.duration === 30 ? "var(--accent)" : "var(--border)"}` }}>
                        <input type="radio" name="duration" value={30} checked={formData.duration === 30} className="hidden" onChange={() => setFormData((p) => ({ ...p, duration: 30 }))} />1 Month
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-lg px-4 py-3 sm:py-2.5 text-sm font-medium transition-colors" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)", minHeight: "44px" }}>Cancel</button>
                  <button type="submit" className="flex-1 rounded-lg px-4 py-3 sm:py-2.5 text-sm font-medium transition-colors" style={{ background: "var(--accent)", color: "white", minHeight: "44px" }}>Add</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table / Cards */}
        {accounts.length === 0 ? (
          <div className="rounded-xl p-8 sm:p-12 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Zap className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <h3 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>No accounts yet</h3>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-muted)" }}>Add accounts to start tracking</p>
            <button onClick={() => { setIsModalOpen(true); setFormData({ name: "", email: "", notes: "", duration: globalDuration }); }} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "white", minHeight: "44px" }}>
              + Add Account
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium w-12" style={{ color: "var(--text-muted)" }}>#</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Account</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Email</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Resets</th>
                    {deleteMode ? (
                      <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-medium w-16" style={{ color: "var(--text-muted)" }}>Select</th>
                    ) : (
                      <>
                        {columns.map((col) => (
                          <th key={col.id} className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
                            {editingColId === col.id ? (
                              <span className="flex items-center justify-end gap-1 normal-case" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editColName}
                                  maxLength={24}
                                  onChange={(e) => setEditColName(e.target.value)}
                                  className="rounded px-1.5 py-1 text-[11px] w-20 focus:outline-none"
                                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                  autoFocus
                                />
                                <select
                                  value={editColDuration}
                                  onChange={(e) => setEditColDuration(Number(e.target.value))}
                                  className="rounded px-1 py-1 text-[11px] focus:outline-none"
                                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                >
                                  {COLUMN_DURATION_OPTIONS.map((o) => (
                                    <option key={o.ms} value={o.ms}>{o.label}</option>
                                  ))}
                                </select>
                                <button onClick={saveEditColumn} className="px-1.5 py-1 rounded text-[11px] font-medium" style={{ background: "var(--accent)", color: "white" }}>Save</button>
                                <button onClick={() => setEditingColId(null)} className="px-1.5 py-1 rounded text-[11px]" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-end gap-1">
                                <span title={`Resets in ${columnDurationLabel(col.duration)}`}>{col.name} · {columnDurationLabel(col.duration)}</span>
                                <button onClick={() => startEditColumn(col)} title={`Rename ${col.name} / change timeframe`} className="p-1 rounded hover:opacity-80" style={{ color: "var(--text-muted)" }}>
                                  <Pencil className="w-3 h-3" />
                                </button>
                                {columns.length > 1 && (
                                  <button onClick={() => handleDeleteColumn(col.id)} title={`Delete ${col.name} column`} className="p-1 rounded hover:opacity-80" style={{ color: "var(--text-muted)" }}>
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            )}
                          </th>
                        ))}
                        <th className="px-2 py-3 text-right w-10">
                          {isAddingColumn ? (
                            <span className="flex items-center justify-end gap-1 normal-case" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={newColName}
                                maxLength={24}
                                placeholder="Name"
                                onChange={(e) => setNewColName(e.target.value)}
                                className="rounded px-1.5 py-1 text-[11px] w-20 focus:outline-none"
                                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                autoFocus
                              />
                              <select
                                value={newColDuration}
                                onChange={(e) => setNewColDuration(Number(e.target.value))}
                                className="rounded px-1 py-1 text-[11px] focus:outline-none"
                                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                              >
                                {COLUMN_DURATION_OPTIONS.map((o) => (
                                  <option key={o.ms} value={o.ms}>{o.label}</option>
                                ))}
                              </select>
                              <button onClick={handleAddColumn} className="px-1.5 py-1 rounded text-[11px] font-medium" style={{ background: "var(--accent)", color: "white" }}>Add</button>
                              <button onClick={() => setIsAddingColumn(false)} className="px-1.5 py-1 rounded text-[11px]" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => { setIsAddingColumn(true); setEditingColId(null); }} title="Add new checkbox column" className="p-1.5 rounded-lg transition-colors" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </th>
                      </>
                    )}
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
                        {deleteMode ? (
                          <td className="px-4 py-3 text-right">
                            <AccountCheckbox checked={isSelected} onToggle={() => toggleSelect(id)} deleteMode={deleteMode} />
                          </td>
                        ) : (
                          <>
                            {columns.map((col) => {
                              const st = getColumnState(acc, col.id, col.duration);
                              const checked = st.status === "used";
                              const title = checked && st.resetAt
                                ? `${col.name}: resets ${new Date(st.resetAt).toLocaleString()}`
                                : `${col.name}: available · ${columnDurationLabel(col.duration)}`;
                              return (
                                <td key={col.id} className="px-4 py-3 text-right" title={title}>
                                  <AccountCheckbox checked={checked} onToggle={() => handleToggleColumn(id, col.id)} deleteMode={false} />
                                </td>
                              );
                            })}
                            <td className="px-2 py-3" />
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {sorted.map((id: string, idx: number) => {
                const acc = accountMap.get(id);
                if (!acc) return null;
                const { label, countdown } = getStatusLabel(acc.resetAt, acc.usageDuration);
                const isUsed = acc.status === "used";
                const isSelected = deleteMode && selectedForDelete.has(id);
                return (
                  <div
                    key={id}
                    className="rounded-xl p-3 transition-all"
                    style={{
                      background: isSelected ? "rgba(239, 68, 68, 0.08)" : "var(--surface)",
                      border: `1px solid ${isSelected ? "var(--danger)" : "var(--border-subtle)"}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <AccountCheckbox checked={isSelected || (!deleteMode && isUsed)} onToggle={() => deleteMode ? toggleSelect(id) : handleToggle(id)} deleteMode={deleteMode} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>#{idx + 1}</span>
                          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{acc.name}</span>
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{acc.email}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <StatusBadge label={label} countdown={countdown} />
                          {acc.resetAt && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(acc.resetAt).toLocaleDateString()}</span>}
                        </div>
                        {!deleteMode && columns.length > 1 && (
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {columns.map((col) => {
                              const st = getColumnState(acc, col.id, col.duration);
                              return (
                                <button
                                  key={col.id}
                                  type="button"
                                  onClick={() => handleToggleColumn(id, col.id)}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-medium"
                                  style={{ color: st.status === "used" ? "var(--warning)" : "var(--text-muted)" }}
                                  title={st.status === "used" && st.resetAt ? `${col.name}: resets ${new Date(st.resetAt).toLocaleString()}` : `${col.name}: ${columnDurationLabel(col.duration)}`}
                                >
                                  <span
                                    className="w-4 h-4 rounded flex items-center justify-center"
                                    style={{
                                      background: st.status === "used" ? "var(--accent)" : "transparent",
                                      border: `2px solid ${st.status === "used" ? "var(--accent)" : "var(--border)"}`,
                                      color: st.status === "used" ? "white" : "transparent",
                                    }}
                                  >
                                    {st.status === "used" && (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                  </span>
                                  {col.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 rounded-xl px-5 py-3 shadow-2xl text-sm font-medium z-50 flex items-center gap-2 max-w-[90vw]" style={{
            background: toast.type === "success" ? "var(--accent)" : toast.type === "info" ? "#3b82f6" : "var(--danger)",
            color: "white",
          }}>
            {toast.type === "success" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.type === "info" && <Info className="w-4 h-4 flex-shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span className="truncate">{toast.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}