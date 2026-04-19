const PRIVATE_HOST_RE =
  /^(127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|localhost(\.localdomain)?|metadata\.google\.internal|\[::1\])$/i;

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_RE.test(hostname);
}

export function isKnownPlaceholderImageUrl(url: string | null | undefined): boolean {
  const normalized = String(url || "").trim().toLowerCase();
  return normalized.includes("/assets/images/noimage");
}

export function getSafeExternalUrl(url: string | null | undefined): string | null {
  const normalized = String(url || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (isPrivateHost(parsed.hostname)) {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function getSafeExternalUrlList(
  urls: Array<string | null | undefined> | null | undefined
): string[] {
  const seen = new Set<string>();
  const safeUrls: string[] = [];

  for (const candidate of urls || []) {
    const safeUrl = getSafeExternalUrl(candidate);
    if (!safeUrl || isKnownPlaceholderImageUrl(safeUrl) || seen.has(safeUrl)) {
      continue;
    }

    seen.add(safeUrl);
    safeUrls.push(safeUrl);
  }

  return safeUrls;
}

export function isSafeExternalUrl(url: string | null | undefined): boolean {
  return getSafeExternalUrl(url) !== null;
}
