"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Heart, MapPin, MessageCircle, X } from "lucide-react";
import { getDisplayedPrice, type SupportedCurrency } from "@/lib/currency";
import { isLocalMediaUrl } from "@/lib/media";

interface BoatCardProps {
  boat: {
    id: string;
    make: string;
    model: string;
    year: number;
    asking_price: number;
    currency: string;
    location_text: string | null;
    slug: string | null;
    is_sample: boolean;
    hero_url: string | null;
    specs: { loa?: number; rig_type?: string };
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
}

export default function BoatCard({
  boat,
  displayCurrency,
  matchScore,
  showActions,
  onSave,
  onDismiss,
  onConnect,
}: BoatCardProps) {
  const href = `/boats/${boat.slug || boat.id}`;
  const listingBadge = getListingBadge(boat);
  const displayedPrice = getDisplayedPrice({
    amount: boat.asking_price,
    nativeCurrency: boat.currency,
    amountUsd: boat.asking_price_usd,
    preferredCurrency: displayCurrency,
  });

  return (
    <div className="group card-hover overflow-hidden rounded-xl border border-border bg-surface">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {boat.hero_url ? (
            <Image
              src={boat.hero_url}
              alt={`${boat.year} ${boat.make} ${boat.model}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
              unoptimized={!isLocalMediaUrl(boat.hero_url)}
              quality={isLocalMediaUrl(boat.hero_url) ? 82 : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated">
              <span className="text-5xl opacity-20">Boat</span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

          {matchScore !== undefined && (
            <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-success to-primary px-3 py-1 text-xs font-bold text-white shadow-lg">
              {Math.round(matchScore * 100)}% Match
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
            <p className="text-lg font-bold text-white drop-shadow-lg">
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

        {boat.location_text && (
          <div
            data-testid="boat-location"
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-foreground/85"
            title={boat.location_text}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{boat.location_text}</span>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {boat.specs.loa && <span>{boat.specs.loa}ft</span>}
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
            <span>Found on</span>
            {boat.source_url && /^https?:\/\//i.test(boat.source_url) ? (
              <a
                href={boat.source_url}
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

        {showActions && (
          <div className="mt-4 flex gap-2">
            {onSave && (
              <button
                onClick={onSave}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium text-text-secondary transition-all hover:border-primary hover:text-primary"
              >
                <Heart className="h-3.5 w-3.5" />
                Save
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-medium text-text-secondary transition-all hover:border-text-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Pass
              </button>
            )}
            {onConnect && (
              <button
                onClick={onConnect}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent-btn py-2 text-xs font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Connect
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getListingBadge(boat: BoatCardProps["boat"]) {
  if (boat.source_name || boat.source_site || boat.source_url) {
    return {
      label: `via ${boat.source_name || boat.source_site || "partner listing"}`,
      className: "bg-white/20",
    };
  }

  if (boat.is_sample) {
    return {
      label: "Sample",
      className: "bg-accent-btn/90",
    };
  }

  if (boat.seller_subscription_tier === "featured" || boat.seller_subscription_tier === "broker") {
    return {
      label: "Featured Seller",
      className: "bg-accent-btn/90",
    };
  }

  return {
    label: "Exclusive to OnlyHulls",
    className: "bg-primary-btn/85",
  };
}
