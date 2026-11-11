"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Language = "zh" | "en";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type PwaInstallProps = {
  className?: string;
  language?: Language;
};

type BrowserEnvironment = {
  isIos: boolean;
  isSafari: boolean;
};

const copy = {
  zh: {
    add: "安裝 Journey Log",
    body: "安裝後可像 App 一樣從手機主畫面開啟，也能在暫時離線時查看已開啟過的頁面。",
    cancel: "關閉說明",
    iosBody: "iPhone 或 iPad 請在 Safari 開啟此頁後，依下列步驟加入主畫面。",
    iosChromeBody: "請改用 Safari 開啟此頁，再依下列步驟加入主畫面。",
    iosStepOne: "點選瀏覽器底部或上方的「分享」按鈕。",
    iosStepTwo: "選擇「加入主畫面」。",
    iosStepThree: "確認名稱後，點選「加入」。",
    iosTitle: "加入 iPhone／iPad 主畫面",
    openInstructions: "查看加入方式",
  },
  en: {
    add: "Install Journey Log",
    body: "Open it from your home screen like an app and revisit pages you have already opened when temporarily offline.",
    cancel: "Close instructions",
    iosBody: "On an iPhone or iPad, open this page in Safari and add it to your home screen.",
    iosChromeBody: "Open this page in Safari, then add it to your home screen with the steps below.",
    iosStepOne: "Select the Share button in Safari.",
    iosStepTwo: "Choose Add to Home Screen.",
    iosStepThree: "Confirm the name, then select Add.",
    iosTitle: "Add to iPhone or iPad home screen",
    openInstructions: "Show installation steps",
  },
} as const;

const serverBrowserEnvironment: BrowserEnvironment = {
  isIos: false,
  isSafari: false,
};

let browserEnvironment: BrowserEnvironment | undefined;

function isInstalled() {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function getBrowserEnvironment() {
  if (typeof window === "undefined") {
    return serverBrowserEnvironment;
  }

  if (browserEnvironment) {
    return browserEnvironment;
  }

  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);

  browserEnvironment = { isIos, isSafari };
  return browserEnvironment;
}

function subscribeToInstallationStatus(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);

  return () => {
    displayMode.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

function getInstallationStatus() {
  return typeof window !== "undefined" && isInstalled();
}

function subscribeToNothing() {
  return () => undefined;
}

export function PwaInstall({ className = "", language }: PwaInstallProps) {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installationAccepted, setInstallationAccepted] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const environment = useSyncExternalStore(
    subscribeToNothing,
    getBrowserEnvironment,
    () => serverBrowserEnvironment,
  );
  const installedInBrowser = useSyncExternalStore(subscribeToInstallationStatus, getInstallationStatus, () => false);
  const installed = installationAccepted || installedInBrowser;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setCanInstall(!isInstalled());
    };
    const onAppInstalled = () => {
      deferredPrompt.current = null;
      setCanInstall(false);
      setInstallationAccepted(true);
      setShowIosInstructions(false);
    };

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch(() => undefined);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const labels = copy[language ?? "zh"];

  async function install() {
    const prompt = deferredPrompt.current;

    if (!prompt) {
      return;
    }

    await prompt.prompt();
    const choice = await prompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallationAccepted(true);
    }

    deferredPrompt.current = null;
    setCanInstall(false);
  }

  if (installed || (!canInstall && !environment.isIos)) {
    return null;
  }

  return (
    <aside
      aria-label={labels.add}
      className={`rounded-xl border border-teal-200 bg-teal-50 p-4 text-slate-800 shadow-sm dark:border-teal-900 dark:bg-slate-900 dark:text-slate-100 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="font-bold">{labels.add}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{environment.isIos ? (environment.isSafari ? labels.iosBody : labels.iosChromeBody) : labels.body}</p>
        </div>
        {canInstall ? (
          <button
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={() => void install()}
            type="button"
          >
            {labels.add}
          </button>
        ) : (
          <button
            aria-expanded={showIosInstructions}
            className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 transition hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
            onClick={() => setShowIosInstructions((visible) => !visible)}
            type="button"
          >
            {showIosInstructions ? labels.cancel : labels.openInstructions}
          </button>
        )}
      </div>

      {environment.isIos && showIosInstructions ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
          <p className="font-bold">{labels.iosTitle}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600 dark:text-slate-300">
            <li>{labels.iosStepOne}</li>
            <li>{labels.iosStepTwo}</li>
            <li>{labels.iosStepThree}</li>
          </ol>
        </div>
      ) : null}
    </aside>
  );
}
