type MapStylePingEnv = Record<string, string | undefined>;

export type MapStylePingRefererRejection = {
  source: string;
  value: string;
  reason: "malformed" | "unsafe_protocol" | "off_host";
};

export type MapStylePingRefererResolution = {
  referer: string;
  source: string;
  rejected: MapStylePingRefererRejection[];
};

const DEFAULT_REFERER = "https://onlyhulls.com/boats";
const DEFAULT_ALLOWED_HOSTS = new Set(["onlyhulls.com", "www.onlyhulls.com"]);

type NormalizedReferer =
  | { referer: string; reason?: never }
  | { referer?: never; reason: MapStylePingRefererRejection["reason"] };

function splitList(value?: string | null) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getAllowedHosts(env: MapStylePingEnv) {
  return new Set([...DEFAULT_ALLOWED_HOSTS, ...splitList(env.MAP_STYLE_PING_ALLOWED_HOSTS)]);
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeRefererUrl(value: string, allowedHosts: Set<string>): NormalizedReferer {
  const url = new URL(value);

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalHost(url.hostname))) {
    return { reason: "unsafe_protocol" as const };
  }

  const hostname = url.hostname.toLowerCase();
  if (!allowedHosts.has(hostname) && !isLocalHost(hostname)) {
    return { reason: "off_host" as const };
  }

  if (!url.pathname || url.pathname === "/") url.pathname = "/boats";
  url.hash = "";

  return { referer: url.toString() };
}

export function resolveMapStylePingReferer(
  env: MapStylePingEnv = process.env
): MapStylePingRefererResolution {
  const allowedHosts = getAllowedHosts(env);
  const rejected: MapStylePingRefererRejection[] = [];
  const candidates = [
    { source: "MAP_STYLE_PING_REFERER", value: env.MAP_STYLE_PING_REFERER },
    { source: "NEXT_PUBLIC_APP_URL", value: env.NEXT_PUBLIC_APP_URL },
    { source: "NEXTAUTH_URL", value: env.NEXTAUTH_URL },
    { source: "default", value: DEFAULT_REFERER },
  ];

  for (const candidate of candidates) {
    const value = String(candidate.value || "").trim();
    if (!value) continue;

    try {
      const result = normalizeRefererUrl(value, allowedHosts);
      if (typeof result.referer === "string") {
        return {
          referer: result.referer,
          source: candidate.source,
          rejected,
        };
      }

      rejected.push({
        source: candidate.source,
        value,
        reason: result.reason,
      });
    } catch {
      rejected.push({
        source: candidate.source,
        value,
        reason: "malformed",
      });
    }
  }

  return {
    referer: DEFAULT_REFERER,
    source: "default",
    rejected,
  };
}

export function buildMapStylePingHeaders(env: MapStylePingEnv = process.env) {
  const resolution = resolveMapStylePingReferer(env);

  return {
    headers: {
      accept: "application/json",
      Referer: resolution.referer,
    },
    resolution,
  };
}
