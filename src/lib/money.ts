import type { ExpenseSettlementSnapshot } from "@/lib/types";

export function getCurrencyFractionDigits(currency: string) {
  try {
    const fractionDigits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return Number.isInteger(fractionDigits) ? fractionDigits : 2;
  } catch {
    return 2;
  }
}

export function parseMoneyToMinorUnits(value: string, fractionDigits: number): number | undefined {
  const match = value.trim().match(/^(\d+)(?:\.(\d*))?$/);
  if (!match) return undefined;
  const whole = Number(match[1]);
  const decimal = match[2] ?? "";
  if (!Number.isSafeInteger(whole) || decimal.length > fractionDigits) return undefined;
  const scale = 10 ** fractionDigits;
  const fraction = Number(decimal.padEnd(fractionDigits, "0"));
  const amount = whole * scale + fraction;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}

export function formatMoneyFromMinorUnits(amountMinor: number, currency: string, fractionDigits: number, language: "zh" | "en") {
  const amount = amountMinor / (10 ** fractionDigits);
  try {
    return new Intl.NumberFormat(language === "zh" ? "zh-TW" : "en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(fractionDigits)}`;
  }
}

export function splitAmountEqually(amountMinor: number, memberIds: string[]) {
  const perPerson = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor % memberIds.length;
  return memberIds.map((memberId, index) => ({ member_id: memberId, amount_minor: perPerson + (index < remainder ? 1 : 0) }));
}

const positiveDecimalRatePattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

type DecimalRate = {
  numerator: bigint;
  denominator: bigint;
};

function parsePositiveDecimalRate(value: string): DecimalRate | undefined {
  const rate = value.trim();
  if (rate.length === 0 || rate.length > 80 || !positiveDecimalRatePattern.test(rate)) return undefined;

  const [whole, decimal = ""] = rate.split(".");
  const digits = `${whole ?? ""}${decimal}`;
  try {
    const numerator = BigInt(digits);
    if (numerator <= 0n) return undefined;
    return { numerator, denominator: 10n ** BigInt(decimal.length) };
  } catch {
    return undefined;
  }
}

/** True when a value is a plain, positive base-10 decimal (not scientific notation). */
export function isValidPositiveDecimalRate(value: string): boolean {
  return parsePositiveDecimalRate(value) !== undefined;
}

/**
 * Converts a minor-unit payment amount to a settlement currency using exact
 * integer arithmetic. `rate` means one payment-currency unit in settlement
 * currency units. The returned result is rounded half up to a target minor
 * unit, or is undefined when the input cannot be represented safely.
 */
export function convertMoneyToSettlementMinor(
  amountMinor: number,
  sourceFractionDigits: number,
  rate: string,
  targetFractionDigits: number,
): number | undefined {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return undefined;
  if (!Number.isInteger(sourceFractionDigits) || sourceFractionDigits < 0 || sourceFractionDigits > 20) return undefined;
  if (!Number.isInteger(targetFractionDigits) || targetFractionDigits < 0 || targetFractionDigits > 20) return undefined;

  const parsedRate = parsePositiveDecimalRate(rate);
  if (!parsedRate) return undefined;

  const sourceScale = 10n ** BigInt(sourceFractionDigits);
  const targetScale = 10n ** BigInt(targetFractionDigits);
  const numerator = BigInt(amountMinor) * parsedRate.numerator * targetScale;
  const denominator = sourceScale * parsedRate.denominator;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : 0n);

  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(rounded);
}

function splitSettlementAmountProportionally(
  settlementAmountMinor: number,
  originalAmountMinor: number,
  originalShares: Array<{ member_id: string; amount_minor: number }>,
) {
  if (!Number.isSafeInteger(settlementAmountMinor) || settlementAmountMinor < 0) return undefined;
  if (!Number.isSafeInteger(originalAmountMinor) || originalAmountMinor <= 0) return undefined;
  if (originalShares.length === 0 || originalShares.some((share) => !Number.isSafeInteger(share.amount_minor) || share.amount_minor < 0)) return undefined;
  if (originalShares.reduce((sum, share) => sum + share.amount_minor, 0) !== originalAmountMinor) return undefined;

  const total = BigInt(settlementAmountMinor);
  const originalTotal = BigInt(originalAmountMinor);
  const shares = originalShares.map((share, index) => {
    const scaled = total * BigInt(share.amount_minor);
    return {
      index,
      member_id: share.member_id,
      amount_minor: Number(scaled / originalTotal),
      remainder: scaled % originalTotal,
    };
  });
  const allocated = shares.reduce((sum, share) => sum + share.amount_minor, 0);
  const remainderCount = settlementAmountMinor - allocated;
  if (!Number.isSafeInteger(allocated) || remainderCount < 0 || remainderCount > shares.length) return undefined;

  const ranked = [...shares].sort((first, second) => {
    if (first.remainder === second.remainder) return first.index - second.index;
    return first.remainder > second.remainder ? -1 : 1;
  });
  for (let index = 0; index < remainderCount; index += 1) {
    const share = ranked[index];
    if (share) share.amount_minor += 1;
  }

  return shares.map(({ member_id, amount_minor }) => ({ member_id, amount_minor }));
}

export type BuildExpenseSettlementSnapshotInput = {
  original_amount_minor: number;
  original_fraction_digits: number;
  original_shares: Array<{ member_id: string; amount_minor: number }>;
  currency: string;
  fraction_digits: number;
  rate: string;
  source: ExpenseSettlementSnapshot["source"];
  provider?: string;
  rate_date?: string;
  quoted_at?: string;
};

/**
 * Creates a frozen settlement value and preserves each participant's relative
 * share. The source expense itself stays untouched, so its original payment
 * currency remains auditable.
 */
export function buildExpenseSettlementSnapshot(input: BuildExpenseSettlementSnapshotInput): ExpenseSettlementSnapshot | undefined {
  const amount_minor = convertMoneyToSettlementMinor(
    input.original_amount_minor,
    input.original_fraction_digits,
    input.rate,
    input.fraction_digits,
  );
  if (!amount_minor || amount_minor < 1) return undefined;

  const shares = splitSettlementAmountProportionally(amount_minor, input.original_amount_minor, input.original_shares);
  if (!shares) return undefined;

  return {
    currency: input.currency.trim().toUpperCase(),
    fraction_digits: input.fraction_digits,
    amount_minor,
    shares,
    rate: input.rate.trim(),
    source: input.source,
    ...(input.provider?.trim() ? { provider: input.provider.trim() } : {}),
    ...(input.rate_date ? { rate_date: input.rate_date } : {}),
    ...(input.quoted_at ? { quoted_at: input.quoted_at } : {}),
  };
}
