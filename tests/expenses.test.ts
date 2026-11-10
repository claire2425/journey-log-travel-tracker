import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { JourneyDatabase } from "@/db/index";
import { addExpense, createDefaultExpenseLedgerSettings, deleteExpense, getExpenseLedgerSettings, listExpenses, saveExpenseLedgerSettings, updateExpense } from "@/db/expenses";
import { ExpenseSchema } from "@/lib/types";

const createdAt = "2026-11-10T00:00:00+00:00";

function expenseInput() {
  return {
    id: "expense-1",
    title: "Lunch",
    category: "餐飲",
    amount_minor: 36000,
    currency: "TWD",
    fraction_digits: 2,
    paid_by: "claire",
    shares: [{ member_id: "claire", amount_minor: 18000 }, { member_id: "lee", amount_minor: 18000 }],
    settlement: {
      currency: "TWD",
      fraction_digits: 2,
      amount_minor: 36000,
      shares: [{ member_id: "claire", amount_minor: 18000 }, { member_id: "lee", amount_minor: 18000 }],
      rate: "1",
      source: "identity" as const,
    },
    date: "2026-11-10",
    notes: "",
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("expense repository", () => {
  let database: JourneyDatabase;

  beforeEach(async () => {
    database = new JourneyDatabase(`expenses-${crypto.randomUUID()}`);
    await database.open();
  });

  it("creates a local ledger with a default final currency, stores, and updates an expense", async () => {
    const initial = await getExpenseLedgerSettings(database);
    expect(initial.categories).toContain("餐飲");
    expect(initial.settlement_currency).toBe("TWD");
    const settings = await saveExpenseLedgerSettings({
      ...initial,
      members: [{ id: "claire", name: "Claire" }, { id: "lee", name: "Lee" }],
      categories: [...initial.categories, "伴手禮"],
      settlement_currency: " usd ",
    }, database);
    await addExpense(expenseInput(), database);
    const stored = (await listExpenses(database))[0];
    if (!stored) throw new Error("Expected saved expense");
    const updated = await updateExpense({ ...stored, title: "Brunch" }, database);

    expect(settings.members).toHaveLength(2);
    expect(settings.settlement_currency).toBe("USD");
    expect(updated).toMatchObject({ id: "expense-1", title: "Brunch", amount_minor: 36000 });
    expect(updated.updated_at).not.toBe(createdAt);
    expect((await listExpenses(database))[0]).toMatchObject({ id: "expense-1", title: "Brunch", settlement: { rate: "1" } });
    await deleteExpense("expense-1", database);
    expect(await listExpenses(database)).toHaveLength(0);
  });

  it("rejects an expense whose original shares do not add up", () => {
    expect(() => ExpenseSchema.parse({
      ...expenseInput(),
      id: "bad-expense",
      shares: [{ member_id: "claire", amount_minor: 99 }],
      settlement: {
        currency: "TWD", fraction_digits: 2, amount_minor: 100,
        shares: [{ member_id: "claire", amount_minor: 100 }], rate: "1", source: "identity",
      },
    })).toThrow();
  });

  it("rejects a settlement snapshot whose shares do not add up", () => {
    expect(() => ExpenseSchema.parse({
      ...expenseInput(),
      settlement: {
        currency: "TWD", fraction_digits: 2, amount_minor: 36000,
        shares: [{ member_id: "claire", amount_minor: 18000 }, { member_id: "lee", amount_minor: 17999 }],
        rate: "1", source: "identity",
      },
    })).toThrow();
  });

  it("migrates v3 ledgers to an explicit unconverted state", async () => {
    const name = `legacy-expenses-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(3).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
      expense_entries: "id, date, paid_by, currency, category",
      expense_settings: "id",
    });
    await legacy.open();
    await legacy.table("expense_settings").put({
      id: "expense-ledger",
      members: [{ id: "claire", name: "Claire" }],
      categories: ["餐飲"],
      created_at: createdAt,
      updated_at: createdAt,
    });
    await legacy.table("expense_entries").put({
      ...expenseInput(),
      settlement: undefined,
    });
    legacy.close();

    const upgraded = new JourneyDatabase(name);
    await upgraded.open();
    expect((await getExpenseLedgerSettings(upgraded)).settlement_currency).toBeNull();
    expect((await listExpenses(upgraded))[0]?.settlement).toBeNull();
    upgraded.close();
    await Dexie.delete(name);
  });

  it("starts from a fresh default settings object", () => {
    const first = createDefaultExpenseLedgerSettings(createdAt);
    const second = createDefaultExpenseLedgerSettings(createdAt);
    first.categories.push("Custom");
    expect(second.categories).not.toContain("Custom");
    expect(second.settlement_currency).toBe("TWD");
  });
});
