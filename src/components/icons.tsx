// Small functional icons (inline SVG, 1.75px strokes). Decorative by
// default: callers provide the accessible text.
type IconProps = { className?: string };
const base = (className = "h-4 w-4") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const MinusCircleIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
);
export const FileIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
);
export const TextIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4 6h16M4 10h16M4 14h10M4 18h7" /></svg>
);
export const UploadIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M12 15V4M7 9l5-5 5 5" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
);
export const XIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const ChevronIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="m9 6 6 6-6 6" /></svg>
);
export const DownloadIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 19h14" /></svg>
);
export const LockIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const InfoIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const AlertIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const ArrowDownIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
);
export const SpinnerIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M21 12a9 9 0 1 1-6.2-8.56" /></svg>
);
export const GitHubIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  </svg>
);
