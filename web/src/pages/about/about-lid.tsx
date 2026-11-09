const lid = (
  <svg
    className="about-lid"
    width="240"
    height="240"
    viewBox="0 0 128 128"
    fill="none"
    stroke="currentColor"
    aria-hidden="true"
  >
    <circle
      className="lid-edge"
      pathLength="100"
      cx="64"
      cy="64"
      r="60"
      strokeWidth="2"
    />
    <path className="lid-tick" pathLength="100" d="M64.0 15.0l0.0 -6.0" />
    <path className="lid-tick" pathLength="100" d="M88.5 21.6l3.0 -5.2" />
    <path className="lid-tick" pathLength="100" d="M106.4 39.5l5.2 -3.0" />
    <path className="lid-tick" pathLength="100" d="M113.0 64.0l6.0 0.0" />
    <path className="lid-tick" pathLength="100" d="M106.4 88.5l5.2 3.0" />
    <path className="lid-tick" pathLength="100" d="M88.5 106.4l3.0 5.2" />
    <path className="lid-tick" pathLength="100" d="M64.0 113.0l0.0 6.0" />
    <path className="lid-tick" pathLength="100" d="M39.5 106.4l-3.0 5.2" />
    <path className="lid-tick" pathLength="100" d="M21.6 88.5l-5.2 3.0" />
    <path className="lid-tick" pathLength="100" d="M15.0 64.0l-6.0 0.0" />
    <path className="lid-tick" pathLength="100" d="M21.6 39.5l-5.2 -3.0" />
    <path className="lid-tick" pathLength="100" d="M39.5 21.6l-3.0 -5.2" />
    <circle className="lid-ring" pathLength="100" cx="64" cy="64" r="46" />
    <circle className="lid-ring" pathLength="100" cx="64" cy="64" r="36" />
    <path
      className="lid-grid"
      pathLength="100"
      d="M40 40V88H88V40ZM52 40V88M64 40V88M76 40V88M40 52H88M40 64H88M40 76H88"
    />
    <rect
      className="lid-stamp"
      x="57"
      y="57"
      width="14"
      height="14"
      rx="1"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);
export function AboutLid() {
  return lid;
}
