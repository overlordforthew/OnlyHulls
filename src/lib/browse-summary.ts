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

function ensureSentencePunctuation(value: string) {
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
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
    .map((sentence) => {
      let cleaned = normalizeSentence(sentence)
        .replace(/\s*[;,:-]?\s*\bAsking\s+(?:[A-Z]{3}\s+)?[$€£]?\d[\d,]*(?:\.\d+)?\.?/gi, "")
        .replace(/\s*\bImported from\s+[^.]+\.?/gi, "")
        .trim();

      if (titlePattern && titlePattern.test(cleaned)) {
        cleaned = cleaned
          .replace(titlePattern, "")
          .replace(/^[\s,:-]+/, "")
          .replace(/^(?:with|featuring)\s+/i, "")
          .trim();
      }

      if (locationText) {
        const leadingLocationPattern = new RegExp(
          `^(?:listed in|located in|in)\\s+${escapeRegExp(locationText)}(?:[;,:-]|$)`,
          "i"
        );
        cleaned = cleaned.replace(leadingLocationPattern, "").trim();
      }

      if (/^(?:listed in|located in|in)\b/i.test(cleaned)) {
        cleaned = "";
      }

      cleaned = cleaned.replace(/^[\s,:-]+/, "").trim();
      if (!cleaned) return "";

      cleaned = `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
      return ensureSentencePunctuation(cleaned);
    })
    .filter((sentence) => {
      if (!sentence) return false;
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
    .replace(/\s*[;,:-]?\s*\bAsking\s+(?:[A-Z]{3}\s+)?[$€£]?\d[\d,]*(?:\.\d+)?\.?/gi, "")
    .replace(/\bImported from\s+[^.]+\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return trimSummary(fallback, maxLength);
}
