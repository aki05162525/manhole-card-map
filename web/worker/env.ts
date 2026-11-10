// The subset of the D1 client API this Worker uses.
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface Env {
  // Absent in production until the database is created, and always in
  // previews: the API then answers 404.
  DB?: D1Database;
  // Deletion records that survive a Time Travel restore (PR-6).
  TOMBSTONES?: D1Database;
  // Optional per-location limit in front of recovery (AU-10). The API works
  // without it, for plans or local runs that lack the binding.
  RECOVERY_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  // A secret; any value stops the API with 503 (OP-4).
  API_DISABLED?: string;
  ALLOWED_ORIGIN: string;
  RP_ID: string;
}
