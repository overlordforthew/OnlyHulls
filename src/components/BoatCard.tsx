"use client";

import Link from "next/link";
import { Heart, X, MessageCircle, ExternalLink } from "lucide-react";

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
  };
  matchScore?: number;
  showActions?: boolean;
  onSave?: () => void;
  onDismiss?: () => void;
  onConnect?: () => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$", NZD: "NZ$",
  SEK: "kr", DKK: "kr", NOK: "kr",
};

function formatPrice(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = CURRENCY_SYMBOLS[currency] || "$";
  return `${sym}${Math.round(num).toLocaleString("en-US")}`;
}

export default function BoatCard({
  boat,
  matchScore,
  showActions,
  onSave,
  onDismiss,
  onConnect,
}: BoatCardProps) {
  const href = `/boats/${boat.slug || boat.id}`;

  return (
    <div className="group card-hover overflow-hidden rounded-xl border border-border bg-surface">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {boat.hero_url ? (
            <img
              src={boat.hero_url}
              alt={`${boat.year} ${boat.make} ${boat.model}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated">
              <span className="text-5xl opacity-20">⛵</span>
            </div>
          )}

          {/* Bottom gradient overlay for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Match score badge */}
          {matchScore !== undefined && (
            <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-success to-primary px-3 py-1 text-xs font-bold text-white shadow-lg">
              {Math.round(matchScore * 100)}% Match
            </span>
          )}

          {/* Source badge */}
          {boat.source_name ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              via {boat.source_name}
            </span>
          ) : boat.is_sample ? (
            <span className="absolute left-3 top-3 rounded-full bg-accent/90 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              Sample
            </span>
          ) : null}

          {/* Price overlay on image */}
          <div className="absolute bottom-3 left-3">
            <p className="text-lg font-bold text-white drop-shadow-lg">
              {formatPrice(boat.asking_price, boat.currency)}
              {boat.currency !== "USD" && (
                <span className="ml-1 text-xs font-normal text-white/70">{boat.currency}</span>
              )}
            </p>
            {boat.asking_price_usd && boat.currency !== "USD" && (
              <p className="text-xs text-white/60 drop-shadow-lg">
                ~{formatPrice(boat.asking_price_usd, "USD")}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="p-4">
        <Link href={href}>
          <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
            {boat.year} {boat.make} {boat.model}
          </h3>
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {boat.specs.loa && <span>{boat.specs.loa}ft</span>}
          {boat.specs.rig_type && (
            <>
              <span className="text-text-tertiary">·</span>
              <span>{boat.specs.rig_type}</span>
            </>
          )}
          {boat.location_text && (
            <>
              <span className="text-text-tertiary">·</span>
              <span>{boat.location_text}</span>
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
            {boat.source_url ? (
              <a
                href={boat.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-text-secondary hover:text-primary transition-colors"
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent py-2 text-xs font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
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
