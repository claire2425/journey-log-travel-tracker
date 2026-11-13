"use client";

import { useState } from "react";
import { modeColor } from "@/lib/journey-colors";
import { downloadTravelRecapPng, type ReportLanguage } from "@/lib/report-png";
import type { TravelRecap } from "@/lib/travel-recap";
import type { Trip } from "@/lib/types";

const labels = {
  zh: {
    eyebrow: "PNG REPORT",
    title: "下載旅行分析圖片",
    body: "以目前搜尋與篩選後的旅程製作一張易讀摘要，包含自動縮放到你去過範圍的足跡地圖（密集地區另附放大圖）、距離、交通方式與年度足跡。圖片只會在這個瀏覽器產生。",
    scope: "目前篩選結果",
    journeys: "趟旅程",
    download: "下載 PNG",
    downloading: "正在產生 PNG⋯",
    done: "圖片已產生，瀏覽器會開始下載。",
    failed: "無法產生圖片，請再試一次。",
    disabled: "新增或顯示至少一趟旅程後，即可下載分析圖片。",
    modeDistance: "距離",
  },
  en: {
    eyebrow: "PNG REPORT",
    title: "Download travel analysis",
    body: "Create a readable snapshot of the journeys in the current search and filters, including a footprint map that zooms to where you have been (with close-ups of busy regions), distance, travel modes, and yearly footprint. The image is made in this browser only.",
    scope: "Current results",
    journeys: "journeys",
    download: "Download PNG",
    downloading: "Creating PNG…",
    done: "Image created; your browser will start the download.",
    failed: "The image could not be created. Please try again.",
    disabled: "Add or show at least one journey before downloading an analysis image.",
    modeDistance: "Distance",
  },
} as const;

const modeLabels: Record<ReportLanguage, Record<TravelRecap["modes"][number]["mode"], string>> = {
  zh: { flight: "飛行", rail: "火車／高鐵", cruise: "郵輪", other: "其他" },
  en: { flight: "Flight", rail: "Rail / high-speed rail", cruise: "Cruise", other: "Other" },
};

export function TravelRecapExport({ language, recap, trips }: { language: ReportLanguage; recap: TravelRecap; trips: Trip[] }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const c = labels[language];
  const canDownload = recap.total_journeys > 0;
  const modes = recap.modes.filter((mode) => mode.distance_km > 0);
  const maxDistance = Math.max(...modes.map((mode) => mode.distance_km), 1);

  async function download() {
    if (!canDownload || isDownloading) return;
    setIsDownloading(true);
    setMessage("");
    try {
      await downloadTravelRecapPng(recap, trips, language);
      setMessage(c.done);
    } catch {
      setMessage(c.failed);
    } finally {
      setIsDownloading(false);
    }
  }

  return <section className="mt-8 rounded-3xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30" aria-labelledby="travel-recap-export-title">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-teal-700 dark:text-teal-300">{c.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white" id="travel-recap-export-title">{c.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{c.body}</p>
      </div>
      <div className="shrink-0 lg:text-right">
        <p className="text-sm font-bold text-teal-900 dark:text-teal-100">{c.scope} · {recap.total_journeys} {c.journeys}</p>
        <button className="mt-3 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={!canDownload || isDownloading} onClick={() => void download()} type="button">{isDownloading ? c.downloading : c.download}</button>
      </div>
    </div>

    {canDownload && modes.length ? <div className="mt-5 border-t border-teal-200 pt-4 dark:border-teal-900">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{c.modeDistance}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {modes.map((mode) => <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/80" key={mode.mode}>
          <div className="flex justify-between gap-3 text-sm"><span className="font-bold" style={{ color: modeColor(mode.mode) }}>{modeLabels[language][mode.mode]}</span><span className="font-semibold text-slate-600 dark:text-slate-300">{Math.round(mode.distance_km).toLocaleString(language === "zh" ? "zh-TW" : "en-GB")} km</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full" style={{ backgroundColor: modeColor(mode.mode), width: `${Math.max(3, (mode.distance_km / maxDistance) * 100)}%` }} /></div>
        </div>)}
      </div>
    </div> : null}
    <p aria-live="polite" className="mt-4 min-h-5 text-sm font-medium text-teal-800 dark:text-teal-200">{message || (!canDownload ? c.disabled : "")}</p>
  </section>;
}
