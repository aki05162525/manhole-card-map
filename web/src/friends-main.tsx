import "./shared/ui/tokens.css";
import { startScreens } from "./app/app";
import FriendsScreen from "./app/friends-screen";
import "@fontsource-variable/noto-sans-jp/wght.css";

const root = document.getElementById("root")!;
startScreens(root, "friends", FriendsScreen, Number(root.dataset.cardCount));
