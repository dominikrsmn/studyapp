import type { LearningGraphService } from '../learning-graph/learning-graph.service';
import { Decimal } from '@prisma/client/runtime/client';
import { SourceService } from './source.service';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../infrastructure/filestorage/filestorage.service', () => ({
  FileStorageService: class {},
}));
jest.mock('../source-ingestion/ingestion.queue', () => ({ IngestionQueue: class {} }));
jest.mock('../source-ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class {},
}));

describe('Source job overview', () => {
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const service = new SourceService(
    {
      source: { findFirst },
      sourceJob: { findMany },
    } as unknown as PrismaService,
    {} as never,
    {} as never,
    {} as never,
    { regenerate: jest.fn() } as unknown as LearningGraphService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks source ownership before reading any costs', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.getJobs('user', 'module', 'source')).rejects.toThrow(
      'Source was not found',
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'source',
          moduleId: 'module',
          module: { semester: { userId: 'user' } },
        },
      }),
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('keeps legacy sources with no job history and no costs available', async () => {
    const stages = [
      { stage: 'TOPIC_ANALYSIS', state: 'COMPLETED', errorMessage: null },
    ];
    findFirst.mockResolvedValue({ processingStages: stages });
    findMany.mockResolvedValue([]);
    await expect(service.getJobs('user', 'module', 'source')).resolves.toEqual({
      jobs: [],
      recordedCostUsd: null,
      processingStages: stages,
    });
  });

  it('sums multiple requests exactly and preserves missing costs as null', async () => {
    findFirst.mockResolvedValue({ processingStages: [] });
    const base = {
      name: 'extract-source-topics',
      attempt: 1,
      state: 'COMPLETED',
      startedAt: new Date(),
      finishedAt: null,
      sourceIds: ['source'],
    };
    findMany.mockResolvedValue([
      {
        ...base,
        id: '1',
        costs: [
          { costUsd: new Decimal('0.00000002') },
          { costUsd: new Decimal('0.12345678') },
        ],
      },
      { ...base, id: '2', costs: [], sourceIds: ['source', 'other'] },
    ]);
    const result = await service.getJobs('user', 'module', 'source');
    expect(result.recordedCostUsd).toBe('0.12345680');
    expect(result.jobs[0].costUsd).toBe('0.12345680');
    expect(result.jobs[1]).toMatchObject({ costUsd: null, shared: true });
  });
});
