import { query } from "@/lib/db";
import {
  embeddingsEnabled,
  generateEmbedding,
  profileToEmbeddingText,
} from "@/lib/ai/embeddings";
import { logger } from "@/lib/logger";
import { computeMatchesForBuyer } from "./engine";

export async function refreshBuyerProfileMatches(
  buyerProfileId: string,
  profile: unknown
) {
  try {
    if (embeddingsEnabled()) {
      const embedding = await generateEmbedding(profileToEmbeddingText(profile));
      await query("UPDATE buyer_profiles SET dna_embedding = $1 WHERE id = $2", [
        `[${embedding.join(",")}]`,
        buyerProfileId,
      ]);
    } else {
      await query("UPDATE buyer_profiles SET dna_embedding = NULL WHERE id = $1", [
        buyerProfileId,
      ]);
    }
  } catch (err) {
    logger.warn({ err, buyerProfileId }, "Failed to refresh buyer embedding");
    await query("UPDATE buyer_profiles SET dna_embedding = NULL WHERE id = $1", [
      buyerProfileId,
    ]);
  }

  return computeMatchesForBuyer(buyerProfileId);
}
