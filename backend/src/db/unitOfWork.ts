import { AsyncLocalStorage } from "node:async_hooks";
import type { Store } from "./store.js";

export interface LiveEvent { type: string; complaintId?: string; complaintRef?: string; institutionId?: string; [key: string]: any }
export interface OperationalUnit { store: Store; dirty: boolean; events: { event: LiveEvent; deliver: () => void }[]; rollback: (() => void)[]; commit: (() => void)[] }
export const operationalUnit = new AsyncLocalStorage<OperationalUnit>();
export function persistenceDriver(): "json" | "postgres" {
  const configured = process.env.PERSISTENCE_DRIVER?.toLowerCase();
  if (configured && configured !== "json" && configured !== "postgres") throw new Error("PERSISTENCE_DRIVER must be json or postgres");
  return configured === "postgres" ? "postgres" : configured === "json" ? "json" : process.env.DATABASE_URL || process.env.SUPABASE_DB_URL ? "postgres" : "json";
}
/** A live event must not describe a transaction that has not committed. */
export function afterPersistence(event: LiveEvent, deliver: () => void) { const unit = operationalUnit.getStore(); if (unit) unit.events.push({ event: structuredClone(event), deliver }); else deliver(); }
export function onPersistenceRollback(cleanup: () => void) { operationalUnit.getStore()?.rollback.push(cleanup); }
export function onPersistenceCommit(operation: () => void) { const unit=operationalUnit.getStore(); if(unit)unit.commit.push(operation);else operation(); }
