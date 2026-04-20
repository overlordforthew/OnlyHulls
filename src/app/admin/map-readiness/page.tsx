import Link from "next/link";
import { getMapReadinessSnapshot } from "@/lib/locations/map-readiness-data";
import type { MapReadinessSplit } from "@/lib/locations/map-readiness";

export const dynamic = "force-dynamic";

function formatPct(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        ready
          ? "border-green-500/40 bg-green-500/10 text-green-600"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600"
      }`}
    >
      {ready ? "Launch ready" : "Not ready"}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string | number;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-surface p-4 ${warn ? "border-amber-500/40" : "border-border"}`}>
      <p className="text-xs font-semibold uppercase text-foreground/50">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-sm text-foreground/60">{detail}</p> : null}
    </div>
  );
}

function ProgressCard({
  label,
  value,
  target,
  direction = "atLeast",
}: {
  label: string;
  value: number;
  target: number;
  direction?: "atLeast" | "atMost";
}) {
  const width = Math.min(Math.max(value, 0), 100);
  const passing = direction === "atMost" ? value <= target : value >= target;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className={passing ? "text-sm font-semibold text-green-600" : "text-sm font-semibold text-amber-600"}>
          {formatPct(value)}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={passing ? "h-full bg-green-500" : "h-full bg-amber-500"}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-foreground/50">
        {direction === "atMost" ? "Max" : "Target"} {formatPct(target)}
      </p>
    </div>
  );
}

function SplitPanel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: MapReadinessSplit[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-foreground/60">{empty}</p>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground">{row.label.replace(/_/g, " ")}</span>
                <span className="shrink-0 font-semibold text-foreground">
                  {formatNumber(row.count)} · {formatPct(row.percentOfVisible)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.min(row.percentOfVisible, 100)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function AdminMapReadinessPage() {
  const snapshot = await getMapReadinessSnapshot();
  const reviewFailedCount = snapshot.summary.reviewCount + snapshot.summary.failedCount;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-primary hover:text-primary-light">
            Back to admin
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Map Readiness</h1>
          <p className="mt-2 max-w-3xl text-sm text-foreground/60">
            Aggregate launch gate for public boat maps. No coordinates, listing IDs, user IDs, or slugs are exposed here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill ready={snapshot.launchReady} />
          <a
            href="/admin/map-readiness"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:border-primary hover:text-primary"
          >
            Refresh
          </a>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Public map is {snapshot.publicMapEnabled ? "enabled" : "gated"} · Geocoder is{" "}
              {snapshot.geocoding.enabled ? snapshot.geocoding.provider : "not configured"}
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              Generated {new Date(snapshot.generatedAt).toLocaleString()}
            </p>
          </div>
          <p className="text-sm text-foreground/60">
            {snapshot.launchReady ? "All configured launch gates are passing." : snapshot.blockers.join(", ")}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Visible boats" value={formatNumber(snapshot.summary.activeVisibleCount)} />
        <MetricCard label="Public pins" value={formatNumber(snapshot.summary.publicPinCount)} />
        <MetricCard
          label="Review or failed"
          value={formatNumber(reviewFailedCount)}
          warn={reviewFailedCount > 0}
        />
        <MetricCard
          label="Invalid public rows"
          value={formatNumber(snapshot.summary.invalidPublicCoordinateCount)}
          warn={snapshot.summary.invalidPublicCoordinateCount > 0}
        />
        <MetricCard
          label="Missing metadata"
          value={formatNumber(snapshot.summary.publicMissingMetadataCount)}
          warn={snapshot.summary.publicMissingMetadataCount > 0}
        />
        <MetricCard
          label="Stale public pins"
          value={formatNumber(snapshot.summary.stalePublicCoordinateCount)}
          detail={`${formatPct(snapshot.rates.stalePublicPinPct)} of public pins`}
          warn={snapshot.summary.stalePublicCoordinateCount > 0}
        />
        <MetricCard
          label="Low score pins"
          value={formatNumber(snapshot.summary.lowScorePublicPinCount)}
          detail={`${formatPct(snapshot.rates.lowScorePublicPinPct)} of public pins`}
          warn={snapshot.summary.lowScorePublicPinCount > 0}
        />
        <MetricCard
          label="Approx pins"
          value={formatNumber(snapshot.summary.approximatePublicPinCount)}
          detail="Useful for context, weaker for launch confidence."
          warn={snapshot.summary.approximatePublicPinCount > 0}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ProgressCard
          label="Market tagged"
          value={snapshot.rates.marketTaggedPct}
          target={snapshot.thresholds.minMarketTaggedPct}
        />
        <ProgressCard
          label="City or better"
          value={snapshot.rates.cityOrBetterPct}
          target={snapshot.thresholds.minCityOrBetterPct}
        />
        <ProgressCard
          label="Public pin coverage"
          value={snapshot.rates.publicPinPct}
          target={snapshot.thresholds.minPublicPinPct}
        />
        <ProgressCard
          label="Non-approx pins"
          value={snapshot.rates.nonApproxPublicPinPct}
          target={snapshot.thresholds.minNonApproxPublicPinPct}
        />
        <ProgressCard
          label="Review/failed"
          value={snapshot.rates.reviewFailedPct}
          target={snapshot.thresholds.maxReviewFailedPct}
          direction="atMost"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SplitPanel
          title="Precision Split"
          rows={snapshot.splits.precision}
          empty="No geocode precision history yet."
        />
        <SplitPanel
          title="Status Split"
          rows={snapshot.splits.status}
          empty="No geocode status history yet."
        />
        <SplitPanel
          title="Provider Split"
          rows={snapshot.splits.provider}
          empty="No provider history yet."
        />
      </div>
    </main>
  );
}
