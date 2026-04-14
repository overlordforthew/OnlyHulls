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
    if (!safeUrl || seen.has(safeUrl)) {
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
