import { api, isApiError } from "../account/account-api";
import { refusalMessage } from "../../shared/browser/api";
import { forgetSignedIn } from "../../shared/browser/signed-in";
import { japanFormat } from "../../shared/universal/japan-time";

export type Person = { userId: string; displayName: string };
export type Friend = Person & { count: number; since: number };
export type Request = Person & { requestedAt: number };
export type Block = Person & { blockedAt: number };
export type Invite = { url?: string; expiresAt: number | null };

// A 401 means the session is gone: forget the display cookie as well.
export async function friendsApi<T>(
  path: string,
  options?: Parameters<typeof api>[1],
): Promise<T> {
  try {
    return await api<T>(path, options);
  } catch (error) {
    if (isApiError(error, 401)) forgetSignedIn();
    throw error;
  }
}

export function friendError(error: unknown) {
  return isApiError(error, 401)
    ? "ログインし直してください。"
    : (refusalMessage(error, "受け付けられませんでした") ??
        (isApiError(error, 409)
          ? "フレンドの上限に達しているため承認できません。"
          : "通信を確認してやり直してください。"));
}

const date = /* @__PURE__ */ japanFormat({
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
export const friendDate = (time: number) => date.format(time);
