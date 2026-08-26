import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import { SourceProcessingStageService } from './source-processing-stage.service';
import { SourceEventService } from '../source-event.service';

jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SourceProcessingStageService', () => {
  const sourceId = 'f43ff589-36b0-4f0f-b0cf-9cc1101b1952';
  const moduleId = 'f74a46b6-2d6d-4542-a9b8-37a8eef82d8c';
  const stage = SourceProcessingStageType.RAG_INDEXING;
  const sourceProcessingStage = { upsert: jest.fn() };
  const prismaService = { sourceProcessingStage };
  const sourceEventService = { stateChanges: jest.fn() };

  let service: SourceProcessingStageService;

  beforeEach(() => {
    jest.clearAllMocks();
    sourceProcessingStage.upsert.mockResolvedValue({
      id: 'stage-id',
      errorMessage: null,
      source: { moduleId },
    });
    service = new SourceProcessingStageService(
      prismaService as unknown as PrismaService,
      sourceEventService as unknown as SourceEventService,
    );
  });

  it('initializes every processing stage as not started', async () => {
    await service.initialize(sourceId);

    for (const processingStage of Object.values(SourceProcessingStageType)) {
      expect(sourceProcessingStage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sourceId_stage: { sourceId, stage: processingStage },
          },
          create: expect.objectContaining({
            sourceId,
            stage: processingStage,
            state: ProcessingState.NOT_STARTED,
          }),
        }),
      );
    }
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
        include: {
          source: {
            select: { moduleId: true },
          },
        },
      });
      expect(sourceEventService.stateChanges).toHaveBeenCalledWith({
        sourceId,
        moduleId,
        processingStage,
        processingState: ProcessingState.PROCESSING,
      });
    },
  );

  it('marks a stage completed through a provided transaction', async () => {
    const transactionStage = {
      upsert: jest.fn().mockResolvedValue({
        id: 'stage-id',
        errorMessage: null,
        source: { moduleId },
      }),
    };
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
      include: {
        source: {
          select: { moduleId: true },
        },
      },
    });
    expect(sourceProcessingStage.upsert).not.toHaveBeenCalled();
    expect(sourceEventService.stateChanges).toHaveBeenCalledWith({
      sourceId,
      moduleId,
      processingStage: stage,
      processingState: ProcessingState.COMPLETED,
    });
  });

  it('stores a useful message when a stage fails', async () => {
    const error = new Error('Embedding failed');
    sourceProcessingStage.upsert.mockResolvedValue({
      id: 'stage-id',
      errorMessage: error.message,
      source: { moduleId },
    });

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
    expect(sourceEventService.stateChanges).toHaveBeenCalledWith({
      sourceId,
      moduleId,
      processingStage: stage,
      processingState: ProcessingState.FAILED,
      info: error.message,
    });
  });

  it('does not publish when persisting the transition fails', async () => {
    sourceProcessingStage.upsert.mockRejectedValue(new Error('Database down'));

    await expect(
      service.transition(sourceId, stage, ProcessingState.PROCESSING),
    ).rejects.toThrow('Database down');

    expect(sourceEventService.stateChanges).not.toHaveBeenCalled();
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
