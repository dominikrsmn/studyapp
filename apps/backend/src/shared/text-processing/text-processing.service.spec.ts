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

  const prismaService = {};

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
            chunks: { chunkSize: 8, chunkOverlap: 2 },
          },
        },
      ],
    }).compile();

    service = module.get<TextProcessingService>(TextProcessingService);
  });

  it('creates fixed-size RAG chunks with the configured overlap', () => {
    expect(service.chunkForRag('abcdefghijkl')).toEqual([
      'abcde',
      'defgh',
      'ghijk',
      'jkl',
    ]);
  });

  it('creates analysis chunks with page-relative offsets', () => {
    expect(service.chunkForAnalysis('abcdefghijkl')).resolves.toEqual([
      { content: 'abcdefgh', startOffset: 0, endOffset: 8 },
      { content: 'ghijkl', startOffset: 6, endOffset: 12 },
    ]);
  });
});
