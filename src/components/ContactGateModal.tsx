"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X, ExternalLink, Bookmark, Sparkles, Bell } from "lucide-react";
import { getSafeExternalUrl } from "@/lib/url-safety";

interface ContactGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  boatId: string;
  sourceUrl: string;
  sourceName: string | null;
  boatTitle: string;
  boatSlug?: string;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("oh_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("oh_session_id", id);
  }
  return id;
}

function logClick(boatId: string, clickType: "guest" | "save_and_continue") {
  const sessionId = getSessionId();
  fetch(`/api/boats/${boatId}/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clickType, sessionId }),
  }).catch(() => {});
}

export default function ContactGateModal({
  isOpen,
  onClose,
  boatId,
  sourceUrl,
  sourceName,
  boatTitle,
  boatSlug,
}: ContactGateModalProps) {
  const t = useTranslations("contactGate");
  const { data: session } = useSession();
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const safeSourceUrl = getSafeExternalUrl(sourceUrl);
  const openedRef = useRef(false);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (!openedRef.current) {
      const sessionId = getSessionId();
      fetch(`/api/boats/${boatId}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickType: "gate_open", sessionId }),
      }).catch(() => {});
      openedRef.current = true;
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [boatId, isOpen, handleEscape]);

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndContinue = () => {
    if (session?.user) {
      logClick(boatId, "save_and_continue");
      if (safeSourceUrl) window.open(safeSourceUrl, "_blank");
      onClose();
    } else {
      const callback = boatSlug ? `/boats/${boatSlug}` : `/boats`;
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(callback)}`);
    }
  };

  const handleGuestContinue = () => {
    logClick(boatId, "guest");
    if (safeSourceUrl) window.open(safeSourceUrl, "_blank");
    onClose();
  };

  const resolvedDisplayName = sourceName || t("originalListing");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("ariaLabel")}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("close")}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="pr-8">
          <h3 className="text-xl font-bold text-foreground">
            {t("title", { listingName: resolvedDisplayName })}
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            {t("description", { boatTitle })}
          </p>
        </div>

        {/* Value props */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-text-secondary">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span>{t("benefit1")}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-text-secondary">
            <Bell className="h-4 w-4 shrink-0 text-primary" />
            <span>{t("benefit2")}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-text-secondary">
            <Bookmark className="h-4 w-4 shrink-0 text-primary" />
            <span>{t("benefit3")}</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleSaveAndContinue}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-btn px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
          >
            <Bookmark className="h-4 w-4" />
            {session?.user ? t("saveContinue") : t("signUpSave")}
          </button>

          <button
            onClick={handleGuestContinue}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-6 py-3.5 text-sm font-medium text-text-secondary transition-all hover:border-text-secondary hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            {t("continueGuest")}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-text-tertiary">
          {t("freeAccountHint")}
        </p>
      </div>
    </div>
  );
}
