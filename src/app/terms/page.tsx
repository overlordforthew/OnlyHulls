import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — OnlyHulls",
  description: "Terms of service for using the OnlyHulls boat marketplace.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-text-secondary">Last updated: April 1, 2026</p>

      <div className="mt-8 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using OnlyHulls (&quot;the Platform&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
          <p className="mt-3">
            OnlyHulls is an AI-powered boat marketplace that connects buyers and sellers.
            We aggregate listings from third-party brokers and provide tools for direct listings.
            OnlyHulls does not own, inspect, or guarantee any vessel listed on the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
          <p className="mt-3">
            You must provide accurate information when creating an account. You are responsible
            for maintaining the security of your account credentials. You must be at least 18
            years old to use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Listings &amp; Transactions</h2>
          <p className="mt-3">
            Sellers are solely responsible for the accuracy of their listings, including pricing,
            specifications, condition, and photographs. OnlyHulls does not participate in, mediate,
            or guarantee any transaction between buyers and sellers. All purchases are made directly
            between the parties involved.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Third-Party Listings</h2>
          <p className="mt-3">
            Many listings on OnlyHulls are sourced from third-party broker websites. We provide
            links to these original listings as a convenience. OnlyHulls is not responsible for
            the accuracy, availability, or content of third-party listings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. AI Features</h2>
          <p className="mt-3">
            OnlyHulls uses artificial intelligence for buyer profiling, boat matching, and listing
            analysis. AI-generated recommendations and scores are for informational purposes only
            and should not be the sole basis for purchasing decisions. Always conduct your own
            due diligence, including independent surveys and inspections.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Limitation of Liability</h2>
          <p className="mt-3">
            OnlyHulls is provided &quot;as is&quot; without warranties of any kind. We are not liable for
            any damages arising from your use of the Platform, including but not limited to
            losses from transactions, inaccurate listings, or AI recommendations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">8. Contact</h2>
          <p className="mt-3">
            For questions about these terms, contact us at{" "}
            <a href="mailto:hello@onlyhulls.com" className="text-primary hover:underline">
              hello@onlyhulls.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
