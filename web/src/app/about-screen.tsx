// About, as another screen's document loads it on a switch.
import "../pages/about/about.css";
import { StrictMode, useState } from "react";
import { AboutPage } from "../pages/about/about-page";
import { readAboutSummary } from "../pages/about/about-summary";

/** Every screen's HTML carries about's numbers on its root (`vite.config.ts`). */
export default function AboutScreen() {
  const [summary] = useState(() =>
    readAboutSummary(document.getElementById("root")?.dataset ?? {}),
  );
  return (
    <StrictMode>
      <AboutPage summary={summary} />
    </StrictMode>
  );
}
