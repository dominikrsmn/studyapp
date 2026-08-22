import type { Queue } from 'bullmq';
import { ingestionConfig } from './ingestion.config';
import { SourceIngestionQueue } from './source-ingestion.queue';

describe('SourceIngestionQueue', () => {
  it('enqueues a deduplicated job with exponential retries', async () => {
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const config = {
      ...ingestionConfig(),
      queue: { ...ingestionConfig().queue, attempts: 5, backoffDelay: 1_000 },
    };
    const sourceIngestionQueue = new SourceIngestionQueue(
      queue as unknown as Queue,
      config,
    );

    await sourceIngestionQueue.enqueue('source-id');

    expect(config.queue.name).toBe(ingestionConfig().queue.name);
    expect(queue.add).toHaveBeenCalledWith(
      ingestionConfig().queue.jobName,
      { sourceId: 'source-id' },
      {
        jobId: 'source-id',
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
      },
    );
  });
});
