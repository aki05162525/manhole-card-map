import { Component, type ReactNode } from "react";
import type { HistoryRoute } from "../shared/browser/app-history";
import { ScreenActivity } from "../shared/browser/screen-activity";

/** A screen that fails to render is opened as its own document instead. */
export class ScreenBoundary extends Component<
  { onError(): void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ScreenSlot({
  route,
  active,
  slots,
  children,
}: {
  route: HistoryRoute;
  active: boolean;
  slots: Map<HistoryRoute, HTMLElement>;
  children: ReactNode;
}) {
  return (
    <div
      ref={(element) => {
        if (element) slots.set(route, element);
        return () => {
          slots.delete(route);
        };
      }}
      className="app-screen"
      data-route={route}
      data-inactive={active ? undefined : ""}
      // The hidden map keeps its box (app.css); the catalog leaves the flow.
      hidden={!active && route === "catalog"}
      inert={!active}
    >
      <ScreenActivity value={active}>{children}</ScreenActivity>
    </div>
  );
}
