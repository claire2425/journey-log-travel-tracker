"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNavigation } from "@/components/app-navigation";
import { addExpense, deleteExpense, getExpenseLedgerSettings, listExpenses, saveExpenseLedgerSettings } from "@/db/expenses";
import { calculateExpenseSettlement } from "@/lib/expense-settlement";
import { formatMoneyFromMinorUnits, getCurrencyFractionDigits, parseMoneyToMinorUnits, splitAmountEqually } from "@/lib/money";
import type { Expense, ExpenseLedgerSettings, ExpenseMember } from "@/lib/types";

type Language = "zh" | "en";

type ExpenseForm = {
  title: string;
  category: string;
  amount: string;
  currency: string;
  paidBy: string;
  participantIds: string[];
  date: string;
  notes: string;
};

const copy = {
  zh: {
    eyebrow: "TRAVEL SPLIT",
    title: "旅伴記帳",
    subtitle: "把每筆共同支出記下來，Journey Log 會分別按幣別算出誰應付給誰多少。資料只保留在這個瀏覽器。",
    local: "只儲存在這個裝置",
    members: "旅伴",
    memberHint: "加入所有會一起分帳的人；付款人也要先加入。",
    memberPlaceholder: "輸入旅伴名字",
    add: "新增",
    categories: "支出類別",
    categoryHint: "可加入自己的類別，例如咖啡、伴手禮或租車。",
    categoryPlaceholder: "新增類別",
    remove: "移除",
    addExpense: "新增支出",
    description: "支出名稱",
    descriptionPlaceholder: "例如：京都晚餐",
    date: "日期",
    category: "類別",
    amount: "金額",
    currency: "幣別",
    paidBy: "由誰付款？",
    shareWith: "與誰分攤？",
    shareHint: "已選的旅伴會平均分攤這筆支出。",
    notes: "備註（選填）",
    notesPlaceholder: "例如已含小費",
    saveExpense: "加入帳目",
    needsMembers: "先在上方新增至少一位旅伴，才能開始記帳。",
    currencyHint: "不同幣別會分開結算，不會自動換匯或混加。",
    amountHint: "請使用小數點，例如 350 或 12.50。",
    settlement: "結算建議",
    settlementHint: "每種幣別獨立計算，避免因未知匯率產生誤差。",
    totalSpent: "總支出",
    paid: "已支付",
    owes: "應付",
    receives: "應收",
    balanced: "已平衡",
    transfer: "需要付款給",
    noTransfers: "這個幣別已經平衡，不需要轉帳。",
    expenses: "帳目明細",
    noExpenses: "還沒有帳目。新增第一筆共同支出後，這裡會列出詳細紀錄。",
    sharedBy: "分攤者",
    delete: "刪除",
    deleteExpenseConfirm: "確定要刪除這筆支出嗎？此動作無法復原。",
    cannotRemoveMember: "這位旅伴已出現在帳目中，為保留結算紀錄，目前不能移除。",
    cannotRemoveCategory: "這個類別已被帳目使用，為保留歷史紀錄，目前不能移除。",
    enterMember: "請先輸入旅伴名字。",
    duplicateMember: "這位旅伴已經在帳本中。",
    enterCategory: "請先輸入類別名稱。",
    duplicateCategory: "這個類別已經存在。",
    invalidExpense: "請完整填寫名稱、金額、幣別、付款人和至少一位分攤者。",
    invalidMoney: "金額格式不正確，或小數位數不符合此幣別。",
    addedMember: "已新增旅伴。",
    addedCategory: "已新增類別。",
    addedExpense: "已加入帳目，結算已更新。",
    removed: "已移除。",
    loading: "正在讀取旅伴帳本⋯",
    storageError: "無法讀取本機帳本。請重新整理後再試一次。",
    ledgerError: "帳目資料有不一致之處，請檢查旅伴和支出資料。",
    language: "EN",
    today: "今天",
  },
  en: {
    eyebrow: "TRAVEL SPLIT",
    title: "Travel split",
    subtitle: "Record shared travel spending and see exactly who should pay whom, separately for each currency. Data stays in this browser.",
    local: "Saved on this device",
    members: "Travellers",
    memberHint: "Add everyone who may share costs. A payer must be added first.",
    memberPlaceholder: "Traveller name",
    add: "Add",
    categories: "Expense categories",
    categoryHint: "Add your own categories, such as coffee, souvenirs, or car hire.",
    categoryPlaceholder: "New category",
    remove: "Remove",
    addExpense: "Add expense",
    description: "Description",
    descriptionPlaceholder: "For example: Kyoto dinner",
    date: "Date",
    category: "Category",
    amount: "Amount",
    currency: "Currency",
    paidBy: "Who paid?",
    shareWith: "Split with",
    shareHint: "Selected travellers will split this expense equally.",
    notes: "Notes (optional)",
    notesPlaceholder: "For example: tip included",
    saveExpense: "Add to ledger",
    needsMembers: "Add at least one traveller above before recording expenses.",
    currencyHint: "Currencies settle separately; they are never automatically converted or combined.",
    amountHint: "Use a decimal point, for example 350 or 12.50.",
    settlement: "Settlement plan",
    settlementHint: "Each currency is calculated separately so an unknown exchange rate cannot create an error.",
    totalSpent: "Total spent",
    paid: "Paid",
    owes: "Owes",
    receives: "Receives",
    balanced: "Balanced",
    transfer: "needs to pay",
    noTransfers: "This currency is already balanced; no transfer is needed.",
    expenses: "Expense history",
    noExpenses: "No expenses yet. Add the first shared cost to see its details here.",
    sharedBy: "Shared by",
    delete: "Delete",
    deleteExpenseConfirm: "Delete this expense? This cannot be undone.",
    cannotRemoveMember: "This traveller appears in an expense, so they cannot be removed without losing the settlement history.",
    cannotRemoveCategory: "This category is used by an expense, so it cannot be removed without losing the history.",
    enterMember: "Enter a traveller name first.",
    duplicateMember: "This traveller is already in the ledger.",
    enterCategory: "Enter a category name first.",
    duplicateCategory: "This category already exists.",
    invalidExpense: "Complete the description, amount, currency, payer, and at least one traveller sharing the expense.",
    invalidMoney: "The amount is invalid or has too many decimal places for this currency.",
    addedMember: "Traveller added.",
    addedCategory: "Category added.",
    addedExpense: "Expense added and settlement updated.",
    removed: "Removed.",
    loading: "Loading travel split…",
    storageError: "This browser could not read the local ledger. Refresh and try again.",
    ledgerError: "The ledger has inconsistent data. Check the travellers and expenses.",
    language: "繁中",
    today: "Today",
  },
} as const;

const currencyOptions = ["TWD", "JPY", "USD", "EUR", "GBP", "KRW", "HKD", "CNY", "SGD", "THB"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function blankExpenseForm(settings: ExpenseLedgerSettings): ExpenseForm {
  return {
    title: "",
    category: settings.categories[0] ?? "",
    amount: "",
    currency: "TWD",
    paidBy: settings.members[0]?.id ?? "",
    participantIds: settings.members.map((member) => member.id),
    date: today(),
    notes: "",
  };
}

function synchroniseExpenseForm(current: ExpenseForm | null, settings: ExpenseLedgerSettings): ExpenseForm {
  if (!current) return blankExpenseForm(settings);
  const memberIds = new Set(settings.members.map((member) => member.id));
  const validParticipants = current.participantIds.filter((id) => memberIds.has(id));
  return {
    ...current,
    category: settings.categories.includes(current.category) ? current.category : (settings.categories[0] ?? ""),
    paidBy: memberIds.has(current.paidBy) ? current.paidBy : (settings.members[0]?.id ?? ""),
    participantIds: validParticipants.length > 0 ? validParticipants : settings.members.map((member) => member.id),
  };
}

function withTimeout<T>(task: Promise<T>, timeoutMs = 6000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Timed out while reading local data.")), timeoutMs);
    task.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    }, (error: unknown) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

export function ExpenseDashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [settings, setSettings] = useState<ExpenseLedgerSettings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm | null>(null);
  const [memberName, setMemberName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [storageIssue, setStorageIssue] = useState(false);
  const c = copy[language];

  useEffect(() => {
    let cancelled = false;
    void withTimeout(Promise.all([getExpenseLedgerSettings(), listExpenses()])).then(([loadedSettings, loadedExpenses]) => {
      if (cancelled) return;
      setSettings(loadedSettings);
      setExpenses(loadedExpenses);
      setExpenseForm((current) => synchroniseExpenseForm(current, loadedSettings));
      setStorageIssue(false);
      setIsLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setStorageIssue(true);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-Hant" : "en";
  }, [language]);

  const settlementResult = useMemo(() => {
    if (!settings) return { result: null, error: false };
    try {
      return { result: calculateExpenseSettlement(expenses, settings.members), error: false };
    } catch {
      return { result: null, error: true };
    }
  }, [expenses, settings]);

  const memberById = useMemo(() => new Map(settings?.members.map((member) => [member.id, member]) ?? []), [settings]);

  async function persistSettings(next: ExpenseLedgerSettings, message: string) {
    setIsSaving(true);
    try {
      const saved = await saveExpenseLedgerSettings(next);
      setSettings(saved);
      setExpenseForm((current) => synchroniseExpenseForm(current, saved));
      setStatus(message);
      setStorageIssue(false);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember() {
    if (!settings) return;
    const name = memberName.trim();
    if (!name) return setStatus(c.enterMember);
    if (settings.members.some((member) => member.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return setStatus(c.duplicateMember);
    await persistSettings({ ...settings, members: [...settings.members, { id: crypto.randomUUID(), name }] }, c.addedMember);
    setMemberName("");
  }

  async function handleRemoveMember(member: ExpenseMember) {
    if (!settings) return;
    if (expenses.some((expense) => expense.paid_by === member.id || expense.shares.some((share) => share.member_id === member.id))) return setStatus(c.cannotRemoveMember);
    await persistSettings({ ...settings, members: settings.members.filter((item) => item.id !== member.id) }, c.removed);
  }

  async function handleAddCategory() {
    if (!settings) return;
    const category = categoryName.trim();
    if (!category) return setStatus(c.enterCategory);
    if (settings.categories.some((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase())) return setStatus(c.duplicateCategory);
    await persistSettings({ ...settings, categories: [...settings.categories, category] }, c.addedCategory);
    setCategoryName("");
  }

  async function handleRemoveCategory(category: string) {
    if (!settings) return;
    if (expenses.some((expense) => expense.category === category)) return setStatus(c.cannotRemoveCategory);
    await persistSettings({ ...settings, categories: settings.categories.filter((item) => item !== category) }, c.removed);
  }

  async function handleAddExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || !expenseForm) return;
    const currency = expenseForm.currency.trim().toUpperCase();
    const fractionDigits = getCurrencyFractionDigits(currency);
    const amountMinor = parseMoneyToMinorUnits(expenseForm.amount, fractionDigits);
    if (!expenseForm.title.trim() || !expenseForm.category || !currency.match(/^[A-Z]{3}$/) || !expenseForm.paidBy || expenseForm.participantIds.length === 0) return setStatus(c.invalidExpense);
    if (!amountMinor) return setStatus(c.invalidMoney);

    const timestamp = new Date().toISOString();
    const expense: Expense = {
      id: crypto.randomUUID(),
      title: expenseForm.title,
      category: expenseForm.category,
      amount_minor: amountMinor,
      currency,
      fraction_digits: fractionDigits,
      paid_by: expenseForm.paidBy,
      shares: splitAmountEqually(amountMinor, expenseForm.participantIds),
      date: expenseForm.date,
      notes: expenseForm.notes,
      created_at: timestamp,
      updated_at: timestamp,
    };

    setIsSaving(true);
    try {
      await addExpense(expense);
      setExpenses(await listExpenses());
      setExpenseForm(blankExpenseForm(settings));
      setStatus(c.addedExpense);
      setStorageIssue(false);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!window.confirm(c.deleteExpenseConfirm)) return;
    setIsSaving(true);
    try {
      await deleteExpense(id);
      setExpenses(await listExpenses());
      setStatus(c.removed);
      setStorageIssue(false);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleParticipant(memberId: string) {
    setExpenseForm((current) => {
      if (!current) return current;
      if (current.participantIds.includes(memberId)) {
        if (current.participantIds.length === 1) return current;
        return { ...current, participantIds: current.participantIds.filter((id) => id !== memberId) };
      }
      return { ...current, participantIds: [...current.participantIds, memberId] };
    });
  }

  if (isLoading || !settings || !expenseForm) {
    return <main className="min-h-screen bg-slate-50 px-5 py-16 text-center text-slate-500 dark:bg-slate-950">{c.loading}</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="border-b border-slate-200 pb-8 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-[0.22em] text-teal-700 dark:text-teal-300">{c.eyebrow}</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{c.title}</h1>
              <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{c.subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200">{c.local}</span>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-teal-600 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300" onClick={() => setLanguage((item) => item === "zh" ? "en" : "zh")} type="button">{c.language}</button>
            </div>
          </div>
          <div className="mt-6"><AppNavigation current="expenses" language={language} /></div>
        </header>

        <p aria-live="polite" className={`mt-5 min-h-5 text-sm font-medium ${storageIssue ? "text-rose-700 dark:text-rose-300" : "text-teal-700 dark:text-teal-300"}`}>{status || (storageIssue ? c.storageError : "")}</p>

        <section className="mt-3 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold">{c.members}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{c.memberHint}</p>
            <div className="mt-4 flex gap-2">
              <input className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setMemberName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAddMember(); }} placeholder={c.memberPlaceholder} value={memberName} />
              <button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:opacity-60" disabled={isSaving} onClick={() => void handleAddMember()} type="button">{c.add}</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {settings.members.map((member) => <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 py-1 pl-3 pr-1 text-sm font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100" key={member.id}>{member.name}<button aria-label={`${c.remove} ${member.name}`} className="rounded-full px-1.5 py-0.5 text-xs text-teal-700 hover:bg-teal-200 dark:text-teal-200 dark:hover:bg-teal-900" disabled={isSaving} onClick={() => void handleRemoveMember(member)} type="button">×</button></span>)}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold">{c.categories}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{c.categoryHint}</p>
            <div className="mt-4 flex gap-2">
              <input className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAddCategory(); }} placeholder={c.categoryPlaceholder} value={categoryName} />
              <button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:opacity-60" disabled={isSaving} onClick={() => void handleAddCategory()} type="button">{c.add}</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {settings.categories.map((category) => <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200" key={category}>{category}<button aria-label={`${c.remove} ${category}`} className="rounded-full px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700" disabled={isSaving} onClick={() => void handleRemoveCategory(category)} type="button">×</button></span>)}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="text-2xl font-bold tracking-tight">{c.addExpense}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{c.currencyHint}</p></div>
            <p className="text-xs text-slate-500">{c.amountHint}</p>
          </div>
          {settings.members.length === 0 ? <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">{c.needsMembers}</p> : <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(event) => void handleAddExpense(event)}>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.description}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, title: event.target.value })} placeholder={c.descriptionPlaceholder} value={expenseForm.title} /></label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.date}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })} type="date" value={expenseForm.date} /></label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.category}<select className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} value={expenseForm.category}>{settings.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <div className="grid grid-cols-[1fr_7rem] gap-3"><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.amount}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" inputMode="decimal" onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} placeholder="0" value={expenseForm.amount} /></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.currency}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal uppercase outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" list="currency-options" maxLength={3} onChange={(event) => setExpenseForm({ ...expenseForm, currency: event.target.value.toUpperCase() })} value={expenseForm.currency} /></label></div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{c.paidBy}<select className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, paidBy: event.target.value })} value={expenseForm.paidBy}>{settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <fieldset className="md:col-span-2"><legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.shareWith}</legend><p className="mt-1 text-xs text-slate-500">{c.shareHint}</p><div className="mt-2 flex flex-wrap gap-2">{settings.members.map((member) => <label className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-semibold transition ${expenseForm.participantIds.includes(member.id) ? "border-teal-700 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100" : "border-slate-300 text-slate-500 dark:border-slate-700"}`} key={member.id}><input checked={expenseForm.participantIds.includes(member.id)} className="sr-only" onChange={() => toggleParticipant(member.id)} type="checkbox" />{member.name}</label>)}</div></fieldset>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">{c.notes}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setExpenseForm({ ...expenseForm, notes: event.target.value })} placeholder={c.notesPlaceholder} value={expenseForm.notes} /></label>
            <div className="md:col-span-2"><button className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{c.saveExpense}</button></div>
          </form>}
          <datalist id="currency-options">{currencyOptions.map((currency) => <option key={currency} value={currency} />)}</datalist>
        </section>

        <section className="mt-8" aria-labelledby="settlement-title">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Settlement</p><h2 className="mt-1 text-2xl font-bold tracking-tight" id="settlement-title">{c.settlement}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{c.settlementHint}</p></div>
          {settlementResult.error ? <p className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800 dark:border-rose-950 dark:bg-rose-950 dark:text-rose-100">{c.ledgerError}</p> : null}
          {!settlementResult.error && settlementResult.result?.currencies.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">{c.noExpenses}</p> : null}
          <div className="grid gap-5 lg:grid-cols-2">{settlementResult.result?.currencies.map((currencySettlement) => <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" key={`${currencySettlement.currency}-${currencySettlement.fraction_digits}`}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">{currencySettlement.currency}</p><h3 className="mt-1 text-xl font-bold">{c.totalSpent}: {formatMoneyFromMinorUnits(currencySettlement.total_spent_minor, currencySettlement.currency, currencySettlement.fraction_digits, language)}</h3></div></div>
            <div className="mt-5 grid gap-2">{currencySettlement.balances.map((balance) => {
              const member = memberById.get(balance.member_id);
              const label = balance.net_minor > 0 ? c.receives : balance.net_minor < 0 ? c.owes : c.balanced;
              const colour = balance.net_minor > 0 ? "text-teal-700 dark:text-teal-300" : balance.net_minor < 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-500";
              return <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800" key={balance.member_id}><span className="font-semibold">{member?.name ?? balance.member_id}</span><span className={`text-sm font-bold ${colour}`}>{label} {formatMoneyFromMinorUnits(Math.abs(balance.net_minor), currencySettlement.currency, currencySettlement.fraction_digits, language)}</span></div>;
            })}</div>
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{c.settlement}</p>{currencySettlement.transfers.length === 0 ? <p className="mt-2 text-sm text-slate-500">{c.noTransfers}</p> : <ul className="mt-3 space-y-2">{currencySettlement.transfers.map((transfer, index) => <li className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-3 text-sm dark:border-teal-900 dark:bg-teal-950" key={`${transfer.from_member_id}-${transfer.to_member_id}-${index}`}><strong>{memberById.get(transfer.from_member_id)?.name ?? transfer.from_member_id}</strong> {c.transfer} <strong>{memberById.get(transfer.to_member_id)?.name ?? transfer.to_member_id}</strong><span className="ml-2 font-bold text-teal-800 dark:text-teal-200">{formatMoneyFromMinorUnits(transfer.amount_minor, currencySettlement.currency, currencySettlement.fraction_digits, language)}</span></li>)}</ul>}</div>
          </article>)}</div>
        </section>

        <section className="mt-8" aria-labelledby="expenses-title">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Ledger</p><h2 className="mt-1 text-2xl font-bold tracking-tight" id="expenses-title">{c.expenses}</h2></div>
          {expenses.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">{c.noExpenses}</p> : <div className="grid gap-4 lg:grid-cols-2">{expenses.map((expense) => <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" key={expense.id}>
            <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{expense.category}</span><time className="text-xs font-medium text-slate-500">{expense.date}</time></div><h3 className="mt-3 text-lg font-bold">{expense.title}</h3></div><button className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-rose-300 hover:text-rose-700 dark:border-slate-700" disabled={isSaving} onClick={() => void handleDeleteExpense(expense.id)} type="button">{c.delete}</button></div>
            <p className="mt-4 text-2xl font-bold text-teal-800 dark:text-teal-300">{formatMoneyFromMinorUnits(expense.amount_minor, expense.currency, expense.fraction_digits, language)}</p>
            <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800"><p><span className="text-slate-500">{c.paidBy}: </span><strong>{memberById.get(expense.paid_by)?.name ?? expense.paid_by}</strong></p><p><span className="text-slate-500">{c.sharedBy}: </span>{expense.shares.map((share) => memberById.get(share.member_id)?.name ?? share.member_id).join("、")}</p>{expense.notes ? <p className="text-slate-500">{expense.notes}</p> : null}</div>
          </article>)}</div>}
        </section>
      </div>
    </main>
  );
}
