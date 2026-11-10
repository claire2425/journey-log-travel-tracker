import { describe, expect, it } from "vitest";
import { calculateExpenseSettlement } from "@/lib/expense-settlement";
import { buildExpenseStatistics } from "@/lib/expense-statistics";
import { splitAmountEqually } from "@/lib/money";
import type { Expense, ExpenseMember } from "@/lib/types";

const members: ExpenseMember[] = [
  { id: "alice", name: "Alice" },
  { id: "ben", name: "Ben" },
];

function expense(overrides: Partial<Expense> = {}): Expense {
  const originalShares = splitAmountEqually(12000, ["alice", "ben"]);
  return {
    id: "food",
    title: "Dinner",
    category: "餐飲",
    amount_minor: 12000,
    currency: "TWD",
    fraction_digits: 2,
    paid_by: "alice",
    shares: originalShares,
    settlement: {
      currency: "TWD",
      fraction_digits: 2,
      amount_minor: 12000,
      shares: originalShares,
      rate: "1",
      source: "identity",
    },
    date: "2026-11-10",
    notes: "",
    created_at: "2026-11-10T00:00:00+00:00",
    updated_at: "2026-11-10T00:00:00+00:00",
    ...overrides,
  };
}

describe("expense statistics", () => {
  it("groups frozen converted values by category and keeps paid and shared amounts distinct", () => {
    const railOriginalShares = splitAmountEqually(1000, ["alice", "ben"]);
    const expenses = [
      expense(),
      expense({
        id: "rail",
        title: "Rail tickets",
        category: "交通",
        amount_minor: 1000,
        currency: "JPY",
        fraction_digits: 0,
        paid_by: "ben",
        shares: railOriginalShares,
        settlement: {
          currency: "TWD",
          fraction_digits: 2,
          amount_minor: 220,
          shares: splitAmountEqually(220, ["alice", "ben"]),
          rate: "0.22",
          source: "manual",
        },
      }),
    ];
    const settlement = calculateExpenseSettlement(expenses, members, "TWD").settlement;
    const statistics = buildExpenseStatistics(expenses, members, settlement);

    expect(statistics).toMatchObject({ currency: "TWD", fraction_digits: 2, total_spent_minor: 12220 });
    expect(statistics?.categories).toEqual([
      { category: "餐飲", amount_minor: 12000, count: 1 },
      { category: "交通", amount_minor: 220, count: 1 },
    ]);
    expect(statistics?.members).toEqual([
      { member_id: "alice", name: "Alice", paid_minor: 12000, share_minor: 6110, net_minor: 5890 },
      { member_id: "ben", name: "Ben", paid_minor: 220, share_minor: 6110, net_minor: -5890 },
    ]);
    expect(statistics?.categories.reduce((sum, category) => sum + category.amount_minor, 0)).toBe(statistics?.total_spent_minor);
  });

  it("withholds analytics when any expense lacks a matching confirmed settlement", () => {
    const valid = expense();
    const incomplete = expense({ id: "missing", settlement: null });
    const result = calculateExpenseSettlement([valid, incomplete], members, "TWD");

    expect(result.settlement).toBeNull();
    expect(buildExpenseStatistics([valid, incomplete], members, result.settlement)).toBeNull();
  });
});
