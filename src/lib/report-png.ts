import { modeColor } from "@/lib/journey-colors";
import { formatMoneyFromMinorUnits } from "@/lib/money";
import { downloadCanvasPng } from "@/lib/png-export";
import {
  SCHEMATIC_WORLD_LANDMASSES,
  createSchematicJourneyMap,
  projectSchematicWorldCoordinate,
  type SchematicJourneyMap,
  type SchematicMapFrame,
} from "@/lib/recap-map";
import type { ExpenseStatistics } from "@/lib/expense-statistics";
import type { TravelRecap } from "@/lib/travel-recap";
import type { Trip, TripMode } from "@/lib/types";

export type ReportLanguage = "zh" | "en";

export const reportChartColors = ["#0f766e", "#2563eb", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#4f46e5", "#65a30d", "#db2777", "#64748b"];

const ink = "#0f172a";
const muted = "#64748b";
const border = "#dbe4ef";
const surface = "#ffffff";
const page = "#f8fafc";

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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
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
  text(context, "JOURNEY LOG", 80, 82, { color: "#0f766e", size: 22, weight: 800 });
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

function drawSectionTitle(context: CanvasRenderingContext2D, label: string, title: string, x: number, y: number) {
  text(context, label, x, y, { color: "#0f766e", size: 16, weight: 800 });
  text(context, title, x, y + 38, { size: 30, weight: 800 });
}

function drawCoordinatePath(context: CanvasRenderingContext2D, coordinates: Array<[number, number]>, frame: SchematicMapFrame, close = false) {
  const first = coordinates[0];
  if (!first) return;
  const projected = projectSchematicWorldCoordinate(first, frame);
  context.beginPath();
  context.moveTo(projected.x, projected.y);
  for (const coordinate of coordinates.slice(1)) {
    const point = projectSchematicWorldCoordinate(coordinate, frame);
    context.lineTo(point.x, point.y);
  }
  if (close) context.closePath();
}

function drawSchematicFootprintMap(context: CanvasRenderingContext2D, map: SchematicJourneyMap, language: ReportLanguage, x: number, y: number, width: number, height: number) {
  const labels = language === "zh" ? {
    title: "你的世界足跡（繪製版）",
    routes: "路線顏色",
    stops: "地點顏色",
    returnLine: "粗線＝來回",
    noRoutes: "目前沒有可繪製的路線。",
    note: "本機繪製的世界示意，不使用外部地圖圖磚；僅供視覺回顧，非導航用途。",
    remainingCountries: "個其他國家／地區",
  } : {
    title: "Your world footprint (drawn)",
    routes: "Route colours",
    stops: "Place colours",
    returnLine: "Thicker line = return",
    noRoutes: "There are no routes to draw yet.",
    note: "A locally drawn world sketch with no external map tiles; for visual reflection, not navigation.",
    remainingCountries: "more countries / regions",
  };
  const frame: SchematicMapFrame = { x: x + 32, y: y + 116, width: width - 64, height: 314 };
  const frameRadius = 22;

  fillCard(context, x, y, width, height);
  drawSectionTitle(context, "FOOTPRINT MAP", labels.title, x + 32, y + 43);

  context.fillStyle = "#edf6fb";
  roundedRect(context, frame.x, frame.y, frame.width, frame.height, frameRadius);
  context.fill();

  context.save();
  roundedRect(context, frame.x, frame.y, frame.width, frame.height, frameRadius);
  context.clip();

  context.strokeStyle = "#d6e6f0";
  context.lineWidth = 1;
  for (let longitude = -120; longitude <= 120; longitude += 60) {
    const start = projectSchematicWorldCoordinate([longitude, -85], frame);
    const end = projectSchematicWorldCoordinate([longitude, 85], frame);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const start = projectSchematicWorldCoordinate([-180, latitude], frame);
    const end = projectSchematicWorldCoordinate([180, latitude], frame);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  context.fillStyle = "#dde9d7";
  context.strokeStyle = "#bdd0bb";
  context.lineWidth = 1.1;
  for (const landmass of SCHEMATIC_WORLD_LANDMASSES) {
    drawCoordinatePath(context, landmass, frame, true);
    context.fill();
    context.stroke();
  }

  for (const route of map.routes) {
    const routeWidth = route.route_pattern === "paired_return" ? 4.5 : 2.6;
    for (const path of route.paths) {
      drawCoordinatePath(context, path, frame);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(255, 255, 255, 0.92)";
      context.lineWidth = routeWidth + 3.3;
      context.stroke();
      drawCoordinatePath(context, path, frame);
      context.strokeStyle = modeColor(route.mode);
      context.lineWidth = routeWidth;
      context.stroke();
    }
  }

  context.restore();

  const mapStopPoint = (coordinate: [number, number]) => {
    const point = projectSchematicWorldCoordinate(coordinate, frame);
    // Keep edge stops legible instead of clipping their marker or code at the
    // international date line and map border.
    return {
      x: clamp(point.x, frame.x + 12, frame.x + frame.width - 12),
      y: clamp(point.y, frame.y + 12, frame.y + frame.height - 12),
    };
  };

  for (const stop of map.stops) {
    const point = mapStopPoint(stop.coordinate);
    const radius = 4.5 + Math.min(stop.visits, 4) * 0.8;
    context.beginPath();
    context.arc(point.x, point.y, radius + 2.4, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 255, 255, 0.96)";
    context.fill();
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = stop.country_color;
    context.fill();
  }

  if (map.stops.length <= 12) {
    context.textAlign = "center";
    context.textBaseline = "top";
    font(context, 13, 800);
    for (const stop of map.stops) {
      if (!stop.code) continue;
      const point = mapStopPoint(stop.coordinate);
      context.fillStyle = ink;
      context.fillText(stop.code, point.x, point.y + 11);
    }
  }

  context.strokeStyle = "#c9ddea";
  context.lineWidth = 1;
  roundedRect(context, frame.x, frame.y, frame.width, frame.height, frameRadius);
  context.stroke();

  const modes = (["flight", "rail", "cruise", "other"] as TripMode[]).filter((mode) => map.routes.some((route) => route.mode === mode));
  const routesY = y + 472;
  text(context, labels.routes, x + 32, routesY, { color: muted, size: 15, weight: 800 });
  let legendX = x + 132;
  for (const mode of modes) {
    context.lineCap = "round";
    context.strokeStyle = "rgba(255, 255, 255, 0.96)";
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(legendX, routesY - 5);
    context.lineTo(legendX + 26, routesY - 5);
    context.stroke();
    context.strokeStyle = modeColor(mode);
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(legendX, routesY - 5);
    context.lineTo(legendX + 26, routesY - 5);
    context.stroke();
    text(context, modeLabel(mode, language), legendX + 38, routesY, { color: ink, size: 15, weight: 700 });
    font(context, 15, 700);
    legendX += 50 + context.measureText(modeLabel(mode, language)).width;
  }
  text(context, labels.returnLine, x + width - 32, routesY, { color: muted, size: 15, weight: 800, align: "right" });

  const stopsY = y + 510;
  text(context, labels.stops, x + 32, stopsY, { color: muted, size: 15, weight: 800 });
  let countryX = x + 132;
  for (const entry of map.country_legend.slice(0, 5)) {
    context.beginPath();
    context.arc(countryX + 5, stopsY - 5, 5, 0, Math.PI * 2);
    context.fillStyle = entry.color;
    context.fill();
    font(context, 15, 700);
    const country = fitText(context, entry.country, 140);
    text(context, country, countryX + 16, stopsY, { color: ink, size: 15, weight: 700 });
    countryX += 28 + context.measureText(country).width;
  }
  const remainingCountryCount = Math.max(0, map.country_legend.length - 5);
  if (remainingCountryCount) {
    const remainingX = countryX + 8;
    const remainingWidth = x + width - 32 - remainingX;
    if (remainingWidth > 0) {
      font(context, 15, 700);
      const remaining = fitText(context, `+${remainingCountryCount} ${labels.remainingCountries}`, remainingWidth);
      text(context, remaining, remainingX, stopsY, { color: muted, size: 15, weight: 700 });
    }
  }
  if (!map.routes.length) text(context, labels.noRoutes, x + width - 32, stopsY, { color: muted, size: 16, weight: 700, align: "right" });
  text(context, labels.note, x + 32, y + height - 22, { color: muted, size: 14, weight: 500 });
}

export async function downloadTravelRecapPng(recap: TravelRecap, trips: Trip[], language: ReportLanguage) {
  const annual = recap.annual_visits.slice(0, 6);
  const recent = recap.recent_journeys.slice(0, 5);
  const annualHeight = 122 + Math.max(annual.length, 1) * 52;
  const recentHeight = 112 + Math.max(recent.length, 1) * 56;
  const mapHeight = 558;
  const modeY = 468 + mapHeight + 32;
  const annualY = modeY + 252 + 48;
  const recentY = annualY + annualHeight + 32;
  const height = recentY + recentHeight + 120;
  const map = createSchematicJourneyMap(trips);
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

      drawSchematicFootprintMap(context, map, language, 80, 468, width - 160, mapHeight);

      fillCard(context, 80, modeY, width - 160, 252);
      drawSectionTitle(context, labels.modes, labels.modesTitle, 112, modeY + 43);
      const shownModes = recap.modes.filter((entry) => entry.distance_km > 0);
      const maxDistance = Math.max(...shownModes.map((entry) => entry.distance_km), 1);
      if (!shownModes.length) {
        text(context, labels.noData, 112, modeY + 150, { color: muted, size: 22 });
      } else {
        shownModes.forEach((entry, index) => {
          const rowY = modeY + 108 + index * 34;
          text(context, modeLabel(entry.mode, language), 112, rowY + 16, { color: ink, size: 19, weight: 700 });
          const barX = 320;
          const barWidth = 805;
          context.fillStyle = "#e2e8f0";
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
      const headerY = annualY + 104;
      const columns = [112, 460, 770, 1120];
      [labels.year, labels.continent, labels.country, labels.city].forEach((label, index) => text(context, label, columns[index] ?? 112, headerY, { color: muted, size: 17, weight: 800 }));
      if (!annual.length) {
        text(context, labels.noData, 112, headerY + 44, { color: muted, size: 20 });
      } else {
        annual.forEach((entry, index) => {
          const rowY = headerY + 42 + index * 52;
          context.strokeStyle = "#e2e8f0";
          context.beginPath(); context.moveTo(112, rowY - 26); context.lineTo(1488, rowY - 26); context.stroke();
          [String(entry.year), String(entry.continents), String(entry.countries), String(entry.cities)].forEach((value, column) => text(context, value, columns[column] ?? 112, rowY + 6, { size: 21, weight: column === 0 ? 800 : 600 }));
        });
      }

      fillCard(context, 80, recentY, width - 160, recentHeight);
      drawSectionTitle(context, labels.latest, labels.latestTitle, 112, recentY + 43);
      if (!recent.length) {
        text(context, labels.noData, 112, recentY + 124, { color: muted, size: 20 });
      } else {
        recent.forEach((entry, index) => {
          const rowY = recentY + 107 + index * 56;
          const names = language === "zh" ? `${entry.origin_zh} → ${entry.destination_zh}` : `${entry.origin_en} → ${entry.destination_en}`;
          context.strokeStyle = "#e2e8f0";
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
  const categoriesHeight = Math.max(398, 148 + legendRows * 56);
  const membersHeight = 126 + statistics.members.length * 88;
  const transferHeight = 118 + Math.max(statistics.transfers.length, 1) * 52;
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
      const centerY = categoriesY + Math.max(224, categoriesHeight / 2 + 18);
      const radius = 142;
      let start = -Math.PI / 2;
      statistics.categories.forEach((category, index) => {
        const fraction = category.amount_minor / statistics.total_spent_minor;
        const end = start + fraction * Math.PI * 2;
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.arc(centerX, centerY, radius, start, end);
        context.closePath();
        context.fillStyle = reportChartColors[index % reportChartColors.length] ?? "#64748b";
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
        const y = categoriesY + 121 + row * 56;
        const color = reportChartColors[index % reportChartColors.length] ?? "#64748b";
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
        const y = membersY + 117 + index * 88;
        context.strokeStyle = "#e2e8f0";
        context.beginPath(); context.moveTo(112, y - 30); context.lineTo(1488, y - 30); context.stroke();
        font(context, 21, 800);
        text(context, fitText(context, member.name, 230), 112, y, { size: 21, weight: 800 });
        text(context, labels.paid, 390, y - 12, { color: muted, size: 15, weight: 800 });
        context.fillStyle = "#dbeafe";
        roundedRect(context, 390, y, 420, 16, 8); context.fill();
        context.fillStyle = "#2563eb";
        roundedRect(context, 390, y, Math.max(member.paid_minor > 0 ? 8 : 0, (member.paid_minor / maxPaid) * 420), 16, 8); context.fill();
        text(context, money(member.paid_minor), 840, y + 14, { size: 18, weight: 800 });
        text(context, `${labels.share}: ${money(member.share_minor)}`, 1030, y - 5, { color: muted, size: 17, weight: 700 });
        text(context, `${labels.net}: ${member.net_minor >= 0 ? "+" : "−"}${money(Math.abs(member.net_minor))}`, 1030, y + 23, { color: member.net_minor >= 0 ? "#0f766e" : "#b45309", size: 17, weight: 800 });
      });

      fillCard(context, 80, transfersY, width - 160, transferHeight);
      drawSectionTitle(context, labels.transfers, labels.transfers, 112, transfersY + 43);
      if (!statistics.transfers.length) {
        text(context, labels.none, 112, transfersY + 108, { color: muted, size: 20 });
      } else {
        statistics.transfers.forEach((transfer, index) => {
          const y = transfersY + 112 + index * 52;
          context.strokeStyle = "#e2e8f0";
          context.beginPath(); context.moveTo(112, y - 27); context.lineTo(1488, y - 27); context.stroke();
          const from = memberName.get(transfer.from_member_id) ?? transfer.from_member_id;
          const to = memberName.get(transfer.to_member_id) ?? transfer.to_member_id;
          font(context, 20, 800);
          text(context, fitText(context, `${from} ${labels.pays} ${to}`, 1080), 112, y + 2, { size: 20, weight: 800 });
          text(context, money(transfer.amount_minor), 1488, y + 2, { color: "#0f766e", size: 20, weight: 800, align: "right" });
        });
      }
      text(context, labels.note, 80, height - 47, { color: muted, size: 16, weight: 500 });
    },
  });
}
