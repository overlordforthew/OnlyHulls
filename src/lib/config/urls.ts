function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getPublicAppUrl(): string {
  return trimTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "https://onlyhulls.com"
  );
}

export function getAuthAppUrl(): string {
  return trimTrailingSlash(
    process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://onlyhulls.com"
  );
}

export function getClaudeProxyUrl(): string | null {
  const configured = process.env.CLAUDE_PROXY_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://host.docker.internal:3099";
  }

  return null;
}
