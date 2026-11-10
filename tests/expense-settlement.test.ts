import { describe, expect, it } from "vitest";
import { calculateExpenseSettlement } from "@/lib/expense-settlement";
import { buildExpenseSettlementSnapshot, convertMoneyToSettlementMinor, splitAmountEqually } from "@/lib/money";
import type { Expense, ExpenseMember } from "@/lib/types";

const members: ExpenseMember[] = [
  { id: "alice", name: "Alice" },
  { id: "ben", name: "Ben" },
  { id: "claire", name: "Claire" },
];

function expense(overrides: Partial<Expense> = {}): Expense {
  const shares = splitAmountEqually(30000, ["alice", "ben", "claire"]);
  return {
    id: "expense-1",
    title: "Dinner",
    category: "餐飲",
    amount_minor: 30000,
    currency: "TWD",
    fraction_digits: 2,
    paid_by: "alice",
    shares,
    settlement: {
      currency: "TWD",
      fraction_digits: 2,
      amount_minor: 30000,
      shares,
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

describe("expense settlement", () => {
  it("does not create a zero-value settlement for an empty ledger", () => {
    const result = calculateExpenseSettlement([], members, "TWD");

    expect(result).toEqual({ settlement: null, needs_conversion: [], currencies: [] });
  });

  it("settles an equally split expense in the chosen final currency", () => {
    const result = calculateExpenseSettlement([expense()], members, "TWD");

    expect(result.needs_conversion).toEqual([]);
    expect(result.settlement).toMatchObject({ currency: "TWD", fraction_digits: 2, total_spent_minor: 30000 });
    expect(result.settlement?.transfers).toEqual([
      { from_member_id: "ben", to_member_id: "alice", amount_minor: 10000 },
      { from_member_id: "claire", to_member_id: "alice", amount_minor: 10000 },
    ]);
  });

  it("combines mixed payment currencies only through frozen snapshots", () => {
    const jpyShares = splitAmountEqually(3000, ["alice", "ben"]);
    const usdShares = splitAmountEqually(1000, ["alice", "ben"]);
    const result = calculateExpenseSettlement([
      expense({
        id: "jpy",
        amount_minor: 3000,
        currency: "JPY",
        fraction_digits: 0,
        shares: jpyShares,
        settlement: {
          currency: "TWD",
          fraction_digits: 2,
          amount_minor: 660,
          shares: splitAmountEqually(660, ["alice", "ben"]),
          rate: "0.22",
          source: "manual",
        },
      }),
      expense({
        id: "usd",
        amount_minor: 1000,
        currency: "USD",
        fraction_digits: 2,
        paid_by: "ben",
        shares: usdShares,
        settlement: {
          currency: "TWD",
          fraction_digits: 2,
          amount_minor: 31500,
          shares: splitAmountEqually(31500, ["alice", "ben"]),
          rate: "31.5",
          source: "automatic",
          provider: "Frankfurter",
          rate_date: "2026-11-10",
          quoted_at: "2026-11-10T00:00:00+00:00",
        },
      }),
    ], members, "TWD");

    expect(result.needs_conversion).toEqual([]);
    expect(result.settlement).toMatchObject({ currency: "TWD", fraction_digits: 2, total_spent_minor: 32160 });
    expect(result.settlement?.transfers).toEqual([{ from_member_id: "alice", to_member_id: "ben", amount_minor: 15420 }]);
  });

  it("withholds the whole final total when a rate is missing or points to another target", () => {
    const noRate = expense({ id: "missing-rate", settlement: null });
    const wrongTarget = expense({
      id: "wrong-target",
      settlement: {
        currency: "USD",
        fraction_digits: 2,
        amount_minor: 1000,
        shares: splitAmountEqually(1000, ["alice", "ben", "claire"]),
        rate: "0.03",
        source: "manual",
      },
    });

    const result = calculateExpenseSettlement([noRate, wrongTarget], members, "TWD");
    expect(result.settlement).toBeNull();
    expect(result.currencies).toEqual([]);
    expect(result.needs_conversion).toEqual(["missing-rate", "wrong-target"]);
  });

  it("requires a selected final currency before calculating totals", () => {
    const result = calculateExpenseSettlement([expense()], members, null);
    expect(result.settlement).toBeNull();
    expect(result.needs_conversion).toEqual(["expense-1"]);
  });

  it("converts using exact decimal arithmetic and half-up minor-unit rounding", () => {
    expect(convertMoneyToSettlementMinor(199, 2, "30.5", 0)).toBe(61);
    expect(convertMoneyToSettlementMinor(Number.MAX_SAFE_INTEGER, 0, "1", 0)).toBe(Number.MAX_SAFE_INTEGER);
    expect(convertMoneyToSettlementMinor(100, 2, "not-a-rate", 2)).toBeUndefined();
  });

  it("preserves unequal original shares when freezing a converted snapshot", () => {
    const snapshot = buildExpenseSettlementSnapshot({
      original_amount_minor: 100,
      original_fraction_digits: 2,
      original_shares: [{ member_id: "alice", amount_minor: 75 }, { member_id: "ben", amount_minor: 25 }],
      currency: "TWD",
      fraction_digits: 2,
      rate: "1.01",
      source: "manual",
    });

    expect(snapshot).toMatchObject({
      amount_minor: 101,
      shares: [{ member_id: "alice", amount_minor: 76 }, { member_id: "ben", amount_minor: 25 }],
    });
  });

  it("distributes a remainder without losing a minor unit", () => {
    expect(splitAmountEqually(1001, ["alice", "ben", "claire"])).toEqual([
      { member_id: "alice", amount_minor: 334 },
      { member_id: "ben", amount_minor: 334 },
      { member_id: "claire", amount_minor: 333 },
    ]);
  });
});
