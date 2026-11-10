type Database = { all(sql: string): Promise<Record<string, unknown>[]> };
export function reconcile(options: {
  main: Database;
  tombstones: Database;
  dryRun?: boolean;
}): Promise<{ done: number; removed: number; unknown: number }>;
