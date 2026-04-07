import { getStorageBackend } from "@/lib/storage";
import { matchIntelligenceEnabled } from "@/lib/ai/provider";

const PLACEHOLDER_MARKERS = [
  "placeholder",
  "changeme",
  "example",
  "dummy",
  "test_placeholder",
  "replace-me",
  "replace_me",
  "sk-placeholder",
  "pk_test_placeholder",
  "re_placeholder",
  "ant-placeholder",
];

export function hasConfiguredValue(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  const normalized = trimmed.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

export function billingEnabled(): boolean {
  return hasConfiguredValue(process.env.STRIPE_SECRET_KEY);
}

export function stripePriceConfigured(priceId?: string | null): boolean {
  return hasConfiguredValue(priceId);
}

export function paidPlanCheckoutEnabled(priceId?: string | null): boolean {
  return billingEnabled() && stripePriceConfigured(priceId);
}

export function emailEnabled(): boolean {
  return (
    hasConfiguredValue(process.env.RESEND_API_KEY) &&
    hasConfiguredValue(process.env.RESEND_FROM_EMAIL)
  );
}

export function openAIEnabled(): boolean {
  return hasConfiguredValue(process.env.OPENAI_API_KEY);
}

export function storageEnabled(): boolean {
  return getStorageBackend() !== "none";
}

export function mediaBackend(): string {
  return getStorageBackend();
}

export function matchIntelligenceConfigured(): boolean {
  return matchIntelligenceEnabled();
}
