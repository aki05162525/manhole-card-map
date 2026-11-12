// The friends page, as another screen's document loads it on a switch.
import "../shared/ui/controls.css";
import "../pages/account/account.css";
import "../pages/friends/friends.css";
import { StrictMode } from "react";
import { FriendsPage } from "../pages/friends/friends-page";

export default function FriendsScreen() {
  return (
    <StrictMode>
      <FriendsPage />
    </StrictMode>
  );
}
