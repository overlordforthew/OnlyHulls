"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground placeholder:text-text-tertiary shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-surface p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">
              If an account with that email exists, we&apos;ve sent a password reset link.
            </div>
            <Link href="/sign-in" className="text-sm text-primary hover:text-primary-light">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-accent-btn px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-text-secondary">
          Remember your password?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:text-primary-light">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
