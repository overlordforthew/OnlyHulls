type PublicMapEnv = {
  [key: string]: string | undefined;
  NEXT_PUBLIC_MAP_ENABLED?: string;
  NEXT_PUBLIC_PUBLIC_MAP_ENABLED?: string;
  NEXT_PUBLIC_MAP_STYLE_URL?: string;
  NEXT_PUBLIC_MAP_ATTRIBUTION?: string;
  NEXT_PUBLIC_MAP_RESOURCE_ORIGINS?: string;
};

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
  const styleOrigin = toOrigin(env.NEXT_PUBLIC_MAP_STYLE_URL);

  if (styleOrigin) origins.add(styleOrigin);

  String(env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS || "")
    .split(/[\s,]+/)
    .map(toOrigin)
    .filter((origin): origin is string => Boolean(origin))
    .forEach((origin) => origins.add(origin));

  return Array.from(origins);
}

export function getPublicMapClientConfig(env: PublicMapEnv = getDefaultPublicMapEnv()): PublicMapClientConfig {
  const styleUrl = normalizeMapResourceUrl(env.NEXT_PUBLIC_MAP_STYLE_URL);
  const attribution = String(env.NEXT_PUBLIC_MAP_ATTRIBUTION || "").trim();
  const publicFlag = env.NEXT_PUBLIC_MAP_ENABLED ?? env.NEXT_PUBLIC_PUBLIC_MAP_ENABLED;

  return {
    enabled: isTruthy(publicFlag) && Boolean(styleUrl) && Boolean(attribution),
    styleUrl,
    attribution,
    resourceOrigins: parsePublicMapResourceOrigins(env),
  };
}
