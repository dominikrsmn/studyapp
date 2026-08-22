import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';
import { SourcePage } from '../../infrastructure/database/generated/client';
import { AnalysisChunk, TopicCandidate } from './topic.types';
import { TopicCandidateExtractionService } from './topic-candidate-extractor/topic-candidate-extraction.service';
import { TopicCandidateConsolidationService } from './topic-candidate-consolidator/topic-candidate-consolidation.service';

@Injectable()
export class TopicAnalysisService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly textProcessingService: TextProcessingService,
    private readonly candidateExtractionService: TopicCandidateExtractionService,
    private readonly candidateConsolidationService: TopicCandidateConsolidationService
  ) {}

  async analyze(sourceId: string): Promise<void> {
    try {
      const pages = await this.prismaService.sourcePage.findMany({
        where: {
          sourceId: sourceId,
        },
      });
      if (!pages.length) {
        throw new NotFoundException(`Source Pages were not found`);
      }

      const analysisChunks: AnalysisChunk[] = await this.processPages(pages);

      const topicCandidates: TopicCandidate[] =
        await this.candidateExtractionService.extract(analysisChunks);

      const finalTopicCandidates: TopicCandidate[] = this.
    } catch (error) {
      throw error;
    }
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
}
