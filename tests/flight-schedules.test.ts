import { describe, expect, it } from "vitest";
import {
  FlightSearchQuerySchema,
  airlinesInResults,
  compactFlightNumber,
  fidsWindowsForDate,
  parseFidsDepartures,
  toLocalInputValue,
} from "@/lib/flight-schedules";

const time = (local: string, utc: string) => ({ local, utc });
const nrt = { iata: "NRT", icao: "RJAA", name: "Tokyo Narita" };
const kix = { iata: "KIX", icao: "RJBB", name: "Osaka Kansai" };

const morning = {
  departures: [
    {
      number: "BR 198",
      callSign: "EVA198",
      codeshareStatus: "IsOperator",
      isCargo: false,
      departure: { scheduledTime: time("2026-03-01 08:50+08:00", "2026-03-01 00:50Z"), terminal: "2" },
      arrival: { airport: nrt, scheduledTime: time("2026-03-01 13:00+09:00", "2026-03-01 04:00Z") },
      aircraft: { model: "Boeing 787-10" },
      airline: { name: "EVA Air", iata: "BR", icao: "EVA" },
    },
    {
      number: "NH 5812",
      callSign: "EVA198",
      codeshareStatus: "IsCodeshared",
      departure: { scheduledTime: time("2026-03-01 08:50+08:00", "2026-03-01 00:50Z") },
      arrival: { airport: nrt, scheduledTime: time("2026-03-01 13:00+09:00", "2026-03-01 04:00Z") },
      airline: { name: "ANA", iata: "NH" },
    },
    {
      number: "CI 100",
      callSign: "CAL100",
      codeshareStatus: "IsOperator",
      departure: { scheduledTime: time("2026-03-01 06:50+08:00", "2026-03-01 22:50Z") },
      arrival: { airport: nrt, scheduledTime: time("2026-03-01 11:05+09:00", "2026-03-01 02:05Z") },
      airline: { name: "China Airlines", iata: "CI" },
    },
    {
      number: "JL 814",
      codeshareStatus: "IsOperator",
      departure: { scheduledTime: time("2026-03-01 09:30+08:00", "2026-03-01 01:30Z") },
      arrival: { airport: kix, scheduledTime: time("2026-03-01 13:00+09:00", "2026-03-01 04:00Z") },
      airline: { name: "Japan Airlines", iata: "JL" },
    },
    {
      number: "CI 5148",
      isCargo: true,
      departure: { scheduledTime: time("2026-03-01 10:00+08:00", "2026-03-01 02:00Z") },
      arrival: { airport: nrt },
      airline: { name: "China Airlines Cargo", iata: "CI" },
    },
  ],
};

const afternoon = {
  departures: [
    {
      // Older responses without withLeg report the destination as "movement".
      number: "IT 200",
      codeshareStatus: "IsOperator",
      movement: { airport: nrt, scheduledTime: time("2026-03-01 14:10+08:00", "2026-03-01 06:10Z") },
      airline: { name: "Tigerair Taiwan", iata: "IT" },
    },
    { unexpected: "shape" },
  ],
};

describe("flight schedule lookup", () => {
  it("splits a local day into two 12-hour provider windows", () => {
    expect(fidsWindowsForDate("2026-03-01")).toEqual([
      { from: "2026-03-01T00:00", to: "2026-03-01T11:59" },
      { from: "2026-03-01T12:00", to: "2026-03-01T23:59" },
    ]);
  });

  it("validates the query and rejects identical airports", () => {
    expect(FlightSearchQuerySchema.safeParse({ from: "tpe", to: "nrt", date: "2026-03-01" }).success).toBe(true);
    expect(FlightSearchQuerySchema.safeParse({ from: "TPE", to: "TPE", date: "2026-03-01" }).success).toBe(false);
    expect(FlightSearchQuerySchema.safeParse({ from: "TPE", to: "NRT", date: "1/3/2026" }).success).toBe(false);
  });

  it("normalises flight numbers and provider local times", () => {
    expect(compactFlightNumber("BR 198")).toBe("BR198");
    expect(toLocalInputValue("2026-03-01 08:50+08:00")).toBe("2026-03-01T08:50");
    expect(toLocalInputValue(undefined)).toBeUndefined();
  });

  it("keeps flights to the destination, groups codeshares and sorts by time", () => {
    const flights = parseFidsDepartures([morning, afternoon], "NRT");
    expect(flights.map((flight) => flight.flight_number)).toEqual(["CI100", "BR198", "IT200"]);
    expect(flights[1]).toMatchObject({
      airline_name: "EVA Air",
      airline_iata: "BR",
      departure_local: "2026-03-01T08:50",
      arrival_local: "2026-03-01T13:00",
      departure_terminal: "2",
      aircraft: "Boeing 787-10",
      codeshares: ["NH5812"],
    });
  });

  it("matches the destination by ICAO code too and drops cargo flights", () => {
    const flights = parseFidsDepartures([morning], "RJAA");
    expect(flights.some((flight) => flight.airline_name.includes("Cargo"))).toBe(false);
    expect(flights).toHaveLength(2);
  });

  it("lists the airlines present for filtering", () => {
    expect(airlinesInResults(parseFidsDepartures([morning, afternoon], "NRT"))).toEqual(["China Airlines", "EVA Air", "Tigerair Taiwan"]);
  });

  it("ignores malformed responses instead of failing", () => {
    expect(parseFidsDepartures([null, "oops", { departures: "no" }], "NRT")).toEqual([]);
  });
});
