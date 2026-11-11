"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppNavigation } from "@/components/app-navigation";
import { ExpenseAnalytics } from "@/components/expense-analytics";
import { addExpense, deleteExpense, getExpenseLedgerSettings, listExpenses, saveExpenseLedgerSettings, updateExpense } from "@/db/expenses";
import { CLOUD_SYNC_APPLIED_EVENT } from "@/db/sync";
import { AutomaticExchangeRateQuoteSchema, type AutomaticExchangeRateQuote } from "@/lib/exchange-rates";
import { calculateExpenseSettlement } from "@/lib/expense-settlement";
import { buildExpenseStatistics } from "@/lib/expense-statistics";
import { getLocalCalendarDate } from "@/lib/local-date";
import { buildExpenseSettlementSnapshot, formatMoneyFromMinorUnits, getCurrencyFractionDigits, isValidPositiveDecimalRate, parseMoneyToMinorUnits, splitAmountEqually } from "@/lib/money";
import type { Expense, ExpenseLedgerSettings, ExpenseMember } from "@/lib/types";

type Language = "zh" | "en";
type ConversionMode = "automatic" | "manual";
type SettlementSnapshot = NonNullable<Expense["settlement"]>;

type ExpenseForm = {
  title: string;
  category: string;
  amount: string;
  currency: string;
  paidBy: string;
  participantIds: string[];
  date: string;
  notes: string;
  conversionMode: ConversionMode;
  rate: string;
  rateDate: string;
  quotedAt: string;
  provider: string;
  rateTarget: string;
};

const copy = {
  zh: {
    eyebrow: "TRAVEL SPLIT", title: "旅伴記帳", local: "本機儲存，可私有同步", language: "EN",
    subtitle: "以一種結算幣別整合旅行支出；每筆仍保留原始付款幣別和確認時的匯率快照。",
    members: "旅伴", memberHint: "加入所有會一起分帳的人；付款人也要先加入。", memberPlaceholder: "輸入旅伴名字", add: "新增",
    categories: "支出類別", categoryHint: "可加入自己的類別，例如咖啡、伴手禮或租車。", categoryPlaceholder: "新增類別", remove: "移除",
    settlementCurrency: "最後結算幣別", settlementCurrencyHint: "所有帳目最後會換算成這個幣別。新增第一筆後會鎖定，避免改寫既有結算。", chooseCurrency: "選擇結算幣別", currencyLocked: "已有帳目，為保留已確認的匯率與結算結果，這個選項已鎖定。", savedSettlementCurrency: "已設定最後結算幣別。",
    addExpense: "新增支出", description: "支出名稱", descriptionPlaceholder: "例如：京都晚餐", date: "日期", category: "類別", amount: "金額", paymentCurrency: "支付幣別", paidBy: "由誰付款？", shareWith: "與誰分攤？", shareHint: "已選的旅伴會平均分攤這筆支出。", notes: "備註（選填）", notesPlaceholder: "例如已含小費", saveExpense: "加入帳目",
    needsMembers: "先在上方新增至少一位旅伴，才能開始記帳。", needsSettlementCurrency: "請先在上方選定最後結算幣別，再加入帳目。", currencyHint: "原始付款金額會保留；結算時使用此筆記錄所確認的匯率，不會因日後匯率變動而改變。", amountHint: "請使用小數點，例如 350 或 12.50。",
    exchangeRate: "換算匯率", rateDirection: "匯率方向：1 {from} = X {to}", sameCurrency: "付款幣別與結算幣別相同，會以 1:1 記錄。", automaticRate: "自動參考匯率", manualRate: "自行輸入匯率", getRate: "取得自動匯率", fetchingRate: "正在取得匯率⋯", rateInput: "1 {from} 等於多少 {to}", rateRequired: "請先取得自動匯率，或自行輸入一個大於 0 的匯率。", invalidRate: "匯率格式不正確，請輸入大於 0 的數字。", rateFetched: "已取得參考匯率，加入帳目後會固定保存這個數值。", rateUnavailable: "暫時無法取得參考匯率；請改為自行輸入匯率。", privacy: "只有按下取得自動匯率時，系統會送出幣別與日期查詢；帳目、旅伴和金額不會送出。",
    settlement: "結算建議", settlementHint: "所有已確認換算的帳目會統一以最後結算幣別計算。", totalSpent: "總支出", paid: "已支付", owes: "應付", receives: "應收", balanced: "已平衡", transfer: "需要付款給", noTransfers: "帳目已經平衡，不需要轉帳。", needsConversions: "有 {count} 筆帳目尚未換算，完成後才會顯示正確結算。",
    expenses: "帳目明細", noExpenses: "還沒有帳目。新增第一筆共同支出後，這裡會列出詳細紀錄。", sharedBy: "分攤者", delete: "刪除", deleteConfirm: "確定要刪除這筆支出嗎？此動作無法復原。", settlesAs: "結算後", rateSnapshot: "匯率快照", sourceDate: "參考日期", automatic: "自動參考", manual: "手動輸入", identity: "同幣別", conversionNeeded: "需要確認匯率", conversionHint: "這筆舊帳沒有可信的歷史匯率。請自行輸入，或按日期取得參考匯率；系統不會猜測。", convertAuto: "取得自動匯率並換算", convertManual: "用手動匯率換算", conversionSaved: "已更新這筆帳目的結算匯率。",
    cannotRemoveMember: "這位旅伴已出現在帳目中，為保留結算紀錄，目前不能移除。", cannotRemoveCategory: "這個類別已被帳目使用，為保留歷史紀錄，目前不能移除。", enterMember: "請先輸入旅伴名字。", duplicateMember: "這位旅伴已經在帳本中。", enterCategory: "請先輸入類別名稱。", duplicateCategory: "這個類別已經存在。", invalidExpense: "請完整填寫名稱、金額、幣別、付款人和至少一位分攤者。", invalidMoney: "金額格式不正確，或小數位數不符合此幣別。", addedMember: "已新增旅伴。", addedCategory: "已新增類別。", addedExpense: "已加入帳目，結算已更新。", removed: "已移除。", loading: "正在讀取旅伴帳本⋯", storageError: "無法讀取本機帳本。請重新整理後再試一次。", ledgerError: "帳目資料有不一致之處，請檢查旅伴和支出資料。",
  },
  en: {
    eyebrow: "TRAVEL SPLIT", title: "Travel split", local: "Local-first, private sync ready", language: "繁中",
    subtitle: "Settle travel spending in one chosen currency while preserving every original payment and its confirmed exchange-rate snapshot.",
    members: "Travellers", memberHint: "Add everyone who may share costs. A payer must be added first.", memberPlaceholder: "Traveller name", add: "Add",
    categories: "Expense categories", categoryHint: "Add your own categories, such as coffee, souvenirs, or car hire.", categoryPlaceholder: "New category", remove: "Remove",
    settlementCurrency: "Final settlement currency", settlementCurrencyHint: "All expenses settle into this currency. It locks after the first expense so existing settlement results are never rewritten.", chooseCurrency: "Choose a settlement currency", currencyLocked: "This is locked because expenses already preserve confirmed rates and settlement results.", savedSettlementCurrency: "Final settlement currency saved.",
    addExpense: "Add expense", description: "Description", descriptionPlaceholder: "For example: Kyoto dinner", date: "Date", category: "Category", amount: "Amount", paymentCurrency: "Paid in", paidBy: "Who paid?", shareWith: "Split with", shareHint: "Selected travellers will split this expense equally.", notes: "Notes (optional)", notesPlaceholder: "For example: tip included", saveExpense: "Add to ledger",
    needsMembers: "Add at least one traveller above before recording expenses.", needsSettlementCurrency: "Choose a final settlement currency above before recording an expense.", currencyHint: "The original payment stays intact. Settlement uses this expense's confirmed rate, so later rate changes cannot alter it.", amountHint: "Use a decimal point, for example 350 or 12.50.",
    exchangeRate: "Exchange rate", rateDirection: "Rate direction: 1 {from} = X {to}", sameCurrency: "The payment and settlement currencies match, so this is recorded at 1:1.", automaticRate: "Automatic reference rate", manualRate: "Enter a rate myself", getRate: "Get automatic rate", fetchingRate: "Getting rate…", rateInput: "How many {to} for 1 {from}", rateRequired: "Get an automatic rate first, or enter a rate greater than 0.", invalidRate: "Enter a valid rate greater than 0.", rateFetched: "Reference rate received. It will be saved as a fixed snapshot when you add the expense.", rateUnavailable: "A reference rate is unavailable right now. Enter a rate yourself instead.", privacy: "Only the currency pair and date are sent when you request a reference rate. Your expense, travellers, and amount are not sent.",
    settlement: "Settlement plan", settlementHint: "All expenses with confirmed conversions are calculated together in the final settlement currency.", totalSpent: "Total spent", paid: "Paid", owes: "Owes", receives: "Receives", balanced: "Balanced", transfer: "needs to pay", noTransfers: "The ledger is balanced; no transfer is needed.", needsConversions: "{count} expense(s) still need a conversion. Complete them before relying on the settlement.",
    expenses: "Expense history", noExpenses: "No expenses yet. Add the first shared cost to see its details here.", sharedBy: "Shared by", delete: "Delete", deleteConfirm: "Delete this expense? This cannot be undone.", settlesAs: "Settles as", rateSnapshot: "Rate snapshot", sourceDate: "Reference date", automatic: "Automatic reference", manual: "Manual entry", identity: "Same currency", conversionNeeded: "Rate confirmation needed", conversionHint: "This older entry has no trustworthy historical rate. Enter one yourself or request a dated reference rate; the app will not guess.", convertAuto: "Get rate and convert", convertManual: "Convert with manual rate", conversionSaved: "This expense's settlement rate has been updated.",
    cannotRemoveMember: "This traveller appears in an expense, so they cannot be removed without losing the settlement history.", cannotRemoveCategory: "This category is used by an expense, so it cannot be removed without losing the history.", enterMember: "Enter a traveller name first.", duplicateMember: "This traveller is already in the ledger.", enterCategory: "Enter a category name first.", duplicateCategory: "This category already exists.", invalidExpense: "Complete the description, amount, currency, payer, and at least one traveller sharing the expense.", invalidMoney: "The amount is invalid or has too many decimal places for this currency.", addedMember: "Traveller added.", addedCategory: "Category added.", addedExpense: "Expense added and settlement updated.", removed: "Removed.", loading: "Loading travel split…", storageError: "This browser could not read the local ledger. Refresh and try again.", ledgerError: "The ledger has inconsistent data. Check the travellers and expenses.",
  },
} as const;

const currencyOptions = ["TWD", "JPY", "USD", "EUR", "GBP", "KRW", "HKD", "CNY", "SGD", "THB"];

function today() { return getLocalCalendarDate(); }

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function blankExpenseForm(settings: ExpenseLedgerSettings): ExpenseForm {
  return { title: "", category: settings.categories[0] ?? "", amount: "", currency: settings.settlement_currency ?? "TWD", paidBy: settings.members[0]?.id ?? "", participantIds: settings.members.map((member) => member.id), date: today(), notes: "", conversionMode: "automatic", rate: "", rateDate: "", quotedAt: "", provider: "", rateTarget: "" };
}

function synchroniseExpenseForm(current: ExpenseForm | null, settings: ExpenseLedgerSettings): ExpenseForm {
  if (!current) return blankExpenseForm(settings);
  const memberIds = new Set(settings.members.map((member) => member.id));
  const participantIds = current.participantIds.filter((id) => memberIds.has(id));
  return { ...current, category: settings.categories.includes(current.category) ? current.category : (settings.categories[0] ?? ""), paidBy: memberIds.has(current.paidBy) ? current.paidBy : (settings.members[0]?.id ?? ""), participantIds: participantIds.length ? participantIds : settings.members.map((member) => member.id) };
}

function clearQuote(form: ExpenseForm, values: Partial<ExpenseForm>): ExpenseForm {
  return { ...form, ...values, rate: "", rateDate: "", quotedAt: "", provider: "", rateTarget: "" };
}

function createSettlementSnapshot(input: {
  amountMinor: number;
  sourceFractionDigits: number;
  participantIds: string[];
  originalShares?: Expense["shares"];
  sourceCurrency: string;
  targetCurrency: string;
  rate: string;
  source: SettlementSnapshot["source"];
  provider?: string;
  rateDate?: string;
  quotedAt?: string;
}): SettlementSnapshot | undefined {
  const rate = input.sourceCurrency === input.targetCurrency ? "1" : input.rate.trim();
  const fraction_digits = getCurrencyFractionDigits(input.targetCurrency);
  return buildExpenseSettlementSnapshot({
    original_amount_minor: input.amountMinor,
    original_fraction_digits: input.sourceFractionDigits,
    original_shares: input.originalShares ?? splitAmountEqually(input.amountMinor, input.participantIds),
    currency: input.targetCurrency,
    fraction_digits,
    rate,
    source: input.sourceCurrency === input.targetCurrency ? "identity" : input.source,
    ...(input.source === "automatic" && input.sourceCurrency !== input.targetCurrency && input.provider ? { provider: input.provider } : {}),
    ...(input.source === "automatic" && input.sourceCurrency !== input.targetCurrency && input.rateDate ? { rate_date: input.rateDate } : {}),
    ...(input.source === "automatic" && input.sourceCurrency !== input.targetCurrency && input.quotedAt ? { quoted_at: input.quotedAt } : {}),
  });
}

async function getAutomaticRate(from: string, to: string, date: string): Promise<AutomaticExchangeRateQuote> {
  const query = new URLSearchParams({ from, to, date });
  const response = await fetch(`/api/exchange-rate?${query.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("rate unavailable");
  const quote = AutomaticExchangeRateQuoteSchema.safeParse(await response.json());
  if (!quote.success || quote.data.source_currency !== from || quote.data.target_currency !== to) throw new Error("invalid quote");
  return quote.data;
}

export function ExpenseDashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [settings, setSettings] = useState<ExpenseLedgerSettings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm | null>(null);
  const [memberName, setMemberName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [legacyRateDrafts, setLegacyRateDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [updatingExpenseId, setUpdatingExpenseId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [storageIssue, setStorageIssue] = useState(false);
  const c = copy[language];

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getExpenseLedgerSettings(), listExpenses()]).then(([loadedSettings, loadedExpenses]) => {
      if (cancelled) return;
      setSettings(loadedSettings);
      setExpenses(loadedExpenses);
      setExpenseForm((current) => synchroniseExpenseForm(current, loadedSettings));
      setIsLoading(false);
    }).catch(() => { if (!cancelled) { setStorageIssue(true); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-Hant" : "en"; }, [language]);

  useEffect(() => {
    const refreshFromCloud = () => {
      void Promise.all([getExpenseLedgerSettings(), listExpenses()]).then(([loadedSettings, loadedExpenses]) => {
        setSettings(loadedSettings);
        setExpenses(loadedExpenses);
        setExpenseForm((current) => synchroniseExpenseForm(current, loadedSettings));
        setStorageIssue(false);
      }).catch(() => setStorageIssue(true));
    };
    window.addEventListener(CLOUD_SYNC_APPLIED_EVENT, refreshFromCloud);
    return () => window.removeEventListener(CLOUD_SYNC_APPLIED_EVENT, refreshFromCloud);
  }, []);

  const settlementCurrency = settings?.settlement_currency ?? null;
  const memberById = useMemo(() => new Map(settings?.members.map((member) => [member.id, member]) ?? []), [settings]);
  const settlementResult = useMemo(() => {
    if (!settings) return { result: null, error: false };
    try { return { result: calculateExpenseSettlement(expenses, settings.members, settings.settlement_currency), error: false }; }
    catch { return { result: null, error: true }; }
  }, [expenses, settings]);
  const expenseStatistics = useMemo(
    () => buildExpenseStatistics(expenses, settings?.members ?? [], settlementResult.result?.settlement ?? null),
    [expenses, settings, settlementResult.result],
  );

  async function refreshExpenses() { setExpenses(await listExpenses()); }

  async function persistSettings(next: ExpenseLedgerSettings, message: string) {
    setIsSaving(true);
    try {
      const saved = await saveExpenseLedgerSettings(next);
      setSettings(saved);
      setExpenseForm((current) => synchroniseExpenseForm(current, saved));
      setStatus(message);
      setStorageIssue(false);
    } catch { setStorageIssue(true); setStatus(c.storageError); }
    finally { setIsSaving(false); }
  }

  async function chooseSettlementCurrency(value: string) {
    if (!settings) return;
    if (isFetchingRate) return;
    if (expenses.some((expense) => expense.settlement !== null)) return setStatus(c.currencyLocked);
    const settlement_currency = value ? value.trim().toUpperCase() : null;
    if (settlement_currency && !/^[A-Z]{3}$/.test(settlement_currency)) return;
    await persistSettings({ ...settings, settlement_currency }, settlement_currency ? c.savedSettlementCurrency : "");
    setExpenseForm((form) => {
      if (!form) return form;
      return !form.amount && !form.title ? clearQuote(form, settlement_currency ? { currency: settlement_currency } : {}) : clearQuote(form, {});
    });
  }

  async function addMember() {
    if (!settings) return;
    const name = memberName.trim();
    if (!name) return setStatus(c.enterMember);
    if (settings.members.some((member) => member.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return setStatus(c.duplicateMember);
    await persistSettings({ ...settings, members: [...settings.members, { id: crypto.randomUUID(), name }] }, c.addedMember);
    setMemberName("");
  }

  async function removeMember(member: ExpenseMember) {
    if (!settings) return;
    if (expenses.some((expense) => expense.paid_by === member.id || expense.shares.some((share) => share.member_id === member.id))) return setStatus(c.cannotRemoveMember);
    await persistSettings({ ...settings, members: settings.members.filter((item) => item.id !== member.id) }, c.removed);
  }

  async function addCategory() {
    if (!settings) return;
    const category = categoryName.trim();
    if (!category) return setStatus(c.enterCategory);
    if (settings.categories.some((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase())) return setStatus(c.duplicateCategory);
    await persistSettings({ ...settings, categories: [...settings.categories, category] }, c.addedCategory);
    setCategoryName("");
  }

  async function removeCategory(category: string) {
    if (!settings) return;
    if (expenses.some((expense) => expense.category === category)) return setStatus(c.cannotRemoveCategory);
    await persistSettings({ ...settings, categories: settings.categories.filter((item) => item !== category) }, c.removed);
  }

  async function fetchFormRate() {
    if (!expenseForm || !settlementCurrency) return setStatus(c.needsSettlementCurrency);
    const from = expenseForm.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(from) || !expenseForm.date) return setStatus(c.invalidExpense);
    if (from === settlementCurrency) {
      setExpenseForm({ ...expenseForm, rate: "1", rateDate: expenseForm.date, quotedAt: new Date().toISOString(), provider: "", rateTarget: settlementCurrency });
      return;
    }
    setIsFetchingRate(true);
    try {
      const quote = await getAutomaticRate(from, settlementCurrency, expenseForm.date);
      setExpenseForm((form) => form && form.conversionMode === "automatic" && form.currency.trim().toUpperCase() === from && form.date === expenseForm.date ? { ...form, conversionMode: "automatic", rate: quote.rate, rateDate: quote.rate_date, quotedAt: quote.quoted_at, provider: quote.provider, rateTarget: quote.target_currency } : form);
      setStatus(c.rateFetched);
    } catch { setStatus(c.rateUnavailable); }
    finally { setIsFetchingRate(false); }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || !expenseForm || !settlementCurrency) return setStatus(c.needsSettlementCurrency);
    const currency = expenseForm.currency.trim().toUpperCase();
    const fraction_digits = getCurrencyFractionDigits(currency);
    const amount_minor = parseMoneyToMinorUnits(expenseForm.amount, fraction_digits);
    if (!expenseForm.title.trim() || !expenseForm.category || !/^[A-Z]{3}$/.test(currency) || !expenseForm.paidBy || !expenseForm.participantIds.length) return setStatus(c.invalidExpense);
    if (!amount_minor) return setStatus(c.invalidMoney);
    if (currency !== settlementCurrency && !isValidPositiveDecimalRate(expenseForm.rate)) return setStatus(c.rateRequired);
    if (currency !== settlementCurrency && expenseForm.conversionMode === "automatic" && (!expenseForm.provider || !expenseForm.rateDate || !expenseForm.quotedAt || expenseForm.rateTarget !== settlementCurrency)) return setStatus(c.rateRequired);
    const settlement = createSettlementSnapshot({ amountMinor: amount_minor, sourceFractionDigits: fraction_digits, participantIds: expenseForm.participantIds, sourceCurrency: currency, targetCurrency: settlementCurrency, rate: expenseForm.rate, source: expenseForm.conversionMode, provider: expenseForm.provider, rateDate: expenseForm.rateDate, quotedAt: expenseForm.quotedAt });
    if (!settlement) return setStatus(c.invalidRate);
    const timestamp = new Date().toISOString();
    const expense: Expense = { id: crypto.randomUUID(), title: expenseForm.title, category: expenseForm.category, amount_minor, currency, fraction_digits, paid_by: expenseForm.paidBy, shares: splitAmountEqually(amount_minor, expenseForm.participantIds), settlement, date: expenseForm.date, notes: expenseForm.notes, created_at: timestamp, updated_at: timestamp };
    setIsSaving(true);
    try { await addExpense(expense); await refreshExpenses(); setExpenseForm(blankExpenseForm(settings)); setStatus(c.addedExpense); setStorageIssue(false); }
    catch { setStorageIssue(true); setStatus(c.storageError); }
    finally { setIsSaving(false); }
  }

  async function saveLegacyConversion(expense: Expense, source: ConversionMode, rate: string, quote?: AutomaticExchangeRateQuote) {
    if (!settlementCurrency) return setStatus(c.needsSettlementCurrency);
    const settlement = createSettlementSnapshot({ amountMinor: expense.amount_minor, sourceFractionDigits: expense.fraction_digits, participantIds: expense.shares.map((share) => share.member_id), originalShares: expense.shares, sourceCurrency: expense.currency, targetCurrency: settlementCurrency, rate, source, provider: quote?.provider, rateDate: quote?.rate_date, quotedAt: quote?.quoted_at });
    if (!settlement) return setStatus(c.invalidRate);
    setUpdatingExpenseId(expense.id);
    try { await updateExpense({ ...expense, settlement }); await refreshExpenses(); setStatus(c.conversionSaved); setStorageIssue(false); }
    catch { setStorageIssue(true); setStatus(c.storageError); }
    finally { setUpdatingExpenseId(null); }
  }

  async function convertLegacyAutomatically(expense: Expense) {
    if (!settlementCurrency) return setStatus(c.needsSettlementCurrency);
    setUpdatingExpenseId(expense.id);
    try {
      const quote = await getAutomaticRate(expense.currency, settlementCurrency, expense.date);
      const settlement = createSettlementSnapshot({ amountMinor: expense.amount_minor, sourceFractionDigits: expense.fraction_digits, participantIds: expense.shares.map((share) => share.member_id), originalShares: expense.shares, sourceCurrency: expense.currency, targetCurrency: settlementCurrency, rate: quote.rate, source: "automatic", provider: quote.provider, rateDate: quote.rate_date, quotedAt: quote.quoted_at });
      if (!settlement) return setStatus(c.invalidRate);
      await updateExpense({ ...expense, settlement });
      await refreshExpenses();
      setStatus(c.conversionSaved);
    } catch { setStatus(c.rateUnavailable); }
    finally { setUpdatingExpenseId(null); }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm(c.deleteConfirm)) return;
    setIsSaving(true);
    try { await deleteExpense(id); await refreshExpenses(); setStatus(c.removed); setStorageIssue(false); }
    catch { setStorageIssue(true); setStatus(c.storageError); }
    finally { setIsSaving(false); }
  }

  function toggleParticipant(memberId: string) {
    setExpenseForm((form) => {
      if (!form) return form;
      if (form.participantIds.includes(memberId)) return form.participantIds.length === 1 ? form : { ...form, participantIds: form.participantIds.filter((id) => id !== memberId) };
      return { ...form, participantIds: [...form.participantIds, memberId] };
    });
  }

  if (isLoading || !settings || !expenseForm) return <main className="min-h-screen bg-slate-50 px-5 py-16 text-center text-slate-500 dark:bg-slate-950">{c.loading}</main>;

  const isCurrencyLocked = expenses.some((expense) => expense.settlement !== null);
  const formCurrency = expenseForm.currency.trim().toUpperCase();
  const sameCurrency = settlementCurrency !== null && formCurrency === settlementCurrency;
  const result = settlementResult.result;
  const settlement = result?.settlement ?? null;
  const needsConversion = result?.needs_conversion ?? [];

  return <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="border-b border-slate-200 pb-8 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><p className="text-xs font-bold tracking-[0.22em] text-teal-700 dark:text-teal-300">{c.eyebrow}</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{c.title}</h1><p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{c.subtitle}</p></div><div className="flex items-center gap-3"><span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200">{c.local}</span><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-teal-600 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300" onClick={() => setLanguage((value) => value === "zh" ? "en" : "zh")} type="button">{c.language}</button></div></div>
        <div className="mt-6"><AppNavigation current="expenses" language={language} /></div>
      </header>

      <p aria-live="polite" className={`mt-5 min-h-5 text-sm font-medium ${storageIssue ? "text-rose-700 dark:text-rose-300" : "text-teal-700 dark:text-teal-300"}`}>{status || (storageIssue ? c.storageError : "")}</p>

      <section className="mt-3 grid gap-5 lg:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-lg font-bold">{c.members}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{c.memberHint}</p><div className="mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setMemberName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addMember(); }} placeholder={c.memberPlaceholder} value={memberName} /><button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={isSaving} onClick={() => void addMember()} type="button">{c.add}</button></div><div className="mt-4 flex flex-wrap gap-2">{settings.members.map((member) => <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 py-1 pl-3 pr-1 text-sm font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100" key={member.id}>{member.name}<button aria-label={`${c.remove} ${member.name}`} className="rounded-full px-1.5 py-0.5 text-xs text-teal-700 hover:bg-teal-200 dark:text-teal-200 dark:hover:bg-teal-900" disabled={isSaving} onClick={() => void removeMember(member)} type="button">×</button></span>)}</div></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-lg font-bold">{c.categories}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{c.categoryHint}</p><div className="mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addCategory(); }} placeholder={c.categoryPlaceholder} value={categoryName} /><button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={isSaving} onClick={() => void addCategory()} type="button">{c.add}</button></div><div className="mt-4 flex flex-wrap gap-2">{settings.categories.map((category) => <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200" key={category}>{category}<button aria-label={`${c.remove} ${category}`} className="rounded-full px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700" disabled={isSaving} onClick={() => void removeCategory(category)} type="button">×</button></span>)}</div></article>
        <article className="rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950"><h2 className="text-lg font-bold text-teal-950 dark:text-teal-50">{c.settlementCurrency}</h2><p className="mt-1 text-sm leading-6 text-teal-800 dark:text-teal-200">{c.settlementCurrencyHint}</p><select className="mt-4 w-full rounded-xl border border-teal-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-teal-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-800 dark:bg-slate-950 dark:text-slate-100" disabled={isSaving || isFetchingRate || isCurrencyLocked} onChange={(event) => void chooseSettlementCurrency(event.target.value)} value={settlementCurrency ?? ""}><option value="">{c.chooseCurrency}</option>{currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select>{isCurrencyLocked ? <p className="mt-3 text-xs font-semibold text-teal-800 dark:text-teal-200">{c.currencyLocked}</p> : null}</article>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight">{c.addExpense}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{c.currencyHint}</p></div><p className="text-xs text-slate-500">{c.amountHint}</p></div>
        {settings.members.length === 0 ? <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">{c.needsMembers}</p> : !settlementCurrency ? <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">{c.needsSettlementCurrency}</p> : <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(event) => void submitExpense(event)}>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.description}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, title: event.target.value })} placeholder={c.descriptionPlaceholder} value={expenseForm.title} /></label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.date}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm(clearQuote(expenseForm, { date: event.target.value }))} type="date" value={expenseForm.date} /></label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.category}<select className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} value={expenseForm.category}>{settings.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <div className="grid grid-cols-[1fr_7rem] gap-3"><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.amount}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" inputMode="decimal" onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} placeholder="0" value={expenseForm.amount} /></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.paymentCurrency}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal uppercase outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" list="currency-options" maxLength={3} onChange={(event) => setExpenseForm(clearQuote(expenseForm, { currency: event.target.value.toUpperCase() }))} value={expenseForm.currency} /></label></div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.paidBy}<select className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, paidBy: event.target.value })} value={expenseForm.paidBy}>{settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          <fieldset className="rounded-2xl border border-slate-200 p-4 md:col-span-2 dark:border-slate-700">
            <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{c.exchangeRate} · {settlementCurrency}</legend>
            <p className="mt-1 text-xs text-slate-500">{interpolate(c.rateDirection, { from: formCurrency || "…", to: settlementCurrency })}</p>
            {sameCurrency ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{c.sameCurrency}</p> : <div className="mt-3 grid gap-3 md:grid-cols-[auto_auto_1fr_auto]">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input checked={expenseForm.conversionMode === "automatic"} disabled={isFetchingRate} name="rate-mode" onChange={() => setExpenseForm(clearQuote(expenseForm, { conversionMode: "automatic" }))} type="radio" />{c.automaticRate}</label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input checked={expenseForm.conversionMode === "manual"} disabled={isFetchingRate} name="rate-mode" onChange={() => setExpenseForm(clearQuote(expenseForm, { conversionMode: "manual" }))} type="radio" />{c.manualRate}</label>
              <input aria-label={interpolate(c.rateInput, { from: formCurrency || "…", to: settlementCurrency })} className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950" disabled={isFetchingRate || expenseForm.conversionMode === "automatic"} inputMode="decimal" onChange={(event) => setExpenseForm({ ...expenseForm, rate: event.target.value, rateDate: "", quotedAt: "", provider: "", rateTarget: "" })} placeholder={interpolate(c.rateInput, { from: formCurrency || "…", to: settlementCurrency })} value={expenseForm.rate} />
              <button className="rounded-xl border border-teal-700 px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-950" disabled={isFetchingRate || expenseForm.conversionMode !== "automatic"} onClick={() => void fetchFormRate()} type="button">{isFetchingRate ? c.fetchingRate : c.getRate}</button>
            </div>}
            {!sameCurrency && expenseForm.conversionMode === "automatic" && expenseForm.rate && expenseForm.rateTarget === settlementCurrency ? <p className="mt-3 text-xs font-semibold text-teal-700 dark:text-teal-300">1 {formCurrency} = {expenseForm.rate} {settlementCurrency}{expenseForm.provider ? ` · ${expenseForm.provider}` : ""}{expenseForm.rateDate ? ` · ${c.sourceDate}: ${expenseForm.rateDate}` : ""}</p> : null}
            <p className="mt-3 text-xs leading-5 text-slate-500">{c.privacy}</p>
          </fieldset>
          <fieldset className="md:col-span-2"><legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.shareWith}</legend><p className="mt-1 text-xs text-slate-500">{c.shareHint}</p><div className="mt-2 flex flex-wrap gap-2">{settings.members.map((member) => <label className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-semibold transition ${expenseForm.participantIds.includes(member.id) ? "border-teal-700 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100" : "border-slate-300 text-slate-500 dark:border-slate-700"}`} key={member.id}><input checked={expenseForm.participantIds.includes(member.id)} className="sr-only" onChange={() => toggleParticipant(member.id)} type="checkbox" />{member.name}</label>)}</div></fieldset>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">{c.notes}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, notes: event.target.value })} placeholder={c.notesPlaceholder} value={expenseForm.notes} /></label>
          <div className="md:col-span-2"><button className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60" disabled={isSaving || isFetchingRate} type="submit">{c.saveExpense}</button></div>
        </form>}
        <datalist id="currency-options">{currencyOptions.map((currency) => <option key={currency} value={currency} />)}</datalist>
      </section>

      <section className="mt-8" aria-labelledby="settlement-title"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Settlement</p><h2 className="mt-1 text-2xl font-bold tracking-tight" id="settlement-title">{c.settlement}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{c.settlementHint}</p></div>{settlementResult.error ? <p className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800 dark:border-rose-950 dark:bg-rose-950 dark:text-rose-100">{c.ledgerError}</p> : null}{expenses.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">{c.noExpenses}</p> : null}{expenses.length > 0 && !settlementCurrency ? <p className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{c.needsSettlementCurrency}</p> : null}{needsConversion.length > 0 ? <p className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{interpolate(c.needsConversions, { count: needsConversion.length })}</p> : null}{settlement ? <article className="mt-4 max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">{settlement.currency}</p><h3 className="mt-1 text-xl font-bold">{c.totalSpent}: {formatMoneyFromMinorUnits(settlement.total_spent_minor, settlement.currency, settlement.fraction_digits, language)}</h3><div className="mt-5 grid gap-2">{settlement.balances.map((balance) => { const label = balance.net_minor > 0 ? c.receives : balance.net_minor < 0 ? c.owes : c.balanced; const colour = balance.net_minor > 0 ? "text-teal-700 dark:text-teal-300" : balance.net_minor < 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-500"; return <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800" key={balance.member_id}><span className="font-semibold">{memberById.get(balance.member_id)?.name ?? balance.member_id}</span><span className={`text-sm font-bold ${colour}`}>{label} {formatMoneyFromMinorUnits(Math.abs(balance.net_minor), settlement.currency, settlement.fraction_digits, language)}</span></div>; })}</div><div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">{settlement.transfers.length === 0 ? <p className="text-sm text-slate-500">{c.noTransfers}</p> : <ul className="space-y-2">{settlement.transfers.map((transfer, index) => <li className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-3 text-sm dark:border-teal-900 dark:bg-teal-950" key={`${transfer.from_member_id}-${transfer.to_member_id}-${index}`}><strong>{memberById.get(transfer.from_member_id)?.name ?? transfer.from_member_id}</strong> {c.transfer} <strong>{memberById.get(transfer.to_member_id)?.name ?? transfer.to_member_id}</strong><span className="ml-2 font-bold text-teal-800 dark:text-teal-200">{formatMoneyFromMinorUnits(transfer.amount_minor, settlement.currency, settlement.fraction_digits, language)}</span></li>)}</ul>}</div></article> : null}</section>

      {expenses.length > 0 ? <ExpenseAnalytics language={language} statistics={expenseStatistics} /> : null}

      <section className="mt-8" aria-labelledby="expenses-title"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Ledger</p><h2 className="mt-1 text-2xl font-bold tracking-tight" id="expenses-title">{c.expenses}</h2></div>{expenses.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">{c.noExpenses}</p> : <div className="grid gap-4 lg:grid-cols-2">{expenses.map((expense) => { const snapshot = expense.settlement; const needsRate = !snapshot || snapshot.currency !== settlementCurrency; const source = snapshot?.source === "automatic" ? c.automatic : snapshot?.source === "manual" ? c.manual : c.identity; const draftRate = legacyRateDrafts[expense.id] ?? ""; return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" key={expense.id}><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{expense.category}</span><time className="text-xs font-medium text-slate-500">{expense.date}</time></div><h3 className="mt-3 text-lg font-bold">{expense.title}</h3></div><button className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:border-rose-300 hover:text-rose-700 dark:border-slate-700" disabled={isSaving} onClick={() => void deleteEntry(expense.id)} type="button">{c.delete}</button></div><p className="mt-4 text-2xl font-bold text-teal-800 dark:text-teal-300">{formatMoneyFromMinorUnits(expense.amount_minor, expense.currency, expense.fraction_digits, language)}</p>{snapshot && snapshot.currency === settlementCurrency ? <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100"><p><span className="font-semibold">{c.settlesAs}: </span>{formatMoneyFromMinorUnits(snapshot.amount_minor, snapshot.currency, snapshot.fraction_digits, language)}</p><p className="mt-1 text-xs">{c.rateSnapshot}: 1 {expense.currency} = {snapshot.rate} {snapshot.currency} · {source}{snapshot.provider ? ` · ${snapshot.provider}` : ""}{snapshot.rate_date ? ` · ${c.sourceDate}: ${snapshot.rate_date}` : ""}</p></div> : null}<div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800"><p><span className="text-slate-500">{c.paidBy}: </span><strong>{memberById.get(expense.paid_by)?.name ?? expense.paid_by}</strong></p><p><span className="text-slate-500">{c.sharedBy}: </span>{expense.shares.map((share) => memberById.get(share.member_id)?.name ?? share.member_id).join("、")}</p>{expense.notes ? <p className="text-slate-500">{expense.notes}</p> : null}</div>{needsRate ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"><h4 className="font-bold text-amber-950 dark:text-amber-50">{c.conversionNeeded}</h4><p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-100">{c.conversionHint}</p>{settlementCurrency ? <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input aria-label={interpolate(c.rateInput, { from: expense.currency, to: settlementCurrency })} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500 focus:ring-2 dark:border-amber-800 dark:bg-slate-950 dark:text-slate-100" inputMode="decimal" onChange={(event) => setLegacyRateDrafts((drafts) => ({ ...drafts, [expense.id]: event.target.value }))} placeholder={interpolate(c.rateInput, { from: expense.currency, to: settlementCurrency })} value={draftRate} /><button className="rounded-xl border border-amber-500 px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:text-amber-100 dark:hover:bg-amber-900" disabled={updatingExpenseId === expense.id} onClick={() => void saveLegacyConversion(expense, "manual", draftRate)} type="button">{c.convertManual}</button><button className="rounded-xl bg-amber-700 px-3 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-60" disabled={updatingExpenseId === expense.id} onClick={() => void convertLegacyAutomatically(expense)} type="button">{updatingExpenseId === expense.id ? c.fetchingRate : c.convertAuto}</button></div> : null}</div> : null}</article>; })}</div>}</section>
    </div>
  </main>;
}
