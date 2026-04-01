"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const subtitle =
    searchParams.get("role") === "seller"
      ? "List your boat on OnlyHulls"
      : "Join OnlyHulls and find your perfect boat";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: displayName || undefined }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      return;
    }

    setVerificationSent(true);
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground placeholder:text-text-tertiary shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-surface p-8">
        {verificationSent ? (
          <div className="text-center space-y-4 py-4">
            <div className="text-4xl">&#9993;</div>
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-text-secondary">
              We sent a verification link to <strong>{email}</strong>. Click the link to activate your account, then sign in.
            </p>
            <Link
              href="/sign-in"
              className="inline-block mt-4 rounded-full bg-accent-btn px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-light"
            >
              Go to Sign In
            </Link>
          </div>
        ) : (
        <>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-text-secondary">
              Name (optional)
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </div>

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-text-tertiary">Minimum 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-accent-btn px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:text-primary-light">
            Sign in
          </Link>
        </p>
        </>
        )}
      </div>
    </div>
  );
}
