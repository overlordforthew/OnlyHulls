"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, CreditCard, Mail, ExternalLink, Bell } from "lucide-react";

interface UserProfile {
  subscription_tier: string;
  email_alerts: string;
  newsletter_opt_in: boolean;
  role: string;
  billing_enabled: boolean;
  email_enabled: boolean;
}

interface SavedSearchSummary {
  savedSearchCount: number;
  searchesWithUpdates: number;
  totalNewResults: number;
}

const TIER_LABELS: Record<string, string> = {
  free: "Free (Buyer)",
  plus: "Plus (Buyer)",
  pro: "Pro (Buyer)",
  "free-seller": "Free (Seller)",
  standard: "Creator (Seller)",
  featured: "Featured Creator (Seller)",
  broker: "Broker",
};

export default function AccountPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [emailAlerts, setEmailAlerts] = useState("none");
  const [newsletter, setNewsletter] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [savedSearchSummary, setSavedSearchSummary] = useState<SavedSearchSummary | null>(null);

  useEffect(() => {
    fetch("/api/user/account")
      .then((r) => r.json())
      .then((data) => {
        if (data.subscription_tier) {
          setProfile(data);
          setEmailAlerts(data.email_alerts || "none");
          setNewsletter(data.newsletter_opt_in ?? true);
        }
      })
      .catch(() => {});

    fetch("/api/saved-searches/summary")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setSavedSearchSummary(data);
      })
      .catch(() => {});
  }, []);

  async function savePreferences() {
    setSaving(true);
    await fetch("/api/user/email-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_alerts: emailAlerts, newsletter_opt_in: newsletter }),
    });
    setSaving(false);
  }

  async function openPortal() {
    setPortalLoading(true);
    setBillingMessage(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingMessage(data.error || "Unable to open billing right now.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setBillingMessage("Unable to open billing right now.");
    } finally {
      setPortalLoading(false);
    }
  }

  const tier = profile?.subscription_tier || "free";
  const isPaid = !tier.startsWith("free");
  const billingEnabled = profile?.billing_enabled ?? false;
  const emailEnabled = profile?.email_enabled ?? false;
  const alertCadenceLabel =
    emailAlerts === "instant" ? "Instant alerts" : emailAlerts === "weekly" ? "Weekly digest" : "Alerts off";
  const alertCadenceDescription = !emailEnabled
    ? "Email delivery is configured in-app, but this environment is not ready to send alerts yet."
    : emailAlerts === "instant"
      ? "New matching boats will email you as soon as the alert job finds them."
      : emailAlerts === "weekly"
        ? "You will get a weekly round-up of new boats matching your saved searches."
        : "You can still track new boats in-app even with email alerts turned off.";

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold">Account</h1>
      <p className="mt-1 text-text-secondary">
        Manage your plan and email preferences
      </p>

      {/* Current Plan */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <Crown className={`h-6 w-6 ${isPaid ? "text-primary" : "text-text-tertiary"}`} />
          <div>
            <h2 className="text-lg font-bold">{TIER_LABELS[tier] || tier}</h2>
            <p className="text-sm text-text-secondary">
              {session?.user?.email}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isPaid && billingEnabled ? (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              {portalLoading ? "Opening..." : "Manage Billing"}
              <ExternalLink className="h-3 w-3" />
            </button>
          ) : (
            <>
              <a
                href="/match#pricing"
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  billingEnabled
                    ? "bg-primary-btn text-white hover:bg-primary-light"
                    : "bg-muted text-text-secondary"
                }`}
              >
                {billingEnabled ? "Upgrade Buyer Plan" : "Billing Setup In Progress"}
              </a>
              <a
                href="/sell#pricing"
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-all ${
                  billingEnabled
                    ? "border-border text-foreground hover:border-primary hover:text-primary"
                    : "border-border text-text-secondary"
                }`}
              >
                {billingEnabled ? "Upgrade Seller Plan" : "Paid Seller Billing Coming Soon"}
              </a>
            </>
          )}
        </div>
        {!billingEnabled && (
          <p className="mt-4 text-sm text-accent">
            Paid billing is not configured on this environment yet. Free buyer and seller flows still work.
          </p>
        )}
        {billingMessage && (
          <p className="mt-3 text-sm text-accent">{billingMessage}</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-bold">Saved Searches</h2>
            <p className="text-sm text-text-secondary">
              Keep track of new boats from your favorite browse views.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Saved</p>
            <p className="mt-2 text-2xl font-bold">{savedSearchSummary?.savedSearchCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">With Updates</p>
            <p className="mt-2 text-2xl font-bold">{savedSearchSummary?.searchesWithUpdates ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">New Boats</p>
            <p className="mt-2 text-2xl font-bold">{savedSearchSummary?.totalNewResults ?? 0}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Alert cadence</p>
          <p className="mt-2 text-lg font-semibold">{alertCadenceLabel}</p>
          <p className="mt-1 text-sm text-text-secondary">{alertCadenceDescription}</p>
        </div>

        <Link
          href="/saved-searches"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
        >
          Manage Saved Searches
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Email Preferences */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-bold">Email Preferences</h2>
        </div>

        <div className="mt-6 space-y-5">
          {/* Match Alerts */}
          <div>
            <label className="text-sm font-medium">New Boat Alerts</label>
            <p className="text-xs text-text-secondary">
              Get notified when new boats hit your saved searches and buyer profile
            </p>
            <div className="mt-2 flex gap-2">
              {(["none", "weekly", "instant"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setEmailAlerts(opt)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    emailAlerts === opt
                      ? "bg-primary-btn text-white"
                      : "border border-border text-text-secondary hover:border-primary hover:text-primary"
                  }`}
                >
                  {opt === "none" ? "Off" : opt === "weekly" ? "Weekly Digest" : "Instant"}
                </button>
              ))}
            </div>
            {emailAlerts !== "none" && tier === "free" && (
              <p className="mt-1 text-xs text-accent">
                Requires Plus or Pro plan
              </p>
            )}
          </div>

          {/* Newsletter */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Monthly Newsletter</label>
              <p className="text-xs text-text-secondary">
                Featured boats, market trends, and OnlyHulls news
              </p>
            </div>
            <button
              onClick={() => setNewsletter(!newsletter)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                newsletter ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  newsletter ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <button
          onClick={savePreferences}
          disabled={saving}
          className="mt-6 rounded-full bg-primary-btn px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        {!emailEnabled && (
          <p className="mt-4 text-sm text-accent">
            Transactional email is not configured yet, so alerts and newsletters will not be delivered.
          </p>
        )}
      </div>
    </div>
  );
}
