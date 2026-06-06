interface Props {
  npub: string;
  path: string;
  frameKey?: string;
}

export function SiteFrame({ npub, path, frameKey }: Props) {
  const src = `/~${npub}${path}`;

  return (
    <iframe
      key={frameKey}
      class="site-frame"
      title="Aura hosted site"
      src={src}
      allow="clipboard-read; clipboard-write; fullscreen"
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
}
