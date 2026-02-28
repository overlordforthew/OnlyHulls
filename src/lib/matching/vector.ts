import { query } from "@/lib/db";

interface VectorCandidate {
  boat_id: string;
  similarity: number;
}

export async function findTopCandidates(
  buyerEmbedding: string,
  limit: number = 100
): Promise<VectorCandidate[]> {
  const rows = await query<{ id: string; similarity: number }>(
    `SELECT b.id, 1 - (b.dna_embedding <=> $1::vector) AS similarity
     FROM boats b
     WHERE b.status = 'active'
       AND b.dna_embedding IS NOT NULL
     ORDER BY b.dna_embedding <=> $1::vector
     LIMIT $2`,
    [buyerEmbedding, limit]
  );

  return rows.map((r) => ({
    boat_id: r.id,
    similarity: r.similarity,
  }));
}
