type Budget = { name: string; pattern: RegExp; limit: number };
export const budgets: Budget[];
export function checkBudgets(
  rows: { file: string; brotli: number }[],
  limits?: Budget[],
): { name: string; brotli: number; limit: number }[];
