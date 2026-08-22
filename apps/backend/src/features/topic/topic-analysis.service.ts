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
                new Set(
                  existingTopic.evidence.map((evidence) => evidence.content),
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

  private async processPages(pages: SourcePage[]): Promise<AnalysisChunk[]> {
    const analysisChunks: AnalysisChunk[] = [];
    for (const page of pages) {
      const chunks = await this.textProcessingService.chunkForAnalysis(
        page.content,
      );
      for (const chunk of chunks) {
        analysisChunks.push({
          content: chunk,
          pageNumber: page.pageNumber,
        });
      }
    }
    return analysisChunks;
  }

  private collectEvidence(
    candidates: TopicCandidate[],
    candidateIndexes: number[],
    excludedContent: Set<string> = new Set(),
  ): { content: string }[] {
    const evidenceByContent = new Map<string, { content: string }>();

    for (const candidateIndex of candidateIndexes) {
      const candidate = candidates[candidateIndex];
      if (!candidate) {
        throw new Error(
          `Topic reconciliation referenced unknown candidate index ${candidateIndex}`,
        );
      }

      for (const fact of candidate.facts) {
        if (!excludedContent.has(fact.content)) {
          evidenceByContent.set(fact.content, { content: fact.content });
        }
      }
    }

    return [...evidenceByContent.values()];
  }
}
