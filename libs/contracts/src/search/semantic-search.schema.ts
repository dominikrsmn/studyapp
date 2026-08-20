import { z } from 'zod';

export const semanticSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

export const semanticSearchResultSchema = z.object({
  content: z.string(),
});

export type SemanticSearchRequest = z.infer<typeof semanticSearchRequestSchema>;
export type SemanticSearchResult = z.infer<typeof semanticSearchResultSchema>;
