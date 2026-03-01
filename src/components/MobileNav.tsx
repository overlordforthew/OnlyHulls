"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-foreground/70 hover:text-foreground"
        aria-label="Toggle menu"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      {open && (
        <nav className="absolute left-0 right-0 top-full border-b border-border bg-background px-4 pb-4 pt-2">
          <div className="flex flex-col gap-3">
            <Link href="/boats" className="text-sm text-foreground/70 hover:text-foreground" onClick={() => setOpen(false)}>
              Browse Boats
            </Link>
            <Link href="/sell" className="text-sm text-foreground/70 hover:text-foreground" onClick={() => setOpen(false)}>
              Sell
            </Link>
            <Link href="/sign-in" className="text-sm text-foreground/70 hover:text-foreground" onClick={() => setOpen(false)}>
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-dark"
              onClick={() => setOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
