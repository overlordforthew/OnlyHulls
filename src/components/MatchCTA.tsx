"use client";

import { useRouter } from "next/navigation";

function useMatchNav() {
  const router = useRouter();
  return () => router.push("/onboarding/profile");
}

export function MatchCTAPrimary({ className = "" }: { className?: string }) {
  const go = useMatchNav();
  return (
    <button onClick={go} className={className}>
      Get Matched — It&apos;s Free
    </button>
  );
}

export function MatchCTASecondary({ className = "" }: { className?: string }) {
  const go = useMatchNav();
  return (
    <button onClick={go} className={className}>
      Get Matched — Free
    </button>
  );
}

export function ContactOwnerCTA({ className = "" }: { className?: string }) {
  const go = useMatchNav();
  return (
    <button onClick={go} className={className}>
      Contact Owner
    </button>
  );
}
