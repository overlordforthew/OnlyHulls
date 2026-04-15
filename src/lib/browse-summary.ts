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

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function dedupeSentences(sentences: string[]) {
  return sentences.filter(
    (sentence, index) =>
      sentences.findIndex((candidate) => candidate.toLowerCase() === sentence.toLowerCase()) === index
  );
}

function stripSummaryBoilerplate(value: string) {
  return value
    .replace(/\s*[;,:-]?\s*\bAsking\s+(?:[A-Z]{3}\s+)?[$€£]?\d[\d,]*(?:\.\d+)?\.?/gi, "")
    .replace(
      /\s*[;,:-]?\s*\bAsking(?:\s+price)?\s*:?\s*(?:just\s+reduced\s+to|reduced\s+to|has\s+now\s+been\s+reduced\s+to|is)?\s*(?:[A-Z$]{2,5}\s*)?[$€£]?\d[\d,]*(?:\.\d+)?(?:\s*(?:ex(?:cl\.?)?\s*vat|vat paid|eu vat paid|or nearest offer))?[^.!?]*[.!?]?/gi,
      ""
    )
    .replace(/\s*\bImported from\s+[^.]+\.?/gi, "")
    .replace(/\s*\bPlease contact(?:\s+our\s+broker|\s+us)?[^.!?]*[.!?]?/gi, "")
    .replace(/\s*\bContact us\b[^.!?]*[.!?]?/gi, "")
    .replace(/\s*[^.!?]*\bis your go-to contact for any questions[^.!?]*[.!?]?/gi, "")
    .replace(/\s*\bFor more information contact\b[^.!?]*[.!?]?/gi, "")
    .replace(/\s*\bViewings?\s+by appointment\b[^.!?]*[.!?]?/gi, "")
    .replace(/\s*\bFeel free to give us a call\b[^.!?]*[.!?]?/gi, "")
    .replace(/\s*\bFor complete details\b[^.!?]*[.!?]?/gi, "")
    .replace(/\s*\bYou have questions\?\s*We have answers\.[^.!?]*[.!?]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSentenceCase(value: string) {
  if (!value) return "";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function cleanImportedListingSummary(input: {
  summary?: string | null;
  title?: string | null;
  locationText?: string | null;
  maxLength?: number | null;
}) {
  const normalized = String(input.summary || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const cleanedSentences = splitSentences(normalized)
    .map((sentence) => {
      let cleaned = stripSummaryBoilerplate(normalizeSentence(sentence))
        .replace(/\blisted in\b/gi, "in")
        .replace(/\blisted\b/gi, "")
        .trim();

      cleaned = cleaned.replace(/^[\s,:-]+/, "").trim();
      if (!cleaned) return "";

      cleaned = normalizeSentenceCase(cleaned);
      return ensureSentencePunctuation(cleaned);
    })
    .filter(Boolean);

  const preferred = dedupeSentences(cleanedSentences).join(" ").trim();
  if (preferred) {
    return input.maxLength ? trimSummary(preferred, input.maxLength) : preferred;
  }

  const fallback = stripSummaryBoilerplate(
    normalized
      .replace(/\bKey specs include\s+/i, "")
      .replace(/\b(monohull|catamaran|trimaran) hull\b/gi, "$1")
      .replace(/\blisted in\b/gi, "in")
      .replace(/\blisted\b/gi, "")
  );

  return input.maxLength ? trimSummary(fallback, input.maxLength) : fallback;
}

export function buildBoatPublicSummary(input: {
  summary?: string | null;
  title?: string | null;
  locationText?: string | null;
  maxLength?: number | null;
}) {
  const cleaned = cleanImportedListingSummary({
    ...input,
    maxLength: null,
  });

  if (!cleaned) return "";

  const title = String(input.title || "").trim();
  const locationText = String(input.locationText || "").trim();
  const titlePattern = title ? new RegExp(`^${escapeRegExp(title)}\\b`, "i") : null;
  const locationPattern = locationText ? new RegExp(`\\b${escapeRegExp(locationText)}\\b`, "i") : null;

  const publicSentences = splitSentences(cleaned)
    .map((sentence) => {
      let next = sentence.trim();

      if (titlePattern && titlePattern.test(next)) {
        next = next
          .replace(titlePattern, "")
          .replace(/^[\s,:-]+/, "")
          .replace(/^(?:with|featuring)\s+/i, "")
          .trim();
      }

      if (locationText) {
        const standaloneLeadLocationPattern = new RegExp(
          `^(?:listed in|located in|lying in|lying)\\s+${escapeRegExp(locationText)}\\b`,
          "i"
        );
        if (standaloneLeadLocationPattern.test(next)) {
          return "";
        }

        const leadingLocationPattern = new RegExp(
          `^(?:in)\\s+${escapeRegExp(locationText)}(?:[;,:-]|$)`,
          "i"
        );
        next = next.replace(leadingLocationPattern, "").trim();
      }

      next = next.replace(/^[\s,:-]+/, "").trim();
      if (!next) return "";

      next = normalizeSentenceCase(next);
      return ensureSentencePunctuation(next);
    })
    .filter((sentence) => {
      if (!sentence) return false;
      if (titlePattern && /\b(listed|located)\b/i.test(sentence) && titlePattern.test(sentence)) {
        return false;
      }
      if (titlePattern && locationPattern && titlePattern.test(sentence) && locationPattern.test(sentence)) {
        return false;
      }
      return true;
    });

  const standaloneLocationPattern = locationText
    ? new RegExp(`^(?:Located in|Lying in|Lying|In)\\s+${escapeRegExp(locationText)}\\.?$`, "i")
    : null;
  const preferred = dedupeSentences(publicSentences).filter((sentence, index, all) => {
    if (!standaloneLocationPattern) return true;
    if (all.length <= 1) return true;
    return !standaloneLocationPattern.test(sentence);
  });

  const summary = preferred.join(" ").trim() || cleaned;
  if (!summary) {
    return "";
  }

  return input.maxLength ? trimSummary(summary, input.maxLength) : summary;
}

export function buildBoatBrowseSummary(input: {
  summary?: string | null;
  title?: string | null;
  locationText?: string | null;
  maxLength?: number;
}) {
  return buildBoatPublicSummary({
    ...input,
    maxLength: input.maxLength ?? 220,
  });
}
