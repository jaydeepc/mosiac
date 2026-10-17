import Link from "next/link";

export function MosaicMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" role="img" aria-label="Mosaic mark" className={className}>
      <rect x="1" y="1" width="13" height="13" rx="3" fill="#2F6F73" />
      <rect x="16" y="1" width="13" height="13" rx="3" fill="#9CC3C5" />
      <rect x="1" y="16" width="13" height="13" rx="3" fill="#E7B99E" />
      <rect x="16" y="16" width="13" height="13" rx="3" fill="#C9693F" />
    </svg>
  );
}

export function Wordmark({ size = 22, markSize, href = "/" }: { size?: number; markSize?: number; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 no-underline text-ink hover:text-ink" style={{ gap: size > 24 ? 12 : 10 }}>
      <MosaicMark size={markSize ?? (size > 24 ? 30 : 24)} />
      <span className="font-display font-medium" style={{ fontSize: size, letterSpacing: size > 24 ? "-0.01em" : undefined }}>
        Mosaic
      </span>
    </Link>
  );
}

/* Tiny inline tile row used in "Peek" buttons */
export function TileTrio({ size = 10 }: { size?: number }) {
  return (
    <span className="flex" style={{ gap: 3 }} aria-hidden="true">
      <span style={{ width: size, height: size, borderRadius: 3, background: "#2F6F73" }} />
      <span style={{ width: size, height: size, borderRadius: 3, background: "#9CC3C5" }} />
      <span style={{ width: size, height: size, borderRadius: 3, background: "#E7B99E" }} />
    </span>
  );
}
