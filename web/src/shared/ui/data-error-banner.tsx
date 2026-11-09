import "./data-error-banner.css";

export function DataErrorBanner({
  message,
  onReload,
}: {
  message: string;
  onReload(): void;
}) {
  return (
    <div className="data-error-banner" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onReload}>
        再読み込み
      </button>
    </div>
  );
}
