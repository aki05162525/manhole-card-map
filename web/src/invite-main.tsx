import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { captureInvite, InvitePage } from "./pages/friends/invite-page";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/account/account.css";
const token = captureInvite();
renderDocument(
  document.getElementById("root")!,
  <StrictMode>
    <InvitePage initialToken={token} />
  </StrictMode>,
);
