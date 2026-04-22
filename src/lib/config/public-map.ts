type PublicMapEnv = {
  [key: string]: string | undefined;
  NEXT_PUBLIC_MAP_ENABLED?: string;
  NEXT_PUBLIC_PUBLIC_MAP_ENABLED?: string;
  NEXT_PUBLIC_MAP_STYLE_URL?: string;
  NEXT_PUBLIC_MAP_ATTRIBUTION?: string;
  NEXT_PUBLIC_MAP_RESOURCE_ORIGINS?: string;
};

// Round 37: OpenFreeMap defaults. MapLibre-compatible free vector tiles hosted
// at tiles.openfreemap.org (no API key, no usage quota, ODbL licensed with the
// attribution below). When an operator has not configured a commercial tile
// provider (e.g. MapTiler), the map can still launch with these defaults.
// Commercial MapTiler remains supported by pointing NEXT_PUBLIC_MAP_STYLE_URL
// at `https://api.maptiler.com/maps/streets-v2/style.json?key=...`.
const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_MAP_ATTRIBUTION =
  "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors";
const DEFAULT_MAP_RESOURCE_ORIGINS = ["https://tiles.openfreemap.org"];

export type PublicMapClientConfig = {
  enabled: boolean;
  styleUrl: string;
  attribution: string;
  resourceOrigins: string[];
};

function isTruthy(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function allowsLocalHttp(url: URL) {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

function isAllowedMapResourceUrl(url: URL) {
  return url.protocol === "https:" || allowsLocalHttp(url);
}

function normalizeMapResourceUrl(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    return isAllowedMapResourceUrl(url) ? url.toString() : "";
  } catch {
    return "";
  }
}

function toOrigin(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.includes("*")) return null;

  try {
    const url = new URL(trimmed);
    if (!isAllowedMapResourceUrl(url)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getDefaultPublicMapEnv(): PublicMapEnv {
  return {
    NEXT_PUBLIC_MAP_ENABLED: process.env.NEXT_PUBLIC_MAP_ENABLED,
    NEXT_PUBLIC_PUBLIC_MAP_ENABLED: process.env.NEXT_PUBLIC_PUBLIC_MAP_ENABLED,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
    NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    NEXT_PUBLIC_MAP_RESOURCE_ORIGINS: process.env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS,
  };
}

export function parsePublicMapResourceOrigins(env: PublicMapEnv = getDefaultPublicMapEnv()) {
  const origins = new Set<string>();
  const styleOrigin = toOrigin(env.NEXT_PUBLIC_MAP_STYLE_URL) || toOrigin(DEFAULT_MAP_STYLE_URL);

  if (styleOrigin) origins.add(styleOrigin);

  const declaredOrigins = String(env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS || "")
    .split(/[\s,]+/)
    .map(toOrigin)
    .filter((origin): origin is string => Boolean(origin));

  if (declaredOrigins.length > 0) {
    declaredOrigins.forEach((origin) => origins.add(origin));
  } else {
    // Fall back to OpenFreeMap defaults so CSP permits the free tile host when
    // no explicit NEXT_PUBLIC_MAP_RESOURCE_ORIGINS is configured.
    DEFAULT_MAP_RESOURCE_ORIGINS.map(toOrigin)
      .filter((origin): origin is string => Boolean(origin))
      .forEach((origin) => origins.add(origin));
  }

  return Array.from(origins);
}

export function getPublicMapClientConfig(env: PublicMapEnv = getDefaultPublicMapEnv()): PublicMapClientConfig {
  const styleUrlRaw = normalizeMapResourceUrl(env.NEXT_PUBLIC_MAP_STYLE_URL);
  const styleUrl = styleUrlRaw || normalizeMapResourceUrl(DEFAULT_MAP_STYLE_URL);
  const attributionRaw = String(env.NEXT_PUBLIC_MAP_ATTRIBUTION || "").trim();
  const attribution = attributionRaw || DEFAULT_MAP_ATTRIBUTION;
  const publicFlag = env.NEXT_PUBLIC_MAP_ENABLED ?? env.NEXT_PUBLIC_PUBLIC_MAP_ENABLED;

  return {
    enabled: isTruthy(publicFlag) && Boolean(styleUrl) && Boolean(attribution),
    styleUrl,
    attribution,
    resourceOrigins: parsePublicMapResourceOrigins(env),
  };
}
