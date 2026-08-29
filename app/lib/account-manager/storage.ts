import { Account, AccountStatus, DEFAULT_GLOBAL_DURATION, DURATION_LABELS } from "./types";

const STORAGE_KEY = "antigravity_accounts_v1";

export const loadStorage = (): { accounts: Account[]; globalDuration: number } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: { accounts: Account[]; globalDuration: number } = {
        accounts: [],
        globalDuration: DEFAULT_GLOBAL_DURATION,
      };
      saveStorage(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as any;
    if (parsed.version === undefined) parsed.version = 1;
    parsed.accounts = parsed.accounts.map((acc: any) => ({
      id: acc.id || crypto.randomUUID(),
      name: acc.name || `Account ${parsed.accounts.length + 1}`,
      email: acc.email || "",
      notes: acc.notes,
      status: acc.status || "available",
      usedAt: acc.usedAt ?? null,
      resetAt: acc.resetAt ?? null,
      usageDuration: acc.usageDuration ?? DEFAULT_GLOBAL_DURATION,
      createdAt: acc.createdAt ?? Date.now(),
      updatedAt: acc.updatedAt ?? Date.now(),
    }));
    parsed.globalDuration = parsed.globalDuration ?? DEFAULT_GLOBAL_DURATION;
    return parsed as { accounts: Account[]; globalDuration: number };
  } catch (error) {
    console.error("Failed to load storage", error);
    const initial: { accounts: Account[]; globalDuration: number } = {
      accounts: [],
      globalDuration: DEFAULT_GLOBAL_DURATION,
    };
    saveStorage(initial);
    return initial;
  }
};

export const saveStorage = (data: { accounts: Account[]; globalDuration: number }) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save storage", error);
  }
};

export const getAccounts = (): Account[] => {
  return loadStorage().accounts;
};

export const getGlobalDuration = (): number => {
  return loadStorage().globalDuration;
};

export const setGlobalDuration = (duration: number) => {
  saveStorage({ accounts: loadStorage().accounts, globalDuration: duration });
};

export const addAccount = (account: {
  name: string;
  email: string;
  notes?: string;
  status?: AccountStatus;
  usageDuration?: number;
}): Account => {
  const storage = loadStorage();
  const now = Date.now();
  const newAccount: Account = {
    id: crypto.randomUUID(),
    name: account.name,
    email: account.email,
    notes: account.notes,
    status: account.status || "available",
    usedAt: null,
    resetAt: null,
    usageDuration: account.usageDuration ?? storage.globalDuration,
    createdAt: now,
    updatedAt: now,
  };
  storage.accounts.push(newAccount);
  saveStorage(storage);
  return newAccount;
};

export const updateAccount = (id: string, updates: {
  name?: string;
  email?: string;
  notes?: string;
  status?: AccountStatus;
  usageDuration?: number;
}): Account | undefined => {
  const storage = loadStorage();
  const index = storage.accounts.findIndex((acc: Account) => acc.id === id);
  if (index === -1) return undefined;

  const existing = storage.accounts[index];
  const now = Date.now();

  let status = updates.status ?? existing.status;
  let usedAt = existing.usedAt;
  let resetAt = existing.resetAt;
  let usageDuration = existing.usageDuration;

  if (updates.status && updates.status !== "used") {
    status = updates.status;
    usedAt = null;
    resetAt = null;
    usageDuration = 0;
  } else if (updates.status === "used" && existing.status !== "used") {
    usedAt = now;
    usageDuration = updates.usageDuration ?? existing.usageDuration;
    resetAt = now + usageDuration;
  }

  if (updates.usageDuration !== undefined) {
    usageDuration = updates.usageDuration;
    if (status === "used" && usedAt) {
      resetAt = usedAt + usageDuration;
    }
  }

  storage.accounts[index] = {
    ...existing,
    name: updates.name ?? existing.name,
    email: updates.email ?? existing.email,
    notes: updates.notes ?? existing.notes,
    status,
    usedAt,
    resetAt,
    usageDuration,
    updatedAt: now,
  };

  saveStorage(storage);
  return storage.accounts[index];
};

export const deleteAccount = (id: string): boolean => {
  const storage = loadStorage();
  const before = storage.accounts.length;
  storage.accounts = storage.accounts.filter((acc: Account) => acc.id !== id);
  if (storage.accounts.length < before) {
    saveStorage(storage);
    return true;
  }
  return false;
};

export const importData = (jsonData: any): { success: boolean; imported: number; errors: string[] } => {
  const errors: string[] = [];
  let imported = 0;

  try {
    if (!jsonData?.accounts || !Array.isArray(jsonData.accounts)) {
      errors.push("Invalid JSON: missing or invalid 'accounts' array");
      return { success: false, imported: 0, errors };
    }

    const existing = loadStorage();
    const globalDuration = jsonData.globalDuration ?? existing.globalDuration;

    for (const acc of jsonData.accounts) {
      if (!acc.name || !acc.email) {
        errors.push(`Account missing required fields: name or email`);
        continue;
      }
      const parsedDuration = DURATION_LABELS[acc.usageDuration] ?? DEFAULT_GLOBAL_DURATION;
      const newAcc: Account = {
        id: acc.id || crypto.randomUUID(),
        name: acc.name,
        email: acc.email,
        notes: acc.notes,
        status: acc.status || "available",
        usedAt: acc.usedAt ?? null,
        resetAt: acc.resetAt ?? null,
        usageDuration: parsedDuration,
        createdAt: acc.createdAt ?? Date.now(),
        updatedAt: acc.updatedAt ?? Date.now(),
      };
      existing.accounts.push(newAcc);
      imported++;
    }

    if (jsonData.globalDuration) {
      existing.globalDuration = jsonData.globalDuration;
    }

    saveStorage(existing);
    return { success: true, imported, errors: errors.length === 0 ? [] : errors };
  } catch (error) {
    errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, imported: 0, errors };
  }
};

export const exportData = (): { version: number; accounts: Account[]; globalDuration: number } => {
  const storage = loadStorage();
  return {
    version: 1,
    accounts: storage.accounts.map((acc) => ({ ...acc })),
    globalDuration: storage.globalDuration,
  };
};

export const clearAllData = (): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear storage", error);
    return false;
  }
};

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const SEED_ACCOUNTS: { name: string; email: string }[] = [
  { name: "Manthan Jaiswal", email: "manthanjaiswal902@gmail.com" },
  { name: "MANTHAN No", email: "manth4050@gmail.com" },
  { name: "Manthan Buisness", email: "manth6250@gmail.com" },
  { name: "Harsh", email: "h8539686@gmail.com" },
  { name: "Arun", email: "noreplyaruniceream.in@gmail.com" },
  { name: "Yash", email: "y56152268@gmail.com" },
  { name: "Dinesh", email: "d73653820@gmail.com" },
  { name: "Swim", email: "swim6250@gmail.com" },
  { name: "gamma", email: "g00358127@gmail.com" },
  { name: "MANTHAN JAISWAL", email: "24951a05c3@iare.ac.in" },
  { name: "Antigraviy Q", email: "qantigraviy@gmail.com" },
  { name: "Manthan Jaiswal", email: "m98651766@gmail.com" },
  { name: "Antigravity 01", email: "antigravity6250@gmail.com" },
  { name: "Antigravity 02", email: "antigravity6251@gmail.com" },
  { name: "Antigravity 03", email: "antigravity6252@gmail.com" },
  { name: "Antigravity 04", email: "antigravity6253@gmail.com" },
  { name: "Antigravity 05", email: "antigravity6255@gmail.com" },
  { name: "Antigravity 06", email: "antigravity6256@gmail.com" },
  { name: "Antigravity 07", email: "antigravity6257@gmail.com" },
  { name: "Antigravity 08", email: "antigravity6258@gmail.com" },
  { name: "Antigravity 09", email: "antigravity6259@gmail.com" },
  { name: "Antigravity 10", email: "antigravity6260@gmail.com" },
  { name: "Antigravity 11", email: "antigravity6261@gmail.com" },
  { name: "Antigravity 12", email: "antigravity6262@gmail.com" },
  { name: "Antigravity 13", email: "antigravity6265@gmail.com" },
  { name: "Antigravity 14", email: "antigravity6266@gmail.com" },
  { name: "Antigravity 15", email: "antigravity6267@gmail.com" },
  { name: "Manthan 1234", email: "msdcvdshjd@gmail.com" },
  { name: "Manthan 123", email: "manthan45679@gmail.com" },
  { name: "Manthan", email: "antigravity7250@gmail.com" },
  { name: "Antigravity _1", email: "antigravity7251@gmail.com" },
  { name: "Antigravity _2", email: "antigravity7252@gmail.com" },
];

const SEED_FLAG_KEY = "antigravity_seeded_v1";

export const seedAccountsIfEmpty = (): boolean => {
  if (typeof window !== "undefined" && localStorage.getItem(SEED_FLAG_KEY) === "1") return false;

  const storage = loadStorage();
  const existingEmails = new Set(storage.accounts.map((a) => a.email.toLowerCase()));
  const toAdd = SEED_ACCOUNTS.filter((s) => !existingEmails.has(s.email.toLowerCase()));
  if (toAdd.length === 0) {
    if (typeof window !== "undefined") localStorage.setItem(SEED_FLAG_KEY, "1");
    return false;
  }

  const now = Date.now();
  const newAccounts: Account[] = toAdd.map((seed, i) => ({
    id: crypto.randomUUID(),
    name: seed.name,
    email: seed.email,
    notes: "",
    status: "available" as AccountStatus,
    usedAt: null,
    resetAt: null,
    usageDuration: SEVEN_DAYS,
    createdAt: now - (toAdd.length - i) * 60000,
    updatedAt: now - (toAdd.length - i) * 60000,
  }));

  storage.accounts.push(...newAccounts);
  saveStorage(storage);
  if (typeof window !== "undefined") localStorage.setItem(SEED_FLAG_KEY, "1");
  return true;
};

export const reconcileExpiration = (): Account[] => {
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

  const reconciled = accounts.filter(
    (acc, i) => acc.status !== storage.accounts[i].status || acc.usedAt !== storage.accounts[i].usedAt || acc.resetAt !== storage.accounts[i].resetAt
  );

  if (reconciled.length > 0) {
    storage.accounts = reconciled.map((acc, i) => ({
      ...storage.accounts[i],
      status: acc.status,
      usedAt: acc.usedAt,
      resetAt: acc.resetAt,
    }));
    saveStorage(storage);
  }

  return accounts;
};