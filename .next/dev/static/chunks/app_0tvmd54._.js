(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/lib/account-manager/expiration.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkExpiration",
    ()=>checkExpiration,
    "getCountdownText",
    ()=>getCountdownText,
    "getRecommendedSortOrder",
    ()=>getRecommendedSortOrder,
    "getSortOrder",
    ()=>getSortOrder,
    "getStatusLabel",
    ()=>getStatusLabel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/account-manager/storage.ts [app-client] (ecmascript)");
;
const getCountdownText = (resetAt, duration)=>{
    if (!resetAt) return "—";
    const now = Date.now();
    const remaining = resetAt - now;
    if (remaining <= 0) {
        return "Expired";
    }
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor(remaining % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
    const minutes = Math.floor(remaining % (1000 * 60 * 60) / (1000 * 60));
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
const getStatusLabel = (resetAt, duration)=>{
    if (!resetAt) {
        return {
            label: "available",
            countdown: "—"
        };
    }
    const now = Date.now();
    const remaining = resetAt - now;
    if (remaining <= 0) {
        return {
            label: "expired",
            countdown: "Expired"
        };
    }
    if (remaining < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor(remaining % (1000 * 60 * 60) / (1000 * 60));
        return {
            label: "expiringSoon",
            countdown: `${hours}h ${minutes}m`
        };
    }
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor(remaining % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
    const minutes = Math.floor(remaining % (1000 * 60 * 60) / (1000 * 60));
    return {
        label: "used",
        countdown: `${days}d ${hours}h ${minutes}m`
    };
};
const getRecommendedSortOrder = (accounts)=>{
    const available = [];
    const used = [];
    accounts.forEach((acc)=>{
        if (acc.status === "available") {
            available.push(acc);
        } else {
            used.push(acc);
        }
    });
    // Sort used by reset date (closest first)
    used.sort((a, b)=>{
        if (a.resetAt === null && b.resetAt === null) return 0;
        if (a.resetAt === null) return 1;
        if (b.resetAt === null) return -1;
        return (a.resetAt ?? 0) - (b.resetAt ?? 0);
    });
    // Sort available by reset date (closest first), no-reset first
    available.sort((a, b)=>{
        if (a.resetAt === null && b.resetAt === null) return 0;
        if (a.resetAt === null) return -1;
        if (b.resetAt === null) return 1;
        return (a.resetAt ?? 0) - (b.resetAt ?? 0);
    });
    return [
        ...available.map((a)=>a.id),
        ...used.map((u)=>u.id)
    ];
};
const getSortOrder = (accounts, sortBy)=>{
    switch(sortBy){
        case "recommended":
            {
                return getRecommendedSortOrder(accounts);
            }
        case "availableFirst":
            {
                return accounts.sort((a, b)=>{
                    if (a.status === "available" && b.status !== "available") return -1;
                    if (a.status !== "available" && b.status === "available") return 1;
                    return 0;
                }).sort((a, b)=>(a.resetAt ?? 0) - (b.resetAt ?? 0)).map((acc)=>acc.id);
            }
        case "resetSoonest":
            {
                return accounts.sort((a, b)=>{
                    if (a.resetAt === null && b.resetAt !== null) return 1;
                    if (a.resetAt !== null && b.resetAt === null) return -1;
                    if (a.resetAt === null && b.resetAt === null) return 0;
                    return (a.resetAt ?? 0) - (b.resetAt ?? 0);
                }).map((acc)=>acc.id);
            }
        case "accountName":
            {
                return [
                    ...accounts
                ].sort((a, b)=>a.name > b.name ? 1 : -1).map((acc)=>acc.id);
            }
        default:
            return getRecommendedSortOrder(accounts);
    }
};
const checkExpiration = ()=>{
    const storage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadStorage"])();
    const now = Date.now();
    const accounts = storage.accounts.map((acc)=>{
        let status = acc.status;
        let usedAt = acc.usedAt;
        let resetAt = acc.resetAt;
        if (status === "used" && resetAt !== null && now >= resetAt) {
            status = "available";
            usedAt = null;
            resetAt = null;
        }
        return {
            ...acc,
            status,
            usedAt,
            resetAt
        };
    });
    const expiredCount = accounts.filter((acc)=>acc.status === "available" && acc.usedAt === null).length;
    const justSwitched = accounts.filter((acc)=>{
        const prev = storage.accounts.find((a)=>a.id === acc.id);
        return prev && prev.status === "used" && acc.status === "available";
    });
    // Save reconciled data
    const reconciled = accounts.filter((acc, i)=>acc.status !== storage.accounts[i].status || acc.usedAt !== storage.accounts[i].usedAt || acc.resetAt !== storage.accounts[i].resetAt);
    if (reconciled.length > 0) {
        const finalAccounts = reconciled.map((acc, i)=>({
                ...storage.accounts[i],
                status: acc.status,
                usedAt: acc.usedAt,
                resetAt: acc.resetAt
            }));
        storage.accounts = finalAccounts;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveStorage"])(storage);
    }
    return {
        expiredCount,
        justSwitched
    };
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/lib/account-manager/storage.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addAccount",
    ()=>addAccount,
    "clearAllData",
    ()=>clearAllData,
    "deleteAccount",
    ()=>deleteAccount,
    "exportData",
    ()=>exportData,
    "getAccounts",
    ()=>getAccounts,
    "getGlobalDuration",
    ()=>getGlobalDuration,
    "importData",
    ()=>importData,
    "loadStorage",
    ()=>loadStorage,
    "reconcileExpiration",
    ()=>reconcileExpiration,
    "saveStorage",
    ()=>saveStorage,
    "setGlobalDuration",
    ()=>setGlobalDuration,
    "updateAccount",
    ()=>updateAccount
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/account-manager/types.ts [app-client] (ecmascript)");
;
const STORAGE_KEY = "antigravity_accounts_v1";
const loadStorage = ()=>{
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            const initial = {
                accounts: [],
                globalDuration: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_GLOBAL_DURATION"]
            };
            saveStorage(initial);
            return initial;
        }
        const parsed = JSON.parse(raw);
        if (parsed.version === undefined) parsed.version = 1;
        parsed.accounts = parsed.accounts.map((acc)=>({
                id: acc.id || crypto.randomUUID(),
                name: acc.name || `Account ${parsed.accounts.length + 1}`,
                email: acc.email || "",
                notes: acc.notes,
                status: acc.status || "available",
                usedAt: acc.usedAt ?? null,
                resetAt: acc.resetAt ?? null,
                usageDuration: acc.usageDuration ?? __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_GLOBAL_DURATION"],
                createdAt: acc.createdAt ?? Date.now(),
                updatedAt: acc.updatedAt ?? Date.now()
            }));
        parsed.globalDuration = parsed.globalDuration ?? __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_GLOBAL_DURATION"];
        return parsed;
    } catch (error) {
        console.error("Failed to load storage", error);
        const initial = {
            accounts: [],
            globalDuration: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_GLOBAL_DURATION"]
        };
        saveStorage(initial);
        return initial;
    }
};
const saveStorage = (data)=>{
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Failed to save storage", error);
    }
};
const getAccounts = ()=>{
    return loadStorage().accounts;
};
const getGlobalDuration = ()=>{
    return loadStorage().globalDuration;
};
const setGlobalDuration = (duration)=>{
    saveStorage({
        accounts: loadStorage().accounts,
        globalDuration: duration
    });
};
const addAccount = (account)=>{
    const storage = loadStorage();
    const now = Date.now();
    const newAccount = {
        id: crypto.randomUUID(),
        name: account.name,
        email: account.email,
        notes: account.notes,
        status: account.status || "available",
        usedAt: null,
        resetAt: null,
        usageDuration: account.usageDuration ?? storage.globalDuration,
        createdAt: now,
        updatedAt: now
    };
    storage.accounts.push(newAccount);
    saveStorage(storage);
    return newAccount;
};
const updateAccount = (id, updates)=>{
    const storage = loadStorage();
    const index = storage.accounts.findIndex((acc)=>acc.id === id);
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
        updatedAt: now
    };
    saveStorage(storage);
    return storage.accounts[index];
};
const deleteAccount = (id)=>{
    const storage = loadStorage();
    const before = storage.accounts.length;
    storage.accounts = storage.accounts.filter((acc)=>acc.id !== id);
    if (storage.accounts.length < before) {
        saveStorage(storage);
        return true;
    }
    return false;
};
const importData = (jsonData)=>{
    const errors = [];
    let imported = 0;
    try {
        if (!jsonData?.accounts || !Array.isArray(jsonData.accounts)) {
            errors.push("Invalid JSON: missing or invalid 'accounts' array");
            return {
                success: false,
                imported: 0,
                errors
            };
        }
        const existing = loadStorage();
        const globalDuration = jsonData.globalDuration ?? existing.globalDuration;
        for (const acc of jsonData.accounts){
            if (!acc.name || !acc.email) {
                errors.push(`Account missing required fields: name or email`);
                continue;
            }
            const parsedDuration = __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DURATION_LABELS"][acc.usageDuration] ?? __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_GLOBAL_DURATION"];
            const newAcc = {
                id: acc.id || crypto.randomUUID(),
                name: acc.name,
                email: acc.email,
                notes: acc.notes,
                status: acc.status || "available",
                usedAt: acc.usedAt ?? null,
                resetAt: acc.resetAt ?? null,
                usageDuration: parsedDuration,
                createdAt: acc.createdAt ?? Date.now(),
                updatedAt: acc.updatedAt ?? Date.now()
            };
            existing.accounts.push(newAcc);
            imported++;
        }
        if (jsonData.globalDuration) {
            existing.globalDuration = jsonData.globalDuration;
        }
        saveStorage(existing);
        return {
            success: true,
            imported,
            errors: errors.length === 0 ? [] : errors
        };
    } catch (error) {
        errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
        return {
            success: false,
            imported: 0,
            errors
        };
    }
};
const exportData = ()=>{
    const storage = loadStorage();
    return {
        version: 1,
        accounts: storage.accounts.map((acc)=>({
                ...acc
            })),
        globalDuration: storage.globalDuration
    };
};
const clearAllData = ()=>{
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error("Failed to clear storage", error);
        return false;
    }
};
const reconcileExpiration = ()=>{
    const storage = loadStorage();
    const now = Date.now();
    const accounts = storage.accounts.map((acc)=>{
        let status = acc.status;
        let usedAt = acc.usedAt;
        let resetAt = acc.resetAt;
        if (status === "used" && resetAt !== null && now >= resetAt) {
            status = "available";
            usedAt = null;
            resetAt = null;
        }
        return {
            ...acc,
            status,
            usedAt,
            resetAt
        };
    });
    const reconciled = accounts.filter((acc, i)=>acc.status !== storage.accounts[i].status || acc.usedAt !== storage.accounts[i].usedAt || acc.resetAt !== storage.accounts[i].resetAt);
    if (reconciled.length > 0) {
        storage.accounts = reconciled.map((acc, i)=>({
                ...storage.accounts[i],
                status: acc.status,
                usedAt: acc.usedAt,
                resetAt: acc.resetAt
            }));
        saveStorage(storage);
    }
    return accounts;
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/lib/account-manager/types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_GLOBAL_DURATION",
    ()=>DEFAULT_GLOBAL_DURATION,
    "DURATION_LABELS",
    ()=>DURATION_LABELS
]);
const DEFAULT_GLOBAL_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const DURATION_LABELS = {
    "1 Day": 24 * 60 * 60 * 1000,
    "2 Days": 48 * 60 * 60 * 1000,
    "3 Days": 72 * 60 * 60 * 1000,
    "7 Days": 7 * 24 * 60 * 60 * 1000,
    "15 Days": 15 * 24 * 60 * 60 * 1000,
    "1 Month": 30 * 24 * 60 * 60 * 1000,
    Custom: 7 * 24 * 60 * 60 * 1000
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Page
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/flag.mjs [app-client] (ecmascript) <export default as Flag>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.mjs [app-client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.mjs [app-client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check-big.mjs [app-client] (ecmascript) <export default as CheckCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/info.mjs [app-client] (ecmascript) <export default as Info>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/account-manager/storage.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$expiration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/account-manager/expiration.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/account-manager/types.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
function AccountRow({ id, isUsed, onToggle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onToggle,
        className: `
        w-8 h-8 rounded-full flex items-center justify-center ${isUsed ? "bg-green-600 text-white" : "bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors"}
      `,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            width: "14",
            height: "14",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M18 6L9 17L3 6"
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 20,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 19,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
_c = AccountRow;
function StatusBadge({ label, countdown, lastUsed }) {
    const bgClass = label === "available" ? "bg-green-600/20 text-green-400 border-green-500/30" : label === "used" ? "bg-amber-600/20 text-amber-400 border-amber-500/30" : label === "expiringSoon" ? "bg-yellow-600/20 text-yellow-400 border-yellow-500/30" : "bg-red-600/20 text-red-400 border-red-500/30";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${bgClass}`,
        children: [
            label,
            countdown !== "—" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "ml-1 text-[0.7em]",
                children: [
                    "| ",
                    countdown
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 38,
                columnNumber: 29
            }, this),
            lastUsed && lastUsed !== "—" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-[0.65em] ml-1 text-gray-500 block",
                children: [
                    "• ",
                    lastUsed
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 39,
                columnNumber: 40
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_c1 = StatusBadge;
function Page() {
    _s();
    const [accounts, setAccounts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [globalDuration, setGlobalDuration] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_GLOBAL_DURATION"]);
    const [sortBy, setSortBy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("recommended");
    const [searchQuery, setSearchQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [isModalOpen, setIsModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        name: "",
        email: "",
        notes: "",
        duration: globalDuration
    });
    const [toast, setToast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load from localStorage
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Page.useEffect": ()=>{
            const stored = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAccounts"])();
            if (stored.length > 0) {
                setAccounts(stored);
            }
            const dur = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getGlobalDuration"])();
            if (dur) setGlobalDuration(dur);
        }
    }["Page.useEffect"], []);
    // Reconcile expiration
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Page.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$expiration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["checkExpiration"])();
        }
    }["Page.useEffect"], [
        accounts,
        globalDuration
    ]);
    // Persist
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Page.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveStorage"])({
                accounts,
                globalDuration
            });
        }
    }["Page.useEffect"], [
        accounts,
        globalDuration
    ]);
    // Filter accounts
    const filtered = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[filtered]": ()=>{
            return accounts.filter({
                "Page.useMemo[filtered]": (acc)=>{
                    if (searchQuery === "") return true;
                    return acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || acc.email.toLowerCase().includes(searchQuery.toLowerCase());
                }
            }["Page.useMemo[filtered]"]);
        }
    }["Page.useMemo[filtered]"], [
        accounts,
        searchQuery
    ]);
    // Sort accounts
    const sorted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[sorted]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$expiration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSortOrder"])(filtered, sortBy)
    }["Page.useMemo[sorted]"], [
        filtered,
        sortBy
    ]);
    // Stats
    const total = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[total]": ()=>accounts.length
    }["Page.useMemo[total]"], [
        accounts
    ]);
    const available = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[available]": ()=>accounts.filter({
                "Page.useMemo[available]": (a)=>a.status === "available"
            }["Page.useMemo[available]"]).length
    }["Page.useMemo[available]"], [
        accounts
    ]);
    const used = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[used]": ()=>accounts.filter({
                "Page.useMemo[used]": (a)=>a.status === "used"
            }["Page.useMemo[used]"]).length
    }["Page.useMemo[used]"], [
        accounts
    ]);
    const expiringSoon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[expiringSoon]": ()=>accounts.filter({
                "Page.useMemo[expiringSoon]": (a)=>a.status === "used" && a.resetAt && Date.now() < a.resetAt && Date.now() > a.resetAt - 24 * 60 * 60 * 1000
            }["Page.useMemo[expiringSoon]"]).length
    }["Page.useMemo[expiringSoon]"], [
        accounts
    ]);
    const resetToday = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[resetToday]": ()=>{
            if (accounts.length === 0) return 0;
            const today = new Date();
            return accounts.filter({
                "Page.useMemo[resetToday]": (a)=>{
                    if (!a.resetAt) return false;
                    const r = new Date(a.resetAt);
                    return r.getFullYear() === today.getFullYear() && r.getMonth() === today.getMonth() && r.getDate() === today.getDate();
                }
            }["Page.useMemo[resetToday]"]).length;
        }
    }["Page.useMemo[resetToday]"], [
        accounts
    ]);
    // Next available
    const nextAvailable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Page.useMemo[nextAvailable]": ()=>{
            const rec = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$expiration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRecommendedSortOrder"])(accounts);
            const avail = rec.filter({
                "Page.useMemo[nextAvailable].avail": (id)=>{
                    const a = accounts.find({
                        "Page.useMemo[nextAvailable].avail.a": (x)=>x.id === id
                    }["Page.useMemo[nextAvailable].avail.a"]);
                    return a && a.status === "available";
                }
            }["Page.useMemo[nextAvailable].avail"]);
            if (avail.length > 0) {
                const first = accounts.find({
                    "Page.useMemo[nextAvailable].first": (a)=>a.id === avail[0]
                }["Page.useMemo[nextAvailable].first"]);
                return {
                    id: avail[0],
                    label: "Available now",
                    resetText: ""
                };
            }
            const usedWithReset = accounts.filter({
                "Page.useMemo[nextAvailable].usedWithReset": (a)=>a.status === "used" && a.resetAt !== null
            }["Page.useMemo[nextAvailable].usedWithReset"]);
            if (usedWithReset.length > 0) {
                const sorted = [
                    ...usedWithReset
                ].sort({
                    "Page.useMemo[nextAvailable].sorted": (a, b)=>(a.resetAt ?? 0) - (b.resetAt ?? 0)
                }["Page.useMemo[nextAvailable].sorted"]);
                const first = sorted[0];
                const remaining = first && first.resetAt ? first.resetAt - Date.now() : 0;
                const hours = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60)));
                const mins = Math.max(0, Math.ceil(remaining % (1000 * 60 * 60) / (1000 * 60)));
                return {
                    id: first.id,
                    label: `in ${hours}h ${mins}m`,
                    resetText: first && first.resetAt ? `${new Date(first.resetAt).toLocaleDateString()} ${new Date(first.resetAt).toLocaleTimeString()}` : ""
                };
            }
            return null;
        }
    }["Page.useMemo[nextAvailable]"], [
        accounts
    ]);
    // Format countdown for display
    const formatCountdown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[formatCountdown]": (resetAt, usageDuration)=>{
            if (!resetAt) return "—";
            const remaining = resetAt - Date.now();
            if (remaining <= 0) return "Available now";
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$expiration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCountdownText"])(remaining, usageDuration ?? globalDuration);
        }
    }["Page.useCallback[formatCountdown]"], []);
    // Format duration for display
    const formatDuration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[formatDuration]": (ms)=>{
            const days = Math.floor(ms / (1000 * 60 * 60 * 24));
            const hours = Math.floor(ms % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
            const minutes = Math.floor(ms % (1000 * 60 * 60) / (1000 * 60));
            if (days > 0) return `${days}d ${hours}h ${minutes}m`;
            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
        }
    }["Page.useCallback[formatDuration]"], []);
    // Format duration global
    const formatDurationGlobal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[formatDurationGlobal]": (ms)=>formatDuration(ms)
    }["Page.useCallback[formatDurationGlobal]"], [
        formatDuration
    ]);
    // Get last used text
    const getLastUsedText = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[getLastUsedText]": (resetAt, usageDuration)=>{
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
        }
    }["Page.useCallback[getLastUsedText]"], []);
    // Add account handler
    const handleAdd = (data)=>{
        const newAcc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addAccount"])({
            name: data.name,
            email: data.email,
            notes: data.notes,
            status: "available",
            usageDuration: data.duration
        });
        setAccounts((prev)=>[
                ...prev,
                newAcc
            ]);
        setFormData({
            name: "",
            email: "",
            notes: "",
            duration: globalDuration
        });
        setIsModalOpen(false);
        setToast({
            type: "success",
            title: "Account added",
            description: `Account "${data.name}" added successfully`
        });
    };
    // Toggle checkbox
    const handleToggle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleToggle]": (id)=>{
            const acc = accounts.find({
                "Page.useCallback[handleToggle].acc": (a)=>a.id === id
            }["Page.useCallback[handleToggle].acc"]);
            if (!acc) return;
            if (acc.status === "available") {
                const duration = acc.usageDuration ?? globalDuration;
                const now = Date.now();
                const resetAt = now + duration;
                const updated = {
                    ...acc,
                    status: "used",
                    usedAt: now,
                    resetAt,
                    usageDuration: duration
                };
                setAccounts({
                    "Page.useCallback[handleToggle]": (prev)=>prev.map({
                            "Page.useCallback[handleToggle]": (a)=>a.id === id ? updated : a
                        }["Page.useCallback[handleToggle]"])
                }["Page.useCallback[handleToggle]"]);
                setToast({
                    type: "success",
                    title: "Account used",
                    description: `Account "${acc.name}" is now marked as used. Resets in ${formatDuration(duration)}`
                });
            } else {
                setAccounts({
                    "Page.useCallback[handleToggle]": (prev)=>prev.map({
                            "Page.useCallback[handleToggle]": (a)=>a.id === id ? {
                                    ...a,
                                    status: "available",
                                    usedAt: null,
                                    resetAt: null
                                } : a
                        }["Page.useCallback[handleToggle]"])
                }["Page.useCallback[handleToggle]"]);
                setToast({
                    type: "success",
                    title: "Account available",
                    description: `Account "${acc.name}" is now available again`
                });
            }
        }
    }["Page.useCallback[handleToggle]"], [
        accounts,
        globalDuration,
        formatDuration
    ]);
    // Mark as available
    const handleMarkAvailable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleMarkAvailable]": (id)=>{
            const acc = accounts.find({
                "Page.useCallback[handleMarkAvailable].acc": (a)=>a.id === id
            }["Page.useCallback[handleMarkAvailable].acc"]);
            if (!acc) return;
            setAccounts({
                "Page.useCallback[handleMarkAvailable]": (prev)=>prev.map({
                        "Page.useCallback[handleMarkAvailable]": (a)=>a.id === id ? {
                                ...a,
                                status: "available",
                                usedAt: null,
                                resetAt: null
                            } : a
                    }["Page.useCallback[handleMarkAvailable]"])
            }["Page.useCallback[handleMarkAvailable]"]);
            setToast({
                type: "success",
                title: "Account available",
                description: `Account "${acc.name}" is now available again`
            });
        }
    }["Page.useCallback[handleMarkAvailable]"], []);
    // Reset timer
    const handleResetTimer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleResetTimer]": (id)=>{
            const acc = accounts.find({
                "Page.useCallback[handleResetTimer].acc": (a)=>a.id === id
            }["Page.useCallback[handleResetTimer].acc"]);
            if (!acc) return;
            const now = Date.now();
            const duration = acc.usageDuration ?? globalDuration;
            const resetAt = now + duration;
            setAccounts({
                "Page.useCallback[handleResetTimer]": (prev)=>prev.map({
                        "Page.useCallback[handleResetTimer]": (a)=>a.id === id ? {
                                ...a,
                                usedAt: now,
                                resetAt,
                                usageDuration: duration
                            } : a
                    }["Page.useCallback[handleResetTimer]"])
            }["Page.useCallback[handleResetTimer]"]);
        }
    }["Page.useCallback[handleResetTimer]"], [
        globalDuration
    ]);
    // Delete account
    const handleDelete = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleDelete]": (id)=>{
            setAccounts({
                "Page.useCallback[handleDelete]": (prev)=>prev.filter({
                        "Page.useCallback[handleDelete]": (a)=>a.id !== id
                    }["Page.useCallback[handleDelete]"])
            }["Page.useCallback[handleDelete]"]);
            setToast({
                type: "info",
                title: "Account deleted",
                description: "The account has been removed from your tracker"
            });
        }
    }["Page.useCallback[handleDelete]"], []);
    // Reset all
    const handleDeleteAll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleDeleteAll]": ()=>{
            setAccounts([]);
            setToast({
                type: "info",
                title: "All data cleared",
                description: "All accounts and settings have been reset"
            });
        }
    }["Page.useCallback[handleDeleteAll]"], []);
    // Import data
    const handleImport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleImport]": (file)=>{
            const reader = new FileReader();
            reader.onload = ({
                "Page.useCallback[handleImport]": (e)=>{
                    const data = e.target?.result;
                    if (typeof data === "string") {
                        const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["importData"])(JSON.parse(data));
                        if (result.success) {
                            setAccounts({
                                "Page.useCallback[handleImport]": (prev)=>[
                                        ...prev,
                                        ...result.imported > 0 ? [] : []
                                    ]
                            }["Page.useCallback[handleImport]"]);
                            setToast({
                                type: "success",
                                title: "Import successful",
                                description: `${result.imported} accounts imported`
                            });
                        } else {
                            setToast({
                                type: "error",
                                title: "Import failed",
                                description: "Could not parse the imported data"
                            });
                        }
                    }
                }
            })["Page.useCallback[handleImport]"];
            reader.readAsText(file);
        }
    }["Page.useCallback[handleImport]"], []);
    // Export data
    const handleExport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleExport]": ()=>{
            const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$storage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["exportData"])();
            const blob = new Blob([
                JSON.stringify(data, null, 2)
            ], {
                type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "antigravity-accounts-backup.json";
            a.click();
            URL.revokeObjectURL(url);
            setToast({
                type: "success",
                title: "Exported",
                description: "Account data exported successfully"
            });
        }
    }["Page.useCallback[handleExport]"], []);
    // Use next account
    const handleUseNext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleUseNext]": ()=>{
            const rec = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$expiration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRecommendedSortOrder"])(accounts);
            const avail = rec.filter({
                "Page.useCallback[handleUseNext].avail": (id)=>{
                    const a = accounts.find({
                        "Page.useCallback[handleUseNext].avail.a": (x)=>x.id === id
                    }["Page.useCallback[handleUseNext].avail.a"]);
                    return a && a.status === "available";
                }
            }["Page.useCallback[handleUseNext].avail"]);
            if (avail.length > 0) {
                const firstId = avail[0];
                const firstAcc = accounts.find({
                    "Page.useCallback[handleUseNext].firstAcc": (a)=>a.id === firstId
                }["Page.useCallback[handleUseNext].firstAcc"]);
                if (firstAcc) {
                    const duration = firstAcc.usageDuration ?? globalDuration;
                    const now = Date.now();
                    const resetAt = now + duration;
                    setAccounts({
                        "Page.useCallback[handleUseNext]": (prev)=>prev.map({
                                "Page.useCallback[handleUseNext]": (a)=>a.id === firstId ? {
                                        ...a,
                                        status: "used",
                                        usedAt: now,
                                        resetAt,
                                        usageDuration: duration
                                    } : a
                            }["Page.useCallback[handleUseNext]"])
                    }["Page.useCallback[handleUseNext]"]);
                    setToast({
                        type: "success",
                        title: "Next account selected",
                        description: `Account "${firstAcc.name}" is now marked as used. Resets in ${formatDurationGlobal(duration)}`
                    });
                }
            } else {
                setToast({
                    type: "error",
                    title: "No accounts available",
                    description: "All accounts are currently in use. Wait for an account to become available."
                });
            }
        }
    }["Page.useCallback[handleUseNext]"], [
        accounts,
        globalDuration,
        formatDurationGlobal
    ]);
    // Handle form input change
    const handleInputChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleInputChange]": (e)=>{
            const { name, value } = e.target;
            setFormData({
                "Page.useCallback[handleInputChange]": (prev)=>({
                        ...prev,
                        [name]: value
                    })
            }["Page.useCallback[handleInputChange]"]);
        }
    }["Page.useCallback[handleInputChange]"], []);
    // Handle duration select
    const handleDurationChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[handleDurationChange]": (value)=>{
            setFormData({
                "Page.useCallback[handleDurationChange]": (prev)=>({
                        ...prev,
                        duration: parseInt(value, 10)
                    })
            }["Page.useCallback[handleDurationChange]"]);
        }
    }["Page.useCallback[handleDurationChange]"], []);
    // Open modal
    const openAccountModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[openAccountModal]": ()=>{
            setIsModalOpen(true);
            setFormData({
                name: "",
                email: "",
                notes: "",
                duration: globalDuration
            });
        }
    }["Page.useCallback[openAccountModal]"], [
        globalDuration
    ]);
    // Close modal
    const closeAccountModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[closeAccountModal]": ()=>{
            setIsModalOpen(false);
            setFormData({
                name: "",
                email: "",
                notes: "",
                duration: globalDuration
            });
        }
    }["Page.useCallback[closeAccountModal]"], [
        globalDuration
    ]);
    // Duration options
    const durationOptions = [
        {
            value: 1,
            label: "1 Day"
        },
        {
            value: 2,
            label: "2 Days"
        },
        {
            value: 3,
            label: "3 Days"
        },
        {
            value: 7,
            label: "7 Days"
        },
        {
            value: 15,
            label: "15 Days"
        },
        {
            value: 30,
            label: "1 Month"
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen bg-gray-900",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "border-b border-gray-700 bg-gray-800 py-3 px-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-7xl mx-auto flex items-center justify-between",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                    className: "w-6 h-6 text-green-400",
                                    viewBox: "0 0 24 24",
                                    fill: "none",
                                    stroke: "currentColor",
                                    strokeWidth: 2,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                                            x: "3",
                                            y: "3",
                                            width: "18",
                                            height: "18",
                                            rx: "2",
                                            ry: "2"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 374,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                            x1: "3",
                                            y1: "21",
                                            x2: "21",
                                            y2: "3"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 375,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                            x1: "9",
                                            y1: "21",
                                            x2: "3",
                                            y2: "3"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 376,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 373,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xl font-bold",
                                    children: "ANTIGRAVITY ACCOUNT MANAGER"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 378,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 372,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                                            className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 382,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            value: searchQuery,
                                            onChange: (e)=>setSearchQuery(e.target.value),
                                            placeholder: "⌕ Search accounts...",
                                            className: "pl-8 bg-gray-800 border border-gray-700 rounded-full h-10 w-64 focus:outline-none focus:border-green-500 focus:text-white transition-colors",
                                            "aria-label": "Search accounts"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 383,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 381,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 text-sm text-gray-400",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "•"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 393,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-medium",
                                            onClick: ()=>setSortBy("recommended"),
                                            children: "ALL"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 394,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "mx-2",
                                            children: "•"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 395,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            onClick: ()=>setSortBy("availableFirst"),
                                            className: sortBy === "availableFirst" ? "font-semibold text-green-400" : "hover:text-gray-300 transition-colors",
                                            children: "AVAILABLE"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 396,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "mx-2",
                                            children: "•"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 397,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            onClick: ()=>setSortBy("resetSoonest"),
                                            className: sortBy === "resetSoonest" ? "font-semibold text-yellow-400" : "hover:text-gray-300 transition-colors",
                                            children: "EXPIRING"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 398,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "mx-2",
                                            children: "•"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 399,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            onClick: ()=>setSortBy("accountName"),
                                            className: sortBy === "accountName" ? "font-semibold text-amber-400" : "hover:text-gray-300 transition-colors",
                                            children: "NAME"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 400,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 392,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 380,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 371,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 370,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-7xl mx-auto px-4 py-2 border-b border-gray-700",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-800 border border-gray-700 rounded-lg p-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs text-gray-400",
                                    children: "TOTAL"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 410,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xl font-bold text-white",
                                    children: total
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 411,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 409,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-800 border border-green-600/20 rounded-lg p-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs text-green-400",
                                    children: "AVAILABLE"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 414,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xl font-bold text-green-300",
                                    children: available
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 415,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 413,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-800 border border-amber-500/20 rounded-lg p-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs text-amber-400",
                                    children: "IN USE"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 418,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xl font-bold text-amber-300",
                                    children: used
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 419,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 417,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-800 border border-yellow-500/20 rounded-lg p-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs text-yellow-400",
                                    children: "EXPIRING SOON"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 422,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xl font-bold text-yellow-300",
                                    children: expiringSoon
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 423,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 421,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-800 border border-red-500/20 rounded-lg p-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xs text-red-400",
                                    children: "RESET TODAY"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 426,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-xl font-bold text-red-300",
                                    children: resetToday
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 427,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 425,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 408,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 407,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-7xl mx-auto px-4 py-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6 shadow-sm",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-start gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__["Flag"], {
                                    className: "w-5 h-5 text-yellow-400 flex-shrink-0"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 437,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex-1 min-w-0",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm font-medium text-white",
                                            children: "NEXT AVAILABLE"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 439,
                                            columnNumber: 15
                                        }, this),
                                        nextAvailable != null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mt-2 flex items-center gap-2",
                                            children: [
                                                nextAvailable.label === "Available now" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-green-400 font-medium",
                                                    children: "Available now"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 443,
                                                    columnNumber: 21
                                                }, this),
                                                nextAvailable.label !== "Available now" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-yellow-400",
                                                    children: nextAvailable.label
                                                }, void 0, false, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 446,
                                                    columnNumber: 21
                                                }, this),
                                                nextAvailable.resetText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-gray-500",
                                                    children: [
                                                        "Resets ",
                                                        nextAvailable.resetText
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 449,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 441,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-gray-500",
                                            children: "No accounts with availability info"
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 453,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 438,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 436,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 435,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-6",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: openAccountModal,
                            className: "inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                    width: "16",
                                    height: "16",
                                    viewBox: "0 0 24 24",
                                    fill: "none",
                                    stroke: "currentColor",
                                    strokeWidth: 2,
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                        d: "M12 5v14M5 12h14"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 466,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 465,
                                    columnNumber: 13
                                }, this),
                                "⚡ USE NEXT ACCOUNT"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 461,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 460,
                        columnNumber: 9
                    }, this),
                    isModalOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-xl font-bold text-white mb-4",
                                    children: "Add Account"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 476,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                    onSubmit: (e)=>{
                                        e.preventDefault();
                                        if (formData.name.trim() && formData.email.trim()) {
                                            handleAdd(formData);
                                        }
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm text-gray-300 mb-1 block",
                                                            children: "Account name"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 487,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "text",
                                                            name: "name",
                                                            value: formData.name,
                                                            onChange: handleInputChange,
                                                            placeholder: "e.g. Account 01",
                                                            className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 transition-colors",
                                                            required: true
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 488,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 486,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm text-gray-300 mb-1 block",
                                                            children: "Email"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 499,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "email",
                                                            name: "email",
                                                            value: formData.email,
                                                            onChange: handleInputChange,
                                                            placeholder: "account@example.com",
                                                            className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 transition-colors"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 500,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 498,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm text-gray-300 mb-1 block",
                                                            children: "Notes"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 510,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                            name: "notes",
                                                            value: formData.notes,
                                                            onChange: handleInputChange,
                                                            placeholder: "Optional notes about this account",
                                                            className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 resize-h transition-colors",
                                                            rows: 3
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 511,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 509,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm text-gray-300 mb-1 block",
                                                            children: "Usage duration"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 521,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                            value: formData.duration,
                                                            onChange: (e)=>handleDurationChange(e.target.value),
                                                            className: "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 appearance-none pl-3",
                                                            children: durationOptions.map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                    value: opt.value,
                                                                    children: opt.label
                                                                }, opt.value, false, {
                                                                    fileName: "[project]/app/page.tsx",
                                                                    lineNumber: 528,
                                                                    columnNumber: 25
                                                                }, this))
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 522,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 520,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 485,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex gap-3 mt-6",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: closeAccountModal,
                                                    className: "flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors",
                                                    children: "Cancel"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 536,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "submit",
                                                    className: "flex-1 bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700 transition-colors font-medium",
                                                    children: "ADD ACCOUNT"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 543,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 535,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 477,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 475,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 474,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            accounts.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-gray-900 border border-gray-700 rounded-xl p-8 text-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flag$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Flag$3e$__["Flag"], {
                                        className: "w-12 h-12 mx-auto mb-4 text-gray-600 opacity-50"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 558,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-xl font-bold text-gray-300",
                                        children: "No accounts yet"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 559,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-gray-500 mt-2",
                                        children: "Add your accounts to start tracking your rotation"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 560,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: openAccountModal,
                                        className: "mt-4 inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                width: "16",
                                                height: "16",
                                                viewBox: "0 0 24 24",
                                                fill: "none",
                                                stroke: "currentColor",
                                                strokeWidth: 2,
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                    d: "M12 5v14M5 12h14"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 566,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/page.tsx",
                                                lineNumber: 565,
                                                columnNumber: 15
                                            }, this),
                                            "+ Add Account"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 561,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 557,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-x-auto",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "w-full min-w-[600px]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                className: "border-b border-gray-700 bg-gray-800",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "p-3 text-left text-xs font-medium text-gray-400",
                                                        children: "#"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/page.tsx",
                                                        lineNumber: 576,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "p-3 text-left text-xs font-medium text-gray-400",
                                                        children: "ACCOUNT"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/page.tsx",
                                                        lineNumber: 577,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "p-3 text-left text-xs font-medium text-gray-400",
                                                        children: "EMAIL"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/page.tsx",
                                                        lineNumber: 578,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "p-3 text-left text-xs font-medium text-gray-400",
                                                        children: "STATUS"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/page.tsx",
                                                        lineNumber: 579,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "p-3 text-left text-xs font-medium text-gray-400",
                                                        children: "RESET"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/page.tsx",
                                                        lineNumber: 580,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "p-3 text-right text-xs font-medium text-gray-400",
                                                        children: "ACTION"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/page.tsx",
                                                        lineNumber: 581,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/page.tsx",
                                                lineNumber: 575,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 574,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            children: sorted.map((id, idx)=>{
                                                const acc = accounts.find((a)=>a.id === id);
                                                if (!acc) return null;
                                                const { label, countdown } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$account$2d$manager$2f$expiration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getStatusLabel"])(acc.resetAt, acc.usageDuration);
                                                const isAvailable = acc.status === "available";
                                                const isUsed = acc.status === "used";
                                                const lastUsed = getLastUsedText(acc.resetAt, acc.usageDuration);
                                                const rowBg = isAvailable ? "bg-gray-900 hover:bg-gray-800" : isUsed ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-800 hover:bg-gray-700";
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    className: `${rowBg} transition-colors duration-200`,
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "p-3 text-right text-xs text-gray-500",
                                                            children: idx + 1
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 605,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "p-3 flex items-center gap-2",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-white font-medium truncate w-24",
                                                                children: acc.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/page.tsx",
                                                                lineNumber: 607,
                                                                columnNumber: 25
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 606,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "p-3 text-sm text-gray-400",
                                                            children: acc.email
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 609,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "p-3",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusBadge, {
                                                                label: label,
                                                                countdown: countdown,
                                                                lastUsed: lastUsed
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/page.tsx",
                                                                lineNumber: 611,
                                                                columnNumber: 25
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 610,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "p-3 text-sm text-gray-400",
                                                            children: acc.resetAt ? new Date(acc.resetAt).toLocaleString() : "—"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 617,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "p-3 text-right",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AccountRow, {
                                                                id: acc.id,
                                                                isUsed: isUsed,
                                                                onToggle: ()=>handleToggle(acc.id)
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/page.tsx",
                                                                lineNumber: 621,
                                                                columnNumber: 25
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/page.tsx",
                                                            lineNumber: 620,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, id, true, {
                                                    fileName: "[project]/app/page.tsx",
                                                    lineNumber: 601,
                                                    columnNumber: 21
                                                }, this);
                                            })
                                        }, void 0, false, {
                                            fileName: "[project]/app/page.tsx",
                                            lineNumber: 584,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 573,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 572,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 556,
                        columnNumber: 9
                    }, this),
                    toast && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-6 py-3 shadow-lg text-sm font-medium transition-all opacity-0 visibility-hidden opacity-0".concat(toast.type === "success" ? " bg-green-600/90 text-green-400 border-green-500/30" : toast.type === "info" ? " bg-blue-600/90 text-blue-400 border-blue-500/30" : toast.type === "error" ? " bg-red-600/90 text-white border-red-500/30" : ""),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    toast.type === "success" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__["CheckCircle"], {
                                        className: "w-4 h-4"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 639,
                                        columnNumber: 44
                                    }, this),
                                    toast.type === "info" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__["Info"], {
                                        className: "w-4 h-4"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 640,
                                        columnNumber: 41
                                    }, this),
                                    toast.type === "error" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                        className: "w-4 h-4"
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 641,
                                        columnNumber: 42
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: toast.title
                                    }, void 0, false, {
                                        fileName: "[project]/app/page.tsx",
                                        lineNumber: 642,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 638,
                                columnNumber: 13
                            }, this),
                            toast.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "ml-2 text-opacity-80",
                                children: toast.description
                            }, void 0, false, {
                                fileName: "[project]/app/page.tsx",
                                lineNumber: 644,
                                columnNumber: 35
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/page.tsx",
                        lineNumber: 637,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/page.tsx",
                lineNumber: 433,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 368,
        columnNumber: 5
    }, this);
}
_s(Page, "+1g4VJoQSn8pqHUUQa6czYYuuJM=");
_c2 = Page;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "AccountRow");
__turbopack_context__.k.register(_c1, "StatusBadge");
__turbopack_context__.k.register(_c2, "Page");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_0tvmd54._.js.map