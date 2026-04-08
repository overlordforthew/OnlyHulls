"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getExternalVideoMeta, type ListingMediaType } from "@/lib/media";

type Step = "basics" | "specs" | "details" | "location" | "photos" | "review";

const STEPS: Step[] = ["basics", "specs", "details", "location", "photos", "review"];
const STEP_LABELS: Record<Step, string> = {
  basics: "Basics",
  specs: "Specifications",
  details: "Details",
  location: "Location & Price",
  photos: "Media",
  review: "Review",
};

interface ListingMedia {
  id?: string;
  type: ListingMediaType;
  url: string;
  thumbnailUrl?: string | null;
  caption: string;
  sortOrder: number;
}

interface ListingData {
  make: string;
  model: string;
  year: number;
  askingPrice: number;
  currency: string;
  locationText: string;
  locationLat?: number;
  locationLng?: number;
  hullId: string;
  specs: {
    loa?: number;
    beam?: number;
    draft?: number;
    rig_type?: string;
    hull_material?: string;
    engine?: string;
    fuel_type?: string;
    berths?: number;
    heads?: number;
  };
  characterTags: string[];
  conditionScore: number;
  description: string;
  media: ListingMedia[];
}

interface ListingResponse extends ListingData {
  id: string;
  slug: string | null;
  status: string;
  canResubmit: boolean;
  storageEnabled: boolean;
}

interface CapabilityResponse {
  storageEnabled?: boolean;
  mediaBackend?: string;
}

const DEFAULT_DATA: ListingData = {
  make: "",
  model: "",
  year: new Date().getFullYear(),
  askingPrice: 0,
  currency: "USD",
  locationText: "",
  hullId: "",
  specs: {},
  characterTags: [],
  conditionScore: 5,
  description: "",
  media: [],
};

export default function ListingEditor({ listingId }: { listingId?: string }) {
  const editMode = Boolean(listingId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("basics");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(editMode);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(editMode ? "pending_review" : "draft");
  const [slug, setSlug] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [mediaBackend, setMediaBackend] = useState("none");
  const [canResubmit, setCanResubmit] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [data, setData] = useState<ListingData>(DEFAULT_DATA);
  const reviewChecklist = buildReviewChecklist(data);
  const readinessScore = getReadinessScore(reviewChecklist);
  const photoCount = data.media.filter((item) => item.type === "image").length;
  const videoCount = data.media.filter((item) => item.type === "video").length;

  const currentIdx = STEPS.indexOf(step);
  const canNext = currentIdx < STEPS.length - 1;
  const canBack = currentIdx > 0;

  useEffect(() => {
    const created = searchParams.get("created");
    const saved = searchParams.get("saved");
    const resubmitted = searchParams.get("resubmitted");

    if (created === "1") {
      setMessage("Draft created. Add the missing details, photos, and then submit it for review.");
    } else if (resubmitted === "1") {
      setMessage("Listing updated and resubmitted for review.");
    } else if (saved === "1") {
      setMessage("Listing changes saved.");
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/public/capabilities")
      .then((res) => res.json())
      .then((capabilities: CapabilityResponse) => {
        setStorageReady(Boolean(capabilities.storageEnabled));
        setMediaBackend(String(capabilities.mediaBackend || "none"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!listingId) return;

    let active = true;

    async function loadListing() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/listings/${listingId}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || "Failed to load listing");
        }
        if (!active) return;

        const listing = payload as ListingResponse;
        setData({
          make: listing.make,
          model: listing.model,
          year: listing.year,
          askingPrice: Number(listing.askingPrice),
          currency: listing.currency,
          locationText: listing.locationText || "",
          locationLat: listing.locationLat,
          locationLng: listing.locationLng,
          hullId: listing.hullId || "",
          specs: listing.specs || {},
          characterTags: listing.characterTags || [],
          conditionScore: listing.conditionScore || 5,
          description: listing.description || "",
          media: (listing.media || []).map((item, index) => ({
            id: item.id,
            type: item.type || "image",
            url: item.url,
            thumbnailUrl: item.thumbnailUrl || null,
            caption: item.caption || "",
            sortOrder: item.sortOrder ?? index,
          })),
        });
        setStatus(listing.status);
        setSlug(listing.slug);
        setCanResubmit(Boolean(listing.canResubmit));
        setStorageReady(Boolean(listing.storageEnabled));
        setMediaBackend(String((listing as ListingResponse & { mediaBackend?: string }).mediaBackend || "none"));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadListing();

    return () => {
      active = false;
    };
  }, [listingId]);

  function update(partial: Partial<ListingData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function updateSpecs(partial: Partial<ListingData["specs"]>) {
    setData((prev) => ({ ...prev, specs: { ...prev.specs, ...partial } }));
  }

  function updateMedia(index: number, partial: Partial<ListingMedia>) {
    setData((prev) => ({
      ...prev,
      media: prev.media.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...partial } : item
      ),
    }));
  }

  function removeMedia(index: number) {
    setData((prev) => ({
      ...prev,
      media: prev.media
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })),
    }));
  }

  async function handleSubmit(submitForReview = false) {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const payload = {
      ...data,
      media: data.media.map((item, index) => ({
        type: item.type,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        caption: item.caption,
        sortOrder: index,
      })),
    };

    try {
      if (!editMode) {
        const res = await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(result.error || "Failed to create listing");
        }

        router.push(`/listings/${result.id}?created=1`);
        return;
      }

      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submitForReview }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || "Failed to save listing");
      }

      setStatus(result.status || status);
      setSlug(result.slug || slug);
      setCanResubmit(Boolean(result.status === "rejected" || result.status === "draft"));
      setMessage(
        submitForReview
          ? "Listing updated and resubmitted for review."
          : "Listing changes saved."
      );
      router.replace(
        `/listings/${listingId}?${submitForReview ? "resubmitted=1" : "saved=1"}`,
        { scroll: false }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save listing");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    if (!listingId) return;

    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const uploaded: ListingMedia[] = [];

      for (const file of files) {
        if (mediaBackend === "local") {
          const form = new FormData();
          form.set("boatId", listingId);
          form.set("file", file);

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: form,
          });
          const uploadPayload = await uploadRes.json().catch(() => ({}));
          if (!uploadRes.ok) {
            throw new Error(uploadPayload.error || `Failed to upload ${file.name}`);
          }

          uploaded.push({
            type: "image",
            url: uploadPayload.publicUrl,
            thumbnailUrl: null,
            caption: "",
            sortOrder: 0,
          });
          continue;
        }

        const presignRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boatId: listingId,
            filename: file.name,
            contentType: file.type,
          }),
        });

        const presignPayload = await presignRes.json().catch(() => ({}));
        if (!presignRes.ok) {
          throw new Error(presignPayload.error || `Failed to prepare upload for ${file.name}`);
        }

        const uploadRes = await fetch(presignPayload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        uploaded.push({
          type: "image",
          url: presignPayload.publicUrl,
          thumbnailUrl: null,
          caption: "",
          sortOrder: 0,
        });
      }

      setData((prev) => ({
        ...prev,
        media: [...prev.media, ...uploaded].map((item, index) => ({
          ...item,
          sortOrder: index,
        })),
      }));
      setMessage(`Uploaded ${uploaded.length} photo${uploaded.length === 1 ? "" : "s"}.`);
      event.target.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media");
    } finally {
      setUploading(false);
    }
  }

  function addVideoLink() {
    const meta = getExternalVideoMeta(videoUrl);
    if (!meta) {
      setError("Video links must be YouTube or Vimeo URLs.");
      return;
    }

    setError(null);
    setMessage("External video added.");
    setData((prev) => ({
      ...prev,
      media: [
        ...prev.media,
        {
          type: "video",
          url: meta.canonicalUrl,
          thumbnailUrl: null,
          caption: "",
          sortOrder: prev.media.length,
        },
      ],
    }));
    setVideoUrl("");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/60">Loading listing editor...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {editMode ? "Manage Listing" : "List Your Boat"}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {editMode
              ? "Refine details, manage photos, add videos, and keep the listing ready for buyers."
              : "Create your draft, then polish it with photos, videos, and final details before review."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/listings"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
          >
            Back to Dashboard
          </Link>
          {editMode && (
            <Link
              href={slug ? `/boats/${slug}` : `/boats/${listingId}`}
              className="rounded-full bg-primary-btn px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
            >
              Preview Listing
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <StatusBadge status={status} />
        {storageReady ? (
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-green-300">
            Media uploads ready
          </span>
        ) : (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent">
            Media storage not configured
          </span>
        )}
        <span className="rounded-full border border-border bg-background px-3 py-1 text-text-secondary">
          Readiness {readinessScore}/100
        </span>
      </div>

      {message && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/85">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-1">
        {STEPS.map((item, index) => (
          <button
            key={item}
            onClick={() => index <= currentIdx && setStep(item)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium ${
              item === step
                ? "bg-primary-btn text-white"
                : index < currentIdx
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-foreground/40"
            }`}
          >
            {STEP_LABELS[item]}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        {step === "basics" && (
          <>
            <Field
              label="Make"
              value={data.make}
              onChange={(value) => update({ make: value })}
              placeholder="e.g. Beneteau"
            />
            <Field
              label="Model"
              value={data.model}
              onChange={(value) => update({ model: value })}
              placeholder="e.g. Oceanis 40.1"
            />
            <NumberField
              label="Year"
              value={data.year}
              onChange={(value) => update({ year: value })}
            />
            <Field
              label="Hull ID (HIN)"
              value={data.hullId}
              onChange={(value) => update({ hullId: value })}
              placeholder="Optional"
            />
          </>
        )}

        {step === "specs" && (
          <>
            <NumberField
              label="LOA (feet)"
              value={data.specs.loa}
              onChange={(value) => updateSpecs({ loa: value })}
            />
            <NumberField
              label="Beam (feet)"
              value={data.specs.beam}
              onChange={(value) => updateSpecs({ beam: value })}
            />
            <NumberField
              label="Draft (feet)"
              value={data.specs.draft}
              onChange={(value) => updateSpecs({ draft: value })}
            />
            <Select
              label="Rig Type"
              value={data.specs.rig_type || ""}
              onChange={(value) => updateSpecs({ rig_type: value })}
              options={["sloop", "cutter", "ketch", "yawl", "schooner", "cat"]}
            />
            <Select
              label="Hull Material"
              value={data.specs.hull_material || ""}
              onChange={(value) => updateSpecs({ hull_material: value })}
              options={["fiberglass", "steel", "aluminum", "wood", "carbon", "ferro-cement"]}
            />
            <Field
              label="Engine"
              value={data.specs.engine || ""}
              onChange={(value) => updateSpecs({ engine: value })}
              placeholder="e.g. Yanmar 40HP diesel"
            />
            <NumberField
              label="Berths"
              value={data.specs.berths}
              onChange={(value) => updateSpecs({ berths: value })}
            />
            <NumberField
              label="Heads"
              value={data.specs.heads}
              onChange={(value) => updateSpecs({ heads: value })}
            />
          </>
        )}

        {step === "details" && (
          <>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea
                value={data.description}
                onChange={(event) => update({ description: event.target.value })}
                rows={6}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Tell potential buyers about your boat..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Condition (1-10)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={data.conditionScore}
                onChange={(event) => update({ conditionScore: parseInt(event.target.value, 10) })}
                className="mt-1 w-full"
              />
              <p className="text-sm text-foreground/60">{data.conditionScore}/10</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Character Tags</label>
              <p className="text-xs text-foreground/50">Select all that apply</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "bluewater",
                  "coastal-cruiser",
                  "liveaboard-ready",
                  "race-ready",
                  "weekender",
                  "project-boat",
                  "turnkey",
                  "classic",
                  "modern",
                  "family-friendly",
                  "solo-sailor",
                  "budget-friendly",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const nextTags = data.characterTags.includes(tag)
                        ? data.characterTags.filter((value) => value !== tag)
                        : [...data.characterTags, tag];
                      update({ characterTags: nextTags });
                    }}
                    className={`rounded-full px-3 py-1 text-xs ${
                      data.characterTags.includes(tag)
                        ? "bg-primary-btn text-white"
                        : "bg-muted text-foreground/60"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === "location" && (
          <>
            <Field
              label="Location"
              value={data.locationText}
              onChange={(value) => update({ locationText: value })}
              placeholder="e.g. Honolulu, HI"
            />
            <NumberField
              label="Asking Price"
              value={data.askingPrice}
              onChange={(value) => update({ askingPrice: value })}
            />
            <Select
              label="Currency"
              value={data.currency}
              onChange={(value) => update({ currency: value })}
              options={["USD", "EUR", "GBP", "AUD", "NZD", "CAD"]}
            />
          </>
        )}

        {step === "photos" && (
          <div className="space-y-4">
            {!editMode ? (
              <div className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground/70">
                Create the listing first, then return here to upload photos and add video links.
                The editor will reopen automatically after the draft is created.
              </div>
            ) : storageReady ? (
              <div className="rounded-xl border border-border bg-surface p-4">
                <label className="block text-sm font-medium">Upload Photos</label>
                <p className="mt-1 text-xs text-foreground/50">
                  JPG, PNG, WebP, or GIF. Videos are link-only.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFileSelection}
                  disabled={uploading}
                  className="mt-4 block w-full text-sm text-foreground/70 file:mr-4 file:rounded-full file:border-0 file:bg-primary-btn file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                {uploading && (
                  <p className="mt-3 text-sm text-primary">Uploading photos...</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-accent/20 bg-accent/10 p-4 text-sm text-accent">
                Media uploads are not configured on this environment yet. Listing details
                can still be saved, and external video links still work.
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface p-4">
              <label className="block text-sm font-medium">Add Video Link</label>
              <p className="mt-1 text-xs text-foreground/50">
                YouTube and Vimeo only. Videos are embedded from the original provider and are not uploaded directly.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={addVideoLink}
                  type="button"
                  className="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/10"
                >
                  Add Video
                </button>
              </div>
            </div>

            {data.media.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-foreground/45">
                No media added yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.media.map((item, index) => (
                  <div key={item.id || `${item.url}-${index}`} className="rounded-xl border border-border bg-surface p-4">
                    <div className="overflow-hidden rounded-lg bg-background">
                      {item.type === "video" ? (
                        <div className="flex aspect-[4/3] items-center justify-center bg-surface-elevated px-4 text-center text-sm text-foreground/60">
                          External video link
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.url}
                          alt={item.caption || `${data.make} ${data.model} photo ${index + 1}`}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium">Caption</label>
                      <input
                        type="text"
                        value={item.caption}
                        onChange={(event) => updateMedia(index, { caption: event.target.value })}
                        placeholder="Optional caption"
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-foreground/50">
                      <span>{item.type === "video" ? `Video ${index + 1}` : `Photo ${index + 1}`}</span>
                      <button
                        onClick={() => removeMedia(index)}
                        className="rounded-full border border-border px-3 py-1 text-red-300 transition-all hover:border-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review Your Listing</h2>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p>
                <strong>
                  {data.year} {data.make} {data.model}
                </strong>
              </p>
              <p className="mt-1">
                ${data.askingPrice.toLocaleString()} {data.currency}
              </p>
              {data.locationText && <p className="mt-1">{data.locationText}</p>}
              {data.specs.loa && <p className="mt-1">LOA: {data.specs.loa}ft</p>}
              {data.specs.rig_type && <p>Rig: {data.specs.rig_type}</p>}
              {photoCount > 0 && <p>Photos: {photoCount}</p>}
              {videoCount > 0 && <p>Videos: {videoCount}</p>}
              {data.characterTags.length > 0 && (
                <p className="mt-1">Tags: {data.characterTags.join(", ")}</p>
              )}
              {data.description && (
                <p className="mt-2 text-foreground/60">{data.description}</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold">Approval Readiness</h3>
                <span className="text-sm font-medium text-text-secondary">
                  {readinessScore}/100
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    readinessScore >= 75
                      ? "bg-green-500"
                      : readinessScore >= 50
                        ? "bg-accent"
                        : "bg-red-400"
                  }`}
                  style={{ width: `${readinessScore}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {reviewChecklist.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg bg-background px-3 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.label}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.passed
                            ? "bg-green-500/10 text-green-300"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        {item.passed ? "Ready" : "Improve"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-foreground/60">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-foreground/70">
              {editMode ? (
                <>
                  <p>
                    Current status: <strong>{status.replace(/_/g, " ")}</strong>
                  </p>
                  {status === "rejected" && (
                    <p className="mt-2 text-accent">
                      Save your changes, then resubmit when the listing is ready for another review pass.
                    </p>
                  )}
                  {status === "pending_review" && (
                    <p className="mt-2">
                      This listing is already in review. Saving changes will keep it in the moderation queue.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Creating the listing saves it as a draft first. Use this workspace to finish the
                  details, then submit it for admin review when the readiness score is strong.
                </p>
              )}
              <p className="mt-3 text-xs text-foreground/50">
                Best results: 6+ photos, a clear description, location, and core specs.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <button
          onClick={() => canBack && setStep(STEPS[currentIdx - 1])}
          disabled={!canBack || submitting || uploading}
          className="rounded-full border border-border px-6 py-2 text-sm hover:bg-muted disabled:opacity-30"
        >
          Back
        </button>

        {step === "review" ? (
          <div className="flex flex-wrap gap-3">
            {editMode && canResubmit && (
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting || uploading || !data.make || !data.model}
                className="rounded-full border border-primary px-6 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/10 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save and Resubmit"}
              </button>
            )}
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || uploading || !data.make || !data.model}
              className="rounded-full bg-primary-btn px-8 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting
                ? editMode
                  ? "Saving..."
                  : "Submitting..."
                : editMode
                  ? "Save Changes"
                  : "Create Listing"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => canNext && setStep(STEPS[currentIdx + 1])}
            disabled={!canNext || uploading}
            className="rounded-full bg-primary-btn px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "border-green-500/30 bg-green-500/10 text-green-300",
    pending_review: "border-accent/30 bg-accent/10 text-accent",
    rejected: "border-red-500/30 bg-red-500/10 text-red-300",
    draft: "border-border bg-background text-foreground/60",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[status] || "border-border bg-background text-foreground/60"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="number"
        value={value || ""}
        onChange={(event) => onChange(parseFloat(event.target.value) || 0)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function buildReviewChecklist(data: ListingData) {
  const photoCount = data.media.filter((item) => item.type === "image").length;
  const specCount = [
    data.specs.loa,
    data.specs.beam,
    data.specs.draft,
    data.specs.rig_type,
    data.specs.hull_material,
    data.specs.engine,
    data.specs.berths,
    data.specs.heads,
  ].filter(Boolean).length;

  return [
    {
      label: "Core details",
      passed: Boolean(data.make && data.model && data.year && data.askingPrice),
      detail: "Make, model, year, and asking price should all be set.",
      weight: 20,
    },
    {
      label: "Location",
      passed: Boolean(data.locationText.trim()),
      detail: "Give buyers a real location so the listing feels credible and searchable.",
      weight: 10,
    },
    {
      label: "Description",
      passed: data.description.trim().length >= 120,
      detail: "A fuller description improves approval odds and buyer conversion.",
      weight: 20,
    },
    {
      label: "Photos",
      passed: photoCount >= 3,
      detail: `Add at least 3 photos. ${photoCount} currently attached.`,
      weight: 25,
    },
    {
      label: "Specs",
      passed: specCount >= 3,
      detail: `Add core specs like LOA, rig, hull, engine, berths, or heads. ${specCount} filled now.`,
      weight: 15,
    },
    {
      label: "Condition",
      passed: Number.isFinite(data.conditionScore) && data.conditionScore > 0,
      detail: "Condition helps buyers qualify the boat quickly.",
      weight: 10,
    },
  ];
}

function getReadinessScore(
  checklist: Array<{ passed: boolean; weight: number }>
) {
  return checklist.reduce((total, item) => total + (item.passed ? item.weight : 0), 0);
}
