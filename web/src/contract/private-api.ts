import {
  arrayOf,
  isNumber,
  isString,
  literal,
  nullable,
  optional,
  shape,
  type Guard,
} from "./shape";

// The bodies the private API answers with. The Worker builds each with its
// type (`satisfies`), and the screen takes it only through its check: an
// answer that does not pass is a failure (`InvalidAnswer`), never a value
// to draw or keep. The checks live here, beside the types, so the Worker's
// tests run the screen's own check on what the Worker really answers.

/** One card's receipt: the card's current number, and the day it was got. */
export type Receipt = { cardId: string; receivedOn: string | null };
export const isReceipt: Guard<Receipt> = shape<Receipt>({
  cardId: isString,
  receivedOn: nullable(isString),
});
/** GET /api/me/records */
export const isReceipts = arrayOf(isReceipt);

/** GET /api/me/records/:cardId (404 is "no record"). */
export type RecordDetail = Receipt & { memo: string | null; updatedAt: number };
export const isRecordDetail = shape<RecordDetail>({
  cardId: isString,
  receivedOn: nullable(isString),
  memo: nullable(isString),
  updatedAt: isNumber,
});
/** PUT /api/me/records/:cardId (DELETE answers 204 without a body). */
export type SavedRecord = Receipt & { updatedAt: number };
export const isSavedRecord = shape<SavedRecord>({
  cardId: isString,
  receivedOn: nullable(isString),
  updatedAt: isNumber,
});

export type Person = { userId: string; displayName: string };
export type Friend = Person & { count: number; since: number };
export type FriendRequest = Person & { requestedAt: number };
export type Block = Person & { blockedAt: number };
/** POST /api/invite, and the friends' page's own. */
export type Invite = { url: string };
export const isInvite = shape<Invite>({ url: isString });
/** GET /api/friends */
export type FriendsPage = {
  friends: Friend[];
  requests: FriendRequest[];
  blocks: Block[];
  invite: Invite;
};
export const isFriendsPage = shape<FriendsPage>({
  friends: arrayOf(
    shape<Friend>({
      userId: isString,
      displayName: isString,
      count: isNumber,
      since: isNumber,
    }),
  ),
  requests: arrayOf(
    shape<FriendRequest>({
      userId: isString,
      displayName: isString,
      requestedAt: isNumber,
    }),
  ),
  blocks: arrayOf(
    shape<Block>({
      userId: isString,
      displayName: isString,
      blockedAt: isNumber,
    }),
  ),
  invite: isInvite,
});
/** GET /api/friends/:userId/records: never the memo (AZ-1). */
export type FriendReceipts = {
  displayName: string;
  count: number;
  records: Receipt[];
};
export const isFriendReceipts = shape<FriendReceipts>({
  displayName: isString,
  count: isNumber,
  records: isReceipts,
});
/** POST /api/invite/lookup: `self` only for one's own invite. */
export type InviteLookup = { displayName: string; self?: true };
export const isInviteLookup = shape<InviteLookup>({
  displayName: isString,
  self: optional(literal(true)),
});

/** What the passkey manager is told about (the WebAuthn Signal API). */
export type PasskeyAccount = { rpId: string; userId: string };
/** DELETE /api/me */
export const isPasskeyAccount = shape<PasskeyAccount>({
  rpId: isString,
  userId: isString,
});
/** PATCH /api/me, POST /api/passkeys/register/verify, and the account's. */
export type Profile = PasskeyAccount & {
  displayName: string;
  passkeys: number;
  recoveryCodesRemaining: number;
};
export const isProfile = shape<Profile>({
  rpId: isString,
  userId: isString,
  displayName: isString,
  passkeys: isNumber,
  recoveryCodesRemaining: isNumber,
});
export type Passkey = {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
};
/** GET /api/account */
export type AccountPage = { profile: Profile; passkeys: Passkey[] };
export const isAccountPage = shape<AccountPage>({
  profile: isProfile,
  passkeys: arrayOf(
    shape<Passkey>({
      id: isString,
      label: isString,
      createdAt: isNumber,
      lastUsedAt: nullable(isNumber),
    }),
  ),
});
/** POST /api/recovery-codes; a registration's answer carries them too. */
export type RecoveryCodes = { recoveryCodes: string[] };
export const isRecoveryCodes = shape<RecoveryCodes>({
  recoveryCodes: arrayOf(isString),
});
/** POST /api/auth/recover */
export type RecoveryStart = { recoveryMark: string };
export const isRecoveryStart = shape<RecoveryStart>({ recoveryMark: isString });

/**
 * A read a screen keeps for a return (`session/private-reads.ts`): its path
 * and the check its answer passes before it is kept or drawn.
 */
export type PrivateRead<T> = { readonly path: string; readonly read: Guard<T> };
export const accountRead: PrivateRead<AccountPage> = {
  path: "/api/account",
  read: isAccountPage,
};
export const friendsRead: PrivateRead<FriendsPage> = {
  path: "/api/friends",
  read: isFriendsPage,
};
