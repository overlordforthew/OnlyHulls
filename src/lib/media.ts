export type ListingMediaType = "image" | "video";

export interface ExternalVideoMeta {
  provider: "youtube" | "vimeo";
  canonicalUrl: string;
  embedUrl: string;
  label: string;
}

export const LOCAL_MEDIA_BASE_PATH = "/media";
export const MAX_EXTERNAL_VIDEOS = 3;
export type GalleryHeroImageMode = "optimized-fill" | "natural-size";

function parseYoutubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }

  if (host.endsWith("youtube.com")) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "embed" || segments[0] === "shorts") {
      return segments[1] || null;
    }
  }

  return null;
}

function parseVimeoVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!host.endsWith("vimeo.com")) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const candidate = segments[segments.length - 1];
  return candidate && /^\d+$/.test(candidate) ? candidate : null;
}

export function getExternalVideoMeta(rawUrl: string): ExternalVideoMeta | null {
  try {
    const url = new URL(rawUrl.trim());
    const youtubeId = parseYoutubeVideoId(url);
    if (youtubeId) {
      return {
        provider: "youtube",
        canonicalUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
        label: "YouTube",
      };
    }

    const vimeoId = parseVimeoVideoId(url);
    if (vimeoId) {
      return {
        provider: "vimeo",
        canonicalUrl: `https://vimeo.com/${vimeoId}`,
        embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
        label: "Vimeo",
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function isSupportedExternalVideoUrl(url: string): boolean {
  return Boolean(getExternalVideoMeta(url));
}

export function normalizeExternalVideoUrl(url: string): string | null {
  return getExternalVideoMeta(url)?.canonicalUrl || null;
}

export function isLocalMediaUrl(url: string): boolean {
  return url === LOCAL_MEDIA_BASE_PATH || url.startsWith(`${LOCAL_MEDIA_BASE_PATH}/`);
}

export function getGalleryHeroImageMode(url: string): GalleryHeroImageMode {
  return isLocalMediaUrl(url) ? "optimized-fill" : "natural-size";
}
