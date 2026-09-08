import { FlowProducer, Queue } from 'bullmq';
import { ingestionConfig } from './ingestion.config';
import { IngestionQueue } from './ingestion.queue';
import { IngestionJobData } from './ingestion.types';
import type { SourceProcessingStageService } from './source-processing-stage.service';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../infrastructure/database/generated/enums';

jest.mock('./source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));

describe('IngestionQueue', () => {
  const sourceId = 'source-id';
  const queue = { add: jest.fn() };
  const flowProducer = { add: jest.fn() };
  const sourceProcessingStageService = { transition: jest.fn() };
  const config = ingestionConfig();
  const ingestionQueue = new IngestionQueue(
    queue as unknown as Queue<IngestionJobData>,
    flowProducer as unknown as FlowProducer,
    config,
    sourceProcessingStageService as unknown as SourceProcessingStageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queue.add.mockResolvedValue(undefined);
    flowProducer.add.mockResolvedValue(undefined);
    sourceProcessingStageService.transition.mockResolvedValue(undefined);
  });

  it.each([
    {
      enqueue: () => ingestionQueue.addParseDocument(sourceId),
      stage: SourceProcessingStageType.CONVERSION,
    },
    {
      enqueue: () => ingestionQueue.addBuildRagChunks(sourceId),
      stage: SourceProcessingStageType.RAG_INDEXING,
    },
  ])(
    'marks $stage as queued before publishing its job',
    async ({ enqueue, stage }) => {
      await enqueue();

      expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
        sourceId,
        stage,
        ProcessingState.QUEUED,
      );
      expect(
        sourceProcessingStageService.transition.mock.invocationCallOrder[0],
      ).toBeLessThan(queue.add.mock.invocationCallOrder[0]);
    },
  );

  it('marks a stage failed when publishing its job fails', async () => {
    const error = new Error('queue unavailable');
    queue.add.mockRejectedValue(error);

    await expect(ingestionQueue.addParseDocument(sourceId)).rejects.toBe(error);

    expect(sourceProcessingStageService.transition).toHaveBeenLastCalledWith(
      sourceId,
      SourceProcessingStageType.CONVERSION,
      ProcessingState.FAILED,
      { error },
    );
  });

  it('adds the embedding batches as children of one finalization job', async () => {
    await ingestionQueue.addRagEmbeddingFlow(sourceId, [
      ['chunk-0', 'chunk-1'],
      ['chunk-2'],
    ]);

    expect(flowProducer.add).toHaveBeenCalledTimes(1);
    expect(flowProducer.add).toHaveBeenCalledWith(
      {
        name: config.queue.jobs.finalize_ingestion,
        queueName: config.queue.name,
        data: { sourceId },
        opts: {
          jobId: `${config.queue.jobs.finalize_ingestion}/${sourceId}`,
        },
        children: [
          {
            name: config.queue.jobs.embed_rag_chunks,
            queueName: config.queue.name,
            data: { sourceId, chunkIds: ['chunk-0', 'chunk-1'] },
            opts: {
              jobId: `${config.queue.jobs.embed_rag_chunks}/${sourceId}/0`,
              failParentOnFailure: true,
            },
          },
          {
            name: config.queue.jobs.embed_rag_chunks,
            queueName: config.queue.name,
            data: { sourceId, chunkIds: ['chunk-2'] },
            opts: {
              jobId: `${config.queue.jobs.embed_rag_chunks}/${sourceId}/1`,
              failParentOnFailure: true,
            },
          },
        ],
      },
      {
        queuesOptions: {
          [config.queue.name]: {
            defaultJobOptions: config.queue.defaultJobOptions,
          },
        },
      },
    );
  });

  it.each([{ batches: [] as string[][] }, { batches: [[]] as string[][] }])(
    'rejects empty embedding batches',
    async ({ batches }) => {
      await expect(
        ingestionQueue.addRagEmbeddingFlow(sourceId, batches),
      ).rejects.toThrow('Cannot enqueue empty RAG embedding batches');

      expect(flowProducer.add).not.toHaveBeenCalled();
    },
  );
});
