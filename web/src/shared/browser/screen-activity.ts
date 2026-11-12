import { createContext, useContext } from "react";

/**
 * False while the screen stays mounted but another one is shown in the same
 * document (`app/`). A screen alone in its document is always active.
 */
export const ScreenActivity = /* @__PURE__ */ createContext(true);
export const useScreenActive = () => useContext(ScreenActivity);
