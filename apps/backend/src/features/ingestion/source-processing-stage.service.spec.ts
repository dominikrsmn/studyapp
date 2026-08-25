import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../infrastructure/database/generated/enums';
import { SourceProcessingStageService } from './source-processing-stage.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SourceProcessingStageService', () => {
  const sourceId = 'source-id';
  const stage = SourceProcessingStageType.RAG_INDEXING;
  const sourceProcessingStage = { upsert: jest.fn() };
  const prismaService = { sourceProcessingStage };

  let service: SourceProcessingStageService;

  beforeEach(() => {
    jest.clearAllMocks();
    sourceProcessingStage.upsert.mockResolvedValue({ id: 'stage-id' });
    service = new SourceProcessingStageService(
      prismaService as unknown as PrismaService,
    );
  });

  it.each(Object.values(SourceProcessingStageType))(
    'moves the %s stage to processing and starts a fresh attempt',
    async (processingStage) => {
      await service.transition(
        sourceId,
        processingStage,
        ProcessingState.PROCESSING,
      );

      expect(sourceProcessingStage.upsert).toHaveBeenCalledWith({
        where: {
          sourceId_stage: { sourceId, stage: processingStage },
        },
        create: {
          sourceId,
          stage: processingStage,
          state: ProcessingState.PROCESSING,
          startedAt: expect.any(Date),
          completedAt: null,
          errorMessage: null,
        },
        update: {
          state: ProcessingState.PROCESSING,
          startedAt: expect.any(Date),
          completedAt: null,
          errorMessage: null,
        },
      });
    },
  );

  it('marks a stage completed through a provided transaction', async () => {
    const transactionStage = { upsert: jest.fn() };
    const transaction = {
      sourceProcessingStage: transactionStage,
    };

    await service.transition(sourceId, stage, ProcessingState.COMPLETED, {
      transaction: transaction as never,
    });

    expect(transactionStage.upsert).toHaveBeenCalledWith({
      where: { sourceId_stage: { sourceId, stage } },
      create: {
        sourceId,
        stage,
        state: ProcessingState.COMPLETED,
        completedAt: expect.any(Date),
        errorMessage: null,
      },
      update: {
        state: ProcessingState.COMPLETED,
        completedAt: expect.any(Date),
        errorMessage: null,
      },
    });
    expect(sourceProcessingStage.upsert).not.toHaveBeenCalled();
  });

  it('stores a useful message when a stage fails', async () => {
    const error = new Error('Embedding failed');

    await service.transition(sourceId, stage, ProcessingState.FAILED, {
      error,
    });

    expect(sourceProcessingStage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          state: ProcessingState.FAILED,
          completedAt: expect.any(Date),
          errorMessage: error.message,
        }),
        update: expect.objectContaining({
          state: ProcessingState.FAILED,
          completedAt: expect.any(Date),
          errorMessage: error.message,
        }),
      }),
    );
  });

  it.each([ProcessingState.NOT_STARTED, ProcessingState.QUEUED])(
    'resets stale attempt data when moving a stage to %s',
    async (state) => {
      await service.transition(sourceId, stage, state);

      expect(sourceProcessingStage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            state,
            startedAt: null,
            completedAt: null,
            errorMessage: null,
          },
        }),
      );
    },
  );
});
