"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, X, Edit, Trash, MoreVertical, Flag, Search, Mail, Zap, AlertCircle, CheckCircle, Timer, Info } from "lucide-react";

import { getAccounts, saveStorage, getGlobalDuration, setGlobalDuration, addAccount, updateAccount, deleteAccount, importData, exportData, clearAllData, reconcileExpiration } from "./lib/account-manager/storage";
import { getCountdownText, getStatusLabel, getSortOrder, getRecommendedSortOrder, checkExpiration } from "./lib/account-manager/expiration";
import { DEFAULT_GLOBAL_DURATION, DURATION_LABELS, Account } from "./lib/account-manager/types";

function AccountRow({ id, isUsed, onToggle }: { id: string; isUsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        w-8 h-8 rounded-full flex items-center justify-center ${isUsed ? "bg-green-600 text-white" : "bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors"}
      `}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M18 6L9 17L3 6" />
      </svg>
    </button>
  );
}

function StatusBadge({ label, countdown, lastUsed }: { label: string; countdown: string; lastUsed?: string }) {
  const bgClass = label === "available"
    ? "bg-green-600/20 text-green-400 border-green-500/30"
    : label === "used"
    ? "bg-amber-600/20 text-amber-400 border-amber-500/30"
    : label === "expiringSoon"
    ? "bg-yellow-600/20 text-yellow-400 border-yellow-500/30"
    : "bg-red-600/20 text-red-400 border-red-500/30";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${bgClass}`}>
      {label}
      {countdown !== "—" && <span className="ml-1 text-[0.7em]">| {countdown}</span>}
      {lastUsed && lastUsed !== "—" && <span className="text-[0.65em] ml-1 text-gray-500 block">• {lastUsed}</span>}
    </span>
  );
}

export default function Page() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [globalDuration, setGlobalDuration] = useState<number>(DEFAULT_GLOBAL_DURATION);
  const [sortBy, setSortBy] = useState<"recommended" | "availableFirst" | "resetSoonest" | "accountName">("recommended");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", notes: "", duration: globalDuration });
  const [toast, setToast] = useState<{ type: "success" | "info" | "error"; title: string; description: string } | null>(null);

  // Load from localStorage
  useEffect(() => {
    const stored = getAccounts();
    if (stored.length > 0) {
      setAccounts(stored);
    }
    const dur = getGlobalDuration();
    if (dur) setGlobalDuration(dur);
  }, []);

  // Reconcile expiration
  useEffect(() => {
    checkExpiration();
  }, [accounts, globalDuration]);

  // Persist
  useEffect(() => {
    saveStorage({ accounts, globalDuration });
  }, [accounts, globalDuration]);

  // Filter accounts
  const filtered = useMemo(() => {
    return accounts.filter((acc) => {
      if (searchQuery === "") return true;
      return (
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [accounts, searchQuery]);

  // Sort accounts
  const sorted = useMemo(() => getSortOrder(filtered, sortBy), [filtered, sortBy]);

  // Stats
  const total = useMemo(() => accounts.length, [accounts]);
  const available = useMemo(() => accounts.filter((a: any) => a.status === "available").length, [accounts]);
  const used = useMemo(() => accounts.filter((a: any) => a.status === "used").length, [accounts]);
  const expiringSoon = useMemo(
    () => accounts.filter((a: any) => a.status === "used" && a.resetAt && Date.now() < a.resetAt && Date.now() > a.resetAt - 24 * 60 * 60 * 1000).length,
    [accounts]
  );
  const resetToday = useMemo(() => {
    if (accounts.length === 0) return 0;
    const today = new Date();
    return accounts.filter((a: any) => {
      if (!a.resetAt) return false;
      const r = new Date(a.resetAt);
      return r.getFullYear() === today.getFullYear() && r.getMonth() === today.getMonth() && r.getDate() === today.getDate();
    }).length;
  }, [accounts]);

  // Next available
  const nextAvailable = useMemo(() => {
    const rec = getRecommendedSortOrder(accounts);
    const avail = rec.filter((id: string) => {
      const a = accounts.find((x: any) => x.id === id);
      return a && a.status === "available";
    });
    if (avail.length > 0) {
      const first = accounts.find((a: any) => a.id === avail[0]);
      return { id: avail[0], label: "Available now", resetText: "" };
    }
    const usedWithReset = accounts.filter((a: any) => a.status === "used" && a.resetAt !== null);
    if (usedWithReset.length > 0) {
      const sorted = [...usedWithReset].sort((a: any, b: any) => (a.resetAt ?? 0) - (b.resetAt ?? 0));
      const first = sorted[0];
      const remaining = first && first.resetAt ? first.resetAt - Date.now() : 0;
      const hours = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60)));
      const mins = Math.max(0, Math.ceil((remaining % (1000 * 60 * 60)) / (1000 * 60)));
      return {
        id: first.id,
        label: `in ${hours}h ${mins}m`,
        resetText: first && first.resetAt ? `${new Date(first.resetAt).toLocaleDateString()} ${new Date(first.resetAt).toLocaleTimeString()}` : "",
      };
    }
    return null;
  }, [accounts]);

  // Format countdown for display
  const formatCountdown = useCallback((resetAt: number | null, usageDuration: number | null): string => {
    if (!resetAt) return "—";
    const remaining = resetAt - Date.now();
    if (remaining <= 0) return "Available now";
    return getCountdownText(remaining, usageDuration ?? globalDuration);
  }, []);

  // Format duration for display
  const formatDuration = useCallback((ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, []);

  // Format duration global
  const formatDurationGlobal = useCallback((ms: number) => formatDuration(ms), [formatDuration]);

  // Get last used text
  const getLastUsedText = useCallback((resetAt: number | null, usageDuration: number | null): string => {
    if (!resetAt) return "—";
    const today = new Date();
    const resetDate = new Date(resetAt);
    const diffDays = Math.floor((today.getTime() - resetAt) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Used today";
    if (diffDays === 1) return "Used 1 day ago";
    if (diffDays > 1 && diffDays < 7) return `Used ${diffDays} days ago`;
    if (diffDays >= 7 && diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `Used ${weeks} week${weeks > 1 ? "s" : ""} ago`;
    }
    const months = Math.floor(diffDays / 30);
    return `Used ${months} month${months > 1 ? "s" : ""} ago`;
  }, []);

  // Add account handler
  const handleAdd = (data: { name: string; email: string; notes?: string; duration: number }) => {
    const newAcc = addAccount({
      name: data.name,
      email: data.email,
      notes: data.notes,
      status: "available",
      usageDuration: data.duration,
    });
    setAccounts((prev) => [...prev, newAcc]);
    setFormData({ name: "", email: "", notes: "", duration: globalDuration });
    setIsModalOpen(false);
    setToast({
      type: "success",
      title: "Account added",
      description: `Account "${data.name}" added successfully`,
    });
  };

  // Toggle checkbox
  const handleToggle = useCallback((id: string) => {
    const acc = accounts.find((a: any) => a.id === id);
    if (!acc) return;

    if (acc.status === "available") {
      const duration = acc.usageDuration ?? globalDuration;
      const now = Date.now();
      const resetAt = now + duration;
      const updated = { ...acc, status: "used", usedAt: now, resetAt, usageDuration: duration };
      setAccounts((prev) => prev.map((a: any) => a.id === id ? updated : a));
      setToast({
        type: "success",
        title: "Account used",
        description: `Account "${acc.name}" is now marked as used. Resets in ${formatDuration(duration)}`,
      });
    } else {
      setAccounts((prev) => prev.map((a: any) => a.id === id ? { ...a, status: "available", usedAt: null, resetAt: null } : a));
      setToast({
        type: "success",
        title: "Account available",
        description: `Account "${acc.name}" is now available again`,
      });
    }
  }, [accounts, globalDuration, formatDuration]);

  // Mark as available
  const handleMarkAvailable = useCallback((id: string) => {
    const acc = accounts.find((a: any) => a.id === id);
    if (!acc) return;
    setAccounts((prev) => prev.map((a: any) => a.id === id ? { ...a, status: "available", usedAt: null, resetAt: null } : a));
    setToast({
      type: "success",
      title: "Account available",
      description: `Account "${acc.name}" is now available again`,
    });
  }, []);

  // Reset timer
  const handleResetTimer = useCallback((id: string) => {
    const acc = accounts.find((a: any) => a.id === id);
    if (!acc) return;
    const now = Date.now();
    const duration = acc.usageDuration ?? globalDuration;
    const resetAt = now + duration;
    setAccounts((prev) => prev.map((a: any) => a.id === id ? { ...a, usedAt: now, resetAt, usageDuration: duration } : a));
  }, [globalDuration]);

  // Delete account
  const handleDelete = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((a: any) => a.id !== id));
    setToast({
      type: "info",
      title: "Account deleted",
      description: "The account has been removed from your tracker",
    });
  }, []);

  // Reset all
  const handleDeleteAll = useCallback(() => {
    setAccounts([]);
    setToast({
      type: "info",
      title: "All data cleared",
      description: "All accounts and settings have been reset",
    });
  }, []);

  // Import data
  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (typeof data === "string") {
        const result = importData(JSON.parse(data));
        if (result.success) {
          setAccounts((prev) => [...prev, ...(result.imported > 0 ? [] : [])]);
          setToast({
            type: "success",
            title: "Import successful",
            description: `${result.imported} accounts imported`,
          });
        } else {
          setToast({
            type: "error",
            title: "Import failed",
            description: "Could not parse the imported data",
          });
        }
      }
    };
    reader.readAsText(file);
  }, []);

  // Export data
  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "antigravity-accounts-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast({
      type: "success",
      title: "Exported",
      description: "Account data exported successfully",
    });
  }, []);

  // Use next account
  const handleUseNext = useCallback(() => {
    const rec = getRecommendedSortOrder(accounts);
    const avail = rec.filter((id: string) => {
      const a = accounts.find((x: any) => x.id === id);
      return a && a.status === "available";
    });

    if (avail.length > 0) {
      const firstId = avail[0];
      const firstAcc = accounts.find((a: any) => a.id === firstId);
      if (firstAcc) {
        const duration = firstAcc.usageDuration ?? globalDuration;
        const now = Date.now();
        const resetAt = now + duration;
        setAccounts((prev) => prev.map((a: any) =>
          a.id === firstId ? { ...a, status: "used", usedAt: now, resetAt, usageDuration: duration } : a
        ));
        setToast({
          type: "success",
          title: "Next account selected",
          description: `Account "${firstAcc.name}" is now marked as used. Resets in ${formatDurationGlobal(duration)}`,
        });
      }
    } else {
      setToast({
        type: "error",
        title: "No accounts available",
        description: "All accounts are currently in use. Wait for an account to become available.",
      });
    }
  }, [accounts, globalDuration, formatDurationGlobal]);

  // Handle form input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handle duration select
  const handleDurationChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, duration: parseInt(value, 10) }));
  }, []);

  // Open modal
  const openAccountModal = useCallback(() => {
    setIsModalOpen(true);
    setFormData({ name: "", email: "", notes: "", duration: globalDuration });
  }, [globalDuration]);

  // Close modal
  const closeAccountModal = useCallback(() => {
    setIsModalOpen(false);
    setFormData({ name: "", email: "", notes: "", duration: globalDuration });
  }, [globalDuration]);

  // Duration options
  const durationOptions = [
    { value: 1, label: "1 Day" },
    { value: 2, label: "2 Days" },
    { value: 3, label: "3 Days" },
    { value: 7, label: "7 Days" },
    { value: 15, label: "15 Days" },
    { value: 30, label: "1 Month" },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
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
                placeholder="⌕ Search accounts..."
                className="pl-8 bg-gray-800 border border-gray-700 rounded-full h-10 w-64 focus:outline-none focus:border-green-500 focus:text-white transition-colors"
                aria-label="Search accounts"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>•</span>
              <span className="font-medium" onClick={() => setSortBy("recommended")}>ALL</span>
              <span className="mx-2">•</span>
              <span onClick={() => setSortBy("availableFirst")} className={sortBy === "availableFirst" ? "font-semibold text-green-400" : "hover:text-gray-300 transition-colors"}>AVAILABLE</span>
              <span className="mx-2">•</span>
              <span onClick={() => setSortBy("resetSoonest")} className={sortBy === "resetSoonest" ? "font-semibold text-yellow-400" : "hover:text-gray-300 transition-colors"}>EXPIRING</span>
              <span className="mx-2">•</span>
              <span onClick={() => setSortBy("accountName")} className={sortBy === "accountName" ? "font-semibold text-amber-400" : "hover:text-gray-300 transition-colors"}>NAME</span>
            </div>
          </div>
        </div>
      </header>

      {/* Summary Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2 border-b border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <span className="text-xs text-gray-400">TOTAL</span>
            <span className="text-xl font-bold text-white">{total}</span>
          </div>
          <div className="bg-gray-800 border border-green-600/20 rounded-lg p-3">
            <span className="text-xs text-green-400">AVAILABLE</span>
            <span className="text-xl font-bold text-green-300">{available}</span>
          </div>
          <div className="bg-gray-800 border border-amber-500/20 rounded-lg p-3">
            <span className="text-xs text-amber-400">IN USE</span>
            <span className="text-xl font-bold text-amber-300">{used}</span>
          </div>
          <div className="bg-gray-800 border border-yellow-500/20 rounded-lg p-3">
            <span className="text-xs text-yellow-400">EXPIRING SOON</span>
            <span className="text-xl font-bold text-yellow-300">{expiringSoon}</span>
          </div>
          <div className="bg-gray-800 border border-red-500/20 rounded-lg p-3">
            <span className="text-xs text-red-400">RESET TODAY</span>
            <span className="text-xl font-bold text-red-300">{resetToday}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Next Available card */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Flag className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">NEXT AVAILABLE</p>
              {nextAvailable != null ? (
                <div className="mt-2 flex items-center gap-2">
                  {nextAvailable.label === "Available now" && (
                    <span className="text-green-400 font-medium">Available now</span>
                  )}
                  {nextAvailable.label !== "Available now" && (
                    <p className="text-sm text-yellow-400">{nextAvailable.label}</p>
                  )}
                  {nextAvailable.resetText && (
                    <p className="text-xs text-gray-500">Resets {nextAvailable.resetText}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No accounts with availability info</p>
              )}
            </div>
          </div>
        </div>

        {/* Add Account Button */}
        <div className="mb-6">
          <button
            onClick={openAccountModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            ⚡ USE NEXT ACCOUNT
          </button>
        </div>

        {/* Account Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Add Account</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (formData.name.trim() && formData.email.trim()) {
                    handleAdd(formData);
                  }
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Account name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Account 01"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="account@example.com"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Optional notes about this account"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 resize-h transition-colors"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">Usage duration</label>
                    <select
                      value={formData.duration}
                      onChange={(e) => handleDurationChange(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 appearance-none pl-3"
                    >
                      {durationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeAccountModal}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700 transition-colors font-medium"
                  >
                    ADD ACCOUNT
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Account Table */}
        <div>{accounts.length === 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
            <Flag className="w-12 h-12 mx-auto mb-4 text-gray-600 opacity-50" />
            <h3 className="text-xl font-bold text-gray-300">No accounts yet</h3>
            <p className="text-gray-500 mt-2">Add your accounts to start tracking your rotation</p>
            <button
              onClick={openAccountModal}
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              + Add Account
            </button>
          </div>
        )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800">
                  <th className="p-3 text-left text-xs font-medium text-gray-400">#</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400">ACCOUNT</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400">EMAIL</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400">STATUS</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-400">RESET</th>
                  <th className="p-3 text-right text-xs font-medium text-gray-400">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((id: string, idx: number) => {
                  const acc = accounts.find((a: any) => a.id === id);
                  if (!acc) return null;

                  const { label, countdown } = getStatusLabel(acc.resetAt, acc.usageDuration);
                  const isAvailable = acc.status === "available";
                  const isUsed = acc.status === "used";
                  const lastUsed = getLastUsedText(acc.resetAt, acc.usageDuration);

                  const rowBg = isAvailable
                    ? "bg-gray-900 hover:bg-gray-800"
                    : isUsed
                    ? "bg-gray-800 hover:bg-gray-700"
                    : "bg-gray-800 hover:bg-gray-700";

                  return (
                    <tr
                      key={id}
                      className={`${rowBg} transition-colors duration-200`}
                    >
                      <td className="p-3 text-right text-xs text-gray-500">{idx + 1}</td>
                      <td className="p-3 flex items-center gap-2">
                        <span className="text-white font-medium truncate w-24">{acc.name}</span>
                      </td>
                      <td className="p-3 text-sm text-gray-400">{acc.email}</td>
                      <td className="p-3">
                        <StatusBadge
                          label={label}
                          countdown={countdown}
                          lastUsed={lastUsed}
                        />
                      </td>
                      <td className="p-3 text-sm text-gray-400">
                        {acc.resetAt ? new Date(acc.resetAt).toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right">
                        <AccountRow
                          id={acc.id}
                          isUsed={isUsed}
                          onToggle={() => handleToggle(acc.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Toast container */}
        {toast && (
          <div className={"fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-6 py-3 shadow-lg text-sm font-medium transition-all opacity-0 visibility-hidden opacity-0".concat(toast.type === "success" ? " bg-green-600/90 text-green-400 border-green-500/30" : toast.type === "info" ? " bg-blue-600/90 text-blue-400 border-blue-500/30" : toast.type === "error" ? " bg-red-600/90 text-white border-red-500/30" : "")}>
            <div className="flex items-center gap-2">
              {toast.type === "success" && <CheckCircle className="w-4 h-4" />}
              {toast.type === "info" && <Info className="w-4 h-4" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
              <span>{toast.title}</span>
            </div>
            {toast.description && <span className="ml-2 text-opacity-80">{toast.description}</span>}
          </div>
        )}
      </div>
    </div>
  );
}