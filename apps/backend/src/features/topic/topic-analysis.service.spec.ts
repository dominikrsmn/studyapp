import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';
import { TopicAnalysisService } from './topic-analysis.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('TopicAnalysisService', () => {
  const prismaService = {
    source: {
      findFirst: jest.fn(),
    },
  };
  const textProcessingService = {
    chunkForAnalysis: jest.fn(),
  };
  const service = new TopicAnalysisService(
    prismaService as unknown as PrismaService,
    textProcessingService as unknown as TextProcessingService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates analysis chunks for the source module', async () => {
    prismaService.source.findFirst.mockResolvedValue({
      module: {
        id: 'module-id',
        semester: { userId: 'user-id' },
      },
    });
    textProcessingService.chunkForAnalysis.mockResolvedValue(['chunk']);

    await service.analyze('source-id');

    expect(prismaService.source.findFirst).toHaveBeenCalledWith({
      where: { id: 'source-id' },
      select: {
        module: {
          select: {
            id: true,
            semester: {
              select: { userId: true },
            },
          },
        },
      },
    });
    expect(textProcessingService.chunkForAnalysis).toHaveBeenCalledWith(
      'module-id',
    );
  });

  it('rejects a missing source', async () => {
    prismaService.source.findFirst.mockResolvedValue(null);

    await expect(service.analyze('missing-source')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(textProcessingService.chunkForAnalysis).not.toHaveBeenCalled();
  });
});
