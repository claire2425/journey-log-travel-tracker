import { describe, expect, it } from "vitest";
import { buildManualTrip, localDateTimeToIso } from "@/lib/journey-entry";
import type { Place } from "@/lib/types";

const taipei: Place = {
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

const kansai: Place = {
  id: "kix",
  name_zh: "關西國際機場",
  name_en: "Kansai International Airport",
  code: "KIX",
  kind: "airport",
  latitude: 34.4347,
  longitude: 135.244,
  country: "Japan",
  time_zone: "Asia/Tokyo",
};

describe("local journey entry", () => {
  it("converts a local datetime to a UTC instant in its selected time zone", () => {
    expect(localDateTimeToIso("2026-11-10T14:20", "Asia/Taipei")).toBe("2026-11-10T06:20:00.000Z");
  });

  it("creates an estimated route with a cross-time-zone duration", () => {
    const trip = buildManualTrip({
      id: "manual-kix-tpe",
      mode: "flight",
      origin: kansai,
      destination: taipei,
      departureLocal: "2026-11-10T14:20",
      arrivalLocal: "2026-11-10T16:20",
      carrier: "Example Airways",
      carrierCode: "EJ",
      serviceNumber: "EJ 228",
      purpose: "leisure",
      now: "2026-11-10T00:00:00.000Z",
    });

    expect(trip.departure).toBe("2026-11-10T05:20:00.000Z");
    expect(trip.arrival).toBe("2026-11-10T08:20:00.000Z");
    expect(trip.duration_min).toBe(180);
    expect(trip.distance_km).toBeGreaterThan(1_700);
    expect(trip.distance_is_estimate).toBe(true);
    expect(trip.purpose).toBe("leisure");
  });

  it("rejects an arrival before its departure", () => {
    expect(() => buildManualTrip({
      id: "manual-invalid",
      mode: "flight",
      origin: taipei,
      destination: kansai,
      departureLocal: "2026-11-10T14:20",
      arrivalLocal: "2026-11-10T12:45",
      now: "2026-11-10T00:00:00.000Z",
    })).toThrow("Arrival must be after departure.");
  });
});
