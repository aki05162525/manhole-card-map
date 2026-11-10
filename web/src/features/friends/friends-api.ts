import { api, isApiError } from "../account/account-api";
import { forgetSignedIn } from "../../shared/browser/signed-in";

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
    : isApiError(error, 403)
      ? "パスキーでログインし直してから操作してください。"
      : isApiError(error, 429)
        ? "操作が多いため受け付けられませんでした。しばらく待ってからやり直してください。"
        : isApiError(error, 409)
          ? "フレンドの上限に達しているため承認できません。"
          : "通信を確認してやり直してください。";
}

const date = /* @__PURE__ */ new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
export const friendDate = (time: number) => date.format(time);
