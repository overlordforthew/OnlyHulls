function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSentence(value: string) {
  return value
    .replace(/^Key specs include\s+/i, "")
    .replace(/\b(monohull|catamaran|trimaran) hull\b/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function trimSummary(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  const clipped = value.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace > 120 ? clipped.slice(0, lastSpace) : clipped;
  return `${safeClip.trimEnd()}...`;
}

export function buildBoatBrowseSummary(input: {
  summary?: string | null;
  title?: string | null;
  locationText?: string | null;
  maxLength?: number;
}) {
  const maxLength = input.maxLength ?? 220;
  const normalized = String(input.summary || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const title = String(input.title || "").trim();
  const locationText = String(input.locationText || "").trim();
  const titlePattern = title ? new RegExp(`^${escapeRegExp(title)}\\b`, "i") : null;
  const locationPattern = locationText ? new RegExp(`\\b${escapeRegExp(locationText)}\\b`, "i") : null;

  const cleanedSentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => normalizeSentence(sentence))
    .filter((sentence) => {
      if (!sentence) return false;
      if (/^Asking\b/i.test(sentence)) return false;
      if (/^Imported from\b/i.test(sentence)) return false;
      if (titlePattern && titlePattern.test(sentence) && /\b(listed|located)\b/i.test(sentence)) {
        return false;
      }
      if (titlePattern && locationPattern && titlePattern.test(sentence) && locationPattern.test(sentence)) {
        return false;
      }
      return true;
    });

  const deduped = cleanedSentences.filter(
    (sentence, index) =>
      cleanedSentences.findIndex((candidate) => candidate.toLowerCase() === sentence.toLowerCase()) === index
  );

  const preferred = deduped.join(" ").trim();
  if (preferred) {
    return trimSummary(preferred, maxLength);
  }

  const fallback = normalized
    .replace(/\bAsking\s+[A-Z]{3}\s+[\d,]+(?:\.\d+)?\.?/gi, "")
    .replace(/\bImported from\s+[^.]+\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return trimSummary(fallback, maxLength);
}
