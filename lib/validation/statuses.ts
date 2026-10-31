// Valores permitidos en la base (supabase/migrations/0002_milestones_movements_quotes.sql).
// Si cambiás una lista acá, cambiala también en el SQL: tests/statuses.test.ts lo verifica.

export const MILESTONE_STATUSES = [
  "pending",
  "funded",
  "delivered",
  "reminded",
  "approved",
  "expired",
  "converting",
  "paid",
  "paused",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MOVEMENT_KINDS = ["deposit", "conversion", "payout", "refund"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const MOVEMENT_STATUSES = ["pending", "confirmed", "failed"] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export const QUOTE_SOURCES = ["textile", "dex"] as const;
export type QuoteSource = (typeof QUOTE_SOURCES)[number];
