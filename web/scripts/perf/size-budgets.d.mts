type Budget =
  | {
      name: string;
      pattern: RegExp;
      /** Count only rows this HTML page links as stylesheets. */
      entry?: string;
      limit: number;
      absent?: never;
    }
  /** No built file may match. */
  | {
      name: string;
      pattern: RegExp;
      absent: true;
      entry?: never;
      limit?: never;
    };
export const budgets: Budget[];
export function checkBudgets(
  rows: { file: string; brotli: number; entries?: string[] }[],
  limits?: Budget[],
): { name: string; brotli: number; limit: number }[];
export function linkedStylesheets(html: string): string[];
