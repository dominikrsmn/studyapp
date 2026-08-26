import { Injectable, Logger } from '@nestjs/common';
import type { NodeItem } from '@docling/docling-core';
import {
  ProcessingState,
  SourceProcessingStageType,
  TopicState,
} from '../../../../infrastructure/database/generated/enums';
import type { Prisma } from '../../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { parseAnalysisDocument } from '../analysis-document.schema';
import { AnalysisQueue } from '../analysis.queue';
import { FinalizeTopicAnalysis } from '../analysis.types';
import { documentUnitContent } from './detect-boundaries.job';
import {
  pageRange,
  resolveTopicSpans,
  type ResolvedTopicSpan,
} from './extract-source-topics.job';

const finalSourceTopicSelect = {
  id: true,
  spanIndex: true,
  title: true,
  description: true,
  detectionConfidence: true,
  canonicalizationConfidence: true,
  startRef: true,
  endRef: true,
  pageStart: true,
  pageEnd: true,
  topic: {
    select: {
      id: true,
      state: true,
      moduleId: true,
      contentRevision: true,
      summaryRevision: true,
    },
  },
  evidence: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      content: true,
      spans: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          content: true,
          startRef: true,
          endRef: true,
          pageStart: true,
          pageEnd: true,
        },
      },
    },
  },
} satisfies Prisma.SourceTopicSelect;

type FinalSourceTopic = Prisma.SourceTopicGetPayload<{
  select: typeof finalSourceTopicSelect;
}>;

type TopicSummaryRevision = {
  id: string;
  contentRevision: number;
};

@Injectable()
export class FinalizeTopicAnalysisJob {
  private readonly logger = new Logger(FinalizeTopicAnalysisJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
    private readonly analysisQueue: AnalysisQueue,
  ) {}

  async process({ sourceId }: FinalizeTopicAnalysis): Promise<void> {
    let sourceFound = false;
    let analysisAlreadyCompleted = false;

    try {
      const summaryRevisions = await this.prismaService.$transaction(
        async (transaction) => {
          const source = await this.loadSource(transaction, sourceId);
          if (!source) {
            return null;
          }

          sourceFound = true;
          if (source.processingStages[0]?.state === ProcessingState.COMPLETED) {
            analysisAlreadyCompleted = true;
            return [];
          }

          return validateFinalTopicAnalysis(
            source.document,
            source.moduleId,
            source.sourceTopics,
          );
        },
      );

      if (summaryRevisions === null) {
        this.logger.warn(
          `Skipping finalize-topic-analysis job because source "${sourceId}" no longer exists`,
        );
        return;
      }
      if (analysisAlreadyCompleted) {
        this.logger.log(
          `Skipping finalize-topic-analysis job because source "${sourceId}" is already complete`,
        );
        return;
      }

      await Promise.all(
        summaryRevisions.map(({ id, contentRevision }) =>
          this.analysisQueue.addSummarizeTopic(id, contentRevision),
        ),
      );

      await this.prismaService.$transaction(async (transaction) => {
        const source = await this.loadSource(transaction, sourceId);
        if (!source) {
          this.logger.warn(
            `Skipping completion because source "${sourceId}" was deleted while topic analysis was finalizing`,
          );
          return;
        }

        const currentSummaryRevisions = validateFinalTopicAnalysis(
          source.document,
          source.moduleId,
          source.sourceTopics,
        );
        assertSummaryJobsScheduled(summaryRevisions, currentSummaryRevisions);

        await this.sourceProcessingStageService.transition(
          sourceId,
          SourceProcessingStageType.TOPIC_ANALYSIS,
          ProcessingState.COMPLETED,
          { transaction },
        );
      });
    } catch (error) {
      this.logger.error(
        `Error finalizing topic analysis for source "${sourceId}": ${error}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (sourceFound) {
        await this.recordFailureUnlessCompleted(sourceId, error).catch(
          (stageUpdateError: unknown) => {
            this.logger.error(
              `Failed to record topic analysis failure for source "${sourceId}"`,
              stageUpdateError instanceof Error
                ? stageUpdateError.stack
                : undefined,
            );
          },
        );
      }

      throw error;
    }
  }

  private loadSource(transaction: Prisma.TransactionClient, sourceId: string) {
    return transaction.source.findUnique({
      where: { id: sourceId },
      select: {
        document: true,
        moduleId: true,
        processingStages: {
          where: { stage: SourceProcessingStageType.TOPIC_ANALYSIS },
          select: { state: true },
          take: 1,
        },
        sourceTopics: {
          orderBy: { spanIndex: 'asc' },
          select: finalSourceTopicSelect,
        },
      },
    });
  }

  private async recordFailureUnlessCompleted(
    sourceId: string,
    error: unknown,
  ): Promise<void> {
    const processingStage =
      await this.prismaService.sourceProcessingStage.findUnique({
        where: {
          sourceId_stage: {
            sourceId,
            stage: SourceProcessingStageType.TOPIC_ANALYSIS,
          },
        },
        select: { state: true },
      });

    if (processingStage?.state === ProcessingState.COMPLETED) {
      this.logger.warn(
        `Preserving completed topic analysis for source "${sourceId}" after a later finalization failure`,
      );
      return;
    }

    await this.sourceProcessingStageService.transition(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error },
    );
  }
}

export function validateFinalTopicAnalysis(
  storedDocument: unknown,
  sourceModuleId: string,
  sourceTopics: FinalSourceTopic[],
): TopicSummaryRevision[] {
  if (sourceTopics.length === 0) {
    throw new Error('Final topic analysis contains no SourceTopics');
  }

  const document = parseAnalysisDocument(storedDocument);
  const resolvedTopicSpans = resolveTopicSpans(
    document,
    sourceTopics.map(({ spanIndex, startRef, endRef }) => {
      if (startRef === null || endRef === null) {
        throw new Error(
          `SourceTopic span ${spanIndex} has unresolved boundary references`,
        );
      }
      return { spanIndex, startRef, endRef };
    }),
  );

  const summaryRevisions = new Map<string, TopicSummaryRevision>();
  sourceTopics.forEach((sourceTopic, index) => {
    validateSourceTopic(sourceTopic, resolvedTopicSpans[index]);

    const topic = sourceTopic.topic;
    if (!topic) {
      throw new Error(
        `SourceTopic "${sourceTopic.id}" has not been canonicalized`,
      );
    }
    if (topic.moduleId !== sourceModuleId) {
      throw new Error(
        `SourceTopic "${sourceTopic.id}" is canonicalized outside its module`,
      );
    }
    if (
      !isRevision(topic.contentRevision) ||
      (topic.summaryRevision !== null &&
        (!isRevision(topic.summaryRevision) ||
          topic.summaryRevision > topic.contentRevision))
    ) {
      throw new Error(`Topic "${topic.id}" has invalid revision metadata`);
    }

    if (
      topic.state !== TopicState.REJECTED &&
      topic.summaryRevision !== topic.contentRevision
    ) {
      summaryRevisions.set(topic.id, {
        id: topic.id,
        contentRevision: topic.contentRevision,
      });
    }
  });

  return [...summaryRevisions.values()];
}

function validateSourceTopic(
  sourceTopic: FinalSourceTopic,
  resolvedSpan: ResolvedTopicSpan | undefined,
): void {
  if (!resolvedSpan || resolvedSpan.spanIndex !== sourceTopic.spanIndex) {
    throw new Error('SourceTopic span indexes are not contiguous and ordered');
  }
  if (
    sourceTopic.title.trim().length === 0 ||
    sourceTopic.description.trim().length === 0 ||
    !isConfidence(sourceTopic.detectionConfidence)
  ) {
    throw new Error(`SourceTopic "${sourceTopic.id}" is not final`);
  }
  if (!isConfidence(sourceTopic.canonicalizationConfidence)) {
    throw new Error(
      `SourceTopic "${sourceTopic.id}" has invalid canonicalization confidence`,
    );
  }
  assertPageRange(`SourceTopic "${sourceTopic.id}"`, sourceTopic, resolvedSpan);
  if (sourceTopic.evidence.length === 0) {
    throw new Error(`SourceTopic "${sourceTopic.id}" has no evidence`);
  }

  const indexesByRef = new Map(
    resolvedSpan.refs.map((ref, refIndex) => [ref, refIndex]),
  );
  for (const evidence of sourceTopic.evidence) {
    if (evidence.content.trim().length === 0 || evidence.spans.length === 0) {
      throw new Error(`TopicEvidence "${evidence.id}" is not grounded`);
    }

    let previousEndIndex = -1;
    for (const evidenceSpan of evidence.spans) {
      const { startRef, endRef } = evidenceSpan;
      if (startRef === null || endRef === null) {
        throw new Error(
          `TopicEvidenceSpan "${evidenceSpan.id}" has unresolved references`,
        );
      }
      const startIndex = indexesByRef.get(startRef);
      const endIndex = indexesByRef.get(endRef);
      if (
        startIndex === undefined ||
        endIndex === undefined ||
        endIndex < startIndex ||
        startIndex <= previousEndIndex
      ) {
        throw new Error(
          `TopicEvidenceSpan "${evidenceSpan.id}" is outside its SourceTopic or out of order`,
        );
      }
      previousEndIndex = endIndex;

      const units = resolvedSpan.units.slice(startIndex, endIndex + 1);
      const canonicalContent = groundedContent(units);
      if (!canonicalContent || evidenceSpan.content !== canonicalContent) {
        throw new Error(
          `TopicEvidenceSpan "${evidenceSpan.id}" does not match canonical source content`,
        );
      }
      assertPageRange(
        `TopicEvidenceSpan "${evidenceSpan.id}"`,
        evidenceSpan,
        pageRange(units),
      );
    }
  }
}

function groundedContent(units: NodeItem[]): string {
  return units
    .map(documentUnitContent)
    .filter((content) => content.length > 0)
    .join('\n\n');
}

function assertPageRange(
  label: string,
  stored: { pageStart: number | null; pageEnd: number | null },
  resolved: { pageStart: number | null; pageEnd: number | null },
): void {
  if (
    stored.pageStart !== resolved.pageStart ||
    stored.pageEnd !== resolved.pageEnd
  ) {
    throw new Error(`${label} has an invalid page range`);
  }
}

function isConfidence(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRevision(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

function assertSummaryJobsScheduled(
  scheduled: TopicSummaryRevision[],
  required: TopicSummaryRevision[],
): void {
  const scheduledKeys = new Set(
    scheduled.map(({ id, contentRevision }) => `${id}:${contentRevision}`),
  );
  if (
    required.some(
      ({ id, contentRevision }) =>
        !scheduledKeys.has(`${id}:${contentRevision}`),
    )
  ) {
    throw new Error('Affected Topic revisions changed before completion');
  }
}
