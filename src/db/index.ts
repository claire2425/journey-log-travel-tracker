import Dexie, { type EntityTable } from "dexie";
import type { Expense, ExpenseLedgerSettings, Place, Trip } from "@/lib/types";

export class JourneyDatabase extends Dexie {
  trips!: EntityTable<Trip, "id">;
  custom_places!: EntityTable<Place, "id">;
  expense_entries!: EntityTable<Expense, "id">;
  expense_settings!: EntityTable<ExpenseLedgerSettings, "id">;

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
  }
}

export const db = new JourneyDatabase();
