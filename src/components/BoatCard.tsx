import Link from "next/link";

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
    <div className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition hover:shadow-md">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] bg-muted">
          {boat.hero_url ? (
            <img
              src={boat.hero_url}
              alt={`${boat.year} ${boat.make} ${boat.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-foreground/20">
              ⛵
            </div>
          )}
          {matchScore !== undefined && (
            <span className="absolute right-2 top-2 rounded-full bg-primary px-3 py-1 text-sm font-bold text-white">
              {Math.round(matchScore * 100)}% Match
            </span>
          )}
          {boat.is_sample && (
            <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
              Sample Listing
            </span>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link href={href}>
          <h3 className="font-semibold group-hover:text-primary">
            {boat.year} {boat.make} {boat.model}
          </h3>
        </Link>
        <p className="mt-1 text-lg font-bold text-primary">
          ${boat.asking_price.toLocaleString()} {boat.currency}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-foreground/60">
          {boat.specs.loa && <span>{boat.specs.loa}ft</span>}
          {boat.specs.rig_type && <span>{boat.specs.rig_type}</span>}
          {boat.location_text && <span>{boat.location_text}</span>}
        </div>
        {boat.character_tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {boat.character_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/60"
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
                className="flex-1 rounded-full border border-border py-1.5 text-xs font-medium hover:bg-muted"
              >
                Save
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-1 rounded-full border border-border py-1.5 text-xs font-medium hover:bg-muted"
              >
                Pass
              </button>
            )}
            {onConnect && (
              <button
                onClick={onConnect}
                className="flex-1 rounded-full bg-primary py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
              >
                Connect
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
