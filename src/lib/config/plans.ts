export type SubscriptionTier =
  | "free"
  | "plus"
  | "pro"
  | "standard"
  | "featured"
  | "broker";

export type UserRole = "buyer" | "seller" | "both" | "broker" | "admin";

export interface PlanConfig {
  tier: SubscriptionTier;
  name: string;
  price: number; // monthly USD
  role: "buyer" | "seller" | "broker";
  stripePriceId: string;
  features: string[];
  limits: {
    savesPerDay: number;
    connectsPerMonth: number;
    photosPerListing: number;
  };
}

export const PLANS: Record<string, PlanConfig> = {
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
    limits: { savesPerDay: 10, connectsPerMonth: 0, photosPerListing: 0 },
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
      "Saved searches & alerts",
      "Dreamboard",
    ],
    limits: { savesPerDay: -1, connectsPerMonth: 3, photosPerListing: 0 },
  },
  pro: {
    tier: "pro",
    name: "Pro",
    price: 30,
    role: "buyer",
    stripePriceId: process.env.STRIPE_PRICE_BUYER_PRO || "",
    features: [
      "Everything in Plus",
      "Priority in seller notifications",
      "Advanced match filters",
      "External boat aggregation",
      "Direct messaging",
    ],
    limits: { savesPerDay: -1, connectsPerMonth: 10, photosPerListing: 0 },
  },
  standard: {
    tier: "standard",
    name: "Standard",
    price: 30,
    role: "seller",
    stripePriceId: process.env.STRIPE_PRICE_SELLER_STANDARD || "",
    features: [
      "AI-assisted listing creation",
      "Standard visibility",
      "Up to 20 photos",
      "Match notifications",
      "Email introductions",
    ],
    limits: { savesPerDay: 0, connectsPerMonth: -1, photosPerListing: 20 },
  },
  featured: {
    tier: "featured",
    name: "Featured",
    price: 50,
    role: "seller",
    stripePriceId: process.env.STRIPE_PRICE_SELLER_FEATURED || "",
    features: [
      "Everything in Standard",
      "Boosted placement in feed",
      "Video walkthrough AI",
      "Analytics dashboard",
      "Up to 50 photos",
      "Priority matching",
    ],
    limits: { savesPerDay: 0, connectsPerMonth: -1, photosPerListing: 50 },
  },
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
      "Ratings & review system",
      "Analytics on lead volume",
    ],
    limits: { savesPerDay: 0, connectsPerMonth: -1, photosPerListing: 0 },
  },
};

export function getPlanByTier(tier: SubscriptionTier): PlanConfig {
  return PLANS[tier] || PLANS.free;
}

export function getBuyerPlans(): PlanConfig[] {
  return [PLANS.free, PLANS.plus, PLANS.pro];
}

export function getSellerPlans(): PlanConfig[] {
  return [PLANS.standard, PLANS.featured];
}
