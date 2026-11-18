import "./shared/ui/tokens.css";
import { startScreens } from "./app/app";
import AboutScreen from "./app/about-screen";
import "@fontsource-variable/noto-sans-jp/wght.css";

const root = document.getElementById("root")!;
startScreens(root, "about", AboutScreen, Number(root.dataset.cardCount));
