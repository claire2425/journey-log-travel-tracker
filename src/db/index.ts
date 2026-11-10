import Dexie, { type EntityTable } from "dexie";
import type { Place, Trip } from "@/lib/types";

export class JourneyDatabase extends Dexie {
  trips!: EntityTable<Trip, "id">;
  custom_places!: EntityTable<Place, "id">;

  constructor(name = "journey-log") {
    super(name);
    this.version(1).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
    });
  }
}

export const db = new JourneyDatabase();
