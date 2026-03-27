"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Waves, Menu, X } from "lucide-react";

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "glass-nav border-b border-border shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Waves className="h-6 w-6 text-primary transition-transform group-hover:scale-110" strokeWidth={2.5} />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-foreground">Only</span>
              <span className="text-primary">Hulls</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="/boats"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Browse
            </Link>
            <Link
              href="/match"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Match
            </Link>
            <Link
              href="/sell"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Sell
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition-colors hover:text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="flex h-full flex-col items-center justify-center gap-8">
            <Link
              href="/boats"
              className="text-2xl font-bold text-foreground transition-colors hover:text-primary"
              onClick={() => setMenuOpen(false)}
            >
              Browse Boats
            </Link>
            <Link
              href="/match"
              className="text-2xl font-bold text-foreground transition-colors hover:text-primary"
              onClick={() => setMenuOpen(false)}
            >
              AI Match
            </Link>
            <Link
              href="/sell"
              className="text-2xl font-bold text-foreground transition-colors hover:text-primary"
              onClick={() => setMenuOpen(false)}
            >
              Sell Your Boat
            </Link>
            <div className="mt-4 flex flex-col items-center gap-4">
              <Link
                href="/sign-in"
                className="text-lg text-text-secondary transition-colors hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-accent px-8 py-3 text-lg font-semibold text-white transition-all hover:bg-accent-light"
                onClick={() => setMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}

      {/* Spacer to prevent content from hiding behind fixed nav */}
      <div className="h-[72px]" />
    </>
  );
}
