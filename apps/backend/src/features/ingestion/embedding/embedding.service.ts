import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import type { Chunk, EmbeddedChunk } from '../ingestion.service';
import { CreateEmbeddingResponse } from 'openai/resources/embeddings';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../infrastructure/config/env.schema';

type SourceIdWithUserId = {
  id: string;
  userId: string;
};

@Injectable()
export class EmbeddingService {
  private readonly batchSize: number;

  constructor(
    private readonly openAIService: OpenAiService,
    config: ConfigService<Env, true>,
  ) {
    this.batchSize = config.get('INGESTION_BATCH_SIZE', { infer: true });
  }

  async embedChunks(
    source: SourceIdWithUserId,
    chunks: Chunk[],
    startIndex = 0,
  ): Promise<EmbeddedChunk[]> {
    const embeddedChunks: EmbeddedChunk[] = [];

    for (let offset = 0; offset < chunks.length; offset += this.batchSize) {
      const batch = chunks.slice(offset, offset + this.batchSize);
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
