import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { embeddingConfig } from '../../../../infrastructure/config/embedding.config';
import { Prisma } from '../../../../infrastructure/database/generated/client';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { OpenAiService } from '../../../../infrastructure/open-ai/open-ai.service';
import { EmbedRagChunksJobData } from '../ingestion.types';
import { SourceProcessingStageService } from '../source-processing-stage.service';

type EmbeddingChunk = {
  id: string;
  chunkIndex: number;
  content: string;
  headingPath: string[];
  pageStart: number | null;
  pageEnd: number | null;
};

@Injectable()
export class EmbedRagChunksJob {
  private readonly logger = new Logger(EmbedRagChunksJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
    @Inject(embeddingConfig.KEY)
    private readonly embedding: ConfigType<typeof embeddingConfig>,
  ) {}

  async process({ sourceId, chunkIds }: EmbedRagChunksJobData): Promise<void> {
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
        `Skipping embed-rag-chunks job because source "${sourceId}" no longer exists`,
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

      if (chunks.length > 0) {
        const response = await this.openAiService.client.embeddings.create({
          model: this.embedding.model,
          encoding_format: this.embedding.encodingFormat,
          input: chunks.map((chunk) => this.embeddingInput(source.name, chunk)),
        });
        const vectors = this.vectorsInInputOrder(response.data, chunks.length);
        const embeddingRows = chunks.map((chunk, index) => {
          const vector = `[${vectors[index].join(',')}]`;

          return Prisma.sql`(${chunk.id}::uuid, ${vector}::vector)`;
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
      }
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

  private vectorsInInputOrder(
    data: { index: number; embedding: number[] }[],
    expectedCount: number,
  ): number[][] {
    if (data.length !== expectedCount) {
      throw new Error(
        `Embedding API returned ${data.length} vectors for ${expectedCount} chunks`,
      );
    }

    const vectors: Array<number[] | undefined> = Array(expectedCount);
    for (const result of data) {
      if (
        !Number.isInteger(result.index) ||
        result.index < 0 ||
        result.index >= expectedCount ||
        vectors[result.index] !== undefined ||
        result.embedding.length === 0 ||
        result.embedding.some((value) => !Number.isFinite(value))
      ) {
        throw new Error('Embedding API returned invalid vector data');
      }

      vectors[result.index] = result.embedding;
    }

    if (vectors.some((vector) => vector === undefined)) {
      throw new Error('Embedding API returned incomplete vector data');
    }

    return vectors as number[][];
  }
}
