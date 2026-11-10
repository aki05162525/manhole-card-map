import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import type { Passkey } from "./passkey-list";

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
          をこのアカウントから外します。端末やパスワード管理ツールに残ったパスキーは、そちらで削除してください。
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
        <p>新しい10個を発行し、今の回復コードはすべて使えなくなります。</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "account"}
        title="アカウントを削除"
        confirm="削除する"
        busy={busy}
        onConfirm={onConfirm}
        onClose={onClose}
      >
        <p>次のものをすべて消します。元に戻せません。</p>
        <ul>
          <li>回収の記録とメモ</li>
          <li>フレンド関係・申請・ブロック</li>
          <li>登録したパスキー</li>
          <li>回復コード</li>
        </ul>
        <p>
          障害に備えたバックアップには、削除後も最長30日残ります。端末やパスワード管理ツールに残ったパスキーは、そちらで削除してください。
        </p>
      </ConfirmDialog>
    </>
  );
}
