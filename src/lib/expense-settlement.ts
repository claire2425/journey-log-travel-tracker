import { getCurrencyFractionDigits } from "@/lib/money";
import type { Expense, ExpenseMember } from "@/lib/types";

export type MemberBalance = {
  member_id: string;
  paid_minor: number;
  owed_minor: number;
  net_minor: number;
};

export type SettlementTransfer = {
  from_member_id: string;
  to_member_id: string;
  amount_minor: number;
};

export type CurrencySettlement = {
  currency: string;
  fraction_digits: number;
  total_spent_minor: number;
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
};

export type ExpenseSettlement = {
  /** The only final total. It is null whenever any expense still needs a rate snapshot. */
  settlement: CurrencySettlement | null;
  /** IDs that must be converted before a safe final total can be shown. */
  needs_conversion: string[];
  /** @deprecated Compatibility view containing zero or one unified settlement. */
  currencies: CurrencySettlement[];
};

type BalanceInMinorUnits = { paid_minor: number; owed_minor: number };

function addMinorUnits(left: number, right: number): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) throw new Error("Settlement total exceeds safe integer precision.");
  return total;
}

function calculateUnifiedSettlement(expenses: Expense[], members: ExpenseMember[], currency: string, fractionDigits: number): CurrencySettlement {
  const balances = new Map<string, BalanceInMinorUnits>(members.map((member) => [member.id, { paid_minor: 0, owed_minor: 0 }]));
  let totalSpent = 0;

  for (const expense of expenses) {
    const snapshot = expense.settlement;
    if (!snapshot) throw new Error(`Expense ${expense.id} has no settlement snapshot.`);

    const payer = balances.get(expense.paid_by);
    if (!payer) throw new Error(`Unknown payer: ${expense.paid_by}`);
    payer.paid_minor = addMinorUnits(payer.paid_minor, snapshot.amount_minor);
    totalSpent = addMinorUnits(totalSpent, snapshot.amount_minor);

    for (const share of snapshot.shares) {
      const participant = balances.get(share.member_id);
      if (!participant) throw new Error(`Unknown participant: ${share.member_id}`);
      participant.owed_minor = addMinorUnits(participant.owed_minor, share.amount_minor);
    }
  }

  const balanceEntries = members.map((member) => {
    const balance = balances.get(member.id);
    if (!balance) throw new Error(`Unknown member: ${member.id}`);
    return {
      member_id: member.id,
      paid_minor: balance.paid_minor,
      owed_minor: balance.owed_minor,
      net_minor: balance.paid_minor - balance.owed_minor,
    };
  });
  const debtors = balanceEntries.filter((balance) => balance.net_minor < 0).map((balance) => ({ id: balance.member_id, amount_minor: -balance.net_minor }));
  const creditors = balanceEntries.filter((balance) => balance.net_minor > 0).map((balance) => ({ id: balance.member_id, amount_minor: balance.net_minor }));
  const transfers: SettlementTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (!debtor || !creditor) break;
    const amount_minor = Math.min(debtor.amount_minor, creditor.amount_minor);
    transfers.push({ from_member_id: debtor.id, to_member_id: creditor.id, amount_minor });
    debtor.amount_minor -= amount_minor;
    creditor.amount_minor -= amount_minor;
    if (debtor.amount_minor === 0) debtorIndex += 1;
    if (creditor.amount_minor === 0) creditorIndex += 1;
  }

  return { currency, fraction_digits: fractionDigits, total_spent_minor: totalSpent, balances: balanceEntries, transfers };
}

/**
 * Calculates one shared final settlement from frozen per-expense conversion
 * snapshots. A partially converted ledger intentionally returns no monetary
 * totals: mixing converted and unconverted entries would be misleading.
 */
export function calculateExpenseSettlement(
  expenses: Expense[],
  members: ExpenseMember[],
  settlementCurrency: string | null = null,
): ExpenseSettlement {
  if (expenses.length === 0) {
    return { settlement: null, needs_conversion: [], currencies: [] };
  }

  const targetCurrency = settlementCurrency?.trim().toUpperCase() || null;
  if (!targetCurrency) {
    return { settlement: null, needs_conversion: expenses.map((expense) => expense.id), currencies: [] };
  }

  let targetFractionDigits: number | undefined;
  const needs_conversion: string[] = [];
  for (const expense of expenses) {
    const snapshot = expense.settlement;
    if (!snapshot || snapshot.currency !== targetCurrency) {
      needs_conversion.push(expense.id);
      continue;
    }
    if (targetFractionDigits === undefined) {
      targetFractionDigits = snapshot.fraction_digits;
      continue;
    }
    if (snapshot.fraction_digits !== targetFractionDigits) needs_conversion.push(expense.id);
  }

  if (needs_conversion.length > 0) {
    return { settlement: null, needs_conversion, currencies: [] };
  }

  const settlement = calculateUnifiedSettlement(
    expenses,
    members,
    targetCurrency,
    targetFractionDigits ?? getCurrencyFractionDigits(targetCurrency),
  );
  return { settlement, needs_conversion: [], currencies: [settlement] };
}
