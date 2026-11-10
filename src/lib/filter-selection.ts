/** Adds or removes one option from a multi-select filter. */
export function toggleSelection<T>(selected: readonly T[], value: T): T[] | undefined {
  const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
  return next.length ? next : undefined;
}

/** Returns whether every currently available option is selected. */
export function hasAllSelections<T>(selected: readonly T[], options: readonly T[]): boolean {
  return options.length > 0 && options.every((option) => selected.includes(option));
}

/** Selects every option, or clears this one group when all are already selected. */
export function toggleAllSelections<T>(selected: readonly T[], options: readonly T[]): T[] | undefined {
  return hasAllSelections(selected, options) ? undefined : [...options];
}
