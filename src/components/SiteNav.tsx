"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Waves, Menu, X, User, LogOut, Bell, GitCompareArrows } from "lucide-react";
import { useCompareBoats } from "@/hooks/useCompareBoats";

export default function SiteNav() {
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchesWithUpdates, setSearchesWithUpdates] = useState(0);
  const { compareCount } = useCompareBoats();

  const isLoggedIn = status === "authenticated" && !!session?.user;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const close = () => setProfileOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [profileOpen]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const loadSummary = async () => {
      try {
        const res = await fetch("/api/saved-searches/summary");
        if (!res.ok) return;
        const data = await res.json();
        setSearchesWithUpdates(data.searchesWithUpdates || 0);
      } catch {
        // Ignore nav badge failures.
      }
    };

    const refresh = () => { void loadSummary(); };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("saved-searches:updated", refresh as EventListener);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("saved-searches:updated", refresh as EventListener);
    };
  }, [isLoggedIn]);

  const visibleSearchesWithUpdates = isLoggedIn ? searchesWithUpdates : 0;
  const compareReady = compareCount > 0;
  const compareCountLabel = `${compareCount} filled`;

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
            <Link href="/boats" className="text-sm font-medium text-text-secondary transition-colors hover:text-primary">
              Browse
            </Link>
            <Link href="/match" className="text-sm font-medium text-text-secondary transition-colors hover:text-primary">
              Match
            </Link>
            <Link href="/sell" className="text-sm font-medium text-text-secondary transition-colors hover:text-primary">
              Sell
            </Link>
            <Link
              href="/compare"
              data-testid="compare-nav-link"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                compareReady
                  ? "border-amber-400/60 bg-amber-300/10 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.18)] hover:border-amber-300 hover:text-amber-100"
                  : "border-transparent text-text-secondary hover:border-primary/30 hover:text-primary"
              }`}
              aria-label={
                compareReady
                  ? `Compare boats, ${compareCount} selected`
                  : "Compare boats"
              }
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare
              {compareReady && (
                <>
                  <span className="inline-flex h-6 min-w-6 animate-pulse items-center justify-center rounded-full border-2 border-amber-300 bg-amber-300/15 px-2 text-[11px] font-bold text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.28)]">
                    {compareCount}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">
                    {compareCountLabel}
                  </span>
                </>
              )}
            </Link>
          </nav>
 
          {/* Desktop Actions */}
          <div className="hidden items-center gap-4 md:flex">
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                  className="relative flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:border-primary"
                >
                  {visibleSearchesWithUpdates > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                      {visibleSearchesWithUpdates > 9 ? "9+" : visibleSearchesWithUpdates}
                    </span>
                  )}
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {session.user.name?.[0]?.toUpperCase() || <User className="h-3.5 w-3.5" />}
                  </div>
                  <span className="max-w-[100px] truncate">{session.user.name || "Account"}</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-surface p-2 shadow-xl">
                    <Link
                      href="/matches"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted hover:text-foreground"
                      onClick={() => setProfileOpen(false)}
                    >
                      My Matches
                    </Link>
                    <Link
                      href="/listings"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted hover:text-foreground"
                      onClick={() => setProfileOpen(false)}
                    >
                      My Listings
                    </Link>
                    <Link
                      href="/listings/new"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted hover:text-foreground"
                      onClick={() => setProfileOpen(false)}
                    >
                      List a Boat
                    </Link>
                    <Link
                      href="/compare"
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted hover:text-foreground"
                      onClick={() => setProfileOpen(false)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <GitCompareArrows className="h-3.5 w-3.5" />
                        Compare Boats
                      </span>
                      {compareCount > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {compareCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      href="/saved-searches"
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted hover:text-foreground"
                      onClick={() => setProfileOpen(false)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Bell className="h-3.5 w-3.5" />
                        Saved Searches
                      </span>
                      {visibleSearchesWithUpdates > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {visibleSearchesWithUpdates} new
                        </span>
                      )}
                    </Link>
                    <Link
                      href="/onboarding/profile"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted hover:text-foreground"
                      onClick={() => setProfileOpen(false)}
                    >
                      AI Profile
                    </Link>
                    <Link
                      href="/account"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted hover:text-foreground"
                      onClick={() => setProfileOpen(false)}
                    >
                      Account & Billing
                    </Link>
                    <div className="my-1 h-px bg-border" />
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-muted"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-full bg-accent-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
                >
                  Get Started
                </Link>
              </>
            )}
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
            <Link href="/boats" className="text-2xl font-bold text-foreground transition-colors hover:text-primary" onClick={() => setMenuOpen(false)}>
              Browse Boats
            </Link>
            <Link href="/match" className="text-2xl font-bold text-foreground transition-colors hover:text-primary" onClick={() => setMenuOpen(false)}>
              AI Match
            </Link>
            <Link href="/sell" className="text-2xl font-bold text-foreground transition-colors hover:text-primary" onClick={() => setMenuOpen(false)}>
              Sell Your Boat
            </Link>
            <Link href="/compare" className="text-2xl font-bold text-foreground transition-colors hover:text-primary" onClick={() => setMenuOpen(false)}>
              Compare Boats{compareCount > 0 ? ` (${compareCount})` : ""}
            </Link>
            <div className="mt-4 flex flex-col items-center gap-4">
              {isLoggedIn ? (
                <>
                  <Link href="/matches" className="text-lg text-primary transition-colors hover:text-primary-light" onClick={() => setMenuOpen(false)}>
                    My Matches
                  </Link>
                  <Link href="/listings" className="text-lg text-text-secondary transition-colors hover:text-foreground" onClick={() => setMenuOpen(false)}>
                    My Listings
                  </Link>
                  <Link href="/listings/new" className="text-lg text-text-secondary transition-colors hover:text-foreground" onClick={() => setMenuOpen(false)}>
                    List a Boat
                  </Link>
                  <Link href="/saved-searches" className="text-lg text-text-secondary transition-colors hover:text-foreground" onClick={() => setMenuOpen(false)}>
                    Saved Searches{visibleSearchesWithUpdates > 0 ? ` (${visibleSearchesWithUpdates} new)` : ""}
                  </Link>
                  <button
                    onClick={() => { signOut({ callbackUrl: "/" }); setMenuOpen(false); }}
                    className="text-lg text-red-400 transition-colors hover:text-red-300"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="text-lg text-text-secondary transition-colors hover:text-foreground" onClick={() => setMenuOpen(false)}>
                    Sign In
                  </Link>
                  <Link href="/sign-up" className="rounded-full bg-accent-btn px-8 py-3 text-lg font-semibold text-white transition-all hover:bg-accent-light" onClick={() => setMenuOpen(false)}>
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Spacer */}
      <div className="h-[72px]" />
    </>
  );
}
