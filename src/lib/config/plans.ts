export type SubscriptionTier =
  | "free"
  | "plus"
  | "free-seller"
  | "standard"
  | "featured"
  | "broker";

export type UserRole = "buyer" | "seller" | "both" | "broker" | "admin";

export interface PlanConfig {
  tier: SubscriptionTier;
  name: string;
  price: number; // USD billed amount
  role: "buyer" | "seller" | "broker";
  stripePriceId: string;
  features: string[];
  limits: {
    savesPerDay: number; // -1 = unlimited
    connectsPerMonth: number; // -1 = unlimited
    photosPerListing: number;
    activeListings: number; // -1 = unlimited
  };
  emailAlerts: "none" | "weekly" | "instant";
  emailBlast: boolean; // featured in buyer email blasts
  externalSearch: boolean; // search other sites for boats
}

export const PLANS: Record<string, PlanConfig> = {
  // ─── Buyer Plans ───
  free: {
    tier: "free",
    name: "Free",
    price: 0,
    role: "buyer",
    stripePriceId: "",
    features: [
      "Browse all listings",
      "10 saves/day",
      "Basic search filters",
      "View match scores",
    ],
    limits: { savesPerDay: 10, connectsPerMonth: -1, photosPerListing: 0, activeListings: 0 },
    emailAlerts: "none",
    emailBlast: false,
    externalSearch: false,
  },
  plus: {
    tier: "plus",
    name: "Plus",
    price: 10,
    role: "buyer",
    stripePriceId: process.env.STRIPE_PRICE_BUYER_PLUS || "",
    features: [
      "Unlimited saves & matching",
      "AI buyer profile",
      "Match score breakdowns",
      "Saved searches & instant alerts",
      "Dreamboard",
      "Priority in seller notifications",
      "Search boats on other sites",
    ],
    limits: { savesPerDay: -1, connectsPerMonth: -1, photosPerListing: 0, activeListings: 0 },
    emailAlerts: "instant",
    emailBlast: false,
    externalSearch: true,
  },

  // ─── Seller Plans ───
  "free-seller": {
    tier: "free-seller",
    name: "Free",
    price: 0,
    role: "seller",
    stripePriceId: "",
    features: [
      "1 active listing",
      "Manual text-based entry",
      "Up to 10 photos",
      "Standard visibility",
      "Match notifications",
    ],
    limits: { savesPerDay: 0, connectsPerMonth: 0, photosPerListing: 10, activeListings: 1 },
    emailAlerts: "none",
    emailBlast: false,
    externalSearch: false,
  },
  standard: {
    tier: "standard",
    name: "Creator",
    price: 30,
    role: "seller",
    stripePriceId: process.env.STRIPE_PRICE_SELLER_STANDARD || "",
    features: [
      "Unlimited active listings",
      "AI-assisted listing creation",
      "Dynamic photo uploads",
      "Up to 30 photos per listing",
      "Match notifications",
    ],
    limits: { savesPerDay: 0, connectsPerMonth: -1, photosPerListing: 30, activeListings: -1 },
    emailAlerts: "none",
    emailBlast: false,
    externalSearch: false,
  },
  featured: {
    tier: "featured",
    name: "Featured Creator",
    price: 60,
    role: "seller",
    stripePriceId: process.env.STRIPE_PRICE_SELLER_FEATURED || "",
    features: [
      "Everything in Creator",
      "External video embeds (YouTube/Vimeo)",
      "Boosted placement in feed",
      "Featured in buyer email blasts",
      "Analytics dashboard",
      "Up to 50 photos per listing",
      "Priority matching",
    ],
    limits: { savesPerDay: 0, connectsPerMonth: -1, photosPerListing: 50, activeListings: -1 },
    emailAlerts: "none",
    emailBlast: true,
    externalSearch: false,
  },

  // ─── Broker ───
  broker: {
    tier: "broker",
    name: "Broker",
    price: 50,
    role: "broker",
    stripePriceId: process.env.STRIPE_PRICE_BROKER || "",
    features: [
      "AI-assisted broker profile",
      "Specialty & geographic matching",
      "Qualified lead notifications",
      "Direct messaging with clients",
      "Analytics on lead volume",
    ],
    limits: { savesPerDay: 0, connectsPerMonth: -1, photosPerListing: 50, activeListings: -1 },
    emailAlerts: "none",
    emailBlast: false,
    externalSearch: false,
  },
};

export function getPlanByTier(tier: SubscriptionTier | string): PlanConfig {
  return PLANS[tier] || PLANS.free;
}

export function getBuyerPlans(): PlanConfig[] {
  return [PLANS.free, PLANS.plus];
}

export function getSellerPlans(): PlanConfig[] {
  return [PLANS["free-seller"], PLANS.standard, PLANS.featured];
}
