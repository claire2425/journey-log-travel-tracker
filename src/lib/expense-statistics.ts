import type { CurrencySettlement } from "@/lib/expense-settlement";
import type { Expense, ExpenseMember } from "@/lib/types";

export type ExpenseCategoryStatistic = {
  category: string;
  amount_minor: number;
  count: number;
};

export type ExpenseMemberStatistic = {
  member_id: string;
  name: string;
  paid_minor: number;
  share_minor: number;
  net_minor: number;
};

export type ExpenseStatistics = {
  currency: string;
  fraction_digits: number;
  total_spent_minor: number;
  categories: ExpenseCategoryStatistic[];
  members: ExpenseMemberStatistic[];
  transfers: CurrencySettlement["transfers"];
};

function safeAdd(left: number, right: number) {
  const total = left + right;
  if (!Number.isSafeInteger(total)) throw new Error("Expense report total exceeds safe integer precision.");
  return total;
}

/**
 * Derives chart/export figures from the same frozen settlement snapshots used
 * by the settlement plan. It intentionally returns null rather than showing a
 * partial sum when a ledger still contains an unconverted or mismatched entry.
 */
export function buildExpenseStatistics(
  expenses: Expense[],
  members: ExpenseMember[],
  settlement: CurrencySettlement | null,
): ExpenseStatistics | null {
  if (!settlement || expenses.length === 0) return null;

  const expectedMemberIds = new Set(members.map((member) => member.id));
  const balances = new Map(settlement.balances.map((balance) => [balance.member_id, balance]));
  if (balances.size !== members.length || members.some((member) => !balances.has(member.id))) return null;

  const categoryTotals = new Map<string, { amount_minor: number; count: number }>();
  let categoryTotal = 0;

  for (const expense of expenses) {
    const snapshot = expense.settlement;
    if (!snapshot || snapshot.currency !== settlement.currency || snapshot.fraction_digits !== settlement.fraction_digits) return null;
    if (!expectedMemberIds.has(expense.paid_by)) return null;

    const current = categoryTotals.get(expense.category) ?? { amount_minor: 0, count: 0 };
    current.amount_minor = safeAdd(current.amount_minor, snapshot.amount_minor);
    current.count += 1;
    categoryTotals.set(expense.category, current);
    categoryTotal = safeAdd(categoryTotal, snapshot.amount_minor);
  }

  // A report is only valid if the independently grouped category total matches
  // the authoritative settlement total exactly.
  if (categoryTotal !== settlement.total_spent_minor) return null;

  return {
    currency: settlement.currency,
    fraction_digits: settlement.fraction_digits,
    total_spent_minor: settlement.total_spent_minor,
    categories: [...categoryTotals.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((left, right) => right.amount_minor - left.amount_minor || left.category.localeCompare(right.category)),
    members: members.map((member) => {
      const balance = balances.get(member.id);
      if (!balance) throw new Error(`Missing member balance: ${member.id}`);
      return {
        member_id: member.id,
        name: member.name,
        paid_minor: balance.paid_minor,
        share_minor: balance.owed_minor,
        net_minor: balance.net_minor,
      };
    }),
    transfers: settlement.transfers,
  };
}
