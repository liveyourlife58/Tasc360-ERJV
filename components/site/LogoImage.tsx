import Image from "next/image";

const ALLOWED_LOGO_HOSTS = [
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
];

function isAllowedLogoHost(src: string): boolean {
  try {
    const url = new URL(src, "https://x");
    const host = url.hostname.toLowerCase();
    return ALLOWED_LOGO_HOSTS.some((allowed) => host === allowed || host.endsWith("." + allowed));
  } catch {
    return false;
  }
}

type LogoImageProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Renders tenant logo with next/image when the URL is from an allowed host (e.g. Vercel Blob),
 * otherwise falls back to img so any tenant URL works without adding more remotePatterns.
 */
export function LogoImage({ src, alt, className }: LogoImageProps) {
  if (isAllowedLogoHost(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={160}
        height={48}
        className={className}
        style={{ width: "auto", height: "36px", objectFit: "contain" }}
        unoptimized={false}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} style={{ height: "36px", width: "auto", objectFit: "contain" }} />
  );
}

