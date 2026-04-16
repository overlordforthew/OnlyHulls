"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

type BoatLeadActionsProps = {
  boatId: string;
  boatSlug: string;
  boatMake: string;
  locationText: string | null;
  browseSimilarUrl: string;
  similarBoatCount: number;
  canClaimImportedListing: boolean;
};

export default function BoatLeadActions({
  boatId,
  boatSlug,
  boatMake,
  locationText,
  browseSimilarUrl,
  similarBoatCount,
  canClaimImportedListing,
}: BoatLeadActionsProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  async function saveSimilarSearch() {
    setMessage(null);

    if (!session?.user) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(`/boats/${boatSlug}`)}`);
      return;
    }

    setSaveLoading(true);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: boatMake,
          location: locationText || null,
          sort: "newest",
          dir: "desc",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save alert");
      }

      setMessage(
        data.duplicate
          ? "That alert already exists in your saved searches."
          : "Saved. We will watch this market for similar boats."
      );
      window.dispatchEvent(new CustomEvent("saved-searches:updated"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save alert");
    } finally {
      setSaveLoading(false);
    }
  }

  async function claimImportedListing() {
    setMessage(null);

    if (!session?.user) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(`/boats/${boatSlug}`)}`);
      return;
    }

    setClaimLoading(true);
    try {
      const res = await fetch(`/api/boats/${boatId}/claim`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to claim listing");
      }

      router.push(data.redirectTo || `/listings/${data.draftBoatId}?claimed=1&step=review`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to claim listing");
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-sm font-semibold text-foreground">Keep the conversation moving</p>
      <p className="mt-2 text-sm text-text-secondary">
        If you are not ready to message right now, keep this market on watch and stay in the loop on similar inventory.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void saveSimilarSearch()}
          disabled={saveLoading || claimLoading}
          className="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/10 disabled:opacity-50"
        >
          {saveLoading ? "Saving alert..." : "Save similar boats alert"}
        </button>
        {similarBoatCount > 0 ? (
          <a
            href="#similar-boats"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
          >
            Compare {similarBoatCount} similar boat{similarBoatCount === 1 ? "" : "s"}
          </a>
        ) : (
          <Link
            href={browseSimilarUrl}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
          >
            Browse more {boatMake}
          </Link>
        )}
        {canClaimImportedListing && (
          <button
            type="button"
            onClick={() => void claimImportedListing()}
            disabled={claimLoading || saveLoading}
            className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-all hover:bg-accent/15 disabled:opacity-50"
          >
            {claimLoading ? "Claiming draft..." : "Claim this listing"}
          </button>
        )}
      </div>

      {message && <p className="mt-3 text-sm text-primary">{message}</p>}
    </div>
  );
}
