import { accountRoutes } from "./account";
import type { Route } from "./app";
import { authRoutes } from "./auth";
import { HttpError, json } from "./http";

export const routes: Route[] = [
  {
    method: "GET",
    path: "/api/health",
    handle: async ({ env }) => {
      try {
        await env.DB.prepare("SELECT 1").first();
      } catch {
        throw new HttpError(503, "database_unavailable");
      }
      return json({ ok: true });
    },
  },
  ...authRoutes,
  ...accountRoutes,
];
