import "./shared/ui/tokens.css";
import { startScreens } from "./app/app";
import AccountScreen from "./app/account-screen";

const root = document.getElementById("root")!;
startScreens(root, "account", AccountScreen, Number(root.dataset.cardCount));
