import { useState } from "preact/hooks";

interface Props {
  pubkey: string;
  src?: string | null;
  label?: string | null;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function pickColor(seed: number): string {
  const hue = seed % 360;
  return `hsl(${hue} 82% 68%)`;
}

export function Avatar({ pubkey, src, label }: Props) {
  const [failed, setFailed] = useState(false);
  const hash = hashString(pubkey);
  const colors = [
    pickColor(hash),
    pickColor(hash ^ 0x5f5f5f),
    pickColor(hash ^ 0xa5a5a5),
  ];
  const cells = [];

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (((hash >> (row * 4 + col)) & 1) !== 1) continue;
      cells.push(
        <rect
          x={8 + col * 6}
          y={8 + row * 6}
          width="5"
          height="5"
          rx="1"
          fill="rgba(255,255,255,0.72)"
        />,
      );
    }
  }

  return src && !failed ? (
    <img
      class="user-avatar user-avatar--image"
      src={src}
      alt={label ?? "Signed in user"}
      title={pubkey}
      onError={() => setFailed(true)}
    />
  ) : (
    <svg
      class="user-avatar"
      viewBox="0 0 40 40"
      aria-label="Logged in user avatar"
      role="img"
      title={pubkey}
    >
      <defs>
        <linearGradient
          id={`avatar-gradient-${hash}`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <rect
        width="40"
        height="40"
        rx="12"
        fill={`url(#avatar-gradient-${hash})`}
      />
      <circle cx="20" cy="15" r="7" fill={colors[2]} fillOpacity="0.32" />
      {cells}
    </svg>
  );
}
