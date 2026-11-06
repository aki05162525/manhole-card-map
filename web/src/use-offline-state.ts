import { useEffect, useState } from "react";
import { startOfflineUpdates, type OfflineState } from "./offline-update";

export function useOfflineState() {
  const [state, setState] = useState<OfflineState>({
    text: "オフラインの準備は未完了",
  });
  useEffect(() => startOfflineUpdates(setState), []);
  return state;
}
