import { NextResponse } from "next/server";
import {
  billingEnabled,
  embeddingProvider,
  emailEnabled,
  mediaBackend,
  matchIntelligenceConfigured,
  matchIntelligenceProvider,
  openAIEnabled,
  semanticMatchingEnabled,
  storageEnabled,
} from "@/lib/capabilities";

export async function GET() {
  return NextResponse.json({
    billingEnabled: billingEnabled(),
    emailEnabled: emailEnabled(),
    openAIEnabled: openAIEnabled(),
    semanticMatchingEnabled: semanticMatchingEnabled(),
    embeddingProvider: embeddingProvider(),
    storageEnabled: storageEnabled(),
    mediaBackend: mediaBackend(),
    matchIntelligenceEnabled: matchIntelligenceConfigured(),
    matchIntelligenceProvider: matchIntelligenceProvider(),
  });
}
