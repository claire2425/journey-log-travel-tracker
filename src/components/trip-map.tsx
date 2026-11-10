"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { modeColor } from "@/lib/journey-colors";
import { createJourneyMapData, type JourneyMapData } from "@/lib/map-data";
import type { Trip } from "@/lib/types";

type Language = "zh" | "en";

type TripMapProps = {
  language: Language;
  trips: Trip[];
};

const ROUTE_SOURCE = "journey-routes";
const STOP_SOURCE = "journey-stops";

const countryLabels: Record<string, Record<Language, string>> = {
  Taiwan: { zh: "台灣", en: "Taiwan" },
  Japan: { zh: "日本", en: "Japan" },
  "United Kingdom": { zh: "英國", en: "United Kingdom" },
  France: { zh: "法國", en: "France" },
};

function countryLabel(country: string, language: Language) {
  return countryLabels[country]?.[language] ?? country;
}

function updateSource(map: maplibregl.Map, sourceId: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId);
  if (source?.type === "geojson") (source as maplibregl.GeoJSONSource).setData(data);
}

function fitToJourneys(map: maplibregl.Map, mapData: JourneyMapData) {
  if (mapData.coordinates.length === 0) {
    map.flyTo({ center: [20, 26], zoom: 1.2, duration: 450 });
    return;
  }

  const bounds = new maplibregl.LngLatBounds(mapData.coordinates[0], mapData.coordinates[0]);
  for (const coordinate of mapData.coordinates.slice(1)) bounds.extend(coordinate);
  map.fitBounds(bounds, { padding: 64, duration: 650, maxZoom: 4.5 });
}

function routePopupText(properties: Record<string, unknown>, language: Language) {
  const origin = properties[language === "zh" ? "origin_zh" : "origin_en"];
  const destination = properties[language === "zh" ? "destination_zh" : "destination_en"];
  const date = properties.date;
  return `${String(origin)} → ${String(destination)}\n${String(date)}`;
}

function stopPopupText(properties: Record<string, unknown>, language: Language) {
  const name = properties[language === "zh" ? "name_zh" : "name_en"];
  const country = String(properties.country ?? "");
  const visits = Number(properties.visits ?? 0);
  const visitLabel = language === "zh" ? `${visits} 次使用` : `${visits} journey${visits === 1 ? "" : "s"}`;
  const countryLine = country ? `${language === "zh" ? "國家／地區" : "Country / region"}: ${countryLabel(country, language)}\n` : "";
  return `${String(name)} (${String(properties.code)})\n${countryLine}${visitLabel}`;
}

export function TripMap({ language, trips }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapData = useMemo(() => createJourneyMapData(trips), [trips]);
  const mapDataRef = useRef(mapData);
  const languageRef = useRef(language);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  useEffect(() => {
    mapDataRef.current = mapData;
  }, [mapData]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const fitVisibleJourneys = useCallback(() => {
    if (!mapRef.current) return;
    fitToJourneys(mapRef.current, mapDataRef.current);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let removed = false;
    const container = containerRef.current;
    let map: maplibregl.Map;

    try {
      map = new maplibregl.Map({
        container,
        center: [20, 26],
        zoom: 1.2,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            "open-street-map": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "open-street-map", type: "raster", source: "open-street-map" }],
        },
      });
    } catch {
      window.setTimeout(() => setMapUnavailable(true), 0);
      return;
    }
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("load", () => {
      if (removed) return;
      const loadedMapData = mapDataRef.current;
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: loadedMapData.routes });
      map.addSource(STOP_SOURCE, { type: "geojson", data: loadedMapData.stops });
      map.addLayer({
        id: "journey-route-outline",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.88 },
      });
      map.addLayer({
        id: "journey-routes",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": 3,
          "line-opacity": 0.9,
          "line-color": [
            "match",
            ["get", "mode"],
            "flight", modeColor("flight"),
            "hsr", modeColor("hsr"),
            "rail", modeColor("rail"),
            modeColor("other"),
          ],
        },
      });
      map.addLayer({
        id: "journey-stops-halo",
        type: "circle",
        source: STOP_SOURCE,
        paint: { "circle-radius": 8, "circle-color": "#ffffff", "circle-opacity": 0.96 },
      });
      map.addLayer({
        id: "journey-stops",
        type: "circle",
        source: STOP_SOURCE,
        paint: { "circle-radius": 5, "circle-color": ["get", "country_color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 },
      });
      map.addLayer({
        id: "journey-stop-labels",
        type: "symbol",
        source: STOP_SOURCE,
        minzoom: 2.2,
        layout: { "text-field": ["get", "code"], "text-size": 11, "text-offset": [0, 1.15], "text-anchor": "top", "text-allow-overlap": false },
        paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
      });

      map.on("click", "journey-routes", (event) => {
        const properties = event.features?.[0]?.properties;
        if (!properties) return;
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(event.lngLat)
          .setText(routePopupText(properties, languageRef.current))
          .addTo(map);
      });
      map.on("click", "journey-stops", (event) => {
        const properties = event.features?.[0]?.properties;
        if (!properties) return;
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(event.lngLat)
          .setText(stopPopupText(properties, languageRef.current))
          .addTo(map);
      });
      for (const layerId of ["journey-routes", "journey-stops"]) {
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      }
      fitToJourneys(map, loadedMapData);
    });

    return () => {
      removed = true;
      mapRef.current = null;
      resizeObserver.disconnect();
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateSource(map, ROUTE_SOURCE, mapData.routes);
    updateSource(map, STOP_SOURCE, mapData.stops);
  }, [mapData]);

  if (mapUnavailable) {
    return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900"><h3 className="text-lg font-bold">{language === "zh" ? "這個瀏覽器無法顯示互動地圖" : "This browser cannot display the interactive map"}</h3><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">{language === "zh" ? "請以最新版 Chrome、Safari、Firefox 或 Edge 開啟；你的旅程資料仍只會保留在此裝置。" : "Try the latest Chrome, Safari, Firefox, or Edge. Your journey data will remain on this device."}</p></div>;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <p className="text-sm text-slate-500">{language === "zh" ? "路線與站點會隨目前的篩選條件更新。" : "Routes and stops follow the current filters."}</p>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-teal-600 hover:text-teal-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-teal-300 dark:hover:text-teal-200" onClick={fitVisibleJourneys} type="button">
          {language === "zh" ? "框選所有足跡" : "Fit all journeys"}
        </button>
      </div>
      <div aria-label={language === "zh" ? "旅程地圖" : "Journey map"} className="h-[420px] w-full sm:h-[520px]" ref={containerRef} />
      <div className="space-y-2 px-5 py-3 text-xs font-medium text-slate-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-bold text-slate-700 dark:text-slate-200">{language === "zh" ? "路線／交通方式" : "Routes / transport"}</span>
          {(["flight", "hsr", "rail", "other"] as const).map((mode) => <span className="flex items-center gap-2" key={mode}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: modeColor(mode) }} />{language === "zh" ? { flight: "飛行", hsr: "高鐵", rail: "鐵路", other: "其他" }[mode] : { flight: "Flight", hsr: "High-speed rail", rail: "Rail", other: "Other" }[mode]}</span>)}
        </div>
        {mapData.countryLegend.length > 0 ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-bold text-slate-700 dark:text-slate-200">{language === "zh" ? "站點／國家或地區" : "Stops / country or region"}</span>
          {mapData.countryLegend.map((entry) => <span className="flex items-center gap-2" key={entry.country}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />{countryLabel(entry.country, language)}</span>)}
        </div> : null}
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800">{language === "zh" ? "地圖底圖來自 OpenStreetMap；旅程資料仍只保留在這個瀏覽器，並不會上傳。" : "Basemap © OpenStreetMap contributors. Your journey records stay in this browser and are not uploaded."}</p>
    </div>
  );
}
