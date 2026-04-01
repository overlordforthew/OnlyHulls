"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContactGateModal from "./ContactGateModal";

export function MatchCTAPrimary({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push("/onboarding/profile")} className={`cursor-pointer ${className}`}>
      Get Matched — It&apos;s Free
    </button>
  );
}

export function MatchCTASecondary({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push("/onboarding/profile")} className={`cursor-pointer ${className}`}>
      Get Matched — Free
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
  const [gateOpen, setGateOpen] = useState(false);

  // Scraped listing with soft gate
  if (sourceUrl && boatId) {
    return (
      <>
        <button onClick={() => setGateOpen(true)} className={`cursor-pointer ${className}`}>
          Contact Owner
        </button>
        <ContactGateModal
          isOpen={gateOpen}
          onClose={() => setGateOpen(false)}
          boatId={boatId}
          sourceUrl={sourceUrl}
          sourceName={sourceName ?? null}
          boatTitle={boatTitle ?? "this boat"}
          boatSlug={boatSlug}
        />
      </>
    );
  }

  // Scraped listing without gate (legacy fallback)
  if (sourceUrl) {
    return (
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={className}>
        Contact Owner
      </a>
    );
  }

  // Native listing
  return (
    <button onClick={() => router.push("/onboarding/profile")} className={`cursor-pointer ${className}`}>
      Contact Owner
    </button>
  );
}

export function ListBoatCTA({ className = "", children = "List Your Boat — Free" }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push("/listings/new")} className={`cursor-pointer ${className}`}>
      {children}
    </button>
  );
}
