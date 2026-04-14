import { getCspNonce, serializeJsonForInlineScript } from "@/lib/security/csp";

export default async function JsonLdScript({ data }: { data: unknown }) {
  const nonce = await getCspNonce();

  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonForInlineScript(data),
      }}
    />
  );
}
