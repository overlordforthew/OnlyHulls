import { NextResponse } from "next/server";
import { billingEnabled, emailEnabled, openAIEnabled, storageEnabled } from "@/lib/capabilities";

export async function GET() {
  return NextResponse.json({
    billingEnabled: billingEnabled(),
    emailEnabled: emailEnabled(),
    openAIEnabled: openAIEnabled(),
    storageEnabled: storageEnabled(),
  });
}
