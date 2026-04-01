import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — OnlyHulls",
  description: "How OnlyHulls collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-text-secondary">Last updated: April 1, 2026</p>

      <div className="mt-8 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
          <p className="mt-3">
            <strong>Account data:</strong> email address, display name, and encrypted password when you register.
          </p>
          <p className="mt-2">
            <strong>Buyer profile:</strong> boat preferences, budget range, experience level, and
            location preferences when you complete the AI matching questionnaire.
          </p>
          <p className="mt-2">
            <strong>Usage data:</strong> pages visited, boats viewed, search queries, and contact
            clicks to help us improve the Platform and provide better recommendations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Data</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>To provide AI-powered boat matching and recommendations</li>
            <li>To connect buyers with sellers and broker listings</li>
            <li>To send transactional emails (verification, password reset, match notifications)</li>
            <li>To improve our search, matching algorithms, and user experience</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. Data Sharing</h2>
          <p className="mt-3">
            We do not sell your personal data. We share data only with:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><strong>Sellers:</strong> your name and email when you initiate contact (with your consent)</li>
            <li><strong>Service providers:</strong> email delivery (Resend), payment processing (Stripe), and hosting infrastructure</li>
            <li><strong>Legal requirements:</strong> when required by law or to protect our rights</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Data Security</h2>
          <p className="mt-3">
            Passwords are hashed with bcrypt. All connections use HTTPS/TLS encryption.
            Payment processing is handled by Stripe — we never store credit card numbers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Your Rights</h2>
          <p className="mt-3">
            You can request access to, correction of, or deletion of your personal data at any
            time by contacting us. You can delete your account from the account settings page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Cookies</h2>
          <p className="mt-3">
            We use essential cookies for authentication and session management. We use anonymous
            session identifiers to track browsing patterns for improving recommendations.
            We do not use third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Contact</h2>
          <p className="mt-3">
            For privacy questions or data requests, contact us at{" "}
            <a href="mailto:hello@onlyhulls.com" className="text-primary hover:underline">
              hello@onlyhulls.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
