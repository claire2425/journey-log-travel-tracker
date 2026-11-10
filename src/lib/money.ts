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
