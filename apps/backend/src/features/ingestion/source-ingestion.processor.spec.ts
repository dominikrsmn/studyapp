import type { Job } from 'bullmq';
import type { IngestionService } from './ingestion.service';
import { SourceIngestionProcessor } from './source-ingestion.processor';
import type { SourceIngestionJobData } from './source-ingestion.queue';

jest.mock('./ingestion.service', () => ({
  IngestionService: class IngestionService {},
}));

describe('SourceIngestionProcessor', () => {
  it('processes the source from the job payload', async () => {
    const ingestionService = { ingest: jest.fn().mockResolvedValue(undefined) };
    const processor = new SourceIngestionProcessor(
      ingestionService as unknown as IngestionService,
    );

    await processor.process({
      data: { sourceId: 'source-id' },
    } as Job<SourceIngestionJobData>);

    expect(ingestionService.ingest).toHaveBeenCalledWith('source-id');
  });

  it('lets ingestion failures reach BullMQ', async () => {
    const error = new Error('embedding unavailable');
    const ingestionService = { ingest: jest.fn().mockRejectedValue(error) };
    const processor = new SourceIngestionProcessor(
      ingestionService as unknown as IngestionService,
    );

    await expect(
      processor.process({
        data: { sourceId: 'source-id' },
      } as Job<SourceIngestionJobData>),
    ).rejects.toBe(error);
  });
});
