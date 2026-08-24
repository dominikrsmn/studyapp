import { Inject, Injectable } from '@nestjs/common';
import { OpenAiService } from '../open-ai/open-ai.service';
import type {
  Chunk,
  EmbeddedChunk,
} from '../../features/ingestion/ingestion.service';
import { CreateEmbeddingResponse } from 'openai/resources/embeddings';
import { ConfigType } from '@nestjs/config';
import { embeddingConfig } from '../config/embedding.config';

type SourceIdWithUserId = {
  id: string;
  userId: string;
};

@Injectable()
export class EmbeddingService {
  private readonly batchSize: number;
  private readonly model: string;
  private readonly encodingFormat: 'float';

  constructor(
    private readonly openAIService: OpenAiService,

    @Inject(embeddingConfig.KEY)
    config: ConfigType<typeof embeddingConfig>,
  ) {
    this.batchSize = config.batchSize;
    this.model = config.model;
    this.encodingFormat = config.encodingFormat;
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
        model: this.model,
        encoding_format: this.encodingFormat,
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
        model: this.model,
        encoding_format: this.encodingFormat,
        user: userId,
      });

    return response.data[0].embedding;
  }
}
