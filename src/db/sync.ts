import {
  db as defaultDb,
  type JourneyDatabase,
  type SyncEntity,
  type SyncOutboxItem,
  type SyncPayload,
  type SyncProfile,
  type SyncRecordState,
} from "@/db/index";
import type { Expense, ExpenseLedgerSettings, Place, Trip } from "@/lib/types";

export const CLOUD_SYNC_NEEDED_EVENT = "journey-log:sync-needed";
export const CLOUD_SYNC_APPLIED_EVENT = "journey-log:sync-applied";

export type SyncEntityPayloads = {
  trip: Trip;
  custom_place: Place;
  expense_settings: ExpenseLedgerSettings;
  expense: Expense;
};

const ACTIVE_PROFILE_ID = "active" as const;

function timestamp(): string {
  return new Date().toISOString();
}

export function syncRecordKey(ownerId: string, entity: SyncEntity, recordId: string): string {
  return `${ownerId}:${entity}:${recordId}`;
}

function recordTimestamps(
  entity: SyncEntity,
  payload: SyncPayload,
  state: SyncRecordState | undefined,
  pending: SyncOutboxItem | undefined,
): Pick<SyncOutboxItem, "created_at" | "updated_at"> {
  if (entity !== "custom_place") {
    const timestamped = payload as Trip | ExpenseLedgerSettings | Expense;
    return { created_at: timestamped.created_at, updated_at: timestamped.updated_at };
  }

  const now = timestamp();
  return {
    created_at: pending?.created_at ?? state?.created_at ?? now,
    updated_at: now,
  };
}

/**
 * The app stores one active account on a device. This prevents an accidental
 * sign-in to another account from silently mixing two people's offline data.
 */
export async function getCloudSyncProfile(database: JourneyDatabase = defaultDb): Promise<SyncProfile | undefined> {
  return database.sync_profile.get(ACTIVE_PROFILE_ID);
}

/**
 * Enables the profile inside a caller-owned Dexie transaction. Keeping it
 * separate lets first-sync activate the profile and stage its merge atomically
 * rather than exposing a half-initialised sync state after a failed merge.
 */
export async function activateCloudSyncInTransaction(ownerId: string, database: JourneyDatabase = defaultDb): Promise<SyncProfile> {
  const normalizedOwnerId = ownerId.trim();
  if (!normalizedOwnerId) throw new Error("A cloud-sync account id is required.");

  const existing = await database.sync_profile.get(ACTIVE_PROFILE_ID);
  if (existing && existing.owner_id !== normalizedOwnerId) {
    throw new Error("This browser already has offline data associated with a different account.");
  }

  const profile: SyncProfile = {
    id: ACTIVE_PROFILE_ID,
    owner_id: normalizedOwnerId,
    enabled: true,
    activated_at: existing?.activated_at ?? timestamp(),
    ...(existing?.last_synced_at ? { last_synced_at: existing.last_synced_at } : {}),
  };
  await database.sync_profile.put(profile);
  return profile;
}

export async function activateCloudSync(ownerId: string, database: JourneyDatabase = defaultDb): Promise<SyncProfile> {
  return database.transaction("rw", database.sync_profile, () => activateCloudSyncInTransaction(ownerId, database));
}

/** Stops replication when a user signs out, while preserving the local offline copy. */
export async function pauseCloudSync(ownerId: string, database: JourneyDatabase = defaultDb): Promise<void> {
  await database.transaction("rw", database.sync_profile, async () => {
    const profile = await database.sync_profile.get(ACTIVE_PROFILE_ID);
    if (profile?.owner_id === ownerId && profile.enabled) {
      await database.sync_profile.put({ ...profile, enabled: false });
    }
  });
}

export async function resumeCloudSync(ownerId: string, database: JourneyDatabase = defaultDb): Promise<SyncProfile | undefined> {
  return database.transaction("rw", database.sync_profile, async () => {
    const profile = await database.sync_profile.get(ACTIVE_PROFILE_ID);
    if (!profile) return undefined;
    if (profile.owner_id !== ownerId) {
      throw new Error("This browser's offline data belong to a different cloud account.");
    }
    if (!profile.enabled) {
      const resumed = { ...profile, enabled: true };
      await database.sync_profile.put(resumed);
      return resumed;
    }
    return profile;
  });
}

export async function listPendingSyncChanges(ownerId: string, database: JourneyDatabase = defaultDb): Promise<SyncOutboxItem[]> {
  return database.sync_outbox.where("owner_id").equals(ownerId).sortBy("queued_at");
}

export async function getSyncRecordState(
  ownerId: string,
  entity: SyncEntity,
  recordId: string,
  database: JourneyDatabase = defaultDb,
): Promise<SyncRecordState | undefined> {
  return database.sync_record_state.get(syncRecordKey(ownerId, entity, recordId));
}

/**
 * Add or replace a pending upload. Callers that need atomic record + outbox
 * writes must include the three sync tables in their Dexie transaction.
 */
export async function queueSyncUpsert<T extends SyncEntity>(
  entity: T,
  payload: SyncEntityPayloads[T],
  database: JourneyDatabase = defaultDb,
): Promise<void> {
  if (entity === "trip" && (payload as Trip).is_demo) return;

  const profile = await database.sync_profile.get(ACTIVE_PROFILE_ID);
  // A known owner's signed-out edits must be retained as a deferred outbox.
  // They never upload while the profile is paused because the UI only invokes
  // replication for an enabled, matching signed-in profile.
  if (!profile) return;

  const recordId = payload.id;
  const id = syncRecordKey(profile.owner_id, entity, recordId);
  const [state, pending] = await Promise.all([
    database.sync_record_state.get(id),
    database.sync_outbox.get(id),
  ]);
  const dates = recordTimestamps(entity, payload, state, pending);

  await database.sync_outbox.put({
    id,
    owner_id: profile.owner_id,
    entity,
    record_id: recordId,
    operation: "upsert",
    payload,
    created_at: dates.created_at,
    updated_at: dates.updated_at,
    base_revision: pending?.base_revision ?? state?.revision ?? null,
    mutation_version: (pending?.mutation_version ?? 0) + 1,
    queued_at: timestamp(),
  });
}

/** Queues a recoverable soft delete rather than ever issuing a remote hard delete. */
export async function queueSyncDelete(
  entity: SyncEntity,
  recordId: string,
  database: JourneyDatabase = defaultDb,
): Promise<void> {
  const profile = await database.sync_profile.get(ACTIVE_PROFILE_ID);
  // Preserve a tombstone made while signed out. Dropping it would let a later
  // pull resurrect the deleted record from the cloud on the next sign-in.
  if (!profile) return;

  const id = syncRecordKey(profile.owner_id, entity, recordId);
  const [state, pending] = await Promise.all([
    database.sync_record_state.get(id),
    database.sync_outbox.get(id),
  ]);

  // A record made and removed before the first upload has no cloud effect.
  if (pending?.operation === "upsert" && pending.base_revision === null && !state) {
    await database.sync_outbox.delete(id);
    return;
  }

  const now = timestamp();
  await database.sync_outbox.put({
    id,
    owner_id: profile.owner_id,
    entity,
    record_id: recordId,
    operation: "delete",
    created_at: pending?.created_at ?? state?.created_at ?? now,
    updated_at: now,
    base_revision: pending?.base_revision ?? state?.revision ?? null,
    mutation_version: (pending?.mutation_version ?? 0) + 1,
    queued_at: now,
  });
}

export async function markSyncRecordState(
  state: SyncRecordState,
  database: JourneyDatabase = defaultDb,
): Promise<void> {
  await database.sync_record_state.put(state);
}

export async function removePendingSyncChange(id: string, database: JourneyDatabase = defaultDb): Promise<void> {
  await database.sync_outbox.delete(id);
}

export async function markCloudSyncComplete(ownerId: string, database: JourneyDatabase = defaultDb): Promise<void> {
  await database.transaction("rw", database.sync_profile, async () => {
    const profile = await database.sync_profile.get(ACTIVE_PROFILE_ID);
    if (profile?.owner_id === ownerId) {
      await database.sync_profile.put({ ...profile, last_synced_at: timestamp() });
    }
  });
}

/** Lets the client sync controller react after a committed local mutation. */
export function notifyCloudSyncNeeded(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOUD_SYNC_NEEDED_EVENT));
}

/** Lets page-level dashboards refresh once a remote snapshot is applied locally. */
export function notifyCloudSyncApplied(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOUD_SYNC_APPLIED_EVENT));
}
