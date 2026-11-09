/** Destination shapes follow the status chip SVG treatment. */
export function DestinationSymbol({ lid = false }: { lid?: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className="destination-symbol"
    >
      {lid ? (
        <circle
          cx="5"
          cy="5"
          r="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        />
      ) : (
        <rect x="1" y="1" width="8" height="8" rx="0" fill="currentColor" />
      )}
    </svg>
  );
}
