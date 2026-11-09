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
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {size <= 16 ? (
        <>
          <path
            d="M16 7Q9 4 2 5.5v21q7-1.5 14 1.5q7-3 14-1.5v-21Q23 4 16 7v21"
            strokeWidth="2.8"
          />
          <path d="M5.5 12.5h7M5.5 18.5h5" strokeWidth="2.2" />
          <g transform="rotate(-6 23 15.5)">
            <rect
              x="18"
              y="8"
              width="10"
              height="15.5"
              rx="1.5"
              strokeWidth="2"
            />
            <rect
              x="21"
              y="11"
              width="4"
              height="4"
              fill="currentColor"
              stroke="none"
            />
          </g>
        </>
      ) : (
        <>
          <path
            d="M16 7Q9 4 2 5.5v21q7-1.5 14 1.5q7-3 14-1.5v-21Q23 4 16 7v21"
            strokeWidth="1.8"
          />
          <path d="M5 11.5h7.5M5 15.5h7.5M5 19.5h5" strokeWidth="1.1" />
          <g transform="rotate(-6 23 15.5)">
            <rect
              x="18.5"
              y="8"
              width="9"
              height="15"
              rx="1.6"
              strokeWidth="1.3"
              strokeDasharray={incomplete ? "2 1.4" : undefined}
            />
            <circle cx="23" cy="13.2" r="3.2" strokeWidth="1.1" />
            <circle
              cx="23"
              cy="13.2"
              r="2.3"
              strokeWidth=".7"
              strokeDasharray=".32 .884"
            />
            <rect
              x="22.3"
              y="12.5"
              width="1.4"
              height="1.4"
              fill="currentColor"
              stroke="none"
            />
            <path d="M20.4 18.8h5.2M20.4 20.8h3.4" strokeWidth=".8" />
          </g>
          {!incomplete && (
            <path
              d="M19.8 5.5h6.4l-1.1.9 1.1.9-1.1.9 1.1.9h-6.4l1.1-.9-1.1-.9 1.1-.9z"
              transform="rotate(7 23 7.3)"
              fill="currentColor"
              fillOpacity=".35"
              strokeWidth=".6"
              strokeLinejoin="miter"
            />
          )}
        </>
      )}
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
