"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink, GitCompareArrows, Heart, MapPin, MessageCircle, X } from "lucide-react";
import { getDisplayedPrice, type SupportedCurrency } from "@/lib/currency";
import { isLocalMediaUrl } from "@/lib/media";
import { getSafeExternalUrl } from "@/lib/url-safety";

interface BoatCardProps {
  boat: {
    id: string;
    make: string;
    model: string;
    year: number;
    asking_price: number;
    currency: string;
    location_text: string | null;
    location_confidence?: string | null;
    location_approximate?: boolean | null;
    slug: string | null;
    is_sample: boolean;
    hero_url: string | null;
    specs: { loa?: number; rig_type?: string; vessel_type?: string };
    character_tags: string[];
    source_site?: string | null;
    source_name?: string | null;
    source_url?: string | null;
    asking_price_usd?: number | null;
    seller_subscription_tier?: string | null;
  };
  displayCurrency?: SupportedCurrency;
  matchScore?: number;
  showActions?: boolean;
  onSave?: () => void;
  onDismiss?: () => void;
  onConnect?: () => void;
  onCompareToggle?: () => void;
  compareSelected?: boolean;
  compareDisabled?: boolean;
}

type BoatCardTranslator = (key: string, values?: Record<string, string | number>) => string;

export default function BoatCard({
  boat,
  displayCurrency,
  matchScore,
  showActions,
  onSave,
  onDismiss,
  onConnect,
  onCompareToggle,
  compareSelected,
  compareDisabled,
}: BoatCardProps) {
  const t = useTranslations("boatCard");
  const href = `/boats/${boat.slug || boat.id}`;
  const safeSourceUrl = getSafeExternalUrl(boat.source_url);
  const listingBadge = getListingBadge(boat, t);
  const trustSignal = getTrustSignal(boat, t);
  const showApproximateLocation = Boolean(
    boat.location_text && boat.location_approximate
  );
  const displayedPrice = getDisplayedPrice({
    amount: boat.asking_price,
    nativeCurrency: boat.currency,
    amountUsd: boat.asking_price_usd,
    preferredCurrency: displayCurrency,
  });
  const vesselType = formatVesselType(boat.specs.vessel_type);

  return (
    <div className="group card-hover overflow-hidden rounded-xl border border-border bg-surface">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {boat.hero_url ? (
            <Image
              src={boat.hero_url}
              alt={(() => {
                const loa = boat.specs.loa;
                const length = loa
                  ? `${Number.isInteger(loa) ? String(loa) : loa.toFixed(1).replace(/\.0$/, "")} ft`
                  : null;
                const hasLocation = Boolean(boat.location_text);
                const hasLength = Boolean(length);
                const vars = {
                  year: boat.year,
                  make: boat.make,
                  model: boat.model,
                  location: boat.location_text || "",
                  length: length || "",
                };
                if (hasLocation && hasLength) return t("imageAltWithLocationAndLength", vars);
                if (hasLocation) return t("imageAltWithLocation", vars);
                if (hasLength) return t("imageAltWithLength", vars);
                return t("imageAltBasic", vars);
              })()}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
              unoptimized={!isLocalMediaUrl(boat.hero_url)}
              quality={isLocalMediaUrl(boat.hero_url) ? 82 : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated">
              <span className="text-5xl opacity-20">{t("boatFallbackAlt")}</span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

          {matchScore !== undefined && (
            <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-success to-primary px-3 py-1 text-xs font-bold text-white shadow-lg">
              {t("matchPercent", { score: Math.round(matchScore * 100) })}
            </span>
          )}

          {listingBadge ? (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm ${listingBadge.className}`}
            >
              {listingBadge.label}
            </span>
          ) : null}

          <div className="absolute bottom-3 left-3">
            <p
              data-testid="boat-price-primary"
              className="text-lg font-bold text-white drop-shadow-lg"
            >
              {displayedPrice.primary}
            </p>
            {displayedPrice.secondary && (
              <p className="text-xs text-white/60 drop-shadow-lg">
                {displayedPrice.secondary}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="p-4">
        <Link href={href}>
          <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
            {`${boat.year} ${boat.make} ${boat.model}`}
          </h3>
        </Link>

        {boat.location_text ? (
          <div
            data-testid="boat-location"
            className="mt-2 flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground/85"
            title={boat.location_text}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{boat.location_text}</span>
            {showApproximateLocation && (
              <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-tertiary">
                {t("locationApproximate")}
              </span>
            )}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {boat.specs.loa && <span>{boat.specs.loa}ft</span>}
          {vesselType && (
            <>
              <span className="text-text-tertiary">/</span>
              <span>{vesselType}</span>
            </>
          )}
          {boat.specs.rig_type && (
            <>
              <span className="text-text-tertiary">/</span>
              <span>{boat.specs.rig_type}</span>
            </>
          )}
        </div>

        {boat.character_tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {boat.character_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {boat.source_name && (
          <div className="mt-2 flex items-center gap-1 text-xs text-text-tertiary">
            <span>{t("foundOn")}</span>
            {safeSourceUrl ? (
              <a
                href={safeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-text-secondary transition-colors hover:text-primary"
              >
                {boat.source_name}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-medium text-text-secondary">{boat.source_name}</span>
            )}
          </div>
        )}

        {trustSignal && (
          <div
            className="mt-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-text-secondary"
          >
            {trustSignal.label}
          </div>
        )}

        {onCompareToggle && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onCompareToggle}
              disabled={compareDisabled && !compareSelected}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                compareSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-text-secondary hover:border-primary hover:text-primary"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              data-testid="boat-compare-toggle"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              {compareSelected ? t("addedToCompare") : t("compare")}
            </button>
          </div>
        )}

        {showActions && (
          <div className="mt-4 flex gap-2">
            {onSave && (
              <button
                onClick={onSave}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium text-text-secondary transition-all hover:border-primary hover:text-primary"
              >
                <Heart className="h-3.5 w-3.5" />
                {t("save")}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium text-text-secondary transition-all hover:border-text-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                {t("pass")}
              </button>
            )}
            {onConnect && (
              <button
                onClick={onConnect}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent-btn py-2 text-xs font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("connect")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatVesselType(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getListingBadge(
  boat: BoatCardProps["boat"],
  t: BoatCardTranslator
) {
  if (boat.source_name || boat.source_site || boat.source_url) {
    return {
      label: `via ${boat.source_name || boat.source_site || t("partnerListing")}`,
      className: "bg-white/20",
    };
  }

  if (boat.is_sample) {
    return {
      label: t("sample"),
      className: "bg-accent-btn/90",
    };
  }

  if (boat.seller_subscription_tier === "featured" || boat.seller_subscription_tier === "broker") {
    return {
      label: t("featuredSeller"),
      className: "bg-accent-btn/90",
    };
  }

  return {
    label: t("exclusive"),
    className: "bg-primary-btn/85",
  };
}

function getTrustSignal(
  boat: BoatCardProps["boat"],
  t: BoatCardTranslator
) {
  if (!boat.location_text) {
    return null;
  }

  if (boat.source_name && !boat.source_url) {
    return {
      label: t("trustSourceNoLink", { source: boat.source_name }),
      tone: "neutral" as const,
    };
  }

  return null;
}
