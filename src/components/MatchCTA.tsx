"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function MatchCTAPrimary({ className = "" }: { className?: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (status === "authenticated" && session?.user) {
      router.push("/onboarding/profile");
    } else {
      router.push("/sign-up?role=buyer");
    }
  }

  return (
    <button onClick={handleClick} className={className}>
      Get Matched — It&apos;s Free
    </button>
  );
}

export function MatchCTASecondary({ className = "" }: { className?: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (status === "authenticated" && session?.user) {
      router.push("/onboarding/profile");
    } else {
      router.push("/sign-up?role=buyer");
    }
  }

  return (
    <button onClick={handleClick} className={className}>
      Get Matched — Free
    </button>
  );
}

export function ContactOwnerCTA({ className = "" }: { className?: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (status === "authenticated" && session?.user) {
      router.push("/onboarding/profile");
    } else {
      router.push("/sign-up?role=buyer");
    }
  }

  return (
    <button onClick={handleClick} className={className}>
      Contact Owner
    </button>
  );
}
