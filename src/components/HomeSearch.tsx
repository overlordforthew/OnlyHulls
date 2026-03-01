"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomeSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/boats?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/boats");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by make, model, or keyword..."
        className="flex-1 rounded-full border border-border bg-background px-5 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary-dark"
      >
        Search
      </button>
    </form>
  );
}
