import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import type { Chunk, EmbeddedChunk } from '../ingestion.service';
import { CreateEmbeddingResponse } from 'openai/resources/embeddings';
import { INGESTION_BATCH_SIZE } from '../ingestion-limits';

type SourceIdWithUserId = {
  id: string;
  userId: string;
};

@Injectable()
export class EmbeddingService {
  constructor(private readonly openAIService: OpenAiService) {}

  async embedChunks(
    source: SourceIdWithUserId,
    chunks: Chunk[],
    startIndex = 0,
  ): Promise<EmbeddedChunk[]> {
    const embeddedChunks: EmbeddedChunk[] = [];

    for (
      let offset = 0;
      offset < chunks.length;
      offset += INGESTION_BATCH_SIZE
    ) {
      const batch = chunks.slice(offset, offset + INGESTION_BATCH_SIZE);
      const response = await this.openAIService.client.embeddings.create({
        input: batch.map((chunk) => chunk.content),
        model: 'text-embedding-3-small',
        encoding_format: 'float',
        user: source.userId,
      });

      embeddedChunks.push(
        ...response.data.map((item) => ({
          ...batch[item.index],
          index: startIndex + offset + item.index,
          embedding: item.embedding,
        })),
      );
    }

    return embeddedChunks;
  }

  async embedQuery(query: string, userId: string): Promise<number[]> {
    const response: CreateEmbeddingResponse =
      await this.openAIService.client.embeddings.create({
        input: query,
        model: 'text-embedding-3-small',
        encoding_format: 'float',
        user: userId,
      });

    return response.data[0].embedding;
  }
}
