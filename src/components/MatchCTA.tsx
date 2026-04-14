"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ContactGateModal from "./ContactGateModal";
import { getSafeExternalUrl } from "@/lib/url-safety";

const BUYER_MATCH_FLOW_CALLBACK = "/matches";
const BUYER_ONBOARDING_DESTINATION = `/onboarding/profile?callbackUrl=${encodeURIComponent(
  BUYER_MATCH_FLOW_CALLBACK
)}`;

export function MatchCTAPrimary({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { data: session } = useSession();

  function handleClick() {
    if (session?.user) {
      router.push(BUYER_ONBOARDING_DESTINATION);
      return;
    }

    router.push(`/sign-in?callbackUrl=${encodeURIComponent(BUYER_ONBOARDING_DESTINATION)}`);
  }

  return (
    <button
      onClick={handleClick}
      className={`cursor-pointer ${className}`}
    >
      Get Matched - It&apos;s Free
    </button>
  );
}

export function MatchCTASecondary({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { data: session } = useSession();

  function handleClick() {
    if (session?.user) {
      router.push(BUYER_ONBOARDING_DESTINATION);
      return;
    }

    router.push(`/sign-in?callbackUrl=${encodeURIComponent(BUYER_ONBOARDING_DESTINATION)}`);
  }

  return (
    <button
      onClick={handleClick}
      className={`cursor-pointer ${className}`}
    >
      Get Matched - Free
    </button>
  );
}

export function ContactOwnerCTA({
  className = "",
  sourceUrl,
  boatId,
  boatTitle,
  sourceName,
  boatSlug,
}: {
  className?: string;
  sourceUrl?: string | null;
  boatId?: string;
  boatTitle?: string;
  sourceName?: string | null;
  boatSlug?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const safeSourceUrl = getSafeExternalUrl(sourceUrl);
  const [gateOpen, setGateOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyRequested, setAlreadyRequested] = useState(false);
  const [sellerContact, setSellerContact] = useState<{
    email: string;
    name: string | null;
  } | null>(null);

  const connectIntent = searchParams.get("connect") === "true";
  const matchId = searchParams.get("matchId");

  async function handleNativeConnect() {
    if (!boatId) return;

    const callbackUrl = boatSlug
      ? `/boats/${boatSlug}?connect=true${matchId ? `&matchId=${matchId}` : ""}`
      : "/boats";

    if (!session?.user) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchId ? { matchId } : { boatId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setAlreadyRequested(Boolean(data.alreadyRequested));
        setSellerContact(data.sellerContact ?? null);
        return;
      }

      if (data.requiresProfile || res.status === 409) {
        router.push(
          `/onboarding/profile?callbackUrl=${encodeURIComponent(
            `${boatSlug ? `/boats/${boatSlug}` : "/boats"}?connect=true${matchId ? `&matchId=${matchId}` : ""}`
          )}`
        );
        return;
      }

      setError(data.error || "Failed to contact the seller. Please try again.");
    } catch {
      setError("Failed to contact the seller. Please try again.");
    } finally {
      setConnecting(false);
    }
  }

  if (safeSourceUrl && boatId) {
    return (
      <>
        <button
          onClick={() => setGateOpen(true)}
          className={`cursor-pointer ${className}`}
        >
          Contact Owner
        </button>
        <ContactGateModal
          isOpen={gateOpen}
          onClose={() => setGateOpen(false)}
          boatId={boatId}
          sourceUrl={safeSourceUrl}
          sourceName={sourceName ?? null}
          boatTitle={boatTitle ?? "this boat"}
          boatSlug={boatSlug}
        />
      </>
    );
  }

  if (safeSourceUrl) {
    return (
      <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer" className={className}>
        Contact Owner
      </a>
    );
  }

  if (sellerContact) {
    return (
      <div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left">
          <p className="text-sm font-semibold text-primary">
            {alreadyRequested ? "Request already sent" : "Seller contact unlocked"}
          </p>
          <p className="mt-1 text-sm text-foreground/75">
            Reach out to {sellerContact.name || "the seller"} at{" "}
            <a
              href={`mailto:${sellerContact.email}`}
              className="font-medium text-primary underline"
            >
              {sellerContact.email}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleNativeConnect}
        disabled={connecting}
        className={`cursor-pointer disabled:opacity-60 ${className}`}
      >
        {connecting
          ? "Sending Intro..."
          : connectIntent
            ? "Send Intro Request"
            : "Contact Owner"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function ListBoatCTA({
  className = "",
  children = "List Your Boat - Free",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  function handleClick() {
    if (session?.user) {
      router.push("/onboarding?role=seller");
      return;
    }

    router.push("/sign-up?role=seller");
  }

  return (
    <button onClick={handleClick} className={`cursor-pointer ${className}`}>
      {children}
    </button>
  );
}
