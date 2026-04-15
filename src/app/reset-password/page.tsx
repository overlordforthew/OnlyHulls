"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

function ResetForm() {
  const t = useTranslations("auth.resetPassword");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || t("genericError"));
      return;
    }

    setSuccess(true);
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground placeholder:text-text-tertiary shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-text-secondary">{t("invalidLink")}</p>
        <Link href="/forgot-password" className="text-primary hover:text-primary-light">
          {t("requestNew")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-surface p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
      </div>

      {success ? (
        <div className="space-y-4 text-center">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">
            {t("success")}
          </div>
          <Link
            href="/sign-in"
            className="inline-block rounded-full bg-accent-btn px-6 py-3 text-sm font-semibold text-white"
          >
            {t("signIn")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              {t("newPassword")}
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
            <p className="mt-1 text-xs text-text-tertiary">{t("passwordHint")}</p>
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-text-secondary">
              {t("confirmPassword")}
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-accent-btn px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50"
          >
            {loading ? t("updating") : t("submit")}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
