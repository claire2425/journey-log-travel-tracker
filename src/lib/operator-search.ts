import { OPERATOR_DIRECTORY, type OperatorDirectoryEntry, type OperatorMode } from "@/lib/operator-directory";

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function searchValues(operator: OperatorDirectoryEntry): string[] {
  return [operator.code, operator.label, operator.label_zh, ...operator.aliases].map(normalize);
}

function score(operator: OperatorDirectoryEntry, query: string): number | undefined {
  const [code, label, labelZh, ...aliases] = searchValues(operator);
  if (code === query) return 0;
  if (code.startsWith(query)) return 1;
  if ([label, labelZh, ...aliases].some((value) => value === query)) return 2;
  if ([label, labelZh, ...aliases].some((value) => value.startsWith(query))) return 3;
  if ([code, label, labelZh, ...aliases].some((value) => value.includes(query))) return 4;
  return undefined;
}

/** Searches the local common-operator directory without contacting a logo or timetable provider. */
export function searchOperators(mode: OperatorMode, query: string, limit = 8): OperatorDirectoryEntry[] {
  const needle = normalize(query);
  if (!needle) return [];

  const candidates: { operator: OperatorDirectoryEntry; index: number; score: number | undefined }[] = OPERATOR_DIRECTORY.map(
    (operator, index) => ({ operator, index, score: operator.mode === mode ? score(operator, needle) : undefined }),
  );

  return candidates
    .filter((candidate): candidate is { operator: OperatorDirectoryEntry; index: number; score: number } => candidate.score !== undefined)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      return left.operator.label.localeCompare(right.operator.label, "en") || left.index - right.index;
    })
    .slice(0, limit)
    .map((candidate) => candidate.operator);
}
