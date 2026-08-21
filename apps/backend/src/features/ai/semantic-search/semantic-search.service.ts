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

    const rows = await this.prismaService.$queryRaw<
      Omit<SemanticSearchResult, 'citationLabel'>[]
    >`
      SELECT source."id" AS "sourceId",
             source."name" AS "sourceName",
             chunk."content",
             chunk."pageStart",
             chunk."pageEnd"
      FROM "SourceChunk" AS chunk
      INNER JOIN "Source" AS source ON source."id" = chunk."sourceId"
      INNER JOIN "Module" AS module ON module."id" = source."moduleId"
      INNER JOIN "Semester" AS semester ON semester."id" = module."semesterId"
      WHERE semester."userId" = ${userId}
        AND module."id" = ${moduleId}
        AND source."status" = 'READY'
        AND chunk."embedding" IS NOT NULL
      ORDER BY chunk."embedding" <=> ${vector}::vector, chunk."id"
      LIMIT ${topK}
    `;

    return rows.map((row, index) => ({
      ...row,
      citationLabel: `S${index + 1}`,
    }));
  }
}
