import { MeiliSearch } from "meilisearch";

export const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_URL || "http://localhost:7701",
  apiKey: process.env.MEILISEARCH_API_KEY,
});

export const BOATS_INDEX = "boats";
