"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "18587794588";
const WHATSAPP_TEXT =
  "Hi Gil, I have a question about a boat I found on OnlyHulls.";

const HIDDEN_PREFIXES = ["/admin", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

export default function WhatsAppContactButton() {
  const pathname = usePathname();

  if (pathname && HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-contact-button"
      aria-label="Open WhatsApp chat"
      className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 hover:bg-[#20ba59] active:scale-95 sm:bottom-6 sm:right-6"
      title="WhatsApp"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">WhatsApp</span>
    </Link>
  );
}
