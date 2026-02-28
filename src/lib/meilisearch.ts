import { MeiliSearch } from "meilisearch";

let _meili: MeiliSearch | null = null;

export function getMeili(): MeiliSearch {
  if (!_meili) {
    _meili = new MeiliSearch({
      host: process.env.MEILISEARCH_URL || "http://localhost:7701",
      apiKey: process.env.MEILISEARCH_API_KEY,
    });
  }
  return _meili;
}

export const BOATS_INDEX = "boats";
