import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { embeddingConfig } from '../config/embedding.config';
import type { EmbeddingJobData } from './embedding.types';

@Processor(embeddingConfig().queue.name, {
  concurrency: embeddingConfig().queue.concurrency,
})
export class EmbeddingProcessor extends WorkerHost {
  // TODO: Dispatch to job handlers when the pipeline is implemented.
  async process(_job: Job<EmbeddingJobData>): Promise<void> {}
}
