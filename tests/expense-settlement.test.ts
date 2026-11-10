import { describe, expect, it } from "vitest";
import { calculateExpenseSettlement } from "@/lib/expense-settlement";
import { splitAmountEqually } from "@/lib/money";
import type { Expense, ExpenseMember } from "@/lib/types";

const members: ExpenseMember[] = [
  { id: "alice", name: "Alice" },
  { id: "ben", name: "Ben" },
  { id: "claire", name: "Claire" },
];

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",
    title: "Dinner",
    category: "餐飲",
    amount_minor: 30000,
    currency: "TWD",
    fraction_digits: 2,
    paid_by: "alice",
    shares: splitAmountEqually(30000, ["alice", "ben", "claire"]),
    date: "2026-11-10",
    notes: "",
    created_at: "2026-11-10T00:00:00+00:00",
    updated_at: "2026-11-10T00:00:00+00:00",
    ...overrides,
  };
}

describe("expense settlement", () => {
  it("settles an equally split expense with integer minor units", () => {
    const result = calculateExpenseSettlement([expense()], members);

    expect(result.currencies).toHaveLength(1);
    expect(result.currencies[0]).toMatchObject({ currency: "TWD", fraction_digits: 2, total_spent_minor: 30000 });
    expect(result.currencies[0]?.transfers).toEqual([
      { from_member_id: "ben", to_member_id: "alice", amount_minor: 10000 },
      { from_member_id: "claire", to_member_id: "alice", amount_minor: 10000 },
    ]);
  });

  it("keeps different currencies separate instead of applying an implicit exchange rate", () => {
    const result = calculateExpenseSettlement([
      expense({ id: "jpy", amount_minor: 3000, currency: "JPY", fraction_digits: 0, shares: splitAmountEqually(3000, ["alice", "ben"]) }),
      expense({ id: "usd", amount_minor: 1000, currency: "USD", fraction_digits: 2, paid_by: "ben", shares: splitAmountEqually(1000, ["alice", "ben"]) }),
    ], members);

    expect(result.currencies.map((settlement) => settlement.currency)).toEqual(["JPY", "USD"]);
    expect(result.currencies[0]?.transfers).toEqual([{ from_member_id: "ben", to_member_id: "alice", amount_minor: 1500 }]);
    expect(result.currencies[1]?.transfers).toEqual([{ from_member_id: "alice", to_member_id: "ben", amount_minor: 500 }]);
  });

  it("distributes a remainder without losing a minor unit", () => {
    expect(splitAmountEqually(1001, ["alice", "ben", "claire"])).toEqual([
      { member_id: "alice", amount_minor: 334 },
      { member_id: "ben", amount_minor: 334 },
      { member_id: "claire", amount_minor: 333 },
    ]);
  });
});
