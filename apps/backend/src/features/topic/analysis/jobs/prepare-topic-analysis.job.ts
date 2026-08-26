import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { DoclingDocument, NodeItem } from 'docling-sdk';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import { AnalysisQueue } from '../analysis.queue';
import { PrepareTopicAnalysis } from '../analysis.types';

@Injectable()
export class PrepareTopicAnalysisJob {
  private readonly logger = new Logger(PrepareTopicAnalysisJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly analysisQueue: AnalysisQueue,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
    @Inject(analysisConfig.KEY)
    private readonly config: ConfigType<typeof analysisConfig>,
  ) {}

  async process({ sourceId }: PrepareTopicAnalysis): Promise<void> {
    let analysisStarted = false;

    try {
      const source = await this.prismaService.source.findUnique({
        where: { id: sourceId },
        select: { document: true },
      });

      if (!source) {
        this.logger.warn(
          `Skipping prepare-topic-analysis job because source "${sourceId}" no longer exists`,
        );
        return;
      }

      await this.sourceProcessingStageService.transition(
        sourceId,
        SourceProcessingStageType.TOPIC_ANALYSIS,
        ProcessingState.PROCESSING,
      );
      analysisStarted = true;

      if (source.document === null) {
        throw new Error('Source has no converted Docling document');
      }

      const document = source.document as unknown as DoclingDocument;
      const unitRefs = deriveOrderedAnalysisUnitRefs(document);
      if (unitRefs.length === 0) {
        throw new Error('Source document contains no analysis units');
      }

      const windows: string[][] = [];

      const stride =
        this.config.boundaryDetection.windowSize -
        this.config.boundaryDetection.windowOverlap;

      for (let start = 0; start < unitRefs.length; start += stride) {
        const window = unitRefs.slice(
          start,
          start + this.config.boundaryDetection.windowSize,
        );
        windows.push(window);

        if (
          start + this.config.boundaryDetection.windowSize >=
          unitRefs.length
        ) {
          break;
        }
      }

      await this.analysisQueue.addBoundaryDetectionFlow(sourceId, windows);
    } catch (error) {
      this.logger.error(
        `Error preparing topic analysis for source "${sourceId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (analysisStarted) {
        await this.sourceProcessingStageService
          .transition(
            sourceId,
            SourceProcessingStageType.TOPIC_ANALYSIS,
            ProcessingState.FAILED,
            { error },
          )
          .catch((stageUpdateError: unknown) => {
            this.logger.error(
              `Failed to record topic analysis failure for source "${sourceId}"`,
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

export function deriveOrderedAnalysisUnitRefs(
  document: DoclingDocument,
): string[] {
  const pending: NodeItem[] = [...(document.main_text ?? [])].reverse();
  const unitRefs: string[] = [];

  while (pending.length > 0) {
    const item = pending.pop()!;

    if (item.self_ref) {
      unitRefs.push(item.self_ref);
    }

    if (item.children) {
      pending.push(...[...item.children].reverse());
    }
  }

  return unitRefs;
}
