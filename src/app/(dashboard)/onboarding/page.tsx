"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Role = "buyer" | "seller" | "both";

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role");
  const rawCallback = searchParams.get("callbackUrl") || "";
  const callbackUrl = /^\/(?!\/)/.test(rawCallback) ? rawCallback : "";
  const [selectedRole, setSelectedRole] = useState<Role | null>(
    defaultRole === "buyer" || defaultRole === "seller" || defaultRole === "both"
      ? defaultRole
      : null
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!selectedRole) return;
    setLoading(true);
    try {
      const res = await fetch("/api/user/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      if (!res.ok) throw new Error("Failed to set role");

      if (selectedRole === "buyer" || selectedRole === "both") {
        router.push(
          callbackUrl
            ? `/onboarding/profile?callbackUrl=${encodeURIComponent(callbackUrl)}`
            : "/onboarding/profile"
        );
      } else {
        router.push("/listings/new");
      }
    } catch {
      setLoading(false);
    }
  }

  const roles: { value: Role; label: string; desc: string; icon: string }[] = [
    {
      value: "buyer",
      label: "I'm Looking for a Boat",
      desc: "Browse listings, get AI-powered matches, and connect with sellers.",
      icon: "🔍",
    },
    {
      value: "seller",
      label: "I'm Selling a Boat",
      desc: "List your boat, get matched with qualified buyers, and connect directly.",
      icon: "⛵",
    },
    {
      value: "both",
      label: "Both — Buying and Selling",
      desc: "Browse and list boats. Get the best of both worlds.",
      icon: "🔄",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Welcome to OnlyHulls</h1>
      <p className="mt-2 text-foreground/60">
        How would you like to use the platform?
      </p>

      <div className="mt-8 space-y-4">
        {roles.map((role) => (
          <button
            key={role.value}
            onClick={() => setSelectedRole(role.value)}
            className={`w-full rounded-lg border-2 p-6 text-left transition ${
              selectedRole === role.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">{role.icon}</span>
              <div>
                <p className="text-lg font-semibold">{role.label}</p>
                <p className="mt-1 text-sm text-foreground/60">{role.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selectedRole || loading}
        className="mt-8 w-full rounded-full bg-primary-btn py-3 text-lg font-medium text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "Setting up..." : "Continue"}
      </button>
    </div>
  );
}
