// The account page, with the passkey code, loaded only when it is shown.
import "../shared/ui/controls.css";
import "../pages/account/account.css";
import { StrictMode } from "react";
import { AccountPage } from "../pages/account/account-page";

export default function AccountScreen() {
  return (
    <StrictMode>
      <AccountPage />
    </StrictMode>
  );
}
