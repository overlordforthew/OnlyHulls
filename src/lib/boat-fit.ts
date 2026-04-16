type SupportedLocale = "en" | "es";

function getLocaleFamily(locale?: string | null): SupportedLocale {
  return locale?.toLowerCase().startsWith("es") ? "es" : "en";
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function joinList(values: string[], localeFamily: SupportedLocale) {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return values.join(localeFamily === "es" ? " y " : " and ");
  const head = values.slice(0, -1).join(", ");
  const tail = values[values.length - 1];
  return `${head}${localeFamily === "es" ? " y " : ", and "}${tail}`;
}

function formatLoa(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function mapTagToUseCase(tag: string, localeFamily: SupportedLocale) {
  const normalized = normalizeTag(tag);
  const EN_MAP: Array<[RegExp, string]> = [
    [/\bliveaboard\b/, "liveaboard use"],
    [/\bblue water\b|\bbluewater\b|\boffshore\b/, "offshore passages"],
    [/\bperformance\b/, "performance sailing"],
    [/\bcruis(?:e|ing|er)\b/, "comfortable cruising"],
    [/\bshallow\b.*\bdraft\b|\bshoal\b/, "thin-water cruising"],
    [/\bowner\b.*\bversion\b/, "owner-focused layout"],
  ];
  const ES_MAP: Array<[RegExp, string]> = [
    [/\bliveaboard\b/, "vida a bordo"],
    [/\bblue water\b|\bbluewater\b|\boffshore\b/, "travesias offshore"],
    [/\bperformance\b/, "navegacion de rendimiento"],
    [/\bcruis(?:e|ing|er)\b/, "crucero comodo"],
    [/\bshallow\b.*\bdraft\b|\bshoal\b/, "navegacion en poco calado"],
    [/\bowner\b.*\bversion\b/, "distribucion pensada para el armador"],
  ];
  const map = localeFamily === "es" ? ES_MAP : EN_MAP;

  for (const [pattern, label] of map) {
    if (pattern.test(normalized)) return label;
  }

  return null;
}

export function buildBoatFitReasons(input: {
  locale?: string | null;
  specs?: Record<string, unknown> | null;
  characterTags?: string[] | null;
  locationText?: string | null;
  sourceUrl?: string | null;
  similarBoatCount?: number;
}) {
  const localeFamily = getLocaleFamily(input.locale);
  const specs = input.specs || {};
  const reasons: string[] = [];

  const loa = toFiniteNumber(specs.loa);
  const cabins = toFiniteNumber(specs.cabins);
  const berths = toFiniteNumber(specs.berths);
  const heads = toFiniteNumber(specs.heads);
  const vesselType =
    typeof specs.vessel_type === "string" && specs.vessel_type.trim()
      ? humanizeLabel(specs.vessel_type)
      : null;
  const rigType =
    typeof specs.rig_type === "string" && specs.rig_type.trim()
      ? humanizeLabel(specs.rig_type)
      : null;

  const setupBits: string[] = [];
  if (loa !== null) {
    setupBits.push(
      localeFamily === "es" ? `${formatLoa(loa)} pies de eslora` : `${formatLoa(loa)}ft LOA`
    );
  }
  if (vesselType) setupBits.push(vesselType);
  if (rigType) setupBits.push(rigType);

  const layoutBits: string[] = [];
  if (cabins !== null) {
    layoutBits.push(
      localeFamily === "es"
        ? `${cabins} camarote${cabins === 1 ? "" : "s"}`
        : `${cabins} cabin${cabins === 1 ? "" : "s"}`
    );
  }
  if (berths !== null) {
    layoutBits.push(
      localeFamily === "es"
        ? `${berths} litera${berths === 1 ? "" : "s"}`
        : `${berths} berth${berths === 1 ? "" : "s"}`
    );
  }
  if (heads !== null) {
    layoutBits.push(
      localeFamily === "es"
        ? `${heads} bano${heads === 1 ? "" : "s"}`
        : `${heads} head${heads === 1 ? "" : "s"}`
    );
  }

  if (setupBits.length > 0 || layoutBits.length > 0) {
    if (localeFamily === "es") {
      if (setupBits.length > 0) {
        const layout = layoutBits.length > 0 ? ` con ${joinList(layoutBits, localeFamily)}` : "";
        reasons.push(`La base del barco se lee rapido: ${setupBits.join(", ")}${layout}.`);
      } else if (layoutBits.length > 0) {
        reasons.push(`La distribucion suma ${joinList(layoutBits, localeFamily)}.`);
      }
    } else {
      if (setupBits.length > 0) {
        const layout = layoutBits.length > 0 ? `, with ${joinList(layoutBits, localeFamily)}` : "";
        reasons.push(`Quick read on the setup: ${setupBits.join(", ")}${layout}.`);
      } else if (layoutBits.length > 0) {
        reasons.push(`The layout includes ${joinList(layoutBits, localeFamily)}.`);
      }
    }
  }

  const mappedUses = Array.from(
    new Set(
      (input.characterTags || [])
        .map((tag) => mapTagToUseCase(tag, localeFamily))
        .filter((value): value is string => Boolean(value))
    )
  ).slice(0, 2);

  if (mappedUses.length > 0) {
    reasons.push(
      localeFamily === "es"
        ? `Las etiquetas del anuncio apuntan a ${joinList(mappedUses, localeFamily)}.`
        : `The listing signals ${joinList(mappedUses, localeFamily)}.`
    );
  }

  if (input.locationText?.trim()) {
    if ((input.similarBoatCount || 0) > 0) {
      reasons.push(
        localeFamily === "es"
          ? `Puedes compararlo enseguida con ${input.similarBoatCount} barco${input.similarBoatCount === 1 ? "" : "s"} parecido${input.similarBoatCount === 1 ? "" : "s"} en este mercado.`
          : `You can benchmark it against ${input.similarBoatCount} similar boat${input.similarBoatCount === 1 ? "" : "s"} in this market before reaching out.`
      );
    } else {
      reasons.push(
        localeFamily === "es"
          ? `La ubicacion en ${input.locationText} importa si estas comprando por zona de crucero, puerto de entrega o logistica.`
          : `The ${input.locationText} location matters if you are shopping by cruising ground, handoff port, or logistics.`
      );
    }
  }

  if (reasons.length < 3) {
    reasons.push(
      input.sourceUrl
        ? localeFamily === "es"
          ? "OnlyHulls lo mantiene dentro de tu flujo de comparacion primero y luego te lleva al anuncio original cuando estes listo."
          : "OnlyHulls keeps it in your compare flow first, then hands you to the original listing when you are ready."
        : localeFamily === "es"
          ? "Es un anuncio directo en OnlyHulls, asi que la conversacion puede quedarse dentro del marketplace."
          : "This is a direct OnlyHulls listing, so the conversation can stay inside the marketplace."
    );
  }

  return reasons.slice(0, 3);
}
