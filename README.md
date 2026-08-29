# Antigravity Account Rotation Manager

A personal account usage tracker that helps you manage account rotation without authentication, databases, or Google/Antigravity automation.

## 📋 What It Does

Manually track your account usage rotation with automatic timers. Add accounts, mark them as used, and the app automatically tracks when they become available again.

**Core workflow:**
1. Add accounts with name, email, and usage duration
2. Mark accounts as used - timer starts
3. After the duration expires, accounts automatically become available
4. Use "Use Next Account" to select the best available account

## 🏗️ Architecture

- **Frontend**: Next.js 14 + React + TypeScript + Tailwind CSS
- **Storage**: Browser `localStorage` only (no backend, no database)
- **Hosting**: Vercel (static deployment)
- **Privacy**: No Google/Antigravity automation, no token storage, no external accounts

## ✅ Features

- Add/edit/delete accounts
- Checkbox-based usage tracking with countdown timers
- Automatic expiration when `currentTime >= resetAt`
- Summary statistics (TOTAL, AVAILABLE, IN USE, EXPIRING SOON, RESET TODAY)
- Global duration selector (1D/2D/3D/7D/15D/1M, default 7D)
- Per-account duration storage (changing global duration doesn't alter existing timers)
- Search by name/email
- Filter by status (all/available/used/expiringSoon)
- Sorting: recommended, recentlyUsed, availableFirst, resetSoonest, accountName
- "Next Account" feature - selects first available per recommended ordering
- Next Available indicator - shows upcoming account availability with reset time
- Import/export JSON with schema validation
- Clear all data functionality
- Responsive design: desktop table → mobile cards
- Dark-first UI design
- Toast notifications for all actions
- "Last used" indicators on accounts

## 🚀 Deployment

Since there's no backend, deployment is simple:

```bash
# From project root
vercel
```

Or connect this GitHub repo to Vercel:
- Repository: `Manthan-13521/Antigravity_handler`
- Framework: Next.js
- No environment variables needed

**All account data stays in users' browsers** via localStorage.

## 📦 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🧪 Persistence Test

Before relying on the app:

1. Add 3-5 accounts with varying durations
2. Mark some as used
3. Refresh browser
4. Close/reopen browser
5. Confirm timers persist correctly
6. Modify `resetAt` to past timestamp in DevTools
7. Reload → confirms automatic expiration

## 🎯 Workflow

```text
Open app
   ↓
See available accounts
   ↓
Click USE NEXT ACCOUNT
   ↓
Use that account manually in Antigravity
   ↓
Forget about it
   ↓
App tracks the 7-day window
   ↓
After 7 days
   ↓
Account automatically becomes AVAILABLE
   ↓
Repeat
```

## 📦 What's Included

- `app/page.tsx` - Main component with all UI and logic
- `app/lib/account-manager/types.ts` - Account interface and types
- `app/lib/account-manager/storage.ts` - localStorage persistence
- `app/lib/account-manager/expiration.ts` - Status labeling, sorting, formatting
- `tailwind.config.js` - Dark-first theme configuration
- `postcss.config.js` - Tailwind CSS configuration

## ⚠️ Known Constraints

- No authentication - anyone can edit accounts
- No backend - data lives in browser localStorage
- No Google/Antigravity automation - purely local tracking
- Manual use required - you must use accounts externally

## 🛠️ Tech Stack

- Next.js 14 (App Router, Turbopack)
- React 18
- TypeScript
- Tailwind CSS v3
- lucide-react for icons
- No external APIs or services