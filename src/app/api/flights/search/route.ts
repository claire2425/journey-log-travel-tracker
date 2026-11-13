import { NextRequest, NextResponse } from "next/server";
import {
  FlightSearchQuerySchema,
  fidsWindowsForDate,
  parseFidsDepartures,
  type FlightSearchResult,
} from "@/lib/flight-schedules";

/**
 * Looks up scheduled departures between two airports on a local date, using
 * AeroDataBox. The API key stays on the server (AERODATABOX_API_KEY, never a
 * NEXT_PUBLIC_ variable). Only the two airport codes and the date leave the
 * app; journey details do not.
 *
 * GET /api/flights/search?status=1           -> { configured: boolean }
 * GET /api/flights/search?from=TPE&to=NRT&date=2026-03-01
 */

type Provider = { baseUrl: string; headers: Record<string, string> };

function providerFromEnvironment(): Provider | null {
  const key = process.env.AERODATABOX_API_KEY?.trim();
  if (!key) return null;
  switch ((process.env.AERODATABOX_PROVIDER ?? "direct").trim().toLowerCase()) {
    case "rapidapi":
      return {
        baseUrl: "https://aerodatabox.p.rapidapi.com",
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" },
      };
    case "apimarket":
      return { baseUrl: "https://prod.api.market/api/v1/aedbx/aerodatabox", headers: { "x-api-market-key": key } };
    default:
      return { baseUrl: "https://api.aerodatabox.com", headers: { "x-api-key": key } };
  }
}

function error(code: "invalid_request" | "not_configured" | "quota_exceeded" | "unavailable", status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: NextRequest) {
  const provider = providerFromEnvironment();
  if (request.nextUrl.searchParams.has("status")) {
    return NextResponse.json({ configured: Boolean(provider) });
  }
  if (!provider) return error("not_configured", 501);

  const parsed = FlightSearchQuerySchema.safeParse({
    from: request.nextUrl.searchParams.get("from") ?? "",
    to: request.nextUrl.searchParams.get("to") ?? "",
    date: request.nextUrl.searchParams.get("date") ?? "",
  });
  if (!parsed.success) return error("invalid_request", 400);
  const { from, to, date } = parsed.data;

  const query = new URLSearchParams({
    withLeg: "true",
    direction: "Departure",
    withCancelled: "false",
    withCodeshared: "true",
    withCargo: "false",
    withPrivate: "false",
    withLocation: "false",
  });

  try {
    const responses = await Promise.all(fidsWindowsForDate(date).map(async (window) => {
      const url = `${provider.baseUrl}/flights/airports/iata/${encodeURIComponent(from)}/${window.from}/${window.to}?${query}`;
      const response = await fetch(url, {
        headers: { ...provider.headers, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        // Schedules for a route and day rarely change; caching saves quota.
        next: { revalidate: 60 * 60 * 6 },
      });
      if (response.status === 204) return { departures: [] };
      if (response.status === 402 || response.status === 429) throw new Error("quota");
      if (!response.ok) throw new Error(`status ${response.status}`);
      return response.json() as Promise<unknown>;
    }));

    const result: FlightSearchResult = { flights: parseFidsDepartures(responses, to), provider: "AeroDataBox" };
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "quota") return error("quota_exceeded", 429);
    return error("unavailable", 502);
  }
}
