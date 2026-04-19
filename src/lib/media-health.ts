export const MEDIA_FETCH_STATUSES = ["unchecked", "ok", "failed", "blocked"] as const;

export type MediaFetchStatus = (typeof MEDIA_FETCH_STATUSES)[number];

export type ExternalImageFetchClassification = {
  fetchStatus: Exclude<MediaFetchStatus, "unchecked">;
  blockedReason: string | null;
};

export function buildUsableMediaSql(alias = "bm") {
  return `COALESCE(${alias}.fetch_status, 'unchecked') NOT IN ('failed', 'blocked')`;
}

export function classifyExternalImageFetch(input: {
  httpStatus: number | null;
  contentType: string | null;
  byteLength: number;
}): ExternalImageFetchClassification {
  if (input.httpStatus === null) {
    return { fetchStatus: "failed", blockedReason: "fetch_error" };
  }

  if (input.httpStatus < 200 || input.httpStatus >= 400) {
    return { fetchStatus: "failed", blockedReason: `http_${input.httpStatus}` };
  }

  const contentType = String(input.contentType || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    return {
      fetchStatus: "failed",
      blockedReason: contentType ? "non_image_content_type" : "missing_content_type",
    };
  }

  if (input.byteLength <= 0) {
    return { fetchStatus: "failed", blockedReason: "empty_body" };
  }

  return { fetchStatus: "ok", blockedReason: null };
}
