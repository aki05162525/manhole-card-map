import { accountRoutes } from "./account";
import type { Route } from "./app";
import { authRoutes } from "./auth";
import { friendRoutes } from "./friends";
import { HttpError, json } from "./http";
import { recordRoutes } from "./records";

export const routes: Route[] = [
  ...recordRoutes,
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
  ...friendRoutes,
  ...authRoutes,
  ...accountRoutes,
];
