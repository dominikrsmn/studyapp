import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { IngestionService } from './ingestion.service';
import type { SourceIngestionJobData } from './source-ingestion.queue';
import { sourceIngestionConfig } from './source-ingestion.config';

@Processor(sourceIngestionConfig().queueName, {
  concurrency: sourceIngestionConfig().concurrency,
})
export class SourceIngestionProcessor extends WorkerHost {
  constructor(private readonly ingestionService: IngestionService) {
    super();
  }

  process(job: Job<SourceIngestionJobData>): Promise<void> {
    return this.ingestionService.ingest(job.data.sourceId);
  }
}
