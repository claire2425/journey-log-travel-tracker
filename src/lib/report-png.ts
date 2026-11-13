import { modeColor } from "@/lib/journey-colors";
import { formatMoneyFromMinorUnits } from "@/lib/money";
import { displayCountryName } from "@/lib/country-names";
import { drawMapPanel, drawRegionBadge, drawRouteLegendSample } from "@/lib/footprint-map-canvas";
import { downloadCanvasPng } from "@/lib/png-export";
import {
  createSchematicJourneyMap,
  fitMercatorView,
  planFootprintRegions,
  type FootprintRegion,
  type MercatorView,
  type SchematicJourneyMap,
  type SchematicMapFrame,
} from "@/lib/recap-map";
import {
  WORLD_BASEMAP_SOURCE_NOTE,
  findBasemapCountry,
  loadWorldBasemap,
  type BasemapCountry,
  type WorldBasemap,
} from "@/lib/world-basemap";
import type { ExpenseStatistics } from "@/lib/expense-statistics";
import type { TravelRecap } from "@/lib/travel-recap";
import type { Trip, TripMode } from "@/lib/types";

export type ReportLanguage = "zh" | "en";

export const reportChartColors = ["#8fa77c", "#6f8fab", "#b06f4e", "#7e6c9a", "#b85c68", "#3d7a8a", "#c9a25a", "#7f8f3a", "#a0786a", "#736d63"];

const ink = "#26241f";
const muted = "#736d63";
const border = "#e3ded5";
const surface = "#fcfbf8";
const page = "#f3f0ea";

function locale(language: ReportLanguage) {
  return language === "zh" ? "zh-TW" : "en-GB";
}

function reportDate(language: ReportLanguage) {
  return new Intl.DateTimeFormat(locale(language), { year: "numeric", month: "short", day: "numeric" }).format(new Date());
}

function filenameDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function font(context: CanvasRenderingContext2D, size: number, weight = 500) {
  context.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Segoe UI", sans-serif`;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const value = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + value, y);
  context.arcTo(x + width, y, x + width, y + height, value);
  context.arcTo(x + width, y + height, x, y + height, value);
  context.arcTo(x, y + height, x, y, value);
  context.arcTo(x, y, x + width, y, value);
  context.closePath();
}

function fillCard(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color = surface) {
  context.fillStyle = color;
  roundedRect(context, x, y, width, height, 28);
  context.fill();
  context.strokeStyle = border;
  context.lineWidth = 1;
  context.stroke();
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, options: { color?: string; size?: number; weight?: number; align?: CanvasTextAlign } = {}) {
  context.fillStyle = options.color ?? ink;
  context.textAlign = options.align ?? "left";
  context.textBaseline = "alphabetic";
  font(context, options.size ?? 24, options.weight ?? 500);
  context.fillText(value, x, y);
}

function fitText(context: CanvasRenderingContext2D, value: string, width: number) {
  if (context.measureText(value).width <= width) return value;
  const ellipsis = "…";
  let output = "";
  for (const character of value) {
    if (context.measureText(`${output}${character}${ellipsis}`).width > width) break;
    output += character;
  }
  return `${output}${ellipsis}`;
}

function number(value: number, language: ReportLanguage, digits = 0) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

function duration(totalMinutes: number, language: ReportLanguage) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return language === "zh" ? `${hours} 小時 ${minutes} 分` : `${hours}h ${minutes}m`;
}

function modeLabel(mode: TripMode, language: ReportLanguage) {
  const labels: Record<ReportLanguage, Record<TripMode, string>> = {
    zh: { flight: "飛行", rail: "火車／高鐵", cruise: "郵輪", other: "其他" },
    en: { flight: "Flight", rail: "Rail / high-speed rail", cruise: "Cruise", other: "Other" },
  };
  return labels[language][mode];
}

function drawHeader(context: CanvasRenderingContext2D, language: ReportLanguage, eyebrow: string, title: string, subtitle: string) {
  text(context, "JOURNEY LOG", 80, 82, { color: "#5c7651", size: 22, weight: 800 });
  text(context, title, 80, 143, { size: 48, weight: 800 });
  text(context, subtitle, 80, 184, { color: muted, size: 23, weight: 500 });
  text(context, eyebrow, 1520, 82, { color: muted, size: 18, weight: 700, align: "right" });
  text(context, reportDate(language), 1520, 111, { color: ink, size: 20, weight: 700, align: "right" });
}

function drawMetric(context: CanvasRenderingContext2D, x: number, y: number, width: number, label: string, value: string, detail?: string) {
  fillCard(context, x, y, width, 152);
  text(context, label, x + 28, y + 38, { color: muted, size: 17, weight: 800 });
  text(context, value, x + 28, y + 88, { size: 33, weight: 800 });
  if (detail) text(context, detail, x + 28, y + 122, { color: muted, size: 17, weight: 500 });
}

/**
 * Section titles end at card top + 81 px (label at +43, 30 px title at +81).
 * Content below a title starts at least SECTION_BODY_TOP from the card top so
 * descenders, table headers and divider lines never touch the title.
 */
const SECTION_BODY_TOP = 122;

function drawSectionTitle(context: CanvasRenderingContext2D, label: string, title: string, x: number, y: number) {
  text(context, label, x, y, { color: "#5c7651", size: 16, weight: 800 });
  text(context, title, x, y + 38, { size: 30, weight: 800 });
}

type FootprintDetail = { region: FootprintRegion; view: MercatorView; frame: SchematicMapFrame };

type FootprintLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  overview: MercatorView;
  regions: FootprintRegion[];
  details: FootprintDetail[];
  detailHeaderY: number;
  legendY: number;
  countryRows: number;
};

const FOOTPRINT_COUNTRIES_PER_ROW = 7;

/** Works out the map card's size before drawing, so the PNG height is exact. */
function planFootprintLayout(map: SchematicJourneyMap, x: number, y: number, width: number): FootprintLayout {
  const innerX = x + 32;
  const innerWidth = width - 64;
  const allCoordinates = [...map.stops.map((stop) => stop.coordinate), ...map.routes.flatMap((route) => route.coordinates)];
  const draftFrame: SchematicMapFrame = { x: innerX, y: y + 116, width: innerWidth, height: 620 };
  const draftView = fitMercatorView(allCoordinates, draftFrame, { padding: 70, minSpanDegrees: 8 });
  const regions = planFootprintRegions(map, draftView);

  const overviewFrame: SchematicMapFrame = { ...draftFrame, height: regions.length ? 600 : 680 };
  const overview = fitMercatorView(allCoordinates, overviewFrame, { padding: 70, minSpanDegrees: 8 });

  let cursor = overviewFrame.y + overviewFrame.height;
  const detailHeaderY = cursor + 50;
  const details: FootprintDetail[] = [];
  if (regions.length) {
    const gap = 24;
    const panelWidth = (innerWidth - gap * (regions.length - 1)) / regions.length;
    const panelHeight = regions.length === 1 ? 440 : regions.length === 2 ? 420 : 380;
    regions.forEach((region, index) => {
      const frame: SchematicMapFrame = { x: innerX + index * (panelWidth + gap), y: detailHeaderY + 22, width: panelWidth, height: panelHeight };
      details.push({ region, frame, view: fitMercatorView(region.coordinates, frame, { padding: 58, minSpanDegrees: 2.4 }) });
    });
    cursor = detailHeaderY + 22 + panelHeight;
  }

  const countryRows = Math.max(1, Math.ceil(map.country_legend.length / FOOTPRINT_COUNTRIES_PER_ROW));
  const legendY = cursor + 52;
  const height = legendY - y + 40 + countryRows * 34 + 46;
  return { x, y, width, height, overview, regions, details, detailHeaderY, legendY, countryRows };
}

function visitedCountries(basemap: WorldBasemap | null, map: SchematicJourneyMap) {
  const visited = new Map<BasemapCountry, string>();
  if (!basemap) return visited;
  for (const stop of map.stops) {
    const country = findBasemapCountry(basemap, stop.coordinate, stop.country);
    if (country && !visited.has(country)) visited.set(country, stop.country_color);
  }
  return visited;
}

function drawFootprintMap(
  context: CanvasRenderingContext2D,
  map: SchematicJourneyMap,
  layout: FootprintLayout,
  basemap: WorldBasemap | null,
  language: ReportLanguage,
) {
  const labels = language === "zh" ? {
    title: "你的旅行足跡地圖",
    routes: "路線",
    stops: "國家／地區",
    returnLine: "粗線＝來回　箭頭＝單程方向",
    noRoutes: "目前沒有可繪製的路線。",
    note: `底圖：${WORLD_BASEMAP_SOURCE_NOTE.replace("public domain", "公有領域")}；航線以弧線示意，非實際航跡。`,
    regionNote: "虛線框為下方放大區域。",
    places: "個地點",
    routeCount: "條路線",
  } : {
    title: "Your travel footprint",
    routes: "Routes",
    stops: "Countries / regions",
    returnLine: "Thicker line = return · Arrow = one-way direction",
    noRoutes: "There are no routes to draw yet.",
    note: `Basemap: ${WORLD_BASEMAP_SOURCE_NOTE}. Flights are drawn as illustrative arcs, not flown tracks.`,
    regionNote: " Dashed boxes are enlarged below.",
    places: "places",
    routeCount: "routes",
  };
  const { x, y, width, height } = layout;
  const visited = visitedCountries(basemap, map);
  const regionStopIds = new Set(layout.regions.flatMap((region) => region.stops.map((stop) => stop.id)));

  fillCard(context, x, y, width, height);
  drawSectionTitle(context, "FOOTPRINT MAP", labels.title, x + 32, y + 43);

  drawMapPanel(context, {
    view: layout.overview,
    basemap,
    visited,
    routes: map.routes,
    stops: map.stops,
    language,
    detailed: false,
    labelled: new Set(map.stops.filter((stop) => !regionStopIds.has(stop.id)).map((stop) => stop.id)),
    regions: layout.regions,
  });

  layout.details.forEach(({ region, view, frame }, index) => {
    drawRegionBadge(context, frame.x + 13, layout.detailHeaderY, String(index + 1), 13);
    const names = region.countries.map((country) => displayCountryName(country, language)).join(language === "zh" ? "・" : " · ");
    font(context, 19, 800);
    const title = fitText(context, names, frame.width - 200);
    text(context, title, frame.x + 36, layout.detailHeaderY + 7, { size: 19, weight: 800 });
    font(context, 19, 800);
    const titleWidth = context.measureText(title).width;
    const routeCount = region.routes.reduce((sum, route) => sum + route.journeys, 0);
    const meta = language === "zh"
      ? `${region.stops.length} ${labels.places} · ${routeCount} ${labels.routeCount}`
      : `${region.stops.length} ${labels.places} · ${routeCount} ${labels.routeCount}`;
    text(context, meta, frame.x + 46 + titleWidth, layout.detailHeaderY + 7, { color: muted, size: 15, weight: 700 });
    drawMapPanel(context, {
      view,
      basemap,
      visited,
      routes: map.routes,
      stops: map.stops,
      language,
      detailed: true,
      labelled: new Set(map.stops.map((stop) => stop.id)),
      radius: 18,
    });
  });

  // Legend: route styles
  const legendY = layout.legendY;
  const modes = (["flight", "rail", "cruise", "other"] as TripMode[]).filter((mode) => map.routes.some((route) => route.mode === mode));
  font(context, 15, 800);
  const legendStart = x + 32 + Math.max(128, Math.max(context.measureText(labels.routes).width, context.measureText(labels.stops).width) + 28);
  text(context, labels.routes, x + 32, legendY, { color: muted, size: 15, weight: 800 });
  let legendX = legendStart;
  for (const mode of modes) {
    drawRouteLegendSample(context, mode, legendX, legendY - 5);
    text(context, modeLabel(mode, language), legendX + 42, legendY, { color: ink, size: 15, weight: 700 });
    font(context, 15, 700);
    legendX += 66 + context.measureText(modeLabel(mode, language)).width;
  }
  if (!map.routes.length) text(context, labels.noRoutes, legendX, legendY, { color: muted, size: 15, weight: 700 });
  text(context, labels.returnLine, x + width - 32, legendY, { color: muted, size: 15, weight: 700, align: "right" });

  // Legend: country colours, wrapped across rows
  const countriesY = legendY + 40;
  text(context, labels.stops, x + 32, countriesY, { color: muted, size: 15, weight: 800 });
  const columnWidth = (x + width - 32 - legendStart) / FOOTPRINT_COUNTRIES_PER_ROW;
  map.country_legend.forEach((entry, index) => {
    const column = index % FOOTPRINT_COUNTRIES_PER_ROW;
    const row = Math.floor(index / FOOTPRINT_COUNTRIES_PER_ROW);
    const entryX = legendStart + column * columnWidth;
    const entryY = countriesY + row * 34;
    context.beginPath();
    context.arc(entryX + 6, entryY - 5, 6.5, 0, Math.PI * 2);
    context.fillStyle = entry.color;
    context.fill();
    font(context, 15, 700);
    text(context, fitText(context, displayCountryName(entry.country, language), columnWidth - 30), entryX + 20, entryY, { color: ink, size: 15, weight: 700 });
  });

  const note = layout.regions.length ? `${labels.note}${labels.regionNote}` : labels.note;
  text(context, note, x + 32, y + height - 26, { color: muted, size: 14, weight: 500 });
}

export async function downloadTravelRecapPng(recap: TravelRecap, trips: Trip[], language: ReportLanguage) {
  const annual = recap.annual_visits.slice(0, 6);
  const recent = recap.recent_journeys.slice(0, 5);
  const annualHeight = SECTION_BODY_TOP + 40 + Math.max(annual.length, 1) * 52;
  const recentHeight = SECTION_BODY_TOP + 40 + Math.max(recent.length, 1) * 56;
  const map = createSchematicJourneyMap(trips);
  const basemap = await loadWorldBasemap();
  const footprint = planFootprintLayout(map, 80, 468, 1440);
  const modeY = 468 + footprint.height + 32;
  const modeHeight = SECTION_BODY_TOP + 160;
  const annualY = modeY + modeHeight + 48;
  const recentY = annualY + annualHeight + 32;
  const height = recentY + recentHeight + 120;
  const labels = language === "zh" ? {
    title: "旅行分析", subtitle: `依目前篩選的 ${number(recap.total_journeys, language)} 趟旅程`, generated: "本機產生的 PNG 報告",
    journeys: "旅程", distance: "總距離", laps: "繞地球", countries: "到訪國家／地區", duration: "旅途時間",
    modes: "交通方式", modesTitle: "各方式的紀錄距離", years: "年度足跡", yearsTitle: "洲別、國家與城市／地點", latest: "最近旅程", latestTitle: "依出發日期排列", year: "年份", continent: "洲別", country: "國家／地區", city: "城市／地點", noData: "尚無資料", distanceNote: "距離為每筆旅程記錄或估算值；地球圈數以赤道周長比較。",
  } : {
    title: "Travel recap", subtitle: `${number(recap.total_journeys, language)} journeys in the current results`, generated: "PNG report made on this device",
    journeys: "JOURNEYS", distance: "TOTAL DISTANCE", laps: "EARTH LAPS", countries: "COUNTRIES / REGIONS", duration: "Travel time",
    modes: "TRAVEL MODES", modesTitle: "Recorded distance by mode", years: "YEARLY FOOTPRINT", yearsTitle: "Continents, countries and cities / places", latest: "RECENT JOURNEYS", latestTitle: "Ordered by departure date", year: "Year", continent: "Continents", country: "Countries / regions", city: "Cities / places", noData: "No data yet", distanceNote: "Distances are recorded or estimated per journey; Earth laps use the equatorial circumference as a comparison.",
  };

  await downloadCanvasPng({
    filename: `journey-log-travel-${filenameDate()}.png`,
    width: 1600,
    height,
    draw: (context, width) => {
      context.fillStyle = page;
      context.fillRect(0, 0, width, height);
      drawHeader(context, language, labels.generated, labels.title, labels.subtitle);

      const cardWidth = (width - 160 - 72) / 4;
      const metricsY = 238;
      drawMetric(context, 80, metricsY, cardWidth, labels.journeys, number(recap.total_journeys, language), `${labels.duration}: ${duration(recap.statistics.totalDurationMin, language)}`);
      drawMetric(context, 80 + cardWidth + 24, metricsY, cardWidth, labels.distance, `${number(recap.statistics.totalDistanceKm, language)} km`);
      drawMetric(context, 80 + (cardWidth + 24) * 2, metricsY, cardWidth, labels.laps, `${number(recap.earth_laps, language, 2)}×`);
      drawMetric(context, 80 + (cardWidth + 24) * 3, metricsY, cardWidth, labels.countries, number(recap.statistics.countriesVisited, language));

      drawFootprintMap(context, map, footprint, basemap, language);

      fillCard(context, 80, modeY, width - 160, modeHeight);
      drawSectionTitle(context, labels.modes, labels.modesTitle, 112, modeY + 43);
      const shownModes = recap.modes.filter((entry) => entry.distance_km > 0);
      const maxDistance = Math.max(...shownModes.map((entry) => entry.distance_km), 1);
      if (!shownModes.length) {
        text(context, labels.noData, 112, modeY + 150, { color: muted, size: 22 });
      } else {
        shownModes.forEach((entry, index) => {
          const rowY = modeY + SECTION_BODY_TOP + index * 34;
          text(context, modeLabel(entry.mode, language), 112, rowY + 16, { color: ink, size: 19, weight: 700 });
          const barX = 320;
          const barWidth = 805;
          context.fillStyle = "#e8e3da";
          roundedRect(context, barX, rowY, barWidth, 18, 9);
          context.fill();
          context.fillStyle = modeColor(entry.mode);
          roundedRect(context, barX, rowY, Math.max(9, (entry.distance_km / maxDistance) * barWidth), 18, 9);
          context.fill();
          text(context, `${number(entry.distance_km, language)} km · ${number(entry.journeys, language)} ${language === "zh" ? "趟" : entry.journeys === 1 ? "journey" : "journeys"}`, 1450, rowY + 16, { color: muted, size: 18, weight: 700, align: "right" });
        });
      }

      fillCard(context, 80, annualY, width - 160, annualHeight);
      drawSectionTitle(context, labels.years, labels.yearsTitle, 112, annualY + 43);
      const annualScope = language === "zh"
        ? `最新 ${annual.length} 年／共 ${recap.annual_visits.length} 年`
        : `Latest ${annual.length} of ${recap.annual_visits.length} years`;
      text(context, annualScope, 1488, annualY + 43, { color: muted, size: 16, weight: 700, align: "right" });
      const headerY = annualY + SECTION_BODY_TOP + 10;
      const columns = [112, 460, 770, 1120];
      [labels.year, labels.continent, labels.country, labels.city].forEach((label, index) => text(context, label, columns[index] ?? 112, headerY, { color: muted, size: 17, weight: 800 }));
      if (!annual.length) {
        text(context, labels.noData, 112, headerY + 44, { color: muted, size: 20 });
      } else {
        annual.forEach((entry, index) => {
          const rowY = headerY + 42 + index * 52;
          context.strokeStyle = "#e8e3da";
          context.beginPath(); context.moveTo(112, rowY - 26); context.lineTo(1488, rowY - 26); context.stroke();
          [String(entry.year), String(entry.continents), String(entry.countries), String(entry.cities)].forEach((value, column) => text(context, value, columns[column] ?? 112, rowY + 6, { size: 21, weight: column === 0 ? 800 : 600 }));
        });
      }

      fillCard(context, 80, recentY, width - 160, recentHeight);
      drawSectionTitle(context, labels.latest, labels.latestTitle, 112, recentY + 43);
      if (!recent.length) {
        text(context, labels.noData, 112, recentY + SECTION_BODY_TOP + 26, { color: muted, size: 20 });
      } else {
        recent.forEach((entry, index) => {
          const rowY = recentY + SECTION_BODY_TOP + 34 + index * 56;
          const names = language === "zh" ? `${entry.origin_zh} → ${entry.destination_zh}` : `${entry.origin_en} → ${entry.destination_en}`;
          context.strokeStyle = "#e8e3da";
          context.beginPath(); context.moveTo(112, rowY - 26); context.lineTo(1488, rowY - 26); context.stroke();
          text(context, entry.departure_date, 112, rowY + 4, { color: muted, size: 18, weight: 700 });
          font(context, 21, 800);
          text(context, fitText(context, names, 780), 305, rowY + 4, { size: 21, weight: 800 });
          text(context, modeLabel(entry.mode, language), 1170, rowY + 4, { color: modeColor(entry.mode), size: 18, weight: 800 });
          text(context, `${number(entry.distance_km, language)} km`, 1488, rowY + 4, { color: muted, size: 18, weight: 700, align: "right" });
        });
      }

      text(context, labels.distanceNote, 80, height - 47, { color: muted, size: 16, weight: 500 });
    },
  });
}

export async function downloadExpenseReportPng(statistics: ExpenseStatistics, language: ReportLanguage) {
  const legendRows = Math.ceil(statistics.categories.length / 2);
  const categoriesHeight = Math.max(SECTION_BODY_TOP + 2 * 136 + 48, SECTION_BODY_TOP + 40 + legendRows * 56);
  const membersHeight = SECTION_BODY_TOP + 24 + statistics.members.length * 88;
  const transferHeight = SECTION_BODY_TOP + 34 + Math.max(statistics.transfers.length, 1) * 52;
  const categoriesY = 420;
  const membersY = categoriesY + categoriesHeight + 32;
  const transfersY = membersY + membersHeight + 32;
  const height = transfersY + transferHeight + 120;
  const labels = language === "zh" ? {
    title: "旅伴記帳分析", subtitle: `最後結算幣別：${statistics.currency}`, generated: "本機產生的 PNG 報告", total: "總支出", categories: "類別支出", categoryTitle: "各類別占總支出的比例", members: "旅伴付款與分攤", memberTitle: "實際先付、自己分攤與結算差額", paid: "實際先付", share: "自己分攤", net: "結算差額", transfers: "最後轉帳建議", none: "帳目已平衡，不需要轉帳。", pays: "支付給", note: "金額只使用每筆已確認並凍結的換匯快照；不會混加原始幣別或重算匯率。",
  } : {
    title: "Travel split recap", subtitle: `Final settlement currency: ${statistics.currency}`, generated: "PNG report made on this device", total: "TOTAL SPENT", categories: "BY CATEGORY", categoryTitle: "Share of the total by category", members: "TRAVELLER PAYMENTS", memberTitle: "Paid up front, personal share, and settlement balance", paid: "Paid up front", share: "Personal share", net: "Settlement balance", transfers: "SETTLEMENT TRANSFERS", none: "The ledger is balanced; no transfer is needed.", pays: "pays", note: "Amounts use only confirmed, frozen conversion snapshots; original currencies are never mixed or re-rated.",
  };
  const memberName = new Map(statistics.members.map((member) => [member.member_id, member.name]));
  const money = (amount: number) => formatMoneyFromMinorUnits(amount, statistics.currency, statistics.fraction_digits, language);

  await downloadCanvasPng({
    filename: `journey-log-expenses-${filenameDate()}.png`,
    width: 1600,
    height,
    draw: (context, width) => {
      context.fillStyle = page;
      context.fillRect(0, 0, width, height);
      drawHeader(context, language, labels.generated, labels.title, labels.subtitle);
      drawMetric(context, 80, 228, width - 160, labels.total, money(statistics.total_spent_minor), `${statistics.categories.length} ${language === "zh" ? "個類別" : statistics.categories.length === 1 ? "category" : "categories"}`);

      fillCard(context, 80, categoriesY, width - 160, categoriesHeight);
      drawSectionTitle(context, labels.categories, labels.categoryTitle, 112, categoriesY + 43);
      const centerX = 340;
      const radius = 136;
      // Keep the donut fully below the section title (it used to touch it).
      const centerY = categoriesY + Math.max(SECTION_BODY_TOP + radius + 8, categoriesHeight / 2 + 30);
      let start = -Math.PI / 2;
      statistics.categories.forEach((category, index) => {
        const fraction = category.amount_minor / statistics.total_spent_minor;
        const end = start + fraction * Math.PI * 2;
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.arc(centerX, centerY, radius, start, end);
        context.closePath();
        context.fillStyle = reportChartColors[index % reportChartColors.length] ?? "#736d63";
        context.fill();
        start = end;
      });
      context.fillStyle = surface;
      context.beginPath(); context.arc(centerX, centerY, 88, 0, Math.PI * 2); context.fill();
      text(context, money(statistics.total_spent_minor), centerX, centerY - 2, { size: 21, weight: 800, align: "center" });
      text(context, labels.total, centerX, centerY + 29, { color: muted, size: 14, weight: 800, align: "center" });

      const legendX = 600;
      const legendColumnWidth = 430;
      statistics.categories.forEach((category, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = legendX + column * legendColumnWidth;
        const y = categoriesY + SECTION_BODY_TOP + 18 + row * 56;
        const color = reportChartColors[index % reportChartColors.length] ?? "#736d63";
        context.fillStyle = color;
        roundedRect(context, x, y - 17, 18, 18, 5); context.fill();
        font(context, 18, 800);
        text(context, fitText(context, category.category, 250), x + 30, y, { size: 18, weight: 800 });
        const percentage = number((category.amount_minor / statistics.total_spent_minor) * 100, language, 1);
        text(context, `${money(category.amount_minor)} · ${percentage}%`, x + 30, y + 25, { color: muted, size: 16, weight: 600 });
      });

      fillCard(context, 80, membersY, width - 160, membersHeight);
      drawSectionTitle(context, labels.members, labels.memberTitle, 112, membersY + 43);
      const maxPaid = Math.max(...statistics.members.map((member) => member.paid_minor), 1);
      statistics.members.forEach((member, index) => {
        const y = membersY + SECTION_BODY_TOP + 28 + index * 88;
        context.strokeStyle = "#e8e3da";
        context.beginPath(); context.moveTo(112, y - 30); context.lineTo(1488, y - 30); context.stroke();
        font(context, 21, 800);
        text(context, fitText(context, member.name, 230), 112, y, { size: 21, weight: 800 });
        text(context, labels.paid, 390, y - 12, { color: muted, size: 15, weight: 800 });
        context.fillStyle = "#dce5ec";
        roundedRect(context, 390, y, 420, 16, 8); context.fill();
        context.fillStyle = "#5f7f94";
        roundedRect(context, 390, y, Math.max(member.paid_minor > 0 ? 8 : 0, (member.paid_minor / maxPaid) * 420), 16, 8); context.fill();
        text(context, money(member.paid_minor), 840, y + 14, { size: 18, weight: 800 });
        text(context, `${labels.share}: ${money(member.share_minor)}`, 1030, y - 5, { color: muted, size: 17, weight: 700 });
        text(context, `${labels.net}: ${member.net_minor >= 0 ? "+" : "−"}${money(Math.abs(member.net_minor))}`, 1030, y + 23, { color: member.net_minor >= 0 ? "#5c7651" : "#93693a", size: 17, weight: 800 });
      });

      fillCard(context, 80, transfersY, width - 160, transferHeight);
      drawSectionTitle(context, labels.transfers, labels.transfers, 112, transfersY + 43);
      if (!statistics.transfers.length) {
        text(context, labels.none, 112, transfersY + SECTION_BODY_TOP + 26, { color: muted, size: 20 });
      } else {
        statistics.transfers.forEach((transfer, index) => {
          const y = transfersY + SECTION_BODY_TOP + 38 + index * 52;
          context.strokeStyle = "#e8e3da";
          context.beginPath(); context.moveTo(112, y - 27); context.lineTo(1488, y - 27); context.stroke();
          const from = memberName.get(transfer.from_member_id) ?? transfer.from_member_id;
          const to = memberName.get(transfer.to_member_id) ?? transfer.to_member_id;
          font(context, 20, 800);
          text(context, fitText(context, `${from} ${labels.pays} ${to}`, 1080), 112, y + 2, { size: 20, weight: 800 });
          text(context, money(transfer.amount_minor), 1488, y + 2, { color: "#5c7651", size: 20, weight: 800, align: "right" });
        });
      }
      text(context, labels.note, 80, height - 47, { color: muted, size: 16, weight: 500 });
    },
  });
}
