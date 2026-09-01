import { Injectable, Logger } from '@nestjs/common';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { AnalysisQueue } from '../../../topic/analysis/analysis.queue';
import { FinalizeIngestionJobData } from '../ingestion.types';
import { SourceProcessingStageService } from '../source-processing-stage.service';

type ChunkMissingEmbedding = {
  id: string;
};

@Injectable()
export class FinalizeIngestionJob {
  private readonly logger = new Logger(FinalizeIngestionJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
    private readonly analysisQueue: AnalysisQueue,
  ) {}

  async process({ sourceId }: FinalizeIngestionJobData): Promise<void> {
    let sourceFound = false;

    try {
      const source = await this.prismaService.source.findUnique({
        where: { id: sourceId },
        select: { id: true },
      });

      if (!source) {
        this.logger.warn(
          `Skipping finalize-ingestion job because source "${sourceId}" no longer exists`,
        );
        return;
      }

      sourceFound = true;

      if (!(await this.fileStorageService.hasDoclingDocument(sourceId))) {
        throw new Error('Source has no converted Docling document');
      }

      await this.prismaService.$transaction(async (transaction) => {
        const [chunkMissingEmbedding] = await transaction.$queryRaw<
          ChunkMissingEmbedding[]
        >`
          SELECT chunk."id"
          FROM "SourceChunk" AS chunk
          WHERE chunk."sourceId" = ${sourceId}
            AND chunk."embedding" IS NULL
          LIMIT 1
        `;

        if (chunkMissingEmbedding) {
          throw new Error(
            `Source chunk "${chunkMissingEmbedding.id}" has no embedding`,
          );
        }

        await this.sourceProcessingStageService.transition(
          sourceId,
          SourceProcessingStageType.RAG_INDEXING,
          ProcessingState.COMPLETED,
          { transaction },
        );
      });
    } catch (error) {
      this.logger.error(
        `Error finalizing RAG ingestion for source "${sourceId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (sourceFound) {
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
      }

      throw error;
    }

    if (sourceFound) {
      await this.analysisQueue.addPrepareTopicAnalysis(sourceId);
    }
  }
}
