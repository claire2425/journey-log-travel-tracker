import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { JourneyDatabase } from "@/db/index";
import { activateCloudSync, getCloudSyncProfile, listPendingSyncChanges, markSyncRecordState, pauseCloudSync, syncRecordKey } from "@/db/sync";
import { addTrip, deleteTrip, updateTrip } from "@/db/trips";
import { createDefaultExpenseLedgerSettings } from "@/db/expenses";
import { applyCloudSyncSnapshot, discardPendingCloudChange, forcePushCloudChange, prepareCloudSync, pushPendingCloudChanges, type CloudSyncSnapshot } from "@/lib/cloud-sync";
import type { ExpenseLedgerSettings, Place, Trip } from "@/lib/types";

const tpe: Place = {
  id: "tpe",
  name_zh: "桃園國際機場",
  name_en: "Taiwan Taoyuan International Airport",
  code: "TPE",
  kind: "airport",
  latitude: 25.0797,
  longitude: 121.2342,
  country: "Taiwan",
  time_zone: "Asia/Taipei",
};

const hnd: Place = {
  id: "hnd",
  name_zh: "東京羽田機場",
  name_en: "Tokyo Haneda Airport",
  code: "HND",
  kind: "airport",
  latitude: 35.5494,
  longitude: 139.7798,
  country: "Japan",
  time_zone: "Asia/Tokyo",
};

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    mode: "flight",
    origin: tpe,
    destination: hnd,
    departure: "2026-11-10T09:00:00+08:00",
    arrival: "2026-11-10T13:00:00+09:00",
    carrier: "Example Air",
    service_number: "EX100",
    seat_class: "Economy",
    seat: "10A",
    distance_km: 2100,
    distance_is_estimate: false,
    duration_min: 180,
    notes: "",
    tags: [],
    is_demo: false,
    created_at: "2026-11-10T00:00:00.000Z",
    updated_at: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("offline cloud-sync outbox", () => {
  let database: JourneyDatabase;
  const ownerId = "user-1";

  beforeEach(async () => {
    database = new JourneyDatabase(`sync-${crypto.randomUUID()}`);
    await database.open();
  });

  it("does not queue a local record until the owner explicitly enables cloud sync", async () => {
    await addTrip(trip(), database);
    expect(await database.sync_outbox.count()).toBe(0);

    await activateCloudSync(ownerId, database);
    await updateTrip(trip({ notes: "Window seat" }), database);

    const pending = await listPendingSyncChanges(ownerId, database);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      entity: "trip",
      operation: "upsert",
      record_id: "trip-1",
      base_revision: null,
      payload: { notes: "Window seat" },
    });
  });

  it("turns a locally created-and-removed record into no remote mutation", async () => {
    await activateCloudSync(ownerId, database);
    await addTrip(trip(), database);
    await deleteTrip("trip-1", database);

    expect(await listPendingSyncChanges(ownerId, database)).toEqual([]);
  });

  it("uses the last cloud revision when queueing a later soft delete", async () => {
    await activateCloudSync(ownerId, database);
    await addTrip(trip(), database);
    const key = syncRecordKey(ownerId, "trip", "trip-1");
    await database.transaction("rw", database.sync_record_state, database.sync_outbox, async () => {
      await database.sync_outbox.delete(key);
      await markSyncRecordState({
        id: key,
        owner_id: ownerId,
        entity: "trip",
        record_id: "trip-1",
        revision: 4,
        created_at: "2026-11-10T00:00:00.000Z",
        updated_at: "2026-11-10T00:00:00.000Z",
        deleted_at: null,
      }, database);
    });

    await deleteTrip("trip-1", database);

    expect(await listPendingSyncChanges(ownerId, database)).toEqual([
      expect.objectContaining({ operation: "delete", base_revision: 4, record_id: "trip-1" }),
    ]);
  });

  it("keeps a signed-out deletion as a deferred tombstone for the same owner", async () => {
    await activateCloudSync(ownerId, database);
    await addTrip(trip(), database);
    const key = syncRecordKey(ownerId, "trip", "trip-1");
    await database.transaction("rw", database.sync_record_state, database.sync_outbox, async () => {
      await database.sync_outbox.delete(key);
      await markSyncRecordState({
        id: key,
        owner_id: ownerId,
        entity: "trip",
        record_id: "trip-1",
        revision: 4,
        created_at: "2026-11-10T00:00:00.000Z",
        updated_at: "2026-11-10T00:00:00.000Z",
        deleted_at: null,
      }, database);
    });

    await pauseCloudSync(ownerId, database);
    await deleteTrip("trip-1", database);

    expect(await listPendingSyncChanges(ownerId, database)).toEqual([
      expect.objectContaining({ operation: "delete", base_revision: 4, record_id: "trip-1" }),
    ]);

    const remoteSnapshot: CloudSyncSnapshot = {
      trips: [{
        id: "trip-1",
        payload: trip(),
        created_at: "2026-11-10T00:00:00.000Z",
        updated_at: "2026-11-10T00:00:00.000Z",
        deleted_at: null,
        revision: 4,
      }],
      custom_places: [],
      expense_settings: [],
      expense_entries: [],
    };
    await prepareCloudSync(ownerId, remoteSnapshot, database);

    expect(await database.trips.get("trip-1")).toBeUndefined();
    expect(await listPendingSyncChanges(ownerId, database)).toEqual([
      expect.objectContaining({ operation: "delete", base_revision: 4, record_id: "trip-1" }),
    ]);
  });

  it("does not let an untouched new-device expense ledger overwrite a cloud ledger", async () => {
    const localDefault = createDefaultExpenseLedgerSettings("2026-11-11T00:00:00.000Z");
    const cloudLedger: ExpenseLedgerSettings = {
      id: "expense-ledger",
      members: [{ id: "claire", name: "Claire" }],
      categories: ["Meals", "Transport"],
      settlement_currency: "JPY",
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-02T00:00:00.000Z",
    };
    const snapshot: CloudSyncSnapshot = {
      trips: [],
      custom_places: [],
      expense_entries: [],
      expense_settings: [{
        id: cloudLedger.id,
        payload: cloudLedger,
        created_at: cloudLedger.created_at,
        updated_at: cloudLedger.updated_at,
        deleted_at: null,
        revision: 3,
      }],
    };

    await database.expense_settings.put(localDefault);
    await prepareCloudSync(ownerId, snapshot, database);

    expect(await database.expense_settings.get("expense-ledger")).toEqual(cloudLedger);
    expect(await listPendingSyncChanges(ownerId, database)).toEqual([]);
  });

  it("rolls back first-sync activation if staging the merge fails", async () => {
    const invalidSnapshot = {
      trips: [{
        id: "invalid-trip",
        payload: {},
        created_at: "2026-11-10T00:00:00.000Z",
        updated_at: "2026-11-10T00:00:00.000Z",
        deleted_at: null,
        revision: 1,
      }],
      custom_places: [],
      expense_settings: [],
      expense_entries: [],
    } as unknown as CloudSyncSnapshot;

    await expect(prepareCloudSync(ownerId, invalidSnapshot, database)).rejects.toThrow();
    expect(await getCloudSyncProfile(database)).toBeUndefined();
  });

  it("keeps an edit made while an earlier upload is in flight", async () => {
    await activateCloudSync(ownerId, database);
    await addTrip(trip(), database);
    const firstChange = (await listPendingSyncChanges(ownerId, database))[0];
    const client = {
      rpc: async () => {
        await updateTrip(trip({ notes: "Edited while syncing" }), database);
        return {
          data: {
            status: "applied",
            record: {
              id: "trip-1",
              payload: trip(),
              created_at: "2026-11-10T00:00:00.000Z",
              updated_at: "2026-11-10T00:00:00.000Z",
              deleted_at: null,
              revision: 1,
            },
          },
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    expect(await pushPendingCloudChanges(client, ownerId, database)).toEqual([]);

    const remaining = await listPendingSyncChanges(ownerId, database);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      mutation_version: firstChange.mutation_version + 1,
      base_revision: 1,
      payload: { notes: "Edited while syncing" },
    });
  });

  it("does not let a stale conflict action discard a newer local edit", async () => {
    await activateCloudSync(ownerId, database);
    await addTrip(trip(), database);
    const staleChange = (await listPendingSyncChanges(ownerId, database))[0];
    await updateTrip(trip({ notes: "Newer than the conflict dialog" }), database);

    expect(await discardPendingCloudChange(staleChange, database)).toBe(false);
    expect((await listPendingSyncChanges(ownerId, database))[0]).toMatchObject({
      mutation_version: staleChange.mutation_version + 1,
      payload: { notes: "Newer than the conflict dialog" },
    });

    const client = { rpc: async () => { throw new Error("A stale action must not call the cloud"); } } as unknown as SupabaseClient;
    expect(await forcePushCloudChange(client, ownerId, staleChange, database)).toBe(false);
  });

  it("accepts a payload-redacted cloud tombstone and removes its local record", async () => {
    await database.trips.put(trip());
    const snapshot: CloudSyncSnapshot = {
      trips: [{
        id: "trip-1",
        payload: null,
        created_at: "2026-11-10T00:00:00.000Z",
        updated_at: "2026-11-11T00:00:00.000Z",
        deleted_at: "2026-11-11T00:00:00.000Z",
        revision: 2,
      }],
      custom_places: [],
      expense_settings: [],
      expense_entries: [],
    };

    await applyCloudSyncSnapshot(ownerId, snapshot, database);
    expect(await database.trips.get("trip-1")).toBeUndefined();
  });
});
