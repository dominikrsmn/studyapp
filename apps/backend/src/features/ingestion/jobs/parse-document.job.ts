import { Injectable, Logger } from '@nestjs/common';
import { ParseDocumentJobData } from '../ingestion.types';
import { FileStorageService } from '../../../infrastructure/filestorage/filestorage.service';
import { DoclingService } from '../../../infrastructure/docling/docling.service';
import type { ConvertDocumentResponse, DoclingDocument } from 'docling-sdk';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import { IngestionQueue } from '../ingestion.queue';

@Injectable()
export class ParseDocumentJob {
  private readonly logger = new Logger(ParseDocumentJob.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly doclingService: DoclingService,
    private readonly prismaService: PrismaService,
    private readonly ingestionQueue: IngestionQueue,
  ) {}

  async process({ sourceId }: ParseDocumentJobData): Promise<void> {
    let conversionCompleted = false;

    try {
      const source = await this.prismaService.source.findUnique({
        where: { id: sourceId },
        select: {
          document: true,
          processingStages: {
            where: { stage: SourceProcessingStageType.CONVERSION },
            select: { state: true },
            take: 1,
          },
        },
      });

      if (!source) {
        throw new Error(`Source "${sourceId}" does not exist`);
      }

      const conversionStage = source.processingStages[0];
      if (
        conversionStage?.state === ProcessingState.COMPLETED &&
        source.document !== null
      ) {
        conversionCompleted = true;
        await this.ingestionQueue.addBuildRagChunks(sourceId);
        return;
      }

      await this.prismaService.sourceProcessingStage.upsert({
        where: {
          sourceId_stage: {
            sourceId,
            stage: SourceProcessingStageType.CONVERSION,
          },
        },
        create: {
          sourceId,
          stage: SourceProcessingStageType.CONVERSION,
          state: ProcessingState.PROCESSING,
          startedAt: new Date(),
        },
        update: {
          state: ProcessingState.PROCESSING,
          startedAt: new Date(),
          completedAt: null,
          errorMessage: null,
        },
      });

      const conversion: ConvertDocumentResponse =
        await this.doclingService.client.convertFromFile(
          this.fileStorageService.getSourcePath(sourceId),
          {
            to_formats: ['json'],
            abort_on_error: true,
          },
        );

      const jsonContent = conversion?.document?.json_content as
        DoclingDocument | null | undefined;
      if (!jsonContent) {
        throw new Error('Document conversion returned no JSON content');
      }

      const document = JSON.stringify(jsonContent);
      if (!document) {
        throw new Error('Document conversion returned invalid JSON content');
      }

      await this.prismaService.$transaction([
        this.prismaService.source.update({
          where: {
            id: sourceId,
          },
          data: {
            document,
          },
        }),

        this.prismaService.sourceProcessingStage.update({
          where: {
            sourceId_stage: {
              sourceId,
              stage: SourceProcessingStageType.CONVERSION,
            },
          },
          data: {
            state: ProcessingState.COMPLETED,
            completedAt: new Date(),
            errorMessage: null,
          },
        }),
      ]);

      conversionCompleted = true;
      await this.ingestionQueue.addBuildRagChunks(sourceId);
    } catch (error) {
      this.logger.error(
        `Error parsing document "${sourceId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (!conversionCompleted) {
        await this.prismaService.sourceProcessingStage
          .updateMany({
            where: {
              sourceId,
              stage: SourceProcessingStageType.CONVERSION,
              state: ProcessingState.PROCESSING,
            },
            data: {
              state: ProcessingState.FAILED,
              completedAt: new Date(),
              error,
            },
          })
          .catch((stageUpdateError: unknown) => {
            this.logger.error(
              `Failed to record conversion failure for source "${sourceId}"`,
              stageUpdateError instanceof Error
                ? stageUpdateError.stack
                : undefined,
            );
          });
      }

      throw error;
    }
  }

}
