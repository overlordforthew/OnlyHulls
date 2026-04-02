"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to browser console for debugging; in production this would go to an error service
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
          <h1 className="text-4xl font-bold">Something went wrong</h1>
          <p className="mt-3 max-w-md text-text-secondary">
            An unexpected error occurred. Please try again, or go back to the homepage.
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
            <a
              href="/"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-secondary transition-all hover:text-foreground"
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
