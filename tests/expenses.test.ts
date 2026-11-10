import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { JourneyDatabase } from "@/db/index";
import { addExpense, createDefaultExpenseLedgerSettings, deleteExpense, getExpenseLedgerSettings, listExpenses, saveExpenseLedgerSettings } from "@/db/expenses";
import { ExpenseSchema } from "@/lib/types";

describe("expense repository", () => {
  let database: JourneyDatabase;

  beforeEach(async () => {
    database = new JourneyDatabase(`expenses-${crypto.randomUUID()}`);
    await database.open();
  });

  it("creates local ledger settings and stores an expense", async () => {
    const initial = await getExpenseLedgerSettings(database);
    expect(initial.categories).toContain("餐飲");
    const settings = await saveExpenseLedgerSettings({
      ...initial,
      members: [{ id: "claire", name: "Claire" }, { id: "lee", name: "Lee" }],
      categories: [...initial.categories, "伴手禮"],
    }, database);
    await addExpense({
      id: "expense-1",
      title: "Lunch",
      category: "餐飲",
      amount_minor: 36000,
      currency: "TWD",
      fraction_digits: 2,
      paid_by: "claire",
      shares: [{ member_id: "claire", amount_minor: 18000 }, { member_id: "lee", amount_minor: 18000 }],
      date: "2026-11-10",
      notes: "",
      created_at: "2026-11-10T00:00:00+00:00",
      updated_at: "2026-11-10T00:00:00+00:00",
    }, database);

    expect(settings.members).toHaveLength(2);
    expect((await listExpenses(database))[0]).toMatchObject({ id: "expense-1", amount_minor: 36000 });
    await deleteExpense("expense-1", database);
    expect(await listExpenses(database)).toHaveLength(0);
  });

  it("rejects an expense whose shares do not add up", () => {
    expect(() => ExpenseSchema.parse({
      id: "bad-expense", title: "Bad", category: "其他", amount_minor: 100, currency: "TWD", fraction_digits: 2,
      paid_by: "claire", shares: [{ member_id: "claire", amount_minor: 99 }], date: "2026-11-10", notes: "",
      created_at: "2026-11-10T00:00:00+00:00", updated_at: "2026-11-10T00:00:00+00:00",
    })).toThrow();
  });

  it("starts from a fresh default settings object", () => {
    const first = createDefaultExpenseLedgerSettings("2026-11-10T00:00:00+00:00");
    const second = createDefaultExpenseLedgerSettings("2026-11-10T00:00:00+00:00");
    first.categories.push("Custom");
    expect(second.categories).not.toContain("Custom");
  });
});
