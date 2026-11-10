type Database = { all(sql: string): Promise<Record<string, unknown>[]> };
export function reconcile(databases: {
  main: Database;
  tombstones: Database;
}): Promise<{ done: number; removed: number; unknown: number }>;
