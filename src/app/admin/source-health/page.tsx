import Link from "next/link";
import { query } from "@/lib/db";
import {
  buildBaseVisibleImportQualitySql,
  buildBaseVisibleImportQualitySqlWithoutSourceFreshness,
  buildVisibleImportQualitySql,
} from "@/lib/import-quality";
import {
  buildSourceHealthPolicySignals,
  deriveImportVisibilityCounts,
  type SourceHealthPolicySignal,
} from "@/lib/source-health";
import { getSourceDecisionByName } from "@/lib/source-policy";

const SIGNAL_MESSAGES: Record<SourceHealthPolicySignal, string> = {
  source_policy_undecided:
    "No source-policy decision on record yet — imports flow but daily-scrape will skip this source.",
  source_freshness_suppresses_visible_inventory:
    "Stale rows are being suppressed by source-freshness filtering.",
  hold_has_public_visible_inventory:
    "Hold decision but buyer-visible inventory is still showing — investigate.",
  hold_suppresses_pre_policy_visible_inventory:
    "Hold decision is suppressing rows that otherwise qualify as visible.",
};

export const dynamic = "force-dynamic";

type SourceRow = {
  source: string;
  active_count: string;
  quality_visible_before_freshness_count: string;
  quality_visible_count: string;
  visible_count: string;
  contact_clicks_30d: string;
};

async function getSourceSnapshot() {
  return await query<SourceRow>(
    `SELECT
       COALESCE(b.source_name, 'Platform') AS source,
       COUNT(*)::text AS active_count,
       COUNT(*) FILTER (WHERE ${buildBaseVisibleImportQualitySqlWithoutSourceFreshness("b")})::text AS quality_visible_before_freshness_count,
       COUNT(*) FILTER (WHERE ${buildBaseVisibleImportQualitySql("b")})::text AS quality_visible_count,
       COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::text AS visible_count,
       COALESCE(SUM(COALESCE(clicks.click_count_30d, 0)), 0)::text AS contact_clicks_30d
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN (
       SELECT boat_id, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS click_count_30d
       FROM contact_clicks
       GROUP BY boat_id
     ) clicks ON clicks.boat_id = b.id
     WHERE b.listing_source = 'imported'
       AND b.status = 'active'
     GROUP BY COALESCE(b.source_name, 'Platform')
     ORDER BY COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")}) DESC,
              COUNT(*) DESC`,
    []
  );
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    keep: "border-green-500/40 bg-green-500/10 text-green-600",
    test: "border-blue-500/40 bg-blue-500/10 text-blue-600",
    hold: "border-amber-500/40 bg-amber-500/10 text-amber-600",
    undecided: "border-slate-500/40 bg-slate-500/10 text-slate-500",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${palette[status] ?? palette.undecided}`}
    >
      {status}
    </span>
  );
}

export default async function SourceHealthPage() {
  const rows = await getSourceSnapshot();
  const snapshot = rows.map((row) => {
    const active = Number.parseInt(row.active_count, 10);
    const qVisBeforeFreshness = Number.parseInt(row.quality_visible_before_freshness_count, 10);
    const qVisBeforePolicy = Number.parseInt(row.quality_visible_count, 10);
    const visible = Number.parseInt(row.visible_count, 10);
    const clicks = Number.parseInt(row.contact_clicks_30d, 10);
    const decision = getSourceDecisionByName(row.source);
    const visibilityCounts = deriveImportVisibilityCounts({
      active,
      qualityVisibleBeforeFreshness: qVisBeforeFreshness,
      qualityVisibleBeforePolicy: qVisBeforePolicy,
      visible,
    });
    const signals = buildSourceHealthPolicySignals({
      source: row.source,
      active,
      qualityVisibleBeforeFreshness: qVisBeforeFreshness,
      qualityVisibleBeforePolicy: qVisBeforePolicy,
      visible,
    });
    return {
      source: row.source,
      active,
      visible,
      clicks,
      visiblePct: active === 0 ? 0 : (visible / active) * 100,
      status: decision?.status ?? "undecided",
      reason: decision?.reason ?? "",
      signals,
      visibilityCounts,
    };
  });

  const totals = snapshot.reduce(
    (acc, s) => {
      acc.active += s.active;
      acc.visible += s.visible;
      acc.clicks += s.clicks;
      return acc;
    },
    { active: 0, visible: 0, clicks: 0 }
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-foreground/60 hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Source health snapshot</h1>
          <p className="text-sm text-foreground/60">
            Per-source visibility, 30-day engagement, and current source-policy decision.
          </p>
        </div>
        <div className="text-right text-sm text-foreground/60">
          <p>{totals.active.toLocaleString()} active imported rows</p>
          <p>{totals.visible.toLocaleString()} visible to buyers</p>
          <p>{totals.clicks.toLocaleString()} contact clicks (30d)</p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-foreground/60">
            <tr>
              <th scope="col" className="px-4 py-3">Source</th>
              <th scope="col" className="px-4 py-3">Policy</th>
              <th scope="col" className="px-4 py-3 text-right">Active</th>
              <th scope="col" className="px-4 py-3 text-right">Visible</th>
              <th scope="col" className="px-4 py-3 text-right">Visible %</th>
              <th scope="col" className="px-4 py-3 text-right">Clicks (30d)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {snapshot.map((s) => (
              <tr key={s.source}>
                <td className="px-4 py-3 font-medium">{s.source}</td>
                <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                <td className="px-4 py-3 text-right tabular-nums">{s.active.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.visible.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {s.active > 0 ? `${s.visiblePct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{s.clicks.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Policy detail</h2>
        <div className="space-y-2 text-sm">
          {snapshot
            .filter((s) => s.reason)
            .map((s) => (
              <details key={s.source} className="rounded border border-border bg-surface p-3">
                <summary className="cursor-pointer font-medium">
                  {s.source} <StatusPill status={s.status} />
                </summary>
                <p className="mt-2 text-foreground/70">{s.reason}</p>
                {s.signals.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-foreground/60">
                    {s.signals.map((signal) => (
                      <li key={signal}>{SIGNAL_MESSAGES[signal]}</li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 text-xs text-foreground/60">
        <p>
          boats.com scraper last-run metrics live on Hetzner at{" "}
          <code>/var/log/onlyhulls/boats-com-scrape.log</code> and{" "}
          <code>/tmp/boats_com_run_from_elmo.json</code>. Cloudflare events write{" "}
          <code>/tmp/boats_com_cloudflare_from_elmo.flag</code> and fire a WhatsApp alert via
          Overlord&apos;s notification-hub.
        </p>
      </section>
    </div>
  );
}
