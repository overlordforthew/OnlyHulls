import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl">⛵</span>
      <h1 className="mt-6 text-4xl font-bold">Lost at Sea</h1>
      <p className="mt-3 text-lg text-text-secondary">
        This page doesn&apos;t exist — or the listing has been removed.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/boats"
          className="rounded-full bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          Browse Boats
        </Link>
        <Link
          href="/"
          className="rounded-full border border-border px-6 py-3 font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
