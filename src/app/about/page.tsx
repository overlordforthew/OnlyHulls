import type { Metadata } from "next";
import { Waves, Sparkles, Heart, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "About — OnlyHulls",
  description: "OnlyHulls is an AI-powered boat marketplace built for real boat lovers.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <div className="flex items-center gap-3">
        <Waves className="h-8 w-8 text-primary" strokeWidth={2.5} />
        <h1 className="text-3xl font-bold">
          About <span className="text-primary">OnlyHulls</span>
        </h1>
      </div>

      <div className="mt-8 space-y-6 text-foreground/80 leading-relaxed">
        <p className="text-lg">
          OnlyHulls is a boat marketplace built by people who actually love boats.
          We use AI to help buyers find the right boat faster and help sellers
          reach qualified, serious buyers.
        </p>

        <p>
          The boat buying process is broken. Listings are scattered across dozens
          of broker sites. Specs are inconsistent. Photos are terrible. And you
          have no idea if a boat actually fits what you need until you&apos;ve spent
          hours researching it.
        </p>

        <p>
          We&apos;re fixing that by aggregating listings from the best broker sites,
          enriching them with AI-extracted specifications, and matching buyers to
          boats based on their actual needs — not just price and location.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <Sparkles className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">AI-Powered Matching</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Tell us what you want. Our AI profiles your needs and ranks every
            boat in our catalog by how well it fits.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <Heart className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">Zero Commission</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Browsing, searching, and contacting sellers is always free.
            We charge for AI intelligence, not for connecting people.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <Shield className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">Real Boats Only</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Every listing is sourced from verified brokers or submitted by
            real owners. No bait-and-switch. No ghost listings.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">Get in Touch</h2>
        <p className="mt-3 text-text-secondary">
          Questions, feedback, or partnership inquiries? Reach us at{" "}
          <a href="mailto:hello@onlyhulls.com" className="text-primary hover:underline">
            hello@onlyhulls.com
          </a>.
        </p>
      </div>
    </div>
  );
}
