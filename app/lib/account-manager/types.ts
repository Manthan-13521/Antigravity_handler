export type AccountStatus = "available" | "used";

export interface TrackerState {
  status: AccountStatus;
  usedAt: number | null;
  resetAt: number | null;
  usageDuration: number;
}

export interface TrackerColumn {
  id: string;
  name: string;
  duration: number;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  notes?: string;

  status: AccountStatus;

  usedAt: number | null;
  resetAt: number | null;

  usageDuration: number;

  /** Per-column checkbox state, keyed by TrackerColumn id. Mirrors legacy fields for the first column. */
  uses?: Record<string, TrackerState>;

  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_GLOBAL_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export const DURATION_LABELS: Record<string, number> = {
  "1 Day": 24 * 60 * 60 * 1000,
  "2 Days": 48 * 60 * 60 * 1000,
  "3 Days": 72 * 60 * 60 * 1000,
  "7 Days": 7 * 24 * 60 * 60 * 1000,
  "15 Days": 15 * 24 * 60 * 60 * 1000,
  "1 Month": 30 * 24 * 60 * 60 * 1000,
  Custom: 7 * 24 * 60 * 60 * 1000,
};