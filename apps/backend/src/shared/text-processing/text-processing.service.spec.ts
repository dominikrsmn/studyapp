import { Test, TestingModule } from '@nestjs/testing';
import { ingestionConfig } from '../../features/ingestion/ingestion.config';
import { topicAnalysisConfig } from '../../features/topic/topic-analysis.config';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from './text-processing.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('TextProcessingService', () => {
  let service: TextProcessingService;

  const prismaService = {
    sourceChunk: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextProcessingService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: ingestionConfig.KEY,
          useValue: {
            ...ingestionConfig(),
            chunking: { size: 5, overlap: 2 },
          },
        },
        {
          provide: topicAnalysisConfig.KEY,
          useValue: {
            ...topicAnalysisConfig(),
            chunkSize: 8,
            chunkOverlap: 2,
          },
        },
      ],
    }).compile();

    service = module.get<TextProcessingService>(TextProcessingService);
    prismaService.sourceChunk.findMany.mockReset();
  });

  it('creates fixed-size RAG chunks with the configured overlap', () => {
    expect(service.chunkForRag('abcdefghijkl')).toEqual([
      'abcde',
      'defgh',
      'ghijk',
      'jkl',
    ]);
  });

  it('creates analysis chunks from all source chunks in a module', async () => {
    prismaService.sourceChunk.findMany.mockResolvedValue([
      { content: 'first' },
      { content: 'second' },
    ]);

    await expect(service.chunkForAnalysis('module-id')).resolves.toEqual([
      'first\nse',
      'second',
    ]);
    expect(prismaService.sourceChunk.findMany).toHaveBeenCalledWith({
      where: { source: { moduleId: 'module-id' } },
      select: { content: true },
      orderBy: [{ sourceId: 'asc' }, { chunkIndex: 'asc' }],
    });
  });
});
