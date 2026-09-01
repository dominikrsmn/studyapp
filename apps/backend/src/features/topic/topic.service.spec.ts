import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  ProcessingState,
  SourceProcessingStageType,
  TopicState,
} from '../../infrastructure/database/generated/enums';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TopicService } from './topic.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('TopicService', () => {
  let service: TopicService;
  const moduleDelegate = { findFirst: jest.fn() };
  const topicDelegate = { findMany: jest.fn() };

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        TopicService,
        {
          provide: PrismaService,
          useValue: { module: moduleDelegate, topic: topicDelegate },
        },
      ],
    }).compile();

    service = testingModule.get(TopicService);
    jest.clearAllMocks();
  });

  it('returns non-rejected topics with SourceTopics from completed analyses', async () => {
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    topicDelegate.findMany.mockResolvedValue([
      {
        id: 'topic-id',
        title: 'Integral Calculus',
        description: 'Techniques for evaluating integrals.',
        summary: 'A concise topic summary.',
        sourceTopics: [
          {
            id: 'source-topic-id',
            title: 'Integration by parts',
            description: 'Derivation and examples.',
            pageStart: 12,
            pageEnd: 16,
            source: { id: 'source-id', name: 'Lecture 07.pdf' },
          },
        ],
      },
    ]);

    await expect(service.findAll('semester-id', 'module-id')).resolves.toEqual([
      {
        id: 'topic-id',
        title: 'Integral Calculus',
        description: 'Techniques for evaluating integrals.',
        summary: 'A concise topic summary.',
        sourceTopics: [
          {
            id: 'source-topic-id',
            title: 'Integration by parts',
            description: 'Derivation and examples.',
            pageStart: 12,
            pageEnd: 16,
            source: { id: 'source-id', name: 'Lecture 07.pdf' },
          },
        ],
      },
    ]);

    expect(topicDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          moduleId: 'module-id',
          state: { not: TopicState.REJECTED },
          sourceTopics: {
            some: {
              source: {
                processingStages: {
                  some: {
                    stage: SourceProcessingStageType.TOPIC_ANALYSIS,
                    state: ProcessingState.COMPLETED,
                  },
                },
              },
            },
          },
        },
      }),
    );
  });

  it('rejects access to modules outside the active semester', async () => {
    moduleDelegate.findFirst.mockResolvedValue(null);

    await expect(
      service.findAll('semester-id', 'other-module'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(topicDelegate.findMany).not.toHaveBeenCalled();
  });
});
