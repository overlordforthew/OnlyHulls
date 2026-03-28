"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export function MatchCTAPrimary({ className = "" }: { className?: string }) {
  const { data: session } = useSession();
  const href = session?.user ? "/onboarding/profile" : "/sign-up?role=buyer";

  return (
    <Link href={href} className={className}>
      Get Matched — It&apos;s Free
    </Link>
  );
}

export function MatchCTASecondary({ className = "" }: { className?: string }) {
  const { data: session } = useSession();
  const href = session?.user ? "/onboarding/profile" : "/sign-up?role=buyer";

  return (
    <Link href={href} className={className}>
      Get Matched — Free
    </Link>
  );
}

export function ContactOwnerCTA({ className = "" }: { className?: string }) {
  const { data: session } = useSession();
  const href = session?.user ? "/onboarding/profile" : "/sign-up?role=buyer";

  return (
    <Link href={href} className={className}>
      Contact Owner
    </Link>
  );
}
