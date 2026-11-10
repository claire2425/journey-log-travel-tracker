import { db as defaultDb, type JourneyDatabase } from "@/db/index";
import { ExpenseLedgerSettingsSchema, ExpenseSchema, type Expense, type ExpenseLedgerSettings } from "@/lib/types";

export const EXPENSE_LEDGER_ID = "expense-ledger";

const defaultCategories = ["餐飲", "交通", "住宿", "景點", "購物", "其他"];

function now() {
  return new Date().toISOString();
}

export function createDefaultExpenseLedgerSettings(createdAt = now()): ExpenseLedgerSettings {
  return {
    id: EXPENSE_LEDGER_ID,
    members: [],
    categories: [...defaultCategories],
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export async function getExpenseLedgerSettings(database: JourneyDatabase = defaultDb): Promise<ExpenseLedgerSettings> {
  const existing = await database.expense_settings.get(EXPENSE_LEDGER_ID);
  if (existing) return ExpenseLedgerSettingsSchema.parse(existing);

  const settings = createDefaultExpenseLedgerSettings();
  await database.expense_settings.put(settings);
  return settings;
}

export async function saveExpenseLedgerSettings(input: ExpenseLedgerSettings, database: JourneyDatabase = defaultDb): Promise<ExpenseLedgerSettings> {
  const settings = ExpenseLedgerSettingsSchema.parse({
    ...input,
    id: EXPENSE_LEDGER_ID,
    members: input.members.map((member) => ({ ...member, name: member.name.trim() })),
    categories: input.categories.map((category) => category.trim()),
    updated_at: now(),
  });
  await database.expense_settings.put(settings);
  return settings;
}

export async function addExpense(input: Expense, database: JourneyDatabase = defaultDb): Promise<string> {
  const expense = ExpenseSchema.parse({
    ...input,
    title: input.title.trim(),
    category: input.category.trim(),
    currency: input.currency.trim().toUpperCase(),
    notes: input.notes.trim(),
  });
  await database.expense_entries.add(expense);
  return expense.id;
}

export async function listExpenses(database: JourneyDatabase = defaultDb): Promise<Expense[]> {
  const expenses = await database.expense_entries.orderBy("date").reverse().toArray();
  return expenses.sort((first, second) => second.date.localeCompare(first.date) || second.created_at.localeCompare(first.created_at));
}

export async function deleteExpense(id: string, database: JourneyDatabase = defaultDb): Promise<void> {
  await database.expense_entries.delete(id);
}
