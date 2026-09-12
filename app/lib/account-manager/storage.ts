import { Account, AccountStatus, TrackerColumn, TrackerState, DEFAULT_GLOBAL_DURATION, DURATION_LABELS } from "./types";

const STORAGE_KEY = "antigravity_accounts_v1";

export const DEFAULT_COLUMN_ID = "use";

export interface StorageData {
  accounts: Account[];
  globalDuration: number;
  columns: TrackerColumn[];
}

const makeDefaultColumns = (duration: number): TrackerColumn[] => [
  { id: DEFAULT_COLUMN_ID, name: "USE", duration },
];

const sanitizeColumns = (raw: any, fallbackDuration: number): TrackerColumn[] => {
  if (!Array.isArray(raw) || raw.length === 0) return makeDefaultColumns(fallbackDuration);
  const seen = new Set<string>();
  const cols: TrackerColumn[] = [];
  for (const c of raw) {
    const id = typeof c?.id === "string" && c.id ? c.id : crypto.randomUUID();
    if (seen.has(id)) continue;
    seen.add(id);
    const name = typeof c?.name === "string" && c.name.trim() ? c.name.trim().slice(0, 24) : "USE";
    const duration = typeof c?.duration === "number" && c.duration > 0 ? c.duration : fallbackDuration;
    cols.push({ id, name, duration });
  }
  return cols.length > 0 ? cols : makeDefaultColumns(fallbackDuration);
};

const ensureUses = (acc: any, columns: TrackerColumn[], fallbackDuration: number): Record<string, TrackerState> => {
  const uses: Record<string, TrackerState> = { ...(acc.uses ?? {}) };
  for (const col of columns) {
    const existing = uses[col.id];
    if (existing && (existing.status === "available" || existing.status === "used")) {
      uses[col.id] = {
        status: existing.status,
        usedAt: existing.usedAt ?? null,
        resetAt: existing.resetAt ?? null,
        usageDuration: existing.usageDuration ?? col.duration,
      };
    } else if (col.id === DEFAULT_COLUMN_ID || columns[0]?.id === col.id) {
      // Mirror legacy fields onto the primary column for migrated accounts.
      uses[col.id] = {
        status: acc.status === "used" ? "used" : "available",
        usedAt: acc.usedAt ?? null,
        resetAt: acc.resetAt ?? null,
        usageDuration: acc.usageDuration ?? col.duration ?? fallbackDuration,
      };
    } else {
      uses[col.id] = { status: "available", usedAt: null, resetAt: null, usageDuration: col.duration };
    }
  }
  // Drop states for deleted columns.
  for (const key of Object.keys(uses)) {
    if (!columns.some((c) => c.id === key)) delete uses[key];
  }
  return uses;
};

export const loadStorage = (): StorageData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: StorageData = {
        accounts: [],
        globalDuration: DEFAULT_GLOBAL_DURATION,
        columns: makeDefaultColumns(DEFAULT_GLOBAL_DURATION),
      };
      saveStorage(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as any;
    if (parsed.version === undefined) parsed.version = 1;
    const globalDuration = parsed.globalDuration ?? DEFAULT_GLOBAL_DURATION;
    const columns = sanitizeColumns(parsed.columns, globalDuration);
    const accounts: Account[] = (Array.isArray(parsed.accounts) ? parsed.accounts : []).map((acc: any) => {
      const base = {
        id: acc.id || crypto.randomUUID(),
        name: acc.name || `Account`,
        email: acc.email || "",
        notes: acc.notes,
        status: acc.status === "used" ? "used" as AccountStatus : "available" as AccountStatus,
        usedAt: acc.usedAt ?? null,
        resetAt: acc.resetAt ?? null,
        usageDuration: acc.usageDuration ?? globalDuration,
        createdAt: acc.createdAt ?? Date.now(),
        updatedAt: acc.updatedAt ?? Date.now(),
      };
      return { ...base, uses: ensureUses(acc, columns, globalDuration) } as Account;
    });
    // Keep legacy top-level fields in sync with the primary column.
    const primary = columns[0];
    if (primary) {
      for (const a of accounts) {
        const s = a.uses?.[primary.id];
        if (s) {
          a.status = s.status;
          a.usedAt = s.usedAt;
          a.resetAt = s.resetAt;
          a.usageDuration = s.usageDuration;
        }
      }
    }
    return { accounts, globalDuration, columns };
  } catch (error) {
    console.error("Failed to load storage", error);
    const initial: StorageData = {
      accounts: [],
      globalDuration: DEFAULT_GLOBAL_DURATION,
      columns: makeDefaultColumns(DEFAULT_GLOBAL_DURATION),
    };
    saveStorage(initial);
    return initial;
  }
};

export const saveStorage = (data: { accounts: Account[]; globalDuration: number; columns?: TrackerColumn[] }) => {
  try {
    let columns = data.columns;
    if (!columns) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as any;
          columns = sanitizeColumns(parsed.columns, data.globalDuration);
        }
      } catch { /* fall through to default */ }
      columns = columns ?? makeDefaultColumns(data.globalDuration);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, columns }));
  } catch (error) {
    console.error("Failed to save storage", error);
  }
};

export const getAccounts = (): Account[] => {
  return loadStorage().accounts;
};

export const getColumns = (): TrackerColumn[] => {
  return loadStorage().columns;
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
  const primary = storage.columns[0];
  const status = account.status || "available";
  const usageDuration = account.usageDuration ?? storage.globalDuration;
  const uses: Record<string, TrackerState> = {};
  for (const col of storage.columns) {
    if (col.id === primary?.id) {
      uses[col.id] = { status, usedAt: null, resetAt: null, usageDuration };
    } else {
      uses[col.id] = { status: "available", usedAt: null, resetAt: null, usageDuration: col.duration };
    }
  }
  const newAccount: Account = {
    id: crypto.randomUUID(),
    name: account.name,
    email: account.email,
    notes: account.notes,
    status,
    usedAt: null,
    resetAt: null,
    usageDuration,
    uses,
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
    uses: (() => {
      const primary = storage.columns[0];
      const uses = { ...(existing.uses ?? {}) };
      if (primary) {
        uses[primary.id] = { status, usedAt, resetAt, usageDuration };
      }
      return uses;
    })(),
    updatedAt: now,
  };

  saveStorage(storage);
  return storage.accounts[index];
};

export const getColumnState = (acc: Account, columnId: string, fallbackDuration: number): TrackerState => {
  const s = acc.uses?.[columnId];
  if (s && (s.status === "available" || s.status === "used")) {
    return { status: s.status, usedAt: s.usedAt ?? null, resetAt: s.resetAt ?? null, usageDuration: s.usageDuration ?? fallbackDuration };
  }
  return { status: "available", usedAt: null, resetAt: null, usageDuration: fallbackDuration };
};

export const toggleAccountColumn = (accountId: string, columnId: string): Account | undefined => {
  const storage = loadStorage();
  const column = storage.columns.find((c) => c.id === columnId);
  if (!column) return undefined;
  const index = storage.accounts.findIndex((acc: Account) => acc.id === accountId);
  if (index === -1) return undefined;
  const existing = storage.accounts[index];
  const now = Date.now();
  const uses = { ...(existing.uses ?? {}) };
  const current = getColumnState(existing, columnId, column.duration);
  const next: TrackerState =
    current.status === "available"
      ? { status: "used", usedAt: now, resetAt: now + column.duration, usageDuration: column.duration }
      : { status: "available", usedAt: null, resetAt: null, usageDuration: column.duration };
  uses[columnId] = next;
  const primary = storage.columns[0];
  storage.accounts[index] = {
    ...existing,
    status: primary && primary.id === columnId ? next.status : (primary ? getColumnState(existing, primary.id, existing.usageDuration).status : existing.status),
    usedAt: primary && primary.id === columnId ? next.usedAt : existing.usedAt,
    resetAt: primary && primary.id === columnId ? next.resetAt : existing.resetAt,
    usageDuration: primary && primary.id === columnId ? next.usageDuration : existing.usageDuration,
    uses,
    updatedAt: now,
  };
  saveStorage(storage);
  return storage.accounts[index];
};

export const addTrackerColumn = (name: string, duration: number): TrackerColumn => {
  const storage = loadStorage();
  const cleanName = name.trim().slice(0, 24) || `COL ${storage.columns.length + 1}`;
  const col: TrackerColumn = { id: crypto.randomUUID(), name: cleanName, duration };
  storage.columns.push(col);
  for (const acc of storage.accounts) {
    acc.uses = { ...(acc.uses ?? {}), [col.id]: { status: "available", usedAt: null, resetAt: null, usageDuration: duration } };
  }
  saveStorage(storage);
  return col;
};

export const renameTrackerColumn = (id: string, name: string): TrackerColumn | undefined => {
  const storage = loadStorage();
  const col = storage.columns.find((c) => c.id === id);
  if (!col) return undefined;
  const cleanName = name.trim().slice(0, 24);
  if (!cleanName) return undefined;
  col.name = cleanName;
  saveStorage(storage);
  return col;
};

export const setTrackerColumnDuration = (id: string, duration: number): TrackerColumn | undefined => {
  const storage = loadStorage();
  const col = storage.columns.find((c) => c.id === id);
  if (!col || !(duration > 0)) return undefined;
  col.duration = duration;
  saveStorage(storage);
  return col;
};

export const deleteTrackerColumn = (id: string): boolean => {
  const storage = loadStorage();
  if (storage.columns.length <= 1) return false;
  const before = storage.columns.length;
  storage.columns = storage.columns.filter((c) => c.id !== id);
  if (storage.columns.length === before) return false;
  for (const acc of storage.accounts) {
    if (acc.uses && acc.uses[id]) {
      const { [id]: _removed, ...rest } = acc.uses;
      acc.uses = rest;
    }
  }
  // Re-sync legacy fields to the (possibly new) primary column.
  const primary = storage.columns[0];
  if (primary) {
    for (const acc of storage.accounts) {
      const s = acc.uses?.[primary.id];
      if (s) {
        acc.status = s.status;
        acc.usedAt = s.usedAt;
        acc.resetAt = s.resetAt;
        acc.usageDuration = s.usageDuration;
      }
    }
  }
  saveStorage(storage);
  return true;
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
    if (Array.isArray(jsonData.columns) && jsonData.columns.length > 0) {
      const incoming = sanitizeColumns(jsonData.columns, globalDuration);
      // Merge by id: keep existing, add missing.
      for (const col of incoming) {
        if (!existing.columns.some((c) => c.id === col.id)) {
          existing.columns.push(col);
          for (const acc of existing.accounts) {
            acc.uses = { ...(acc.uses ?? {}), [col.id]: { status: "available", usedAt: null, resetAt: null, usageDuration: col.duration } };
          }
        }
      }
    }

    for (const acc of jsonData.accounts) {
      if (!acc.name || !acc.email) {
        errors.push(`Account missing required fields: name or email`);
        continue;
      }
      const parsedDuration = DURATION_LABELS[acc.usageDuration] ?? DEFAULT_GLOBAL_DURATION;
      const primary = existing.columns[0];
      const uses: Record<string, TrackerState> = {};
      for (const col of existing.columns) {
        const s = acc.uses?.[col.id];
        if (s && (s.status === "available" || s.status === "used")) {
          uses[col.id] = {
            status: s.status,
            usedAt: s.usedAt ?? null,
            resetAt: s.resetAt ?? null,
            usageDuration: s.usageDuration ?? col.duration,
          };
        } else if (col.id === primary?.id) {
          uses[col.id] = {
            status: acc.status === "used" ? "used" : "available",
            usedAt: acc.usedAt ?? null,
            resetAt: acc.resetAt ?? null,
            usageDuration: parsedDuration,
          };
        } else {
          uses[col.id] = { status: "available", usedAt: null, resetAt: null, usageDuration: col.duration };
        }
      }
      const primaryState = primary ? uses[primary.id] : undefined;
      const newAcc: Account = {
        id: acc.id || crypto.randomUUID(),
        name: acc.name,
        email: acc.email,
        notes: acc.notes,
        status: primaryState?.status ?? "available",
        usedAt: primaryState?.usedAt ?? null,
        resetAt: primaryState?.resetAt ?? null,
        usageDuration: primaryState?.usageDuration ?? parsedDuration,
        uses,
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

export const exportData = (): { version: number; accounts: Account[]; globalDuration: number; columns: TrackerColumn[] } => {
  const storage = loadStorage();
  return {
    version: 1,
    accounts: storage.accounts.map((acc) => ({ ...acc })),
    globalDuration: storage.globalDuration,
    columns: storage.columns.map((c) => ({ ...c })),
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

/** Adds any seed accounts whose email isn't already stored. Never modifies or removes existing accounts. */
export const syncMissingSeeds = (): number => {
  const storage = loadStorage();
  const existingEmails = new Set(storage.accounts.map((a) => a.email.toLowerCase()));
  const now = Date.now();
  let added = 0;
  for (const seed of SEED_ACCOUNTS) {
    if (existingEmails.has(seed.email.toLowerCase())) continue;
    const uses: Record<string, TrackerState> = {};
    for (const col of storage.columns) {
      uses[col.id] = { status: "available", usedAt: null, resetAt: null, usageDuration: col.duration };
    }
    const primary = storage.columns[0];
    storage.accounts.push({
      id: crypto.randomUUID(),
      name: seed.name,
      email: seed.email,
      notes: "",
      status: "available",
      usedAt: null,
      resetAt: null,
      usageDuration: primary?.duration ?? SEVEN_DAYS,
      uses,
      createdAt: now,
      updatedAt: now,
    });
    existingEmails.add(seed.email.toLowerCase());
    added++;
  }
  if (added > 0) saveStorage(storage);
  return added;
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
  { name: "Bitto Jaiswal", email: "bittojaiswal12@gmail.com" },
  { name: "suman Jaiswal", email: "sumanjaiswal1606@gmail.com" },
  { name: "Priya Mishra", email: "akmisking1234@gmail.com" },
  { name: "Antigravity_3", email: "antigravity7253@gmail.com" },
  { name: "Antigravity _7", email: "antigravity7257@gmail.com" },
  { name: "Rakesh Jaiswal", email: "rakeshjaiswal2612@gmail.com" },
  { name: "Anrigravity _8", email: "qntigrqvity7258@gmail.com" },
  { name: "Antigravity _9", email: "anrigravity7259@gmail.com" },
  { name: "Antigravity_5", email: "antigravity7255@gmail.com" },
];

const SEED_FLAG_KEY = "antigravity_seeded_v1";

export const seedAccountsIfEmpty = (): boolean => {
  const storage = loadStorage();
  if (storage.accounts.length > 0) return false;

  const now = Date.now();
  const newAccounts: Account[] = SEED_ACCOUNTS.map((seed, i) => {
    const uses: Record<string, TrackerState> = {};
    for (const col of storage.columns) {
      uses[col.id] = { status: "available", usedAt: null, resetAt: null, usageDuration: col.duration };
    }
    // Primary column mirrors the 7-day legacy default.
    const primary = storage.columns[0];
    if (primary) uses[primary.id] = { status: "available", usedAt: null, resetAt: null, usageDuration: SEVEN_DAYS };
    return {
      id: crypto.randomUUID(),
      name: seed.name,
      email: seed.email,
      notes: "",
      status: "available" as AccountStatus,
      usedAt: null,
      resetAt: null,
      usageDuration: SEVEN_DAYS,
      uses,
      createdAt: now - (SEED_ACCOUNTS.length - i) * 60000,
      updatedAt: now - (SEED_ACCOUNTS.length - i) * 60000,
    };
  });

  storage.accounts = newAccounts;
  saveStorage(storage);
  return true;
};

export const reconcileExpiration = (): Account[] => {
  const storage = loadStorage();
  const now = Date.now();
  let changed = false;
  const accounts = storage.accounts.map((acc: Account) => {
    const uses = { ...(acc.uses ?? {}) };
    for (const col of storage.columns) {
      const s = uses[col.id];
      if (s && s.status === "used" && s.resetAt !== null && now >= s.resetAt) {
        uses[col.id] = { status: "available", usedAt: null, resetAt: null, usageDuration: col.duration };
        changed = true;
      }
    }
    const primary = storage.columns[0];
    const ps = primary ? uses[primary.id] : undefined;
    let status = acc.status;
    let usedAt = acc.usedAt;
    let resetAt = acc.resetAt;
    if (ps && (ps.status !== status || ps.usedAt !== usedAt || ps.resetAt !== resetAt)) {
      status = ps.status;
      usedAt = ps.usedAt;
      resetAt = ps.resetAt;
      changed = true;
    } else if (status === "used" && resetAt !== null && now >= resetAt) {
      status = "available";
      usedAt = null;
      resetAt = null;
      changed = true;
    }

    return { ...acc, status, usedAt, resetAt, uses } as Account;
  });

  if (changed) {
    storage.accounts = accounts;
    saveStorage(storage);
  }

  return accounts;
};