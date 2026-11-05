import { afterEach, expect, it, vi } from "vitest";
import { workerStatus, startOfflineUpdates } from "./offline-update";
afterEach(() => vi.useRealTimers());
it("bounds unanswered legacy status requests and closes message ports", async () => {
  vi.useFakeTimers();
  const close = vi.fn();
  const channel = { port1: { close, onmessage: null }, port2: { close } };
  const result = workerStatus(
    { postMessage: vi.fn() } as unknown as ServiceWorker,
    10,
    () => channel as unknown as MessageChannel,
  );
  const assertion = expect(result).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(11);
  await assertion;
  expect(close).toHaveBeenCalledTimes(2);
});
it("offers an explicit reload on first install without claiming an uncontrolled page", async () => {
  const worker = Object.assign(new EventTarget(), {
    state: "activated",
    postMessage: vi.fn(),
  });
  const registration = Object.assign(new EventTarget(), {
    active: worker,
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  const container = Object.assign(new EventTarget(), {
    controller: null,
    register: vi.fn().mockResolvedValue(registration),
  });
  const reload = vi.fn();
  const states: any[] = [];
  const stop = startOfflineUpdates((s) => states.push(s), {
    container: container as unknown as ServiceWorkerContainer,
    reload,
  });
  await vi.waitFor(() => expect(states.at(-1)?.action).toBeTypeOf("function"));
  expect(reload).not.toHaveBeenCalled();
  states.at(-1).action();
  expect(reload).toHaveBeenCalledOnce();
  expect(container.register).toHaveBeenCalledWith("/sw.js", {
    updateViaCache: "none",
  });
  stop();
});
it("activates a waiting update only on request and reloads after activation", async () => {
  const waiting = Object.assign(new EventTarget(), {
    state: "installed",
    postMessage: vi.fn(),
  });
  const registration = Object.assign(new EventTarget(), {
    waiting,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  const container = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn().mockResolvedValue(registration),
  });
  const reload = vi.fn();
  const states: any[] = [];
  const stop = startOfflineUpdates((s) => states.push(s), {
    container: container as unknown as ServiceWorkerContainer,
    reload,
  });
  await vi.waitFor(() => expect(states.at(-1)?.action).toBeTypeOf("function"));
  expect(waiting.postMessage).not.toHaveBeenCalled();
  states.at(-1).action();
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: "activate" });
  expect(reload).not.toHaveBeenCalled();
  waiting.state = "activated";
  waiting.dispatchEvent(new Event("statechange"));
  expect(reload).toHaveBeenCalledOnce();
  stop();
});
it("announces installation failure and stops listening after disposal", async () => {
  const installing = Object.assign(new EventTarget(), { state: "installing" });
  const registration = Object.assign(new EventTarget(), {
    installing,
    waiting: null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  const container = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn().mockResolvedValue(registration),
  });
  const onState = vi.fn();
  const stop = startOfflineUpdates(onState, {
    container: container as unknown as ServiceWorkerContainer,
  });
  await vi.waitFor(() =>
    expect(onState.mock.lastCall?.[0].text).toContain("確認・保存"),
  );
  installing.state = "redundant";
  installing.dispatchEvent(new Event("statechange"));
  expect(onState.mock.lastCall?.[0].text).toContain(
    "新版を保存できませんでした",
  );
  stop();
  const count = onState.mock.calls.length;
  installing.dispatchEvent(new Event("statechange"));
  container.dispatchEvent(new Event("controllerchange"));
  expect(onState).toHaveBeenCalledTimes(count);
});

it("reports a stalled install after registration has resolved", async () => {
  vi.useFakeTimers();
  const installing = Object.assign(new EventTarget(), { state: "installing" });
  const registration = Object.assign(new EventTarget(), {
    installing,
    waiting: null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  const container = Object.assign(new EventTarget(), {
    controller: null,
    register: vi.fn().mockResolvedValue(registration),
  });
  const onState = vi.fn();
  const stop = startOfflineUpdates(onState, {
    container: container as unknown as ServiceWorkerContainer,
  });
  await vi.advanceTimersByTimeAsync(10001);
  expect(onState.mock.lastCall?.[0].text).toContain(
    "保存に時間がかかっています",
  );
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
