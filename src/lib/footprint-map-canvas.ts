import { modeColor } from "@/lib/journey-colors";
import {
  SCHEMATIC_WORLD_LANDMASSES,
  kilometresPerPixel,
  latitudeAtY,
  projectMercator,
  projectMercatorPath,
  type FootprintRegion,
  type MercatorView,
  type ProjectedPoint,
  type SchematicJourneyRoute,
  type SchematicJourneyStop,
} from "@/lib/recap-map";
import type { BasemapCountry, WorldBasemap } from "@/lib/world-basemap";
import type { Coordinate } from "@/lib/geo";
import type { TripMode } from "@/lib/types";

export type MapLanguage = "zh" | "en";

const FONT_STACK = `-apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Noto Sans CJK TC", "Segoe UI", sans-serif`;
const INK = "#0f172a";
const OCEAN_TOP = "#d7e8f2";
const OCEAN_BOTTOM = "#e7f0f5";
const LAND = "#f6f3ec";
const LAND_BORDER = "#cfd3c6";
const GRATICULE = "rgba(255, 255, 255, 0.55)";

export const ROUTE_DASH: Record<TripMode, number[]> = {
  flight: [],
  rail: [],
  cruise: [10, 7],
  other: [2, 7],
};

/** Visual bulge (as a share of the chord) that separates flights from ground routes. */
const ROUTE_BULGE: Record<TripMode, number> = { flight: 0.16, rail: 0, cruise: 0.08, other: 0.08 };

function setFont(context: CanvasRenderingContext2D, size: number, weight: number) {
  context.font = `${weight} ${size}px ${FONT_STACK}`;
}

export function roundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const value = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + value, y);
  context.arcTo(x + width, y, x + width, y + height, value);
  context.arcTo(x + width, y + height, x, y + height, value);
  context.arcTo(x, y + height, x, y, value);
  context.arcTo(x, y, x + width, y, value);
  context.closePath();
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const number = Number.parseInt(full, 16);
  if (Number.isNaN(number)) return `rgba(100, 116, 139, ${alpha})`;
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function niceStep(raw: number, steps: number[]) {
  return steps.find((step) => step >= raw) ?? steps[steps.length - 1]!;
}

/* ------------------------------ Basemap ---------------------------------- */

function traceRing(context: CanvasRenderingContext2D, ring: Coordinate[], view: MercatorView, shift: number) {
  const scale = view.scale;
  const toX = (longitude: number) => view.offsetX + ((longitude - view.centerLongitude + shift) * Math.PI / 180) * scale;
  const first = ring[0];
  if (!first) return;
  context.moveTo(toX(first[0]), projectMercator([view.centerLongitude, first[1]], view).y);
  let previousX = Number.NaN;
  let previousY = Number.NaN;
  for (let index = 1; index < ring.length; index += 1) {
    const [longitude, latitude] = ring[index]!;
    const x = toX(longitude);
    const y = projectMercator([view.centerLongitude, latitude], view).y;
    // Skip sub-pixel steps; 1:50m rings are far denser than a zoomed-out canvas needs.
    if (Math.abs(x - previousX) < 0.35 && Math.abs(y - previousY) < 0.35) continue;
    context.lineTo(x, y);
    previousX = x;
    previousY = y;
  }
  context.closePath();
}

function visibleShifts(bbox: [number, number, number, number], view: MercatorView) {
  const [west, south, east, north] = bbox;
  const frame = view.frame;
  const top = projectMercator([0, north], view).y;
  const bottom = projectMercator([0, south], view).y;
  if (bottom < frame.y || top > frame.y + frame.height) return [];
  const shifts: number[] = [];
  for (const shift of [-360, 0, 360]) {
    const left = view.offsetX + ((west - view.centerLongitude + shift) * Math.PI / 180) * view.scale;
    const right = view.offsetX + ((east - view.centerLongitude + shift) * Math.PI / 180) * view.scale;
    if (right >= frame.x - 2 && left <= frame.x + frame.width + 2) shifts.push(shift);
  }
  return shifts;
}

function drawCountries(
  context: CanvasRenderingContext2D,
  view: MercatorView,
  countries: BasemapCountry[],
  visited: Map<BasemapCountry, string>,
  detailed: boolean,
) {
  // Land and borders first, then visited tints on top so the tint stays clean.
  for (const country of countries) {
    const shifts = visibleShifts(country.bbox, view);
    if (!shifts.length) continue;
    context.beginPath();
    for (const shift of shifts) for (const ring of country.rings) traceRing(context, ring, view, shift);
    context.fillStyle = LAND;
    context.fill("evenodd");
    context.strokeStyle = LAND_BORDER;
    context.lineWidth = detailed ? 1 : 0.8;
    context.stroke();
  }
  for (const [country, color] of visited) {
    const shifts = visibleShifts(country.bbox, view);
    if (!shifts.length) continue;
    context.beginPath();
    for (const shift of shifts) for (const ring of country.rings) traceRing(context, ring, view, shift);
    // Zoomed panels are often entirely one country, so keep their tint quieter.
    context.fillStyle = hexToRgba(color, detailed ? 0.1 : 0.16);
    context.fill("evenodd");
    context.strokeStyle = hexToRgba(color, 0.55);
    context.lineWidth = detailed ? 1.4 : 1.1;
    context.stroke();
  }
}

function drawSchematicLand(context: CanvasRenderingContext2D, view: MercatorView) {
  for (const ring of SCHEMATIC_WORLD_LANDMASSES) {
    const xs = ring.map(([longitude]) => longitude);
    const shifts = visibleShifts([Math.min(...xs), -85, Math.max(...xs), 85], view);
    context.beginPath();
    for (const shift of shifts) traceRing(context, ring, view, shift);
    context.fillStyle = LAND;
    context.fill();
    context.strokeStyle = LAND_BORDER;
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawGraticule(context: CanvasRenderingContext2D, view: MercatorView) {
  const frame = view.frame;
  const spanDegrees = (frame.width / view.scale) * (180 / Math.PI);
  const step = niceStep(spanDegrees / 7, [1, 2, 5, 10, 15, 20, 30]);
  context.strokeStyle = GRATICULE;
  context.lineWidth = 1;
  const leftLongitude = view.centerLongitude - spanDegrees / 2 - step;
  for (let longitude = Math.ceil(leftLongitude / step) * step; longitude <= leftLongitude + spanDegrees + step * 2; longitude += step) {
    const x = view.offsetX + ((longitude - view.centerLongitude) * Math.PI / 180) * view.scale;
    context.beginPath();
    context.moveTo(x, frame.y);
    context.lineTo(x, frame.y + frame.height);
    context.stroke();
  }
  const northLatitude = Math.min(82, latitudeAtY(frame.y, view));
  const southLatitude = Math.max(-78, latitudeAtY(frame.y + frame.height, view));
  for (let latitude = Math.ceil(southLatitude / step) * step; latitude <= northLatitude; latitude += step) {
    const { y } = projectMercator([view.centerLongitude, latitude], view);
    context.beginPath();
    context.moveTo(frame.x, y);
    context.lineTo(frame.x + frame.width, y);
    context.stroke();
  }
}

/* ------------------------------- Routes ---------------------------------- */

/** Adds a gentle arc to straight-looking routes so overlapping modes stay distinct. */
export function bulgeRoute(points: ProjectedPoint[], mode: TripMode): ProjectedPoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return points;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return points;
  let normalX = -dy / length;
  let normalY = dx / length;
  // Bow upwards (or leftwards for vertical routes) for a calm, consistent look.
  if (normalY > 0.05 || (Math.abs(normalY) <= 0.05 && normalX > 0)) {
    normalX = -normalX;
    normalY = -normalY;
  }
  let existing = 0;
  for (const point of points) {
    const deviation = (point.x - first.x) * normalX + (point.y - first.y) * normalY;
    if (deviation > existing) existing = deviation;
  }
  const bulge = Math.min(110, Math.max(0, ROUTE_BULGE[mode] * length - existing));
  if (!bulge) return points;

  let source = points;
  if (points.length < 24) {
    source = Array.from({ length: 25 }, (_, index) => {
      const t = index / 24;
      const position = t * (points.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(points.length - 1, lower + 1);
      const fraction = position - lower;
      return {
        x: points[lower]!.x + (points[upper]!.x - points[lower]!.x) * fraction,
        y: points[lower]!.y + (points[upper]!.y - points[lower]!.y) * fraction,
      };
    });
  }
  return source.map((point, index) => {
    const t = index / (source.length - 1);
    const offset = Math.sin(Math.PI * t) * bulge;
    return { x: point.x + normalX * offset, y: point.y + normalY * offset };
  });
}

function tracePolyline(context: CanvasRenderingContext2D, points: ProjectedPoint[]) {
  context.beginPath();
  points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
}

function drawArrow(context: CanvasRenderingContext2D, points: ProjectedPoint[], color: string, size: number) {
  if (points.length < 3) return;
  const middle = Math.floor(points.length / 2);
  const before = points[Math.max(0, middle - 1)]!;
  const after = points[Math.min(points.length - 1, middle + 1)]!;
  const at = points[middle]!;
  const angle = Math.atan2(after.y - before.y, after.x - before.x);
  context.save();
  context.translate(at.x, at.y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(size, 0);
  context.lineTo(-size * 0.75, size * 0.8);
  context.lineTo(-size * 0.35, 0);
  context.lineTo(-size * 0.75, -size * 0.8);
  context.closePath();
  context.lineJoin = "round";
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawRoutes(context: CanvasRenderingContext2D, routes: SchematicJourneyRoute[], view: MercatorView, detailed: boolean) {
  const prepared = routes.map((route) => ({
    route,
    points: bulgeRoute(projectMercatorPath(route.coordinates, view), route.mode),
    width: (route.route_pattern === "paired_return" ? 4.6 : 2.8) * (detailed ? 1.12 : 1),
  }));
  context.lineCap = "round";
  context.lineJoin = "round";
  // All halos first so a crossing route never cuts through another route's colour.
  for (const { points, width } of prepared) {
    tracePolyline(context, points);
    context.setLineDash([]);
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.lineWidth = width + 4;
    context.stroke();
  }
  for (const { route, points, width } of prepared) {
    tracePolyline(context, points);
    context.setLineDash(ROUTE_DASH[route.mode]);
    context.strokeStyle = modeColor(route.mode);
    context.lineWidth = width;
    context.stroke();
  }
  context.setLineDash([]);
  for (const { route, points } of prepared) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const length = Math.hypot(last.x - first.x, last.y - first.y);
    if (route.route_pattern === "one_way" && length > 70) drawArrow(context, points, modeColor(route.mode), detailed ? 7 : 6);
  }
}

/* -------------------------------- Stops ---------------------------------- */

type Box = { x: number; y: number; width: number; height: number };

function overlaps(first: Box, second: Box) {
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
}

export function stopLabel(stop: SchematicJourneyStop, language: MapLanguage) {
  const name = language === "zh"
    ? stop.name_zh
    : stop.kind === "airport" ? stop.city || stop.name_en : stop.name_en;
  return { code: stop.code, name };
}

function fitWidth(context: CanvasRenderingContext2D, value: string, width: number) {
  if (context.measureText(value).width <= width) return value;
  let output = "";
  for (const character of value) {
    if (context.measureText(`${output}${character}…`).width > width) break;
    output += character;
  }
  return `${output}…`;
}

function stopRadius(stop: SchematicJourneyStop, detailed: boolean) {
  return (detailed ? 5.5 : 4.6) + Math.min(stop.visits, 5) * 0.75;
}

function drawStops(
  context: CanvasRenderingContext2D,
  stops: SchematicJourneyStop[],
  view: MercatorView,
  options: { detailed: boolean; language: MapLanguage; labelled: Set<string> },
) {
  const frame = view.frame;
  const placed = stops.map((stop) => ({ stop, point: projectMercator(stop.coordinate, view), radius: stopRadius(stop, options.detailed) }))
    .filter(({ point }) => point.x >= frame.x - 4 && point.x <= frame.x + frame.width + 4 && point.y >= frame.y - 4 && point.y <= frame.y + frame.height + 4);

  for (const { stop, point, radius } of placed) {
    context.beginPath();
    context.arc(point.x, point.y, radius + 2.6, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(15, 23, 42, 0.25)";
    context.shadowBlur = 4;
    context.fill();
    context.shadowBlur = 0;
    context.shadowColor = "transparent";
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = stop.country_color;
    context.fill();
  }

  const fontSize = options.detailed ? 16 : 15;
  const obstacles: Box[] = placed.map(({ point, radius }) => ({ x: point.x - radius - 2, y: point.y - radius - 2, width: (radius + 2) * 2, height: (radius + 2) * 2 }));
  const labels: Box[] = [];
  const ordered = [...placed]
    .filter(({ stop }) => options.labelled.has(stop.id))
    .sort((first, second) => second.stop.visits - first.stop.visits || first.stop.name_en.localeCompare(second.stop.name_en));

  for (const { stop, point, radius } of ordered) {
    const { code, name } = stopLabel(stop, options.language);
    setFont(context, fontSize, 800);
    const codeWidth = code ? context.measureText(`${code} `).width : 0;
    setFont(context, fontSize, 600);
    const nameText = fitWidth(context, name, options.detailed ? 230 : 190);
    const width = codeWidth + context.measureText(nameText).width;
    const height = fontSize + 6;
    const gap = radius + 6;
    const candidates: Array<[number, number]> = [
      [point.x + gap, point.y - height / 2],
      [point.x - gap - width, point.y - height / 2],
      [point.x - width / 2, point.y - gap - height],
      [point.x - width / 2, point.y + gap],
      [point.x + gap - 2, point.y - gap - height + 4],
      [point.x + gap - 2, point.y + gap - 4],
      [point.x - gap - width + 2, point.y - gap - height + 4],
      [point.x - gap - width + 2, point.y + gap - 4],
      // Further-out fallbacks for dense city clusters.
      [point.x + gap + 10, point.y + gap + 6],
      [point.x - gap - width - 10, point.y + gap + 6],
      [point.x + gap + 10, point.y - gap - height - 6],
      [point.x - gap - width - 10, point.y - gap - height - 6],
      [point.x - width / 2, point.y + gap + height + 4],
      [point.x - width / 2, point.y - gap - height * 2 - 4],
    ];
    const box = candidates
      .map(([x, y]) => ({ x, y, width, height }))
      .find((candidate) =>
        candidate.x >= frame.x + 6 && candidate.y >= frame.y + 6
        && candidate.x + candidate.width <= frame.x + frame.width - 6 && candidate.y + candidate.height <= frame.y + frame.height - 6
        && !labels.some((label) => overlaps(label, candidate))
        && !obstacles.some((obstacle) => overlaps(obstacle, candidate)));
    if (!box) continue;
    labels.push(box);

    const baseline = box.y + height / 2;
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.lineJoin = "round";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(255, 255, 255, 0.94)";
    if (code) {
      setFont(context, fontSize, 800);
      context.strokeText(code, box.x, baseline);
      context.fillStyle = stop.country_color;
      context.fillText(code, box.x, baseline);
    }
    setFont(context, fontSize, 600);
    context.strokeText(nameText, box.x + codeWidth, baseline);
    context.fillStyle = INK;
    context.fillText(nameText, box.x + codeWidth, baseline);
  }
}

/* ----------------------------- Decorations ------------------------------- */

function drawScaleBar(context: CanvasRenderingContext2D, view: MercatorView) {
  const frame = view.frame;
  const latitude = latitudeAtY(frame.y + frame.height / 2, view);
  const kmPerPixel = kilometresPerPixel(view, latitude);
  const target = 110 * kmPerPixel;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const kilometres = [1, 2, 5, 10].map((factor) => factor * magnitude).filter((value) => value <= target).pop() ?? magnitude;
  const width = kilometres / kmPerPixel;
  const label = `${new Intl.NumberFormat("en-GB").format(kilometres)} km`;
  const x = frame.x + 18;
  const y = frame.y + frame.height - 18;
  setFont(context, 12, 700);
  const boxWidth = Math.max(width, context.measureText(label).width) + 20;
  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  roundedRectPath(context, x - 10, y - 30, boxWidth, 38, 9);
  context.fill();
  context.strokeStyle = "#334155";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y - 9);
  context.lineTo(x, y - 4);
  context.lineTo(x + width, y - 4);
  context.lineTo(x + width, y - 9);
  context.stroke();
  context.fillStyle = "#334155";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(label, x, y - 14);
}

export function drawRegionBadge(context: CanvasRenderingContext2D, x: number, y: number, label: string, radius = 13) {
  context.beginPath();
  context.arc(x, y, radius + 2, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = INK;
  context.fill();
  setFont(context, radius * 1.1, 800);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x, y + 0.5);
}

function drawRegionOutlines(context: CanvasRenderingContext2D, regions: FootprintRegion[], view: MercatorView) {
  regions.forEach((region, index) => {
    const points = region.stops.map((stop) => projectMercator(stop.coordinate, view));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const width = Math.max(44, Math.max(...xs) - Math.min(...xs) + 36);
    const height = Math.max(44, Math.max(...ys) - Math.min(...ys) + 36);
    const x = centerX - width / 2;
    const y = centerY - height / 2;
    context.save();
    context.setLineDash([6, 5]);
    context.strokeStyle = "rgba(15, 23, 42, 0.6)";
    context.lineWidth = 1.6;
    roundedRectPath(context, x, y, width, height, 12);
    context.stroke();
    context.restore();
    drawRegionBadge(context, x, y, String(index + 1), 12);
  });
}

/* ------------------------------- Public ---------------------------------- */

export type MapPanelOptions = {
  view: MercatorView;
  basemap: WorldBasemap | null;
  visited: Map<BasemapCountry, string>;
  routes: SchematicJourneyRoute[];
  stops: SchematicJourneyStop[];
  language: MapLanguage;
  detailed: boolean;
  /** Stop IDs that may receive a text label (collisions are still skipped). */
  labelled: Set<string>;
  regions?: FootprintRegion[];
  radius?: number;
};

/** Draws one complete, clipped map panel: ocean, land, routes, stops and labels. */
export function drawMapPanel(context: CanvasRenderingContext2D, options: MapPanelOptions) {
  const { view } = options;
  const frame = view.frame;
  const radius = options.radius ?? 20;

  context.save();
  roundedRectPath(context, frame.x, frame.y, frame.width, frame.height, radius);
  context.clip();

  const ocean = context.createLinearGradient(0, frame.y, 0, frame.y + frame.height);
  ocean.addColorStop(0, OCEAN_TOP);
  ocean.addColorStop(1, OCEAN_BOTTOM);
  context.fillStyle = ocean;
  context.fillRect(frame.x, frame.y, frame.width, frame.height);

  drawGraticule(context, view);
  if (options.basemap?.countries.length) drawCountries(context, view, options.basemap.countries, options.visited, options.detailed);
  else drawSchematicLand(context, view);

  if (options.regions?.length) drawRegionOutlines(context, options.regions, view);
  drawRoutes(context, options.routes, view, options.detailed);
  drawStops(context, options.stops, view, { detailed: options.detailed, language: options.language, labelled: options.labelled });
  drawScaleBar(context, view);
  context.restore();

  context.strokeStyle = "#c5d6e2";
  context.lineWidth = 1;
  roundedRectPath(context, frame.x, frame.y, frame.width, frame.height, radius);
  context.stroke();
}

/** Short legend sample of a route line in its mode style. */
export function drawRouteLegendSample(context: CanvasRenderingContext2D, mode: TripMode, x: number, y: number, length = 30) {
  context.lineCap = "round";
  context.setLineDash([]);
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.lineWidth = 7;
  context.beginPath(); context.moveTo(x, y); context.lineTo(x + length, y); context.stroke();
  context.setLineDash(ROUTE_DASH[mode]);
  context.strokeStyle = modeColor(mode);
  context.lineWidth = 3.4;
  context.beginPath(); context.moveTo(x, y); context.lineTo(x + length, y); context.stroke();
  context.setLineDash([]);
}

