interface Props {
  npub: string;
  siteName?: string | null;
  path: string;
  frameKey?: string;
}

export function SiteFrame({ npub, siteName, path, frameKey }: Props) {
  const sitePrefix = siteName?.trim()
    ? `/${encodeURIComponent(siteName.trim())}`
    : "";
  const src = `/~${npub}${sitePrefix}${path}`;

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
