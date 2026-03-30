"use client";

import { useRouter } from "next/navigation";

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

export function ContactOwnerCTA({ className = "" }: { className?: string }) {
  const router = useRouter();
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
