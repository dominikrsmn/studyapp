import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ingestionConfig } from './ingestion.config';
import {
  BuildRagChunksJobData,
  IngestionJobData,
  ParseDocumentJobData,
} from './ingestion.types';
import { Inject, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ParseDocumentJob } from './jobs/parse-document.job';
import { BuildRagChunksJob } from './jobs/build-rag-chunks.job';

@Processor(ingestionConfig().queue.name, {})
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    @Inject(ingestionConfig.KEY)
    private readonly config: ConfigType<typeof ingestionConfig>,
    private readonly parseDocumentJob: ParseDocumentJob,
    private readonly buildRagChunksJob: BuildRagChunksJob,
  ) {
    super();
  }

  process(job: Job<IngestionJobData>): Promise<void> {
    this.logger.log(`Processing ${job.name} job: ${job.id}`);
    switch (job.name) {
      case this.config.queue.jobs.parse_document:
        return this.parseDocumentJob.process(job.data as ParseDocumentJobData);
      case this.config.queue.jobs.build_rag_chunks:
        return this.buildRagChunksJob.process(
          job.data as BuildRagChunksJobData,
        );
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
