import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number; stroke?: string; strokeWidth?: number };

function base({ size = 16, stroke = "currentColor", strokeWidth = 2, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const ArrowRight = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ArrowLeft = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const Check = (p: P) => (
  <svg {...base({ strokeWidth: 3, ...p })}>
    <path d="M5 12l5 5 9-10" />
  </svg>
);
export const Plus = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Mic = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
export const Globe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
  </svg>
);
export const FileIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
export const Clock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const Sparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const Download = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
  </svg>
);
export const LinkIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);
export const CommentIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
  </svg>
);
export const Person = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const ChevronUp = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const X = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const Upload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
  </svg>
);
export const Stop = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
export const Pencil = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
);
export const Users = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15.5 14.5A5 5 0 0 1 21.5 20" />
  </svg>
);
export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const Spinner = ({ size = 18, light = false }: { size?: number; light?: boolean }) => (
  <span
    aria-hidden="true"
    className="anim-spin inline-block rounded-full"
    style={{ width: size, height: size, border: `2.5px solid ${light ? "rgba(255,255,255,0.4)" : "#9CC3C5"}`, borderTopColor: light ? "#fff" : "#2F6F73" }}
  />
);
export const CheckDot = ({ size = 22, bg = "#2F6F73" }: { size?: number; bg?: string }) => (
  <span className="inline-flex items-center justify-center rounded-full shrink-0" style={{ width: size, height: size, background: bg, color: "#fff" }}>
    <Check size={Math.round(size / 2)} strokeWidth={3.5} />
  </span>
);
