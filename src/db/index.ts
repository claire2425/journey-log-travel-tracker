import Dexie, { type EntityTable } from "dexie";
import type { Expense, ExpenseLedgerSettings, Place, Trip } from "@/lib/types";

/**
 * These names deliberately match the four user-owned collections replicated to
 * Supabase. The application continues to read from IndexedDB, so it remains
 * usable while offline.
 */
export const syncEntities = ["trip", "custom_place", "expense_settings", "expense"] as const;
export type SyncEntity = (typeof syncEntities)[number];
export type SyncOperation = "upsert" | "delete";
export type SyncPayload = Trip | Place | ExpenseLedgerSettings | Expense;

/** The one signed-in account currently allowed to replicate this browser's data. */
export type SyncProfile = {
  id: "active";
  owner_id: string;
  enabled: boolean;
  activated_at: string;
  last_synced_at?: string;
};

/** Last server version that this device has seen for one record. */
export type SyncRecordState = {
  /** `${owner_id}:${entity}:${record_id}` */
  id: string;
  owner_id: string;
  entity: SyncEntity;
  record_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/**
 * Coalesced local changes waiting for a network connection. There is at most
 * one item per account/entity/record, so repeatedly editing a journey offline
 * only uploads its latest version.
 */
export type SyncOutboxItem = {
  /** `${owner_id}:${entity}:${record_id}` */
  id: string;
  owner_id: string;
  entity: SyncEntity;
  record_id: string;
  operation: SyncOperation;
  payload?: SyncPayload;
  created_at: string;
  updated_at: string;
  /** Null means this device has never seen a cloud version of the record. */
  base_revision: number | null;
  /**
   * Increments for every edit to this queued record. It prevents an in-flight
   * request from deleting a newer edit made while that request was pending.
   */
  mutation_version: number;
  queued_at: string;
};

export class JourneyDatabase extends Dexie {
  trips!: EntityTable<Trip, "id">;
  custom_places!: EntityTable<Place, "id">;
  expense_entries!: EntityTable<Expense, "id">;
  expense_settings!: EntityTable<ExpenseLedgerSettings, "id">;
  sync_profile!: EntityTable<SyncProfile, "id">;
  sync_record_state!: EntityTable<SyncRecordState, "id">;
  sync_outbox!: EntityTable<SyncOutboxItem, "id">;

  constructor(name = "journey-log") {
    super(name);
    this.version(1).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
    });
    this.version(2).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
      expense_entries: "id, date, paid_by, currency, category",
      expense_settings: "id",
    });
    this.version(3).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
      expense_entries: "id, date, paid_by, currency, category",
      expense_settings: "id",
    }).upgrade((transaction) => transaction.table("trips").toCollection().modify((trip) => {
      const record = trip as { mode?: unknown };
      if (record.mode === "hsr") record.mode = "rail";
    }));
    this.version(4).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
      expense_entries: "id, date, paid_by, currency, category",
      expense_settings: "id",
    }).upgrade(async (transaction) => {
      // Existing entries have no trustworthy historical FX data. Marking them
      // as unconverted forces an explicit user-supplied or newly fetched rate,
      // rather than silently inventing a conversion.
      await transaction.table("expense_settings").toCollection().modify((settings) => {
        const record = settings as { settlement_currency?: unknown };
        record.settlement_currency = null;
      });
      await transaction.table("expense_entries").toCollection().modify((expense) => {
        const record = expense as { settlement?: unknown };
        record.settlement = null;
      });
    });
    this.version(5).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
      expense_entries: "id, date, paid_by, currency, category",
      expense_settings: "id",
      sync_profile: "id, owner_id",
      sync_record_state: "id, owner_id, [owner_id+entity+record_id], entity, record_id",
      sync_outbox: "id, owner_id, [owner_id+entity+record_id], queued_at, entity, record_id",
    });
    this.version(6).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
      expense_entries: "id, date, paid_by, currency, category",
      expense_settings: "id",
      sync_profile: "id, owner_id",
      sync_record_state: "id, owner_id, [owner_id+entity+record_id], entity, record_id",
      sync_outbox: "id, owner_id, [owner_id+entity+record_id], queued_at, entity, record_id",
    }).upgrade(async (transaction) => {
      await transaction.table("sync_outbox").toCollection().modify((item) => {
        const record = item as { mutation_version?: unknown };
        if (!Number.isSafeInteger(record.mutation_version) || (record.mutation_version as number) < 1) {
          record.mutation_version = 1;
        }
      });
    });
  }
}

export const db = new JourneyDatabase();
