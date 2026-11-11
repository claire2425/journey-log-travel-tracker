"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  discardPendingCloudChange,
  fetchCloudSyncSnapshot,
  forcePushCloudChange,
  prepareCloudSync,
  syncCloudData,
  cloudSyncStatus,
  type CloudSyncConflict,
  type CloudSyncSnapshot,
} from "@/lib/cloud-sync";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  CLOUD_SYNC_NEEDED_EVENT,
  getCloudSyncProfile,
  pauseCloudSync,
} from "@/db/sync";

type Language = "zh" | "en";

type CloudSyncProps = {
  language: Language;
};

type RemoteSummary = {
  total: number;
  hasRemoteData: boolean;
};

const copy = {
  zh: {
    accountMismatch: "這個瀏覽器保留了另一個帳號的離線資料。為保護資料，請使用原帳號登入，或先在另一個瀏覽器設定新帳號。",
    cloud: "私有同步",
    conflict: "需要確認",
    conflictBody: "同一筆資料在另一台裝置也被修改。兩個版本都尚未自動覆蓋。請選擇要保留的版本。",
    continueSetup: "開始安全同步",
    code: "驗證碼",
    codePlaceholder: "輸入 Email 裡的驗證碼",
    codeSent: "驗證碼已寄出。請留在這個 App，輸入 Email 裡的驗證碼完成登入。",
    email: "Email",
    emailPlaceholder: "you@example.com",
    firstSync: "第一次同步會比較這台裝置與雲端的資料；同一筆旅程或帳目會以較新的修改時間為準。任何無法安全自動處理的變更都會保留，讓你決定。",
    getCode: "寄送登入驗證碼",
    keepCloud: "使用雲端版本",
    keepDevice: "保留這台裝置版本",
    localOnly: "尚未設定雲端同步",
    loggedIn: "已登入私有同步",
    logout: "登出",
    noRemote: "雲端目前沒有資料，會先安全上傳這台裝置的非示範紀錄。",
    offline: "目前離線；你的變更會先保留在此裝置，恢復連線後再同步。",
    pending: "筆變更等待同步",
    remoteFound: "雲端已有資料，第一次同步會安全合併兩端的紀錄。",
    resume: "繼續同步",
    sendFailed: "無法寄送登入連結，請確認 Email 與雲端設定。",
    signedOut: "已登出；這台裝置的離線副本仍保留，不會再上傳，直到你以同一帳號重新啟用同步。",
    syncing: "正在同步⋯",
    syncNow: "立即同步",
    synced: "已同步",
    syncFailed: "暫時無法同步。資料仍安全保留在這台裝置，請恢復連線後再試。",
    verifyCode: "驗證並登入",
    verifyFailed: "驗證碼無效或已過期，請重新寄送。",
  },
  en: {
    accountMismatch: "This browser keeps an offline copy for a different account. To protect data, sign in with that account or set up the new account in another browser.",
    cloud: "Private sync",
    conflict: "Review needed",
    conflictBody: "The same record changed on another device. Neither version was overwritten automatically; choose which version to keep.",
    continueSetup: "Start safe sync",
    code: "Verification code",
    codePlaceholder: "Enter the code from your email",
    codeSent: "A sign-in code was sent. Stay in this app and enter the code from your email to finish signing in.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    firstSync: "First sync compares this device with the cloud. For the same journey or expense, the newer edit is used; anything that cannot be handled safely stays for you to decide.",
    getCode: "Email sign-in code",
    keepCloud: "Use cloud version",
    keepDevice: "Keep this device version",
    localOnly: "Cloud sync is not set up",
    loggedIn: "Signed in to private sync",
    logout: "Sign out",
    noRemote: "The cloud is empty, so non-sample records from this device will be uploaded safely first.",
    offline: "You are offline. Changes stay on this device and sync when a connection returns.",
    pending: "change(s) waiting to sync",
    remoteFound: "Cloud data found. The first sync will safely merge both copies.",
    resume: "Resume sync",
    sendFailed: "Could not send a sign-in code. Check the email address and cloud setup.",
    signedOut: "Signed out. This device's offline copy remains here and will not upload until you re-enable sync with the same account.",
    syncing: "Syncing…",
    syncNow: "Sync now",
    synced: "Synced",
    syncFailed: "Sync is temporarily unavailable. Your data remain safely on this device; reconnect and try again.",
    verifyCode: "Verify and sign in",
    verifyFailed: "That code is invalid or expired. Request a new one.",
  },
} as const;

function summariseSnapshot(snapshot: CloudSyncSnapshot): RemoteSummary {
  const total = snapshot.trips.filter((record) => !record.deleted_at).length
    + snapshot.custom_places.filter((record) => !record.deleted_at).length
    + snapshot.expense_settings.filter((record) => !record.deleted_at).length
    + snapshot.expense_entries.filter((record) => !record.deleted_at).length;
  return { total, hasRemoteData: total > 0 };
}

function shortRecordName(conflict: CloudSyncConflict, language: Language): string {
  const labels: Record<CloudSyncConflict["outbox"]["entity"], Record<Language, string>> = {
    trip: { zh: "旅程", en: "journey" },
    custom_place: { zh: "地點", en: "place" },
    expense_settings: { zh: "帳本設定", en: "ledger settings" },
    expense: { zh: "帳目", en: "expense" },
  };
  return `${labels[conflict.outbox.entity][language]} · ${conflict.outbox.record_id}`;
}

function subscribeToSupabaseConfiguration() {
  return () => undefined;
}

/**
 * Login and sync UI. It is intentionally hidden until public Supabase browser
 * variables are supplied, so a local-only installation never looks broken.
 */
export function CloudSync({ language }: CloudSyncProps) {
  const client = useSyncExternalStore<SupabaseClient | undefined>(
    subscribeToSupabaseConfiguration,
    getSupabaseBrowserClient,
    () => undefined,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<RemoteSummary>();
  const [enabled, setEnabled] = useState(false);
  const [accountMismatch, setAccountMismatch] = useState(false);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<CloudSyncConflict[]>([]);
  const syncing = useRef(false);
  const c = copy[language];

  const updateStatus = useCallback(async () => {
    const current = await cloudSyncStatus();
    setEnabled(Boolean(current.profile?.enabled));
    setPending(current.pending);
    return current;
  }, []);

  const syncNow = useCallback(async () => {
    if (!client || !session || syncing.current || !navigator.onLine) {
      if (typeof navigator !== "undefined" && !navigator.onLine) setStatus(c.offline);
      return;
    }
    const profile = await getCloudSyncProfile();
    if (!profile?.enabled || profile.owner_id !== session.user.id) return;

    syncing.current = true;
    setBusy(true);
    setStatus(c.syncing);
    let shouldRetry = false;
    try {
      const result = await syncCloudData(client, session.user.id);
      setConflicts(result.conflicts);
      setPending(result.pending);
      setStatus(result.conflicts.length ? c.conflict : c.synced);
      shouldRetry = result.pending > 0 && result.conflicts.length === 0;
    } catch {
      setStatus(c.syncFailed);
    } finally {
      syncing.current = false;
      setBusy(false);
      if (shouldRetry) {
        window.setTimeout(() => window.dispatchEvent(new Event(CLOUD_SYNC_NEEDED_EVENT)), 0);
      }
    }
  }, [c.conflict, c.offline, c.synced, c.syncFailed, c.syncing, client, session]);

  const inspectAccount = useCallback(async (activeSession: Session) => {
    const local = await updateStatus();
    if (local.profile && local.profile.owner_id !== activeSession.user.id) {
      setAccountMismatch(true);
      return;
    }
    setAccountMismatch(false);
    if (local.profile?.enabled) {
      void syncNow();
      return;
    }
    try {
      const activeClient = getSupabaseBrowserClient();
      if (!activeClient) return;
      setSummary(summariseSnapshot(await fetchCloudSyncSnapshot(activeClient)));
    } catch {
      setStatus(c.syncFailed);
    }
  }, [c.syncFailed, syncNow, updateStatus]);

  useEffect(() => {
    if (!client) return;

    let subscribed = true;
    void client.auth.getSession().then(({ data }) => {
      if (subscribed) setSession(data.session);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (subscribed) setSession(nextSession);
    });
    return () => {
      subscribed = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!session) {
      const reset = window.setTimeout(() => {
        setEnabled(false);
        setSummary(undefined);
        setConflicts([]);
        setAccountMismatch(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    const inspection = window.setTimeout(() => { void inspectAccount(session); }, 0);
    return () => window.clearTimeout(inspection);
  }, [inspectAccount, session]);

  useEffect(() => {
    const onSyncNeeded = () => { void syncNow(); };
    const onOnline = () => { void syncNow(); };
    const onFocus = () => { void syncNow(); };
    window.addEventListener(CLOUD_SYNC_NEEDED_EVENT, onSyncNeeded);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(CLOUD_SYNC_NEEDED_EVENT, onSyncNeeded);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncNow]);

  async function sendSignInCode() {
    if (!client || !email.trim()) return;
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        // The Supabase Magic Link template is configured to emit {{ .Token }}.
        // An in-app OTP works in an installed iOS PWA, whose storage is separate
        // from the Safari tab that opens an email link.
        options: { shouldCreateUser: true },
      });
      if (error) {
        setStatus(c.sendFailed);
        return;
      }
      setVerificationCode("");
      setCodeSent(true);
      setStatus(c.codeSent);
    } catch {
      setStatus(c.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  async function verifySignInCode() {
    if (!client || !email.trim() || !verificationCode.trim()) return;
    setBusy(true);
    try {
      const { error } = await client.auth.verifyOtp({
        email: email.trim(),
        token: verificationCode.trim(),
        type: "email",
      });
      setStatus(error ? c.verifyFailed : "");
    } catch {
      setStatus(c.verifyFailed);
    } finally {
      setBusy(false);
    }
  }

  async function beginOrResumeSync() {
    if (!client || !session) return;
    setBusy(true);
    try {
      const snapshot = await fetchCloudSyncSnapshot(client);
      setSummary(summariseSnapshot(snapshot));
      await prepareCloudSync(session.user.id, snapshot);
      setEnabled(true);
      await syncNow();
    } catch {
      setStatus(c.syncFailed);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!client || !session) return;
    setBusy(true);
    try {
      await pauseCloudSync(session.user.id);
      const { error } = await client.auth.signOut();
      setStatus(error ? c.syncFailed : c.signedOut);
    } catch {
      setStatus(c.syncFailed);
    } finally {
      setBusy(false);
    }
  }

  async function chooseCloudVersion(conflict: CloudSyncConflict) {
    setBusy(true);
    try {
      await discardPendingCloudChange(conflict.outbox);
      setConflicts((current) => current.filter((item) => item.outbox.id !== conflict.outbox.id));
      await syncNow();
    } catch {
      setStatus(c.syncFailed);
    } finally {
      setBusy(false);
    }
  }

  async function keepDeviceVersion(conflict: CloudSyncConflict) {
    if (!client || !session) return;
    setBusy(true);
    try {
      await forcePushCloudChange(client, session.user.id, conflict.outbox);
      setConflicts((current) => current.filter((item) => item.outbox.id !== conflict.outbox.id));
      await syncNow();
    } catch {
      setStatus(c.syncFailed);
    } finally {
      setBusy(false);
    }
  }

  // Supabase is optional during local development and before the first cloud setup.
  if (!client) return null;

  return (
    <section aria-label={c.cloud} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.cloud}</p>
        {enabled ? <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">{busy ? c.syncing : c.loggedIn}</span> : null}
      </div>

      {!session ? (
        <div className="mt-3 grid gap-2">
          <label className="sr-only" htmlFor="cloud-sync-email">{c.email}</label>
          <input className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" id="cloud-sync-email" onChange={(event) => { setEmail(event.target.value); setVerificationCode(""); setCodeSent(false); }} placeholder={c.emailPlaceholder} type="email" value={email} />
          {codeSent ? <><label className="sr-only" htmlFor="cloud-sync-code">{c.code}</label><input autoComplete="one-time-code" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" id="cloud-sync-code" inputMode="numeric" maxLength={8} onChange={(event) => setVerificationCode(event.target.value)} placeholder={c.codePlaceholder} type="text" value={verificationCode} /><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900" disabled={busy || !verificationCode.trim()} onClick={() => void verifySignInCode()} type="button">{c.verifyCode}</button><button className="rounded-lg px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white" disabled={busy || !email.trim()} onClick={() => void sendSignInCode()} type="button">{c.getCode}</button></> : <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900" disabled={busy || !email.trim()} onClick={() => void sendSignInCode()} type="button">{c.getCode}</button>}
        </div>
      ) : accountMismatch ? (
        <div className="mt-3"><p className="text-xs leading-5 text-amber-800 dark:text-amber-200">{c.accountMismatch}</p><button className="mt-2 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white" disabled={busy} onClick={() => void signOut()} type="button">{c.logout}</button></div>
      ) : !enabled ? (
        <div className="mt-3">
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{summary?.hasRemoteData ? c.remoteFound : c.noRemote}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{c.firstSync}</p>
          <button className="mt-3 rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60" disabled={busy} onClick={() => void beginOrResumeSync()} type="button">{c.continueSetup}</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="rounded-lg border border-teal-700 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-950" disabled={busy} onClick={() => void syncNow()} type="button">{c.syncNow}</button>
          <button className="rounded-lg px-2 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white" disabled={busy} onClick={() => void signOut()} type="button">{c.logout}</button>
          {pending > 0 ? <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{pending} {c.pending}</span> : null}
        </div>
      )}

      {status ? <p aria-live="polite" className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">{status}</p> : null}

      {conflicts.length ? <div className="mt-3 border-t border-amber-200 pt-3 dark:border-amber-900"><p className="text-xs font-bold text-amber-800 dark:text-amber-200">{c.conflict}</p><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{c.conflictBody}</p>{conflicts.map((conflict) => <div className="mt-2 rounded-lg bg-amber-50 p-2 dark:bg-amber-950/40" key={conflict.outbox.id}><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{shortRecordName(conflict, language)}</p><div className="mt-2 flex flex-wrap gap-2">{conflict.remote ? <button className="rounded-md border border-amber-500 px-2 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:text-amber-100" disabled={busy} onClick={() => void chooseCloudVersion(conflict)} type="button">{c.keepCloud}</button> : null}{!(conflict.remote?.deleted_at && conflict.outbox.operation === "upsert") ? <button className="rounded-md bg-amber-700 px-2 py-1 text-xs font-bold text-white hover:bg-amber-800" disabled={busy} onClick={() => void keepDeviceVersion(conflict)} type="button">{c.keepDevice}</button> : null}</div></div>)}</div> : null}
    </section>
  );
}
