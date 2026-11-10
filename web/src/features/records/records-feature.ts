import type { ReactNode } from "react";
import "./records.css";

/** Load the private controls' styles only when their provider is mounted. */
export default function RecordsStyles({ children }: { children: ReactNode }) {
  return children;
}
