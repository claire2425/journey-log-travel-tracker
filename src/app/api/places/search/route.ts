import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchGlobalPlaces } from "@/lib/global-place-directory";

// The bundled indexes are read from disk, so this route must not be deployed
// to an Edge runtime.
export const runtime = "nodejs";

const requestSchema = z.object({
  kind: z.enum(["airport", "station"]),
  q: z.string().normalize("NFKC").trim().min(1).max(120),
});

/**
 * Searches data bundled with this app. Unlike a live timetable or geocoder,
 * this route never forwards the user's typed location to a third party.
 */
export async function GET(request: NextRequest) {
  const parsed = requestSchema.safeParse({
    kind: request.nextUrl.searchParams.get("kind") ?? "",
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const places = await searchGlobalPlaces(parsed.data.kind, parsed.data.q);
    return NextResponse.json({ places }, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "place_data_unavailable" }, { status: 503 });
  }
}
