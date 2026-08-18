import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { Chunk, EmbeddedChunk } from '../ingestion.service';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { Sql } from '@prisma/client/runtime/client';

type SourceIdWithUserId = {
  id: string;
  userId: string;
};

@Injectable()
export class EmbeddingService {
  constructor(private readonly openAIService: OpenAiService) {}

  async embed(
    source: SourceIdWithUserId,
    chunks: Chunk[],
  ): Promise<EmbeddedChunk[]> {
    const chunkContents: string[] = chunks.flatMap((chunk) => chunk.content);

    const response = await this.openAIService.client.embeddings.create({
      input: chunkContents,
      model: 'text-embedding-3-small',
      encoding_format: 'float',
      user: source.userId,
    });

    const embeddedChunks: EmbeddedChunk[] = response.data.map((item) => ({
      ...chunks[item.index],
      index: item.index,
      embedding: item.embedding,
    }));

    return embeddedChunks;
  }
}
