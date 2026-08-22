import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IngestionService } from './ingestion.service';
import type { SourceIngestionJobData } from './source-ingestion.queue';
import { ingestionConfig } from './ingestion.config';

@Processor(ingestionConfig().queue.name, {
  concurrency: ingestionConfig().queue.concurrency,
})
export class SourceIngestionProcessor extends WorkerHost {
  constructor(private readonly ingestionService: IngestionService) {
    super();
  }

  process(job: Job<SourceIngestionJobData>): Promise<void> {
    return this.ingestionService.ingest(job.data.sourceId);
  }
}
