import type { TripMode } from "@/lib/types";

export type OperatorMode = Extract<TripMode, "flight" | "rail">;

export type OperatorDirectoryEntry = {
  mode: OperatorMode;
  /** Concise identifier used to prefill a trip's carrier_code. */
  code: string;
  /** English display label. */
  label: string;
  /** Traditional Chinese display label. */
  label_zh: string;
  /** A UI colour for a locally rendered text mark; it is not a logo asset. */
  brand_color: string;
  /** Short, locally-renderable brand mark such as "BR" or "DB". */
  logo_text: string;
  /** Alternate codes/names accepted by the code lookup. */
  aliases: readonly string[];
  /** Prefixes that can appear before a published service number. */
  service_prefixes: readonly string[];
};

/**
 * Source note: compact, manually curated display hints from the IATA Airline
 * Coding Directory and the named rail operators' public passenger-facing
 * services, checked 2026-11-10. This is not a live timetable or a complete
 * operator database. It deliberately ships no third-party logo files or logo
 * URLs; the UI should render logo_text locally in brand_color instead.
 */
export const OPERATOR_DIRECTORY_SOURCE_NOTE =
  "Static convenience hints from the IATA Airline Coding Directory and named rail operators' public passenger services, checked 2026-11-10. Not a live timetable or complete directory; no third-party logos are bundled or linked.";

export const OPERATOR_DIRECTORY = [
  { mode: "flight", code: "BR", label: "EVA Air", label_zh: "長榮航空", brand_color: "#006A4D", logo_text: "BR", aliases: ["EVA"], service_prefixes: ["BR", "EVA"] },
  { mode: "flight", code: "CI", label: "China Airlines", label_zh: "中華航空", brand_color: "#0B4EA2", logo_text: "CI", aliases: ["CAL"], service_prefixes: ["CI", "CAL"] },
  { mode: "flight", code: "JX", label: "STARLUX Airlines", label_zh: "星宇航空", brand_color: "#3A1F5D", logo_text: "JX", aliases: ["STARLUX"], service_prefixes: ["JX", "STARLUX"] },
  { mode: "flight", code: "JL", label: "Japan Airlines", label_zh: "日本航空", brand_color: "#D90B28", logo_text: "JL", aliases: ["JAL"], service_prefixes: ["JL", "JAL"] },
  { mode: "flight", code: "NH", label: "All Nippon Airways", label_zh: "全日空", brand_color: "#005EAC", logo_text: "NH", aliases: ["ANA"], service_prefixes: ["NH", "ANA"] },
  { mode: "flight", code: "CX", label: "Cathay Pacific", label_zh: "國泰航空", brand_color: "#006564", logo_text: "CX", aliases: ["CPA"], service_prefixes: ["CX", "CPA"] },
  { mode: "flight", code: "SQ", label: "Singapore Airlines", label_zh: "新加坡航空", brand_color: "#F99B1C", logo_text: "SQ", aliases: ["SIA"], service_prefixes: ["SQ", "SIA"] },
  { mode: "flight", code: "EK", label: "Emirates", label_zh: "阿聯酋航空", brand_color: "#D71920", logo_text: "EK", aliases: ["UAE"], service_prefixes: ["EK", "UAE"] },
  { mode: "flight", code: "QR", label: "Qatar Airways", label_zh: "卡達航空", brand_color: "#5C0632", logo_text: "QR", aliases: ["QTR"], service_prefixes: ["QR", "QTR"] },
  { mode: "flight", code: "BA", label: "British Airways", label_zh: "英國航空", brand_color: "#075AAA", logo_text: "BA", aliases: ["BAW"], service_prefixes: ["BA", "BAW"] },
  { mode: "flight", code: "AF", label: "Air France", label_zh: "法國航空", brand_color: "#002157", logo_text: "AF", aliases: ["AFR"], service_prefixes: ["AF", "AFR"] },
  { mode: "flight", code: "KL", label: "KLM", label_zh: "荷蘭皇家航空", brand_color: "#00A1DE", logo_text: "KL", aliases: ["KLM"], service_prefixes: ["KL", "KLM"] },
  { mode: "flight", code: "LH", label: "Lufthansa", label_zh: "漢莎航空", brand_color: "#05164D", logo_text: "LH", aliases: ["DLH"], service_prefixes: ["LH", "DLH"] },
  { mode: "flight", code: "KE", label: "Korean Air", label_zh: "大韓航空", brand_color: "#1E5AA8", logo_text: "KE", aliases: ["KAL"], service_prefixes: ["KE", "KAL"] },
  { mode: "flight", code: "TG", label: "Thai Airways", label_zh: "泰國航空", brand_color: "#652B82", logo_text: "TG", aliases: ["THA"], service_prefixes: ["TG", "THA"] },
  { mode: "rail", code: "THSR", label: "Taiwan High Speed Rail", label_zh: "台灣高鐵", brand_color: "#F15A24", logo_text: "THSR", aliases: ["HSR"], service_prefixes: ["THSR", "HSR"] },
  { mode: "rail", code: "TRA", label: "Taiwan Railway", label_zh: "台灣鐵路", brand_color: "#1D4F91", logo_text: "TRA", aliases: ["TR"], service_prefixes: ["TRA"] },
  { mode: "rail", code: "JR-EAST", label: "JR East", label_zh: "JR 東日本", brand_color: "#1E8A3D", logo_text: "JR", aliases: ["JRE"], service_prefixes: ["HAYABUSA", "YAMABIKO", "KOMACHI"] },
  { mode: "rail", code: "JR-CENTRAL", label: "JR Central", label_zh: "JR 東海", brand_color: "#EF4B2D", logo_text: "JR", aliases: ["JRC"], service_prefixes: ["NOZOMI", "HIKARI", "KODAMA"] },
  { mode: "rail", code: "JR-WEST", label: "JR West", label_zh: "JR 西日本", brand_color: "#0072BC", logo_text: "JR", aliases: ["JRW"], service_prefixes: ["THUNDERBIRD", "SAKURA"] },
  { mode: "rail", code: "EUROSTAR", label: "Eurostar", label_zh: "歐洲之星", brand_color: "#21314D", logo_text: "ES", aliases: ["ES"], service_prefixes: ["EUROSTAR", "ES"] },
  { mode: "rail", code: "SNCF", label: "SNCF", label_zh: "法國國鐵", brand_color: "#E5007E", logo_text: "SNCF", aliases: ["TGV"], service_prefixes: ["TGV", "SNCF"] },
  { mode: "rail", code: "DB", label: "Deutsche Bahn", label_zh: "德國鐵路", brand_color: "#EC1C24", logo_text: "DB", aliases: ["DEUTSCHEBAHN"], service_prefixes: ["ICE", "IC", "DB"] },
  { mode: "rail", code: "TRENITALIA", label: "Trenitalia", label_zh: "義大利國鐵", brand_color: "#006A5B", logo_text: "TI", aliases: ["TI"], service_prefixes: ["FRECCIAROSSA", "FRECCIARGENTO", "TRENITALIA"] },
  { mode: "rail", code: "AMTRAK", label: "Amtrak", label_zh: "美國國鐵", brand_color: "#005DAA", logo_text: "A", aliases: ["AMTK"], service_prefixes: ["AMTRAK", "AMTK"] },
] as const satisfies readonly OperatorDirectoryEntry[];

function normalizeOperatorCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[^A-Z0-9-]+/g, "");
}

/** Normalizes common input forms such as "BR 198", "br-198", and " BR198 ". */
export function normalizeServiceNumber(value: string): string {
  return normalizeOperatorCode(value).replaceAll("-", "");
}

/** Looks up an operator by its concise code or a known alias. */
export function lookupOperator(code: string, mode?: OperatorMode): OperatorDirectoryEntry | undefined {
  const normalizedCode = normalizeOperatorCode(code);
  if (!normalizedCode) return undefined;
  return OPERATOR_DIRECTORY.find((operator) => (
    (!mode || operator.mode === mode)
    && [operator.code, ...operator.aliases].some((candidate) => normalizeOperatorCode(candidate) === normalizedCode)
  ));
}

/**
 * Identifies a directory entry from a service number after a transport mode has
 * been selected. It recognizes a code while the number is still being typed,
 * but does not claim that a particular service is operating on a given date.
 */
export function identifyOperator(mode: TripMode, serviceNumber: string): OperatorDirectoryEntry | undefined {
  if (mode !== "flight" && mode !== "rail") return undefined;
  const normalizedService = normalizeServiceNumber(serviceNumber);
  if (!normalizedService) return undefined;

  return OPERATOR_DIRECTORY.find((operator) => (
    operator.mode === mode
    && operator.service_prefixes.some((prefix) => {
      const normalizedPrefix = normalizeServiceNumber(prefix);
      if (!normalizedService.startsWith(normalizedPrefix)) return false;
      const remainder = normalizedService.slice(normalizedPrefix.length);
      return remainder.length === 0 || /^\d/.test(remainder);
    })
  ));
}

export const identifyOperatorByServiceNumber = identifyOperator;
