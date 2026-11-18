import "./shared/ui/tokens.css";
import { startScreens } from "./app/app";
import AccountScreen from "./app/account-screen";
import "@fontsource-variable/noto-sans-jp/wght.css";

const root = document.getElementById("root")!;
startScreens(root, "account", AccountScreen, Number(root.dataset.cardCount));
