import { z } from "zod";

/**
 * Flight schedule lookup helpers for the AeroDataBox FIDS (airport departures)
 * endpoint. Only airport codes and a local date are ever sent to the provider;
 * these pure helpers shape the request windows and turn the response into the
 * options the journey form shows.
 */

export type FlightOption = {
  /** Compact operating flight number, e.g. "BR198". */
  flight_number: string;
  airline_name: string;
  airline_iata?: string;
  airline_icao?: string;
  /** Local wall-clock times for <input type="datetime-local">, e.g. "2026-03-01T08:50". */
  departure_local: string;
  arrival_local?: string;
  departure_terminal?: string;
  aircraft?: string;
  /** Marketing (codeshare) numbers sold for the same flight. */
  codeshares: string[];
};

export type FlightSearchResult = {
  flights: FlightOption[];
  provider: "AeroDataBox";
};

const IataSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}$/);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const FlightSearchQuerySchema = z.object({
  from: IataSchema,
  to: IataSchema,
  date: DateSchema,
}).refine((query) => query.from !== query.to, { message: "Origin and destination must differ." });

export type FlightSearchQuery = z.infer<typeof FlightSearchQuerySchema>;

/**
 * AeroDataBox limits one FIDS request to a 12-hour window, so a whole local
 * day is two requests.
 */
export function fidsWindowsForDate(date: string): Array<{ from: string; to: string }> {
  return [
    { from: `${date}T00:00`, to: `${date}T11:59` },
    { from: `${date}T12:00`, to: `${date}T23:59` },
  ];
}

const TimeSchema = z.object({ local: z.string().optional(), utc: z.string().optional() }).partial();
const AirportSchema = z.object({
  iata: z.string().optional(),
  icao: z.string().optional(),
  name: z.string().optional(),
}).partial();
const MovementSchema = z.object({
  airport: AirportSchema.optional(),
  scheduledTime: TimeSchema.optional(),
  terminal: z.string().optional(),
}).partial();
const FidsFlightSchema = z.object({
  number: z.string(),
  callSign: z.string().optional(),
  codeshareStatus: z.string().optional(),
  isCargo: z.boolean().optional(),
  status: z.string().optional(),
  departure: MovementSchema.optional(),
  arrival: MovementSchema.optional(),
  /** Without withLeg=true, the other end of a departure is reported here. */
  movement: MovementSchema.optional(),
  aircraft: z.object({ model: z.string().optional(), reg: z.string().optional() }).partial().optional(),
  airline: z.object({ name: z.string().optional(), iata: z.string().optional(), icao: z.string().optional() }).partial().optional(),
}).passthrough();

const FidsResponseSchema = z.object({
  departures: z.array(z.unknown()).optional(),
}).passthrough();

/** "BR 198" -> "BR198"; keeps letters and digits only. */
export function compactFlightNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "2026-03-01 08:50+08:00" (AeroDataBox local time) -> "2026-03-01T08:50". */
export function toLocalInputValue(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : undefined;
}

function sameAirport(airport: z.infer<typeof AirportSchema> | undefined, code: string) {
  const target = code.toUpperCase();
  return airport?.iata?.toUpperCase() === target || airport?.icao?.toUpperCase() === target;
}

/**
 * Turns one or more FIDS departure responses into flights to the requested
 * destination, grouping codeshares under their operating flight and sorting
 * by departure time. Cargo flights are dropped. Unknown shapes are ignored
 * rather than failing the whole lookup.
 */
export function parseFidsDepartures(responses: unknown[], destination: string): FlightOption[] {
  type Parsed = z.infer<typeof FidsFlightSchema>;
  const items: Parsed[] = [];
  for (const response of responses) {
    const parsed = FidsResponseSchema.safeParse(response);
    if (!parsed.success) continue;
    for (const raw of parsed.data.departures ?? []) {
      const item = FidsFlightSchema.safeParse(raw);
      if (item.success && !item.data.isCargo) items.push(item.data);
    }
  }

  const groups = new Map<string, Parsed[]>();
  for (const item of items) {
    const arrival = item.arrival ?? item.movement;
    if (!sameAirport(arrival?.airport, destination)) continue;
    const departureTime = item.departure?.scheduledTime?.utc ?? item.departure?.scheduledTime?.local
      ?? item.movement?.scheduledTime?.utc ?? "";
    const key = `${departureTime}|${item.callSign ?? item.aircraft?.reg ?? compactFlightNumber(item.number)}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const options: FlightOption[] = [];
  for (const group of groups.values()) {
    const operator = group.find((item) => item.codeshareStatus === "IsOperator") ?? group[0]!;
    const departureLocal = toLocalInputValue(operator.departure?.scheduledTime?.local ?? operator.movement?.scheduledTime?.local);
    if (!departureLocal) continue;
    const flightNumber = compactFlightNumber(operator.number);
    const codeshares = [...new Set(group.map((item) => compactFlightNumber(item.number)))].filter((number) => number !== flightNumber);
    options.push({
      flight_number: flightNumber,
      airline_name: operator.airline?.name ?? operator.airline?.iata ?? flightNumber.slice(0, 2),
      ...(operator.airline?.iata ? { airline_iata: operator.airline.iata } : {}),
      ...(operator.airline?.icao ? { airline_icao: operator.airline.icao } : {}),
      departure_local: departureLocal,
      ...(toLocalInputValue(operator.arrival?.scheduledTime?.local) ? { arrival_local: toLocalInputValue(operator.arrival?.scheduledTime?.local) } : {}),
      ...(operator.departure?.terminal ? { departure_terminal: operator.departure.terminal } : {}),
      ...(operator.aircraft?.model ? { aircraft: operator.aircraft.model } : {}),
      codeshares,
    });
  }

  return options.sort((first, second) => first.departure_local.localeCompare(second.departure_local) || first.flight_number.localeCompare(second.flight_number));
}

/** Airlines present in a result, for the "which airline?" filter. */
export function airlinesInResults(flights: FlightOption[]): string[] {
  return [...new Set(flights.map((flight) => flight.airline_name))].sort((first, second) => first.localeCompare(second));
}
