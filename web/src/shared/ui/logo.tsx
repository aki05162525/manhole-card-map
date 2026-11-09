export function Logo({
  size = 32,
  incomplete = false,
}: {
  size?: number;
  incomplete?: boolean;
}) {
  return (
    <svg
      className="logo"
      data-incomplete={incomplete || undefined}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" strokeWidth="2.5" />
      {size > 16 && (
        <circle
          cx="16"
          cy="16"
          r="11.6"
          strokeWidth="1.8"
          strokeDasharray={
            incomplete ? "1.2 4.874 1.2 4.874 1.2 4.874 1.2 100" : "1.2 4.874"
          }
        />
      )}
      <circle cx="16" cy="16" r="8.6" strokeWidth="1.25" />
      <rect
        x="12.5"
        y="12.5"
        width="7"
        height="7"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
export function Wordmark() {
  return (
    <span className="wordmark">
      マンホール<span>手帳</span>
    </span>
  );
}
