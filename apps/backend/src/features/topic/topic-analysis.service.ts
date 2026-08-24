import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SourceStateChangedEvent,
  sourceStateChangedEventSchema,
} from '@study/contracts';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';
import type { SourcePage } from '../../infrastructure/database/generated/client';
import { sourceConfig } from '../source/source.config';
import {
  AnalysisChunk,
  ModuleTopic,
  TopicCandidate,
  TopicMerging,
} from './topic.types';
import { TopicCandidateExtractionService } from './topic-candidate-extraction/topic-candidate-extraction.service';
import { TopicCandidateGroupingService } from './topic-candidate-grouping/topic-candidate-grouping.service';
import { TopicMergingService } from './topic-merging/topic-merging.service';
import { TopicSummaryGenerationService } from './topic-summary-generation/topic-summary-generation.service';

const TOPIC_PERSISTENCE_TIMEOUT_MS = 60_000;

@Injectable()
export class TopicAnalysisService {
  private readonly logger = new Logger(TopicAnalysisService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly textProcessingService: TextProcessingService,
    private readonly candidateExtractionService: TopicCandidateExtractionService,
    private readonly candidateConsolidationService: TopicCandidateGroupingService,
    private readonly topicMergingService: TopicMergingService,
    private readonly topicSummaryGenerationService: TopicSummaryGenerationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async analyze(sourceId: string): Promise<void> {
    const source = await this.prismaService.source.update({
      where: { id: sourceId },
      data: { status: 'PROCESSING' },
      select: { moduleId: true },
    });
    const moduleId = source.moduleId;
    this.emitProgress(sourceId, moduleId, 'Preparing topic analysis…');

    try {
      await this.analyzeTopics(sourceId, moduleId);
    } catch (error) {
      await this.markFailed(sourceId, moduleId);
      throw error;
    }
  }

  private async analyzeTopics(
    sourceId: string,
    moduleId: string,
  ): Promise<void> {
    this.logger.log(`Loading source pages (sourceId="${sourceId}")`);
    const pages = await this.prismaService.sourcePage.findMany({
      where: {
        sourceId: sourceId,
      },
      orderBy: {
        pageNumber: 'asc',
      },
    });
    if (!pages.length) {
      throw new NotFoundException(`Source Pages were not found`);
    }

    const analysisChunks: AnalysisChunk[] = await this.processPages(pages);
    this.logger.log(
      `Starting topic extraction (sourceId="${sourceId}", pages=${pages.length}, chunks=${analysisChunks.length})`,
    );
    this.emitProgress(sourceId, moduleId, 'Extracting topics…');

    const topicCandidates: TopicCandidate[] =
      await this.candidateExtractionService.extract(analysisChunks);
    this.logger.log(
      `Topic extraction completed; starting grouping (sourceId="${sourceId}", candidates=${topicCandidates.length})`,
    );
    this.emitProgress(sourceId, moduleId, 'Grouping related topics…');

    const finalTopicCandidates: TopicCandidate[] =
      await this.candidateConsolidationService.group(topicCandidates);
    this.logger.log(
      `Topic grouping completed; loading existing topics (sourceId="${sourceId}", groupedCandidates=${finalTopicCandidates.length})`,
    );

    const moduleTopics: ModuleTopic[] = await this.prismaService.topic.findMany(
      {
        where: {
          module: {
            sources: {
              some: {
                id: sourceId,
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          summary: true,
          description: true,
          evidence: {
            select: {
              id: true,
              content: true,
              provenance: {
                select: {
                  analysisChunkId: true,
                },
              },
            },
          },
        },
      },
    );
    this.logger.log(
      `Existing topics loaded; starting topic merging (sourceId="${sourceId}", groupedCandidates=${finalTopicCandidates.length}, existingTopics=${moduleTopics.length})`,
    );
    this.emitProgress(sourceId, moduleId, 'Merging topics into your module…');

    const topicResults: TopicMerging = await this.topicMergingService.merge(
      finalTopicCandidates,
      moduleTopics,
    );
    this.logger.log(
      `Topic merging completed; starting summary generation (sourceId="${sourceId}", existingTopicMatches=${topicResults.existingTopicMatches.length}, newTopics=${topicResults.newTopics.length})`,
    );
    this.emitProgress(sourceId, moduleId, 'Generating topic summaries…');

    const chunksById = new Map(
      analysisChunks.map((chunk) => [chunk.id, chunk]),
    );
    const moduleTopicsById = new Map(
      moduleTopics.map((topic) => [topic.id, topic]),
    );

    const summaryInputs = [
      ...topicResults.existingTopicMatches.map(
        ({ topicId, candidateIndexes }) => {
          const existingTopic = moduleTopicsById.get(topicId);
          if (!existingTopic) {
            throw new Error(
              `Topic merging referenced unknown topic "${topicId}"`,
            );
          }

          return {
            title: existingTopic.title,
            description: existingTopic.description,
            evidence: this.collectSummaryEvidence(
              finalTopicCandidates,
              candidateIndexes,
              existingTopic.evidence,
            ),
          };
        },
      ),
      ...topicResults.newTopics.map(
        ({ title, description, candidateIndexes }) => ({
          title,
          description,
          evidence: this.collectSummaryEvidence(
            finalTopicCandidates,
            candidateIndexes,
          ),
        }),
      ),
    ];
    const summaries = await Promise.all(
      summaryInputs.map((topic) =>
        this.topicSummaryGenerationService.generate(topic),
      ),
    );
    const existingTopicSummaries = summaries.slice(
      0,
      topicResults.existingTopicMatches.length,
    );
    const newTopicSummaries = summaries.slice(
      topicResults.existingTopicMatches.length,
    );
    this.logger.log(
      `Topic summary generation completed; persisting results (sourceId="${sourceId}", summaries=${summaries.length})`,
    );
    this.emitProgress(sourceId, moduleId, 'Saving topic analysis…');

    const updateOperations = topicResults.existingTopicMatches.map(
      ({ topicId, candidateIndexes }, index) => {
        const existingTopic = moduleTopicsById.get(topicId);
        if (!existingTopic) {
          throw new Error(
            `Topic merging referenced unknown topic "${topicId}"`,
          );
        }

        return this.prismaService.topic.update({
          where: {
            id: topicId,
            moduleId,
          },
          data: {
            summary: existingTopicSummaries[index],
            evidence: {
              create: this.collectEvidence(
                finalTopicCandidates,
                candidateIndexes,
                chunksById,
                new Set(
                  existingTopic.evidence.flatMap((evidence) =>
                    evidence.provenance.map(
                      ({ analysisChunkId }) =>
                        `${evidence.content}\u0000${analysisChunkId}`,
                    ),
                  ),
                ),
              ),
            },
          },
        });
      },
    );

    const createOperations = topicResults.newTopics.map(
      ({ title, description, candidateIndexes }, index) =>
        this.prismaService.topic.create({
          data: {
            title,
            description,
            summary: newTopicSummaries[index],
            moduleId,
            evidence: {
              create: this.collectEvidence(
                finalTopicCandidates,
                candidateIndexes,
                chunksById,
              ),
            },
          },
        }),
    );

    await this.prismaService.$transaction(
      [
        ...updateOperations,
        ...createOperations,
        this.prismaService.source.update({
          where: { id: sourceId },
          data: { status: 'PROCESSED' },
        }),
      ],
      { timeout: TOPIC_PERSISTENCE_TIMEOUT_MS },
    );
    this.emitStateChange(sourceId, moduleId, 'PROCESSED');
    this.logger.log(`Topic analysis persisted (sourceId="${sourceId}")`);
  }

  private emitProgress(sourceId: string, moduleId: string, info: string): void {
    this.emitStateChange(sourceId, moduleId, 'PROCESSING', info);
  }

  private emitStateChange(
    sourceId: string,
    moduleId: string,
    processingState: SourceStateChangedEvent['processingState'],
    info?: string,
  ): void {
    const event = sourceStateChangedEventSchema.parse({
      sourceId,
      moduleId,
      processingState,
      ...(info ? { info } : {}),
    });
    this.eventEmitter.emit(sourceConfig().stateChangedEventName, event);
  }

  private async markFailed(sourceId: string, moduleId: string): Promise<void> {
    try {
      await this.prismaService.source.updateMany({
        where: { id: sourceId },
        data: { status: 'FAILED' },
      });
      this.emitStateChange(sourceId, moduleId, 'FAILED');
    } catch (error) {
      this.logger.error(
        `Failed to mark source "${sourceId}" as failed`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private collectSummaryEvidence(
    candidates: TopicCandidate[],
    candidateIndexes: number[],
    existingEvidence: Array<{ content: string }> = [],
  ): Array<{ content: string }> {
    const evidenceContents = new Set(
      existingEvidence.map((evidence) => evidence.content),
    );

    for (const candidateIndex of candidateIndexes) {
      const candidate = candidates[candidateIndex];
      if (!candidate) {
        throw new Error(
          `Topic merging referenced unknown candidate index ${candidateIndex}`,
        );
      }

      for (const fact of candidate.facts) {
        evidenceContents.add(fact.content);
      }
    }

    return [...evidenceContents].map((content) => ({ content }));
  }

  private processPages(pages: SourcePage[]): AnalysisChunk[] {
    const analysisChunks: AnalysisChunk[] = [];
    for (const page of pages) {
      const chunks = this.textProcessingService.chunkForAnalysis(page.content);
      for (const [chunkIndex, chunk] of chunks.entries()) {
        analysisChunks.push({
          id: [
            'analysis-chunk:v1',
            page.sourceId,
            `page:${page.pageNumber}`,
            `chunk:${chunkIndex}`,
            `offsets:${chunk.startOffset}-${chunk.endOffset}`,
          ].join(':'),
          content: chunk.content,
          sourceId: page.sourceId,
          sourcePageId: page.id,
          pageNumber: page.pageNumber,
          chunkIndex,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
        });
      }
    }
    return analysisChunks;
  }

  private collectEvidence(
    candidates: TopicCandidate[],
    candidateIndexes: number[],
    chunksById: Map<string, AnalysisChunk>,
    excludedReferences: Set<string> = new Set(),
  ) {
    const evidenceByContent = new Map<string, Map<string, AnalysisChunk>>();

    for (const candidateIndex of candidateIndexes) {
      const candidate = candidates[candidateIndex];
      if (!candidate) {
        throw new Error(
          `Topic merging referenced unknown candidate index ${candidateIndex}`,
        );
      }

      for (const fact of candidate.facts) {
        const chunksForFact = evidenceByContent.get(fact.content) ?? new Map();
        for (const chunkId of fact.chunkIds) {
          const chunk = chunksById.get(chunkId);
          if (!chunk) {
            throw new Error(
              `Topic evidence referenced unknown analysis chunk ID "${chunkId}"`,
            );
          }

          if (!excludedReferences.has(`${fact.content}\u0000${chunkId}`)) {
            chunksForFact.set(chunkId, chunk);
          }
        }
        if (chunksForFact.size > 0) {
          evidenceByContent.set(fact.content, chunksForFact);
        }
      }
    }

    return [...evidenceByContent].map(([content, chunks]) => ({
      content,
      provenance: {
        create: [...chunks.values()].map((chunk) => ({
          analysisChunkId: chunk.id,
          sourceId: chunk.sourceId,
          sourcePageId: chunk.sourcePageId,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
          content: chunk.content,
        })),
      },
    }));
  }
}
