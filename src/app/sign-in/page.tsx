"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only allow same-origin relative paths (no protocol-relative URLs like //)
  const rawCallback = searchParams.get("callbackUrl") || "/";
  const callbackUrl = /^\/(?!\/)/.test(rawCallback) ? rawCallback : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground placeholder:text-text-tertiary shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-surface p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Sign in to OnlyHulls
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-primary hover:text-primary-light">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-accent-btn px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:text-primary-light">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
