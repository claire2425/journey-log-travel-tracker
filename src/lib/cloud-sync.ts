import type { SupabaseClient } from "@supabase/supabase-js";
import {
  db as defaultDb,
  type JourneyDatabase,
  type SyncEntity,
  type SyncOutboxItem,
  type SyncProfile,
  type SyncRecordState,
} from "@/db/index";
import {
  activateCloudSyncInTransaction,
  getCloudSyncProfile,
  listPendingSyncChanges,
  markCloudSyncComplete,
  markSyncRecordState,
  notifyCloudSyncApplied,
  notifyCloudSyncNeeded,
  queueSyncUpsert,
  removePendingSyncChange,
  syncRecordKey,
  type SyncEntityPayloads,
} from "@/db/sync";
import {
  ExpenseLedgerSettingsSchema,
  ExpenseSchema,
  PlaceSchema,
  TripSchema,
  type Expense,
  type ExpenseLedgerSettings,
  type Place,
  type Trip,
} from "@/lib/types";

export type RemoteSyncRecord<T> = {
  id: string;
  payload: T | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  revision: number;
};

export type CloudSyncSnapshot = {
  trips: RemoteSyncRecord<Trip>[];
  custom_places: RemoteSyncRecord<Place>[];
  expense_settings: RemoteSyncRecord<ExpenseLedgerSettings>[];
  expense_entries: RemoteSyncRecord<Expense>[];
};

export type CloudSyncConflict = {
  outbox: SyncOutboxItem;
  /** Null is possible only when a remote record disappeared before a retry. */
  remote: RemoteSyncRecord<unknown> | null;
};

export type CloudSyncResult = {
  applied: number;
  conflicts: CloudSyncConflict[];
  pending: number;
};

type SnapshotKey = keyof CloudSyncSnapshot;

const snapshotKeyByEntity: Record<SyncEntity, SnapshotKey> = {
  trip: "trips",
  custom_place: "custom_places",
  expense_settings: "expense_settings",
  expense: "expense_entries",
};

const entities: SyncEntity[] = ["trip", "custom_place", "expense_settings", "expense"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRevision(value: unknown): number {
  const revision = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Cloud sync returned an invalid record revision.");
  return revision;
}

function parsePayload(entity: SyncEntity, payload: unknown): SyncEntityPayloads[SyncEntity] {
  switch (entity) {
    case "trip": return TripSchema.parse(payload);
    case "custom_place": return PlaceSchema.parse(payload);
    case "expense_settings": return ExpenseLedgerSettingsSchema.parse(payload);
    case "expense": return ExpenseSchema.parse(payload);
  }
}

function parseRemoteRecord(entity: SyncEntity, raw: unknown): RemoteSyncRecord<unknown> {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.created_at !== "string" || typeof raw.updated_at !== "string") {
    throw new Error("Cloud sync returned an incomplete record.");
  }
  const deletedAt = raw.deleted_at;
  if (deletedAt !== null && typeof deletedAt !== "string") throw new Error("Cloud sync returned an invalid delete marker.");
  const payload = raw.payload === null || raw.payload === undefined ? null : parsePayload(entity, raw.payload);
  if (!deletedAt && !payload) throw new Error("Cloud sync returned an active record without data.");
  if (payload && payload.id !== raw.id) throw new Error("Cloud sync rejected a record with mismatched ids.");

  return {
    id: raw.id,
    payload,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deleted_at: deletedAt,
    revision: parseRevision(raw.revision),
  };
}

function parseSnapshot(data: unknown): CloudSyncSnapshot {
  if (!isRecord(data)) throw new Error("Cloud sync returned an invalid snapshot.");
  const recordsFor = (entity: SyncEntity) => {
    const key = snapshotKeyByEntity[entity];
    const raw = data[key];
    if (!Array.isArray(raw)) throw new Error("Cloud sync snapshot is missing a collection.");
    return raw.map((record) => parseRemoteRecord(entity, record));
  };

  return {
    trips: recordsFor("trip") as RemoteSyncRecord<Trip>[],
    custom_places: recordsFor("custom_place") as RemoteSyncRecord<Place>[],
    expense_settings: recordsFor("expense_settings") as RemoteSyncRecord<ExpenseLedgerSettings>[],
    expense_entries: recordsFor("expense") as RemoteSyncRecord<Expense>[],
  };
}

function parseRpcResponse(entity: SyncEntity, data: unknown): { status: "applied" | "conflict"; record: RemoteSyncRecord<unknown> | null } {
  if (!isRecord(data) || (data.status !== "applied" && data.status !== "conflict")) {
    throw new Error("Cloud sync returned an invalid mutation response.");
  }
  if (data.record === null && data.status === "conflict") return { status: data.status, record: null };
  return { status: data.status, record: parseRemoteRecord(entity, data.record) };
}

function remoteState(ownerId: string, entity: SyncEntity, record: RemoteSyncRecord<unknown>): SyncRecordState {
  return {
    id: syncRecordKey(ownerId, entity, record.id),
    owner_id: ownerId,
    entity,
    record_id: record.id,
    revision: record.revision,
    created_at: record.created_at,
    updated_at: record.updated_at,
    deleted_at: record.deleted_at,
  };
}

function isSamePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function localUpdatedAt(entity: SyncEntity, record: unknown): string | undefined {
  if (entity === "custom_place" || !isRecord(record)) return undefined;
  return typeof record.updated_at === "string" ? record.updated_at : undefined;
}

/**
 * Opening the expense page on a brand-new device creates this empty ledger so
 * that the form can render before somebody signs in. It is not a meaningful
 * edit, even though its timestamp is naturally newer than an existing cloud
 * ledger. Treating it as a normal edit would allow an unused device to erase
 * members, categories, and the settlement currency during its first sync.
 */
function isPristineDefaultExpenseLedger(record: unknown): boolean {
  if (!isRecord(record)) return false;
  const categories = record.categories;
  const members = record.members;
  const defaultCategories = ["餐飲", "交通", "住宿", "景點", "購物", "其他"];

  return record.id === "expense-ledger"
    && record.settlement_currency === "TWD"
    && record.created_at === record.updated_at
    && Array.isArray(members)
    && members.length === 0
    && Array.isArray(categories)
    && categories.length === defaultCategories.length
    && categories.every((category, index) => category === defaultCategories[index]);
}

function shouldKeepLocal(entity: SyncEntity, local: unknown, remote: RemoteSyncRecord<unknown>): boolean {
  if (!local) return false;
  if (remote.payload && isSamePayload(local, remote.payload) && !remote.deleted_at) return false;
  if (entity === "expense_settings" && isPristineDefaultExpenseLedger(local)) return false;
  // Places deliberately have no timestamps in the existing user model. On an
  // explicit first merge, keep the local copy and use revision-checked upload
  // rather than guessing which unnamed edit was newer.
  if (entity === "custom_place") return true;
  const localTimestamp = localUpdatedAt(entity, local);
  const localTime = localTimestamp ? Date.parse(localTimestamp) : Number.NaN;
  const remoteTime = Date.parse(remote.updated_at);
  return Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime > remoteTime;
}

async function readLocalRecord(
  entity: SyncEntity,
  id: string,
  database: JourneyDatabase,
): Promise<SyncEntityPayloads[SyncEntity] | undefined> {
  switch (entity) {
    case "trip": return database.trips.get(id);
    case "custom_place": return database.custom_places.get(id);
    case "expense_settings": return database.expense_settings.get(id as "expense-ledger");
    case "expense": return database.expense_entries.get(id);
  }
}

async function readAllLocalRecords(
  entity: SyncEntity,
  database: JourneyDatabase,
): Promise<SyncEntityPayloads[SyncEntity][]> {
  switch (entity) {
    case "trip": return (await database.trips.toArray()).filter((trip) => !trip.is_demo);
    case "custom_place": return database.custom_places.toArray();
    case "expense_settings": return database.expense_settings.toArray();
    case "expense": return database.expense_entries.toArray();
  }
}

async function applyRemoteRecord(
  entity: SyncEntity,
  remote: RemoteSyncRecord<unknown>,
  database: JourneyDatabase,
): Promise<void> {
  if (remote.deleted_at) {
    switch (entity) {
      case "trip": await database.trips.delete(remote.id); break;
      case "custom_place": await database.custom_places.delete(remote.id); break;
      case "expense_settings": await database.expense_settings.delete(remote.id as "expense-ledger"); break;
      case "expense": await database.expense_entries.delete(remote.id); break;
    }
    return;
  }

  const payload = parsePayload(entity, remote.payload);
  switch (entity) {
    case "trip": await database.trips.put(payload as Trip); break;
    case "custom_place": await database.custom_places.put(payload as Place); break;
    case "expense_settings": await database.expense_settings.put(payload as ExpenseLedgerSettings); break;
    case "expense": await database.expense_entries.put(payload as Expense); break;
  }
}

function allTables(database: JourneyDatabase) {
  return [
    database.trips,
    database.custom_places,
    database.expense_entries,
    database.expense_settings,
    database.sync_profile,
    database.sync_record_state,
    database.sync_outbox,
  ] as const;
}

function remoteRows(snapshot: CloudSyncSnapshot, entity: SyncEntity): RemoteSyncRecord<unknown>[] {
  return snapshot[snapshotKeyByEntity[entity]] as RemoteSyncRecord<unknown>[];
}

/** Download a full private snapshot. RLS on the database enforces its owner. */
export async function fetchCloudSyncSnapshot(client: SupabaseClient): Promise<CloudSyncSnapshot> {
  const { data, error } = await client.rpc("journey_sync_snapshot");
  if (error) throw new Error(error.message);
  return parseSnapshot(data);
}

/**
 * Starts replication only after a person chooses it. Existing local data are
 * compared to the remote snapshot before either side is changed; for normal
 * entities the newer `updated_at` wins, while ambiguous custom places remain
 * local and are revision-checked during upload.
 */
export async function prepareCloudSync(
  ownerId: string,
  snapshot: CloudSyncSnapshot,
  database: JourneyDatabase = defaultDb,
): Promise<number> {
  let profile: SyncProfile | undefined;
  await database.transaction("rw", allTables(database), async () => {
    profile = await activateCloudSyncInTransaction(ownerId, database);
    const activeProfile = profile;
    if (!activeProfile) throw new Error("Cloud sync could not initialise its local profile.");

    for (const entity of entities) {
      const remoteById = new Map(remoteRows(snapshot, entity).map((record) => [record.id, record]));

      for (const remote of remoteById.values()) {
        const key = syncRecordKey(activeProfile.owner_id, entity, remote.id);
        const [local, pending] = await Promise.all([
          readLocalRecord(entity, remote.id, database),
          database.sync_outbox.get(key),
        ]);

        await markSyncRecordState(remoteState(activeProfile.owner_id, entity, remote), database);
        if (pending) continue;

        if (shouldKeepLocal(entity, local, remote)) {
          await queueSyncUpsert(entity, local as never, database);
        } else {
          await applyRemoteRecord(entity, remote, database);
        }
      }

      for (const local of await readAllLocalRecords(entity, database)) {
        if (!remoteById.has(local.id)) await queueSyncUpsert(entity, local as never, database);
      }
    }
  });

  if (!profile) throw new Error("Cloud sync could not initialise its local profile.");
  const pending = await listPendingSyncChanges(profile.owner_id, database);
  notifyCloudSyncApplied();
  if (pending.length) notifyCloudSyncNeeded();
  return pending.length;
}

/** Applies only remote records with no unsent local edit, so a pull can never overwrite an offline change. */
export async function applyCloudSyncSnapshot(
  ownerId: string,
  snapshot: CloudSyncSnapshot,
  database: JourneyDatabase = defaultDb,
): Promise<void> {
  await database.transaction("rw", allTables(database), async () => {
    for (const entity of entities) {
      for (const remote of remoteRows(snapshot, entity)) {
        const key = syncRecordKey(ownerId, entity, remote.id);
        const pending = await database.sync_outbox.get(key);
        await markSyncRecordState(remoteState(ownerId, entity, remote), database);
        if (!pending) await applyRemoteRecord(entity, remote, database);
      }
    }
  });
  notifyCloudSyncApplied();
}

async function pushOne(
  client: SupabaseClient,
  item: SyncOutboxItem,
): Promise<{ status: "applied" | "conflict"; record: RemoteSyncRecord<unknown> | null }> {
  const args = item.operation === "upsert"
    ? {
      p_entity: item.entity,
      p_id: item.record_id,
      p_payload: item.payload,
      p_created_at: item.created_at,
      p_updated_at: item.updated_at,
      p_expected_revision: item.base_revision,
    }
    : {
      p_entity: item.entity,
      p_id: item.record_id,
      p_updated_at: item.updated_at,
      p_expected_revision: item.base_revision,
    };
  const rpc = item.operation === "upsert" ? "journey_sync_upsert" : "journey_sync_soft_delete";
  const { data, error } = await client.rpc(rpc, args);
  if (error) throw new Error(error.message);
  return parseRpcResponse(item.entity, data);
}

type PendingMutationSettlement = "removed" | "superseded" | "missing";

function isCurrentOutboxMutation(current: SyncOutboxItem | undefined, expected: SyncOutboxItem): boolean {
  return current?.mutation_version === expected.mutation_version;
}

/**
 * Records the server's accepted version without ever deleting a later local
 * edit. If the outbox changed while its request was in flight, the newer edit
 * stays queued and is rebased onto the server revision for the next pass.
 */
async function settleAppliedMutation(
  ownerId: string,
  item: SyncOutboxItem,
  remote: RemoteSyncRecord<unknown>,
  database: JourneyDatabase,
): Promise<PendingMutationSettlement> {
  let outcome: PendingMutationSettlement = "missing";
  await database.transaction("rw", database.sync_record_state, database.sync_outbox, async () => {
    const current = await database.sync_outbox.get(item.id);
    await markSyncRecordState(remoteState(ownerId, item.entity, remote), database);

    if (!current) return;
    if (isCurrentOutboxMutation(current, item)) {
      await removePendingSyncChange(item.id, database);
      outcome = "removed";
      return;
    }

    await database.sync_outbox.put({ ...current, base_revision: remote.revision });
    outcome = "superseded";
  });
  return outcome;
}

/**
 * A stale request can discover a conflict after a newer edit has already
 * replaced its outbox row. In that case update the newer row's base revision
 * but do not show an obsolete conflict dialog or discard anything.
 */
async function isCurrentConflict(
  ownerId: string,
  item: SyncOutboxItem,
  remote: RemoteSyncRecord<unknown> | null,
  database: JourneyDatabase,
): Promise<boolean> {
  let currentConflict = false;
  await database.transaction("rw", database.sync_record_state, database.sync_outbox, async () => {
    const current = await database.sync_outbox.get(item.id);
    currentConflict = isCurrentOutboxMutation(current, item);

    if (remote) {
      await markSyncRecordState(remoteState(ownerId, item.entity, remote), database);
      if (current && !currentConflict) {
        await database.sync_outbox.put({ ...current, base_revision: remote.revision });
      }
    }
  });
  return currentConflict;
}

/** Push queued mutations using optimistic revisions; mismatches are surfaced, never overwritten. */
export async function pushPendingCloudChanges(
  client: SupabaseClient,
  ownerId: string,
  database: JourneyDatabase = defaultDb,
): Promise<CloudSyncConflict[]> {
  const conflicts: CloudSyncConflict[] = [];
  for (const item of await listPendingSyncChanges(ownerId, database)) {
    const response = await pushOne(client, item);
    if (response.status === "conflict") {
      if (await isCurrentConflict(ownerId, item, response.record, database)) {
        conflicts.push({ outbox: item, remote: response.record });
      }
      continue;
    }
    if (!response.record) throw new Error("Cloud sync applied a change without returning its record.");
    await settleAppliedMutation(ownerId, item, response.record, database);
  }
  return conflicts;
}

/** A complete safe replication pass: pull, revision-checked push, then pull again. */
export async function syncCloudData(
  client: SupabaseClient,
  ownerId: string,
  database: JourneyDatabase = defaultDb,
): Promise<CloudSyncResult> {
  const before = await fetchCloudSyncSnapshot(client);
  await applyCloudSyncSnapshot(ownerId, before, database);
  const conflicts = await pushPendingCloudChanges(client, ownerId, database);
  const after = await fetchCloudSyncSnapshot(client);
  await applyCloudSyncSnapshot(ownerId, after, database);
  await markCloudSyncComplete(ownerId, database);
  return {
    applied: before.trips.length + before.custom_places.length + before.expense_settings.length + before.expense_entries.length,
    conflicts,
    pending: (await listPendingSyncChanges(ownerId, database)).length,
  };
}

/** Explicitly choose the local version after a revision conflict. */
export async function forcePushCloudChange(
  client: SupabaseClient,
  ownerId: string,
  item: SyncOutboxItem,
  database: JourneyDatabase = defaultDb,
): Promise<boolean> {
  // Do not use a stale dialog to force-push over a newer edit the person made
  // after the conflict was displayed.
  if (!isCurrentOutboxMutation(await database.sync_outbox.get(item.id), item)) return false;

  const rpc = item.operation === "upsert" ? "journey_sync_force_upsert" : "journey_sync_force_delete";
  const args = item.operation === "upsert"
    ? {
      p_entity: item.entity,
      p_id: item.record_id,
      p_payload: item.payload,
      p_created_at: item.created_at,
      p_updated_at: item.updated_at,
    }
    : { p_entity: item.entity, p_id: item.record_id, p_updated_at: item.updated_at };
  const { data, error } = await client.rpc(rpc, args);
  if (error) throw new Error(error.message);
  const response = parseRpcResponse(item.entity, data);
  if (response.status !== "applied" || !response.record) throw new Error("Cloud sync could not apply the selected local version.");
  return (await settleAppliedMutation(ownerId, item, response.record, database)) === "removed";
}

/** Explicitly discard an unsent local version; the next pull restores the cloud record. */
export async function discardPendingCloudChange(item: SyncOutboxItem, database: JourneyDatabase = defaultDb): Promise<boolean> {
  let removed = false;
  await database.transaction("rw", database.sync_outbox, async () => {
    const current = await database.sync_outbox.get(item.id);
    if (!isCurrentOutboxMutation(current, item)) return;
    await removePendingSyncChange(item.id, database);
    removed = true;
  });
  return removed;
}

export async function cloudSyncStatus(database: JourneyDatabase = defaultDb) {
  const profile = await getCloudSyncProfile(database);
  if (!profile) return { profile: undefined, pending: 0 };
  return { profile, pending: (await listPendingSyncChanges(profile.owner_id, database)).length };
}
