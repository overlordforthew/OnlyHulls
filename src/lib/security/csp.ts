import { getPublicMapClientConfig } from "@/lib/config/public-map";

const IMAGE_SOURCES = [
  "'self'",
  "data:",
  "https://*.your-objectstorage.com",
  "https://*.sailboatlistings.com",
  "https://ics.apolloduck.com",
  "https://*.theyachtmarket.com",
  "https://images.boatsgroup.com",
  "https://images.boats.com",
  "https://www.yachtsite.com",
  "https://www.catamarans.com",
  "https://www.dreamyachtsales.com",
];

const FRAME_SOURCES = [
  "'self'",
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
];

const CONNECT_SOURCES = [
  "'self'",
  "https://*.posthog.com",
];

function uniqueSources(sources: string[]) {
  return Array.from(new Set(sources));
}

function createNonceValue() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function createCspNonce() {
  return createNonceValue();
}

export function serializeJsonForInlineScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildContentSecurityPolicy(
  nonce: string,
  options: {
    isDevelopment?: boolean;
  } = {}
) {
  const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV !== "production";
  const connectSources = [...CONNECT_SOURCES];
  const imageSources = [...IMAGE_SOURCES];
  const styleSources = ["'self'", "'unsafe-inline'"];
  const fontSources = ["'self'"];
  const mapConfig = getPublicMapClientConfig();
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "https://*.posthog.com"];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("http://127.0.0.1:*", "http://localhost:*", "ws://127.0.0.1:*", "ws://localhost:*");
  }

  if (mapConfig.enabled) {
    connectSources.push(...mapConfig.resourceOrigins);
    imageSources.push(...mapConfig.resourceOrigins);
    styleSources.push(...mapConfig.resourceOrigins);
    fontSources.push(...mapConfig.resourceOrigins);
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src ${uniqueSources(styleSources).join(" ")}`,
    `img-src ${uniqueSources(imageSources).join(" ")}`,
    `connect-src ${uniqueSources(connectSources).join(" ")}`,
    `font-src ${uniqueSources(fontSources).join(" ")}`,
    `frame-src ${FRAME_SOURCES.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ];

  if (!isDevelopment) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export async function getCspNonce() {
  const { headers } = await import("next/headers");
  return (await headers()).get("x-nonce") ?? undefined;
}
