import "./shared/ui/tokens.css";
import { startScreens } from "./app/app";
import AboutScreen from "./app/about-screen";

const root = document.getElementById("root")!;
startScreens(root, "about", AboutScreen, Number(root.dataset.cardCount));
