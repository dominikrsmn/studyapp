import { Injectable } from '@nestjs/common';
import type { SemanticSearchResult } from '@study/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { EmbeddingService } from '../../ingestion/embedding/embedding.service';

@Injectable()
export class SemanticSearchService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly prismaService: PrismaService,
  ) {}

  async search(
    query: string,
    moduleId: string,
    userId: string,
    topK = 5,
  ): Promise<SemanticSearchResult[]> {
    const embedding = await this.embeddingService.embedQuery(query, userId);
    const vector = `[${embedding.join(',')}]`;

    return await this.prismaService.$queryRaw<SemanticSearchResult[]>`
      SELECT chunk."content", chunk."pageStart", chunk."pageEnd"
      FROM "SourceChunk" AS chunk
      INNER JOIN "Source" AS source ON source."id" = chunk."sourceId"
      INNER JOIN "Module" AS module ON module."id" = source."moduleId"
      INNER JOIN "Semester" AS semester ON semester."id" = module."semesterId"
      WHERE semester."userId" = ${userId}
        AND module."id" = ${moduleId}
        AND chunk."embedding" IS NOT NULL
      ORDER BY chunk."embedding" <=> ${vector}::vector
      LIMIT ${topK}
    `;
  }
}
