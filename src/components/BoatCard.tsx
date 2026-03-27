import Link from "next/link";
import { Heart, X, MessageCircle } from "lucide-react";

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
  };
  matchScore?: number;
  showActions?: boolean;
  onSave?: () => void;
  onDismiss?: () => void;
  onConnect?: () => void;
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

          {/* Sample badge */}
          {boat.is_sample && (
            <span className="absolute left-3 top-3 rounded-full bg-accent/90 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              Sample
            </span>
          )}

          {/* Price overlay on image */}
          <div className="absolute bottom-3 left-3">
            <p className="text-lg font-bold text-white drop-shadow-lg">
              ${boat.asking_price.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-white/70">{boat.currency}</span>
            </p>
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
