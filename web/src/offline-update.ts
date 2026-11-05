export type OfflineState = {
  text: string;
  action?: () => void;
  actionLabel?: string;
};
type Status = { ready: boolean; version: string; activeVersion?: string };
export function workerStatus(
  worker: ServiceWorker,
  timeout = 5000,
  makeChannel = () => new MessageChannel(),
): Promise<Status> {
  return new Promise((resolve, reject) => {
    const channel = makeChannel();
    const finish = (error?: Error, value?: Status) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = setTimeout(
      () => finish(Error("Service Worker status timeout")),
      timeout,
    );
    channel.port1.onmessage = (event) => finish(undefined, event.data);
    try {
      worker.postMessage({ type: "status" }, [channel.port2]);
    } catch (error) {
      finish(error instanceof Error ? error : Error(String(error)));
    }
  });
}
// Starts independently of map/data readiness. No storage or user-state reset.
export function startOfflineUpdates(
  onState: (state: OfflineState) => void,
  options: { container?: ServiceWorkerContainer; reload?: () => void } = {},
): () => void {
  const container =
    options.container ??
    (typeof navigator !== "undefined" ? navigator.serviceWorker : undefined);
  const reload = options.reload ?? (() => location.reload());
  let stopped = false;
  let revision = 0;
  let registration: ServiceWorkerRegistration | undefined;
  const cleanups: (() => void)[] = [];
  const emit = (state: OfflineState) => {
    if (!stopped) onState(state);
  };
  const listen = (target: EventTarget, type: string, callback: () => void) => {
    target.addEventListener(type, callback);
    cleanups.push(() => target.removeEventListener(type, callback));
  };
  const reloadState = (text: string) =>
    emit({ text, action: reload, actionLabel: "再読み込みして更新" });
  const refresh = async () => {
    const current = ++revision;
    if (!registration || stopped) return;
    const waiting = registration.waiting;
    if (waiting) {
      emit({
        text: "新しい保存データを準備できました。ほかのタブは再読み込みまで現在の版を使います。",
        actionLabel: "更新して再読み込み",
        action: () => {
          emit({ text: "保存データを切り替えています…" });
          const timer = setTimeout(() => {
            void refresh();
          }, 10000);
          cleanups.push(() => clearTimeout(timer));
          const activated = () => {
            if (waiting.state === "activated" && !stopped) {
              clearTimeout(timer);
              reload();
            }
          };
          listen(waiting, "statechange", activated);
          waiting.postMessage({ type: "activate" });
          activated();
        },
      });
      return;
    }
    if (registration.installing) {
      emit({
        text: "新しい保存データを確認・保存しています…現在の版は引き続き使えます。",
      });
      return;
    }
    if (!container?.controller) {
      if (registration.active)
        reloadState(
          "オフライン保存が完了しました。再読み込みすると保存した版で開きます。",
        );
      else emit({ text: "オフラインの準備は未完了" });
      return;
    }
    try {
      const status = await workerStatus(container.controller);
      if (stopped || current !== revision) return;
      if (status.activeVersion && status.version !== status.activeVersion)
        reloadState(`新しい版があります / 表示中：${status.version}`);
      else
        emit({
          text: status.ready
            ? `オフライン準備完了 / 保存版：${status.version}`
            : "オフラインの準備は未完了。オンラインで再読み込みしてください。",
        });
    } catch {
      if (current === revision)
        emit({
          text: "保存状態を確認できませんでした。現在の表示は引き続き使えます。",
        });
    }
  };
  if (!container) {
    emit({ text: "この環境ではオフライン保存を利用できません。" });
    return () => {
      stopped = true;
    };
  }
  emit({ text: "保存データの更新を確認しています…" });
  const initialTimeout = setTimeout(
    () =>
      emit({
        text: "更新確認に時間がかかっています。現在の表示は引き続き使えます。",
      }),
    10000,
  );
  cleanups.push(() => clearTimeout(initialTimeout));
  listen(container, "controllerchange", () => {
    void refresh();
  });
  void container
    .register("/sw.js", { updateViaCache: "none" })
    .then((value) => {
      clearTimeout(initialTimeout);
      if (stopped) return;
      registration = value;
      const watchInstall = () => {
        const installing = value.installing;
        if (installing) {
          const timer = setTimeout(() => {
            if (installing.state === "installing")
              emit({
                text: "保存に時間がかかっています。現在の版は引き続き使えます。",
              });
          }, 10000);
          cleanups.push(() => clearTimeout(timer));
          listen(installing, "statechange", () => {
            if (installing.state !== "installing") clearTimeout(timer);
            if (installing.state === "redundant")
              emit({
                text: "新版を保存できませんでした。保存済みの版は引き続き使えます。オンラインで再読み込みして再試行してください。",
              });
            else void refresh();
          });
        }
        void refresh();
      };
      listen(value, "updatefound", watchInstall);
      watchInstall();
      const check = () => {
        void value.update().catch(() => {
          /* Offline: retain saved generation and its status. */
        });
      };
      if (typeof window !== "undefined") listen(window, "focus", check);
      check();
    })
    .catch(() => {
      clearTimeout(initialTimeout);
      emit({
        text: "更新確認に失敗しました。保存済みの版と現在の表示は引き続き使えます。",
      });
    });
  return () => {
    stopped = true;
    ++revision;
    for (const cleanup of cleanups) cleanup();
  };
}
