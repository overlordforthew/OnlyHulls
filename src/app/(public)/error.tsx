"use client";

import { useEffect } from "react";
import Link from "@/components/LocaleLink";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-text-secondary">
        We had trouble loading this page. Please try again.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-text-tertiary">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-4">
        <button
          onClick={reset}
          className="rounded-full bg-primary-btn px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-secondary transition-all hover:text-foreground"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
