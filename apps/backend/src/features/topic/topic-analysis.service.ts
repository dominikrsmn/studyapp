import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';
import type { SourcePage } from '../../infrastructure/database/generated/client';
import {
  AnalysisChunk,
  ModuleTopic,
  TopicCandidate,
  TopicReconciliation,
} from './topic.types';
import { TopicCandidateExtractionService } from './topic-candidate-extractor/topic-candidate-extraction.service';
import { TopicCandidateConsolidationService } from './topic-candidate-consolidator/topic-candidate-consolidation.service';
import { TopicReconciliationService } from './topic-reconciler/topic-reconciliation.service';

@Injectable()
export class TopicAnalysisService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly textProcessingService: TextProcessingService,
    private readonly candidateExtractionService: TopicCandidateExtractionService,
    private readonly candidateConsolidationService: TopicCandidateConsolidationService,
    private readonly topicReconciliationService: TopicReconciliationService,
  ) {}

  async analyze(sourceId: string): Promise<void> {
    const pages = await this.prismaService.sourcePage.findMany({
      where: {
        sourceId: sourceId,
      },
      include: {
        source: {
          select: {
            moduleId: true,
          },
        },
      },
      orderBy: {
        pageNumber: 'asc',
      },
    });
    if (!pages.length) {
      throw new NotFoundException(`Source Pages were not found`);
    }

    const analysisChunks: AnalysisChunk[] = await this.processPages(pages);

    const topicCandidates: TopicCandidate[] =
      await this.candidateExtractionService.extract(analysisChunks);

    const finalTopicCandidates: TopicCandidate[] =
      await this.candidateConsolidationService.consolidate(topicCandidates);

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

    const topicResults: TopicReconciliation =
      await this.topicReconciliationService.reconcile(
        finalTopicCandidates,
        moduleTopics,
      );

    const moduleId = pages[0].source.moduleId;
    const chunksById = new Map(
      analysisChunks.map((chunk) => [chunk.id, chunk]),
    );
    const moduleTopicsById = new Map(
      moduleTopics.map((topic) => [topic.id, topic]),
    );

    const updateOperations = topicResults.existingTopicMatches.map(
      ({ topicId, candidateIndexes }) => {
        const existingTopic = moduleTopicsById.get(topicId);
        if (!existingTopic) {
          throw new Error(
            `Topic reconciliation referenced unknown topic "${topicId}"`,
          );
        }

        return this.prismaService.topic.update({
          where: {
            id: topicId,
            moduleId,
          },
          data: {
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
      ({ title, description, candidateIndexes }) =>
        this.prismaService.topic.create({
          data: {
            title,
            description,
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

    await this.prismaService.$transaction([
      ...updateOperations,
      ...createOperations,
    ]);
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
          `Topic reconciliation referenced unknown candidate index ${candidateIndex}`,
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
