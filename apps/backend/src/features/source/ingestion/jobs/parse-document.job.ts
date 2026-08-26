import { Injectable, Logger } from '@nestjs/common';
import { ParseDocumentJobData } from '../ingestion.types';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { DoclingService } from '../../../../infrastructure/docling/docling.service';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { IngestionQueue } from '../ingestion.queue';
import { Prisma } from '../../../../infrastructure/database/generated/client';
import { SourceProcessingStageService } from '../source-processing-stage.service';
import { ConvertDocumentResponse, DoclingDocument } from 'docling-sdk';

@Injectable()
export class ParseDocumentJob {
  private readonly logger = new Logger(ParseDocumentJob.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly doclingService: DoclingService,
    private readonly prismaService: PrismaService,
    private readonly ingestionQueue: IngestionQueue,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
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
        this.logger.warn(
          `Skipping parse-document job because source "${sourceId}" no longer exists`,
        );

        return;
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

      await this.sourceProcessingStageService.transition(
        sourceId,
        SourceProcessingStageType.CONVERSION,
        ProcessingState.PROCESSING,
      );

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

      const document = JSON.parse(
        JSON.stringify(jsonContent),
      ) as Prisma.InputJsonValue;

      if (!document) {
        throw new Error('Document conversion returned invalid JSON content');
      }

      await this.prismaService.$transaction(async (transaction) => {
        await transaction.source.update({
          where: {
            id: sourceId,
          },
          data: {
            document,
          },
        });

        await this.sourceProcessingStageService.transition(
          sourceId,
          SourceProcessingStageType.CONVERSION,
          ProcessingState.COMPLETED,
          { transaction },
        );
      });

      conversionCompleted = true;
      await this.ingestionQueue.addBuildRagChunks(sourceId);
    } catch (error) {
      this.logger.error(
        `Error parsing document "${sourceId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (!conversionCompleted) {
        await this.sourceProcessingStageService
          .transition(
            sourceId,
            SourceProcessingStageType.CONVERSION,
            ProcessingState.FAILED,
            { error },
          )
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
