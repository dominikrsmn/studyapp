import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../database/generated/client';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../database/generated/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { EmbeddingService } from '../embedding.service';
import { CreateRagEmbeddingsJobData } from '../../../features/source-ingestion/ingestion.types';
import { SourceProcessingStageService } from '../../../features/source-ingestion/source-processing-stage.service';

type EmbeddingChunk = {
  id: string;
  chunkIndex: number;
  content: string;
  headingPath: string[];
  pageStart: number | null;
  pageEnd: number | null;
};

@Injectable()
export class CreateRagEmbeddingsJob {
  private readonly logger = new Logger(CreateRagEmbeddingsJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
  ) {}

  async process({ sourceId, chunkIds }: CreateRagEmbeddingsJobData): Promise<void> {
    const requestedChunkIds = [...new Set(chunkIds)];
    if (requestedChunkIds.length === 0) {
      throw new Error('Cannot embed an empty RAG chunk batch');
    }

    const source = await this.prismaService.source.findUnique({
      where: { id: sourceId },
      select: { name: true },
    });

    if (!source) {
      this.logger.warn(
        `Skipping create-rag-embeddings job because source "${sourceId}" no longer exists`,
      );
      return;
    }

    try {
      const chunks = await this.prismaService.$queryRaw<EmbeddingChunk[]>(
        Prisma.sql`
          SELECT chunk."id",
                 chunk."chunkIndex",
                 chunk."content",
                 chunk."headingPath",
                 chunk."pageStart",
                 chunk."pageEnd"
          FROM "SourceChunk" AS chunk
          WHERE chunk."sourceId" = ${sourceId}
            AND chunk."id" IN (${Prisma.join(requestedChunkIds)})
            AND chunk."embedding" IS NULL
          ORDER BY chunk."chunkIndex", chunk."id"
        `,
      );

      if (chunks.length === 0) {
        return;
      }

      const vectors = await this.embeddingService.embedTexts(
        chunks.map((chunk) => this.embeddingInput(source.name, chunk)),
      );
      const embeddingRows = chunks.map((chunk, index) => {
        const vector = `[${vectors[index].join(',')}]`;

        return Prisma.sql`(${chunk.id}::text, ${vector}::vector)`;
      });

      await this.prismaService.$executeRaw(
        Prisma.sql`
          UPDATE "SourceChunk" AS chunk
          SET "embedding" = incoming."embedding"
          FROM (
            VALUES ${Prisma.join(embeddingRows)}
          ) AS incoming("id", "embedding")
          WHERE chunk."id" = incoming."id"
            AND chunk."sourceId" = ${sourceId}
            AND chunk."embedding" IS NULL
        `,
      );
    } catch (error) {
      this.logger.error(
        `Error embedding RAG chunks for source "${sourceId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.sourceProcessingStageService
        .transition(
          sourceId,
          SourceProcessingStageType.RAG_INDEXING,
          ProcessingState.FAILED,
          { error },
        )
        .catch((stageUpdateError: unknown) => {
          this.logger.error(
            `Failed to record RAG indexing failure for source "${sourceId}"`,
            stageUpdateError instanceof Error
              ? stageUpdateError.stack
              : undefined,
          );
        });

      throw error;
    }
  }

  private embeddingInput(sourceName: string, chunk: EmbeddingChunk): string {
    const context = [`Source: ${sourceName}`];

    if (chunk.headingPath.length > 0) {
      context.push(`Section: ${chunk.headingPath.join(' > ')}`);
    }

    const pageLocation = this.pageLocation(chunk.pageStart, chunk.pageEnd);
    if (pageLocation) {
      context.push(pageLocation);
    }

    return `${context.join('\n')}\n\n${chunk.content}`;
  }

  private pageLocation(
    pageStart: number | null,
    pageEnd: number | null,
  ): string | null {
    if (pageStart === null) {
      return null;
    }

    if (pageEnd === null || pageEnd === pageStart) {
      return `Page: ${pageStart}`;
    }

    return `Pages: ${pageStart}-${pageEnd}`;
  }
}
