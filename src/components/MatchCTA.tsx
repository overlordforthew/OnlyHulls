"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import ContactGateModal from "./ContactGateModal";
import { getSafeExternalUrl } from "@/lib/url-safety";

const BUYER_MATCH_FLOW_CALLBACK = "/matches";
const BUYER_ONBOARDING_DESTINATION = `/onboarding/profile?callbackUrl=${encodeURIComponent(
  BUYER_MATCH_FLOW_CALLBACK
)}`;

export function MatchCTAPrimary({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations("matchCta");

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
      {t("primary")}
    </button>
  );
}

export function MatchCTASecondary({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations("matchCta");

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
      {t("secondary")}
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
  const t = useTranslations("matchCta");
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

      setError(data.error || t("contactFailed"));
    } catch {
      setError(t("contactFailed"));
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
          {t("contactOwner")}
        </button>
        <ContactGateModal
          isOpen={gateOpen}
          onClose={() => setGateOpen(false)}
          boatId={boatId}
          sourceUrl={safeSourceUrl}
          sourceName={sourceName ?? null}
          boatTitle={boatTitle ?? t("thisBoat")}
          boatSlug={boatSlug}
        />
      </>
    );
  }

  if (safeSourceUrl) {
    return (
      <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {t("contactOwner")}
      </a>
    );
  }

  if (sellerContact) {
    return (
      <div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left">
          <p className="text-sm font-semibold text-primary">
            {alreadyRequested ? t("requestAlreadySent") : t("sellerContactUnlocked")}
          </p>
          <p className="mt-1 text-sm text-foreground/75">
            {t("reachOutTo", { name: sellerContact.name || t("theSeller") })}{" "}
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
          ? t("sendingIntro")
          : connectIntent
            ? t("sendIntroRequest")
            : t("contactOwner")}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function ListBoatCTA({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations("matchCta");

  function handleClick() {
    if (session?.user) {
      router.push("/onboarding?role=seller");
      return;
    }

    router.push("/sign-up?role=seller");
  }

  return (
    <button onClick={handleClick} className={`cursor-pointer ${className}`}>
      {children ?? t("listBoatFree")}
    </button>
  );
}
