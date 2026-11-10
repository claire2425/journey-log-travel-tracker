import type { Place, Trip } from "@/lib/types";

/**
 * Source note: these display-only coordinates are approximate public terminal and
 * station locations sourced from OpenStreetMap contributors, checked 2026-11-10.
 * They are illustrative only and must not be used for navigation.
 */
export const DEMO_DATA_SOURCE_NOTE =
  "Approximate display-only coordinates: OpenStreetMap contributors (checked 2026-11-10). Not for navigation.";

const places = {
  tpe: { id: "tpe", name_zh: "桃園國際機場", name_en: "Taiwan Taoyuan International Airport", code: "TPE", kind: "airport", latitude: 25.0797, longitude: 121.2342, country: "Taiwan", time_zone: "Asia/Taipei" },
  kix: { id: "kix", name_zh: "關西國際機場", name_en: "Kansai International Airport", code: "KIX", kind: "airport", latitude: 34.4347, longitude: 135.244, country: "Japan", time_zone: "Asia/Tokyo" },
  nrt: { id: "nrt", name_zh: "成田國際機場", name_en: "Narita International Airport", code: "NRT", kind: "airport", latitude: 35.772, longitude: 140.3929, country: "Japan", time_zone: "Asia/Tokyo" },
  lhr: { id: "lhr", name_zh: "倫敦希斯洛機場", name_en: "London Heathrow Airport", code: "LHR", kind: "airport", latitude: 51.47, longitude: -0.4543, country: "United Kingdom", time_zone: "Europe/London" },
  cdg: { id: "cdg", name_zh: "巴黎戴高樂機場", name_en: "Paris Charles de Gaulle Airport", code: "CDG", kind: "airport", latitude: 49.0097, longitude: 2.5479, country: "France", time_zone: "Europe/Paris" },
  taipei: { id: "taipei-main", name_zh: "台北車站", name_en: "Taipei Main Station", code: "TPE-R", kind: "station", latitude: 25.0478, longitude: 121.517, country: "Taiwan", time_zone: "Asia/Taipei" },
  taichung: { id: "taichung-hsr", name_zh: "台中高鐵站", name_en: "Taichung HSR Station", code: "TCG", kind: "station", latitude: 24.2648, longitude: 120.7232, country: "Taiwan", time_zone: "Asia/Taipei" },
  hualien: { id: "hualien", name_zh: "花蓮車站", name_en: "Hualien Station", code: "HUN", kind: "station", latitude: 23.9923, longitude: 121.6116, country: "Taiwan", time_zone: "Asia/Taipei" },
  tokyo: { id: "tokyo", name_zh: "東京車站", name_en: "Tokyo Station", code: "TYO-R", kind: "station", latitude: 35.6812, longitude: 139.7671, country: "Japan", time_zone: "Asia/Tokyo" },
  kyoto: { id: "kyoto", name_zh: "京都車站", name_en: "Kyoto Station", code: "KYO", kind: "station", latitude: 34.9859, longitude: 135.7588, country: "Japan", time_zone: "Asia/Tokyo" },
  shinOsaka: { id: "shin-osaka", name_zh: "新大阪車站", name_en: "Shin-Osaka Station", code: "SHO", kind: "station", latitude: 34.7335, longitude: 135.5006, country: "Japan", time_zone: "Asia/Tokyo" },
  stPancras: { id: "st-pancras", name_zh: "倫敦聖潘克拉斯車站", name_en: "London St Pancras International", code: "STP", kind: "station", latitude: 51.5319, longitude: -0.1264, country: "United Kingdom", time_zone: "Europe/London" },
  gareDuNord: { id: "gare-du-nord", name_zh: "巴黎北站", name_en: "Paris Gare du Nord", code: "PGN", kind: "station", latitude: 48.8809, longitude: 2.3553, country: "France", time_zone: "Europe/Paris" },
} satisfies Record<string, Place>;

/**
 * A small, bundled place list for the add-journey form. These are display-only
 * reference locations; users may save their own places locally as needed.
 */
export const REFERENCE_PLACES: Place[] = Object.values(places).map((place) => ({ ...place }));

function demoTrip(input: Omit<Trip, "is_demo" | "created_at" | "updated_at">): Trip {
  return {
    ...input,
    purpose: input.purpose ?? (input.tags.includes("work") ? "business" : "leisure"),
    is_demo: true,
    created_at: "2026-11-10T00:00:00+00:00",
    updated_at: "2026-11-10T00:00:00+00:00",
  };
}

export const DEMO_TRIPS: Trip[] = [
  demoTrip({ id: "demo-2026-kix-tpe", mode: "flight", origin: places.kix, destination: places.tpe, departure: "2026-10-18T14:20:00+09:00", arrival: "2026-10-18T16:20:00+08:00", carrier: "Example Airways", service_number: "EJ 228", seat_class: "Economy", seat: "18A", vehicle_type: "Illustrative narrow-body jet", distance_km: 1730, distance_is_estimate: true, duration_min: 180, notes: "Weekend city break — fictional demo record.", tags: ["weekend", "Japan"] }),
  demoTrip({ id: "demo-2026-tpe-kix", mode: "flight", origin: places.tpe, destination: places.kix, departure: "2026-10-14T09:10:00+08:00", arrival: "2026-10-14T12:45:00+09:00", carrier: "Example Airways", service_number: "EJ 227", seat_class: "Economy", seat: "18A", vehicle_type: "Illustrative narrow-body jet", distance_km: 1730, distance_is_estimate: true, duration_min: 155, notes: "Outbound journey for the same demo trip.", tags: ["weekend", "Japan"] }),
  demoTrip({ id: "demo-2025-tokyo-kyoto", mode: "rail", origin: places.tokyo, destination: places.kyoto, departure: "2025-12-06T09:03:00+09:00", arrival: "2025-12-06T11:18:00+09:00", carrier: "Sample Rail", service_number: "SR 21", seat_class: "Standard", seat: "8C", vehicle_type: "High-speed train", distance_km: 445, distance_is_estimate: true, duration_min: 135, notes: "A fictional winter rail journey.", tags: ["rail", "Japan"] }),
  demoTrip({ id: "demo-2025-taipei-hualien", mode: "rail", origin: places.taipei, destination: places.hualien, departure: "2025-08-23T08:40:00+08:00", arrival: "2025-08-23T11:20:00+08:00", carrier: "Sample Rail", service_number: "SR 412", seat_class: "Standard", seat: "5D", vehicle_type: "Express train", distance_km: 160, distance_is_estimate: true, duration_min: 160, notes: "Coast-and-mountain route in this demo data.", tags: ["Taiwan", "rail"] }),
  demoTrip({ id: "demo-2025-taipei-taichung", mode: "rail", origin: places.taipei, destination: places.taichung, departure: "2025-06-15T10:12:00+08:00", arrival: "2025-06-15T11:22:00+08:00", carrier: "Sample High Speed Rail", service_number: "HSR 615", seat_class: "Standard", seat: "7A", vehicle_type: "High-speed train", distance_km: 135, distance_is_estimate: true, duration_min: 70, notes: "A short illustrative business trip.", tags: ["Taiwan", "work"] }),
  demoTrip({ id: "demo-2024-london-paris", mode: "rail", origin: places.stPancras, destination: places.gareDuNord, departure: "2024-10-17T08:01:00+01:00", arrival: "2024-10-17T11:20:00+02:00", carrier: "Sample International Rail", service_number: "SIR 9021", seat_class: "Standard", seat: "14B", vehicle_type: "International train", distance_km: 344, distance_is_estimate: true, duration_min: 139, notes: "A fictional cross-border rail journey.", tags: ["Europe", "rail"] }),
  demoTrip({ id: "demo-2024-cdg-lhr", mode: "flight", origin: places.cdg, destination: places.lhr, departure: "2024-07-08T16:25:00+02:00", arrival: "2024-07-08T16:50:00+01:00", carrier: "Example Airways", service_number: "EJ 431", seat_class: "Economy", seat: "12F", vehicle_type: "Illustrative regional jet", distance_km: 348, distance_is_estimate: true, duration_min: 85, notes: "Fictional demo return route.", tags: ["Europe", "flight"] }),
  demoTrip({ id: "demo-2024-tpe-nrt", mode: "flight", origin: places.tpe, destination: places.nrt, departure: "2024-02-10T08:40:00+08:00", arrival: "2024-02-10T12:40:00+09:00", carrier: "Example Airways", service_number: "EJ 198", seat_class: "Economy", seat: "22A", vehicle_type: "Illustrative wide-body jet", distance_km: 2184, distance_is_estimate: true, duration_min: 180, notes: "A fictional spring journey.", tags: ["Japan", "flight"] }),
  demoTrip({ id: "demo-2023-nrt-kix", mode: "flight", origin: places.nrt, destination: places.kix, departure: "2023-09-04T13:05:00+09:00", arrival: "2023-09-04T14:30:00+09:00", carrier: "Example Airways", service_number: "EJ 315", seat_class: "Economy", seat: "20C", vehicle_type: "Illustrative regional jet", distance_km: 441, distance_is_estimate: true, duration_min: 85, notes: "One leg in the sample Japan itinerary.", tags: ["Japan", "flight"] }),
  demoTrip({ id: "demo-2023-kyoto-osaka", mode: "rail", origin: places.kyoto, destination: places.shinOsaka, departure: "2023-05-27T18:15:00+09:00", arrival: "2023-05-27T18:40:00+09:00", carrier: "Sample Rail", service_number: "SR 76", seat_class: "Standard", seat: "6A", vehicle_type: "Local train", distance_km: 40, distance_is_estimate: true, duration_min: 25, notes: "Short local journey in the demo data.", tags: ["Japan", "rail"] }),
  demoTrip({ id: "demo-2022-tpe-lhr", mode: "flight", origin: places.tpe, destination: places.lhr, departure: "2022-12-21T10:00:00+08:00", arrival: "2022-12-21T17:20:00+00:00", carrier: "Example Airways", service_number: "EJ 101", seat_class: "Economy", seat: "31K", vehicle_type: "Illustrative long-haul aircraft", distance_km: 9788, distance_is_estimate: true, duration_min: 920, notes: "Long-haul example for the statistics view.", tags: ["Europe", "long-haul"] }),
  demoTrip({ id: "demo-2022-lhr-tpe", mode: "flight", origin: places.lhr, destination: places.tpe, departure: "2022-11-30T11:30:00+00:00", arrival: "2022-12-01T08:25:00+08:00", carrier: "Example Airways", service_number: "EJ 102", seat_class: "Economy", seat: "31K", vehicle_type: "Illustrative long-haul aircraft", distance_km: 9788, distance_is_estimate: true, duration_min: 895, notes: "Illustrative return route.", tags: ["Europe", "long-haul"] }),
];

export function getDemoTrips(): Trip[] {
  return DEMO_TRIPS.map((trip) => ({
    ...trip,
    origin: { ...trip.origin },
    destination: { ...trip.destination },
    tags: [...trip.tags],
  }));
}
