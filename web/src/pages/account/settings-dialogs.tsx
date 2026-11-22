import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import type { Passkey } from "../../contract/private-api";

export type Confirm =
  | { kind: "passkey"; passkey: Passkey }
  | { kind: "codes" }
  | { kind: "account" };

// The confirmations of the account screen; at most one is open.
export function SettingsDialogs({
  confirm,
  busy,
  onConfirm,
  onClose,
}: {
  confirm: Confirm | null;
  busy: boolean;
  onConfirm(): void;
  onClose(): void;
}) {
  return (
    <>
      <ConfirmDialog
        open={confirm?.kind === "passkey"}
        title="パスキーを削除"
        confirm="削除する"
        busy={busy}
        onConfirm={onConfirm}
        onClose={onClose}
      >
        <p>
          {confirm?.kind === "passkey" && `「${confirm.passkey.label}」`}
          をこのアカウントから削除します。端末やパスワード管理ツールに残っているパスキーは、各アプリ側で削除してください。
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "codes"}
        title="回復コードを再発行"
        confirm="再発行する"
        busy={busy}
        onConfirm={onConfirm}
        onClose={onClose}
      >
        <p>
          新しい回復コードを10個発行します。現在の回復コードはすべて使えなくなります。
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "account"}
        title="アカウントを削除"
        confirm="削除する"
        busy={busy}
        onConfirm={onConfirm}
        onClose={onClose}
      >
        <p>以下のデータをすべて削除します。この操作は取り消せません。</p>
        <ul>
          <li>入手の記録とメモ</li>
          <li>フレンド関係・申請・ブロック</li>
          <li>登録したパスキー</li>
          <li>回復コード</li>
        </ul>
        <p>
          障害に備えたバックアップには削除後も最長30日残ります。端末やパスワード管理ツールに残っているパスキーは、各アプリ側で削除してください。
        </p>
      </ConfirmDialog>
    </>
  );
}
