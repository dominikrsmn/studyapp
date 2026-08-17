import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../../open-ai/open-ai.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Chunk, EmbeddedChunk } from '../ingestion.service';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../database/generated/client';
import { Sql } from '@prisma/client/runtime/client';

type SourceIdWithUserId = {
  id: string;
  userId: string;
};

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  constructor(
    private readonly openAIService: OpenAiService,
    private readonly prismaService: PrismaService,
  ) {}

  async embed(source: SourceIdWithUserId, chunks: Chunk[]): Promise<number> {
    const chunkContents: string[] = chunks.flatMap((chunk) => chunk.content);
    this.logger.log('Got ' + chunkContents.length + ' chunk contents');
    this.logger.log(chunkContents);
    const response = await this.openAIService.client.embeddings.create({
      input: chunkContents,
      model: 'text-embedding-3-small',
      encoding_format: 'float',
      user: source.userId,
    });

    this.logger.log(response);

    const embeddedChunks: EmbeddedChunk[] = response.data.map((item) => ({
      ...chunks[item.index],
      index: item.index,
      embedding: item.embedding,
    }));

    this.logger.log('Got ' + embeddedChunks.length + ' embedded Chunks');

    const rows: Sql[] = [];
    for (let i = 0; i < embeddedChunks.length; i++) {
      const embeddedChunk = embeddedChunks[i];
      const vector = `[${embeddedChunk.embedding.join(',')}]`;
      rows.push(Prisma.sql`
        (
        ${randomUUID()},
        ${embeddedChunk.content},
        ${source.id},
        ${embeddedChunk.index},
        ${embeddedChunk.page},
        ${embeddedChunk.page},
        ${vector}::vector
    )
        `);
    }

    this.logger.log('Executing prisma query on ' + rows.length + ' rows');

    await this.prismaService.$executeRaw`
  INSERT INTO "SourceChunk"
    ("id", "content", "sourceId", "chunkIndex", "pageEnd", "pageStart", "embedding")
  VALUES ${Prisma.join(rows, ',')}
    `;

    this.logger.log('successful');

    return rows.length;
  }
}
