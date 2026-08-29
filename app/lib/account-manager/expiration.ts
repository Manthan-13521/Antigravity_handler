import { Account, DURATION_LABELS } from "./types";
import { loadStorage, saveStorage } from "./storage";

export const getCountdownText = (resetAt: number | null, duration: number): string => {
  if (!resetAt) return "—";

  const now = Date.now();
  const remaining = resetAt - now;

  if (remaining <= 0) {
    return "Expired";
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "Expired";
};

export const getStatusLabel = (resetAt: number | null, duration: number) => {
  if (!resetAt) {
    return { label: "available", countdown: "—" };
  }

  const now = Date.now();
  const remaining = resetAt - now;

  if (remaining <= 0) {
    return { label: "expired", countdown: "Expired" };
  }

  if (remaining < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return {
      label: "expiringSoon",
      countdown: `${hours}h ${minutes}m`,
    };
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return {
    label: "used",
    countdown: `${days}d ${hours}h ${minutes}m`,
  };
};

export const getRecommendedSortOrder = (accounts: Account[]): string[] => {
  const available: Account[] = [];
  const used: Account[] = [];

  accounts.forEach((acc) => {
    if (acc.status === "available") {
      available.push(acc);
    } else {
      used.push(acc);
    }
  });

  // Sort used by reset date (closest first)
  used.sort((a, b) => {
    if (a.resetAt === null && b.resetAt === null) return 0;
    if (a.resetAt === null) return 1;
    if (b.resetAt === null) return -1;
    return (a.resetAt ?? 0) - (b.resetAt ?? 0);
  });

  // Sort available by reset date (closest first), no-reset first
  available.sort((a, b) => {
    if (a.resetAt === null && b.resetAt === null) return 0;
    if (a.resetAt === null) return -1;
    if (b.resetAt === null) return 1;
    return (a.resetAt ?? 0) - (b.resetAt ?? 0);
  });

  return [...available.map((a) => a.id), ...used.map((u) => u.id)];
};

export const getSortOrder = (
  accounts: Account[],
  sortBy: "recommended" | "recentlyUsed" | "availableFirst" | "resetSoonest" | "accountName"
): string[] => {
  switch (sortBy) {
    case "recommended": {
      return getRecommendedSortOrder(accounts);
    }
    case "availableFirst": {
      return accounts
        .sort((a, b) => {
          if (a.status === "available" && b.status !== "available") return -1;
          if (a.status !== "available" && b.status === "available") return 1;
          return 0;
        })
        .sort((a, b) => (a.resetAt ?? 0) - (b.resetAt ?? 0))
        .map((acc) => acc.id);
    }
    case "resetSoonest": {
      return accounts
        .sort((a, b) => {
          if (a.resetAt === null && b.resetAt !== null) return 1;
          if (a.resetAt !== null && b.resetAt === null) return -1;
          if (a.resetAt === null && b.resetAt === null) return 0;
          return (a.resetAt ?? 0) - (b.resetAt ?? 0);
        })
        .map((acc) => acc.id);
    }
    case "accountName": {
      return [...accounts]
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map((acc) => acc.id);
    }
    default:
      return getRecommendedSortOrder(accounts);
  }
};

export const checkExpiration = (): { expiredCount: number; justSwitched: Account[] } => {
  const storage = loadStorage();
  const now = Date.now();
  const accounts = storage.accounts.map((acc: Account) => {
    let status = acc.status;
    let usedAt = acc.usedAt;
    let resetAt = acc.resetAt;

    if (status === "used" && resetAt !== null && now >= resetAt) {
      status = "available";
      usedAt = null;
      resetAt = null;
    }

    return { ...acc, status, usedAt, resetAt } as Account;
  });

  const expiredCount = accounts.filter(
    (acc) => acc.status === "available" && acc.usedAt === null
  ).length;

  const justSwitched = accounts.filter((acc) => {
    const prev = storage.accounts.find((a) => a.id === acc.id);
    return prev && prev.status === "used" && acc.status === "available";
  });

  // Save reconciled data
  const reconciled = accounts.filter(
    (acc, i) => acc.status !== storage.accounts[i].status || acc.usedAt !== storage.accounts[i].usedAt || acc.resetAt !== storage.accounts[i].resetAt
  );

  if (reconciled.length > 0) {
    const finalAccounts = reconciled.map((acc, i) => ({
      ...storage.accounts[i],
      status: acc.status,
      usedAt: acc.usedAt,
      resetAt: acc.resetAt,
    }));
    storage.accounts = finalAccounts;
    saveStorage(storage);
  }

  return { expiredCount, justSwitched };
};