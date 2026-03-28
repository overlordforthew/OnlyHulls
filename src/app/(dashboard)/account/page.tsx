"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Crown, CreditCard, Mail, Bell, ExternalLink } from "lucide-react";

interface UserProfile {
  subscription_tier: string;
  email_alerts: string;
  newsletter_opt_in: boolean;
  role: string;
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
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setPortalLoading(false);
    }
  }

  const tier = profile?.subscription_tier || "free";
  const isPaid = !tier.startsWith("free");

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
          {isPaid ? (
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
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
              >
                Upgrade Buyer Plan
              </a>
              <a
                href="/sell#pricing"
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
              >
                Upgrade Seller Plan
              </a>
            </>
          )}
        </div>
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
              Get notified when boats matching your profile are listed
            </p>
            <div className="mt-2 flex gap-2">
              {(["none", "weekly", "instant"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setEmailAlerts(opt)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    emailAlerts === opt
                      ? "bg-primary text-white"
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
          className="mt-6 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
