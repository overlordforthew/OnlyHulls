export type GeocodeTriageInput = {
  status?: string | null;
  error?: string | null;
  precision?: string | null;
  score?: number | null;
  placeName?: string | null;
};

export type GeocodeTriageResult = {
  category:
    | "cleanup_source_text"
    | "manual_enrichment"
    | "unmappable_source"
    | "manual_review"
    | "provider_health"
    | "config_skipped"
    | "provider_bug"
    | "already_resolved";
  action: string;
  retryable: boolean;
  blocksMap: boolean;
};

export function isProviderSideGeocodeError(error?: string | null) {
  const normalized = String(error || "").trim().toLowerCase();
  return (
    /^http_(402|403|429|5\d\d)$/.test(normalized) ||
    normalized.includes("rate") ||
    normalized.includes("quota") ||
    normalized.includes("timeout") ||
    normalized.includes("abort") ||
    normalized.includes("network") ||
    normalized.includes("provider")
  );
}

export function classifyGeocodeReviewIssue(input: GeocodeTriageInput): GeocodeTriageResult {
  const status = String(input.status || "").toLowerCase();
  const error = String(input.error || "").trim().toLowerCase();
  const precision = String(input.precision || "").trim().toLowerCase();

  if (status === "geocoded") {
    return {
      category: "already_resolved",
      action: "No triage needed.",
      retryable: false,
      blocksMap: false,
    };
  }

  if (["missing_user_agent", "missing_api_key", "provider_disabled"].includes(error)) {
    return {
      category: "config_skipped",
      action: "Fix geocoding provider configuration before retrying.",
      retryable: true,
      blocksMap: true,
    };
  }

  if (isProviderSideGeocodeError(error)) {
    return {
      category: "provider_health",
      action: "Retry after provider health, quota, or network issue is resolved.",
      retryable: true,
      blocksMap: true,
    };
  }

  if (error === "no_result") {
    return {
      category: "cleanup_source_text",
      action: "Improve the source location with a city, marina, or country before retrying.",
      retryable: false,
      blocksMap: true,
    };
  }

  if (
    error === "low_precision" ||
    precision === "country" ||
    precision === "region" ||
    precision === "unknown"
  ) {
    return {
      category: "manual_enrichment",
      action: "Add more specific location detail; broad regional results must stay off the public map.",
      retryable: false,
      blocksMap: true,
    };
  }

  if (error === "low_confidence") {
    return {
      category: "manual_enrichment",
      action: "Manually verify the candidate pin or enrich the location before accepting it.",
      retryable: false,
      blocksMap: true,
    };
  }

  if (error === "invalid_coordinates") {
    return {
      category: "provider_bug",
      action: "Treat as provider/data defect; manually inspect payload before retrying.",
      retryable: false,
      blocksMap: true,
    };
  }

  return {
    category: "manual_review",
    action: "Review the provider payload and source location before retrying or accepting.",
    retryable: false,
    blocksMap: true,
  };
}
