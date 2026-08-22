import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';
import { TopicAnalysisService } from './topic-analysis.service';
import { TopicCandidateExtractionService } from './topic-candidate-extractor/topic-candidate-extraction.service';
import { TopicCandidateConsolidationService } from './topic-candidate-consolidator/topic-candidate-consolidation.service';
import { TopicReconciliationService } from './topic-reconciler/topic-reconciliation.service';
import type { AnalysisChunk } from './topic.types';

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
    textProcessingService.chunkForAnalysis.mockResolvedValue([
      {
        content: 'first chunk',
        startOffset: 0,
        endOffset: 11,
      },
      {
        content: 'second chunk',
        startOffset: 9,
        endOffset: 21,
      },
    ]);
    candidateExtractionService.extract.mockResolvedValue([]);
    candidateConsolidationService.consolidate.mockResolvedValue([]);
    prismaService.topic.findMany.mockResolvedValue([
      {
        id: existingTopicId,
        title: 'Existing topic',
        description: 'Existing description',
        summary: null,
        evidence: [
          { id: 'evidence-id', content: 'Existing evidence', provenance: [] },
        ],
      },
    ]);
    prismaService.topic.update.mockResolvedValue({ id: existingTopicId });
    prismaService.topic.create.mockResolvedValue({ id: 'new-topic-id' });
    prismaService.$transaction.mockImplementation((operations) =>
      Promise.all(operations),
    );
  });

  it('updates existing topics and creates new topics in one transaction', async () => {
    candidateExtractionService.extract.mockImplementation((chunks) => [
      {
        title: 'Existing candidate',
        description: 'Existing candidate description',
        facts: [
          { content: 'Existing evidence', chunkIds: [chunks[0].id] },
          { content: 'Updated evidence', chunkIds: [chunks[0].id] },
        ],
      },
      {
        title: 'New candidate',
        description: 'New candidate description',
        facts: [{ content: 'New evidence', chunkIds: [chunks[1].id] }],
      },
    ]);
    candidateConsolidationService.consolidate.mockImplementation(
      (candidates) => candidates,
    );
    topicReconciliationService.reconcile.mockResolvedValue({
      existingTopicMatches: [
        {
          topicId: existingTopicId,
          candidateIndexes: [0],
        },
      ],
      newTopics: [
        {
          title: 'New topic',
          description: 'New description',
          candidateIndexes: [1],
        },
      ],
    });

    await service.analyze('source-id');

    expect(prismaService.topic.update).toHaveBeenCalledWith({
      where: { id: existingTopicId, moduleId },
      data: {
        evidence: {
          create: [
            {
              content: 'Existing evidence',
              provenance: {
                create: [
                  expect.objectContaining({
                    analysisChunkId: expect.stringMatching(/^analysis-chunk:/),
                    sourceId: 'source-id',
                    sourcePageId: 'page-id',
                    pageNumber: 1,
                    chunkIndex: 0,
                    startOffset: 0,
                    endOffset: 11,
                    content: 'first chunk',
                  }),
                ],
              },
            },
            {
              content: 'Updated evidence',
              provenance: {
                create: [
                  expect.objectContaining({
                    analysisChunkId: expect.stringMatching(/^analysis-chunk:/),
                  }),
                ],
              },
            },
          ],
        },
      },
    });
    expect(prismaService.topic.create).toHaveBeenCalledWith({
      data: {
        title: 'New topic',
        description: 'New description',
        moduleId,
        evidence: {
          create: [
            {
              content: 'New evidence',
              provenance: {
                create: [
                  expect.objectContaining({
                    analysisChunkId: expect.stringMatching(/^analysis-chunk:/),
                    sourceId: 'source-id',
                    sourcePageId: 'page-id',
                    pageNumber: 1,
                    chunkIndex: 1,
                    startOffset: 9,
                    endOffset: 21,
                    content: 'second chunk',
                  }),
                ],
              },
            },
          ],
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

  it('creates distinct deterministic IDs while retaining the current page ID', async () => {
    topicReconciliationService.reconcile.mockResolvedValue({
      existingTopicMatches: [],
      newTopics: [],
    });

    await service.analyze('source-id');
    const firstRunChunks = candidateExtractionService.extract.mock
      .calls[0][0] as AnalysisChunk[];

    prismaService.sourcePage.findMany.mockResolvedValue([
      {
        id: 'recreated-page-id',
        sourceId: 'source-id',
        pageNumber: 1,
        content: 'page content',
        createdAt: new Date(),
        source: { moduleId },
      },
    ]);
    await service.analyze('source-id');
    const secondRunChunks = candidateExtractionService.extract.mock
      .calls[1][0] as AnalysisChunk[];

    expect(firstRunChunks.map(({ id }) => id)).toEqual([
      'analysis-chunk:v1:source-id:page:1:chunk:0:offsets:0-11',
      'analysis-chunk:v1:source-id:page:1:chunk:1:offsets:9-21',
    ]);
    expect(secondRunChunks.map(({ id }) => id)).toEqual(
      firstRunChunks.map(({ id }) => id),
    );
    expect(secondRunChunks.map(({ sourcePageId }) => sourcePageId)).toEqual([
      'recreated-page-id',
      'recreated-page-id',
    ]);
  });
});
