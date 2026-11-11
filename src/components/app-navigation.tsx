"use client";

import Link from "next/link";
import { CloudSync } from "@/components/cloud-sync";
import { PwaInstall } from "@/components/pwa-install";

type Language = "zh" | "en";

type AppNavigationProps = {
  current: "journeys" | "expenses";
  language: Language;
};

export function AppNavigation({ current, language }: AppNavigationProps) {
  const labels = language === "zh"
    ? { journeys: "旅行足跡", expenses: "旅伴記帳" }
    : { journeys: "Journey log", expenses: "Travel split" };

  const linkClass = (active: boolean) => `rounded-lg px-3 py-2 text-sm font-bold transition ${active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"}`;

  return <div className="flex flex-wrap items-start justify-between gap-3">
    <nav aria-label={language === "zh" ? "主要導覽" : "Main navigation"} className="flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <Link className={linkClass(current === "journeys")} href="/">{labels.journeys}</Link>
      <Link className={linkClass(current === "expenses")} href="/expenses">{labels.expenses}</Link>
    </nav>
    <CloudSync language={language} />
    <PwaInstall className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl" language={language} />
  </div>;
}
