import { Logo } from "./logo";
import "./loading-logo.css";

export function LoadingLogo() {
  return (
    <span className="loading-logo">
      <Logo size={48} />
    </span>
  );
}
