import { Injectable, Logger } from '@nestjs/common';
import type { NodeItem } from '@docling/docling-core';
import type { Prisma } from '../../../../infrastructure/database/generated/client';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { parseAnalysisDocument } from '../analysis-document.schema';
import { FinalizeTopicAnalysis } from '../analysis.types';
import { documentUnitContent } from './detect-boundaries.job';
import {
  pageRange,
  type ResolvedTopicSpan,
  resolveTopicSpans,
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
      moduleId: true,
    },
  },
  evidence: {
    select: {
      id: true,
      content: true,
      spans: {
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

@Injectable()
export class FinalizeTopicAnalysisJob {
  private readonly logger = new Logger(FinalizeTopicAnalysisJob.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
  ) {}

  async process({ sourceId }: FinalizeTopicAnalysis): Promise<void> {
    const source = await this.prismaService.source.findUnique({
      where: { id: sourceId },
      select: {
        document: true,
        moduleId: true,
        sourceTopics: {
          orderBy: { spanIndex: 'asc' },
          select: finalSourceTopicSelect,
        },
      },
    });

    if (!source) {
      this.logger.warn(
        `Skipping finalize-topic-analysis because source "${sourceId}" no longer exists`,
      );
      return;
    }

    try {
      validateFinalTopicAnalysis(
        source.document,
        source.moduleId,
        source.sourceTopics,
      );

      await this.sourceProcessingStageService.transition(
        sourceId,
        SourceProcessingStageType.TOPIC_ANALYSIS,
        ProcessingState.COMPLETED,
      );
    } catch (error) {
      this.logger.error(
        `Error finalizing topic analysis for source "${sourceId}"`,
        error instanceof Error ? error.stack : undefined,
      );

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

      throw error;
    }
  }
}

export function validateFinalTopicAnalysis(
  storedDocument: unknown,
  sourceModuleId: string,
  sourceTopics: FinalSourceTopic[],
): void {
  const document = parseAnalysisDocument(storedDocument);

  const resolvedTopicSpans = resolveTopicSpans(
    document,
    sourceTopics.map(({ spanIndex, startRef, endRef }) => {
      if (startRef === null || endRef === null) {
        throw new Error(
          `SourceTopic span ${spanIndex} has unresolved boundary references`,
        );
      }

      return {
        spanIndex,
        startRef,
        endRef,
      };
    }),
  );

  sourceTopics.forEach((sourceTopic, index) => {
    validateSourceTopic(sourceTopic, resolvedTopicSpans[index]);

    if (!sourceTopic.topic) {
      throw new Error(
        `SourceTopic "${sourceTopic.id}" has not been canonicalized`,
      );
    }

    if (sourceTopic.topic.moduleId !== sourceModuleId) {
      throw new Error(
        `SourceTopic "${sourceTopic.id}" is canonicalized outside its module`,
      );
    }
  });
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
    sourceTopic.description.trim().length === 0
  ) {
    throw new Error(`SourceTopic "${sourceTopic.id}" is not final`);
  }

  if (!isConfidence(sourceTopic.detectionConfidence)) {
    throw new Error(
      `SourceTopic "${sourceTopic.id}" has invalid detection confidence`,
    );
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

  validateEvidence(sourceTopic, resolvedSpan);
}

function validateEvidence(
  sourceTopic: FinalSourceTopic,
  resolvedSpan: ResolvedTopicSpan,
): void {
  const indexesByRef = new Map(
    resolvedSpan.refs.map((ref, index) => [ref, index]),
  );

  for (const evidence of sourceTopic.evidence) {
    if (evidence.content.trim().length === 0 || evidence.spans.length === 0) {
      throw new Error(`TopicEvidence "${evidence.id}" is not grounded`);
    }

    const resolvedEvidenceSpans = evidence.spans.map((span) => {
      if (span.startRef === null || span.endRef === null) {
        throw new Error(
          `TopicEvidenceSpan "${span.id}" has unresolved references`,
        );
      }

      const startIndex = indexesByRef.get(span.startRef);
      const endIndex = indexesByRef.get(span.endRef);

      if (
        startIndex === undefined ||
        endIndex === undefined ||
        endIndex < startIndex
      ) {
        throw new Error(
          `TopicEvidenceSpan "${span.id}" is outside its SourceTopic`,
        );
      }

      return {
        span,
        startIndex,
        endIndex,
      };
    });

    resolvedEvidenceSpans.sort((a, b) => a.startIndex - b.startIndex);

    let previousEndIndex = -1;

    for (const { span, startIndex, endIndex } of resolvedEvidenceSpans) {
      if (startIndex <= previousEndIndex) {
        throw new Error(
          `TopicEvidenceSpan "${span.id}" overlaps another evidence span`,
        );
      }

      previousEndIndex = endIndex;

      const units = resolvedSpan.units.slice(startIndex, endIndex + 1);
      const canonicalContent = groundedContent(units);

      if (!canonicalContent || span.content !== canonicalContent) {
        throw new Error(
          `TopicEvidenceSpan "${span.id}" does not match canonical source content`,
        );
      }

      assertPageRange(`TopicEvidenceSpan "${span.id}"`, span, pageRange(units));
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
  stored: {
    pageStart: number | null;
    pageEnd: number | null;
  },
  resolved: {
    pageStart: number | null;
    pageEnd: number | null;
  },
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
