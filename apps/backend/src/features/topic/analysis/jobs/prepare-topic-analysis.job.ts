import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import {
  AnalysisDocument,
  AnalysisDocumentUnit,
  parseAnalysisDocument,
} from '../analysis-document.schema';
import { AnalysisQueue } from '../analysis.queue';
import { AnalysisUnit, PrepareTopicAnalysis } from '../analysis.types';

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

      const document = parseAnalysisDocument(source.document);
      const analysisUnits = createBoundaryAnalysisUnits(
        document,
        this.config.boundaryDetection.windowSize,
        this.config.boundaryDetection.windowOverlap,
      );

      if (analysisUnits.length === 0) {
        throw new Error('Source document contains no analysis units');
      }

      await this.analysisQueue.addBoundaryDetectionFlow(
        sourceId,
        analysisUnits,
      );
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

export function createBoundaryAnalysisUnits(
  document: AnalysisDocument,
  windowSize: number,
  windowOverlap: number,
): AnalysisUnit[] {
  const documentUnitRefs = deriveOrderedDocumentUnitRefs(document);
  const analysisUnits: AnalysisUnit[] = [];
  const stride = windowSize - windowOverlap;

  for (let start = 0; start < documentUnitRefs.length; start += stride) {
    analysisUnits.push({
      index: analysisUnits.length,
      documentUnitRefs: documentUnitRefs.slice(start, start + windowSize),
    });

    if (start + windowSize >= documentUnitRefs.length) {
      break;
    }
  }

  return analysisUnits;
}

export function deriveOrderedDocumentUnitRefs(
  document: AnalysisDocument,
): string[] {
  const pending: AnalysisDocumentUnit[] = [
    ...(document.main_text ?? []),
  ].reverse();
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
