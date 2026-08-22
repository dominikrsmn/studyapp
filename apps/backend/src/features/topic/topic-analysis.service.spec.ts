import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';
import { TopicAnalysisService } from './topic-analysis.service';
import { TopicCandidateExtractionService } from './topic-candidate-extractor/topic-candidate-extraction.service';
import { TopicCandidateConsolidationService } from './topic-candidate-consolidator/topic-candidate-consolidation.service';
import { TopicReconciliationService } from './topic-reconciler/topic-reconciliation.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('TopicAnalysisService', () => {
  const moduleId = 'f74a46b6-2d6d-4542-a9b8-37a8eef82d8c';
  const existingTopicId = '4d4a1598-d397-4033-bb23-f4b14488582c';
  const prismaService = {
    sourcePage: {
      findMany: jest.fn(),
    },
    topic: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const textProcessingService = {
    chunkForAnalysis: jest.fn(),
  };
  const candidateExtractionService = {
    extract: jest.fn(),
  };
  const candidateConsolidationService = {
    consolidate: jest.fn(),
  };
  const topicReconciliationService = {
    reconcile: jest.fn(),
  };
  const service = new TopicAnalysisService(
    prismaService as unknown as PrismaService,
    textProcessingService as unknown as TextProcessingService,
    candidateExtractionService as unknown as TopicCandidateExtractionService,
    candidateConsolidationService as unknown as TopicCandidateConsolidationService,
    topicReconciliationService as unknown as TopicReconciliationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prismaService.sourcePage.findMany.mockResolvedValue([
      {
        id: 'page-id',
        sourceId: 'source-id',
        pageNumber: 1,
        content: 'page content',
        createdAt: new Date(),
        source: { moduleId },
      },
    ]);
    textProcessingService.chunkForAnalysis.mockResolvedValue(['chunk']);
    candidateExtractionService.extract.mockResolvedValue([]);
    candidateConsolidationService.consolidate.mockResolvedValue([]);
    prismaService.topic.findMany.mockResolvedValue([]);
    prismaService.topic.update.mockResolvedValue({ id: existingTopicId });
    prismaService.topic.create.mockResolvedValue({ id: 'new-topic-id' });
    prismaService.$transaction.mockImplementation((operations) =>
      Promise.all(operations),
    );
  });

  it('updates existing topics and creates new topics in one transaction', async () => {
    topicReconciliationService.reconcile.mockResolvedValue([
      {
        id: existingTopicId,
        title: 'Updated topic',
        description: 'Updated description',
        state: 'CONFIRMED',
        summary: 'Updated summary',
        evidence: [{ content: 'Updated evidence', chunkIds: ['chunk-1'] }],
      },
      {
        title: 'New topic',
        description: 'New description',
        state: 'SUGGESTED',
        evidence: [{ content: 'New evidence', chunkIds: ['chunk-2'] }],
      },
    ]);

    await service.analyze('source-id');

    expect(prismaService.topic.update).toHaveBeenCalledWith({
      where: { id: existingTopicId, moduleId },
      data: {
        title: 'Updated topic',
        description: 'Updated description',
        state: 'CONFIRMED',
        summary: 'Updated summary',
        evidence: {
          deleteMany: {},
          create: [{ content: 'Updated evidence' }],
        },
      },
    });
    expect(prismaService.topic.create).toHaveBeenCalledWith({
      data: {
        title: 'New topic',
        description: 'New description',
        state: 'SUGGESTED',
        summary: null,
        moduleId,
        evidence: {
          create: [{ content: 'New evidence' }],
        },
      },
    });
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaService.$transaction).toHaveBeenCalledWith([
      expect.any(Promise),
      expect.any(Promise),
    ]);
  });

  it('rejects a source without pages', async () => {
    prismaService.sourcePage.findMany.mockResolvedValue([]);

    await expect(service.analyze('missing-source')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(topicReconciliationService.reconcile).not.toHaveBeenCalled();
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });
});
