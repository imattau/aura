type IconName =
  | "back"
  | "forward"
  | "home"
  | "reload"
  | "go"
  | "block"
  | "report";

interface Props {
  name: IconName;
}

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.7",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function Icon({ name }: Props) {
  switch (name) {
    case "back":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" {...iconProps}>
          <path d="M11.5 4.5 6 10l5.5 5.5" />
        </svg>
      );
    case "forward":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" {...iconProps}>
          <path d="M8.5 4.5 14 10l-5.5 5.5" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" {...iconProps}>
          <path d="M3.5 9.5 10 4l6.5 5.5" />
          <path d="M5.5 8.5V16h9V8.5" />
        </svg>
      );
    case "reload":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" {...iconProps}>
          <path d="M16 10a6 6 0 1 1-2-4.5" />
          <path d="M14.5 4.5H18V8" />
        </svg>
      );
    case "go":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" {...iconProps}>
          <path d="M4 10h10" />
          <path d="m10 5 5 5-5 5" />
        </svg>
      );
    case "block":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" {...iconProps}>
          <circle cx="10" cy="10" r="6.5" />
          <path d="m6.5 13.5 7-7" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" {...iconProps}>
          <path d="M6 4.5h8l-1 4 1 4H6l-1-4 1-4Z" />
          <path d="M6 4.5V16" />
        </svg>
      );
  }
}
