"use client";

import { useState } from "react";
import { formatMoneyFromMinorUnits } from "@/lib/money";
import { downloadExpenseReportPng, reportChartColors, type ReportLanguage } from "@/lib/report-png";
import type { ExpenseStatistics } from "@/lib/expense-statistics";

const labels = {
  zh: {
    eyebrow: "SPENDING ANALYSIS",
    title: "支出分析",
    body: "所有圖表只使用每筆已確認的最後結算金額；原始付款幣別不會混加在一起。",
    unavailable: "完成所有帳目的匯率確認後，才會顯示完整圖表並開放下載 PNG，避免把不同幣別或不完整資料混在一起。",
    total: "總支出",
    categories: "依類別總支出",
    categoryHint: "各類別占最後結算總額的比例",
    paidByPerson: "各旅伴實際先付",
    paidHint: "此圖顯示誰先替大家付款；「自己分攤」才是每人最後應負擔的金額。",
    paid: "實際先付",
    share: "自己分攤",
    net: "結算差額",
    receive: "應收",
    owe: "應付",
    balanced: "已平衡",
    exportTitle: "分享記帳摘要",
    exportBody: "包含類別圓餅圖、每位旅伴的付款與分攤，以及最後轉帳建議。圖片只會在這個瀏覽器產生。",
    download: "下載記帳 PNG",
    downloading: "正在產生 PNG⋯",
    done: "圖片已產生，瀏覽器會開始下載。",
    failed: "無法產生圖片，請再試一次。",
  },
  en: {
    eyebrow: "SPENDING ANALYSIS",
    title: "Spending analysis",
    body: "Every chart uses confirmed final-settlement amounts only; original payment currencies are never mixed together.",
    unavailable: "Confirm a rate for every expense before showing charts or enabling PNG export, so different currencies and incomplete data are never mixed.",
    total: "Total spent",
    categories: "Spending by category",
    categoryHint: "Each category's share of the final settlement total",
    paidByPerson: "Paid up front by traveller",
    paidHint: "This shows who initially paid for the group. Personal share is what each person finally bears.",
    paid: "Paid up front",
    share: "Personal share",
    net: "Settlement balance",
    receive: "Receives",
    owe: "Owes",
    balanced: "Balanced",
    exportTitle: "Share the expense recap",
    exportBody: "Includes the category pie chart, every traveller's paid and shared amounts, and the final transfer plan. The image is made in this browser only.",
    download: "Download expense PNG",
    downloading: "Creating PNG…",
    done: "Image created; your browser will start the download.",
    failed: "The image could not be created. Please try again.",
  },
} as const;

function pieGradient(statistics: ExpenseStatistics) {
  let position = 0;
  const stops = statistics.categories.map((category, index) => {
    const next = position + (category.amount_minor / statistics.total_spent_minor) * 100;
    const stop = `${reportChartColors[index % reportChartColors.length] ?? "#64748b"} ${position}% ${next}%`;
    position = next;
    return stop;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function ExpenseAnalytics({ language, statistics }: { language: ReportLanguage; statistics: ExpenseStatistics | null }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const c = labels[language];
  const money = (amount: number) => statistics ? formatMoneyFromMinorUnits(amount, statistics.currency, statistics.fraction_digits, language) : "";
  const maxPaid = statistics ? Math.max(...statistics.members.map((member) => member.paid_minor), 1) : 1;

  async function download() {
    if (!statistics || isDownloading) return;
    setIsDownloading(true);
    setMessage("");
    try {
      await downloadExpenseReportPng(statistics, language);
      setMessage(c.done);
    } catch {
      setMessage(c.failed);
    } finally {
      setIsDownloading(false);
    }
  }

  return <section className="mt-8 rounded-3xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30" aria-labelledby="expense-analytics-title">
    <p className="text-xs font-bold tracking-[0.18em] text-teal-700 dark:text-teal-300">{c.eyebrow}</p>
    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white" id="expense-analytics-title">{c.title}</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{c.body}</p>

    {!statistics ? <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{c.unavailable}</p> : <>
      <div className="mt-5 rounded-2xl border border-teal-200 bg-white px-5 py-4 dark:border-teal-900 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">{statistics.currency}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{c.total}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{money(statistics.total_spent_minor)}</p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-bold">{c.categories}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{c.categoryHint}</p>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div aria-label={c.categories} className="relative mx-auto h-44 w-44 shrink-0 rounded-full" role="img" style={{ background: pieGradient(statistics) }}>
              <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white text-center dark:bg-slate-900"><span className="text-lg font-bold leading-tight">{money(statistics.total_spent_minor)}</span><span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{c.total}</span></div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {statistics.categories.map((category, index) => <li className="flex items-start justify-between gap-3 text-sm" key={category.category}><span className="flex min-w-0 items-center gap-2 font-semibold"><span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: reportChartColors[index % reportChartColors.length] }} /><span className="truncate">{category.category}</span></span><span className="shrink-0 text-right text-slate-600 dark:text-slate-300">{money(category.amount_minor)}<br /><span className="text-xs">{((category.amount_minor / statistics.total_spent_minor) * 100).toLocaleString(language === "zh" ? "zh-TW" : "en-GB", { maximumFractionDigits: 1 })}%</span></span></li>)}
            </ul>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-bold">{c.paidByPerson}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{c.paidHint}</p>
          <div className="mt-5 space-y-4">
            {statistics.members.map((member) => {
              const balanceLabel = member.net_minor > 0 ? c.receive : member.net_minor < 0 ? c.owe : c.balanced;
              const balanceColor = member.net_minor > 0 ? "text-teal-700 dark:text-teal-300" : member.net_minor < 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-500";
              const width = member.paid_minor > 0 ? Math.max(4, (member.paid_minor / maxPaid) * 100) : 0;
              return <div key={member.member_id}><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{member.name}</span><span className="font-semibold text-slate-600 dark:text-slate-300">{money(member.paid_minor)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} /></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className="text-slate-500">{c.share}: {money(member.share_minor)}</span><span className={`font-bold ${balanceColor}`}>{balanceLabel} {money(Math.abs(member.net_minor))}</span></div></div>;
            })}
          </div>
        </article>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-teal-200 bg-white p-5 dark:border-teal-900 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-bold">{c.exportTitle}</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{c.exportBody}</p></div>
        <button className="shrink-0 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60" disabled={isDownloading} onClick={() => void download()} type="button">{isDownloading ? c.downloading : c.download}</button>
      </div>
    </>}
    <p aria-live="polite" className="mt-4 min-h-5 text-sm font-medium text-teal-800 dark:text-teal-200">{message}</p>
  </section>;
}
