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
  currencies: CurrencySettlement[];
};

type BalanceInMinorUnits = { paid_minor: number; owed_minor: number };

function calculateCurrencySettlement(expenses: Expense[], members: ExpenseMember[], currency: string, fractionDigits: number): CurrencySettlement {
  const balances = new Map<string, BalanceInMinorUnits>(members.map((member) => [member.id, { paid_minor: 0, owed_minor: 0 }]));
  let totalSpent = 0;

  for (const expense of expenses) {
    const payer = balances.get(expense.paid_by);
    if (!payer) throw new Error(`Unknown payer: ${expense.paid_by}`);
    payer.paid_minor += expense.amount_minor;
    totalSpent += expense.amount_minor;

    for (const share of expense.shares) {
      const participant = balances.get(share.member_id);
      if (!participant) throw new Error(`Unknown participant: ${share.member_id}`);
      participant.owed_minor += share.amount_minor;
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
 * Calculates each currency independently so that unrelated currencies are never
 * silently combined with an assumed exchange rate.
 */
export function calculateExpenseSettlement(expenses: Expense[], members: ExpenseMember[]): ExpenseSettlement {
  const grouped = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const key = `${expense.currency}:${expense.fraction_digits}`;
    const group = grouped.get(key) ?? [];
    group.push(expense);
    grouped.set(key, group);
  }

  return {
    currencies: [...grouped.entries()]
      .map(([key, currencyExpenses]) => {
        const [currency, fractionDigits] = key.split(":");
        return calculateCurrencySettlement(currencyExpenses, members, currency ?? "", Number(fractionDigits));
      })
      .sort((first, second) => first.currency.localeCompare(second.currency)),
  };
}
