import type { Route } from "./app";
import { recordRoutes } from "./records";
import { HttpError, json } from "./http";

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
];
