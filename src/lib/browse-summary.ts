function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSourceSite(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function buildLoosePattern(value: string, anchored = false) {
  const tokens = String(value || "")
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map(escapeRegExp);

  if (tokens.length === 0) return null;
  return new RegExp(`${anchored ? "^" : ""}${tokens.join("[\\s._/&'-]*")}\\b`, "i");
}

function normalizeSentence(value: string) {
  return value
    .replace(/^Key specs include\s+/i, "")
    .replace(/^For sale\b[\s:,-]*/i, "")
    .replace(/\b(monohull|catamaran|trimaran) hull\b/gi, "$1")
    .replace(/\b(One|Two|Three|Four)\.\s+(?=(?:forward|aft|port|starboard)\b)/gi, "$1 ")
    .replace(/\b(double|single)\.\s+(?=(?:forward|aft)\b)/gi, "$1 ")
    .replace(/\bwith\.\s+(?=(?:one|two|three|four|five|six|seven|eight|nine|ten)\b)/gi, "with ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*,/g, ". ")
    .replace(/\b(?:and|plus)\s+(?:so much more|many more)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const THEYACHTMARKET_SECTION_STARTERS = [
  "SLEEPS",
  "WEBASTO",
  "MAXPOWER",
  "NEW TEAK COCKPIT",
  "NEW UPHOLSTERY",
  "GRP hull construction",
  "Long keel configuration",
  "Bilge keels",
  "Long centre keel",
  "Transom hung rudder",
  "Coppercoated hull",
  "Painted topsides",
  "Covers for woodwork",
  "Wide, safe",
  "On Deck",
  "Double bow roller",
  "Windlass",
  "CQR anchor",
  "Non skid",
  "Bronze anodised",
  "Teak interior joinery",
  "Seven coats Gelshield",
  "Topsides painted",
  "Deck repainted",
  "Owner's cabin",
  "One forward",
  "One aft",
  "One large aft owner's cabin",
  "Two aft",
  "Two cabins",
  "Two showers",
  "Three cabins",
  "Seven berths",
  "Saloon table",
  "Charts table",
  "Chart table on the",
  "Large chart table",
  "Spacious chart table",
  "Main saloon",
  "L-shaped galley",
  "U-shaped saloon",
  "Forward large shower room",
  "Starboard bow accessible",
  "One Quick",
  "Galley on the",
  "Hot and cold",
  "Water maker",
  "Watermaker",
  "Webasto",
  "Solar panel",
  "Solar panels",
  "Batteries",
  "Full batten",
  "Furling",
  "Ketch rigged",
];

const THEYACHTMARKET_SECTION_PATTERN = new RegExp(
  `\\s+(?=(?:${THEYACHTMARKET_SECTION_STARTERS.map(escapeRegExp).join("|")})\\b)`,
  "gi"
);

function normalizeTheYachtMarketSummaryText(value: string) {
  const cleaned = value
    .replace(/^\s*Remarks?\s*:\s*/i, "")
    .replace(/^\s*Summary\s*(?=\d{4}\b)/i, "")
    .replace(/\bPART\s+EXCHANGE\s*&\s*FINANCE\s+AVAILABLE\b/gi, "")
    .replace(/\bREMARKS\b/gi, "")
    .replace(/\s+-\s*Project purchase\b/gi, "")
    .replace(/\bProject purchase\b/gi, "")
    .replace(/\s*-{5,}[\s\S]*$/g, "")
    .replace(/>>/g, ". ")
    .replace(/(\d{4})(?=[A-Z]{2,}\b)/g, "$1. ")
    .replace(/([a-z])'(?=[A-Z])/g, "$1. '")
    .replace(/\s+/g, " ")
    .trim();

  const sentencePunctuationCount = (cleaned.match(/[.!?]/g) || []).length;
  const hasArtifactSignal =
    /\b(?:one forward|one aft|chart table on the|hot and cold|sleeps|webasto|maxpower|new teak cockpit|new upholstery)\b/i.test(cleaned) ||
    /\b(?:one double aft cabin|forward large shower room|starboard bow accessible|one quick)\b/i.test(cleaned);

  if (sentencePunctuationCount >= 2 && !hasArtifactSignal) {
    return cleaned;
  }

  return cleaned.replace(THEYACHTMARKET_SECTION_PATTERN, ". ");
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

function normalizeSummaryText(value: string, sourceSite?: string | null) {
  let normalized = value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[•·●▪◦]/g, ". ")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\b(One|Two|Three|Four)\.\s+(?=(?:Forward|Aft|Port|Starboard)\b)/gi, "$1 ")
    .replace(/\b(double|single)\.\s+(?=(?:Forward|Aft)\b)/gi, "$1 ")
    .replace(/with\.\s+(?=(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b)/gi, "with ")
    .replace(/\bcentral cabinet\s+(?=Chart table\b)/gi, "central cabinet. ")
    .replace(/\s+\./g, ".")
    .replace(/([.!?])(?=[A-Z"'])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();

  normalized = normalized
    .replace(
      /\b(One|Two|Three|Four)\s+(Forward|Aft|Port|Starboard)\b/g,
      (_, count: string, direction: string) => `${count} ${direction.toLowerCase()}`
    )
    .replace(
      /\b(double|single)\s+(Forward|Aft)\b/gi,
      (_, kind: string, direction: string) => `${kind.toLowerCase()} ${direction.toLowerCase()}`
    )
    .replace(
      /\bwith\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b/g,
      (_, count: string) => `with ${count.toLowerCase()}`
    );

  if (normalizeSourceSite(sourceSite) === "theyachtmarket") {
    normalized = normalizeTheYachtMarketSummaryText(normalized);
  }

  return normalized;
}

function insertSyntheticSentenceBreaks(value: string, sourceSite?: string | null) {
  return value
    .replace(/(?<=[a-z0-9)])\s+(?=(?:[A-Z][A-Z/&'’() +.-]{2,32}:))/g, ". ")
    .replace(/\s+(?=\d{4}\)\s+)/g, ". ")
    .replace(
      /\s+(?=(?:Owner'?s|One|Two|Three|Four|Forepeak|Chart(?:s)? table|Saloon table|C-shaped|L-shaped|Linear)\s+(?:cabin|cabins|shower|shower room|shower rooms|heads?|bathroom|bathrooms|galley|kitchen|settee|settees|berths?|chart table)\b)/gi,
      ". "
    )
    .replace(
      /(\b(?:bathroom|bathrooms|shower room|shower rooms|heads?|cabins?|galley|kitchen|settee|settees|berths?|chart table))\s+(?=(?:Double|Twin|Single)\s+(?:cabin|cabins|berths?|heads?|bathroom|bathrooms)\b)/gi,
      "$1. "
    )
    .replace(/with\.\s+(?=(?:one|two|three|four|five|six|seven|eight|nine|ten)\b)/gi, "with ")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .trim();
}

function splitSentences(value: string, sourceSite?: string | null) {
  return insertSyntheticSentenceBreaks(normalizeSummaryText(value, sourceSite), sourceSite)
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
    .replace(
      /^\s*(?:for\s+(?:more\s+)?information|for\s+info(?:rmation)?|contact(?:\s+us)?|call(?:\s+us)?)\b[\s:,-]*(?:[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3}\s+)?\+?\d[\d\s()./-]{6,}\s*/i,
      ""
    )
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
    .replace(/\s*\bWe provide only a selection of key information on this platform\b[^.!?]*[.!?]?/gi, "")
    .replace(/\s*\bYou have questions\?\s*We have answers\.[^.!?]*[.!?]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSentenceCase(value: string) {
  if (!value) return "";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const SPEC_SIGNAL_PATTERN =
  /\b(?:loa|lwl|beam|draft|displacement|ballast|keel|rudder|engine|diesel|fuel|watermaker|water tank|fuel tank|generator|air ?con|autopilot|windlass|solar|bimini|sprayhood|trampoline|helm|cockpit|saloon|galley|cabin|cabins|berths?|heads?|wc\/shower|sleeps?|rig|sloop|cutter|ketch|yawl|catamaran|trimaran|monohull|owner'?s?\s+version|never chartered|private use only|bow thruster|sail ?drive)\b/i;
const DIMENSION_SIGNAL_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:ft|feet|m|metres?|meters?|hp|kw|knots?|ltrs?|litres?|liters?|kg|lbs?)\b/i;
const MAINTENANCE_SIGNAL_PATTERN =
  /\b(?:new|rebuilt|replaced|renewed|refit|refurbished|restored|serviced|maintained|upgraded|inspected|certified|winteri[sz]ed|paid up|ready for the season|ready to sail)\b/i;
const USE_CASE_SIGNAL_PATTERN =
  /\b(?:family|short[- ]handed|offshore|blue[- ]water|bluewater|cruising|liveaboard|passage[- ]making|owner'?s layout|guest cabin|suite)\b/i;
const STRUCTURED_SPEC_PATTERN =
  /\b(?:type|displacement|wc\/shower|engine type|power transmission|last service|water tank|fuel tank)\s*:/i;
const SALES_SIGNAL_PATTERN =
  /\b(?:contact|call|appointment|viewings?|website|offices across|questions|give us a call|schedule your viewing|submit your offer|make an offer|more information|price by negotiation|nearest offer|available on request|sale pending|deal pending|under offer|reserved)\b/i;
const HYPE_SIGNAL_PATTERN =
  /\b(?:incredible|remarkable|stunning|fabulous|amazing|magnificent|prestigious|exceptional|unmatched|dream(?:ing)?|do not miss|superb opportunity|iconic|beloved|wonderful|go-to|ready for new adventures)\b/i;
const BAD_LEAD_PATTERN =
  /^(?:remarks?|broker'?s remarks?|owner'?s remarks?|manufacturer provided description|technical highlights|key features|ground tackle|deck gear|navigation aids|for (?:more )?information|contact(?: us)?|call(?: us)?)\b/i;
const LONG_SUMMARY_THRESHOLD = 360;
const DEFAULT_COMPRESSED_SUMMARY_LENGTH = 360;

function scoreSummarySentence(sentence: string) {
  const normalized = sentence.trim();
  if (!normalized) return Number.NEGATIVE_INFINITY;

  let score = 0;

  if (SPEC_SIGNAL_PATTERN.test(normalized)) score += 3;
  if (DIMENSION_SIGNAL_PATTERN.test(normalized)) score += 3;
  if (MAINTENANCE_SIGNAL_PATTERN.test(normalized)) score += 2;
  if (USE_CASE_SIGNAL_PATTERN.test(normalized)) score += 1;
  if (STRUCTURED_SPEC_PATTERN.test(normalized)) score += 2;

  if (normalized.length >= 35 && normalized.length <= 190) score += 1;
  if (normalized.length > 260) score -= 3;
  else if (normalized.length > 180) score -= 1;

  const commaCount = (normalized.match(/,/g) || []).length;
  if (commaCount >= 8) score -= 2;
  if ((normalized.match(/:/g) || []).length >= 2) score -= 2;

  if (BAD_LEAD_PATTERN.test(normalized)) score -= 4;
  if (SALES_SIGNAL_PATTERN.test(normalized)) score -= 4;
  if (HYPE_SIGNAL_PATTERN.test(normalized)) score -= 1;

  return score;
}

function condenseSummarySentences(
  sentences: string[],
  input: {
    maxLength: number;
    maxSentences: number;
  }
) {
  const deduped = dedupeSentences(sentences.map((sentence) => sentence.trim()).filter(Boolean));
  if (deduped.length === 0) return "";

  if (deduped.length <= input.maxSentences) {
    const joined = deduped.join(" ").trim();
    if (joined.length <= input.maxLength) return joined;
  }

  const scored = deduped
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSummarySentence(sentence),
    }));

  const chosen: Array<{ sentence: string; index: number; score: number }> = [];
  let currentLength = 0;

  for (const candidate of scored) {
    if (candidate.score < 1) continue;
    if (chosen.length >= input.maxSentences) break;

    const nextLength = currentLength === 0
      ? candidate.sentence.length
      : currentLength + 1 + candidate.sentence.length;

    if (chosen.length > 0 && nextLength > input.maxLength) continue;

    chosen.push(candidate);
    currentLength = nextLength;
  }

  const selected = (chosen.length > 0
    ? chosen
    : [...scored].sort((left, right) => right.score - left.score || left.index - right.index).slice(0, 1))
    .sort((left, right) => left.index - right.index)
    .map((candidate) => candidate.sentence);

  return trimSummary(selected.join(" ").trim(), input.maxLength);
}

export function shouldCompressImportedListingSummary(input: {
  summary?: string | null;
  sourceSite?: string | null;
  lengthThreshold?: number;
  sentenceThreshold?: number;
}) {
  const normalized = String(input.summary || "").replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  const lengthThreshold = input.lengthThreshold ?? LONG_SUMMARY_THRESHOLD;
  const sentenceThreshold = input.sentenceThreshold ?? 3;

  return (
    normalized.length > lengthThreshold ||
    splitSentences(normalized, input.sourceSite).length > sentenceThreshold
  );
}

export function compressImportedListingSummary(input: {
  summary?: string | null;
  sourceSite?: string | null;
  maxLength?: number;
  maxSentences?: number;
}) {
  const normalized = String(input.summary || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const maxLength = input.maxLength ?? DEFAULT_COMPRESSED_SUMMARY_LENGTH;
  const maxSentences = input.maxSentences ?? 3;

  const sentences = splitSentences(normalized, input.sourceSite);
  const hasWeakSentence = sentences.some((sentence) => scoreSummarySentence(sentence) < 1);
  if (sentences.length <= maxSentences && normalized.length <= maxLength && !hasWeakSentence) {
    return normalized;
  }

  return condenseSummarySentences(sentences, {
    maxLength,
    maxSentences,
  });
}

export function cleanImportedListingSummary(input: {
  summary?: string | null;
  title?: string | null;
  locationText?: string | null;
  sourceSite?: string | null;
  maxLength?: number | null;
}) {
  const normalized = String(input.summary || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const cleanedSentences = splitSentences(normalized, input.sourceSite)
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
    normalizeSummaryText(normalized, input.sourceSite)
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
  sourceSite?: string | null;
  maxLength?: number | null;
}) {
  const cleaned = cleanImportedListingSummary({
    ...input,
    maxLength: null,
  });

  if (!cleaned) return "";

  const title = String(input.title || "").trim();
  const titleWithoutYear = title.replace(/^\d{4}\s+/, "").trim();
  const locationText = String(input.locationText || "").trim();
  const titlePattern = buildLoosePattern(title, true);
  const titleWithoutYearPattern =
    titleWithoutYear && titleWithoutYear !== title ? buildLoosePattern(titleWithoutYear, true) : null;
  const titleAnywherePattern = buildLoosePattern(title, false);
  const locationPattern = locationText ? new RegExp(`\\b${escapeRegExp(locationText)}\\b`, "i") : null;

  const publicSentences = splitSentences(cleaned, input.sourceSite)
    .map((sentence) => {
      let next = sentence.trim();

      if (/^(?:listed in|located in|lying in|lying)\b/i.test(next)) {
        const locationArtifactPattern =
          /^(?:listed in|located in|lying in|lying)\b[^.!?]*?\d+\s+(?=with\b|featuring\b)/i;
        if (locationArtifactPattern.test(next)) {
          next = next.replace(locationArtifactPattern, "").trim();
          next = next.replace(/^(?:with|featuring)\s+/i, "").trim();
        }
      }

      if (titleAnywherePattern && /^(?:listed in|located in|lying in|lying)\b/i.test(next)) {
        const titleMatch = next.match(titleAnywherePattern);
        if (titleMatch && typeof titleMatch.index === "number") {
          next = next.slice(titleMatch.index).trim();
        }
      }

      if (titlePattern && titlePattern.test(next)) {
        next = next
          .replace(titlePattern, "")
          .replace(/^[\s,:-]+/, "")
          .replace(/^(?:with|featuring)\s+/i, "")
          .trim();
      }

      if (titleWithoutYearPattern && titleWithoutYearPattern.test(next)) {
        next = next
          .replace(titleWithoutYearPattern, "")
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

  return compressImportedListingSummary({
    summary,
    sourceSite: input.sourceSite,
    maxLength: input.maxLength ?? DEFAULT_COMPRESSED_SUMMARY_LENGTH,
    maxSentences: input.maxLength && input.maxLength <= 220 ? 2 : 3,
  });
}

export function buildBoatBrowseSummary(input: {
  summary?: string | null;
  title?: string | null;
  locationText?: string | null;
  sourceSite?: string | null;
  maxLength?: number;
}) {
  return buildBoatPublicSummary({
    ...input,
    maxLength: input.maxLength ?? 220,
  });
}
