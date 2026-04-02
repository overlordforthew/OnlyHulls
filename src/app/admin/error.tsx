"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <h1 className="text-3xl font-bold">Admin Error</h1>
      <p className="mt-3 max-w-md text-text-secondary">
        Something went wrong loading the admin panel.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-text-tertiary">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-8">
        <button
          onClick={reset}
          className="rounded-full bg-primary-btn px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
