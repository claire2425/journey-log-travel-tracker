import type { TripMode } from "@/lib/types";

export type OperatorMode = Extract<TripMode, "flight" | "rail" | "cruise">;

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
 * Source note: manually curated display hints for widely used international
 * passenger airlines, railways, and cruise lines. Codes are identifiers or
 * common customer-facing abbreviations, checked 2026-11-11. This is not a
 * live timetable or a complete operator database. It deliberately ships no
 * third-party logo files or logo URLs; the UI renders logo_text locally.
 */
export const OPERATOR_DIRECTORY_SOURCE_NOTE =
  "Static convenience hints for widely used international passenger airlines, railways, and cruise lines, checked 2026-11-11. Not a live timetable or complete directory; no third-party logos are bundled or linked.";

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
  { mode: "flight", code: "AA", label: "American Airlines", label_zh: "美國航空", brand_color: "#1B4F9C", logo_text: "AA", aliases: ["AAL", "AMERICAN"], service_prefixes: ["AA", "AAL"] },
  { mode: "flight", code: "DL", label: "Delta Air Lines", label_zh: "達美航空", brand_color: "#C8102E", logo_text: "DL", aliases: ["DAL", "DELTA"], service_prefixes: ["DL", "DAL"] },
  { mode: "flight", code: "UA", label: "United Airlines", label_zh: "聯合航空", brand_color: "#005DAA", logo_text: "UA", aliases: ["UAL", "UNITED"], service_prefixes: ["UA", "UAL"] },
  { mode: "flight", code: "WN", label: "Southwest Airlines", label_zh: "西南航空", brand_color: "#304CB2", logo_text: "WN", aliases: ["SWA", "SOUTHWEST"], service_prefixes: ["WN", "SWA"] },
  { mode: "flight", code: "AS", label: "Alaska Airlines", label_zh: "阿拉斯加航空", brand_color: "#01426A", logo_text: "AS", aliases: ["ASA", "ALASKA"], service_prefixes: ["AS", "ASA"] },
  { mode: "flight", code: "B6", label: "JetBlue", label_zh: "捷藍航空", brand_color: "#003876", logo_text: "B6", aliases: ["JBU", "JETBLUE"], service_prefixes: ["B6", "JBU"] },
  { mode: "flight", code: "AC", label: "Air Canada", label_zh: "加拿大航空", brand_color: "#D82E2F", logo_text: "AC", aliases: ["ACA"], service_prefixes: ["AC", "ACA"] },
  { mode: "flight", code: "WS", label: "WestJet", label_zh: "西捷航空", brand_color: "#00A8E0", logo_text: "WS", aliases: ["WJA"], service_prefixes: ["WS", "WJA"] },
  { mode: "flight", code: "AM", label: "Aeromexico", label_zh: "墨西哥航空", brand_color: "#13294B", logo_text: "AM", aliases: ["AMX"], service_prefixes: ["AM", "AMX"] },
  { mode: "flight", code: "LA", label: "LATAM Airlines", label_zh: "拉丁美洲航空", brand_color: "#4B1E78", logo_text: "LA", aliases: ["LAN", "LATAM"], service_prefixes: ["LA", "LAN"] },
  { mode: "flight", code: "AV", label: "Avianca", label_zh: "哥倫比亞航空", brand_color: "#D71920", logo_text: "AV", aliases: ["AVA"], service_prefixes: ["AV", "AVA"] },
  { mode: "flight", code: "QF", label: "Qantas", label_zh: "澳洲航空", brand_color: "#E4002B", logo_text: "QF", aliases: ["QFA"], service_prefixes: ["QF", "QFA"] },
  { mode: "flight", code: "NZ", label: "Air New Zealand", label_zh: "紐西蘭航空", brand_color: "#111111", logo_text: "NZ", aliases: ["ANZ"], service_prefixes: ["NZ", "ANZ"] },
  { mode: "flight", code: "VA", label: "Virgin Australia", label_zh: "維珍澳洲航空", brand_color: "#E30613", logo_text: "VA", aliases: ["VOZ"], service_prefixes: ["VA", "VOZ"] },
  { mode: "flight", code: "JQ", label: "Jetstar", label_zh: "捷星航空", brand_color: "#FF6600", logo_text: "JQ", aliases: ["JST"], service_prefixes: ["JQ", "JST"] },
  { mode: "flight", code: "TK", label: "Turkish Airlines", label_zh: "土耳其航空", brand_color: "#C8102E", logo_text: "TK", aliases: ["THY"], service_prefixes: ["TK", "THY"] },
  { mode: "flight", code: "EY", label: "Etihad Airways", label_zh: "阿提哈德航空", brand_color: "#8B6F4E", logo_text: "EY", aliases: ["ETD"], service_prefixes: ["EY", "ETD"] },
  { mode: "flight", code: "SV", label: "Saudia", label_zh: "沙烏地阿拉伯航空", brand_color: "#006C35", logo_text: "SV", aliases: ["SVA", "SAUDIA"], service_prefixes: ["SV", "SVA"] },
  { mode: "flight", code: "ET", label: "Ethiopian Airlines", label_zh: "衣索比亞航空", brand_color: "#00843D", logo_text: "ET", aliases: ["ETH", "ETHIOPIAN"], service_prefixes: ["ET", "ETH"] },
  { mode: "flight", code: "KQ", label: "Kenya Airways", label_zh: "肯亞航空", brand_color: "#C8102E", logo_text: "KQ", aliases: ["KQA"], service_prefixes: ["KQ", "KQA"] },
  { mode: "flight", code: "AT", label: "Royal Air Maroc", label_zh: "摩洛哥皇家航空", brand_color: "#D71920", logo_text: "AT", aliases: ["RAM"], service_prefixes: ["AT", "RAM"] },
  { mode: "flight", code: "IB", label: "Iberia", label_zh: "西班牙國家航空", brand_color: "#D71920", logo_text: "IB", aliases: ["IBE"], service_prefixes: ["IB", "IBE"] },
  { mode: "flight", code: "AY", label: "Finnair", label_zh: "芬蘭航空", brand_color: "#00205B", logo_text: "AY", aliases: ["FIN"], service_prefixes: ["AY", "FIN"] },
  { mode: "flight", code: "LX", label: "Swiss International Air Lines", label_zh: "瑞士國際航空", brand_color: "#E30613", logo_text: "LX", aliases: ["SWR", "SWISS"], service_prefixes: ["LX", "SWR"] },
  { mode: "flight", code: "OS", label: "Austrian Airlines", label_zh: "奧地利航空", brand_color: "#E30613", logo_text: "OS", aliases: ["AUA"], service_prefixes: ["OS", "AUA"] },
  { mode: "flight", code: "TP", label: "TAP Air Portugal", label_zh: "葡萄牙航空", brand_color: "#00843D", logo_text: "TP", aliases: ["TAP"], service_prefixes: ["TP", "TAP"] },
  { mode: "flight", code: "EI", label: "Aer Lingus", label_zh: "愛爾蘭航空", brand_color: "#00843D", logo_text: "EI", aliases: ["EIN"], service_prefixes: ["EI", "EIN"] },
  { mode: "flight", code: "SK", label: "Scandinavian Airlines", label_zh: "北歐航空", brand_color: "#00205B", logo_text: "SK", aliases: ["SAS"], service_prefixes: ["SK", "SAS"] },
  { mode: "flight", code: "U2", label: "easyJet", label_zh: "易捷航空", brand_color: "#FF6600", logo_text: "U2", aliases: ["EZY"], service_prefixes: ["U2", "EZY"] },
  { mode: "flight", code: "FR", label: "Ryanair", label_zh: "瑞安航空", brand_color: "#073590", logo_text: "FR", aliases: ["RYR"], service_prefixes: ["FR", "RYR"] },
  { mode: "flight", code: "VY", label: "Vueling", label_zh: "伏林航空", brand_color: "#F9B233", logo_text: "VY", aliases: ["VLG"], service_prefixes: ["VY", "VLG"] },
  { mode: "flight", code: "VN", label: "Vietnam Airlines", label_zh: "越南航空", brand_color: "#006A4D", logo_text: "VN", aliases: ["HVN"], service_prefixes: ["VN", "HVN"] },
  { mode: "flight", code: "PR", label: "Philippine Airlines", label_zh: "菲律賓航空", brand_color: "#0038A8", logo_text: "PR", aliases: ["PAL"], service_prefixes: ["PR", "PAL"] },
  { mode: "flight", code: "MH", label: "Malaysia Airlines", label_zh: "馬來西亞航空", brand_color: "#002B7F", logo_text: "MH", aliases: ["MAS"], service_prefixes: ["MH", "MAS"] },
  { mode: "flight", code: "GA", label: "Garuda Indonesia", label_zh: "印尼鷹航", brand_color: "#0072BC", logo_text: "GA", aliases: ["GIA", "GARUDA"], service_prefixes: ["GA", "GIA"] },
  { mode: "flight", code: "OZ", label: "Asiana Airlines", label_zh: "韓亞航空", brand_color: "#A1004F", logo_text: "OZ", aliases: ["AAR"], service_prefixes: ["OZ", "AAR"] },
  { mode: "flight", code: "CA", label: "Air China", label_zh: "中國國際航空", brand_color: "#D71920", logo_text: "CA", aliases: ["CCA"], service_prefixes: ["CA", "CCA"] },
  { mode: "flight", code: "MU", label: "China Eastern Airlines", label_zh: "中國東方航空", brand_color: "#C8102E", logo_text: "MU", aliases: ["CES"], service_prefixes: ["MU", "CES"] },
  { mode: "flight", code: "CZ", label: "China Southern Airlines", label_zh: "中國南方航空", brand_color: "#0055A4", logo_text: "CZ", aliases: ["CSN"], service_prefixes: ["CZ", "CSN"] },
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
  { mode: "rail", code: "RENFE", label: "Renfe", label_zh: "西班牙國鐵", brand_color: "#5C2D91", logo_text: "R", aliases: ["AVE"], service_prefixes: ["RENFE", "AVE"] },
  { mode: "rail", code: "SBB", label: "Swiss Federal Railways", label_zh: "瑞士聯邦鐵路", brand_color: "#E30613", logo_text: "SBB", aliases: ["CFF", "FFS"], service_prefixes: ["SBB"] },
  { mode: "rail", code: "OBB", label: "Austrian Federal Railways", label_zh: "奧地利聯邦鐵路", brand_color: "#E30613", logo_text: "OBB", aliases: ["OEBB", "RAILJET"], service_prefixes: ["OBB", "OEBB", "RAILJET"] },
  { mode: "rail", code: "NS", label: "Nederlandse Spoorwegen", label_zh: "荷蘭鐵路", brand_color: "#003082", logo_text: "NS", aliases: ["DUTCH RAILWAYS"], service_prefixes: ["NS"] },
  { mode: "rail", code: "SJ", label: "SJ", label_zh: "瑞典國鐵", brand_color: "#005EB8", logo_text: "SJ", aliases: ["SWEDISH RAILWAYS"], service_prefixes: ["SJ"] },
  { mode: "rail", code: "DSB", label: "DSB", label_zh: "丹麥國鐵", brand_color: "#D50032", logo_text: "DSB", aliases: ["DANISH RAILWAYS"], service_prefixes: ["DSB"] },
  { mode: "rail", code: "SNCB", label: "SNCB/NMBS", label_zh: "比利時國鐵", brand_color: "#003399", logo_text: "B", aliases: ["NMBS"], service_prefixes: ["SNCB", "NMBS"] },
  { mode: "rail", code: "LNER", label: "LNER", label_zh: "倫敦東北鐵路", brand_color: "#003B5C", logo_text: "LNER", aliases: ["LONDON NORTH EASTERN RAILWAY"], service_prefixes: ["LNER"] },
  { mode: "rail", code: "AVANTI", label: "Avanti West Coast", label_zh: "阿凡提西海岸鐵路", brand_color: "#004B87", logo_text: "AWC", aliases: ["AVANTI"], service_prefixes: ["AVANTI"] },
  { mode: "rail", code: "GWR", label: "Great Western Railway", label_zh: "大西部鐵路", brand_color: "#00553A", logo_text: "GWR", aliases: ["GREAT WESTERN"], service_prefixes: ["GWR"] },
  { mode: "rail", code: "VIA", label: "VIA Rail", label_zh: "加拿大國鐵", brand_color: "#005DAA", logo_text: "VIA", aliases: ["VIARAIL"], service_prefixes: ["VIA"] },
  { mode: "rail", code: "BRIGHTLINE", label: "Brightline", label_zh: "光亮線鐵路", brand_color: "#EC008C", logo_text: "BL", aliases: ["BRIGHT LINE"], service_prefixes: ["BRIGHTLINE"] },
  { mode: "rail", code: "INDIAN-RAILWAYS", label: "Indian Railways", label_zh: "印度鐵路", brand_color: "#0066B3", logo_text: "IR", aliases: ["IRCTC"], service_prefixes: ["IR"] },
  { mode: "rail", code: "KORAIL", label: "Korail", label_zh: "韓國鐵道公社", brand_color: "#005EB8", logo_text: "KR", aliases: ["KTX"], service_prefixes: ["KORAIL", "KTX"] },
  { mode: "rail", code: "MTR", label: "MTR Corporation", label_zh: "港鐵", brand_color: "#C8102E", logo_text: "MTR", aliases: ["HONG KONG MTR"], service_prefixes: ["MTR"] },
  { mode: "rail", code: "CHINA-RAILWAY", label: "China Railway", label_zh: "中國國家鐵路", brand_color: "#D71920", logo_text: "CR", aliases: ["CRH", "CHINA RAILWAY HIGH-SPEED"], service_prefixes: ["CRH", "G", "D"] },
  { mode: "cruise", code: "ROYAL-CARIBBEAN", label: "Royal Caribbean International", label_zh: "皇家加勒比國際遊輪", brand_color: "#005EB8", logo_text: "RC", aliases: ["RCL", "ROYAL CARIBBEAN"], service_prefixes: [] },
  { mode: "cruise", code: "CARNIVAL", label: "Carnival Cruise Line", label_zh: "嘉年華郵輪", brand_color: "#C8102E", logo_text: "CCL", aliases: ["CARNIVAL CRUISE"], service_prefixes: [] },
  { mode: "cruise", code: "NORWEGIAN", label: "Norwegian Cruise Line", label_zh: "挪威郵輪", brand_color: "#0067B1", logo_text: "NCL", aliases: ["NCL"], service_prefixes: [] },
  { mode: "cruise", code: "MSC", label: "MSC Cruises", label_zh: "地中海郵輪", brand_color: "#002D62", logo_text: "MSC", aliases: ["MEDITERRANEAN SHIPPING COMPANY"], service_prefixes: [] },
  { mode: "cruise", code: "CELEBRITY", label: "Celebrity Cruises", label_zh: "名人郵輪", brand_color: "#002D62", logo_text: "X", aliases: ["CELEBRITY"], service_prefixes: [] },
  { mode: "cruise", code: "PRINCESS", label: "Princess Cruises", label_zh: "公主郵輪", brand_color: "#003B5C", logo_text: "P", aliases: ["PRINCESS"], service_prefixes: [] },
  { mode: "cruise", code: "HOLLAND-AMERICA", label: "Holland America Line", label_zh: "荷美郵輪", brand_color: "#003B5C", logo_text: "HAL", aliases: ["HAL"], service_prefixes: [] },
  { mode: "cruise", code: "DISNEY", label: "Disney Cruise Line", label_zh: "迪士尼郵輪", brand_color: "#005EB8", logo_text: "DCL", aliases: ["DISNEY CRUISE"], service_prefixes: [] },
  { mode: "cruise", code: "CUNARD", label: "Cunard", label_zh: "冠達郵輪", brand_color: "#8A1538", logo_text: "C", aliases: ["CUNARD LINE"], service_prefixes: [] },
  { mode: "cruise", code: "COSTA", label: "Costa Cruises", label_zh: "歌詩達郵輪", brand_color: "#F2C300", logo_text: "C", aliases: ["COSTA"], service_prefixes: [] },
  { mode: "cruise", code: "VIKING", label: "Viking", label_zh: "維京郵輪", brand_color: "#7A263A", logo_text: "V", aliases: ["VIKING CRUISES"], service_prefixes: [] },
  { mode: "cruise", code: "VIRGIN-VOYAGES", label: "Virgin Voyages", label_zh: "維珍航旅", brand_color: "#E30613", logo_text: "VV", aliases: ["VIRGIN"], service_prefixes: [] },
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
