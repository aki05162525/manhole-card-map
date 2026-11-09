const cover = (
  <svg
    className="about-lid"
    width="240"
    height="240"
    aria-hidden="true"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeLinejoin="round"
    strokeLinecap="round"
  >
    <path
      data-step="1"
      pathLength="100"
      d="M16 7Q9 4 2 5.5v21q7-1.5 14 1.5q7-3 14-1.5v-21Q23 4 16 7"
      strokeWidth="1.2"
    />
    <path data-step="2" pathLength="100" d="M16 7v21" strokeWidth="1.2" />
    <path data-step="3" pathLength="100" d="M5 11.5h7.5" strokeWidth=".8" />
    <path data-step="3" pathLength="100" d="M5 15.5h7.5" strokeWidth=".8" />
    <path data-step="3" pathLength="100" d="M5 19.5h5" strokeWidth=".8" />
    <g transform="rotate(-6 23 15.5)">
      <g data-step="4">
        <rect
          data-step="4"
          pathLength="100"
          x="18.5"
          y="8"
          width="9"
          height="15"
          rx="1.6"
          strokeWidth=".9"
        />
        <circle
          data-step="5"
          pathLength="100"
          cx="23"
          cy="13.2"
          r="3.2"
          strokeWidth=".8"
        />
        <circle
          data-step="6"
          cx="23"
          cy="13.2"
          r="2.3"
          strokeWidth=".5"
          strokeDasharray=".32 .884"
        />
        <rect
          data-step="7"
          x="22.3"
          y="12.5"
          width="1.4"
          height="1.4"
          fill="currentColor"
          stroke="none"
        />
        <path
          data-step="8"
          pathLength="100"
          d="M20.4 18.8h5.2"
          strokeWidth=".55"
        />
        <path
          data-step="8"
          pathLength="100"
          d="M20.4 20.8h3.4"
          strokeWidth=".55"
        />
      </g>
    </g>
    <g data-step="9">
      <path
        d="M19.8 5.5h6.4l-1.1.9 1.1.9-1.1.9 1.1.9h-6.4l1.1-.9-1.1-.9 1.1-.9z"
        transform="rotate(7 23 7.3)"
        fill="currentColor"
        fillOpacity=".35"
        strokeWidth=".45"
        strokeLinejoin="miter"
      />
    </g>
  </svg>
);
export function AboutLid() {
  return cover;
}
