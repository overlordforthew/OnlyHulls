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

export function isSafeExternalUrl(url: string | null | undefined): boolean {
  return getSafeExternalUrl(url) !== null;
}
